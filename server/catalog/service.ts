import {
  SourceError,
  type CatalogSource,
  type Group,
  type Pool,
} from './types.ts'

export class CatalogService {
  private readonly cache = new Map<Group, { expires: number; pool: Pool }>()
  private readonly pending = new Map<Group, Promise<Pool>>()
  private readonly source: CatalogSource
  private readonly ttlMs: number
  private readonly now: () => number
  constructor(source: CatalogSource, ttlMs = 300_000, now = Date.now) {
    this.source = source
    this.ttlMs = ttlMs
    this.now = now
  }
  get(group: Group): Promise<Pool> {
    const cached = this.cache.get(group)
    if (cached && cached.expires > this.now())
      return Promise.resolve(cached.pool)
    const pending = this.pending.get(group)
    if (pending) return pending
    const request = this.source
      .load(group)
      .then((items) => {
        if (
          items.length !== 20 ||
          new Set(items.map((item) => item.id)).size !== 20
        )
          throw new SourceError()
        const pool: Pool = {
          group,
          items,
          generatedAt: new Date(this.now()).toISOString(),
        }
        this.cache.set(group, { expires: this.now() + this.ttlMs, pool })
        return pool
      })
      .finally(() => this.pending.delete(group))
    this.pending.set(group, request)
    return request
  }
}
