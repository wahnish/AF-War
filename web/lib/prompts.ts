// Model-sheet prompt — ported verbatim (directive text unchanged) from
// FlowZilla's CHARACTER_ONE_SHOT template
// (~/Documents/FlowZilla/flowzilla/lib/prompts/MODEL_SHEET_TEMPLATES.ts).
// Todd: this prompt took real iteration to get right (see that file's
// version history, V1-V4) — reuse it rather than re-deriving a simpler one.
// It's also SAME-PROMPT-FOR-EVERYONE by design: every AF WAR character gets
// the identical multi-angle directive structure, which keeps model-sheet
// quality/fairness consistent across players (nobody's sheet is worse
// because their prompt was weaker). Only the style constant is swapped for
// AF WAR's existing comic-book STYLE string, and {subject_description} is
// filled from the character's name/archetype/bio.

export const AFWAR_SHEET_STYLE =
    "Gritty 1990s American comic book art, bold confident inks, flat colors with neon accents, retro-futuristic Hyper-Brooklyn (Venture-Brothers-adjacent adult animation energy played straight). Halftone texture, dramatic lighting.";

const EXPRESSION_PANELS =
    `NEUTRAL panel: relaxed face, mouth closed, eyes open and looking directly at the camera, no emotional affect — the canonical baseline identity reference. Label: "NEUTRAL".\n` +
    `SMILING panel: warm open smile with teeth visible, eyes crinkled at the corners, cheeks raised — a genuine pleased expression. Label: "SMILING".\n` +
    `ANGRY panel: brow deeply furrowed with vertical creases between the eyebrows, jaw clenched tight, nostrils flared, eyes narrowed hard, teeth bared, intense glare — unmistakable rage. Label: "ANGRY".\n` +
    `SURPRISED panel: mouth open wide in a round "O" shape, both eyebrows arched high above their normal position, eyes very wide with whites visible around the irises — unmistakable shock. Label: "SURPRISED".`;

// Verbatim from FlowZilla's CHARACTER_ONE_SHOT.template, with {style_mode}
// pre-filled to AFWAR_SHEET_STYLE and {expression_panels} pre-filled — only
// {subject_description} remains as a caller-supplied slot.
const CHARACTER_SHEET_TEMPLATE = `High-definition character turnaround reference sheet / character design board, set against a pure white background. {style_mode}. Professional studio lighting, premium production-art quality, strict character consistency across all views.

Subject: {subject_description}

Layout: a single landscape 16:9 canvas divided into exactly EIGHT equally-sized panels arranged as TWO ROWS of FOUR PANELS each (2 rows × 4 columns). Thin white gutters between panels. Every panel is labeled in the top-left corner in uppercase text matching the panel name below — no numbers, no digits, only the uppercase word.

Left half of the canvas — FOUR FULL-BODY TURNAROUND PANELS (2×2 grid), each a different camera angle. Do NOT duplicate any angle across panels:

FRONT panel: full-body standing pose photographed dead-on from the front, viewer sees the front of the face and the front of the torso, symmetric framing, arms relaxed at sides, hands open and empty, feet slightly apart, neutral expression, eye-level camera. Label: "FRONT".

THREE-QUARTER panel: full-body three-quarter view. The character's BODY is rotated 45° away from the camera toward screen-LEFT — the viewer sees the FRONT of the LEFT shoulder and the SIDE of the RIGHT shoulder, the nose points toward screen-LEFT. This is NOT a front view and NOT a strict profile. Full body, arms at sides, hands empty, eye-level camera. Label: "THREE-QUARTER".

SIDE panel: full-body STRICT 90° profile view. The character's BODY is rotated 90° so the camera sees the LEFT SIDE of the body — the viewer sees ONE shoulder, ONE arm, and the SIDE of the face (left ear visible, left cheek visible, tip of nose in silhouette pointing screen-right). This is NOT a front view. This is NOT a three-quarter view. Full body, arms at sides, hands empty, eye-level camera. Label: "SIDE".

BACK panel: full-body view photographed from directly behind the character, viewer sees ONLY the back of the head, back of shoulders, and back of legs. No face shown. Arms at sides, hands empty, eye-level camera. Label: "BACK".

Right half of the canvas — FOUR HEAD-AND-SHOULDERS EXPRESSION CLOSE-UPS (2×2 grid) of the SAME character. The first panel is the canonical NEUTRAL face reference (head-and-shoulders crop — the FRONT full-body panel is too distant to read facial features cleanly). The remaining three panels are distinctly emotional states, each visibly different. Label each panel in the top-left corner with ONLY the uppercase word listed:

{expression_panels}

All eight panels show the EXACT SAME character — identical facial features, hairstyle, clothing, body shape, skin tone, and height proportions. Character edges sharp, garment shapes clearly defined, hair strands natural, skin refined, materials accurately rendered.

CRITICAL — standalone identity reference, NOT an in-scene character:
- Hands are EMPTY in every full-body panel. No held objects. No props. No documents, folders, papers, tissues, handkerchiefs, briefcases, tools, weapons, phones, accessories being gripped or carried.
- No narrative content. No scene context. No environmental elements.
- Subject's actions are limited to standing, looking, and facial expressions. No coughing, no drinking, no writing, no eating, no reaching, no mid-action poses.
- Background is pure white studio throughout every panel.
- Panel labels are ONLY the uppercase words specified above. NO digits, NO numbers, NO list markers (no "1.", no "2.", no "4", no "5-8"). NO repeated labels across panels.

Output requirements: landscape composition, white background, full character visible in every panel, no cropping, no extra props, uppercase panel labels in top-left corner, no explanatory text, no logo, no watermark, no UI elements, no social-media chrome.`;

export interface SheetSubject {
    name?: string;
    bio: string;
    archetype?: string;
}

/** Builds the AF WAR character model-sheet prompt from the ported FlowZilla
 * template: same 8-panel multi-angle structure for every character
 * (fairness/consistency across players), AF WAR's comic-book style, and
 * this character's name/archetype/bio as the subject description. */
export function characterSheetPrompt(subject: SheetSubject): string {
    const subjectDescription = `${subject.name ?? "an Original Character"} — ${
        subject.archetype ? `${subject.archetype}. ` : ""
    }${subject.bio}`;

    return CHARACTER_SHEET_TEMPLATE.replace("{style_mode}", AFWAR_SHEET_STYLE)
        .replace("{subject_description}", subjectDescription)
        .replace("{expression_panels}", EXPRESSION_PANELS);
}
