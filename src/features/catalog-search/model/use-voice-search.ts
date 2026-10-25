import { useEffect, useRef, useState } from 'react'
import { messages } from '@/shared/locales'

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult:
    | ((event: {
        results: ArrayLike<ArrayLike<{ transcript: string }>>
      }) => void)
    | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  start: () => void
  stop: () => void
  abort: () => void
}
type SpeechWindow = Window & {
  SpeechRecognition?: new () => Recognition
  webkitSpeechRecognition?: new () => Recognition
}
export function useVoiceSearch(onTranscript: (text: string) => void) {
  const recognitionRef = useRef<Recognition | null>(null)
  const [listening, setListening] = useState(false)
  const [status, setStatus] = useState('')
  useEffect(
    () => () => {
      const recognition = recognitionRef.current
      if (recognition) {
        recognition.onresult = null
        recognition.onerror = null
        recognition.onend = null
        recognition.abort()
      }
    },
    [],
  )
  function toggle() {
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      return
    }
    const speechWindow = window as SpeechWindow
    const Constructor =
      speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition
    if (!Constructor) {
      setStatus(messages.search.voiceUnavailable)
      return
    }
    const recognition = new Constructor()
    recognition.lang = 'ru-RU'
    recognition.continuous = false
    recognition.interimResults = false
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript.trim()
      if (transcript) {
        onTranscript(transcript)
        setStatus(messages.search.voiceRecognized)
      }
    }
    recognition.onerror = (event) => {
      setStatus(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? messages.search.microphoneDenied
          : event.error === 'no-speech'
            ? messages.search.noSpeech
            : messages.search.voiceFailed,
      )
    }
    recognition.onend = () => {
      setListening(false)
      recognitionRef.current = null
      setStatus((value) => (value === messages.search.listening ? '' : value))
    }
    try {
      recognitionRef.current = recognition
      recognition.start()
      setListening(true)
      setStatus(messages.search.listening)
    } catch {
      recognitionRef.current = null
      setListening(false)
      setStatus(messages.search.voiceFailed)
    }
  }
  return { listening, status, toggle }
}
