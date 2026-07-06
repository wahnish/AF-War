import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { narrateDowntime } from "@/lib/agents/downtime";
import type { Character, Season } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 300;

function shuffle<T>(arr: T[]): T[] {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

// Downtime pass: a handful of random active characters post slice-of-life
// beats, with a chance of a reply from another active character. Purely
// flavor — no dice, no state mutation beyond afwar_posts. Tolerant of
// per-character LLM failures (skip and continue).
export async function POST() {
    const supabase = createServiceClient();
    if (!supabase) {
        return NextResponse.json({ error: "service role key needed" }, { status: 501 });
    }

    const { data: activeRows, error: charsErr } = await supabase
        .from("afwar_characters")
        .select("*")
        .eq("status", "active");
    if (charsErr) return NextResponse.json({ error: charsErr.message }, { status: 500 });

    const active = (activeRows ?? []) as Character[];
    if (active.length === 0) {
        return NextResponse.json({ posted: 0, replies: 0, note: "no active characters" });
    }

    const crewIds = Array.from(new Set(active.map((c) => c.crew_id).filter(Boolean))) as string[];
    const { data: crewRows } = crewIds.length
        ? await supabase.from("afwar_crews").select("id,name").in("id", crewIds)
        : { data: [] as { id: string; name: string }[] };
    const crewNames = new Map<string, string>((crewRows ?? []).map((c: { id: string; name: string }) => [c.id, c.name]));

    const { data: seasonRow } = await supabase
        .from("afwar_seasons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    const round = (seasonRow as Season | null)?.state?.round ?? null;

    const n = Math.min(active.length, 3 + Math.floor(Math.random() * 3)); // 3-5
    const chosen = shuffle(active).slice(0, n);

    let posted = 0;
    let replies = 0;

    for (const character of chosen) {
        try {
            const { title, body } = await narrateDowntime({
                name: character.name,
                bio: character.bio ?? "",
                voice_notes: character.voice_notes,
                scars: character.scars,
                crewName: character.crew_id ? crewNames.get(character.crew_id) : undefined,
            });

            const { error: insertErr } = await supabase.from("afwar_posts").insert({
                season_id: seasonRow?.id ?? null,
                author_character: character.id,
                kind: "downtime",
                title: `${character.name}: ${title}`,
                body,
                media: [],
                round,
            });
            if (insertErr) {
                console.error(`[gm/downtime] insert failed for ${character.name}:`, insertErr);
                continue;
            }
            posted++;

            // 30% chance of a reply from a different random active character
            if (Math.random() < 0.3) {
                const others = active.filter((c) => c.id !== character.id);
                if (others.length === 0) continue;
                const replier = shuffle(others)[0];
                try {
                    const reply = await narrateDowntime(
                        {
                            name: replier.name,
                            bio: replier.bio ?? "",
                            voice_notes: replier.voice_notes,
                            scars: replier.scars,
                            crewName: replier.crew_id ? crewNames.get(replier.crew_id) : undefined,
                        },
                        `${title}: ${body}`
                    );
                    const { error: replyErr } = await supabase.from("afwar_posts").insert({
                        season_id: seasonRow?.id ?? null,
                        author_character: replier.id,
                        kind: "downtime",
                        title: `${replier.name}: ${reply.title}`,
                        body: `↪ re: ${title}\n\n${reply.body}`,
                        media: [],
                        round,
                    });
                    if (replyErr) {
                        console.error(`[gm/downtime] reply insert failed for ${replier.name}:`, replyErr);
                        continue;
                    }
                    replies++;
                } catch (e) {
                    console.error(`[gm/downtime] reply narration failed for ${replier.name}:`, e);
                }
            }
        } catch (e) {
            console.error(`[gm/downtime] narration failed for ${character.name}:`, e);
        }
    }

    return NextResponse.json({ posted, replies });
}
