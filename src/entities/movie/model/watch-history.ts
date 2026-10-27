'use client'
import { useSyncExternalStore } from 'react'
import { parseMoviePreviews, type MoviePreview } from './catalog'

export interface WatchProgress extends MoviePreview {
  kind: 'movie' | 'series'
  season: number | null
  episode: number | null
  time: number
  duration: number
  updatedAt: number
  completed: boolean
}
const key = 'lordfilm.watch-history.v1'
const changed = 'lordfilm:history'
const empty: WatchProgress[] = []
let cachedRaw: string | null = null
let cached: WatchProgress[] = empty
export function readWatchHistory(): WatchProgress[] {
  try {
    const raw = window.localStorage.getItem(key)
    if (raw === cachedRaw) return cached
    const parsed: unknown = JSON.parse(raw ?? '[]')
    const result: WatchProgress[] = []
    if (Array.isArray(parsed)) {
      for (const value of parsed.slice(0, 100)) {
        try {
          if (!value || typeof value !== 'object') continue
          const preview = parseMoviePreviews([value], 1)[0]
          if (!preview) continue
          const v = value as Record<string, unknown>
          const positive = (n: unknown) =>
            typeof n === 'number' && Number.isInteger(n) && n > 0 && n <= 9999
          if (
            !['movie', 'series'].includes(String(v.kind)) ||
            ![v.time, v.duration, v.updatedAt].every(
              (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0,
            ) ||
            typeof v.completed !== 'boolean' ||
            (v.kind === 'series'
              ? !positive(v.season) || !positive(v.episode)
              : v.season !== null || v.episode !== null)
          )
            continue
          if (result.some((item) => item.id === preview.id)) continue
          result.push({
            ...preview,
            kind: v.kind as WatchProgress['kind'],
            season: v.season as number | null,
            episode: v.episode as number | null,
            time: v.time as number,
            duration: v.duration as number,
            updatedAt: v.updatedAt as number,
            completed: v.completed,
          })
        } catch {
          /* Discard only the damaged entry. */
        }
      }
    }
    cachedRaw = raw
    cached = result.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 20)
    return cached
  } catch {
    return empty
  }
}
export function saveWatchProgress(progress: WatchProgress) {
  try {
    window.localStorage.setItem(
      key,
      JSON.stringify(
        [
          progress,
          ...readWatchHistory().filter((item) => item.id !== progress.id),
        ].slice(0, 20),
      ),
    )
    window.dispatchEvent(new Event(changed))
  } catch {
    /* Playback remains available when storage is disabled or full. */
  }
}
function subscribe(listener: () => void) {
  window.addEventListener(changed, listener)
  window.addEventListener('storage', listener)
  return () => {
    window.removeEventListener(changed, listener)
    window.removeEventListener('storage', listener)
  }
}
export function useWatchHistory() {
  return useSyncExternalStore(subscribe, readWatchHistory, () => empty)
}
