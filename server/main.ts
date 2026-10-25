import { LordFilmSource } from './catalog/lordfilm.ts'
import { CatalogService } from './catalog/service.ts'
import { createCatalogServer } from './http.ts'

const port = Number(process.env.API_PORT ?? 3001)
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw new Error('Invalid API_PORT')
const source = new LordFilmSource(
  process.env.LORDFILM_ORIGIN ?? 'https://lordfilmx13.ink',
)
const server = createCatalogServer(
  new CatalogService(source),
  process.env.API_CORS_ORIGIN ?? 'http://localhost:3000',
  source,
  source,
  source,
)
server.listen(port, process.env.API_HOST ?? '127.0.0.1', () =>
  console.log(`Catalog API listening on port ${port}`),
)
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, () => {
    server.close()
    server.closeIdleConnections()
  })
}
