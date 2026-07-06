// predev/prebuild: copies the pure-TS AF WAR engine into web/lib/engine/.
// Why a copy instead of a relative import out of web/: Next.js's build
// (both webpack and Turbopack) roots module resolution and its TS/ESLint
// project at the app dir; importing '../../engine/season.ts' from outside
// the Next project directory works in dev but is unreliable for `next build`
// output tracing (files outside the project root aren't guaranteed to be
// included in the standalone/serverless bundle). Copying is simple, keeps
// the engine as the single source of truth (this script re-syncs on every
// dev/build), and matches the brief's documented choice.
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const SRC = join(HERE, '../../engine')
const DEST = join(HERE, '../lib/engine')

const FILES = ['rng.ts', 'dice.ts', 'map.ts', 'match.ts', 'season.ts']

mkdirSync(DEST, { recursive: true })

for (const file of FILES) {
    const srcPath = join(SRC, file)
    if (!existsSync(srcPath)) {
        console.error(`[sync-engine] missing ${srcPath} — skipping`)
        continue
    }
    // strip the .js extension from relative import specifiers ('./rng.js' -> './rng')
    // so the copy resolves cleanly under Next's TS module resolution.
    const src = readFileSync(srcPath, 'utf8')
    const rewritten = src.replace(
        /from\s+'(\.\.?\/[^']+)\.js'/g,
        "from '$1'"
    )
    writeFileSync(join(DEST, file), rewritten)
}

console.log(`[sync-engine] copied ${FILES.length} engine files -> web/lib/engine/`)
