// -----------------------------------------------------------------------------
// Texts sent from the container (feature names, action messages, widget
// contents, scene outputs), in the four languages of the Gladys interface.
// Entries are strings or functions of one parameter object. German says "du",
// Spanish "usted". Brand and place names never translate.
// -----------------------------------------------------------------------------

export const INIT_FAILED = {
  en: 'Initialization failed, check the integration logs.',
  fr: "L'initialisation a échoué, consultez les logs de l'intégration.",
  de: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
  es: 'La inicialización ha fallado, consulte los registros de la integración.',
};

// Feature names, frozen when the device is created (configured language).
export const NAMES = {
  en: {
    open: 'Open',
    people: 'People inside',
    capacity: 'Capacity',
    occupancy: 'Occupancy',
    crowd: 'Crowd',
    hours: "Today's hours",
    age: 'Data age',
  },
  fr: {
    open: 'Ouverte',
    people: 'Personnes présentes',
    capacity: 'Capacité',
    occupancy: "Taux d'occupation",
    crowd: 'Affluence',
    hours: 'Horaires du jour',
    age: 'Âge de la donnée',
  },
  de: {
    open: 'Geöffnet',
    people: 'Anwesende Personen',
    capacity: 'Kapazität',
    occupancy: 'Auslastung',
    crowd: 'Andrang',
    hours: 'Heutige Öffnungszeiten',
    age: 'Alter der Daten',
  },
  es: {
    open: 'Abierta',
    people: 'Personas presentes',
    capacity: 'Capacidad',
    occupancy: 'Ocupación',
    crowd: 'Afluencia',
    hours: 'Horario de hoy',
    age: 'Antigüedad del dato',
  },
};

const plural = (count, one, many) => (count === 1 ? one : many);
const pluralFr = (count, one, many) => (count > 1 ? many : one);

// Crowd texts, widget contents and scene outputs.
export const TEXT = {
  en: {
    closed: 'closed',
    noCount: 'no count published',
    noHours: 'no hours published',
    level_low: 'quiet',
    level_medium: 'moderate',
    level_high: 'busy',
    level_full: 'full',
    stale: 'data out of date',
    people: ({ people, capacity }) =>
      capacity
        ? `${people} / ${capacity} people`
        : `${people} ${plural(people, 'person', 'people')}`,
    until: ({ time }) => `until ${time}`,
    opensAt: ({ time }) => `opens at ${time}`,
    sentenceClosed: ({ name }) => `${name}: closed.`,
    sentenceNoCount: ({ name }) => `${name}: no count right now.`,
    sentence: ({ name, people, capacity, crowd, until }) =>
      `${name}: ${people} ${plural(people, 'person', 'people')}${capacity ? ` out of ${capacity}` : ''}${crowd ? ` (${crowd})` : ''}${until ? `, open until ${until}` : ''}.`,
    pickPool: 'Add a pool in the Discover tab of the integration, then pick it here.',
    gone: 'This pool is no longer watched.',
    noPool: 'No pool is watched: add one in the Discover tab of the integration.',
  },
  fr: {
    closed: 'fermée',
    noCount: 'pas de comptage publié',
    noHours: 'horaires non publiés',
    level_low: 'fluide',
    level_medium: 'chargée',
    level_high: 'très chargée',
    level_full: 'saturée',
    stale: 'donnée périmée',
    people: ({ people, capacity }) =>
      capacity ? `${people} / ${capacity} pers.` : `${people} pers.`,
    until: ({ time }) => `jusqu'à ${time}`,
    opensAt: ({ time }) => `ouvre à ${time}`,
    sentenceClosed: ({ name }) => `${name} : fermée.`,
    sentenceNoCount: ({ name }) => `${name} : pas de comptage en ce moment.`,
    sentence: ({ name, people, capacity, crowd, until }) =>
      `${name} : ${people} ${pluralFr(people, 'personne', 'personnes')}${capacity ? ` sur ${capacity}` : ''}${crowd ? ` (${crowd})` : ''}${until ? `, ouverte jusqu'à ${until}` : ''}.`,
    pickPool:
      "Ajoutez une piscine dans l'onglet Découverte de l'intégration, puis choisissez-la ici.",
    gone: "Cette piscine n'est plus suivie.",
    noPool:
      "Aucune piscine n'est suivie : ajoutez-en une dans l'onglet Découverte de l'intégration.",
  },
  de: {
    closed: 'geschlossen',
    noCount: 'keine Zählung veröffentlicht',
    noHours: 'keine Öffnungszeiten veröffentlicht',
    level_low: 'ruhig',
    level_medium: 'mäßig voll',
    level_high: 'voll',
    level_full: 'überfüllt',
    stale: 'Daten veraltet',
    people: ({ people, capacity }) =>
      capacity ? `${people} / ${capacity} Pers.` : `${people} ${plural(people, 'Person', 'Pers.')}`,
    until: ({ time }) => `bis ${time}`,
    opensAt: ({ time }) => `öffnet um ${time}`,
    sentenceClosed: ({ name }) => `${name}: geschlossen.`,
    sentenceNoCount: ({ name }) => `${name}: gerade keine Zählung.`,
    sentence: ({ name, people, capacity, crowd, until }) =>
      `${name}: ${people} ${plural(people, 'Person', 'Personen')}${capacity ? ` von ${capacity}` : ''}${crowd ? ` (${crowd})` : ''}${until ? `, geöffnet bis ${until}` : ''}.`,
    pickPool: 'Füge ein Schwimmbad im Tab „Entdecken“ der Integration hinzu und wähle es hier.',
    gone: 'Dieses Schwimmbad wird nicht mehr überwacht.',
    noPool: 'Kein Schwimmbad wird überwacht: füge eines im Tab „Entdecken“ der Integration hinzu.',
  },
  es: {
    closed: 'cerrada',
    noCount: 'sin recuento publicado',
    noHours: 'horario no publicado',
    level_low: 'tranquila',
    level_medium: 'concurrida',
    level_high: 'muy concurrida',
    level_full: 'completa',
    stale: 'dato caducado',
    people: ({ people, capacity }) =>
      capacity
        ? `${people} / ${capacity} pers.`
        : `${people} ${plural(people, 'persona', 'pers.')}`,
    until: ({ time }) => `hasta ${time}`,
    opensAt: ({ time }) => `abre a las ${time}`,
    sentenceClosed: ({ name }) => `${name}: cerrada.`,
    sentenceNoCount: ({ name }) => `${name}: sin recuento en este momento.`,
    sentence: ({ name, people, capacity, crowd, until }) =>
      `${name}: ${people} ${plural(people, 'persona', 'personas')}${capacity ? ` de ${capacity}` : ''}${crowd ? ` (${crowd})` : ''}${until ? `, abierta hasta las ${until}` : ''}.`,
    pickPool: 'Añada una piscina en la pestaña Descubrir de la integración y luego elíjala aquí.',
    gone: 'Esta piscina ya no está vigilada.',
    noPool: 'No se vigila ninguna piscina: añada una en la pestaña Descubrir de la integración.',
  },
};

