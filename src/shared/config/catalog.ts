export function catalogApiUrl(): string {
  const configured = process.env.NEXT_PUBLIC_CATALOG_API_URL?.trim()
  if (configured)
    return new URL(configured, window.location.origin).href.replace(/\/$/, '')
  const url = new URL(window.location.origin)
  url.port = '3001'
  return url.origin
}
