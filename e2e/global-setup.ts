import { execSync } from 'node:child_process'
import path from 'node:path'

export default function globalSetup() {
  execSync('bash setup-local.sh', {
    cwd: path.dirname(new URL(import.meta.url).pathname),
    stdio: 'inherit',
  })
}
