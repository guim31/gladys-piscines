// -----------------------------------------------------------------------------
// The Gladys device of a swimming pool and its states. The features depend on
// what the city publishes:
//
//   open       input/binary                       1 = open        Strasbourg
//   people     counter-sensor/integer             people inside   both
//   capacity   counter-sensor/integer             people allowed  Bordeaux
//   occupancy  level-sensor/liquid-level-percent  people/capacity Bordeaux
//   crowd      text/text                          crowd level     Strasbourg
//   hours      text/text                          today's hours   Strasbourg
//   age        duration/integer (minutes)         age of the data both
//
// Read-only, no polling: the integration reads the portals on its own timer
// (src/service.js), Gladys never polls (`should_poll: false`). The bounds are
// display bounds (gauges, charts), rounded up so that a capacity changed by
// a few people does not change the structure of the device.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
} from '@gladysassistant/integration-sdk';
import { NAMES, TEXT, say } from './messages.js';

export const POOL_TYPE = 'pool';
export const MAX_DEVICE_NAME = 80;
export const MAX_AGE_MINUTES = 1440;
// Display bound of the count when the city gives no capacity.
export const DEFAULT_COUNT_MAX = 1000;
// Text features take `{ text }` states, never `{ state }`.
export const TEXT_FEATURES = new Set(['crowd', 'hours']);

/** Shortens a text to `max` characters, with an ellipsis. */
export function clip(text, max) {
  const value = String(text ?? '');
  return value.length <= max ? value : `${value.slice(0, max - 1).trimEnd()}…`;
}

/** A piece of an external id: letters, digits, "_" and "-" only. */
export const slug = (value) =>
  String(value ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** The platform id of a pool: "<source key>-<id given by the portal>". */
export const poolPlatformId = (sourceKey, id) => `${sourceKey}-${slug(id)}`;

/** "Piscine Jean Zay" from the operator's "Piscine Jean ZAY": words in capitals only. */
export function prettyName(name) {
  const small = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'et', 'sur', 'aux', 'au', 'en']);
  return String(name ?? '')
    .trim()
    .split(/(\s+|-|'|’)/)
    .map((word, index) => {
      if (word.length < 2 || word !== word.toUpperCase() || !/\p{L}{2}/u.test(word)) {
        return word;
      }
      const lower = word.toLowerCase();
      if (small.has(lower) && index > 0) {
        return lower;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join('');
}

/** Display bound of the counters: the capacity rounded up to the hundred. */
export const countMax = (capacity) =>
  capacity ? Math.max(100, Math.ceil(capacity / 100) * 100) : DEFAULT_COUNT_MAX;

/** The feature keys of a pool of this source. */
export const featureKeys = (source) => [
  ...(source.hasOpen ? ['open'] : []),
  'people',
  ...(source.hasCapacity ? ['capacity', 'occupancy'] : []),
  ...(source.hasLevel ? ['crowd'] : []),
  ...(source.hasSchedule ? ['hours'] : []),
  'age',
];

/** % of the capacity taken, or null without a count or a capacity. */
export function occupancy(reading) {
  if (reading.people === null || reading.people === undefined || !reading.capacity) {
    return null;
  }
  return Math.min(100, Math.max(0, Math.round((reading.people / reading.capacity) * 100)));
}

/** "07:00", from minutes since midnight. */
export const clock = (minutes) =>
  `${String(Math.floor(minutes / 60) % 24).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** "07:00–14:30, 16:00–20:00", or null without hours. */
export const hoursText = (schedule) =>
  schedule?.length
    ? schedule.map(({ from, to }) => `${clock(from)}–${clock(to)}`).join(', ')
    : null;

/** The crowd text of a reading: the operator's level, "closed" or "no count". */
export function crowdText(reading, language) {
  if (reading.open === 0) {
    return say(TEXT, language, 'closed');
  }
  if (reading.level) {
    return say(TEXT, language, `level_${reading.level}`);
  }
  return say(TEXT, language, 'noCount');
}

/**
 * The device of a pool.
 * @param {object} gladys
 * @param {string} sourceKey
 * @param {object} source an entry of SOURCES
 * @param {object} reading
 * @param {string} language
 */
export function buildPoolDevice(gladys, sourceKey, source, reading, language) {
  const ids = gladys.externalIds(POOL_TYPE, poolPlatformId(sourceKey, reading.id));
  const names = NAMES[language] ?? NAMES.en;
  const max = countMax(reading.capacity);
  const definitions = {
    open: { category: C.INPUT, type: T.SENSOR.BINARY, min: 0, max: 1 },
    people: { category: C.COUNTER_SENSOR, type: T.SENSOR.INTEGER, min: 0, max },
    capacity: { category: C.COUNTER_SENSOR, type: T.SENSOR.INTEGER, min: 0, max },
    occupancy: {
      category: C.LEVEL_SENSOR,
      type: T.LEVEL_SENSOR.LIQUID_LEVEL_PERCENT,
      unit: U.PERCENT,
      min: 0,
      max: 100,
    },
    crowd: { category: C.TEXT, type: T.TEXT.TEXT, min: 0, max: 0 },
    hours: { category: C.TEXT, type: T.TEXT.TEXT, min: 0, max: 0 },
    age: {
      category: C.DURATION,
      type: T.DURATION.INTEGER,
      unit: U.MINUTES,
      min: 0,
      max: MAX_AGE_MINUTES,
    },
  };
  return {
    name: clip(`${source.name} · ${prettyName(reading.name)}`, MAX_DEVICE_NAME),
    external_id: ids.device,
    should_poll: false,
    params: [
      { name: 'source', value: sourceKey },
      { name: 'pool_id', value: reading.id },
    ],
    features: featureKeys(source).map((key) => ({
      name: names[key],
      external_id: ids.feature(key),
      ...definitions[key],
      read_only: true,
      has_feedback: false,
    })),
  };
}

/**
 * The states of a pool device. A value the portal does not give (no count
 * while closed, no capacity) is not published: the crowd text says why.
 * @param {number} ageMinutes
 * @param {string} language
 */
export function poolStates(gladys, sourceKey, source, reading, ageMinutes, language) {
  const ids = gladys.externalIds(POOL_TYPE, poolPlatformId(sourceKey, reading.id));
  const values = {
    open: reading.open,
    people: reading.people,
    capacity: reading.capacity,
    occupancy: occupancy(reading),
    crowd: crowdText(reading, language),
    hours: hoursText(reading.schedule) ?? say(TEXT, language, 'noHours'),
    age: Math.min(MAX_AGE_MINUTES, Math.max(0, Math.floor(ageMinutes))),
  };
  return featureKeys(source)
    .filter((key) => values[key] !== null && values[key] !== undefined)
    .map((key) =>
      TEXT_FEATURES.has(key)
        ? { device_feature_external_id: ids.feature(key), text: values[key] }
        : { device_feature_external_id: ids.feature(key), state: values[key] },
    );
}
