// -----------------------------------------------------------------------------
// The labels of the widget rows: shortened for a narrow column, never two the
// same, never a name the user gave in Gladys.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { rowLabels, withoutKind } from '../src/widgets.js';

/** A row whose name is the one the integration gave. */
const ours = (city, poolName, kind = 'pool') => ({
  name: `${city} · ${poolName}`,
  city,
  kind,
  poolName,
});

test('the kind word and its article go, the place stays readable', () => {
  assert.equal(withoutKind('Piscine de Hautepierre', 'pool'), 'Hautepierre');
  assert.equal(withoutKind('Piscine de la Robertsau', 'pool'), 'Robertsau');
  assert.equal(withoutKind("Piscine d'Ostwald", 'pool'), 'Ostwald');
  assert.equal(withoutKind('Piscine du Wacken', 'pool'), 'Wacken');
  assert.equal(withoutKind('Centre nautique de Schiltigheim', 'pool'), 'Schiltigheim');
  assert.equal(withoutKind('Piscine Judaique - Jean Boiteux', 'pool'), 'Judaique - Jean Boiteux');
  assert.equal(withoutKind("Patinoire l'Iceberg", 'rink'), 'Iceberg');
  assert.equal(withoutKind("Patinoire l'Iceberg", 'pool'), null);
  assert.equal(withoutKind('Aquapolis', 'pool'), null);
});

test('one city: the prefix goes; one facility keeps its kind word', () => {
  assert.deepEqual(rowLabels([ours('Strasbourg', "Patinoire l'Iceberg", 'rink')]), [
    "Patinoire l'Iceberg",
  ]);
});

test('several pools of one city stay distinct', () => {
  assert.deepEqual(
    rowLabels([
      ours('Strasbourg', 'Piscine de Hautepierre'),
      ours('Strasbourg', 'Piscine du Wacken'),
      ours('Strasbourg', 'Centre nautique de Schiltigheim'),
    ]),
    ['Hautepierre', 'Wacken', 'Schiltigheim'],
  );
  // Two names that would read the same once shortened keep their kind word.
  assert.deepEqual(
    rowLabels([
      ours('Strasbourg', 'Piscine de la Hardt'),
      ours('Strasbourg', 'Centre nautique de la Hardt'),
      ours('Strasbourg', 'Piscine du Wacken'),
    ]),
    ['Piscine de la Hardt', 'Centre nautique de la Hardt', 'Wacken'],
  );
});

test('several cities keep their prefix', () => {
  assert.deepEqual(
    rowLabels([ours('Strasbourg', 'Piscine du Wacken'), ours('Bordeaux', 'Piscine Galin')]),
    ['Strasbourg · Piscine du Wacken', 'Bordeaux · Piscine Galin'],
  );
});

test('a name given in Gladys is kept, and a short label never copies it', () => {
  const renamed = { name: 'Wacken', city: 'Strasbourg', kind: 'pool', poolName: 'Piscine Galin' };
  assert.deepEqual(rowLabels([renamed, ours('Strasbourg', 'Piscine du Wacken')]), [
    'Wacken',
    'Piscine du Wacken',
  ]);
  const custom = {
    name: 'Strasbourg · Ma piscine',
    city: 'Strasbourg',
    kind: 'pool',
    poolName: 'Piscine de la Hardt',
  };
  assert.deepEqual(rowLabels([custom, ours('Strasbourg', 'Piscine de Hautepierre')]), [
    'Strasbourg · Ma piscine',
    'Hautepierre',
  ]);
});

test('a pool not read yet keeps its full name', () => {
  const unread = {
    name: 'Strasbourg · Piscine du Wacken',
    city: 'Strasbourg',
    kind: 'pool',
    poolName: null,
  };
  assert.deepEqual(rowLabels([unread, ours('Strasbourg', 'Piscine de Hautepierre')]), [
    'Strasbourg · Piscine du Wacken',
    'Hautepierre',
  ]);
});
