# Step 2: Creative Brief

**First, read [capabilities-overview.md](capabilities-overview.md)** — scan the capabilities table to know what's available. You need this to tell users what's possible.

You've captured the site, read all the data, written DESIGN.md. Now you know what you're working with — the brand's colors, assets, animations, typography. Before making any creative decisions, **ask the user what they want.**

**Parse the user's prompt first.** Read what they already told you — video type, style, specific requests, duration. Only ask about things they DIDN'T specify. If they said "product demo, show me the kanban board and chat, moderate pace" — that's most of the brief already. Don't ask "what type of video?" when they literally said "product demo."

Skip questions the user already answered. Ask only what's missing. If the prompt is detailed enough to build from, confirm the direction in one message and move to Step 3. The goal is to fill gaps, not interrogate.

---

## What to Ask

After presenting the site summary (from Step 0), engage the user with these questions. Use your agent's question/answer UI if available (multi-choice with custom option). If not, ask conversationally.

### Question 1: What's this video for?

Present options based on what makes sense for the captured site:

**Example (Not a required options)**

- **Social ad** (15–20s) — Instagram, TikTok, LinkedIn. Fast, punchy, hook in first 2s.
- **Product demo** (30–60s) — Walk through key features. Narrated, professional.
- **Launch teaser** (15–25s) — Build hype for a new feature or product. Dramatic reveal.
- **Brand reel** (20–45s) — Showcase the brand identity. Visual-forward, minimal narration.
- **Feature announcement** (15–30s) — Highlight a specific feature or update.
- Or describe something else.

This determines duration, beat count, narration density, and overall energy.

### Question 2: What style/vibe?

Ask the user to describe what they want — or react to concrete framings that describe motion and energy, not aesthetic presets.

Do NOT present a labeled menu of styles with pre-filled descriptions ("Cinematic = dark + glow + Apple keynote energy"). Those descriptions become the brief even when they don't match the brand. "Cinematic" for a wellness brand should look completely different from "cinematic" for a security tool — but a label with a baked-in description collapses that distinction.

Instead, ask them across the six axes from [visual-vocabulary.md](visual-vocabulary.md) — framed as approachable questions, not a form:

> "A few questions to get the direction right:
>
> - **Pace:** Should the video move slowly and let moments breathe, or be fast and punchy? Or somewhere in between?
> - **Mood:** What atmosphere matches how you want viewers to feel — dark and dramatic, clean and light, energetic and vibrant, or something else?
> - **Narration:** Should a voice guide viewers through the video, or let the visuals carry it?
> - **Anything specific?** Any moments, techniques, or references you're drawn to? Or say 'surprise me' and I'll work from what I found in the capture."

Their answers modify the brand-derived baseline you built in Step 1. Don't override the brand with their words — let the brand and their direction converge. See [visual-vocabulary.md](visual-vocabulary.md) for how to handle conflicts.

### Question 3: What do you SPECIFICALLY want to see?

This is the open-ended question, but guide the user toward specificity. Frame the options around **composed beats with brand inflection** — not around "what asset gets used where." The video's load-bearing visuals will be composed from scratch (kanban from divs, dashboards from layered panels, transitions from shaders); the captured assets are accents that decorate those composed beats with this brand's identity.

Frame it like this:

