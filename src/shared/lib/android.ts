type AndroidHost = {
  postMessage(message: string): void
  onmessage: ((event: { data: string }) => void) | null
}

/** Injected only for the packaged origin by Android's WebMessageListener. */
export function androidHost(): AndroidHost | undefined {
  if (
    typeof window === 'undefined' ||
    window.location.origin !== 'https://appassets.androidplatform.net'
  )
    return undefined
  return (window as Window & { LordFilmAndroid?: AndroidHost }).LordFilmAndroid
}

type NativeResponse = { status: number; body: unknown }
const pending = new Map<string, (result: NativeResponse) => void>()
let sequence = 0

function receive(event: { data: string }) {
  if (typeof event.data !== 'string' || event.data.length > 132 * 1024) return
  try {
    const response: unknown = JSON.parse(event.data)
    if (
      typeof response !== 'object' ||
      response === null ||
      !('id' in response) ||
      typeof response.id !== 'string' ||
      !('status' in response) ||
      typeof response.status !== 'number' ||
      !Number.isInteger(response.status) ||
      response.status < 200 ||
      response.status > 599 ||
      !('body' in response)
    )
      return
    pending.get(response.id)?.({ status: response.status, body: response.body })
  } catch {
    /* Ignore malformed messages; the caller retains its bounded timeout. */
  }
}

export function requestAndroid(
  path: string,
  signal: AbortSignal,
): Promise<NativeResponse> {
  const native = androidHost()
  if (!native || typeof native.postMessage !== 'function')
    return Promise.reject(new Error('Android transport is unavailable'))
  if (signal.aborted) return Promise.reject(signal.reason)
  if (pending.size >= 8)
    return Promise.reject(new Error('Too many native requests'))
  const id = `${Date.now()}-${++sequence}`
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      window.clearTimeout(timer)
      signal.removeEventListener('abort', abort)
      pending.delete(id)
      if (pending.size === 0) native.onmessage = null
    }
    const cancel = () => {
      try {
        native.postMessage(JSON.stringify({ cancel: id }))
      } catch {
        /* WebView may already be closed. */
      }
    }
    const abort = () => {
      cleanup()
      cancel()
      reject(signal.reason ?? new DOMException('Aborted', 'AbortError'))
    }
    const timer = window.setTimeout(() => {
      cleanup()
      cancel()
      reject(new Error('Android request timed out'))
    }, 30000)
    native.onmessage = receive
    pending.set(id, (response) => {
      cleanup()
      resolve(response)
    })
    signal.addEventListener('abort', abort, { once: true })
    try {
      native.postMessage(JSON.stringify({ id, path }))
    } catch (error) {
      cleanup()
      reject(error)
    }
  })
}
