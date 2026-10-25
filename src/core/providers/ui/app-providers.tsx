'use client'
import type { ReactNode } from 'react'
import { MantineProvider } from '@mantine/core'
import { theme, defaultColorScheme, cssVariablesResolver } from '@/shared/theme'
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <MantineProvider
      theme={theme}
      defaultColorScheme={defaultColorScheme}
      cssVariablesResolver={cssVariablesResolver}
    >
      {children}
    </MantineProvider>
  )
}
