import type Hls from 'hls.js'
import type {
  LoaderCallbacks,
  LoaderConfiguration,
  LoaderContext,
} from 'hls.js'

// Public HTTP transport used by https://api.ortified.ws/cdn.js.
// It substitutes the alphabet of a base64 URL with the provider's current hour.
export function cdnUrl(
  original: string,
  providerTime: number,
  openedAt: number,
  now = Date.now(),
): string {
  const url = new URL(original)
  if (!url.hostname.endsWith('.interkh.com') || url.protocol !== 'https:')
    throw new Error('Invalid CDN host')
  const hour = Math.round((providerTime * 1000 + now - openedAt) / 3_600_000)
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz'
  const substituted = 'DlChEXitLONYRkFjAsnBbymWzSHMqKPgQZpvwerofJTVdIuUcxaG'
  const encoded = btoa(`${hour}/${url.pathname}${url.search}`).replace(
    /[A-Za-z]/g,
    (char) => substituted[alphabet.indexOf(char)] ?? char,
  )
  return `${url.origin}/x-en-x/${encoded}`
}
export function cdnLoader(Engine: typeof Hls, providerTime: number) {
  const Base = Engine.DefaultConfig.loader
  const openedAt = Date.now()
  return class extends Base {
    load(
      context: LoaderContext,
      config: LoaderConfiguration,
      callbacks: LoaderCallbacks<LoaderContext>,
    ) {
      const original = context.url
      let requestUrl: string
      try {
        requestUrl = cdnUrl(original, providerTime, openedAt)
      } catch {
        callbacks.onError(
          { code: 0, text: 'Unsupported media host' },
          context,
          null,
          this.stats,
        )
        return
      }
      super.load({ ...context, url: requestUrl }, config, {
        ...callbacks,
        onSuccess: (response, stats, _context, details) => {
          // Relative playlist entries must resolve against the original path,
          // preserving only the CDN hostname selected by the HTTP redirect.
          const restored = new URL(original)
          const final = new URL(response.url)
          if (
            final.protocol !== 'https:' ||
            !final.hostname.endsWith('.interkh.com')
          ) {
            callbacks.onError(
              { code: 502, text: 'Invalid CDN redirect' },
              context,
              details,
              stats,
            )
            return
          }
          restored.hostname = final.hostname
          response.url = restored.href
          callbacks.onSuccess(response, stats, context, details)
        },
        onError: (error, _context, details, stats) =>
          callbacks.onError(error, context, details, stats),
        onTimeout: (stats, _context, details) =>
          callbacks.onTimeout(stats, context, details),
        onProgress: (stats, _context, data, details) =>
          callbacks.onProgress?.(stats, context, data, details),
        onAbort: (stats, _context, details) =>
          callbacks.onAbort?.(stats, context, details),
      })
    }
  }
}
