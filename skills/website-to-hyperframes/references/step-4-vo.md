# Step 4: VO + Timing

Music is deferred — see [Music](#music-deferred) at the bottom. Captions are automated downstream via `scripts/captions.mjs` (zero LLM calls; runs between Step 5 and Step 6). This step focuses on: generate narration, transcribe, map word timestamps to beats, hand off timings to Step 5.

## If Step 2 said "no narration"

Skip the TTS sections below. The storyboard already has beat durations planned based on pacing and rhythm — those become `data-start` and `data-duration` values directly in Step 5. Move to Step 5.

---

## Pick a TTS provider and generate

Ask the user once, compactly:

> **Which TTS provider? HeyGen (word timestamps), ElevenLabs (best voices, no timestamps), or Kokoro (free, local, robotic)?**

If they haven't set up a key for the paid provider, ask for it inline ("paste it here or add `<PROVIDER>_API_KEY=…` to `.env`"). Don't critique a key paste — just use it.

**Generate the full narration directly** — no audition pass, no test clip. If the result sounds wrong, regenerate with a different voice. Picking voices in advance burns turns; one full take is faster than three auditions.

**HeyGen v3 (preferred when key is available — returns word timestamps in the same call):**

```bash
curl -s -X POST "https://api.heygen.com/v3/voices/speech" \
  -H "x-api-key: $HEYGEN_API_KEY" -H "Content-Type: application/json" \
  -d '{"text":"<narration text>","voice_id":"<voice_id>","speed":1.0}' \
  | python3 -c "
import json,sys
r = json.load(sys.stdin); d = r['data']
print(d['audio_url'])
# v3 uses 'word' key; pipeline expects 'text' — normalize on the way out
norm = [{'text': w['word'], 'start': w['start'], 'end': w['end']} for w in d.get('word_timestamps', [])]
open('transcript.json', 'w').write(json.dumps(norm, indent=2))
"
curl -sL "<audio_url_from_above>" --output narration.mp3
```

List voices: `curl -s "https://api.heygen.com/v3/voices?engine=starfish&type=public&limit=20" -H "x-api-key: $HEYGEN_API_KEY"` — response shape is `{ "data": [...] }`, NOT `data.voices`.

**ElevenLabs (when only ElevenLabs is available):**

```bash
curl -s -X POST "https://api.elevenlabs.io/v1/text-to-speech/<VOICE_ID>" \
  -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" \
  -d '{"text":"<narration text>","model_id":"eleven_multilingual_v2"}' \
  --output narration.mp3
```

Transcribe separately (next section).

**Kokoro (free, local):**

```bash
npx tsx packages/cli/src/cli.ts tts SCRIPT.md --voice af_nova --output narration.wav
```

Apply pronunciation substitutions in `narration.txt` before running — Kokoro mispronounces `API` (→ `A P I`), `UI`, `SaaS` (→ `sass`), `DevOps` (→ `dev ops`), and product names with unusual spelling. No SSML tags — Kokoro reads them as literal text; use blank lines or `...` for pauses. ElevenLabs and HeyGen handle product names correctly without substitution.

**Save the exact spoken text as `narration.txt`** (with substitutions applied if any). It's the string passed to TTS — distinct from `SCRIPT.md`. Makes re-generation trivial.

**Escalation if anything hangs > 60 seconds:** kill + retry → try different flags → switch tool (`whisper-cli`, Groq, OpenAI) → switch provider. Never sit idle for 10 minutes.

---

## Transcribe (only if non-HeyGen)

HeyGen v3 already returned timestamps above. If you used ElevenLabs or Kokoro:

```bash
npx tsx packages/cli/src/cli.ts transcribe narration.wav
```

Produces `transcript.json` with `[{text, start, end}]` for every word. These timestamps are the source of truth for beat boundaries.

---

## Map timestamps to beats

Walk STORYBOARD.md beat by beat. For each beat:

1. Find the first word of the beat's VO cue in `transcript.json` → `beat.start = firstWord.start`
2. Find the last word → `beat.end = lastWord.end + 0.3s` (visual breathing room)

Update STORYBOARD.md with real timestamps. Beat boundaries land on word onsets — hard cuts to the VO.

---

## Timing reconciliation (required before Step 5)

```
real_total = last_word.end + 2.5s CTA hold
planned_total = sum of planned beat durations
delta = |real_total - planned_total|
```

If `delta > 15%` of planned, fix it before Step 5:

- **Audio shorter than planned (most common with Kokoro):** proportionally scale non-CTA beat durations down to match real audio.
- **Audio much longer (>30% over):** trim the script (drop one beat), regenerate, re-transcribe.
- **CTA hard cap = 2.5s** after `last_word.end`. Dead silence loses the viewer.

Tell the user briefly if durations changed materially from the approved storyboard.

---

## Save timing data for Step 5

The final beat timings (real-audio-derived `start` and `duration`) live in STORYBOARD.md. Step 5 uses them as `data-start` / `data-duration` on each scene host div.

---

## Music (already fetched in Step 3 — verify timing only)

Music is decided in Step 2 (yes/no/auto), fetched and analyzed in Step 3's Music Fetch sub-step (which writes `**Music file:**`, `**Music direction:**`, and `**Music structure:**` into STORYBOARD.md's Global Direction). **Do NOT re-fetch or re-ask here.** By the time you reach Step 4, the track is already on disk at `assets/music/<id>.<ext>` and the storyboard's beat timing already accounts for the track's peaks/drops.

