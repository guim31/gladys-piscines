// -----------------------------------------------------------------------------
// The open data sources: one adapter per city portal, each turning its own
// fields into the same reading of a swimming pool:
//
//   { id, name, open, people, capacity, level, schedule, updatedAt }
//
//   open       1 open, 0 closed, null when the portal does not say (the
//              source has no `open` feature then)
//   people     people inside the pool now, or null when the portal gives no
//              count (Strasbourg, pool closed): never invented
//   capacity   people allowed at once, or null
//   level      the operator's own crowd level ('low', 'medium', 'high',
//              'full'), or null
//   schedule   today's opening hours, `[{ from, to }]` in minutes since
//              local midnight (Paris), or null when the portal gives none
//   updatedAt  date of the count in ms, or null (the age is then the age of
//              the last successful read)
//
// Both sources were checked live on 2026-10-29 (test/fixtures/sources holds
// those answers). Keys are part of the device external ids: never rename one.
// -----------------------------------------------------------------------------

import { getJson } from './http.js';

const MAX_BODY_BYTES = 2e6;
// Opendatasoft caps `limit` at 100: a few pages at most.
const ODS_PAGE = 100;
const ODS_MAX_PAGES = 3;
export const PARIS = 'Europe/Paris';

/** A whole number (never negative), or null for a missing or non-numeric value. */
export function int(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.round(number)) : null;
}

/** A date in ms, or null. Accepts ISO strings with an offset. */
export function time(value) {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const ms = Date.parse(value);
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

/** The offset of Paris from UTC at an instant, in ms (+1 h in winter, +2 h in summer). */
export function parisOffsetMs(ms) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone: PARIS,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
      .formatToParts(new Date(ms))
      .map((part) => [part.type, part.value]),
  );
  const asUtc = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return asUtc - Math.floor(ms / 1000) * 1000;
}

/** "2026-10-29 01:28:22", a Paris wall-clock time without offset, in ms; or null. */
export function parisTime(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    String(value ?? '').trim(),
  );
  if (!match) {
    return null;
  }
  const [, y, mo, d, h, mi, s = '0'] = match;
  const wall = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  // The offset at the wall time read as UTC is right except within an hour
  // of a change of time: a second pass settles it.
  const first = wall - parisOffsetMs(wall);
  return wall - parisOffsetMs(first);
}

/** Minutes since midnight in Paris at an instant. */
export function parisMinutes(ms) {
  const local = ms + parisOffsetMs(ms);
  return Math.floor((((local / 60000) % 1440) + 1440) % 1440);
}

/** Every record of an Opendatasoft Explore v2.1 dataset, page after page. */
async function odsRecords(fetch, base, dataset) {
  const records = [];
  for (let page = 0; page < ODS_MAX_PAGES; page += 1) {
    const params = new URLSearchParams({
      limit: String(ODS_PAGE),
      offset: String(page * ODS_PAGE),
    });
    const url = `${base}/api/explore/v2.1/catalog/datasets/${dataset}/records?${params}`;
    const data = await getJson(fetch, url, { maxBytes: MAX_BODY_BYTES });
    const results = Array.isArray(data?.results) ? data.results : [];
    records.push(...results);
    if (results.length < ODS_PAGE || records.length >= Number(data?.total_count ?? 0)) {
      break;
    }
  }
  return records;
}

// Strasbourg's `realTimeStatus`: green, orange, red, black when open.
const STRASBOURG_LEVELS = { GREEN: 'low', ORANGE: 'medium', RED: 'high', BLACK: 'full' };

/** Strasbourg's `daySchedule`, a JSON list of hours and minutes, as `[{ from, to }]`. */
export function strasbourgSchedule(value) {
  let list = value;
  if (typeof value === 'string') {
    try {
      list = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(list)) {
    return null;
  }
  const slots = list
    .map((slot) => ({
      from: Number(slot?.openingHour) * 60 + Number(slot?.openingMinute ?? 0),
      to: Number(slot?.closingHour) * 60 + Number(slot?.closingMinute ?? 0),
    }))
    .filter(
      ({ from, to }) =>
        Number.isInteger(from) && Number.isInteger(to) && from >= 0 && to <= 1440 && from < to,
    )
    .sort((a, b) => a.from - b.from);
  return slots.length > 0 ? slots : null;
}

function strasbourgReading(record) {
  const open =
    record.isopen === 1 || record.isopen === '1'
      ? 1
      : record.isopen === 0 || record.isopen === '0'
        ? 0
        : null;
  return {
    id: String(record.sigid),
    name: String(record.name ?? record.sigid).trim() || String(record.sigid),
    open,
    // The portal leaves the count empty while the pool is closed.
    people: open === 0 ? null : int(record.occupation),
    capacity: null,
    level:
      open === 1
        ? (STRASBOURG_LEVELS[String(record.realtimestatus ?? '').toUpperCase()] ?? null)
        : null,
    schedule: strasbourgSchedule(record.dayschedule),
    updatedAt: parisTime(record.updatedate),
  };
}

// Bordeaux counts per zone. The stands (spectators of a competition) are not
// swimmers: they stay out of the pool's count and capacity.
const BORDEAUX_SKIPPED_ZONE = /gradin/i;

/** The pools of Bordeaux: the zones of an establishment added up. */
export function bordeauxReadings(records) {
  const pools = new Map();
  for (const record of records) {
    const name = String(record.etablissement_etalib ?? '').trim();
    if (!name || BORDEAUX_SKIPPED_ZONE.test(String(record.fmizonlib ?? ''))) {
      continue;
    }
    const pool = pools.get(name) ?? {
      id: name,
      name,
      open: null,
      people: null,
      capacity: null,
      level: null,
      schedule: null,
      updatedAt: null,
    };
    // A zone without a count makes the whole pool unknown: a partial sum
    // would be a fake drop of the crowd.
    const people = int(record.fmicourante);
    if (people === null) {
      pool.missing = true;
    } else {
      pool.people = (pool.people ?? 0) + people;
    }
    const capacity = int(record.fmizonmax);
    if (capacity) {
      pool.capacity = (pool.capacity ?? 0) + capacity;
    }
    const at = time(record.datemiseajour);
    if (at !== null && (pool.updatedAt === null || at > pool.updatedAt)) {
      pool.updatedAt = at;
    }
    pools.set(name, pool);
  }
  return [...pools.values()].map(({ missing, ...pool }) =>
    missing ? { ...pool, people: null } : pool,
  );
}

export const SOURCES = {
  strasbourg: {
    name: 'Strasbourg',
    hasOpen: true,
    hasLevel: true,
    hasSchedule: true,
    hasCapacity: false,
    async read(fetch) {
      const records = await odsRecords(
        fetch,
        'https://data.strasbourg.eu',
        'frequentation-en-temps-reel-des-piscines',
      );
      return records.filter((record) => record.sigid).map(strasbourgReading);
    },
  },
  bordeaux: {
    name: 'Bordeaux',
    hasOpen: false,
    hasLevel: false,
    hasSchedule: false,
    hasCapacity: true,
    async read(fetch) {
      const records = await odsRecords(
        fetch,
        'https://opendata.bordeaux-metropole.fr',
        'bor_frequentation_piscine_tr',
      );
      return bordeauxReadings(records);
    },
  },
};

export const SOURCE_KEYS = Object.keys(SOURCES);
