// -----------------------------------------------------------------------------
// The adapters against the real answers of the portals (2026-10-29, at night:
// every Strasbourg pool closed, every Bordeaux count at 0), and the Paris
// wall-clock times of Strasbourg across a change of time.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  SOURCES,
  bordeauxReadings,
  int,
  parisMinutes,
  parisTime,
  strasbourgSchedule,
} from '../src/sources.js';
import { createFetch, fixtureJson } from './helpers/world.js';

const read = async (key, overrides) => {
  const network = createFetch(overrides);
  const readings = await SOURCES[key].read(network.fetch);
  return { readings, network, byName: (part) => readings.find((r) => r.name.includes(part)) };
};

test('Strasbourg: the eight pools, closed at night, without any count', async () => {
  const { readings, byName, network } = await read('strasbourg');
  assert.equal(readings.length, 8);
  assert.equal(network.calls.length, 1);
  for (const reading of readings) {
    assert.equal(reading.open, 0, reading.name);
    assert.equal(reading.people, null, `${reading.name}: no invented count`);
    assert.equal(reading.level, null);
    assert.equal(reading.capacity, null);
  }
  const wacken = byName('Wacken');
  assert.equal(wacken.id, '408_SPO_9');
  assert.deepEqual(wacken.schedule, [
    { from: 7 * 60, to: 14 * 60 + 30 },
    { from: 16 * 60, to: 20 * 60 },
  ]);
  // "2026-10-29 01:28:22" in Paris (winter time) = 00:28:22 UTC.
  assert.equal(wacken.updatedAt, Date.UTC(2026, 9, 29, 0, 28, 22));
  assert.equal(byName('Lingolsheim').schedule.length, 3);
  assert.equal(byName('Hardt').schedule, null);
});

test('Strasbourg: an open pool gives its count and the operator level', async () => {
  const document = fixtureJson('strasbourg.json');
  Object.assign(document.results[7], { isopen: 1, occupation: 85, realtimestatus: 'Orange' });
  const url = Object.keys(createFetch().routes).find((u) => u.includes('strasbourg'));
  const { byName } = await read('strasbourg', { [url]: document });
  const wacken = byName('Wacken');
  assert.equal(wacken.open, 1);
  assert.equal(wacken.people, 85);
  assert.equal(wacken.level, 'medium');
});

test('Bordeaux: zones added up per pool, stands left out', async () => {
  const { readings, byName } = await read('bordeaux');
  assert.deepEqual(readings.map((r) => r.name).sort(), [
    'Piscine Galin',
    'Piscine Grand Parc',
    'Piscine Jean ZAY',
    'Piscine Judaique - Jean Boiteux',
    'Piscine Tissot',
  ]);
  // Judaïque: zones "Est" and "Ouest", 500 people each.
  assert.equal(byName('Judaique').capacity, 1000);
  // Galin: "Zone Bassins" (400) without the "Zone Gradins" (85).
  assert.equal(byName('Galin').capacity, 400);
  assert.equal(byName('Galin').people, 0);
  assert.equal(byName('Galin').open, null, 'Bordeaux does not say whether a pool is open');
  assert.equal(byName('Tissot').updatedAt, Date.UTC(2026, 9, 29, 0, 35, 0));
});

test('Bordeaux: a negative zone count counts 0, a missing one makes the pool unknown', () => {
  const [pool] = bordeauxReadings([
    { etablissement_etalib: 'P', fmizonlib: 'A', fmicourante: -3, fmizonmax: 100 },
    { etablissement_etalib: 'P', fmizonlib: 'B', fmicourante: 12, fmizonmax: 50 },
  ]);
  assert.equal(pool.people, 12);
  assert.equal(pool.capacity, 150);
  const [partial] = bordeauxReadings([
    { etablissement_etalib: 'P', fmizonlib: 'A', fmicourante: 5, fmizonmax: 100 },
    { etablissement_etalib: 'P', fmizonlib: 'B', fmicourante: null, fmizonmax: 100 },
  ]);
  assert.equal(partial.people, null, 'no partial sum');
  const [empty] = bordeauxReadings([{ etablissement_etalib: 'Q', fmicourante: null }]);
  assert.equal(empty.people, null);
});

test('a portal error is an error, never an empty list', async () => {
  const url = Object.keys(createFetch().routes).find((u) => u.includes('bordeaux'));
  await assert.rejects(read('bordeaux', { [url]: 503 }), /HTTP 503/);
  await assert.rejects(read('bordeaux', { [url]: new TypeError('fetch failed') }), /fetch failed/);
});

test('Paris wall-clock times, in winter and in summer', () => {
  assert.equal(parisTime('2026-07-14 12:00:00'), Date.UTC(2026, 6, 14, 10, 0, 0));
  assert.equal(parisTime('2026-12-01 08:30'), Date.UTC(2026, 11, 1, 7, 30, 0));
  assert.equal(parisTime('not a date'), null);
  assert.equal(parisTime(null), null);
  assert.equal(parisMinutes(Date.UTC(2026, 6, 14, 10, 0, 0)), 12 * 60);
  assert.equal(parisMinutes(Date.UTC(2026, 9, 29, 23, 30, 0)), 30);
});

test('schedules: invalid slots dropped, sorted, null when empty', () => {
  assert.equal(strasbourgSchedule(null), null);
  assert.equal(strasbourgSchedule('not json'), null);
  assert.equal(strasbourgSchedule('[]'), null);
  assert.deepEqual(
    strasbourgSchedule([
      { openingHour: 14, openingMinute: 0, closingHour: 19, closingMinute: 0 },
      { openingHour: 8, openingMinute: 30, closingHour: 12, closingMinute: 0 },
      { openingHour: 20, closingHour: 18 },
    ]),
    [
      { from: 510, to: 720 },
      { from: 840, to: 1140 },
    ],
  );
  assert.equal(int('12.6'), 13);
  assert.equal(int(''), null);
});

test('Strasbourg ice rink: the Iceberg, same format as the pools, closed at night', async () => {
  const { readings, network } = await read('strasbourg_rink');
  assert.equal(network.calls.length, 1);
  assert.match(network.calls[0].url, /frequentation-en-temps-reel-patinoire-iceberg/);
  assert.deepEqual(readings, [
    {
      id: '849_SPO_16',
      name: "Patinoire l'Iceberg",
      open: 0,
      people: null,
      capacity: null,
      level: null,
      schedule: [{ from: 14 * 60, to: 18 * 60 + 30 }],
      updatedAt: Date.UTC(2026, 9, 29, 20, 18, 22),
    },
  ]);
  assert.equal(SOURCES.strasbourg_rink.kind, 'rink');
});
