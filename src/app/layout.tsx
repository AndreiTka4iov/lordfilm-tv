import type { Metadata, Viewport } from 'next'
import type { ReactNode } from 'react'
import { ColorSchemeScript, mantineHtmlProps } from '@mantine/core'
import { MainLayout } from '@/core/layouts'
import { AppProviders } from '@/core/providers'
import { appConfig } from '@/shared/config'
import '@fontsource-variable/onest'
import '@mantine/core/styles.layer.css'
import '@/styles/globals.css'

// The native TV build uses overview scaling instead of Android's density-sized viewport.
// Omit initialScale so WebView can fit the full TV canvas to the display.
const nativeTvBuild = process.env.APP_NATIVE_TV === '1'
export const viewport: Viewport = nativeTvBuild
  ? { width: 1280, initialScale: undefined }
  : { width: 'device-width', initialScale: 1 }

export const metadata: Metadata = {
  title: { default: appConfig.name, template: `%s | ${appConfig.name}` },
  description: appConfig.description,
}
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="ru"
      className={
        nativeTvBuild
          ? '[text-size-adjust:100%] [-webkit-text-size-adjust:100%]'
          : undefined
      }
      {...mantineHtmlProps}
    >
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
