// -----------------------------------------------------------------------------
// The integration end to end against the SDK's fake Gladys and the real
// answers of the portals: discovery, states, triggers, widget, scene action,
// status, the integration's own timer.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../src/app.js';
import { STALE_MS } from '../src/service.js';
import {
  action,
  countBordeaux,
  create,
  createFetch,
  createWorld,
  cycle,
  featureId,
  openStrasbourg,
  parisStamp,
  setRecords,
  urlOf,
} from './helpers/world.js';

const WACKEN = '408_SPO_9';
// 2026-10-29 15:00 in Paris: the Wacken is open 16:00–20:00 that day.
const AFTERNOON = Date.UTC(2026, 9, 29, 14, 0, 0);

test('every pool of the ticked cities is offered, none created yet', async (t) => {
  const world = await createWorld({ config: { cities: ['bordeaux'] } });
  t.after(() => world.app.stop());
  assert.equal(world.fake.discoveredDevices.length, 5);
  assert.equal(world.fake.discoveredDevices[0].should_poll, false);
  assert.equal(world.fake.states.length, 0);
});

test('a closed Strasbourg pool: closed, no count invented, hours of the day', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, 'Wacken');
  assert.equal(device.name, 'Strasbourg · Piscine du Wacken');
  const last = (key) => world.fake.lastState(featureId(device, key));
  assert.equal(last('open'), 0);
  assert.equal(last('people'), undefined, 'no count while closed');
  assert.equal(last('crowd'), 'fermée');
  assert.equal(last('hours'), '07:00–14:30, 16:00–20:00');
  assert.equal(last('age'), 16);
  assert.deepEqual(world.fake.widgetRefreshes, ['pools']);
  const hardt = await create(world, 'Hardt');
  assert.equal(world.fake.lastState(featureId(hardt, 'hours')), 'horaires non publiés');
});

test('a Bordeaux pool: count, capacity and occupancy', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, 'Galin');
  const last = (key) => world.fake.lastState(featureId(device, key));
  assert.equal(last('people'), 0);
  assert.equal(last('capacity'), 400);
  assert.equal(last('occupancy'), 0);
  assert.equal(featureId(device, 'open'), undefined, 'Bordeaux does not publish the state');
  countBordeaux(world, 'Piscine Galin', 120);
  await cycle(world);
  assert.equal(last('people'), 120);
  assert.equal(last('occupancy'), 30);
  countBordeaux(world, 'Piscine Galin', 40);
  await cycle(world);
  // Bordeaux has no open state: the drop to 0 at closing is not a quiet moment.
  countBordeaux(world, 'Piscine Galin', 0);
  await cycle(world);
  assert.deepEqual(
    world.fake.sceneEvents.map((e) => [e.key, e.data.threshold]),
    [
      ['crowd_above', '20'],
      ['crowd_above', '50'],
      ['crowd_above', '100'],
      ['crowd_below', '50'],
      ['crowd_below', '100'],
    ],
  );
});

test('triggers: opens, crowd above then below a threshold, closes', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, 'Wacken');
  world.clock.time = AFTERNOON;
  openStrasbourg(world, WACKEN, 30);
  await cycle(world, 300);
  // Read 13 h after the capture: no comparison with that old reading.
  assert.deepEqual(world.fake.sceneEvents, []);
  openStrasbourg(world, WACKEN, 0);
  await cycle(world, 300);
  openStrasbourg(world, WACKEN, 0);
  setClosed(world);
  await cycle(world, 300);
  openStrasbourg(world, WACKEN, 60, 'ORANGE');
  await cycle(world, 300);
  openStrasbourg(world, WACKEN, 40);
  await cycle(world, 300);
  const events = world.fake.sceneEvents.map((e) => [e.key, e.data.threshold ?? null]);
  assert.deepEqual(events, [
    ['crowd_below', '20'],
    ['closed', null],
    ['opened', null],
    ['crowd_above', '20'],
    ['crowd_above', '50'],
    ['crowd_below', '50'],
  ]);
  const opened = world.fake.sceneEvents.find((e) => e.key === 'opened');
  assert.equal(opened.data.pool, device.external_id);
  assert.equal(opened.data.pool_name, 'Piscine du Wacken');
  assert.equal(opened.data.city, 'Strasbourg');
  assert.equal(world.fake.lastState(featureId(device, 'crowd')), 'fluide');
  assert.equal(world.fake.lastState(featureId(device, 'people')), 40);
});

