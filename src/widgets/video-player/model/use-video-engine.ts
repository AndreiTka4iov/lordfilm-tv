'use client'
import { useEffect, useRef, useState, type RefObject } from 'react'
import type Hls from 'hls.js'
import {
  readAudioPreference,
  saveAudioPreference,
  preferredAudioIndex,
} from './audio-preference'
import { cdnLoader } from './cdn-loader'
import type { Playback } from '@/entities/movie'

export function useVideoEngine(
  source: Playback,
  videoRef: RefObject<HTMLVideoElement | null>,
  startTime = 0,
  seriesId?: string,
) {
  const preferredAudio = useRef<string | null>(null)
  const audioNames = useRef<string[]>([])
  const hlsRef = useRef<Hls | null>(null)
  const [playing, setPlaying] = useState(false)
  const [buffering, setBuffering] = useState(true)
  const [error, setError] = useState(false)
  const [time, setTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [levels, setLevels] = useState<{ value: string; label: string }[]>([])
  const [audios, setAudios] = useState<{ value: string; label: string }[]>([])
  const [quality, setQuality] = useState('-1')
  const [audio, setAudio] = useState('0')
  const [muted, setMuted] = useState(false)
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    preferredAudio.current = seriesId ? readAudioPreference(seriesId) : null
    let active = true
    let lastUpdate = 0
    let restored = false
    const restore = () => {
      if (restored || !Number.isFinite(video.duration) || video.duration <= 0)
        return
      restored = true
      if (startTime > 0)
        video.currentTime = Math.min(startTime, Math.max(0, video.duration - 1))
    }
    const fail = () => {
      if (!active) return
      setError(true)
      setBuffering(false)
      hlsRef.current?.stopLoad()
      video.pause()
    }
    const play = () => {
      void video.play().catch((reason: unknown) => {
        if (!active) return
        if (
          reason instanceof DOMException &&
          reason.name === 'NotAllowedError'
        ) {
          setBuffering(false)
          setPlaying(false)
        } else if (!(
          reason instanceof DOMException && reason.name === 'AbortError'
        ))
          fail()
      })
    }
    const onPlay = () => {
      if (active) {
        setPlaying(true)
        setBuffering(false)
      }
    }
    const onPause = () => {
      if (active) setPlaying(false)
    }
    const onWait = () => {
      if (active) setBuffering(true)
    }
    const onTime = () => {
      if (active && Date.now() - lastUpdate >= 250) {
        lastUpdate = Date.now()
        setTime(video.currentTime)
      }
    }
    const onDuration = () => {
      if (active)
        setDuration(Number.isFinite(video.duration) ? video.duration : 0)
    }
    video.addEventListener('loadedmetadata', restore)
    video.addEventListener('durationchange', restore)
    video.addEventListener('playing', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('waiting', onWait)
    video.addEventListener('timeupdate', onTime)
    video.addEventListener('durationchange', onDuration)
    video.addEventListener('error', fail)
    void import('hls.js')
      .then(({ default: Engine }) => {
        if (!active) return
        if (
          Engine.isSupported() &&
          (source.cdnTime !== null ||
            !(
              'ManagedMediaSource' in window &&
              video.canPlayType('application/vnd.apple.mpegurl')
            ))
        ) {
          const hls = new Engine({
            startPosition: startTime > 0 ? startTime : -1,
            ...(source.cdnTime !== null
              ? { loader: cdnLoader(Engine, source.cdnTime) }
              : {}),
            maxBufferLength: 10,
            maxMaxBufferLength: 20,
            maxBufferSize: 8 * 1024 * 1024,
            backBufferLength: 0,
            capLevelToPlayerSize: true,
            maxDevicePixelRatio: 1,
            startLevel: 0,
            startFragPrefetch: false,
            enableWorker: true,
            manifestLoadPolicy: {
              default: {
                maxTimeToFirstByteMs: 8000,
                maxLoadTimeMs: 12000,
                timeoutRetry: {
                  maxNumRetry: 1,
                  retryDelayMs: 1000,
                  maxRetryDelayMs: 1000,
                },
                errorRetry: {
                  maxNumRetry: 1,
                  retryDelayMs: 1000,
                  maxRetryDelayMs: 1000,
                },
              },
            },
          })
          hlsRef.current = hls
          const updateAudios = () => {
            if (!active) return
            const tracks = hls.audioTracks.slice(0, 32)
            audioNames.current = tracks.map(
              (track, index) => source.audioNames[index] || track.name || '',
            )
            setAudios(
              tracks.map((_, index) => ({
                value: String(index),
                label: audioNames.current[index] || String(index + 1),
              })),
            )
            const index = preferredAudioIndex(
              audioNames.current,
              preferredAudio.current,
            )
            const track = tracks[index]
            if (track) {
              hls.setAudioOption(track)
              setAudio(String(index))
            }
          }
          hls.on(Engine.Events.MANIFEST_PARSED, () => {
            if (!active) return
            const cap = hls.levels.reduce(
              (best, level, index) => (level.height <= 720 ? index : best),
              0,
            )
            hls.autoLevelCapping = cap
            setLevels(
              hls.levels.slice(0, 16).map((level, index) => ({
                value: String(index),
                label: `${level.height}p`,
              })),
            )
            updateAudios()
            play()
          })
          hls.on(Engine.Events.AUDIO_TRACKS_UPDATED, updateAudios)
          hls.on(Engine.Events.AUDIO_TRACK_SWITCHED, (_, data) => {
            if (active) setAudio(String(data.id))
          })
          hls.on(Engine.Events.ERROR, (_, data) => {
            if (data.fatal) fail()
          })
          hls.attachMedia(video)
          hls.loadSource(source.src)
        } else if (
          source.cdnTime === null &&
          video.canPlayType('application/vnd.apple.mpegurl')
        ) {
          video.src = source.src
          play()
        } else fail()
      })
      .catch(fail)
    return () => {
      active = false
      video.removeEventListener('loadedmetadata', restore)
      video.removeEventListener('durationchange', restore)
      video.removeEventListener('playing', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('waiting', onWait)
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('durationchange', onDuration)
      video.removeEventListener('error', fail)
      hlsRef.current?.destroy()
      hlsRef.current = null
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [source, videoRef, startTime, seriesId])
  function togglePlay() {
    const video = videoRef.current
    if (!video) return
    if (video.paused)
      void video.play().catch(() => {
        setError(true)
      })
    else video.pause()
  }
  function seek(position: number) {
    const video = videoRef.current
    if (!video || !Number.isFinite(video.duration)) return
    video.currentTime = Math.max(0, Math.min(video.duration, position))
    setTime(video.currentTime)
  }
  function setLevel(value: string) {
    const hls = hlsRef.current
    if (!hls) return
    hls.currentLevel = Number(value)
    setQuality(value)
  }
  function setTrack(value: string) {
    const hls = hlsRef.current
    const index = Number(value)
    const track = hls?.audioTracks[index]
    if (!hls || !Number.isInteger(index) || !track) return
    const name = audioNames.current[index]
    if (seriesId && name) {
      preferredAudio.current = name
      saveAudioPreference(seriesId, name)
    }
    hls.setAudioOption(track)
    setAudio(value)
  }
  function toggleMute() {
    if (videoRef.current) {
      videoRef.current.muted = !videoRef.current.muted
      setMuted(videoRef.current.muted)
    }
  }
  return {
    playing,
    buffering,
    error,
    time,
    duration,
    levels,
    audios,
    quality,
    audio,
    muted,
    togglePlay,
    seek,
    setLevel,
    setTrack,
    toggleMute,
  }
}
