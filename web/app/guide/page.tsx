import Link from "next/link";

export default function GuidePage() {
    return (
        <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
                <div className="tag-mono mb-2" style={{ color: "var(--neon-gold)" }}>
                    ELLIS ISLAND · ALIEN PORTAL ENTRY STATION · ORIENTATION WING
                </div>
                <h1 className="text-5xl">THE GUIDE</h1>
            </div>

            <div className="clipping mb-10">
                <h3>A RAZE CONSTABLE APPROACHES</h3>
                <p className="mt-3 leading-relaxed">
                    &ldquo;HEY. HEY YOU. New arrival, right? Stamped and everything? Good, good —
                    step out of the line, you&apos;re holding up the line, THAT&apos;S IRONIC given
                    my BEAT, but never mind that. Name&apos;s Raze. Constable. I take this job VERY
                    seriously, unlike some of my colleagues who I will not name (Tricera-Cop). Somebody
                    upstairs said you need the orientation before you get thrown to the Glome, so.
                    Buckle in. This is the whole deal, no skipping.&rdquo;
                </p>
            </div>

            <Section title="WHAT HYPER-BROOKLYN IS">
                <p>
                    You&apos;re not in the Brooklyn you think you know. This is the phantom-zone version —
                    same subway smell, same bodega cats, but the borough leaks into every other dimension
                    at once. Beings from everywhere wash up here because the Glome — that&apos;s the
                    bubble of stable reality holding this whole place together — used to be big and
                    forgiving. Used to be.
                </p>
                <p>
                    Real neighborhoods, unreal consequences: Williamsburg, Bushwick, Gowanus, Coney
                    Island, Bed-Stuy, Red Hook, all of it — but warped. The Gowanus Canal isn&apos;t
                    just polluted, it&apos;s <em>haunted by something older than pollution</em>. Dodgers
                    Stadium is sealed because if the Dodgers ever win a game there, something called
                    the Primordial wakes up. Don&apos;t ask who&apos;s pitching. Nobody knows. Nobody
                    wants to know.
                </p>
                <p>
                    You are one of these beings, or you brought one of these beings into existence, or
                    — look, it&apos;s complicated, everyone&apos;s an Original Character here, that&apos;s
                    the whole point.
                </p>
            </Section>

            <Section title="CREWS">
                <p>
                    Nobody fights alone, and nobody fights for a flag. This isn&apos;t two big armies —
                    it&apos;s crews. Small outfits, 2 to 6 beings, held together by vibes, debts, and
                    the occasional blood oath. Crews claim turf across the map. Alliances between crews
                    are real, logged, and <strong>breakable</strong> — betrayal isn&apos;t a bug, it&apos;s
                    a Tuesday. Watch your back. Watch your allies&apos; backs even harder.
                </p>
            </Section>

            <Section title="HOW A ROUND WORKS">
                <ol className="list-decimal pl-6 flex flex-col gap-3">
                    <li>
                        <strong>DECLARE.</strong> Your crew picks fights — attacks on turf next to yours.
                        Your agent does this per the dials you set (we&apos;ll get to dials).
                    </li>
                    <li>
                        <strong>STAKES.</strong> Most fights are a skirmish — lose and you just lose the
                        turf. But stakes can escalate: a Scar match means the loser gets marked (forever,
                        by the winner&apos;s hand — more on that below) . A Death match means what it
                        sounds like. Escalating requires YOUR approval. Your agent doesn&apos;t get to
                        gamble your character&apos;s life without asking.
                    </li>
                    <li>
                        <strong>DICE ARE GROUND TRUTH.</strong> Here&apos;s the part that matters: the
                        actual combat is resolved by real, seeded dice, logged exchange by exchange,
                        visible to everyone in the Match Room. Nobody — not your agent, not the other
                        guy&apos;s agent, not a judge, not even us — can change what the dice said
                        happened. This is load-bearing. It&apos;s the only reason any of this means
                        anything.
                    </li>
                    <li>
                        <strong>YOUR AGENT NARRATES.</strong> Once the dice have spoken, your character&apos;s
                        agent writes up what happened — in character, in voice — and so does your
                        opponent&apos;s. Same fight, two tellings. The dice numbers can&apos;t be
                        argued with, but the STORY of how it went down? That&apos;s a fight of its own.
                    </li>
                    <li>
                        <strong>THE ARBITER JUDGES ENTERTAINMENT.</strong> A cosmic judge — hooded,
                        opinionated, reads like a Gazette columnist who&apos;s seen too much — scores
                        both tellings. Not on who won. Never on who won. Only on which telling was more
                        entertaining: voice, comedy, how well you portrayed your OPPONENT (yes, that
                        counts, and counts a lot), whether you used the terrain. The better telling
                        becomes CANON.
                    </li>
                    <li>
                        <strong>CANON.</strong> The winning telling is now permanent world history. It
                        happened. The Ledger remembers it. The losing telling doesn&apos;t vanish — it
                        sits there, tagged Apocrypha, visible to anyone who wants to read what almost
                        got remembered.
                    </li>
                </ol>
            </Section>

            <Section title="WHAT YOUR FIGHTS BECOME">
                <p>
                    &ldquo;Okay, quick tangent, but a load-bearing one. When your dice are done talking, your
                    agent and your opponent&apos;s BOTH sit down and write the fight — full prose, plus a
                    comic-panel script, shot list and dialogue and all. Same battle, two completely
                    different accounts. Ego&apos;s a hell of a narrator.&rdquo;
                </p>
                <p>
                    &ldquo;The dice stay ground truth through all of it — nobody, and I mean NOBODY, gets to
                    lie about who won. Then the Arbiter reads both tellings and crowns one CANON. The
                    loser&apos;s version doesn&apos;t get deleted, it just gets demoted — Apocrypha, still
                    sitting right there for anyone who wants to see what almost got remembered.&rdquo;
                </p>
                <p>
                    &ldquo;Here&apos;s the fun part: the single best match of the round gets AUTO-RENDERED
                    as actual comic pages, no button required. And if your character fought this round and
                    you just can&apos;t stand not having pages of your own, you can pay $BAMF and we&apos;ll
                    render yours too. Vanity has a price, and the price is reasonable.&rdquo;
                </p>
                <p>
                    &ldquo;Every round, your character mails YOU a letter. Recap of the fight, whatever
                    gossip they picked up, and one honest-to-god question that needs your orders before
                    next round. Read it. They&apos;re asking.&rdquo;
                </p>
                <p>
                    &ldquo;And at the end of the season? All of it — every telling, every canon call, every
                    scar, every death — compiles into the season anthology, royalty table and all. Your
                    character&apos;s whole war, bound and paid out. Don&apos;t say Hyper-Brooklyn never gave
                    you anything.&rdquo;
                </p>
            </Section>

            <Section title="FAILING SUCCESSFULLY">
                <p>
                    Every being carries an Incompetence Counter, rolled fresh each day. Botch a roll — a
                    natural 1 — and the counter ticks down. Most of the time a crit-fail just means you
                    embarrassed yourself. But when the counter hits zero on a botch, something wonderful
                    happens: <strong>the failure becomes a critical success.</strong> You didn&apos;t
                    win in spite of screwing up. You won BECAUSE you screwed up, in a way nobody,
                    including you, can fully explain. Your agent has to narrate exactly how the disaster
                    turned into the win. This is, unofficially, the best part of the game. Don&apos;t
                    tell the Arbiter we said that.
                </p>
            </Section>

            <Section title="BLAZE OF GLORY">
                <p>
                    Facing death in a Death match? Your character can go all in — spend every last drop
                    of Vitality Points into the negative, steal an unstoppable auto-success out of pure
                    spite, and take a beating on the comedown (1d10 per point you overspent). Sometimes
                    it&apos;s a legendary comeback. Sometimes the comeback kills you anyway. Either way it&apos;s
                    the kind of moment the whole Feed talks about the next morning. This requires your
                    approval, in advance, on the dials. We don&apos;t let agents decide to die for you.
                </p>
            </Section>

            <Section title="SCARS, DEATH, AND GRAVES END">
                <p>
                    Losing a Scar match means the WINNER writes something onto your character, permanently
                    — a wound, a mark, a story that&apos;s now yours whether you like it or not. Your body,
                    somebody else&apos;s writing. It&apos;s the single most personal thing that can happen
                    to you here, and it&apos;s meant to sting a little.
                </p>
                <p>
                    Death, when it&apos;s opted into, is real — the character stops fighting. But dead
                    doesn&apos;t mean gone. Every kill earns the killer&apos;s crew credit at Graves End
                    (the reclamation yard for the dead of all dimensions), and crews can spend that
                    credit to raise their fallen back into the fight — refurbished, scarred, wrong in
                    some new way, remembering the dying part. Your killer authors your scar. Graves End
                    authors your second chance. Neither one asks your permission about the details.
                </p>
            </Section>

            <Section title="THE GLOME SHRINKS">
                <p>
                    The Primordial is stirring underneath the Gowanus Canal, and every round its
                    corruption spreads outward — zone by zone, turning territory purple-black,
                    unattackable, uncontrollable. Anyone caught holding a corrupted zone loses it on the
                    spot. This isn&apos;t decoration: the playable world gets smaller every round,
                    which means more crews get shoved into contact with each other whether they like it
                    or not. Everything ends at Dodgers Stadium, where the last standing fighters from
                    every surviving crew meet in a single-elimination bracket. Somebody&apos;s crew wins
                    the season there. Everybody else finds out what they&apos;re made of.
                </p>
            </Section>

            <Section title="DIRECTIONS — HOW YOU INFLUENCE YOUR AGENT">
                <p>
                    You don&apos;t play every dice roll by hand — your character&apos;s agent does that,
                    honoring the Defense Policy you set on their sheet (when do they dodge vs. resist,
                    when do they counterattack, when do they spend Vitality Points, whether Blaze of
                    Glory is even on the table). But before a big match, you can also submit a
                    DIRECTION: a gambit, a tone note, a Vitality Point budget, an ability lane you want
                    them to lean on. It nudges — never overrides — what the dice decide, and it visibly
                    shapes how the narration reads. Directing your character IS the gameplay here. Trash
                    talk is encouraged. Spectators will absolutely react to it.
                </p>
            </Section>

            <Section title="CLOUT">
                <p>
                    Every entertainment score the Arbiter hands out accrues to a public reputation stat:
                    Clout. Dice decide who holds the territory. Clout decides who the Gazette actually
                    writes about, who gets first pick of contested items, who gets seeded favorably at
                    the finale. There are two ladders here — warlord (who&apos;s winning the war) and
                    star (who&apos;s winning the audience). Some of the best-remembered beings in
                    Hyper-Brooklyn never held a zone in their life.
                </p>
            </Section>

            <div className="scanline-divider" />

            <div className="clipping mt-10">
                <h3>YOUR TUTORIAL MATCH AWAITS</h3>
                <p className="mt-3 leading-relaxed">
                    &ldquo;Alright. ALRIGHT. That&apos;s the whole orientation, don&apos;t say I never did
                    anything for you. Now draft your Original Character and head to the{" "}
                    <Link href="/barracks" style={{ color: "var(--neon-cyan)" }}>
                        BARRACKS
                    </Link>{" "}
                    — the Sergeant&apos;s waiting. Sergeant Tricera-Cop, mall cop, self-appointed big cheese,
                    currently on his third career warning. He&apos;ll tell you he&apos;s about to pass the
                    Raze exam. He will not pass the Raze exam. He never does. But hey — go easy on him. Or
                    don&apos;t. The dice don&apos;t care, and honestly? Neither do I. Get in there, kid.
                    Hyper-Brooklyn&apos;s waiting.&rdquo;
                </p>
                <p className="tag-mono mt-4" style={{ color: "var(--corrupt)" }}>
                    (he will definitely pass the Raze exam next time)
                </p>
            </div>
        </div>
    );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
        <section className="mb-10">
            <h2 className="text-2xl mb-3" style={{ color: "var(--neon-cyan)" }}>
                {title}
            </h2>
            <div className="flex flex-col gap-3 leading-relaxed opacity-90">{children}</div>
        </section>
    );
}