function setClosed(world) {
  const url = urlOf('strasbourg.json');
  const document = structuredClone(world.network.routes[url]);
  Object.assign(
    document.results.find((r) => r.sigid === WACKEN),
    { isopen: 0, occupation: null, realtimestatus: 'CLOSED' },
  );
  world.network.routes[url] = document;
}

test('a pool not added fires nothing, an out of date count neither', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  world.clock.time = AFTERNOON;
  openStrasbourg(world, WACKEN, 10);
  await cycle(world, 300);
  openStrasbourg(world, WACKEN, 300);
  await cycle(world, 300);
  assert.deepEqual(world.fake.sceneEvents, []);
  await create(world, 'Wacken');
  // The portal stops updating: the count gets older than STALE_MS.
  world.clock.advance(STALE_MS);
  await cycle(world, 300);
  assert.deepEqual(world.fake.sceneEvents, []);
});

test('the widget: name given in Gladys, crowd, hours, colors; hours can be hidden', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const wacken = await create(world, 'Wacken');
  await create(world, 'Galin');
  await world.fake.deviceUpdated({ ...wacken, name: 'Ma piscine' });
  world.clock.time = AFTERNOON + 3600 * 1000; // 16:00, just open
  openStrasbourg(world, WACKEN, 85, 'ORANGE');
  countBordeaux(world, 'Piscine Galin', 380);
  await cycle(world, 1);
  const ack = await world.fake.widgetGet('pools', { language: 'fr' });
  assert.equal(ack.success, true);
  const content = ack.data.content;
  assert.deepEqual(validateWidgetContent(content), []);
  // Gladys lists the device updated last.
  assert.deepEqual(content.components[0].items, [
    { label: 'Bordeaux · Piscine Galin', value: '380 / 400 pers.', color: 'danger' },
    { label: 'Ma piscine', value: "85 pers. · chargée · jusqu'à 20:00", color: 'warning' },
  ]);
  const hidden = await world.fake.widgetGet('pools', {
    language: 'en',
    settings: { show_hours: false, pools: [wacken.external_id] },
  });
  assert.deepEqual(hidden.data.content.components[0].items, [
    { label: 'Ma piscine', value: '85 people · moderate', color: 'warning' },
  ]);
});

test('the widget at night: closed pools in grey with their next opening', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, 'Wacken');
  const ack = await world.fake.widgetGet('pools', { language: 'fr' });
  assert.deepEqual(ack.data.content.components[0].items, [
    { label: 'Strasbourg · Piscine du Wacken', value: 'fermée · ouvre à 07:00', color: 'neutral' },
  ]);
  const empty = await createWorld();
  t.after(() => empty.app.stop());
  const none = await empty.fake.widgetGet('pools', { language: 'en' });
  assert.match(none.data.content.components[0].text, /Discover tab/);
});

test('the scene action: a sentence and numbers', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const empty = await world.fake.sceneAction('pools_summary', {});
  assert.equal(empty.success, false);
  const wacken = await create(world, 'Wacken');
  await create(world, 'Hautepierre');
  world.clock.time = AFTERNOON + 3600 * 1000;
  openStrasbourg(world, WACKEN, 85);
  await cycle(world, 1);
  const ack = await world.fake.sceneAction('pools_summary', {});
  assert.equal(ack.success, true);
  assert.deepEqual(ack.data.outputs, {
    sentence:
      "Piscine du Wacken : 85 personnes (fluide), ouverte jusqu'à 20:00. Piscine de Hautepierre : fermée.",
    open_count: 1,
    people: 85,
  });
  const one = await world.fake.sceneAction('pools_summary', { pools: [wacken.external_id] });
  assert.equal(one.data.outputs.open_count, 1);
  const gone = await world.fake.sceneAction('pools_summary', { pools: ['nope'] });
  assert.equal(gone.success, false);
});

