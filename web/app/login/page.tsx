"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
    const [email, setEmail] = useState("");
    const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
    const [errorMsg, setErrorMsg] = useState("");

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        setStatus("sending");
        setErrorMsg("");
        const supabase = createClient();
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
                emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
        });
        if (error) {
            setStatus("error");
            setErrorMsg(error.message);
        } else {
            setStatus("sent");
        }
    }

    return (
        <div
            className="min-h-full flex items-center justify-center p-6"
            style={{
                background:
                    "radial-gradient(ellipse 1000px 700px at 50% -10%, rgba(107,31,176,0.3), transparent 60%), var(--void)",
            }}
        >
            <div className="w-full max-w-lg">
                <div className="text-center mb-8">
                    <div className="tag-mono mb-2" style={{ color: "var(--neon-gold)" }}>
                        ELLIS ISLAND · ALIEN PORTAL ENTRY STATION
                    </div>
                    <h1 className="wordmark text-5xl">AF WAR</h1>
                    <p className="tag-mono mt-2">Season 1: The Glome Weakens</p>
                </div>

                <div className="clipping" style={{ transform: "rotate(0.3deg)" }}>
                    <div className="tag-mono mb-2" style={{ color: "var(--corrupt)", opacity: 0.7 }}>
                        FORM APE-1 · CUSTOMS DECLARATION
                    </div>
                    <h3>APE PASS APPLICATION</h3>
                    <p className="my-3 leading-relaxed">
                        Present your credentials, being. Every dimension&apos;s queue funnels through
                        this checkpoint — the beehived, the reanimated, the merely mortal. State your
                        electronic mail address and a portal-link will be dispatched to your inbox.
                        Do not lose it. We do not print duplicates.
                    </p>

                    {status !== "sent" ? (
                        <form onSubmit={submit} className="mt-5 space-y-3">
                            <label className="field-label" style={{ color: "var(--corrupt)" }}>
                                Electronic Mail (all dimensions accepted)
                            </label>
                            <input
                                type="email"
                                required
                                placeholder="being@hyperbrooklyn.void"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{
                                    background: "#fff",
                                    color: "var(--ink)",
                                    border: "1px solid rgba(0,0,0,0.3)",
                                    fontFamily: "var(--font-tabloid)",
                                }}
                            />
                            <button
                                type="submit"
                                disabled={status === "sending"}
                                className="btn btn-magenta w-full justify-center"
                                style={{ marginTop: "0.5rem" }}
                            >
                                {status === "sending" ? "STAMPING DOCUMENTS…" : "REQUEST PORTAL-LINK"}
                            </button>
                            {status === "error" && (
                                <p className="tag-mono" style={{ color: "var(--blood)" }}>
                                    Customs rejects this filing: {errorMsg}
                                </p>
                            )}
                        </form>
                    ) : (
                        <div className="mt-5">
                            <p className="leading-relaxed">
                                <strong>Your portal-link has been dispatched.</strong> Check the mail
                                receptacle of the address provided. Click through to be stamped
                                ADMITTED. The constable behind you is very impatient and, frankly, a
                                little gullible — do not let him cut the line while you wait.
                            </p>
                        </div>
                    )}
                </div>

                <p className="tag-mono text-center mt-6 opacity-50">
                    new arrivals: read THE GUIDE after admission
                </p>
            </div>
        </div>
    );
}
