import { spawnSync } from 'node:child_process'

// Android uses the in-process native transport, never a web API URL from .env.
const result = spawnSync('npm', ['run', 'build:export'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, NEXT_PUBLIC_CATALOG_API_URL: '', APP_NATIVE_TV: '1' },
})
process.exit(result.status ?? 1)
