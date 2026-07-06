// AF WAR auto-comic — the Yachimat pattern, minimal v1:
//   1. pick the featured match from sim/out/rooms.json (arbiter's highest-scored
//      canon telling; death matches win ties)
//   2. generate a MODEL SHEET per combatant (NB2 t2i — the character profile's
//      visual anchor; in the real product directors upload/curate these)
//   3. generate whole comic PAGES with both sheets as refs
//      (fal-ai/nano-banana-2/edit + image_urls — the shape FlowZilla comics
//      Phase B verified live 2026-07-02), panels + balloons described per the
//      comic-grammar JSON
//   4. save PNGs to sim/out/comic/
// Self-check/regenerate loop = follow-up (done > perfect).
// Cost: ~4 NB2 calls ≈ $0.16.

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { fal } from '@fal-ai/client'
import { CAST } from '../agents/cast.js'
import { zoneById } from '../engine/map.js'
import type { ComicPanel, Telling, Verdict } from '../agents/narrate.js'
import type { MatchResult } from '../engine/match.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const OUT = join(HERE, '../sim/out')
const COMIC_OUT = join(OUT, 'comic')
mkdirSync(COMIC_OUT, { recursive: true })

// FAL_KEY from env or the FlowZilla .env.local
function envFrom(path: string): Record<string, string> {
    if (!existsSync(path)) return {}
    return Object.fromEntries(readFileSync(path, 'utf8').split('\n')
        .filter(l => l.includes('=') && !l.startsWith('#'))
        .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]))
}
const FAL_KEY = process.env.FAL_KEY ?? envFrom(join(homedir(), 'Documents/FlowZilla/flowzilla/.env.local')).FAL_KEY
if (!FAL_KEY) throw new Error('FAL_KEY not found')
fal.config({ credentials: FAL_KEY })

const STYLE = 'Gritty 1990s American comic book art, bold confident inks, flat colors with neon accents, retro-futuristic Hyper-Brooklyn (Venture-Brothers-adjacent adult animation energy played straight). Halftone texture, dramatic lighting.'

interface Room { round: number; result: MatchResult; tellings: Telling[]; verdict?: Verdict }

async function nb2(prompt: string, refs: string[] = [], aspect = '2:3'): Promise<string> {
    const slug = refs.length ? 'fal-ai/nano-banana-2/edit' : 'fal-ai/nano-banana-2'
    const input: Record<string, unknown> = { prompt, aspect_ratio: aspect }
    if (refs.length) input.image_urls = refs
    const result = await fal.subscribe(slug, { input: input as never }) as { data?: { images?: { url: string }[] } }
    const url = result.data?.images?.[0]?.url
    if (!url) throw new Error(`no image from ${slug}`)
    return url
}

async function save(url: string, name: string): Promise<string> {
    const res = await fetch(url)
    const buf = Buffer.from(await res.arrayBuffer())
    const p = join(COMIC_OUT, name)
    writeFileSync(p, buf)
    return p
}

function pagePrompt(panels: ComicPanel[], pageNo: number, totalPages: number, zoneBlurb: string): string {
    const rows = panels.map(p => {
        const dialogue = p.dialogue.map(d =>
            d.kind === 'caption' ? `caption box: "${d.text}"`
                : `${d.kind === 'shout' ? 'jagged shout balloon' : d.kind === 'thought' ? 'thought bubble' : 'speech balloon'} from ${d.speaker}: "${d.text}"`
        ).join('; ')
        return `PANEL ${p.n} (${p.shot}): ${p.description}${p.sfx ? ` Large hand-lettered SFX: "${p.sfx}".` : ''} ${dialogue}`
    }).join('\n')
    return `A single complete COMIC BOOK PAGE (page ${pageNo} of ${totalPages}), ${panels.length} panels in a clean grid with black gutters, lettered speech balloons with legible text exactly as written.
SETTING: ${zoneBlurb}
${rows}
STYLE: ${STYLE}
The two main characters MUST match the reference images exactly (costume, silhouette, colors).`
}

async function main() {
    const rooms = JSON.parse(readFileSync(join(OUT, 'rooms.json'), 'utf8')) as Room[]
    if (!rooms.length) throw new Error('no match rooms — run the narrated sim first')

    // featured match: death stakes first, then highest arbiter score
    const scored = rooms.filter(r => r.verdict).sort((a, b) => {
        const death = Number(b.result.stakes === 'death') - Number(a.result.stakes === 'death')
        if (death) return death
        const max = (r: Room) => Math.max(...Object.values(r.verdict!.scores))
        return max(b) - max(a)
    })
    const room = scored[0]
    const canon = room.tellings.find(t => t.pcId === room.verdict!.canonPcId)!
    const a = CAST.find(p => p.id === room.result.a)!
    const b = CAST.find(p => p.id === room.result.b)!
    const zone = zoneById(room.result.zoneId)
    console.log(`Featured: R${room.round} ${a.name} vs ${b.name} @ ${zone.name} — canon: "${canon.title}" (${canon.panels.length} panels)`)

    // 1) model sheets
    console.log('generating model sheets…')
    const [sheetA, sheetB] = await Promise.all([a, b].map(pc =>
        nb2(`Character model sheet, single character, full body, neutral pose plus head close-up: ${pc.name} — ${pc.modelSheetHint}. ${STYLE} Plain background.`, [], '1:1')))
    await save(sheetA, `sheet-${a.id}.png`)
    await save(sheetB, `sheet-${b.id}.png`)

    // 2) pages (4 panels per page)
    const chunks: ComicPanel[][] = []
    for (let i = 0; i < canon.panels.length; i += 4) chunks.push(canon.panels.slice(i, i + 4))
    console.log(`generating ${chunks.length} pages…`)
    for (let i = 0; i < chunks.length; i++) {
        const url = await nb2(pagePrompt(chunks[i], i + 1, chunks.length, zone.blurb), [sheetA, sheetB])
        await save(url, `page-${i + 1}.png`)
        console.log(`  page ${i + 1}/${chunks.length} ✓`)
    }

    writeFileSync(join(COMIC_OUT, 'README.md'),
        `# "${canon.title}"\nR${room.round} — ${a.name} vs ${b.name} @ ${zone.name} (${room.result.stakes})\nCanon telling by ${canon.pcId}; ${canon.panels.length} panels over ${chunks.length} pages.\nModel sheets + pages generated via fal-ai/nano-banana-2 (${STYLE.slice(0, 60)}…)\n`)
    console.log(`done — sim/out/comic/ (${chunks.length} pages + 2 sheets)`)
}

main().catch(e => { console.error(e); process.exit(1) })
