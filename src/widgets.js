// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+).
//
// - pools: the watched pools, one status row each ("Piscine du Wacken" /
//   "85 pers. · fluide · jusqu'à 20:00"), colored by the operator's crowd
//   level (Strasbourg) or the share of the capacity taken (Bordeaux: orange
//   from 70 %, red from 90 %); grey when closed, without a count or out of
//   date. The hours can be hidden.
//
// Budget of the core: 8 components, 2 texts, 1 status (10 rows).
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { clip, occupancy, prettyName } from './devices.js';
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
  return {
    ttl_seconds: ttl,
    components: [
      {
        type: 'status',
        items: entries.slice(0, MAX_ROWS).map((entry) => {
          const found = service.lookup(entry.deviceId);
          const reading = found?.reading ?? null;
          return {
            // The name given in Gladys, not the portal's.
            label: clip(entry.name || prettyName(reading?.name), MAX_LABEL),
            value: clip(service.shortText(found?.city, reading, language, { hours }), 40),
            color: poolColor(service, found?.city, reading),
          };
        }),
      },
    ],
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: { get: poolsContent },
};