// Answer of the "Status" configuration action.
export const REPORTS = {
  en: {
    noCity: 'No city chosen: tick one or more cities above, then save.',
    city: ({ name, count }) => `■ ${name}: ${count} pool${count === 1 ? '' : 's'}`,
    read: ({ age }) => `Last reading ${age} s ago.`,
    waiting: 'Not read yet.',
    error: ({ error }) => `Last error: ${error}`,
    watched: ({ count }) => `${count} pool${count === 1 ? '' : 's'} added to Gladys.`,
  },
  fr: {
    noCity: 'Aucune ville choisie : cochez une ou plusieurs villes ci-dessus, puis enregistrez.',
    city: ({ name, count }) => `■ ${name} : ${count} piscine${count > 1 ? 's' : ''}`,
    read: ({ age }) => `Dernière lecture il y a ${age} s.`,
    waiting: 'Pas encore lu.',
    error: ({ error }) => `Dernière erreur : ${error}`,
    watched: ({ count }) =>
      `${count} piscine${count > 1 ? 's' : ''} ajoutée${count > 1 ? 's' : ''} à Gladys.`,
  },
  de: {
    noCity: 'Keine Stadt gewählt: kreuze oben eine oder mehrere Städte an und speichere.',
    city: ({ name, count }) => `■ ${name}: ${count} ${count === 1 ? 'Schwimmbad' : 'Schwimmbäder'}`,
    read: ({ age }) => `Letzte Abfrage vor ${age} s.`,
    waiting: 'Noch nicht abgefragt.',
    error: ({ error }) => `Letzter Fehler: ${error}`,
    watched: ({ count }) =>
      `${count} ${count === 1 ? 'Schwimmbad' : 'Schwimmbäder'} zu Gladys hinzugefügt.`,
  },
  es: {
    noCity: 'Ninguna ciudad elegida: marque una o varias ciudades arriba y guarde.',
    city: ({ name, count }) => `■ ${name}: ${count} piscina${count === 1 ? '' : 's'}`,
    read: ({ age }) => `Última lectura hace ${age} s.`,
    waiting: 'Aún no leído.',
    error: ({ error }) => `Último error: ${error}`,
    watched: ({ count }) =>
      `${count} piscina${count === 1 ? '' : 's'} añadida${count === 1 ? '' : 's'} a Gladys.`,
  },
};

/** One text of a table, in a language (English when missing). */
export function say(table, language, key, params = {}) {
  const entry = table[language]?.[key] ?? table.en[key];
  return typeof entry === 'function' ? entry(params) : entry;
}

/** The same text in every language of the table: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    Object.keys(table).map((language) => [language, say(table, language, key, params)]),
  );
}

/** Joins rendered messages (or plain strings), language by language, one per line. */
export function lines(...messages) {
  const languages = Object.keys(messages.find((m) => typeof m === 'object' && m) ?? { en: '' });
  return Object.fromEntries(
    languages.map((language) => [
      language,
      messages
        .filter((message) => message !== null && message !== undefined)
        .map((message) => (typeof message === 'string' ? message : message[language]))
        .join('\n'),
    ]),
  );
}
