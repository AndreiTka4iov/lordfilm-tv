'use client'
import {
  Button,
  useComputedColorScheme,
  useMantineColorScheme,
} from '@mantine/core'
import { useMounted } from '@mantine/hooks'
import { messages } from '@/shared/locales'
export function ToggleColorScheme() {
  const scheme = useComputedColorScheme('dark', {
    getInitialValueInEffect: true,
  })
  const { setColorScheme } = useMantineColorScheme()
  const mounted = useMounted()
  const isDark = !mounted || scheme === 'dark'
  return (
    <Button
      variant="default"
      onClick={() => setColorScheme(isDark ? 'light' : 'dark')}
    >
      {isDark ? messages.lightTheme : messages.darkTheme}
    </Button>
  )
}