test('the status action: cities, readings, errors, pools added', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  await create(world, 'Galin');
  world.network.routes[urlOf('bordeaux.json')] = 503;
  await cycle(world);
  const message = await action(world, 'status');
  assert.match(message.fr, /■ Strasbourg : 8 piscines/);
  assert.match(message.fr, /■ Bordeaux : 5 piscines/);
  assert.match(message.fr, /Dernière erreur : opendata\.bordeaux-metropole\.fr: HTTP 503/);
  assert.match(message.fr, /1 équipement ajouté à Gladys\./);
  assert.match(message.de, /Schwimmbäder/);
});

test('a city unticked stays read while one of its pools is added', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, 'Galin');
  await world.fake.configUpdated({ cities: [] });
  countBordeaux(world, 'Piscine Galin', 7);
  await cycle(world);
  assert.equal(world.fake.lastState(featureId(device, 'people')), 7);
  assert.equal(world.fake.discoveredDevices.length, 0);
});

test('a new language republishes the texts', async (t) => {
  const world = await createWorld();
  t.after(() => world.app.stop());
  const device = await create(world, 'Wacken');
  await world.fake.configUpdated({ cities: ['strasbourg'], language: 'de' });
  assert.equal(world.fake.lastState(featureId(device, 'crowd')), 'geschlossen');
});

test('the integration reads on its own timer, without any poll from Gladys', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const network = createFetch();
  const gladys = createFakeGladys({ config: { cities: ['bordeaux'], refresh_interval: '180' } });
  const app = registerHandlers(gladys, { fetch: network.fetch });
  t.after(() => app.stop());
  await gladys.connect();
  await app.ready;
  await app.service.loading;
  const reads = () => network.calls.length;
  assert.equal(reads(), 1);
  t.mock.timers.tick(180 * 1000);
  await app.service.refreshing;
  assert.equal(reads(), 2);
  t.mock.timers.tick(180 * 1000);
  await app.service.refreshing;
  assert.equal(reads(), 3);
});

test('the Iceberg ice rink: its own choice, the same features, triggers and status', async (t) => {
  const world = await createWorld({ config: { cities: ['strasbourg_rink'] } });
  t.after(() => world.app.stop());
  assert.deepEqual(
    world.fake.discoveredDevices.map((d) => d.name),
    ["Strasbourg · Patinoire l'Iceberg"],
  );
  const device = await create(world, 'Iceberg');
  assert.match(device.external_id, /:pool:strasbourg_rink-849_SPO_16$/);
  assert.deepEqual(
    device.features.map((f) => f.external_id.split(':').pop()),
    ['open', 'people', 'crowd', 'hours', 'age'],
  );
  const last = (key) => world.fake.lastState(featureId(device, key));
  assert.equal(last('open'), 0);
  assert.equal(last('people'), undefined, 'no count while closed');
  assert.equal(last('crowd'), 'fermée');
  assert.equal(last('hours'), '14:00–18:30');

  // 15:00 in Paris: open, then busier.
  world.clock.time = AFTERNOON;
  const openRink = (people) =>
    setRecords(world, 'strasbourg_rink.json', () => true, {
      isopen: 1,
      occupation: people,
      realtimestatus: 'GREEN',
      updatedate: parisStamp(world.clock.now()),
    });
  openRink(10);
  await cycle(world, 300);
  openRink(70);
  await cycle(world, 300);
  assert.equal(last('people'), 70);
  const events = world.fake.sceneEvents.map((e) => [e.key, e.data.threshold ?? null]);
  assert.deepEqual(events, [
    ['crowd_above', '20'],
    ['crowd_above', '50'],
  ]);
  assert.equal(world.fake.sceneEvents[0].data.pool_name, "Patinoire l'Iceberg");

  const message = await action(world, 'status');
  assert.match(message.fr, /■ Strasbourg : 1 patinoire\n/);
  assert.match(message.en, /■ Strasbourg: 1 ice rink\n/);
  assert.match(message.de, /1 Eisbahn/);
  assert.match(message.es, /1 pista de hielo/);

  const ack = await world.fake.widgetGet('pools', { language: 'fr' });
  assert.deepEqual(validateWidgetContent(ack.data.content), []);
  assert.deepEqual(ack.data.content.components[0].items, [
    {
      label: "Strasbourg · Patinoire l'Iceberg",
      value: "70 pers. · fluide · jusqu'à 18:30",
      color: 'success',
    },
  ]);
});
