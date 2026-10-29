// -----------------------------------------------------------------------------
// The integration at runtime: the cities read, their last readings, the
// refresh timer, the devices offered in the Discover tab, the states of the
// pools added to Gladys, and the scene triggers.
//
// Data flow: every city ticked in the configuration, plus every city with a
// pool added to Gladys, is read at the configured pace (one request per
// city). Every pool of the ticked cities is offered in the Discover tab; the
// ones the user adds are the "watched" pools: states, widget, triggers and
// scene action.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { DEFAULT_CONFIG, normalizeConfig } from './config.js';
import {
  POOL_TYPE,
  buildPoolDevice,
  clock,
  occupancy,
  poolPlatformId,
  poolStates,
  prettyName,
} from './devices.js';
import { REPORTS, TEXT, lines, render, say } from './messages.js';
import { SOURCES, SOURCE_KEYS, parisMinutes } from './sources.js';

const logger = createLogger({ name: 'piscines' });

// A count older than this is "out of date": shown grey, never compared by
// the triggers. Strasbourg refreshes about every 10 minutes, Bordeaux 5.
export const STALE_MS = 45 * 60 * 1000;
// Unchanged states (a pool closed all night) are sent again this often, or
// the dashboard shows "no recent value" after 48 hours.
export const HEARTBEAT_MS = 6 * 3600 * 1000;

export const TRIGGERS = {
  OPENED: 'opened',
  CLOSED: 'closed',
  CROWD_ABOVE: 'crowd_above',
  CROWD_BELOW: 'crowd_below',
};
// The thresholds offered by the crowd triggers, in people (the scene filters
// only compare for equality: an event is fired for every threshold crossed).
export const THRESHOLDS = [20, 50, 100, 150, 200, 300];

export const WIDGET_KEY = 'pools';

/** One city at runtime: its source, its last readings and how they went. */
class City {
  constructor(key) {
    this.key = key;
    this.source = SOURCES[key];
    this.readings = null; // Map id → reading
    this.okAt = null;
    this.previousOkAt = null;
    this.error = null;
  }
}

/** Today's slot the time is in, and the next one: `{ current, next }`. */
export function slotsAt(schedule, minutes) {
  const slots = schedule ?? [];
  return {
    current: slots.find(({ from, to }) => minutes >= from && minutes < to) ?? null,
    next: slots.find(({ from }) => from > minutes) ?? null,
  };
}

export class Pools {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK's fake)
   * @param {typeof fetch} [options.fetch]
   * @param {() => number} [options.now]
   * @param {boolean} [options.timers] false in the tests: they call refresh()
   */
  constructor({ gladys, fetch = globalThis.fetch, now = Date.now, timers = true }) {
    this.gladys = gladys;
    this.fetch = fetch;
    this.now = now;
    this.useTimers = timers;
    this.config = normalizeConfig(DEFAULT_CONFIG);
    this.cities = new Map(); // key → City
    this.discoveredSignature = null;
    this.publishFailed = false;
    this.discoveryFailed = false;
    this.fireFailed = false;
    this.timer = null;
    this.stopped = false;
    this.refreshing = null;
    this.loading = Promise.resolve();
  }

  // --- lifecycle --------------------------------------------------------------

  async start(config) {
    this.config = config;
    this.schedule();
    logger.info(
      `Started: ${config.cities.length} city(ies) chosen, ${this.watched().length} pool(s) added`,
    );
    // The first reading in the background: the widget and the scene action
    // wait for it.
    this.loading = this.refresh({ discover: true });
  }

  /** Gladys restarted: everything again, the states included. */
  async resync(config) {
    this.config = config;
    this.gladys.forgetPublishedStates?.();
    await this.refresh({ discover: true });
  }

  async reconfigure(config) {
    const languageChanged = config.language !== this.config.language;
    this.config = config;
    if (languageChanged) {
      // The crowd and hours texts follow the language.
      this.gladys.forgetPublishedStates?.();
    }
    this.schedule();
    await this.refresh({ discover: true });
  }

