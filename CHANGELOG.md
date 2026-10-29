# Changelog

All notable changes to this integration are documented in this file. The format
follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project
uses [semantic versioning](https://semver.org/).

Describe each change under `## [Unreleased]` as you make it. The Release
workflow moves that section under the version it ships, and the section becomes
the notes of the version's GitHub Release.

## [Unreleased]

## [1.1.0] - 2026-10-29

### Added

- Live crowd of Strasbourg's Iceberg ice rink (open data): tick "Strasbourg
  (Iceberg ice rink)" in the configuration, then add it from the Discover tab.
  Same device, triggers, widget and scene action as the Strasbourg pools.
- Name ("Piscines et patinoires" in the store, "Piscines et patinoires en temps
  réel" in the guides), cover and texts widened to pools and ice rinks;
  settings, keys and existing devices unchanged.

## [1.0.0] - 2026-10-29

### Added

- Live crowd and opening of the public swimming pools of the Eurométropole de
  Strasbourg and of the city of Bordeaux, from their open data portals: no
  account, no key.
- Tick your cities in the configuration: their pools show in the Discover tab,
  one device each with, depending on the city, open or closed, people inside,
  capacity and occupancy, the operator's crowd level, today's hours and the
  age of the data, read every 3, 5 or 10 minutes. No value is invented when a
  city publishes no count (pool closed, night).
- Dashboard widget "Swimming pools": one row per pool with the crowd and the
  closing or next opening time, colored by how busy it is; the hours can be
  hidden.
- Scene triggers: the pool opens, the pool closes, the crowd rises above or
  drops below a threshold.
- Scene action "Get the crowd of the pools", with a sentence ready to send.

[Unreleased]: https://github.com/guim31/gladys-piscines/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/guim31/gladys-piscines/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/guim31/gladys-piscines/releases/tag/v1.0.0
