import { catalogApiUrl } from '@/shared/config'
export class MovieRequestError extends Error {
  readonly status: number
  constructor(status: number) {
    super('Movie request failed')
    this.status = status
  }
}
export async function requestMovie(
  path: string,
  signal: AbortSignal,
): Promise<unknown> {
  const response = await fetch(`${catalogApiUrl()}${path}`, {
    signal,
    cache: 'no-store',
    credentials: 'omit',
  })
  if (!response.ok || !response.body)
    throw new MovieRequestError(response.status)
  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let json = ''
  let size = 0
  try {
    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 128 * 1024) throw new Error('Catalog response too large')
      json += decoder.decode(value, { stream: true })
    }
    json += decoder.decode()
    return JSON.parse(json) as unknown
  } finally {
    await reader.cancel()
  }
}
