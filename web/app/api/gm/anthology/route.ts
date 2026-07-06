import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireGm } from "@/lib/role";
import { zoneById } from "@/lib/engine/map";
import type { MatchRow, Character, Season } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface Telling {
    pcId: string;
    title: string;
    prose: string;
}

// Season→Anthology compiler (schema-002 §7). Collects every match this
// season, ordered by round, and builds ONE markdown anthology: a cover
// block, then per-round chapters (Gazette recap + canon tellings + comic
// image links). Stored as an afwar_posts 'system' post AND saved to the
// 'sheets' storage bucket as anthology.md. Role-gated: GM only.
export async function POST() {
    const gate = await requireGm();
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const supabase = createServiceClient();
    if (!supabase) {
        return NextResponse.json({ error: "service role key needed" }, { status: 501 });
    }

    const { data: seasonRow, error: seasonErr } = await supabase
        .from("afwar_seasons")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
    if (seasonErr) return NextResponse.json({ error: seasonErr.message }, { status: 500 });
    if (!seasonRow) return NextResponse.json({ error: "no season found" }, { status: 404 });
    const season = seasonRow as Season;

    const { data: matchRows, error: matchesErr } = await supabase
        .from("afwar_matches")
        .select("*")
        .eq("season_id", season.id)
        .order("round", { ascending: true });
    if (matchesErr) return NextResponse.json({ error: matchesErr.message }, { status: 500 });
    const matches = (matchRows ?? []) as MatchRow[];

    const { data: gazetteRows } = await supabase
        .from("afwar_posts")
        .select("*")
        .eq("season_id", season.id)
        .eq("kind", "gazette")
        .order("round", { ascending: true });

    const charIds = Array.from(
        new Set(matches.flatMap((m) => [m.a_character, m.b_character]).filter((id): id is string => Boolean(id)))
    );
    const { data: charRows } = charIds.length
        ? await supabase.from("afwar_characters").select("id,name,clout,crew_id").in("id", charIds)
        : { data: [] as Pick<Character, "id" | "name" | "clout" | "crew_id">[] };
    const featuredChars = (charRows ?? []) as Pick<Character, "id" | "name" | "clout" | "crew_id">[];
    const names = new Map<string, string>(featuredChars.map((c) => [c.id, c.name]));

    const royaltyCrewIds = Array.from(new Set(featuredChars.map((c) => c.crew_id).filter((id): id is string => Boolean(id))));
    const { data: royaltyCrewRows } = royaltyCrewIds.length
        ? await supabase.from("afwar_crews").select("id,name").in("id", royaltyCrewIds)
        : { data: [] as { id: string; name: string }[] };
    const royaltyCrewNames = new Map<string, string>((royaltyCrewRows ?? []).map((c) => [c.id, c.name]));

    const byRound = new Map<number, MatchRow[]>();
    for (const m of matches) {
        if (!byRound.has(m.round)) byRound.set(m.round, []);
        byRound.get(m.round)!.push(m);
    }
    const gazetteByRound = new Map<number, string>();
    for (const g of gazetteRows ?? []) {
        if (g.round != null) gazetteByRound.set(g.round, g.body);
    }

    const rounds = Array.from(byRound.keys()).sort((a, b) => a - b);
    const lines: string[] = [];
    lines.push(`# ${season.name} — SEASON ANTHOLOGY`);
    lines.push("");
    lines.push(`*A continuity graph that writes itself — Hyper-Brooklyn, AF WAR.*`);
    lines.push("");
    lines.push(`Compiled ${new Date().toISOString().slice(0, 10)} · ${matches.length} matches across ${rounds.length} rounds.`);
    lines.push("");
    lines.push("---");

    for (const round of rounds) {
        lines.push("");
        lines.push(`## ROUND ${round}`);

        const gazette = gazetteByRound.get(round);
        if (gazette) {
            lines.push("");
            lines.push("### Hyper-Brooklyn Gazette");
            lines.push("");
            lines.push(gazette);
        }

        for (const m of byRound.get(round) ?? []) {
            const zone = (() => {
                try {
                    return zoneById(m.zone_id);
                } catch {
                    return { name: m.zone_id, blurb: "" };
                }
            })();
            const aName = m.a_character ? names.get(m.a_character) ?? m.a_character : "?";
            const bName = m.b_character ? names.get(m.b_character) ?? m.b_character : "?";
            const tellings = (m.tellings as Telling[] | null) ?? [];
            const verdict = m.verdict;
            const canon = verdict ? tellings.find((t) => t.pcId === verdict.canonPcId) : tellings[0];

            lines.push("");
            lines.push(`### ${aName} vs ${bName} — ${zone.name} (${m.stakes})`);
            if (canon) {
                lines.push("");
                lines.push(`**${canon.title}**`);
                lines.push("");
                lines.push(canon.prose);
            }
            const media = (m.media as { url?: string }[] | null) ?? [];
            const pageUrls = media.map((x) => x?.url).filter((u): u is string => Boolean(u));
            if (pageUrls.length) {
                lines.push("");
                lines.push("Comic pages:");
                for (const url of pageUrls) lines.push(`- ${url}`);
            }
        }
    }

    // ═══════════════════════════════════════════════════════════════════
    // CLOUT→ROYALTY TABLE (final polish round §2): every character who
    // appeared in >=1 canon telling this season gets a royaltyShare
    // proportional to their clout among the featured cast. This is the
    // §10c royalty split rendered as a real number — beta is play-money,
    // but the SHARE is the same math a real payout would use.
    // ═══════════════════════════════════════════════════════════════════
    const featuredCharIds = new Set<string>();
    for (const m of matches) {
        const tellings = (m.tellings as { pcId: string }[] | null) ?? [];
        const verdict = m.verdict;
        const canonPcId = verdict ? verdict.canonPcId : tellings[0]?.pcId;
        if (canonPcId) featuredCharIds.add(canonPcId);
    }
    const featured = featuredChars.filter((c) => featuredCharIds.has(c.id));
    const totalClout = featured.reduce((sum, c) => sum + Math.max(0, c.clout ?? 0), 0);
    const placements = featured
        .map((c) => ({
            name: c.name,
            crew: c.crew_id ? royaltyCrewNames.get(c.crew_id) ?? c.crew_id : "unaffiliated",
            clout: c.clout ?? 0,
            share: totalClout > 0 ? (Math.max(0, c.clout ?? 0) / totalClout) * 100 : 0,
        }))
        .sort((a, b) => b.clout - a.clout);

    const royaltyLines: string[] = [];
    royaltyLines.push("");
    royaltyLines.push("---");
    royaltyLines.push("");
    royaltyLines.push("## 📜 SEASON ROYALTY TABLE");
    royaltyLines.push("");
    royaltyLines.push(
        "Shares are the §10c royalty split for anthology/broadcast revenue. Beta: play-money; the number is real, the currency isn't yet."
    );
    royaltyLines.push("");
    if (placements.length) {
        royaltyLines.push("| Name | Crew | Clout | Share % |");
        royaltyLines.push("|---|---|---|---|");
        for (const p of placements) {
            royaltyLines.push(`| ${p.name} | ${p.crew} | ${p.clout} | ${p.share.toFixed(1)}% |`);
        }
    } else {
        royaltyLines.push("_No featured characters yet — no canon tellings this season._");
    }
    const royaltyMarkdown = royaltyLines.join("\n");
    lines.push(...royaltyLines);

    const markdown = lines.join("\n");

    const { data: insertedPost, error: postErr } = await supabase
        .from("afwar_posts")
        .insert({
            season_id: season.id,
            author_character: null,
            kind: "system",
            title: "📖 Season Anthology",
            body: markdown,
            media: [],
            round: null,
        })
        .select("id")
        .single();
    if (postErr) return NextResponse.json({ error: postErr.message }, { status: 500 });

    // ALSO post the royalty table as its own standalone system post so it's
    // discoverable in the feed without opening the full anthology.
    const { error: royaltyPostErr } = await supabase.from("afwar_posts").insert({
        season_id: season.id,
        author_character: null,
        kind: "system",
        title: "📜 Season Royalty Table",
        body: royaltyMarkdown,
        media: [],
        round: null,
    });
    if (royaltyPostErr) console.error("[gm/anthology] royalty post insert failed:", royaltyPostErr);

    let storagePath: string | null = null;
    try {
        const { error: uploadErr } = await supabase.storage
            .from("sheets")
            .upload(`anthologies/${season.id}/anthology.md`, markdown, {
                contentType: "text/markdown",
                upsert: true,
            });
        if (!uploadErr) storagePath = `anthologies/${season.id}/anthology.md`;
    } catch (e) {
        console.error("[gm/anthology] storage upload failed:", e);
    }

    return NextResponse.json({ postId: insertedPost?.id, rounds: rounds.length, matches: matches.length, storagePath });
}
