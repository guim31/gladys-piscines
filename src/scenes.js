// -----------------------------------------------------------------------------
// Scene actions (manifest `scene_actions`, Gladys 5.1+).
//
// - pools_summary: the watched pools (all of them, or the ones picked) as a
//   sentence ready for a message or a speaker ("Piscine du Wacken : 85
//   personnes (fluide), ouverte jusqu'à 20:00."), plus numbers for a
//   "Continue only if" step.
//
// A scene action does not receive the user's language: the sentence follows
// the `language` of the configuration. Outputs are numbers, never booleans:
// the core's "Continue only if" compares with ===.
// -----------------------------------------------------------------------------

import { TEXT, say } from './messages.js';

export class SceneError extends Error {}

const chosenIds = (value) =>
  (Array.isArray(value) ? value : value ? [value] : []).map(String).filter(Boolean);

export const SCENE_ACTIONS = {
  async pools_summary(service, { fields }) {
    const language = service.config.language;
    // Asked right at start: the first reading, not "no count".
    await service.firstReading();
    const watched = service.watched().map((entry) => entry.deviceId);
    if (watched.length === 0) {
      throw new SceneError(say(TEXT, language, 'noPool'));
    }
    const asked = chosenIds(fields?.pools);
    const chosen = asked.filter((id) => watched.includes(id));
    if (asked.length > 0 && chosen.length === 0) {
      throw new SceneError(say(TEXT, language, 'gone'));
    }
    const sentences = [];
    let open = 0;
    let people = 0;
    for (const deviceId of chosen.length > 0 ? chosen : watched) {
      const found = service.lookup(deviceId);
      if (!found?.reading) {
        continue;
      }
      const { city, reading } = found;
      sentences.push(service.sentence(city, reading, language));
      if (reading.open === 1) {
        open += 1;
      }
      if (reading.open !== 0 && reading.people !== null && !service.isStale(city, reading)) {
        people += reading.people;
      }
    }
    return { sentence: sentences.join(' '), open_count: open, people };
  },
};
