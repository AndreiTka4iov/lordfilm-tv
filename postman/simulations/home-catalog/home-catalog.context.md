# Home catalog simulation

## Purpose

Run the real browser catalog client against a contract-shaped HTTP dependency. Mock: `postman/mocks/catalog-api`; contract: `postman/specs/catalog.openapi.json`. Two pools succeed; new deliberately returns the documented 502. The detail route returns one contract-shaped movie.

## Execution

Run `postman simulation run postman/simulations/home-catalog/home-catalog.sim.yaml --port 4702 --output ndjson`. Set `NEXT_PUBLIC_CATALOG_API_URL=http://localhost:4702/catalog` when starting a frontend (production/static requires rebuild). Verify 40 cards and the new shelf's retry button. Stop with Ctrl+C. The recorded dev check used Playwright `route.continue` to rewrite only the request URL to the running simulation, without replacing fetch or fulfilling API responses.

## Assumptions

2026-10-25: Seeded contract data validates transport/error behavior, not LordFilm content or image memory. A live API check separately confirmed 60 real cards. CORS wildcard is local mock behavior; the actual API allows only its configured frontend origin.

## Observations

<!-- begin:observations -->

- 2026-10-25: Search UI fetched `/v1/catalog/search?q=Test` over simulation HTTP and rendered 20 cards; request log recorded 200. Live source separately returned 36 results for «Гослинг».

- 2026-10-25: Watch fetched detail + playback over real simulation HTTP, then the real HLS engine decoded the synthetic fixture (320 px wide, currentTime > 0.3 s). Simulation logged both GET requests with 200. Media fixture served by the browser test harness, not a third-party CDN.

- 2026-10-25: Actual browser detail client read `/v1/movies/1/movie-1` over HTTP and rendered its title. The simulation logged 200 for that route.

- 2026-10-25: Browser showed 20 popular + 20 series cards and a retry button for new. Simulation received actual GETs on all three pool paths; new returned 502, others 200.

<!-- end:observations -->
