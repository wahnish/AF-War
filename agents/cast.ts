// Season 1 cast — real AF characters from docs/lore/af-character-bible.md.
// RULING R15: card stats (0-100 Speed/Defense/Agility/Magic/Intelligence) map to
// AF abilities Speed→STR, Defense→END, Agility→DEX, Magic→CHA, Intelligence→INT;
// the five scores are RANKED and assigned the starting array d10/d8/d6/d6/d4
// (R1) — relative build, not absolute numbers. Attack ability = highest mapped
// stat. Power level ≈ card Points + 2 (Rare 1pt → L3 ... Legendary 8pt → L10).

import type { PCDef } from '../engine/season.js'
import type { Ability, Die, Stats } from '../engine/dice.js'

interface CardStats { speed: number; defense: number; agility: number; magic: number; intelligence: number }

function toStats(c: CardStats): { stats: Stats; attack: Ability } {
    const mapped: [Ability, number][] = [
        ['STR', c.speed], ['END', c.defense], ['DEX', c.agility], ['CHA', c.magic], ['INT', c.intelligence],
    ]
    const ranked = [...mapped].sort((a, b) => b[1] - a[1])
    const array: Die[] = [10, 8, 6, 6, 4]
    const stats = {} as Stats
    ranked.forEach(([ab], i) => { stats[ab] = array[i] })
    return { stats, attack: ranked[0][0] }
}

function pc(
    id: string, name: string, crewId: string, card: CardStats, points: number,
    powerName: string, bio: string, modelSheetHint: string,
    policyTweaks: Partial<PCDef['policy']> = {}
): PCDef {
    const { stats, attack } = toStats(card)
    return {
        id, name, crewId, stats, attackAbility: attack,
        power: { name: powerName, level: Math.min(12, points + 2) },
        policy: { resistVs: ['STR'], counterWhenHpAbove: 7, spendVpAtMatchPoint: true, blazeOfGloryIfDying: false, ...policyTweaks },
        bio, modelSheetHint,
    }
}

export const CREWS = [
    { id: 'elder-zombies', name: 'The Elder Zombies', motto: 'The buffet closes when WE say it closes.' },
    { id: 'commandos', name: 'The Hellmouth Commandos', motto: 'Punk rock keeps the Primordial in check.' },
    { id: 'rescue-squad', name: 'The Interdimensional Rescue Squad', motto: 'Rescue is such a strong word.' },
    { id: 'syndicate', name: 'The Chinatown Syndicate', motto: 'Everything is negotiable. Especially you.' },
    { id: 'regulars', name: 'The Wormhole Regulars', motto: 'Last call is a state of mind.' },
]

