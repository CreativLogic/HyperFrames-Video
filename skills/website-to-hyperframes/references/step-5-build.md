# Step 5: Build Compositions

**Captions rule — read before building anything:** Never create `compositions/captions.html` with an empty transcript (`const script = []`). If the VO/transcript step was skipped or failed, do not create a captions composition at all. An empty captions file silently does nothing and wastes a track slot. Only create it when `transcript.json` has real word timestamps.

**Before building, verify you have:**

- **STORYBOARD.md** — the beat-by-beat plan. Re-read it now if you don't remember every beat's concept, assets, and techniques.
- **DESIGN.md** — if you need to check a specific value (color, font, component style) you can't recall, look it up. Don't re-read the whole file.
- **`capture/extracted/asset-descriptions.md`** — when the storyboard assigns an asset to a beat, check the description to understand what it shows. Re-read this file if you can't recall the asset inventory.
- **transcript.json** — word-level timestamps that drive scene durations.

Load the `hyperframes` skill — it has the rules for data attributes, timeline contracts, deterministic rendering, and layout. Read it now if you haven't already this session.

**For capabilities.md and techniques.md:** read the Table of Contents to orient yourself, then go deep only on the sections your storyboard actually calls for. You don't need to re-read sections for animation engines, registry blocks, or techniques that none of your beats use.

---

## 1. Copy SFX to project

```bash
cp -r skills/website-to-hyperframes/assets/sfx/ <project-dir>/sfx/
# If skill is installed elsewhere:
find . -path "*/website-to-hyperframes/assets/sfx" -exec cp -r {} <project-dir>/sfx/ \;
```

## 2. Build the root index.html

Create `index.html` yourself. This is the orchestrator — it holds beat slots, narration audio, SFX, and shader transitions (if any).

**Critical CSS — every beat must overlap in the same frame:**

```css
.scene {
  position: absolute;
  top: 0;
  left: 0;
  width: 1920px;
  height: 1080px;
  overflow: hidden;
}
```

**Beat structure:**

```html
<div
  id="root"
  data-composition-id="main"
  data-start="0"
  data-duration="TOTAL"
  data-width="1920"
  data-height="1080"
>
  <div
    id="beat-1"
    class="scene"
    data-composition-id="beat-1-hook"
    data-composition-src="compositions/beat-1-hook.html"
    data-start="0"
    data-duration="5.5"
    data-track-index="1"
    data-width="1920"
    data-height="1080"
  ></div>

  <!-- more beats... -->

  <audio
    id="narration"
    src="narration.wav"
    data-start="0"
    data-duration="NARRATION_LENGTH"
    data-track-index="0"
    data-volume="1"
  ></audio>

  <!-- SFX on content moments, NOT on shader transitions -->
  <audio
    id="sfx-impact"
    src="sfx/impact-bass-1.mp3"
    data-start="0.3"
    data-duration="2.1"
    data-track-index="41"
    data-volume="0.35"
  ></audio>
</div>
```

Read `sfx/manifest.json` for SFX durations and descriptions. Match SFX to the right moments (text typing, logo appearing, stat revealing, clicking on something, rising tension or excitement). Shader transitions are their own audio-visual event and don't need SFX! For the SFX, try to not overuse them, their just decorations and polishing things, that adds a bit of a taste into the video.

**Shader transitions**

If the storyboard specifies shader transitions, copy the local shader-transitions build into the project and reference it directly — the CDN version is behind the local build and doesn't support CSS crossfade mixing:

```bash
cp packages/shader-transitions/dist/index.global.js <project-dir>/hyper-shader-local.js
```

Then in `index.html` use the local file:

```html
<script src="https://cdn.jsdelivr.net/npm/gsap@3.14.2/dist/gsap.min.js"></script>
<script src="hyper-shader-local.js"></script>
```

Call `HyperShader.init()` as documented. Read [the shader transitions section in the main hyperframes skill](../../hyperframes/references/transitions.md) for the full API. Key rule: `scenes.length === transitions.length + 1`.

