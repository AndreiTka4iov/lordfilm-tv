import { useEffect, useState, type RefObject } from 'react'
import {
  readWatchHistory,
  saveWatchProgress,
  type MoviePreview,
  type Playback,
} from '@/entities/movie'

export function useWatchProgress(
  movie: MoviePreview,
  source: Playback,
  videoRef: RefObject<HTMLVideoElement | null>,
) {
  const [startTime] = useState(() => {
    const saved = readWatchHistory().find((item) => item.id === movie.id)
    return saved &&
      !saved.completed &&
      saved.kind === source.kind &&
      saved.season === source.season &&
      saved.episode === source.episode
      ? saved.time
      : 0
  })
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    let lastSave = 0
    let started = false
    const save = () => {
      if (
        !started ||
        !Number.isFinite(video.currentTime) ||
        !Number.isFinite(video.duration) ||
        video.duration <= 0
      )
        return
      saveWatchProgress({
        ...movie,
        kind: source.kind,
        season: source.season,
        episode: source.episode,
        time: video.currentTime,
        duration: video.duration,
        completed: video.ended,
        updatedAt: Date.now(),
      })
      lastSave = Date.now()
    }
    const tick = () => {
      if (video.currentTime > 0 && !video.seeking) started = true
      if (Date.now() - lastSave >= 5000) save()
    }
    const visibility = () => {
      if (document.visibilityState === 'hidden') save()
    }
    video.addEventListener('timeupdate', tick)
    video.addEventListener('pause', save)
    video.addEventListener('seeked', save)
    video.addEventListener('ended', save)
    window.addEventListener('pagehide', save)
    document.addEventListener('visibilitychange', visibility)
    return () => {
      save()
      video.removeEventListener('timeupdate', tick)
      video.removeEventListener('pause', save)
      video.removeEventListener('seeked', save)
      video.removeEventListener('ended', save)
      window.removeEventListener('pagehide', save)
      document.removeEventListener('visibilitychange', visibility)
    }
  }, [movie, source, videoRef])
  return startTime
}
