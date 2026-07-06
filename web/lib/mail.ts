// Outbound email via the Resend HTTP API (fetch only, no SDK dependency —
// growth-spec §0's channel decision). Gated entirely on RESEND_API_KEY,
// same pattern as resolveFalKey() in app/api/generate-sheet/route.ts: if the
// key is unset, sendMail() is a no-op that logs the would-be send and
// returns success, so the letter-writing cascade never breaks in dev/local
// or before Todd sets up a Resend account.
export interface SendMailInput {
    to: string;
    subject: string;
    text: string;
}

export interface SendMailResult {
    ok: boolean;
    error?: string;
    skipped?: boolean; // true when RESEND_API_KEY is unset (no-op path)
}

const DEFAULT_FROM = "AF WAR <letters@af-war.game>";

export async function sendMail(input: SendMailInput): Promise<SendMailResult> {
    const key = process.env.RESEND_API_KEY;
    const from = process.env.RESEND_FROM || DEFAULT_FROM;

    if (!key) {
        // No-op path: RESEND_API_KEY not configured. Document clearly (per
        // the brief) — this is expected in local/dev and before Todd sets
        // up a Resend account; letters still "send" from the game's POV
        // (the cascade proceeds), they just land in the server log instead
        // of an inbox.
        console.log(`[mail] RESEND_API_KEY not configured — no-op send: to=${input.to} from=${from} subject="${input.subject}"`);
        return { ok: true, skipped: true };
    }

    try {
        const res = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
                Authorization: `Bearer ${key}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from,
                to: [input.to],
                subject: input.subject,
                text: input.text,
            }),
        });
        if (!res.ok) {
            const body = await res.text().catch(() => "");
            return { ok: false, error: `Resend ${res.status}: ${body.slice(0, 300)}` };
        }
        return { ok: true };
    } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : "sendMail failed" };
    }
}
