import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const android = fileURLToPath(new URL('../../android/', import.meta.url))
const gradle = process.platform === 'win32' ? 'gradlew.bat' : './gradlew'
const result = spawnSync(
  gradle,
  [
    'checkKotlinFormat',
    'testDebugUnitTest',
    'lintDebug',
    'verifyDebugWebAssets',
  ],
  {
    cwd: android,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  },
)
process.exit(result.status ?? 1)
