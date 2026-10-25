'use client'
import {
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useDebouncedCallback } from '@mantine/hooks'
import { ActionIcon, Text, TextInput } from '@mantine/core'
import {
  IconMicrophone,
  IconPlayerStopFilled,
  IconSearch,
} from '@tabler/icons-react'
import { contentFocusTarget, focusSidebar } from '@/shared/lib'
import { messages } from '@/shared/locales'
import { useVoiceSearch } from '../model/use-voice-search'

function SearchForm({ initialQuery }: { initialQuery: string }) {
  const [invalid, setInvalid] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const microphoneRef = useRef<HTMLButtonElement>(null)
  const router = useRouter()
  const pathname = usePathname()
  const composing = useRef(false)
  const requestedUrl = useRef<string | null>(null)
  function navigate(value: string) {
    if (pathname === '/search/' || pathname === '/search') {
      if (value === initialQuery.trim().replace(/\s+/g, ' ')) return
      requestedUrl.current = `/search\0${value}`
      router.replace(
        value ? `/search/?q=${encodeURIComponent(value)}` : '/search/',
        { scroll: false },
      )
    } else if (value.length >= 2) {
      requestedUrl.current = `/search\0${value}`
      router.push(`/search/?q=${encodeURIComponent(value)}`)
    }
  }
  const debounced = useDebouncedCallback(
    (value: string) => navigate(value),
    500,
  )
  useEffect(() => {
    const key = `${pathname.replace(/\/$/, '')}\0${initialQuery}`
    if (requestedUrl.current !== key) {
      debounced.cancel()
      if (inputRef.current) inputRef.current.value = initialQuery
    }
    requestedUrl.current = null
  }, [initialQuery, pathname, debounced])
  useEffect(() => () => debounced.cancel(), [debounced])
  function schedule(value: string) {
    setInvalid(false)
    debounced.cancel()
    if (composing.current) return
    const normalized = value.trim().replace(/\s+/g, ' ')
    if (normalized.length < 2) {
      navigate('')
      return
    }
    debounced(normalized)
  }
  const { listening, status, toggle } = useVoiceSearch((text) => {
    const value = text.slice(0, 200)
    if (inputRef.current) inputRef.current.value = value
    schedule(value)
    inputRef.current?.focus({ preventScroll: true })
  })
  function submit(event: FormEvent) {
    event.preventDefault()
    debounced.cancel()
    if (composing.current) return
    const value = (inputRef.current?.value ?? '').trim().replace(/\s+/g, ' ')
    if (value.length < 2) {
      setInvalid(true)
      inputRef.current?.focus()
      return
    }
    if (inputRef.current) inputRef.current.value = value
    navigate(value)
  }
  function onKeyDown(event: KeyboardEvent<HTMLFormElement>) {
    if (composing.current) return
    if (event.key === 'ArrowDown' || event.key === 'Escape') {
      event.preventDefault()
      const target =
        event.key === 'ArrowDown'
          ? (contentFocusTarget() ??
            document.querySelector<HTMLElement>(
              '[data-movie-card][data-catalog-focus]',
            ) ??
            document.querySelector<HTMLElement>('[data-movie-card]') ??
            document.getElementById('main-content'))
          : document.getElementById('main-content')
      target?.focus({ preventScroll: true })
      target?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
    } else if (
      event.key === 'ArrowRight' &&
      event.target === inputRef.current &&
      inputRef.current?.selectionEnd === inputRef.current?.value.length
    ) {
      event.preventDefault()
      microphoneRef.current?.focus()
    } else if (event.key === 'ArrowLeft') {
      if (event.target === microphoneRef.current) {
        event.preventDefault()
        inputRef.current?.focus()
      } else if (
        event.target === inputRef.current &&
        inputRef.current?.selectionStart === 0
      ) {
        event.preventDefault()
        focusSidebar()
      }
    }
  }
  return (
    <div className="min-w-0 flex-1">
      <form
        role="search"
        aria-label={messages.search.label}
        onSubmit={submit}
        onKeyDown={onKeyDown}
        className="flex min-w-0 items-center gap-3"
      >
        <TextInput
          ref={inputRef}
          data-catalog-search
          defaultValue={initialQuery}
          onChange={(event) => {
            schedule(event.currentTarget.value)
          }}
          onCompositionStart={() => {
            composing.current = true
            debounced.cancel()
          }}
          onCompositionEnd={(event) => {
            composing.current = false
            schedule(event.currentTarget.value)
          }}
          aria-label={messages.search.label}
          placeholder={messages.search.placeholder}
          name="q"
          type="search"
          autoComplete="off"
          maxLength={200}
          size="lg"
          radius="xl"
          variant="filled"
          leftSection={
            <ActionIcon
              type="submit"
              variant="subtle"
              color="gray"
              aria-label={messages.search.submit}
            >
              <IconSearch size={22} stroke={1.7} />
            </ActionIcon>
          }
          leftSectionPointerEvents="all"
          className="min-w-0 flex-1"
          classNames={{
            input:
              'placeholder:text-[var(--mantine-color-gray-6)] [[data-mantine-color-scheme=dark]_&]:placeholder:text-[var(--mantine-color-dark-1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          }}
        />
        <ActionIcon
          ref={microphoneRef}
          type="button"
          aria-label={listening ? messages.search.stop : messages.search.voice}
          aria-pressed={listening}
          onClick={toggle}
          size={48}
          radius="xl"
          variant={listening ? 'filled' : 'default'}
          color="lime"
          className="shrink-0 border-0! bg-[var(--mantine-color-gray-2)] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent [[data-mantine-color-scheme=dark]_&]:bg-[var(--mantine-color-dark-6)] aria-pressed:bg-accent! aria-pressed:text-black"
        >
          {listening ? (
            <IconPlayerStopFilled size={19} />
          ) : (
            <IconMicrophone size={23} stroke={1.7} />
          )}
        </ActionIcon>
      </form>
      {invalid && (
        <Text role="alert" size="sm" mt="xs">
          {messages.search.tooShort}
        </Text>
      )}
      {status && (
        <Text role="status" aria-live="polite" size="sm" mt="xs">
          {status}
        </Text>
      )}
    </div>
  )
}
function SearchWithQuery() {
  const params = useSearchParams()
  const query = params.get('q')?.slice(0, 200) ?? ''
  return <SearchForm initialQuery={query} />
}
export function CatalogSearch() {
  return (
    <Suspense
      fallback={
        <TextInput
          disabled
          aria-label={messages.search.label}
          placeholder={messages.search.placeholder}
          size="lg"
          radius="xl"
          variant="filled"
          className="min-w-0 flex-1"
        />
      }
    >
      <SearchWithQuery />
    </Suspense>
  )
}
