# LordFilm TV

A standalone Android TV app and web client for browsing movies and TV shows, with remote control navigation, search, and a built-in HLS player. Built with Next.js, React, TypeScript, Mantine, and Tailwind CSS. The interface is currently in Russian.

| Version     | How it works                                             | Own server                                 |
| ----------- | -------------------------------------------------------- | ------------------------------------------ |
| Android APK | The interface and source integrations run inside the app | Not required                               |
| Web app     | Next.js frontend with a separate Node.js API             | Required for catalog and playback requests |

## Features

- Home screen with three collections of 20 titles each, plus movie and TV show detail pages.
- Search by title and actor, with a 500 ms debounce, immediate submission on Enter, and voice input where supported by the browser.
- Arrow, OK, and Back navigation, a sidebar that expands on focus, and focus restoration when returning to a selected title.
- HLS player with quality and audio track selection, seasons, episodes, and next-episode playback.
- Light and dark themes with the locally bundled Onest font.
- Standalone Android APK, a separate API for the web app, Next.js standalone builds, and static export.

The project is under development. Menu sections other than Home and Search currently contain placeholders. Authentication and a native video player are not implemented; the Android APK uses the web player. Test physical remote controls and hardware decoding on your target device. Tailwind CSS 4 requires a modern browser or WebView. Voice input depends on browser support, microphone permission, and a secure context.

## Run the web app locally

Requires Node.js 24 (the exact version is in `.nvmrc`) and npm 11 or 12.

```sh
git clone https://github.com/AndreiTka4iov/lordfilm-tv.git
cd lordfilm-tv
nvm use
npm ci
cp .env.example .env
npm run api:dev
```

In another terminal:

```sh
npm run dev
```

Open http://localhost:3000. The API listens on http://localhost:3001. Both processes are required for the web catalog. Next.js and the API commands read the local `.env` file, which is excluded from Git.

### Configuration

| Variable                      | Default / purpose                                                                                        |
| ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| `LORDFILM_ORIGIN`             | Source origin from `.env.example`; update it if the source domain changes                                |
| `API_HOST`                    | `127.0.0.1`; use `0.0.0.0` for direct LAN access                                                         |
| `API_PORT`                    | `3001` — local API port                                                                                  |
| `API_CORS_ORIGIN`             | `http://localhost:3000` — exact frontend origin, including the port                                      |
| `NEXT_PUBLIC_CATALOG_API_URL` | Empty: use the current page's hostname on port `3001`. Accepts an HTTPS URL or reverse proxy path prefix |
| `HOST_BIND`                   | `127.0.0.1` — bind address for published Docker ports                                                    |
| `FRONTEND_OUT_PORT`           | `3000` — published frontend Docker port                                                                  |
| `API_OUT_PORT`                | `3001` — published API Docker port                                                                       |

To test the web app in a TV browser, start the frontend with `npm run dev:lan`, set `API_HOST=0.0.0.0`, and set `API_CORS_ORIGIN` to the page's LAN origin. On a TV, `localhost` refers to the TV itself. If you change the frontend or API ports, update the API URL and allowed origin accordingly.

`NEXT_PUBLIC_*` values are exposed to the browser and embedded at production/export build time. Never store secrets in them. An HTTPS frontend requires an HTTPS API or a proxy on the same origin.

## Builds and Docker

```sh
npm run build
npm start             # Production Next.js server, localhost:3000
npm run api:start     # Separate API process
npm run build:export  # Static files in .next-export/
```

The static export can be served by any HTTP server that supports directory `index.html` files. The API remains a separate process. A static export does not produce an APK on its own.

For Docker, choose one frontend mode and start the API:

```sh
npm run docker:run:api
npm run docker:run:dev     # Development, bind mounts, and Fast Refresh
# Or:
npm run docker:run:prod    # Next.js standalone
# Or:
npm run docker:run:static  # Static export + Nginx
```

Frontend modes share the same published port. Before switching, run `npm run docker:stop:dev`, `docker:stop:prod`, or `docker:stop:static`. Stop the API with `npm run docker:stop:api`. Stopping preserves the containers. View frontend logs with `npm run docker:logs:dev` (or `prod`/`static`), and API logs with `docker compose -f docker-compose.api.yml logs -f`.

Ports are bound to localhost by default. For LAN access, set `HOST_BIND=0.0.0.0` and the exact `API_CORS_ORIGIN` in `.env`. Compose uses `.env` for configuration substitution and passes the public API URL into the build. Rebuild images after changing dependencies or build-time settings. For public deployment, configure TLS and request limits at the reverse proxy; the API does not implement authentication.