> "Now that I've analyzed your site, here's what I have to work with:
>
> - **Brand inflection** — [2-3 sentences on what makes this brand's visual language distinctive: dominant colors, font character, mood]
> - **Composed library** — every product UI, transition, counter, sparkline, and effect can be built from scratch using the [`examples/`](../examples/) library (81 reference scenes — kanban, chat, dashboard, terminal, shader transitions, particle fields, 3D scenes, audio-viz, etc.)
> - **Brand accents available** — [1-2 most distinctive captured assets that earn a place: SVG logo for stroke-draw opener, hero illustration for a depth layer, gradient image for ambient wash]
> - **Anything genuinely worth using as content** (rare) — [If the capture has something truly unique that can't be composed: a custom Lottie, real product video, a one-of-a-kind illustration — name it]
>
> Based on this, the most interesting beats I could compose for you:
>
> - [Compose-first example grounded in the brand — e.g., "Build the kanban board from cards-as-divs in your brand palette, with the captured logo stamped top-left and your hero gradient washing the background as ambient depth."]
> - [Another — e.g., "Open with your SVG logo drawing itself stroke-by-stroke over a shader bloom that recreates your site's hero gradient — composed motion, brand colors woven in."]
> - [Another — e.g., "Six product feature panels composed from scratch — kanban, dashboard, terminal, file tree, calendar, chat — each in your palette, with your wordmark stamped on each as identity."]
>
> Beyond what's in the capture, I can also create additional assets — 3D models, custom shaders, illustrations, stock footage — if anything would make the video go further. The goal is something that stops scrollers and feels alive in every frame, not something that crossfades through screenshots. Read [capabilities-overview.md](capabilities-overview.md) for the full picture of what's possible.
>
> Do you have any specific moments, beats, or effects you want to see? To help you think about it, here are a few directions that would work for your specific brand:
>
> [Generate 2–3 example direction prompts grounded in _this_ brand's identity. Each should describe a **composed beat** that weaves in the brand inflection (color / font / accent asset). Model the _specificity_ — name the composed reference + the brand accent that decorates it.
>
> Good compose-first examples have the form: "[Compose X scene from examples/] in [this brand's palette/font], with [captured accent] [decorating it in this specific way]."
>
> Bad examples — what NOT to write here:
>
> - "I want the hero screenshot to come in on a rotating MacBook" (asset-primary thinking — instead: "Compose the dashboard from divs and animate it inside a 3D MacBook")
> - "Show the pricing tiers flying in one by one" (vague — instead: "Compose your 3 pricing tiers using `examples/04-composed-ui/scene-14-pricing-card-reveal/`, with your brand purple on the Pro tier")
> - "Start with the logo drawing itself" (might be valid as an accent on a composed opener, but it can't be the whole opener — what else is happening?)]
>
> You don't need a complete vision — even one or two specific moments helps me build something you'll love. Or say 'surprise me' and I'll make the creative calls based on your brand."

**Important:** The directions you propose must lead with **composed beats**, with captured assets as accents. If you find yourself describing "the [asset] flying in" or "the [screenshot] mapped onto [thing]" — flip it. Lead with what gets composed and built, mention the brand accent as decoration second. Generic capability lists feel like a sales pitch; asset-primary lists feel like a slideshow.

Present options:

- **I have specific ideas** — let me describe them
- **Surprise me** — you make the creative calls, I'll review the storyboard
- **Let me see some options first** — propose 2–3 different creative directions and I'll pick

### Question 4: Narration?

Not every video needs a voiceover. Ask:

- **Yes, with narration** — a voice guides the viewer through the video (most product demos, launch teasers, feature announcements)
- **No narration, visual-only** — music/SFX only, the visuals tell the story (brand reels, social ads, music-driven pieces)
- **Minimal narration** — just a hook sentence or tagline, rest is visual (short social ads, teasers)

This decision changes the pipeline:

- **With narration:** Step 3 includes a full script. Step 4 generates TTS, transcribes, maps timestamps to beats.
- **Without narration:** Step 3 has no script (VO cues in storyboard are empty). Step 4 is skipped — beat durations are planned manually in the storyboard based on rhythm and pacing.

### Question 5 (if applicable): Format?

Only ask if not already specified by the user:

- **Landscape** (1920×1080) — YouTube, LinkedIn, website embeds (default)
- **Portrait** (1080×1920) — Instagram Stories, TikTok, YouTube Shorts
- **Square** (1080×1080) — Instagram feed, Twitter/X

---

## How to Handle Responses

### "Surprise me" / minimal direction

Default to the safe path that matches the brand and according to what is the video for (this is the minimum requirement users supposed to tell like where does the video goes to, or what audience or occasion or context is it for...):

But still write an ambitious storyboard. "Surprise me" means "impress me", not "play it safe." Go bold.

### Specific direction

Map their words to visual-vocabulary.md dimensions. If they say something vague ("make it really cool"), push back gently:

> "I want to make sure I nail what you're imagining. When you say 'cool' — do you mean: dramatic/cinematic(slow reveals and dark atmosphere)? Or high-energy (fast cuts and bold motion)? Or something else entirely?"

### Mixed direction

Parse each component separately. "Minimal but with cinematic transitions and a fast feature section" becomes:

- **Base style:** Minimal (moderate pacing, minimal density, elegant motion)
- **Transitions override:** Dramatic (shader effects for key moments)
- **Beats 3–5 override:** Fast pacing, balanced density, energetic motion

Note these per-beat overrides — they go into the storyboard.

### "Let me see options"

Propose 2–3 brief creative directions (3–4 sentences each) with different vibes. Example:

> **Option A — Cinematic Launch:** something like dark atmosphere, slow dramatic reveal of the dashboard on a 3D MacBook. Shader transitions between scenes. Bass impacts on key moments. Premium, Apple-keynote energy. or something similar
>
> **Option B — Fast Social Ad:** something like rapid feature showcase — screenshots flying in one after another, bold typography, vibrant accent colors. hook in 2-3 seconds. Instagram-ready.
>
> **Option C — Clean Product Tour:** something like professional walkthrough of key features. Screenshots at full-bleed with smooth transitions. Narrated, moderate pace. LinkedIn/website embed ready. or some conceptual visuals (not screenshots) or something similar

Let the user pick one or combine elements.

---

## Gate

Extract these from the user's prompt — most are already there:

1. **Video type** — infer from prompt ("product demo", "promo", "launch video", etc.)
2. **Duration** — infer from type if not stated (demo: 30-45s, social: 15-20s, teaser: 15-25s)
3. **Style direction** — map their words to visual-vocabulary dimensions
4. **Specific requests** — any scenes/effects they mentioned
5. **Narration** — stated or infer (if they said "no narration" or "just visuals", respect it)
6. **Format** — landscape unless they specified otherwise

**Do not ask the user to confirm what they already said.** If the prompt was "make a product demo for huly.io, show the kanban board, dark cinematic feel, full narration" — you already have type (demo), style (dark cinematic), specific requests (kanban board), and narration (full). Proceed to Step 3.