**Font handling:** Common fonts (Inter, Roboto, JetBrains Mono, Poppins) are auto-resolved by the renderer. Only brand-specific fonts (GT Walsheim, Aeonik, etc.) need `@font-face`. Check `capture/assets/fonts/` — hashed filenames are Google Fonts subsets that auto-resolve; recognizable filenames are brand fonts that need `@font-face`.

**Asset paths — this is a common source of bugs.** Compositions live in `compositions/beat-N.html` but are loaded by `index.html` at the project root. All asset paths in compositions must be relative to the PROJECT ROOT, not to the composition file. Use `capture/screenshots/scroll-000.png`, NOT `../capture/screenshots/scroll-000.png`. The Studio preview rewrites base URLs — paths that work in snapshots can 404 in preview if they use `../` navigation. Always use paths relative to the project root.

## 3. Build each composition — USE SUB-AGENTS

**Before dispatching, re-read DESIGN.md and STORYBOARD.md.** You wrote these files earlier in the session and you think you remember them. You don't — not the exact hex values, not the specific font families, not the button border-radius, not the Do's/Don'ts. Re-read them now so you can paste accurate brand rules and beat specs into each sub-agent prompt.

**If your runtime supports parallel sub-agents** (Claude Code, Cursor, most agent frameworks): dispatch one sub-agent per beat — 3 to 4× faster than building sequentially. For 3+ beats, always dispatch in parallel. For 1–2 beats, sequential is fine.

**If your runtime does not support parallel sub-agents** (some Codex setups, serial-only models): build sequentially using the same context-packing template below. The template gives each build pass the same context a sub-agent would get — paste prev/this/next beat + brand values — so output quality is the same, just slower.

In either case, use the template. Do not skip it and build from memory.

Each sub-agent gets the full context it needs to build independently. Paste the COMPLETE storyboard sections — don't summarize or extract pieces. **Also paste the brand values inline** — do not tell sub-agents to re-read DESIGN.md in full. You already have DESIGN.md in context; extract the relevant values and paste them directly. This cuts each sub-agent's startup time by 30-40%.

```
Build the composition for Beat N. Save to compositions/beat-N-name.html.

═══ PREVIOUS BEAT (Beat N-1) ═══
[paste the FULL previous beat section from STORYBOARD.md — concept, VO,
visual description, animation sequence, SFX, everything. The sub-agent
needs to see what was just on screen to build a matching entrance.]

═══ THIS BEAT (Beat N) ═══
[paste the FULL beat section from STORYBOARD.md — concept, VO, visual
description with all animation sequences/timings/CSS values, SFX cues,
techniques referenced. This IS the build spec.]

═══ NEXT BEAT (Beat N+1) ═══
[paste the FULL next beat section from STORYBOARD.md — so the sub-agent
knows what's coming and can build an exit that sets it up.]

═══ BRAND VALUES (from DESIGN.md — use these exactly) ═══
Colors:
  --bg:        #[hex]   primary background
  --fg:        #[hex]   primary text
  --accent:    #[hex]   CTA / highlights
  --surface:   #[hex]   card / panel backgrounds
  [add 2-3 more if used in this beat]

Fonts:
  Headlines: [font family], [weight]
  Body:      [font family], [weight]
  [brand-specific font path if needed: capture/assets/fonts/Brand.woff2]

Key component styles for this beat:
  [paste 3-5 relevant lines from DESIGN.md for components this beat uses,
   e.g. button radius, card shadow, heading letter-spacing]

Do NOT read DESIGN.md. The values above are everything you need.

═══ CAPTURED ASSETS FOR THIS BEAT ═══
[Paste the ACTUAL file paths from capture/extracted/asset-descriptions.md for
every asset assigned to this beat. Include the one-line description so the
sub-agent knows what each file shows. Format:

- capture/assets/hero-dashboard.png — full-bleed product dashboard screenshot, dark theme
- capture/assets/logo.svg — brand wordmark, white on transparent
- capture/assets/feature-card.jpg — feature comparison grid, 3 columns

DO NOT just say "see asset-descriptions.md". Paste the relevant entries here.
The sub-agent has ZERO context — if you don't paste the path, it will build
CSS recreations instead of using the real captured assets.

If you don't know which assets to assign yet, read capture/extracted/asset-descriptions.md
NOW (before dispatching) and decide. Then paste the relevant ones here.]

═══ IMPORTANT: YOU START WITH ZERO CONTEXT ═══
You have no knowledge of HyperFrames, GSAP, or this project. Before writing
ANY code, read these — targeted reads only, not full files:

1. Load the `hyperframes` skill — data attributes, timeline contracts,
   deterministic rendering rules (this is non-negotiable, read the whole skill)
2. capabilities.md — read the Table of Contents first (lines 1-40), then
   read ONLY the sections relevant to this beat's techniques:
   [paste the section names/line ranges from capabilities.md that apply,
    e.g. "Section 3: Canvas 2D (lines 89-134)" or "Section 7: Shader Transitions"]
3. techniques.md — read ONLY the techniques this beat uses:
   [paste the technique names/line ranges from techniques.md that apply,
    e.g. "Technique 4: Kinetic Typography (lines 156-210)"]
4. If this beat uses HTML-in-Canvas/WebGL: read html-in-canvas-patterns.md in full
5. If this beat uses screenshots: VIEW them before placing text on them

Brand values are in the BRAND VALUES section above — no need to read DESIGN.md.

═══ RULES ═══
- If you want to place text over a screenshot: VIEW it first
- Use captured screenshots at full size, NOT CSS recreations unless you
  can recreate something almost pixel perfect
- Register timeline: window.__timelines["beat-N-name"] = tl
- No Math.random, no repeat:-1, no callbacks, no RAF
- Use tl.fromTo() not tl.from() for entrance animations
- No CSS transform for centering — use flexbox
- Never stack two transform tweens on same element
```

