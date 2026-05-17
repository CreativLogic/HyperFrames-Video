# Reading DESIGN.html

DESIGN.html is a self-contained design system document exported from the design picker. It is both human-viewable (opens in a browser as a styled page) and agent-parseable (all data is in the visible HTML source). There are no hidden data layers — everything the agent needs is rendered content.

## Structure

The file has 7 content sections, each with a stable `id`:

| Section    | ID            | What it contains                                       |
| ---------- | ------------- | ------------------------------------------------------ |
| Palette    | `#palette`    | 4 color swatches with hex values and role names        |
| Typography | `#type`       | Font specimens with family names and weights           |
| Surface    | `#surface`    | Corner radius, padding, gap, elevation, density values |
| Motion     | `#motion`     | Easing function name/value, duration defaults          |
| Background | `#background` | Shader preset config, GLSL source, live preview        |
| Guidelines | `#guidelines` | Do/don't rules as `<li>` items                         |
| Templates  | `#templates`  | Slide type gallery with HTML skeletons                 |

## Extracting the palette

The `:root` block in `<style id="ds-tokens">` defines the 4-role palette:

```css
:root {
  --primary: #f0ece5; /* text on dark surfaces */
  --secondary: #111111; /* canvas / background */
  --tertiary: #282826; /* muted / borders */
  --accent: #e85d26; /* signal — reserved for one focal element per frame */
}
```

Use these exact hex values. The palette section also shows human-readable names and usage descriptions in the swatch cards.

**Mapping to template CSS:** Template slide CSS uses `--tp-primary`, `--tp-secondary`, `--tp-tertiary`, `--tp-accent` which resolve to the same values. When writing compositions, set these in your `:root`.

## Extracting typography

The type specimen section shows the font families and weights. Extract from the `<link>` tag in `<head>`:

```html
<link
  href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;700;800;900&family=IBM+Plex+Mono:wght@300;500&display=swap"
/>
```

The specimen rows show each scale level (Display, H1, H2, Lead, Body, Label) with the font family, weight, and size.

## Extracting surface tokens

The surface section has a token list with values for:

- **Corners** — border-radius value (e.g., `4px`, `0px`, `12px`)
- **Padding** — content padding
- **Gap** — spacing between elements
- **Elevation** — shadow treatment (`Flat`, `Subtle`, `Layered`)
- **Density** — content density level and description

## Extracting motion

The motion section has two panels:

1. **Easing** — name, description, and the easing value (GSAP string or cubic-bezier)
2. **Duration** — default durations for slides and element entrances

Use the easing value directly in GSAP timelines: `gsap.to(el, { ease: "power3.out" })`.

## Extracting the shader background

The background section contains everything needed to reproduce the animated shader:

1. **Config JSON** — in a `<details>` block, contains geometry type, density, speed, strength, colors, camera position, rotation, grain settings
2. **Vertex shader GLSL** — in `<pre id="vtx-src">`
3. **Fragment shader GLSL** — in `<pre id="frg-src">`

To use in a composition:

1. Copy the `<canvas id="design-bg">` element
2. Copy the `<script type="module">` at the bottom of the file (the shader renderer)
3. The renderer reads colors from CSS variables `--secondary`, `--accent`, `--tertiary` — set those in your composition's `:root`

The shader renders behind all content at `z-index:-2`. The `#bg-veil` div provides a gradient fade at `z-index:-1`.

## Extracting guidelines

The guidelines section has two `<ul>` lists:

- **Do** — rules to follow (accent usage, corner consistency, font weights, etc.)
- **Don't** — constraints (no second accent color, no body text under 24px, etc.)

These are hard constraints. Violating them breaks the design system's coherence.

## Extracting slide skeletons

The templates section contains a `<template id="tmpl-source">` element with the slide gallery. Each slide type is wrapped in a `.tmpl` card:

```html
<div class="tmpl">
  <div class="tmpl-thumb">
    <div class="scale-wrap">
      <div class="ds-slide-frame">
        <section class="slide slide--cover orange">
          <!-- slide skeleton HTML -->
        </section>
      </div>
    </div>
  </div>
  <div class="tmpl-foot">
    <span class="name">slide--cover</span><span class="idx">01 / 16</span>
  </div>
</div>
```

The skeleton HTML inside `.ds-slide-frame` shows the layout structure with content placeholders:

- `{{headline}}` — primary heading text
- `{{body}}` — paragraph/description text
- `{{label}}` — small chrome text (kickers, captions, metadata)
- `{{number}}` — numeric values (stats, dates, counts)
- `{{text}}` — generic short text

**How to use skeletons:** Each skeleton is a slide type you can instantiate in your composition. Replace the `{{placeholder}}` tokens with real content. Keep the class names and DOM structure — they're styled by the template CSS in `<style id="template-css">`.

The template CSS is scoped under `.ds-slide-frame` in the design document. When using skeletons in a composition, strip the `.ds-slide-frame` prefix from selectors or wrap your slides in a `.ds-slide-frame` container.

## Slide theme classes

Slides use theme classes for background/text color:

- `.dark` — dark background (`--secondary`), light text (`--primary`)
- `.light` — light background (`--primary`), dark text (`--secondary`)
- `.orange` — accent background (`--accent`), dark text

Apply the appropriate class to each `<section class="slide ...">` element.

## Composition workflow

1. Read DESIGN.html
2. Set `:root` with palette values from `<style id="ds-tokens">`
3. Load the Google Fonts from the `<link>` tag
4. Pick slide types from the template gallery for your composition's scenes
5. Replace `{{placeholder}}` tokens with real content
6. Apply the easing from the motion section to your GSAP timeline
7. Copy the shader background script if using animated backgrounds
8. Follow the guidelines section constraints throughout
