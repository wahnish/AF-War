-- AF WAR — sample feed posts so the Feed isn't empty before Season 1 kicks off.
-- Paste into the Supabase SQL editor AFTER db/schema.sql (repo root).
-- These are unattached to any season (season_id null) — the Feed shows them
-- regardless of whether an afwar_seasons row exists yet.

insert into afwar_posts (season_id, author_character, kind, title, body, media, round)
values
(
    null, null, 'gazette',
    'THE GLOME WEAKENS: PRIMORDIAL STIRRINGS REPORTED BENEATH THE GOWANUS',
    E'HYPER-BROOKLYN GAZETTE\n"All The News That Bleeds Through Dimensions"\n\n' ||
    E'GOWANUS CANAL, DAWN — Sanitation officials confirm what everyone already smelled: the Black Mayonnaise has started pulsing again. ' ||
    E'Residents report the canal is "roughly 40% more sentient than usual," with localized reality dissolution expected through the week. ' ||
    E'The Glome — the bubble of stable reality holding this borough together — is, per Ellis Island customs officials, "definitely getting smaller, please do not panic, please form an orderly line."\n\n' ||
    E'WEATHER — Corruption spreading steadily outward from the Gowanus. Expect geometric impossibilities with a chance of tentacles by evening. Bring an umbrella; physics optional.',
    '[]'::jsonb, null
),
(
    null, null, 'system',
    'WELCOME, BEING — SEASON 1 BEGINS',
    E'Your APE Pass has cleared customs. You are now a resident of Hyper-Brooklyn, and — congratulations, or condolences — a participant in Season 1: The Glome Weakens.\n\n' ||
    E'Head to the BARRACKS to draft your Original Character. Read THE GUIDE if you haven''t (a Raze constable will walk you through it, badly). ' ||
    E'Once your crew is seeded, watch THE MAP and THE FEED — the war does not wait for you to be ready. Dice are ground truth. Your agent narrates. The Arbiter judges entertainment, never outcomes. ' ||
    E'Your story becomes canon, or it becomes apocrypha. Either way, it gets written down.\n\n' ||
    E'Good luck. Don''t trust the waffles.',
    '[]'::jsonb, null
),
(
    null, null, 'downtime',
    'off duty (allegedly)',
    E'so a guy asked me today if I''d passed the Raze exam yet and I said "you know what, FUNNY story" and then I told him about the time I definitely, for sure, no question, aced the written portion. ' ||
    E'anyway I''m still doing rounds at The Fringe. it''s not even really my beat. nobody has confirmed what my beat is. I have a belt-monitor that shows calming imagery until someone gets close and then it just plays ads. ' ||
    E'saw something weird near the static line tonight, filed a report, report immediately got eaten by a temporal fold, whatever, not my problem, that''s a Robot Repair Mall problem. ' ||
    E'anyway. big week coming. can feel it. Dino Might is ready. I am ready. I will DEFINITELY pass the Raze exam next time.',
    '[]'::jsonb, null
)
on conflict do nothing;