What Step 4 does for music: **align VO timing against music structure if relevant.** If the track has a quiet intro before the first build, VO can start at the first build (typically 1-3s in). Note this in STORYBOARD.md's `**Narration start:**` field so Step 5 wires the VO `<audio>` `data-start` to match.

If the user supplied their own track (rather than the catalog), the Step 3 fetch step recorded that file path instead. Either way, Step 5 wires whatever `**Music file:**` points to as the BGM lane.

If Step 2 said no music, none of this applies — there's no `**Music file:**` line in Global Direction and Step 5 skips the music wire-up cleanly.

See [`background-music.md`](background-music.md) for the full model: when music helps vs hurts, the volume hierarchy under VO (`0.4–0.6` vs `0.7–0.9` pure-music), manual ducking patterns since there's no auto-ducking, and the one-bed-per-video rule.

---

## Captions (automated — no sub-agent, decided in Step 2)

Captions are produced deterministically by `scripts/captions.mjs` after Step 5 builds the compositions and `scripts/w2h-prep.mjs` has emitted `group_spec.json` + per-scene words. **Do not dispatch a captions sub-agent.** The script runs in ~tens of ms with zero LLM calls.

**Do NOT ask the user about captions here.** The narration/text decision is locked in Step 2 (3-option brief: voiceover only / on-screen captions / no narration text). If Step 2 picked option (b) on-screen captions, Step 5's captions sub-step runs the commands below. Otherwise — skip them entirely.

If captions are enabled (Step 2 picked option b), between Step 5's worker beats and the assembler, run (pass `--cli` so the script's internal `add <skin>` call uses the local CLI; or `export HYPERFRAMES_CLI=...` once):

```bash
# After Step 5 builds compositions/beat-*.html:
node skills/website-to-hyperframes/scripts/w2h-prep.mjs --hyperframes .
# Then between Step 5 and Step 6 finalize:
node skills/website-to-hyperframes/scripts/captions.mjs group \
  --hyperframes . --group-spec ./group_spec.json \
  --tokens design-system/chunks/tokens.css --out ./caption_groups.json
node skills/website-to-hyperframes/scripts/captions.mjs html \
  --hyperframes . --groups ./caption_groups.json \
  --tokens design-system/chunks/tokens.css \
  --inference design-system/inference.json \
  --out compositions/captions.html
```

The first command emits per-word groups (silence-gap + sentence-end + density-modulated cap rules). The second installs the chosen registry skin (`caption-pill-karaoke` for warm/neutral tone, `caption-highlight` for direct/loud — ties resolve to pill-karaoke), patches it with `tokens.css` and pre-computed groups, and writes `compositions/captions.html`. The main agent's `index.html` assembler mounts the file as track 12 if it exists; if either script skipped (no words, no tokens), no captions composition is produced and no track is mounted — clean no-op.

If no captions, skip both commands entirely. No artifact, no track.