## Android TV APK

[Download APK — 0.2.0 Preview 1](https://github.com/AndreiTka4iov/lordfilm-tv/releases/download/v0.2.0-preview.1/lordfilm-tv-0.2.0-preview.1.apk) · [Release notes and SHA-256](https://github.com/AndreiTka4iov/lordfilm-tv/releases/tag/v0.2.0-preview.1)

This is a test-key-signed preview (`tv.lordfilm.app.debug`). Transfer the APK to your TV and open it with a file manager; allow installation from that app when prompted. Requires Android 7.0+ and WebView/Chromium 111+.

The Android app runs independently: the APK includes the interface, and Kotlin fetches catalog data, search results, details, and playback information directly from external sources. It does not require a Mac, Docker, Node.js, your own server, or an API URL setting. Internet access is required for catalog data, artwork, and video.

The `android/` project uses Kotlin and WebView, with Android 7.0 (API 24) as the minimum OS version. It requires Android System WebView/Chromium **111 or newer**. The Android version alone does not guarantee compatibility: devices with an older WebView, such as version 83, receive a prompt to update the engine. To build the app, install JDK 17 and Android SDK Platform 36 through Android Studio, then configure `ANDROID_HOME` or a local `android/local.properties` file (`sdk.dir=…`). On macOS:

```sh
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
npm ci
npm run android:build
```

Output: `android/app/build/outputs/apk/debug/app-debug.apk`. The command creates a fresh web export, checks Kotlin formatting, runs Kotlin tests and Android Lint, and verifies that every web asset is included in the APK. The Gradle Wrapper is included in the repository. `NEXT_PUBLIC_CATALOG_API_URL` applies only to the web app and is not used inside the APK.

The catalog opens immediately on launch. The app has no connection settings or local HTTP server. The source origin is fixed at build time. To use a different source mirror:

```sh
npm run android:prepare
cd android
./gradlew -PlordfilmOrigin=https://your-source.example verifyDebugWebAssets
```

The shell loads only packaged pages through WebViewAssetLoader at the HTTPS origin `https://appassets.androidplatform.net`. React sends paths from the existing contract (`/v1/…`) through an asynchronous WebMessage bridge restricted to that origin. Kotlin returns the same DTOs. These are in-process messages, not network API requests. The web app continues to use a separate HTTP API.

Bridge protocol: request `{id, path}`, response `{id, status, body}`, cancellation `{cancel: id}`. Only known catalog operations are accepted; arbitrary URLs are rejected. Android runs two network jobs with a queue of up to six; excess requests receive 503. Responses are limited to 128 KiB, source HTML to 4 MiB, and provider HTML to 2 MiB. Each HTTP call has a 10-second timeout. Requests are cancelled when the screen or search query changes. Native connections and jobs are closed when the Activity is destroyed. Catalog data and search results are not cached on disk.

Source-hosted posters and backgrounds (`xfields.poster` / `posterbg`) take priority. For popular titles, poster addresses are resolved lazily, with up to two concurrent page requests. Up to 64 addresses are kept in memory for five minutes; this cache contains neither HTML nor images. Source images and fallback TMDB posters are fetched by the native HTTP client and streamed to WebView, with up to four concurrent transfers and a 4 MiB limit per image. There is no custom image cache. For `image.tmdb.org`, the app uses Cloudflare DNS-over-HTTPS with Google DNS as a fallback and TLS verification. This avoids system DNS responses that map the domain to loopback without changing device settings. Other domains use system DNS. Local and loopback DNS answers are rejected, and positive answers are kept for up to 30 seconds. At least one of these resolvers must be reachable over HTTPS. The app neither disables certificate verification nor accepts arbitrary image URLs.

Arrows and OK use the existing TV navigation. Back is passed to the current screen first, then to navigation history; at the root, the app asks before exiting. Media keys are forwarded to the web player. When the app enters the background, the player closes and releases its resources. Automatic playback restoration is not implemented. Voice input depends on Web Speech support in WebView; keyboard input remains available when it is unsupported.

```sh
npm run test:android:web # Export, native transport without an HTTP API, search, and cancellation
cd android
./gradlew checkKotlinFormat testDebugUnitTest lintDebug verifyDebugWebAssets assembleRelease
```

The editable banner is `android/branding/tv-banner.svg`; the square icon is `android/app/src/main/res/drawable/app_icon.xml`. After changing the banner, run `npm run android:branding` (requires Chromium: `npx playwright install chromium`). The generated PNG is committed, so normal APK builds do not require artwork generation.

Format Kotlin and Gradle scripts with `./gradlew formatKotlin` from the `android/` directory.

Release output: `app/build/outputs/apk/release/app-release-unsigned.apk`. Sign it with your own permanent Android key before distributing it. The debug APK uses a test key and is intended for testing. GitHub Actions saves it as an artifact of the Android job. External sources and CDNs may still be unavailable on a particular network; their availability no longer depends on your own server.

## API and data source

| Method | Path                              | Result                                                           |
| ------ | --------------------------------- | ---------------------------------------------------------------- |
| GET    | `/v1/catalog/pools/{group}`       | 20 titles; `group`: `popular`, `new`, `series`                   |
| GET    | `/v1/catalog/search?q=…`          | Up to 40 titles; query length: 2–200 characters                  |
| GET    | `/v1/movies/{id}/{slug}`          | Movie or TV show details                                         |
| GET    | `/v1/movies/{id}/{slug}/playback` | Playback information; optional `season` and `episode` parameters |

Contract: [OpenAPI](postman/specs/catalog.openapi.json). Postman requests, local mocks, and simulations are in `postman/`. A Postman account is not required to run the app or automated tests.

The adapter reads data from public LordFilm pages without executing their scripts. `popular` uses `/top-100`, `new` uses `/filmy`, and `series` uses `/serialy`. Ordering comes from the source: the New Releases shelf does not guarantee release-date sorting. Titles are unique within each collection but may appear in multiple collections. Search uses `/search` with `search_text_mode=full`. Pagination is not implemented; users are prompted to refine the query when the result limit is reached.

The web API caches collections on the server for five minutes and coalesces concurrent requests. Search and playback responses are not cached. Source failures return 502 and timeouts return 504; missing data is not replaced with fictional entries. HTML is limited to 4 MiB, and source requests have a 10-second timeout. CORS permits only the configured origin. There is no arbitrary URL proxy.

Playback uses the Collaps provider. Video is streamed directly from the CDN; the API does not store or proxy media segments. The provider-specific HTTP transport is implemented in `cdn-loader.ts`. Changes to the domain, page format, or provider may require adapter updates. Source availability and signed links depend on the network. The project does not provide a stable external API.

## Memory and TV navigation

The client retains only the current screen's data: up to 60 home screen titles or 40 search results. Catalog data is not cached in localStorage or IndexedDB. Requests are cancelled when leaving a screen or changing the query, and stale responses are ignored. A shared IntersectionObserver unloads offscreen posters.

The player and HLS.js load only after selecting Watch. Adaptive quality is capped at 720p by default. The target buffer is 10 seconds, the maximum is 20 seconds / 8 MiB, and the back buffer is zero. These are HLS settings, not a hard limit on browser memory. Closing the player destroys HLS, its worker, MediaSource, requests, and timers.

Arrows move focus. Left from the content edge opens the menu; Right from the menu returns to the content. In the player, OK/Space toggles playback, Left/Right on the video seek by 10 seconds, Up opens the controls, and Back/Escape closes the player. Voice input starts only when the microphone button is selected.

## Development and contributions

```text
src/app       Routes and root layout
src/core      Providers and application composition
src/views     Screens; the FSD pages layer
src/widgets   Self-contained interface blocks
src/features  User actions
src/entities  Catalog models and components
src/shared    Configuration, locales, theme, and utilities
server        HTTP API, catalog adapter, and playback provider
```

ESLint enforces FSD dependency direction and public slice APIs. TypeScript runs in strict mode, including unused code checks. The UI uses Mantine and Tailwind; user-facing strings live in `src/shared/locales`. See [AGENTS.md](AGENTS.md) for detailed conventions.

```sh
npm run check
npx playwright install chromium # Once; use --with-deps on Linux CI
npm run test:e2e
npm run build
npm run build:export
```

Browser tests start the frontend on port 3100 and replace external APIs and media with fixtures. They do not require a live source or a separate API process. Set `TEST_BASE_URL` to test an already running frontend. API HTTP tests start local servers and cover validation, parsing, caching, timeouts, and errors. Media in `tests/e2e/fixtures/media` is a synthetic test clip.

Before opening a PR, run the checks above and describe the behavior change and how you verified it. For bug reports, include reproduction steps and browser/WebView and device versions. Remove private data from logs. GitHub Actions checks the code, browser scenarios, both web builds, Compose configurations, and Docker images. A separate Android job checks Kotlin, native tests, Lint, and APK packaging; its debug APK is available in the workflow artifacts.