The storyboard beat already contains everything — the concept, the visual choreography with exact timings, the CSS values, the SFX cues. The sub-agent's job is to translate that description into working HTML/CSS/GSAP, not to re-invent the creative direction. If you want, you can also paste any other relative and useful context to subagents if think it's good, why not.

### Per-composition process

For each beat:

**1. Read the storyboard beat.** The storyboard IS the build spec. It tells you what elements exist, how they enter, what they do during the beat, and how they exit. Follow it. If something in the storyboard isn't clear or seems impossible, research how to do it or ask — don't silently skip it.

**2. Build the static end-state first.** Position every element at its most visible moment. HTML+CSS only, no GSAP yet. The CSS position is the ground truth.

**3. Add the animation sequence.** Follow the storyboard's choreography — it specifies what happens and when. Use `tl.fromTo()` (not `tl.from()`) for entrances. Build the timeline in the order the storyboard describes.

**4. Add exit** (if CSS transition out). If shader transition — no exit animation needed.

**5. View the result.** After building, take a snapshot of this beat at different timestamps (where things are supposed to happen, animate, move and etc) and look at it from all angles, corners and positinos. Is the frame full and everything is exactly where it supposed to be? Are you sure??? Are elements readable? Does it match what the storyboard describes?

### Technical rules

- **No `repeat: -1`** — calculate exact repeats from beat duration
- **No `Math.random()`** — use a seeded PRNG
- **No bare `gsap.to()`** — all tweens on `tl`, never standalone
- **No full-screen dark linear gradients** — H.264 banding
- **Minimum fonts**: 80px+ headlines, 20px+ body

## 4. After all compositions are built — reconciliation check

Before moving to Step 6, run this sanity check:

```bash
# List every file in compositions/ and verify each one has a host div in index.html
ls compositions/
```

For every `.html` file in `compositions/`, confirm that `index.html` has a `data-composition-src="compositions/<filename>"` pointing to it. If any composition file is not referenced in `index.html`, add the missing host div now — an unreferenced composition is completely invisible at runtime.

**Captions stub rule:** Never create a `compositions/captions.html` with an empty transcript (`const script = [];`). If the VO/transcript step was skipped or failed, do not create the captions composition at all. An empty captions file that returns immediately is worse than no captions file — it silently does nothing and wastes a track slot.

Once all compositions are built and all `compositions/` files are wired into `index.html`, move to Step 6 (Validate & Deliver) for lint, validate, snapshots, and visual review.
