// Minimal provider-agnostic LLM client. OpenRouter by default; key from
// AFWar .env, process env, or the FlowZilla .env.local as a fallback
// (Todd's machine keeps keys there).

import { readFileSync, existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'

function loadEnvFile(path: string): Record<string, string> {
    if (!existsSync(path)) return {}
    return Object.fromEntries(
        readFileSync(path, 'utf8').split('\n')
            .filter(l => l.includes('=') && !l.startsWith('#'))
            .map(l => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()])
    )
}

const fallback = {
    ...loadEnvFile(join(homedir(), 'Documents/FlowZilla/flowzilla/.env.local')),
    ...loadEnvFile(join(homedir(), 'Documents/AFWar/.env')),
}

export const MODEL = process.env.AFWAR_MODEL ?? fallback.AFWAR_MODEL ?? 'anthropic/claude-sonnet-4.5'
const KEY = process.env.OPENROUTER_API_KEY ?? fallback.OPENROUTER_API_KEY

export interface LlmUsage { calls: number; inTokens: number; outTokens: number }
export const usage: LlmUsage = { calls: 0, inTokens: 0, outTokens: 0 }

export async function llm(system: string, user: string, maxTokens = 1800): Promise<string> {
    if (!KEY) throw new Error('OPENROUTER_API_KEY not found (env, AFWar/.env, or flowzilla/.env.local)')
    for (let attempt = 1; attempt <= 3; attempt++) {
        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: MODEL, max_tokens: maxTokens,
                messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
            }),
        })
        if (!res.ok) {
            if (attempt === 3) throw new Error(`LLM ${res.status}: ${(await res.text()).slice(0, 300)}`)
            await new Promise(r => setTimeout(r, attempt * 2000))
            continue
        }
        const body = await res.json() as { choices?: { message?: { content?: string } }[]; usage?: { prompt_tokens?: number; completion_tokens?: number } }
        usage.calls++
        usage.inTokens += body.usage?.prompt_tokens ?? 0
        usage.outTokens += body.usage?.completion_tokens ?? 0
        const text = body.choices?.[0]?.message?.content
        if (text) return text
        if (attempt === 3) throw new Error('LLM returned empty content')
    }
    throw new Error('unreachable')
}

/** Extract the first JSON object/array from a response that may include prose. */
export function extractJson<T>(text: string): T {
    const start = Math.min(...['{', '['].map(c => { const i = text.indexOf(c); return i < 0 ? Infinity : i }))
    if (!isFinite(start)) throw new Error('no JSON in response')
    const open = text[start], close = open === '{' ? '}' : ']'
    let depth = 0
    for (let i = start; i < text.length; i++) {
        if (text[i] === open) depth++
        if (text[i] === close) depth--
        if (depth === 0) return JSON.parse(text.slice(start, i + 1)) as T
    }
    throw new Error('unterminated JSON in response')
}

/** Run tasks with limited concurrency. */
export async function pool<T>(items: (() => Promise<T>)[], limit = 5): Promise<T[]> {
    const results: T[] = new Array(items.length)
    let next = 0
    async function worker() {
        while (next < items.length) {
            const i = next++
            results[i] = await items[i]()
        }
    }
    await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
    return results
}
