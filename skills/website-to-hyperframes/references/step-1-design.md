# Step 1: Write DESIGN.md (the brand-truth cheat sheet)

DESIGN.md is a **brand-truth cheat sheet** — colors and fonts you'll **weave into your composed builds**. It is NOT a layout spec, not a moodboard, not a 400-line design system audit.

The composed scenes in [`examples/`](../examples/) are the visual reference. DESIGN.md is the brand inflection you layer on top: which color is "primary," which font is "headlines," what tone the brand carries — the load-bearing knobs sub-agents flip when building beats.

**Target length: 60–120 lines.** Sub-agents read the Quick Reference and the Iteration Guide; everything else is over-investment.

**User preferences always override brand rules.** If the user says "make it bright even though the site is dark" or "use serif fonts even though the brand is sans" — follow the user. DESIGN.md describes the captured website. The video might deliberately break that.

You read `tokens.json` and `design-styles.json` in Step 0. If you remember the values, use them; if not, re-read. Don't guess.

**Font availability check — do this before writing anything else.** Check `capture/assets/fonts/` and cross-reference with what the site uses:

- Hashed filenames (`f266e704...woff`) = Google Fonts subsets → auto-resolve, no `@font-face` needed
- Recognizable filenames (`BrandSans-Bold.woff2`) = brand fonts. **Check the weight** — if the site uses 700/Bold but only Light/Thin was captured, the bold doesn't exist. Note this explicitly: "GT Walsheim — only Light (300) captured; for Bold use Inter 700 fallback."
- Commercial fonts (GT Walsheim, Söhne, Graphik, Canela) are NEVER captured — they're on brand CDNs. Flag explicitly: "Söhne not in capture; use Inter 600 as substitute."

Sub-agents try to use the fonts you list. If you claim "Charlie Display 700" and the file doesn't exist, they silently fall back to system-ui. Be honest about what's available.

---

## The 3 sections to write

### `## 1. Visual Theme (one paragraph)`

3–5 sentences describing the brand's visual personality. Cover: dark-first or light-first, contrast strategy, dominant visual elements (gradients, illustrations, photography, UI mockups), overall mood, what makes it distinctive vs. generic.

This is the only prose section. Make it specific to *this* brand — not template-filling. A sentence that could describe any well-designed website is not useful.

**Example:**

> Stripe's visual language is light-first and clean, with deep navy (`#061B31`) and pure white as the foundation. The accent stack — Stripe Purple (`#533AFD`) for CTAs, Vibrant Orange (`#FF6118`) for energetic emphasis — keeps interactive elements unmistakable. Type is sohne-var Light (300) for display, weight 400 for body; the brand achieves hierarchy through size and weight, never color shifts. The mood is confident financial-tech — premium without theatrical drama. Distinctive: gradient overlays at 135° between purple and orange appear as subtle washes over white backgrounds, never as bold focal elements.

---

### `## 2. Quick Reference`

A flat lookup of the values sub-agents grab while composing beats. Two sub-sections — keep them tight.

#### Colors

List 8–12 colors with brand-specific names + HEX + role. Not generic ("Accent 1") but evocative ("Stripe Purple", "Deep Navy", "Slate Border"). The name carries meaning; "blue 4" doesn't.

**Example:**

```markdown
#### Colors

- **Stripe Purple** (`#533AFD`): Primary CTA, interactive elements, focus rings — the brand's action signal
- **Deep Navy** (`#061B31`): Primary text, headings — gravitas color
- **Pure White** (`#FFFFFF`): Page background, card surfaces
- **Light Gray** (`#F5F7FA`): Surface tier 2 (cards on white pages, alternating sections)
- **Slate Blue** (`#273951`): Secondary text, subheadings, lower-emphasis content
- **Light Slate** (`#64748D`): Metadata, captions, disabled-adjacent text
- **Subtle Border** (`#D4DEE9`): Card borders, dividers
- **Vibrant Orange** (`#FF6118`): Energy accent — gradient endpoints, highlight bursts (never primary)
- **Error Red** (`#FF0022`): Validation errors
- **Success Green** (`#4CD963`): Confirmation states
```

#### Fonts

List font families (with availability notes) + the headline / body / mono trio if applicable:

**Example:**

```markdown
#### Fonts

- **Display + Body:** `sohne-var` (variable 100–900, captured ✓) — weights 300 / 400 used in production
- **Mono:** `"JetBrains Mono"` — code, metadata, technical content
- **Fallback stack:** `-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`

The brand uses **size for hierarchy, weight for emphasis**. Display 1: 48px/300, Display 2: 32px/300, Body: 14px/400. Never use weights above 400 — this brand has no bold variant in production.
```

That's the whole typography section. If sub-agents need exact line-heights or letter-spacing, they read `design-styles.json` directly.

---

### `## 3. Iteration Guide` (the load-bearing section)

