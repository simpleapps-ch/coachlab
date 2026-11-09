# Coachlab

Mandantenfähige Trainingsplattform für Fussballvereine – betrieben von der Simpleapps.ch GmbH, Neuheim.

## Voraussetzungen

- Node.js 22 (siehe `.nvmrc`)
- Docker Desktop (für Supabase lokal)

## Erste Schritte

```bash
npm install
cp .env.example .env.local
npm run db:start          # Supabase lokal starten, gibt URL und Keys aus
# Publishable Key und Secret Key aus der Ausgabe in .env.local eintragen
npm run dev
```

- Öffentliche Seiten: http://coachlab.localhost:3000
- Ein Verein: http://fc-test.coachlab.localhost:3000
- Supabase Studio: http://127.0.0.1:54323

## Befehle

| Befehl | Zweck |
| --- | --- |
| `npm run dev` | Entwicklungsserver |
| `npm run lint` | ESLint |
| `npm run typecheck` | TypeScript prüfen |
| `npm run test` | Tests (Vitest) |
| `npm run build` | Produktions-Build |
| `npm run db:start` / `db:stop` | Supabase lokal starten / stoppen |
| `npm run db:reset` | Lokale Datenbank neu aufbauen (alle Migrationen) |

## Test «Verein A sieht nichts von Verein B»

Die Row-Level-Security-Tests laufen gegen eine echte Postgres-Datenbank. In CI sind sie Pflicht, lokal so:

```bash
npm run db:start
TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres npm run test
```

Ohne `TEST_DATABASE_URL` werden sie übersprungen. Jede Testdatei legt ihre eigene Datenbank `coachlab_test_<name>` an, die übrigen Daten bleiben unberührt.

Mehr zu Aufbau und Regeln: [CLAUDE.md](CLAUDE.md) und [docs/](docs/).
