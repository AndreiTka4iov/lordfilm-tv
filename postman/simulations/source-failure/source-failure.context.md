# Source failure simulation

## Purpose

Failure-only stand-in for the public LordFilm HTML source. Handler: `postman/mocks/lordfilm-source/default.cjs`. It does not simulate successful catalog data.

## Execution

Run `postman simulation run postman/simulations/source-failure/source-failure.sim.yaml --port 4701 --output ndjson`. Wait for `listening`. Path routing adds `/source`; when running the real adapter against this simulation, use a local HTTP relay that forwards `/top-100`, `/catalog/category/{current UTC year}`, `/serialy` to `http://localhost:4701/source` plus the request path. The source origin deliberately accepts no path prefix. Stop the simulation with Ctrl+C. Regular automated HTTP failure and timeout coverage: `npm run test:api`.

## Assumptions

2026-10-25: This mock represents a 503 outage, not the upstream provider's complete contract. No published owner mock or authenticated workspace was used. Happy-path data was checked directly against the public site; malformed responses, short catalogs and timeouts are covered by HTTP tests.

## Observations

<!-- begin:observations -->

- 2026-10-28: Real API requested `/catalog/category/2026`; simulation logged 503 from the source member and the API returned 502 `UPSTREAM_UNAVAILABLE`, with no older-catalog fallback. Live saved `new` request separately passed all four assertions (status, count/uniqueness, group, current release year).

- 2026-10-25: Real `CatalogService` + `LordFilmSource` + HTTP server, through a temporary local relay, returned 502 for all three groups. Simulation logged GET `/top-100`, `/filmy`, `/serialy`, each 503. Every member received traffic.

<!-- end:observations -->

## What didn't work

- 2026-10-25: CLI rejected a directory in the simulation member `path`; explicit `config.yaml` fixed startup.
