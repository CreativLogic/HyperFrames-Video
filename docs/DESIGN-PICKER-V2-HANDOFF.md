# Design Picker V2 — Handoff

## What's Done

### Per-template DESIGN.html generation
- `build-design-templates.py` generates `design.html` for all 34 templates mechanically
- Reads each template's CSS tokens (fonts, colors, borders, shadows, radius) from `summary.html`
- Classifies by scheme (dark/light), border style (heavy/hairline/subtle), radius
- Dark templates → dark canvas, accent cover, hairline borders, lowercase
- Heavy border templates → 4px solid, hard shadows, uppercase, tilted swatches
- Each template's own fonts flow through to page design
- Hand-crafted designs for block-frame + broadside preserved (skipped by generator)
- All 34 templates now export bespoke DESIGN.html

### Template summaries (`build-summaries.py`)
- CSS tokens + unique slide skeletons with `{{placeholders}}`
- Handles external CSS files (pin-and-paper)
- Universal slide extraction across all template patterns
- 15-79% compression vs full template HTML

### Token system
`__PRIMARY__`, `__SECONDARY__`, `__TERTIARY__`, `__ACCENT__`, `__NAME__`,
`__SHADER_VERTEX__`, `__SHADER_FRAGMENT__`, `__SHADER_CONFIG__`, `__SHADER_SCRIPT__`,
`__TEMPLATE_CSS__`, `__SLIDE_CARDS__`, `__DOS__`, `__DONTS__`,
`__EASING_NAME__`, `__EASING_VALUE__`, `__CORNER_RADIUS__`, `__PADDING__`, `__GAP__`,
`__ELEVATION__`, `__DENSITY__`, `__BG_HEADLINE__`, `__BG_TYPE__`, etc.

### V2 picker scaffold (`design-picker-v2.html`)
- Template grid overlay → select template
- Loads design.html + applies tokens with current state
- Click palette/motion/background sections to cycle options
- Export button downloads resolved HTML
- Nav rail with Template + Export buttons

## What's Next

### Phase 2: Better edit affordances
- Replace click-to-cycle with dropdown/popup pickers per section
- Palette section: swatch popup showing all palette options
- Typography: font pair selector
- Surface: corner radius / density / depth controls
- Motion: easing curve picker (reuse existing custom easing UI)
- Background: shader preset grid with live preview thumbnails

### Shader integration
- The v2 picker doesn't yet run the shader renderer in the loaded design page
- Need to wire up `_sgShaders` (vertex/fragment GLSL) and the Three.js pipeline
- The `__SHADER_SCRIPT__` token is currently empty — needs the full renderer script
- The shader preview canvas (`#bg-preview-canvas`) needs the drawImage approach

### CSS collision hardening
- Use `#hf-` prefix for all picker chrome
- Picker toolbar needs `!important` on critical properties
- Clean up injected styles when switching templates
- Destroy Three.js renderers on template switch to prevent GPU leaks

### Font loading
- Template fonts loaded via `<link>` injection into `<head>`
- May need preloading strategy for smoother transitions

## Architecture

```
design-picker-v2.html (shell)
  ├── #tmpl-overlay (template grid, z-index: 1000)
  ├── #design-page (receives resolved design.html content)
  │   ├── <style> blocks from design.html
  │   ├── <canvas id="design-bg"> (shader background)
  │   ├── .rail (nav rail + edit buttons)
  │   ├── sections: #palette, #type, #surface, #motion, #background, #guidelines, #templates
  │   ├── <template id="tmpl-source"> (slide cards)
  │   └── <script type="module"> (shader renderer)
  └── #export-overlay (export textarea + download)

State: { template, palette, type, easing, corners, density, depth, bg }
Token resolution: applyTokens(rawHtml, slug, summary) → resolved HTML string
Export: snapshot of resolved HTML (not live DOM serialization)
```

## Key Files
- `skills/hyperframes/templates/design-picker-v2.html` — new picker
- `skills/hyperframes/templates/design-picker.html` — old picker (keep for now)
- `skills/hyperframes/templates/presentations/*/design.html` — 34 design templates
- `skills/hyperframes/templates/presentations/*/summary.html` — CSS + skeletons
- `skills/hyperframes/scripts/build-design-templates.py` — design.html generator
- `skills/hyperframes/scripts/build-summaries.py` — summary.html generator
- `skills/hyperframes/templates/index.json` — template metadata
