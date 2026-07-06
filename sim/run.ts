// AF WAR — simulated mini-season. Engine plays; agents narrate; the bundle in
// sim/out/ is the probe Todd reads. AFWAR_DRY=1 skips all LLM calls (engine
// + maps + ledger only, $0).

import { mkdirSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeRng } from '../engine/rng.js'
import { ZONES, zoneById } from '../engine/map.js'
import {
    setupSeason, playRound, playConvergence, heuristicIntent,
    SeasonConfig, SeasonState, RoundIntent, RoundReport,
} from '../engine/season.js'
import { ITEMS, MatchResult } from '../engine/match.js'
import { CAST, CREWS } from '../agents/cast.js'
import { narrateMatch, judgeMatch, gazetteRecap, Telling, Verdict } from '../agents/narrate.js'
import { pool, usage, MODEL } from '../agents/llm.js'

const DRY = process.env.AFWAR_DRY === '1'
const OUT = join(dirname(fileURLToPath(import.meta.url)), 'out')
mkdirSync(OUT, { recursive: true })

const CFG: SeasonConfig = {
    seed: process.env.AFWAR_SEED ?? 'season-1-hyper-brooklyn',
    crews: CREWS,
    pcs: CAST,
    rounds: 4,
    corruptionPerRound: { 2: 1, 3: 2, 4: 3 },
    startingItems: { 'gowanus': 'black-mayo-blade', 'awful-waffle': 'hypno-waffle', 'hinterlands': 'landwaster' },
}

// ── zone layout for the SVG map (hand-placed, roughly geographic) ──────────
const POS: Record<string, [number, number]> = {
    'ellis-island': [80, 60], 'the-heights': [230, 90], 'stax': [330, 160], 'gowanus': [400, 250],
    'nuhart': [330, 340], 'graves-end': [470, 350], 'the-nest': [560, 260], 'bazaar': [340, 60],
    'wormhole': [470, 100], 'awful-waffle': [560, 160], 'arcades': [230, 180], 'chrono-bowl': [470, 180],
    'pink-flamingo': [650, 200], 'coney': [700, 320], 'fringe': [760, 420], 'hinterlands': [560, 440],
    'edb': [680, 480], 'hellmouth': [620, 360], 'af-hq': [520, 300], 'dodgers': [590, 60], 'monorail': [120, 480],
}
const CREW_COLOR: Record<string, string> = {
    'elder-zombies': '#8soy', 'commandos': '#d9532b', 'rescue-squad': '#3d7bd9',
    'syndicate': '#c9a227', 'regulars': '#4caf7d',
}
CREW_COLOR['elder-zombies'] = '#9b59b6'

