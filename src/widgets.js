// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+).
//
// - pools: the watched pools, one status row each ("Wacken" /
//   "85 · fluide · → 20:00"), colored by the operator's crowd level
//   (Strasbourg) or the share of the capacity taken (Bordeaux: orange from
//   70 %, red from 90 %); grey when closed, without a count or out of date.
//   The hours can be hidden.
//
// The card can be one column of four, or a phone: the labels drop what every
// row repeats (see rowLabels), the values are compact.
//
// Budget of the core: 8 components, 2 texts, 1 status (10 rows).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { MAX_DEVICE_NAME, clip, occupancy, prettyName } from './devices.js';
import { TEXT, say } from './messages.js';
import { WIDGET_KEY } from './service.js';

export const MAX_ROWS = 10;
const MAX_LABEL = 40;

const LEVEL_COLORS = {
  low: WIDGET_COLORS.SUCCESS,
  medium: WIDGET_COLORS.WARNING,
  high: WIDGET_COLORS.DANGER,
  full: WIDGET_COLORS.DANGER,
};

// The kind of facility a default name starts with, then its article:
// "Piscine de la Hardt" -> "Hardt", "Patinoire l'Iceberg" -> "Iceberg".
const KIND_WORDS = {
  pool: /^(?:piscine|centre\s+(?:nautique|aquatique)|stade\s+nautique)\s+/i,
  rink: /^patinoire\s+/i,
};
const ARTICLE = /^(?:de\s+la\s+|de\s+l['’]|du\s+|des\s+|de\s+|d['’]|l['’]|la\s+|le\s+)/i;

/** "Hardt" from "Piscine de la Hardt", or null when the name has no kind word to drop. */
export function withoutKind(name, kind) {
  const pattern = KIND_WORDS[kind];
  if (!pattern || !pattern.test(name)) {
    return null;
  }
  const rest = name.replace(pattern, '').replace(ARTICLE, '').trim();
  // "Piscine de" alone leaves an article, not a place.
  if (rest.length < 2 || /^(?:de|du|des|la|le|les)$/i.test(rest)) {
    return null;
  }
  return rest.charAt(0).toUpperCase() + rest.slice(1);
}

/**
 * The labels of the rows, as short as they can be while staying distinct.
 * Only the names the integration gave are shortened: a name changed in Gladys
 * is the user's and stays as is.
 *
 * 1. "Strasbourg · " goes when every row is of the same city;
 * 2. "Piscine de " goes too when every row is of the same kind (pools, or
 *    ice rinks) and there are several: the widget's title already says it.
 *
 * A row whose short label would equal another row's goes back one step, then
 * to its full name: two rows never read the same.
 * @param {{ name: string, city: string|null, kind: string|null, poolName: string|null }[]} rows
 *   `name` given in Gladys, `city` and `kind` of the source, `poolName` the
 *   portal's name (null while unread)
 * @returns {string[]}
 */
export function rowLabels(rows) {
  const sameCity = rows.every((row) => row.city && row.city === rows[0].city);
  const sameKind = rows.length > 1 && rows.every((row) => row.kind && row.kind === rows[0].kind);
  const steps = rows.map((row) => {
    const full = row.name || prettyName(row.poolName);
    const own = row.poolName === null ? null : prettyName(row.poolName);
    if (own === null || full !== clip(`${row.city} · ${own}`, MAX_DEVICE_NAME)) {
      return [full];
    }
    const shorter = [full];
    if (sameCity) {
      shorter.push(own);
      const bare = sameKind ? withoutKind(own, row.kind) : null;
      if (bare) {
        shorter.push(bare);
      }
    }
    return shorter;
  });
  const level = steps.map((options) => options.length - 1);
  const label = (index) => clip(steps[index][level[index]], MAX_LABEL).toLowerCase();
  // Each pass moves the clashing rows one step back: it ends at the full names.
  for (;;) {
    const clashing = level
      .map((_, index) => index)
      .filter(
        (index) =>
          level[index] > 0 && level.some((_, o) => o !== index && label(o) === label(index)),
      );
    if (clashing.length === 0) {
      break;
    }
    for (const index of clashing) {
      level[index] -= 1;
    }
  }
  return steps.map((options, index) => clip(options[level[index]], MAX_LABEL));
}

/** The color of a row, from the crowd. */
export function poolColor(service, city, reading) {
  if (!reading || reading.open === 0 || reading.people === null || service.isStale(city, reading)) {
    return WIDGET_COLORS.NEUTRAL;
  }
  if (reading.level) {
    return LEVEL_COLORS[reading.level];
  }
  const taken = occupancy(reading);
  if (taken === null) {
    return WIDGET_COLORS.INFO;
  }
  if (taken >= 90) {
    return WIDGET_COLORS.DANGER;
  }
  return taken >= 70 ? WIDGET_COLORS.WARNING : WIDGET_COLORS.SUCCESS;
}

async function poolsContent(service, { settings, language }) {
  await service.firstReading();
  const ttl = Math.max(60, service.config.refreshSeconds);
  const watched = service.watched();
  const chosen = Array.isArray(settings?.pools) ? settings.pools.map(String) : [];
  const hours = settings?.show_hours !== false;
  const entries =
    chosen.length > 0
      ? chosen.map((id) => watched.find((entry) => entry.deviceId === id)).filter(Boolean)
      : watched;
  if (entries.length === 0) {
    const key = chosen.length > 0 ? 'gone' : 'pickPool';
    return { ttl_seconds: ttl, components: [{ type: 'text', text: say(TEXT, language, key) }] };
  }
  const rows = entries.slice(0, MAX_ROWS).map((entry) => {
    const found = service.lookup(entry.deviceId);
    return { entry, city: found?.city ?? null, reading: found?.reading ?? null };
  });
  // The name given in Gladys, not the portal's, shortened when it is ours.
  const labels = rowLabels(
    rows.map(({ entry, city, reading }) => ({
      name: entry.name,
      city: city?.source.name ?? null,
      kind: city?.source.kind ?? null,
      poolName: reading?.name ?? null,
    })),
  );
  return {
    ttl_seconds: ttl,
    components: [
      {
        type: 'status',
        items: rows.map(({ city, reading }, index) => ({
          label: labels[index],
          value: clip(service.shortText(city, reading, language, { hours }), 40),
          color: poolColor(service, city, reading),
        })),
      },
    ],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get: poolsContent },
};
