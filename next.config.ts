import type { NextConfig } from 'next'

const isExport = process.env.APP_BUILD_TARGET === 'export'
const config: NextConfig = {
  output: isExport ? 'export' : 'standalone',
  distDir: isExport
    ? '.next-export'
    : process.env.NODE_ENV === 'development'
      ? '.next-dev'
      : '.next',
  trailingSlash: true,
  images: { unoptimized: isExport, remotePatterns: [] },
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: { optimizePackageImports: ['@mantine/core', '@mantine/hooks'] },
}
export default config