function svgMap(s: SeasonState, round: number): string {
    const lines: string[] = []
    const drawn = new Set<string>()
    for (const z of ZONES) for (const adj of z.adjacent) {
        const key = [z.id, adj].sort().join('|')
        if (drawn.has(key)) continue
        drawn.add(key)
        const [x1, y1] = POS[z.id], [x2, y2] = POS[adj]
        lines.push(`<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#333" stroke-width="1.5"/>`)
    }
    const nodes = ZONES.map(z => {
        const st = s.zones.get(z.id)!
        const [x, y] = POS[z.id]
        const fill = st.corrupted ? '#1a0a1e' : st.controlledBy ? CREW_COLOR[st.controlledBy] : '#2b2b33'
        const stroke = z.finale ? '#ffd700' : st.corrupted ? '#7a1fa2' : '#555'
        const label = z.name.length > 18 ? z.name.slice(0, 17) + '…' : z.name
        return `<circle cx="${x}" cy="${y}" r="17" fill="${fill}" stroke="${stroke}" stroke-width="2.5"/>
<text x="${x}" y="${y + 31}" font-size="10" fill="#ccc" text-anchor="middle" font-family="monospace">${label}</text>${st.corrupted ? `<text x="${x}" y="${y + 4}" font-size="12" text-anchor="middle">☠</text>` : ''}${st.itemOnGround ? `<text x="${x}" y="${y + 5}" font-size="11" text-anchor="middle">⚔</text>` : ''}`
    })
    const legend = CREWS.map((c, i) =>
        `<circle cx="20" cy="${560 + i * 18}" r="6" fill="${CREW_COLOR[c.id]}"/><text x="32" y="${564 + i * 18}" font-size="11" fill="#ccc" font-family="monospace">${c.name}</text>`)
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 840 660" style="background:#15151c">
<text x="20" y="30" font-size="18" fill="#eee" font-family="monospace">HYPER-BROOKLYN — ROUND ${round}</text>
${lines.join('\n')}\n${nodes.join('\n')}\n${legend.join('\n')}
<text x="20" y="545" font-size="11" fill="#7a1fa2" font-family="monospace">☠ = Primordial corruption   ⚔ = cursed item   gold ring = the Stadium</text>
</svg>`
}

// ── scripted season drama (alliance + the Cobalt Fox betrayal) ──────────────
function seasonIntent(s: SeasonState, round: number): RoundIntent {
    const rng = makeRng(CFG.seed + ':intent:' + round)
    const intent = heuristicIntent(s, rng)
    // sim spice: crews send a SECOND fighter, preferring enemy-held turf — the
    // probe wants contested matches, not just land grabs
    for (const crew of CREWS) {
        const c = s.crews.get(crew.id)!
        if (c.eliminated) continue
        const used = new Set(intent.attacks.filter(a => a.crewId === crew.id).map(a => a.pcId))
        const fighters = CAST.filter(p => p.crewId === crew.id && s.pcs.get(p.id)!.status === 'active' && !used.has(p.id))
        if (!fighters.length) continue
        const targets = [...s.zones.entries()]
            .filter(([zid, z]) => z.controlledBy && z.controlledBy !== crew.id && !c.alliances.includes(z.controlledBy!) && !z.corrupted)
            .map(([zid]) => zid)
            .filter(zid => {
                const reach = c.zones.some(own => zoneById(own).adjacent.includes(zid) || (own === 'monorail' && zoneById('monorail').adjacent.includes(zid)))
                return reach && !intent.attacks.some(a => a.targetZone === zid)
            })
        if (targets.length) {
            const stakes = rng() < 0.2 ? 'scar' as const : rng() < 0.1 ? 'death' as const : 'skirmish' as const
            intent.attacks.push({ crewId: crew.id, pcId: fighters[0].id, targetZone: targets[Math.floor(rng() * targets.length)], stakes })
        }
    }
    if (round === 2) {
        // the Syndicate and the Rescue Squad cut a deal (Cobalt Fox always cuts deals)
        intent.allianceProposals.push(['syndicate', 'rescue-squad'], ['rescue-squad', 'syndicate'])
    }
    if (round === 4) {
        // Cobalt Fox is a double agent in 8 dimensions. Make it 9.
        const syndicateZone = s.crews.get('syndicate')!.zones[0]
        const fox = s.pcs.get('cobalt-fox')
        if (syndicateZone && fox?.status === 'active') {
            intent.attacks = intent.attacks.filter(a => a.crewId !== 'rescue-squad')
            intent.attacks.push({ crewId: 'rescue-squad', pcId: 'cobalt-fox', targetZone: syndicateZone, stakes: 'skirmish' })
        }
    }
    return intent
}

// ── main ────────────────────────────────────────────────────────────────────
const names = new Map<string, string>()
for (const p of CAST) names.set(p.id, p.name)
for (const c of CREWS) names.set(c.id, c.name)
for (const z of ZONES) names.set(z.id, z.name)
for (const i of ITEMS) names.set(i.id, i.name)

interface MatchRoom { round: number; result: MatchResult; tellings: Telling[]; verdict?: Verdict }

async function main() {
    console.log(`AF WAR sim — seed=${CFG.seed} dry=${DRY} model=${DRY ? 'n/a' : MODEL}`)
    const s = setupSeason(CFG)
    const rooms: MatchRoom[] = []
    const recaps: string[] = []
    const maps: string[] = []
    const reports: RoundReport[] = []

    const allRounds: RoundReport[] = []
    for (let r = 1; r <= CFG.rounds; r++) {
        const rep = playRound(s, seasonIntent(s, r))
        allRounds.push(rep)
        maps.push(svgMap(s, r))
        writeFileSync(join(OUT, `map-round-${r}.svg`), maps[maps.length - 1])
        console.log(`round ${r}: ${rep.matches.length} matches, ${rep.corrupted.length} zones corrupted, events=${rep.events.length}`)
    }
    const finale = playConvergence(s)
    allRounds.push(finale)
    writeFileSync(join(OUT, `map-finale.svg`), svgMap(s, s.round))
    console.log(`finale: ${finale.matches.length} matches — champion crew: ${names.get(s.finaleWinner!)}`)

    // narrate everything (or skip in DRY)
    if (!DRY) {
        for (const rep of allRounds) {
            const tasks = rep.matches.map(m => async () => {
                const a = CAST.find(p => p.id === m.a)!, b = CAST.find(p => p.id === m.b)!
                const [ta, tb] = await Promise.all([
                    narrateMatch(a, b, m, rep.round), narrateMatch(b, a, m, rep.round),
                ])
                const verdict = await judgeMatch(ta, tb, m, a.name, b.name)
                rooms.push({ round: rep.round, result: m, tellings: [ta, tb], verdict })
            })
            await pool(tasks, 4)
            const recap = await gazetteRecap(rep.round, rep.events, names)
            recaps.push(`\n\n---\n\n## 📰 ROUND ${rep.round}${rep === finale ? ' — THE CONVERGENCE' : ''}\n\n${recap}`)
            // durable write after EVERY round — a downstream crash must never lose paid narration
            writeFileSync(join(OUT, 'rooms.json'), JSON.stringify(rooms, null, 2))
            writeFileSync(join(OUT, 'recaps.json'), JSON.stringify(recaps, null, 2))
            console.log(`round ${rep.round} narrated (${rep.matches.length} matches) — llm calls so far: ${usage.calls}`)
        }
    }

    // ── the bundle ──
    // Ledger
    const fallen = s.canon.filter(e => e.kind === 'death') as Extract<typeof s.canon[number], { kind: 'death' }>[]
    const marked = s.canon.filter(e => e.kind === 'scar') as Extract<typeof s.canon[number], { kind: 'scar' }>[]
    const raised = s.canon.filter(e => e.kind === 'resurrection') as Extract<typeof s.canon[number], { kind: 'resurrection' }>[]
    const kills = [...s.pcs.values()].filter(p => p.kills > 0).sort((x, y) => y.kills - x.kills)
    const ledger = `# ⚖ THE LEDGER — Season 1: The Glome Weakens

## Final Standing
${Object.entries(allRounds[allRounds.length - 1].scores).sort((a, b) => b[1] - a[1]).map(([c, pts], i) => `${i + 1}. **${names.get(c)}** — ${pts} pts${c === s.finaleWinner ? ' 👑 CHAMPION' : ''}`).join('\n')}

## Leaderboard (kills)
${kills.length ? kills.map(p => `- **${p.name}** (${names.get(p.crewId)}) — ${p.kills}`).join('\n') : '_No kills this season. The Glome is disappointed._'}

## The Fallen ☠
${fallen.length ? fallen.map(e => `- R${e.round}: **${names.get(e.pcId)}** — killed by ${names.get(e.killedBy)} at ${names.get(e.zoneId)}`).join('\n') : '_Nobody died. Everybody\'s furious about it._'}

## The Marked ⚔
${marked.length ? marked.map(e => `- R${e.round}: **${names.get(e.pcId)}** — scar authored by ${names.get(e.authoredBy)} at ${names.get(e.zoneId)}`).join('\n') : '_Not a scratch worth writing down._'}

## The Raised ↩
${raised.length ? raised.map(e => `- R${e.round}: **${names.get(e.pcId)}** — refurbished at Graves End by ${names.get(e.byCrew)} (${e.cost} credits)`).join('\n') : '_Graves End reports no customers. Business is bad._'}

## Betrayals 🗡
${s.canon.filter(e => e.kind === 'betrayal').map(e => `- R${(e as any).round}: **${names.get((e as any).traitor)}** turned on **${names.get((e as any).victim)}** at ${names.get((e as any).zoneId)}`).join('\n') || '_Honor among thieves held. Weird._'}
`
    writeFileSync(join(OUT, 'ledger.md'), ledger)

    // Match rooms
    for (const room of rooms.sort((a, b) => a.round - b.round)) {
        const m = room.result
        const fn = `match-r${room.round}-${m.a}-vs-${m.b}.md`
        const dice = m.exchanges.map(e =>
            `| ${e.n} | ${names.get(e.attacker)} ${e.attackAbility} → ${e.attackRoll.rolls.join('+')}${e.powerUsed ? ` +${e.powerUsed.name}(${e.powerUsed.bonus.total})` : ''} = **${e.attackRoll.total + (e.powerUsed?.bonus.total ?? 0)}** | ${e.defenseMode} ${e.counterRoll ? e.counterRoll.total : e.defenseRoll.total} | ${names.get(e.winner)} | ${e.damage}${e.note ? ` — _${e.note}_` : ''} |`
        ).join('\n')
        const canonTelling = room.tellings.find(t => t.pcId === room.verdict?.canonPcId)
        const md = `# R${room.round} — ${names.get(m.a)} vs ${names.get(m.b)} @ ${names.get(m.zoneId)}
**Stakes:** ${m.stakes} · **Winner (dice):** ${names.get(m.winner)}${m.blaze ? ` · **BLAZE OF GLORY** by ${names.get(m.blaze.who)} — ${m.blaze.died ? 'DIED IN THE ATTEMPT' : 'STOLE THE MATCH'}` : ''}

## Dice Transcript (ground truth)
| # | Attack | Defense | Exchange Winner | Dmg |
|---|---|---|---|---|
${dice}

${room.tellings.map(t => `## ${t.pcId === room.verdict?.canonPcId ? '✅ CANON — ' : '📜 Apocrypha — '}"${t.title}" (${names.get(t.pcId)}'s telling)
${t.prose}

<details><summary>Comic script (${(t.panels ?? []).length} panels)</summary>

${(t.panels ?? []).map(p => `**Panel ${p.n}** [${p.shot}] ${p.description}${p.sfx ? ` _SFX: ${p.sfx}_` : ''}
${(p.dialogue ?? []).map(d => `> ${d.speaker} (${d.kind}): "${d.text}"`).join('\n')}`).join('\n\n')}
</details>`).join('\n\n')}

## ⚖ The Arbiter's Verdict
${room.verdict ? `Scores: ${Object.entries(room.verdict.scores).map(([id, sc]) => `${names.get(id)} **${sc}/10**`).join(' · ')}

> ${room.verdict.critique}` : '_unjudged (dry run)_'}
`
        writeFileSync(join(OUT, fn), md)
    }

    // Feed
    const feed = `# AF WAR — SEASON 1 FEED
_The Glome weakens. The Primordial stirs beneath the Gowanus. Five crews fight over what's left._

**Cast:** ${CREWS.map(c => `**${c.name}** ("${c.motto}") — ${CAST.filter(p => p.crewId === c.id).map(p => p.name).join(', ')}`).join(' · ')}
${recaps.join('\n')}

---

_Match rooms: ${rooms.length ? rooms.map(r => `match-r${r.round}-${r.result.a}-vs-${r.result.b}.md`).join(' · ') : 'dry run — engine transcripts only'}_
_Champion: **${names.get(s.finaleWinner!)}**_
`
    writeFileSync(join(OUT, 'feed.md'), feed)

    // raw canon for debugging/vault
    writeFileSync(join(OUT, 'canon.json'), JSON.stringify(s.canon, null, 2))
    writeFileSync(join(OUT, 'rooms.json'), JSON.stringify(rooms, null, 2))

    console.log(`\nBundle written to sim/out/ — feed.md, ledger.md, ${rooms.length} match rooms, ${CFG.rounds + 1} maps`)
    if (!DRY) console.log(`LLM usage: ${usage.calls} calls, ${usage.inTokens} in / ${usage.outTokens} out tokens (${MODEL})`)
}

main().catch(e => { console.error(e); process.exit(1) })
