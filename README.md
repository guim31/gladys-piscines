# Gladys Live swimming pools

External integration for [Gladys Assistant](https://gladysassistant.com): the
**crowd and opening of public swimming pools** in French cities, read live
from their open data portals: the pools of the **Eurométropole de
Strasbourg** and of the city of **Bordeaux**. **No account, no key.**

Unofficial: not affiliated with the cities, metropolises or pool operators.
Developed without the hardware: the two sources were checked live on
2026-10-29 (at night, every pool closed), not yet on many Gladys
installations: feedback welcome.

User documentation: [English](docs/en.md) · [français](docs/fr.md) ·
[Deutsch](docs/de.md) · [español](docs/es.md).

## What you get in Gladys

- One read-only device per pool you add, with what the city publishes: open
  or closed, people inside, capacity and occupancy, the operator's crowd
  level, today's hours, age of the data.
- A dashboard widget: one row per pool with the crowd and the closing time,
  colored by how busy it is.
- Scene triggers: the pool opens, the pool closes, the crowd rises above or
  drops below a threshold.
- A scene action: the state of your pools in a sentence ready to send.

## Requirements

- Gladys Assistant 5.3.0 or later, with Internet access.

## Installation

In Gladys, **Integrations → Install from GitHub**, then paste
`https://github.com/guim31/gladys-piscines`. Tick your cities in the
Configuration tab, save, and add your pools from the Discover tab.

## How it works

| City       | Portal                                        | Data                                                   |
| ---------- | --------------------------------------------- | ------------------------------------------------------ |
| Strasbourg | data.strasbourg.eu (Opendatasoft)             | open/closed, people inside, crowd level, today's hours |
| Bordeaux   | opendata.bordeaux-metropole.fr (Opendatasoft) | people inside and capacity per zone (stands left out)  |

One HTTPS request per city every 3, 5 or 10 minutes, on the integration's own
timer (the devices are not polled by Gladys). No value is invented: when a
city publishes no count (a closed pool, at night), the count is not updated
and the crowd text says why.

## Limitations

- Only Strasbourg and Bordeaux publish a live feed today; Nantes, Toulouse,
  Paris, Rennes and Montpellier publish static data only.
- Strasbourg gives no capacity (no occupancy); Bordeaux gives neither the
  open/closed state nor the hours (no open/close triggers there).
- Figures are the operators' entry/exit counts.

## Development

```bash
npm install
npm test               # node --test, no network access
npm run lint           # ESLint
npm run format:check   # Prettier, as the CI runs it
npx github:GladysAssistant/integration-store .   # store admission checks
```

See [CLAUDE.md](CLAUDE.md) for the architecture and the conventions. The test
fixtures (`test/fixtures/sources`) are the real answers of the two portals,
captured on 2026-10-29 at night; the daytime cases are derived from them in
the tests.

## Credits

- Data: Eurométropole de Strasbourg and Bordeaux Métropole, under the Licence
  Ouverte (Etalab).
- Structure shared with [gladys-parkings](https://github.com/guim31/gladys-parkings).
- Built from the official
  [integration template](https://github.com/GladysAssistant/integration-template-js).

## License

[Apache 2.0](LICENSE).