5–10 numbered rules that encode the most important brand decisions. Each rule is a **single actionable sentence stating what to do, with the specific values from this site.** These are the "if in doubt, do this" rules sub-agents consult while composing beats.

**The single most common failure mode is writing generic rules that could apply to any well-designed website.** A rule that doesn't name a specific value, a specific color, or a specific component this brand actually uses is doing nothing.

**Test for any rule you write:** can you swap this brand for a different brand and have the rule still make sense? If yes, it's too generic. If no, ship it.

#### ❌ Generic vs ✅ site-specific

| Generic (delete) | Site-specific (keep) |
|---|---|
| Use the primary brand color for CTAs. | All primary CTAs use Stripe Purple (`#533AFD`). Secondary actions use white background with `#533AFD` border + text. **There is no third button color anywhere in the system.** |
| Maintain visual hierarchy through color contrast. | Body text is `#000000` on white, `#FFFFFF` on dark. Metadata uses `#64748D` on white only — never on dark. The brand has no mid-gray text on dark backgrounds. |
| Use clear typographic hierarchy. | All type is sohne-var. H1 `48px`/300, H2 `32px`/300, body `14px`/400. **Never use weights above 400** — this brand has no bold variant. |
| Use consistent spacing. | Spacing is from a fixed scale: `4, 8, 12, 16, 20, 24, 32, 40, 60` px. Section gaps are always `60–100px`. Card padding is always `32px`. No exceptions. |
| Buttons should have rounded corners. | Buttons are `40px` tall minimum, `4px` radius, `15.5px 24px` padding. Pill-shape `9999px` radius is reserved for the floating chat trigger only. |

#### One worked example (Framer — 5 rules)

```markdown
### Iteration Guide

1. **All interactive elements use Framer Blue (`#0000EE`)** — links, primary buttons, active states, focus indicators. Secondary uses `#0099FF` for hover. **No other interactive color exists in the system.**

2. **Typography: GT Walsheim Medium for headings, Inter for body.** Hierarchy enforced through size only, never color. H2 `62px`, H5 `85px`, body `14px`, labels `12px`/500. Text defaults to `#000000` on white, `#FFFFFF` on dark.

3. **Spacing is base-4** — every margin / padding / gap is a multiple of `4px`. Section gaps `60–100px`. **Never use odd values like `13px` or `17px`** — the system has no place for them.

4. **Cards: white (`#FFFFFF`), `1px` border `#EFEFEF`, `8px` radius, `16–20px` padding, no shadow by default.** Dark-mode cards swap to `#1A1A1A` background with `#242424` border. Shadow only appears on hover.

5. **Glass containers** use `rgba(255,255,255,0.9)` background, `1px` border `rgba(255,255,255,0.2)`, optional `backdrop-filter: blur(8px)`. **These are the only place transparent fills appear** — everywhere else uses solid color.
```

If your draft has a rule like "all interactive elements require visible focus states for accessibility" — delete it. Not wrong, just not load-bearing for *this* brand.

---

## Rules

- Use **exact values** from `capture/extracted/tokens.json`. Cross-reference with screenshots when needed.
- Name colors and components descriptively — "Stripe Purple" not "Accent 1."
- When you can't extract exact values, estimate from visual inspection and note it.
- Target **60–120 lines total.** This is a cheat sheet, not a system audit. Length is not virtue.
- No "Assets" section — `capture/extracted/asset-descriptions.md` is the asset index.
- No "Motion" section — the storyboard specifies motion per-beat.
- No "Components" section beyond what fits in Quick Reference — sub-agents compose UIs from [`examples/`](../examples/), not from CSS specs in this document.
- No "Depth & Elevation" tables — `examples/` scenes encode shadow language; you don't need to re-document it.

---

## Quick User Check (before moving to Step 2)

30-second sanity check before Step 2:

> "Here's what I extracted as [Brand Name]'s visual identity:
>
> - **Colors:** [primary], [accent], [2-3 others with roles]
> - **Fonts:** [headline font], [body font]
> - **Tone:** [1 sentence on the brand feel]
>
> Does this match how you want the video to feel? Any corrections or overrides before I start the storyboard?"

If the user has corrections ("use the blue, not the gray" / "ignore the dark mode" / "we just rebranded, use [these values] instead") — update DESIGN.md now. One minute here saves thirty minutes of rebuilding.

---

## What makes a useful DESIGN.md

A sub-agent reading just your Quick Reference + Iteration Guide should be able to:

1. Pick the right color for any primary action, secondary action, body text, error state
2. Pick the right font/weight/size for any headline, body, metadata
3. Know which 2-3 rules they cannot break without losing the brand

That's the test. If they can answer those three questions from a 60–120 line doc, you've nailed it. If they need to read 400 lines of mood-board prose to find a color, you've buried the signal.