  async stop() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.refreshing;
  }

  schedule() {
    if (!this.useTimers || this.stopped) {
      return;
    }
    clearTimeout(this.timer);
    // A callback still running when the schedule changes must not start a
    // second chain: each chain only continues while it is the current one.
    this.generation = (this.generation ?? 0) + 1;
    const generation = this.generation;
    const tick = () => {
      this.timer = setTimeout(async () => {
        await this.refresh();
        if (!this.stopped && this.generation === generation) {
          tick();
        }
      }, this.config.refreshSeconds * 1000);
      this.timer.unref?.();
    };
    tick();
  }

  // --- devices ----------------------------------------------------------------

  deviceId(key, id) {
    return this.gladys.externalIds(POOL_TYPE, poolPlatformId(key, id)).device;
  }

  /** The source key of a device created in Gladys, from its params or its external id. */
  sourceOfDevice(device) {
    const param = device?.params?.find?.((p) => p.name === 'source')?.value;
    if (SOURCE_KEYS.includes(param)) {
      return param;
    }
    const id = String(device?.external_id ?? '');
    return SOURCE_KEYS.find((key) => id.includes(`:${key}-`)) ?? null;
  }

  /** The pools added to Gladys: `{ deviceId, key, name }[]`. */
  watched() {
    return (this.gladys.devices ?? [])
      .map((device) => ({
        deviceId: device.external_id,
        key: this.sourceOfDevice(device),
        name: device.name,
      }))
      .filter((entry) => entry.key);
  }

  /** The cities to read: the ones ticked, and the ones of the pools added. */
  activeKeys() {
    const keys = new Set([...this.config.cities, ...this.watched().map((entry) => entry.key)]);
    return SOURCE_KEYS.filter((key) => keys.has(key));
  }

  city(key) {
    if (!this.cities.has(key)) {
      this.cities.set(key, new City(key));
    }
    return this.cities.get(key);
  }

  /** The last reading of a device's pool: `{ city, reading }`, reading null if unknown. */
  lookup(deviceId) {
    for (const city of this.cities.values()) {
      for (const reading of city.readings?.values() ?? []) {
        if (this.deviceId(city.key, reading.id) === deviceId) {
          return { city, reading };
        }
      }
    }
    const entry = this.watched().find((w) => w.deviceId === deviceId);
    return entry ? { city: this.city(entry.key), reading: null } : null;
  }

  /** Age of a count in ms: from the portal's date, else from the last read. */
  ageMs(city, reading) {
    const at = reading.updatedAt ?? city.okAt;
    return at === null ? Infinity : Math.max(0, this.now() - at);
  }

  /** Waits for the first reading (at most `ms`), for a widget or a scene action asked at start. */
  async firstReading(ms = 10000) {
    let timer;
    await Promise.race([
      this.loading,
      new Promise((resolve) => {
        timer = setTimeout(resolve, ms);
      }),
    ]);
    clearTimeout(timer);
  }

  isStale(city, reading) {
    return this.ageMs(city, reading) > STALE_MS;
  }

  async publishDiscovered({ force = false } = {}) {
    const devices = [];
    for (const key of this.config.cities) {
      const city = this.cities.get(key);
      for (const reading of city?.readings?.values() ?? []) {
        devices.push(buildPoolDevice(this.gladys, key, city.source, reading, this.config.language));
      }
    }
    const signature = JSON.stringify(devices.map((d) => [d.external_id, d.name, d.features]));
    if (!force && signature === this.discoveredSignature) {
      return;
    }
    try {
      await this.gladys.publishDiscoveredDevices(devices);
      this.discoveredSignature = signature;
      if (this.discoveryFailed) {
        this.discoveryFailed = false;
        logger.info('Discovered pools published again');
      }
    } catch (err) {
      if (!this.discoveryFailed) {
        logger.warn(`Cannot publish the discovered pools: ${err.message}`);
      }
      this.discoveryFailed = true;
    }
  }

  async publish(states) {
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: HEARTBEAT_MS });
      if (this.publishFailed) {
        this.publishFailed = false;
        logger.info('States published again');
      }
    } catch (err) {
      // Gladys restarting: said once, the next refresh sends them again.
      if (!this.publishFailed) {
        logger.warn(`Cannot publish ${states.length} state(s): ${err.message}`);
      }
      this.publishFailed = true;
    }
  }

  statesOf(city, reading) {
    return poolStates(
      this.gladys,
      city.key,
      city.source,
      reading,
      this.ageMs(city, reading) / 60000,
      this.config.language,
    );
  }

  refreshWidget() {
    this.gladys.requestWidgetRefresh?.(WIDGET_KEY)?.catch?.(() => {});
  }

  /** A device was just added in Gladys: its states, all of them, now. */
  async onDeviceCreated(device) {
    const found = this.lookup(device?.external_id);
    if (found?.reading) {
      await this.publish(this.statesOf(found.city, found.reading));
    }
    this.refreshWidget();
  }

  // --- refresh ------------------------------------------------------------------

  /** One read of every active city; concurrent calls share it. */
  refresh({ discover = false } = {}) {
    if (!this.refreshing) {
      this.refreshing = this.refreshAll(discover)
        .catch((err) => logger.warn(`Refresh failed: ${err.message}`))
        .finally(() => {
          this.refreshing = null;
        });
      return this.refreshing;
    }
    // A discovery asked during a refresh (cities just ticked) reads again
    // right after it: the running one may not include the new cities.
    return discover ? this.refreshing.then(() => this.refresh({ discover })) : this.refreshing;
  }

  async refreshAll(forceDiscovery) {
    const events = [];
    for (const key of this.activeKeys()) {
      const city = this.city(key);
      const previous = city.readings;
      if (await this.readCity(city)) {
        events.push(...this.cityEvents(city, previous));
      }
    }
    await this.publishDiscovered({ force: forceDiscovery });
    // States of every pool added, even when its city could not be read: its
    // age keeps growing.
    const states = [];
    for (const entry of this.watched()) {
      const found = this.lookup(entry.deviceId);
      if (found?.reading) {
        states.push(...this.statesOf(found.city, found.reading));
      }
    }
    await this.publish(states);
    for (const { key, data } of events) {
      await this.fire(key, data);
    }
  }

  /** Reads a city; a failure is logged once, until it works again. */
  async readCity(city) {
    try {
      const readings = await city.source.read(this.fetch);
      city.readings = new Map(readings.map((reading) => [reading.id, reading]));
      city.previousOkAt = city.okAt;
      city.okAt = this.now();
      if (city.error) {
        logger.info(`${city.source.name}: data back`);
      }
      city.error = null;
      logger.debug(`${city.source.name}: ${readings.length} pools read`);
      return true;
    } catch (err) {
      if (!city.error) {
        logger.warn(`${city.source.name}: data unavailable: ${err.message}`);
      }
      city.error = err.message;
      return false;
    }
  }

  /** The trigger events between the previous and the new readings of a city. */
  cityEvents(city, previous) {
    // A comparison with a reading hours old (a portal back after an outage)
    // would fire changes that are no longer news.
    const recent =
      previous &&
      city.previousOkAt !== null &&
      city.okAt - city.previousOkAt <= 2 * this.config.refreshSeconds * 1000 + 5000;
    if (!recent) {
      return [];
    }
    const created = new Set(this.watched().map((entry) => entry.deviceId));
    const events = [];
    for (const after of city.readings.values()) {
      const deviceId = this.deviceId(city.key, after.id);
      const before = previous.get(after.id);
      // Only a created device can be picked by a scene; an out of date count
      // is not news either.
      const staleBefore =
        before?.updatedAt !== null &&
        before?.updatedAt !== undefined &&
        city.previousOkAt - before.updatedAt > STALE_MS;
      if (!before || !created.has(deviceId) || this.isStale(city, after) || staleBefore) {
        continue;
      }
      events.push(...this.poolEvents(city, deviceId, before, after));
    }
    return events;
  }

  /** The events of one pool between two readings. */
  poolEvents(city, deviceId, before, after) {
    const events = [];
    const data = {
      pool: deviceId,
      pool_name: prettyName(after.name),
      city: city.source.name,
      people: after.people ?? 0,
      occupancy: occupancy(after) ?? 0,
    };
    if (before.open === 0 && after.open === 1) {
      events.push({ key: TRIGGERS.OPENED, data });
    }
    if (before.open === 1 && after.open === 0) {
      events.push({ key: TRIGGERS.CLOSED, data });
    }
    // Without a count now (a closed pool), nothing to compare; a reopening
    // counts from zero.
    if (after.people === null || after.open === 0) {
      return events;
    }
    // Without an open state (Bordeaux), a count falling to 0 is the closing
    // or the nightly reset, not a quiet moment.
    if (!city.source.hasOpen && after.people === 0) {
      return events;
    }
    const from = before.open === 0 ? 0 : before.people;
    if (from === null) {
      return events;
    }
    for (const threshold of THRESHOLDS) {
      if (from <= threshold && after.people > threshold) {
        events.push({ key: TRIGGERS.CROWD_ABOVE, data: { ...data, threshold: String(threshold) } });
      } else if (from > threshold && after.people <= threshold) {
        events.push({ key: TRIGGERS.CROWD_BELOW, data: { ...data, threshold: String(threshold) } });
      }
    }
    return events;
  }

  async fire(key, data) {
    try {
      await this.gladys.publishSceneEvent(key, data);
      if (this.fireFailed) {
        this.fireFailed = false;
        logger.info('Scene triggers fired again');
      }
    } catch (err) {
      if (!this.fireFailed) {
        logger.warn(`Cannot fire the ${key} trigger: ${err.message}`);
      }
      this.fireFailed = true;
    }
  }

  // --- texts ------------------------------------------------------------------

  /** Today's slot now and the next one, in Paris time. */
  slotsNow(reading) {
    return slotsAt(reading?.schedule, parisMinutes(this.now()));
  }

  /**
   * "85 pers. · fluide · jusqu'à 20:00", "fermée · ouvre à 14:00"… for a
   * widget row (40 characters).
   */
  shortText(city, reading, language, { hours = true } = {}) {
    if (!reading) {
      return '—';
    }
    if (this.isStale(city, reading)) {
      return say(TEXT, language, 'stale');
    }
    const { current, next } = this.slotsNow(reading);
    if (reading.open === 0) {
      return [
        say(TEXT, language, 'closed'),
        hours && next ? say(TEXT, language, 'opensAt', { time: clock(next.from) }) : null,
      ]
        .filter(Boolean)
        .join(' · ');
    }
    return [
      reading.people === null
        ? say(TEXT, language, 'noCount')
        : say(TEXT, language, 'people', reading),
      reading.level ? say(TEXT, language, `level_${reading.level}`) : null,
      hours && current ? say(TEXT, language, 'until', { time: clock(current.to) }) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  /** "Piscine du Wacken : 85 personnes (fluide), ouverte jusqu'à 20:00." */
  sentence(city, reading, language) {
    const name = prettyName(reading.name);
    if (reading.open === 0) {
      return say(TEXT, language, 'sentenceClosed', { name });
    }
    if (reading.people === null || this.isStale(city, reading)) {
      return say(TEXT, language, 'sentenceNoCount', { name });
    }
    const { current } = this.slotsNow(reading);
    return say(TEXT, language, 'sentence', {
      name,
      people: reading.people,
      capacity: reading.capacity,
      crowd: reading.level ? say(TEXT, language, `level_${reading.level}`) : null,
      until: current ? clock(current.to) : null,
    });
  }

  // --- configuration action -----------------------------------------------------

  status() {
    const now = this.now();
    const blocks = [];
    if (this.config.cities.length === 0) {
      blocks.push(render(REPORTS, 'noCity'));
    }
    for (const key of this.activeKeys()) {
      const city = this.city(key);
      blocks.push(
        render(REPORTS, 'city', { name: city.source.name, count: city.readings?.size ?? 0 }),
        city.okAt === null
          ? render(REPORTS, 'waiting')
          : render(REPORTS, 'read', { age: Math.round((now - city.okAt) / 1000) }),
        city.error ? render(REPORTS, 'error', { error: city.error }) : null,
      );
    }
    blocks.push(render(REPORTS, 'watched', { count: this.watched().length }));
    return lines(...blocks);
  }
}
