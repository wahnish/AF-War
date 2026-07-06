import { createClient } from "@/lib/supabase/server";
import type { Character, Crew } from "@/lib/types";

interface InviteRow {
    id: string;
    code: string;
    inviter_id: string;
    crew_id: string | null;
    kind: string;
    invitee_name: string | null;
    comic_url: string | null;
    grudge: Record<string, unknown> | null;
    character_id: string | null;
    uses: number;
    max_uses: number;
    created_at: string;
}

export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
    const { code } = await params;
    const supabase = await createClient();

    const { data: inviteRow } = await supabase
        .from("afwar_invites")
        .select("*")
        .eq("code", code)
        .maybeSingle();
    const invite = inviteRow as InviteRow | null;

    if (!invite) {
        return (
            <div className="text-center py-24">
                <h1 className="text-4xl mb-3">INVITE NOT FOUND</h1>
                <p className="tag-mono opacity-60">This portal-link has expired or never existed.</p>
            </div>
        );
    }

    // Resolve the voicing character: explicit character_id, else the
    // inviter's first character with a model sheet.
    let character: Character | null = null;
    if (invite.character_id) {
        const { data } = await supabase.from("afwar_characters").select("*").eq("id", invite.character_id).maybeSingle();
        character = (data as Character) ?? null;
    }
    if (!character) {
        const { data } = await supabase
            .from("afwar_characters")
            .select("*")
            .eq("owner_id", invite.inviter_id)
            .not("model_sheet_url", "is", null)
            .order("created_at", { ascending: false })
            .limit(1);
        character = ((data as Character[]) ?? [])[0] ?? null;
    }

    let crew: (Crew & { memberCount?: number }) | null = null;
    if (invite.crew_id) {
        const [{ data: crewRow }, { count }] = await Promise.all([
            supabase.from("afwar_crews").select("*").eq("id", invite.crew_id).maybeSingle(),
            supabase.from("afwar_characters").select("id", { count: "exact", head: true }).eq("crew_id", invite.crew_id),
        ]);
        if (crewRow) crew = { ...(crewRow as Crew), memberCount: count ?? 0 };
    }

    const usedUp = invite.uses >= invite.max_uses;

    return (
        <div className="max-w-xl mx-auto">
            <div className="tag-mono mb-2 text-center" style={{ color: "var(--neon-gold)" }}>
                {invite.kind === "avenge" ? "A GRUDGE, INHERITED" : "YOU'VE BEEN NAMED"}
            </div>

            {invite.comic_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={invite.comic_url}
                    alt="invite panel"
                    className="w-full rounded-sm border mb-6"
                    style={{ borderColor: "var(--line-bright)" }}
                />
            ) : (
                <div className="clipping mb-6">
                    <h3>{character ? character.name : "Someone in Hyper-Brooklyn"} sent you this</h3>
                    <p className="mt-3 leading-relaxed">
                        {invite.invitee_name
                            ? `${character?.name ?? "Somebody"} named ${invite.invitee_name} for a reason they won't explain.`
                            : "A portal-link, no further explanation offered. That tracks."}
                    </p>
                </div>
            )}

            {character && (
                <div className="panel p-4 mb-6">
                    <h3 className="text-xl mb-1">{character.name}</h3>
                    {character.archetype && <p className="tag-mono opacity-70 mb-2">{character.archetype}</p>}
                    {character.bio && <p className="text-sm opacity-80 line-clamp-4">{character.bio}</p>}
                </div>
            )}

            {crew && (
                <div className="panel p-4 mb-6">
                    <h3 className="text-xl mb-1">{crew.name}</h3>
                    {crew.motto && <p className="tag-mono opacity-70 mb-2">{crew.motto}</p>}
                    <p className="tag-mono">
                        {crew.memberCount ?? 0}/{crew.max_size} slots
                        {(crew.memberCount ?? 0) >= crew.max_size ? " · FULL" : " · open"}
                    </p>
                </div>
            )}

            <div className="text-center">
                {usedUp ? (
                    <p className="tag-mono" style={{ color: "var(--blood)" }}>
                        This portal-link has been claimed too many times.
                    </p>
                ) : (
                    <a href={`/login?invite=${invite.code}`} className="btn btn-magenta w-full justify-center">
                        CLAIM YOUR APE PASS
                    </a>
                )}
            </div>
        </div>
    );
}