export const CAST: PCDef[] = [
    // ── The Elder Zombies
    pc('beelzebubbie', 'BeelzeBubbie', 'elder-zombies',
        { speed: 55, defense: 35, agility: 20, magic: 20, intelligence: 30 }, 1,
        'Call of the Dread One',
        'Clan leader of the Elder Zombies. Civil War memorabilia on every wall; proud of her son Carl, who still lives at home. Destroys computers in his absence. Answers the call of The Dread One from the Deep — and all-you-can-eat buffets. Surprisingly wise and oddly kind when reminiscing.',
        'elderly zombie matriarch, floral housecoat, beehive hairdo, cataract glow, tattered cardigan'),
    pc('carl', 'Carl', 'elder-zombies',
        { speed: 40, defense: 30, agility: 30, magic: 60, intelligence: 20 }, 4,
        'Weaponized Bowling Ball',
        "Disgruntled former mob assassin, self-described green beret of 'many' wars, Sub-Dude's alleged childhood best friend. Misquotes scripture for every occasion, compulsively offers bets, avid conspiracy theorist. More lucky than skilled. BeelzeBubbie's son. Bad bowling etiquette really pisses him off.",
        'paunchy middle-aged zombie in a bowling shirt, unlit cigar, shoulder holster, league trophy patch'),
    pc('deadstep', 'Deadstep', 'elder-zombies',
        { speed: 65, defense: 45, agility: 30, magic: 15, intelligence: 25 }, 4,
        'Roadkill Cuisine Bite',
        "No longer needs to breathe — or might just be the living dead. Co-authored a roadkill cookbook. Bite as deadly as his blades; satchels of power boosts and medicinal jabs. Proud 4-year member of his high school RPG club. One of those rare dudes who really enjoys his work.",
        'towering gaunt mercenary, tactical rig of satchels, twin blades, jaw always slightly open',
        { blazeOfGloryIfDying: true }),

    // ── The Hellmouth Commandos
    pc('fmj', 'Full Metal Jackson', 'commandos',
        { speed: 70, defense: 65, agility: 35, magic: 10, intelligence: 30 }, 6,
        'Demolition Battle Cry',
        "Leader of the Hellmouth Commandos — the only thing between you and the monsters of Hell. Master of demolition, partially deaf, ALWAYS TOO LOUD. Fears hospitals. Quotes famous movie lines as battle cries. Lead singer of 'The Gore Bots' — punk rock keeps the Primordial in check.",
        'jacked commando, mohawk, ammo bandoliers, guitar slung next to rocket launcher, hearing aid'),
    pc('tricera-cop', 'Tricera-Cop', 'commandos',
        { speed: 40, defense: 70, agility: 10, magic: 20, intelligence: 20 }, 1,
        'Dino Might',
        "Sergeant Tricera-Cop, the real deal big cheese — in his own mind. A glorified mall cop whose beat is a mystery; found in watering holes more than on patrol. Dreams of the Robot Repair Mall transfer. Will 'definitely' pass the Raze exam next time. Never takes bribes — but how much are you offering?",
        'triceratops-headed beat cop, straining uniform, mirrored aviators, coffee cup, mall-cop segway'),
    pc('raze', 'The Raze', 'commandos',
        { speed: 50, defense: 50, agility: 30, magic: 10, intelligence: 15 }, 1,
        'Righteous Tackle',
        'Constables who roam in packs and take the work seriously. Belly-badge monitors display calming images on approach — advertisements otherwise. Embarrassingly gullible. Particularly aggressive with line cutters. The uniform is won and worn with righteous pride.',
        'squat armored constable, glowing belly-monitor playing ads, riot baton, seniority face tattoos'),

    // ── The Interdimensional Rescue Squad
    pc('cobalt-fox', 'Cobalt Fox', 'rescue-squad',
        { speed: 30, defense: 30, agility: 80, magic: 30, intelligence: 85 }, 8,
        'Hypnotic Pipe Trance',
        "Head of the Interdimensional Rescue Squad. Ex-MI6 master thief and 'information retrieval specialist.' The Machiavelli of interdimensional diplomacy: Most Wanted in 9 dimensions, on the payroll as a double agent in 8. Stole the Statue of Liberty once. Plays both sides, always.",
        'sleek anthropomorphic blue fox in a tailored suit, briar pipe, monocle glint, cat-burglar gloves'),
    pc('claire-voy', 'Claire Voy', 'rescue-squad',
        { speed: 70, defense: 40, agility: 50, magic: 15, intelligence: 60 }, 5,
        'Foreknown Strike',
        "Dragon-bladed precog with attitude — she sees your next move before you do. Master of sword arts; her blade propels her through air and water. Aionion mask gifted by a celestial. Finishes people's sentences, which is... pretty fucking annoying. Frequently wins the lottery.",
        'compact swordswoman, ornate aionion mask, dragon-motif blade, lottery tickets tucked in belt'),
    pc('dee-void', 'Dee Void', 'rescue-squad',
        { speed: 80, defense: 65, agility: 45, magic: 35, intelligence: 30 }, 7,
        'Two-Hearted Fury',
        'Multiversal bounty hunter. Will lose an arm before losing an arm-wrestling match. Dies again and again to keep a promise. Into death metal AND Bollywood dance sequences. Two hearts — one takes over when the other is destroyed. Eye color reveals her aggression level.',
        'seven-foot bounty hunter, asymmetric armor, eyes shifting color, band patches, mehndi tattoos',
        { blazeOfGloryIfDying: true }),

    // ── The Chinatown Syndicate
    pc('grumble-bee', 'Grumble Bee', 'syndicate',
        { speed: 25, defense: 20, agility: 20, magic: 45, intelligence: 75 }, 4,
        'Lunch Box Arsenal',
        "Delivered herself from pageant-parent guardianship; now a mob enforcer for Chinatown's largest syndicate. Mouth as foul as a sailor's under the cutesy curls. Youngest-ever Youth Mensa member (expelled). Is the lunch box an assassin's toolkit, or just a lunch box? Anger issues, deemed 'too volatile' for public school.",
        'tiny girl with ringlet curls, pageant sash worn like a bandolier, ominous cartoon lunch box'),
    pc('sim', 'SIM', 'syndicate',
        { speed: 30, defense: 50, agility: 35, magic: 15, intelligence: 35 }, 2,
        'Battle Simulation Protocol',
        "Alien Battle-SIMulation-Bot stuck in seek-and-destroy mode. Eats metal, regenerates in hibernation. Programmed to defend children — protects anything it takes (or mistakes) for a child. Grumble Bee's sworn guardian, which settles most arguments before they start.",
        'hulking scuffed combat robot, mismatched repair plates, child-safety decals, glowing gentle eyes'),
    pc('finger-blaster', 'Finger Blaster', 'syndicate',
        { speed: 65, defense: 20, agility: 15, magic: 40, intelligence: 10 }, 2,
        'Bracers of Blasting',
        "Learned his manners in juvie. Stole the Bracers of Blasting in a petty heist, found out later what he had. Fishnet stocking on one arm for the electrostatics; goggles for the glare. Boasts about his prowess to anyone who'll listen. Now a crypto influencer and local mob enforcer.",
        'wiry hustler, crackling energy bracers, one fishnet sleeve, welding goggles, gold chain'),

    // ── The Wormhole Regulars
    pc('golden-wing', 'Golden Wing', 'regulars',
        { speed: 40, defense: 45, agility: 35, magic: 10, intelligence: 25 }, 2,
        'To The Skies!',
        "Old-guard Golden Age hero; a word turns his suit to protective golden mesh. Bartender at the Wormhole Tequila Bar, investor in the Gold N' Wingz pawn-shop-and-fast-food chain. Wings activate on 'To the skies!' — sadly he's developed a fear of heights. Weekends on the family shrimp boat.",
        'aging golden-age hero, magnificent tarnished wing suit, bar rag over shoulder, infomercial smile'),
    pc('sub-dude', 'Sub-Dude', 'regulars',
        { speed: 35, defense: 55, agility: 25, magic: 25, intelligence: 25 }, 2,
        'Wrist Torpedoes',
        "Merged with his experimental minisub escaping a gang fight in an Amsterdam sex club. Runs clandestine missions where a big sub won't fit. Transforms into a deep-diving submarine when splashed. Master of the cat-o-nine-tails. Small fortune in pickle commercial money. 'No pain, no gain.'",
        'barrel-chested man fused with mini-submarine hull, periscope over shoulder, pickle-brand patches'),
    pc('he-nis', 'He-Nis', 'regulars',
        { speed: 40, defense: 40, agility: 40, magic: 40, intelligence: 35 }, 4,
        'Great Sword of Chivalry',
        "His Royal Prince Had'em, from a land where men are manly. Long shaft-like neck elongates when excited or annoyed — sees over bathroom stalls and castle walls. Chivalrous to a fault; some say a real dick. Calls women 'wench,' insulting them all. Requests backup from forest creatures.",
        'chiseled fantasy prince, absurdly long extendable neck, great sword, squirrel entourage'),
]
