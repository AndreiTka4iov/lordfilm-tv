import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import { MainLayout } from '@/core/layouts'
import { AppProviders } from '@/core/providers'
import { appConfig } from '@/shared/config'
import '@fontsource-variable/onest'
import '@mantine/core/styles.layer.css'
import '@/styles/globals.css'

export const metadata: Metadata = {
  title: { default: appConfig.name, template: `%s | ${appConfig.name}` },
  description: appConfig.description,
}
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ru" {...mantineHtmlProps}>
      <head>
        <ColorSchemeScript defaultColorScheme="dark" />
      </head>
      <body className="m-0 min-h-screen bg-[var(--mantine-color-body)] font-sans antialiased">
        <AppProviders>
          <MainLayout>{children}</MainLayout>
        </AppProviders>
      </body>
    </html>
  )
}
