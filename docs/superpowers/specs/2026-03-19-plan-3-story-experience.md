# FO's Dream Stories — Plan 3: Story Experience
**Date:** 2026-03-19
**Status:** Draft
**Depends on:** `2026-03-18-dream-stories-design.md` (product vision)

---

## Vision

Plan 3 delivers the core story experience end to end: from tapping a tile on the hex map, through listening or reading, into the dark dreaming phase, and out the other side with a child's dream captured, illustrated by AI, and permanently placed on their personal map. This is the heart of the product. Everything in Plan 3 is in service of that moment — a child seeing their own imagination rendered as art on the world they are building.

---

## 1. New Tile State: `revealed`

### 1.1 State Machine

A fifth tile state is added between invisible (not rendered) and `unlocked`: **`revealed`** (fogged).

| State | Who applies | Appearance | Behaviour |
|---|---|---|---|
| invisible | default | Not rendered at all | Tile does not appear on map |
| `revealed` | unlock propagation | Silhouette + "?" | Visible but name and details hidden; tap to clear fog |
| `unlocked` | tap on `revealed` | Full tile art, name visible | Tap to open story popup or terrain moment |
| `listened` | completing story mode | Full tile art + gentle glow | Tap to open dream submission |
| `completed` | dream submission accepted/skipped | Full tile art + personal token | Dream locked in, Alex's dream revealed |

State machine by tile type:

- **Mother Tree:** always `unlocked` on account creation. Never changes.
- **Story tiles:** invisible → `revealed` → `unlocked` → `listened` → `completed`
- **Terrain/path tiles:** invisible → `revealed` → `unlocked`

### 1.2 Replacing `locked`

The existing `locked` state in the DB is retired. Tiles that were previously `locked` are simply not rendered (invisible). The DB migration adds `revealed` as a valid value for `child_tile_states.state` and removes `locked`.

Any existing rows with `state = 'locked'` should be deleted (the tile will be invisible, which is the correct new behaviour).

### 1.3 `revealed` Appearance

A `revealed` tile renders as a muted silhouette in the tile's hex shape — greyed out, slightly desaturated — with a "?" centred in it. No tile name. No type indicator. Tapping it clears the fog.

### 1.4 Unlock Propagation — Terrain Tiles

When a story tile is completed and unlock propagation runs, terrain tiles in the unlock graph move to `revealed` (not directly to `unlocked`). They require the child to tap them to move to `unlocked`. Terrain tiles do NOT auto-promote to `unlocked` via propagation.

---

## 2. Tile Popup — Entry

### 2.1 Tapping a `revealed` Tile

1. Fog clears. Tile animates from silhouette to full tile art (short fade-in, ~300ms).
2. Tile state → `unlocked` in DB.
3. **Terrain tiles:** a sensory moment is shown briefly as an overlay (1–2 lines of evocative text — what you hear, smell, feel underfoot). Dismisses on tap or after 4 seconds. No further action.
4. **Story tiles:** immediately continues to the standard entry popup (section 2.2 below).

### 2.2 Tapping an `unlocked` Story Tile

The tile physically lifts and hovers. A speech bubble popup appears above it.

**Popup contents:**
- Tile name (large, styled)
- Flavour line (1–2 sentences of scene-setting text from the DB)
- FO's speech bubble: *"Tap the tile to peek at Alex's dream"* (shown only if `alex_dream_image_url` is not null)
- Two large buttons: **Listening mode** and **Reading mode**

**The hovering tile:**
- The back of the hovering tile shows Alex's dream image (`alex_dream_image_url` from the `tiles` table).
- Tapping the tile (not the buttons) flips it to reveal Alex's dream image on the back. A second tap flips it back to the front.
- Tapping outside the popup closes it and the tile returns to its position.
- **If `alex_dream_image_url` IS NULL:** the tile flip is disabled entirely. FO does not mention Alex's dream. The tile does not hover/lift. The popup shows only the mode buttons. The tile flip mechanic is only active for tiles where the image has been populated (via admin panel in Plan 4).

### 2.3 Tapping a `listened` Story Tile

The tile lifts and hovers (same as `unlocked`). The flip to show Alex's dream image is still available.

**Popup contents:**
- Tile name (large, styled)
- Flavour line
- FO's speech bubble: *"Tap the tile to peek at Alex's dream"* (shown only if `alex_dream_image_url` is not null)
- A single **"Tell us your dream"** button (instead of the two mode buttons)

### 2.4 Tapping a `completed` Story Tile

**Popup contents:**
- Tile name (large, styled)
- The child's accepted dream image (token)
- Alex's dream paragraph (`alex_tip` text from DB, displayed under the heading "Alex's Dream")
- A **"Read it again"** button — opens Reading mode only. No new dream mode, no new submission.
- No "Tell us your dream" button.

---

## 3. Story Modes

### 3.1 Listening Mode

**Audio pre-fetch and loading state:**

Before the screen goes black, the audio URL or TTS is pre-fetched. The screen shows a brief *"Preparing your story..."* loading state while the audio is being fetched. Once ready, the screen goes black.

If the audio fetch fails: the screen shows the error message *"We're having trouble loading the story — try refreshing, or use Reading mode instead."* with a **"Read it to me"** fallback button that switches to Reading mode.

**Playback:**

1. Screen goes fully black — fullscreen takeover, no UI chrome.
2. Soft pulsing light appears in the centre of the screen.
3. TTS plays the story text. **Placeholder:** browser `speechSynthesis` API. **Production:** `audio_url` from DB when populated (checked first; falls back to `speechSynthesis` if null or if the audio file fails to load).
4. Taps are ignored while audio is playing.
5. When audio finishes (or `speechSynthesis` ends), the following text fades in: *"Sweet dreams. Come back and tell us what you found."*
6. Tap anywhere → return to map. Tile state → `listened`.

**Gate rule:** Tile state changes to `listened` only when the "Sweet dreams" message has been displayed and the user taps to dismiss it. This message is the only path to `listened`.

### 3.2 Reading Mode

1. Full-screen parchment/warm page. Large, readable text (the story text from DB).
2. Parent reads aloud at their own pace.
3. **"Start dreaming"** button at the bottom.
4. Tapping "Start dreaming" → screen fades to black (same dark phase as listening mode).
5. **Minimum timer: 120 seconds.** Taps do nothing before the timer expires.
6. After 120 seconds, the screen becomes tappable. First tap shows the text overlay: *"Sweet dreams. Come back and tell us what you found."* (screen stays black). Second tap dismisses and returns to map, setting `listened` state.

**Gate rule:** same as listening mode — `listened` only set after "Sweet dreams" is displayed and dismissed.

---

## 4. Map — `listened` State

- A `listened` tile shows a gentle continuous glow/pulse on the map to draw attention.
- **Note:** This intentionally evolves the original design spec which said `listened` was not visually distinct. The glow is needed to prompt dream submission.
- Tapping it opens the speech bubble popup (section 2.3).

---

## 5. Dream Submission Drawer

Slides up from the bottom of the screen as a full-width drawer. Three tabs across the top: **Write it**, **Say it**, **Draw it**.

**Same-session submission:** Plan 3 allows same-session dream submission. No time gate is enforced between listening to a story and submitting a dream. The child can submit immediately after the "Sweet dreams" screen.

### 5.1 Write it

- Text area. Parent types for young children, older children type themselves.
- Submit button is disabled until the text area contains at least 1 non-whitespace character.
- Submit button sends text directly to image generation flow (section 6).

### 5.2 Say it

- Large microphone button. Tap to start recording via device microphone (`MediaRecorder` API).
- Tap again to stop.
- **Maximum recording duration: 3 minutes.** At 3 minutes, recording auto-stops and proceeds to the confirmation view automatically.
- Audio blob uploaded to Supabase Storage bucket `dream-inputs` (path: `{child_profile_id}/{tile_id}/{uuid}.webm`) before the API route is called. The resulting public Storage URL is stored in `raw_input_url`.
- Audio sent to `POST /api/transcribe` (Whisper API, section 9).
- Transcribed text shown in a confirmation view: *"Here's what we heard — does that sound right?"* with Edit and Submit buttons.
- **Fallback if transcription fails:** *"We couldn't hear that clearly — want to type it instead?"* with a button to switch to the Write it tab.

### 5.3 Draw it

- Simple finger-drawing canvas (HTML5 `<canvas>`). Full-width, 320px tall. Black stroke on white background. Stroke width 3px.
- Canvas controls: **Undo** button (removes last stroke) and **Clear** button (resets canvas entirely).
- Submit button is disabled if the canvas is entirely blank (no strokes drawn).
- Alternative: photo upload button for photos of paper drawings. Accepts `image/*` only, max 10MB. Invalid file type or oversized file shows inline error: *"Please upload an image file under 10MB."*
- Drawing image uploaded to Supabase Storage bucket `dream-inputs` (path: `{child_profile_id}/{tile_id}/{uuid}.png`) before the API route is called. The resulting public Storage URL is stored in `raw_input_url`.
- Submission sends image (as base64) to `POST /api/describe-drawing` (GPT-4o Vision, section 9).
- Generated text description shown in a confirmation view: *"Here's what we saw in your drawing — does that sound right?"* with Edit and Submit buttons.
- **Fallback if vision analysis fails:** *"We had trouble reading your drawing — want to describe it in words?"* with a button to switch to the Write it tab.

### 5.4 Image Generation

All three paths produce a confirmed text description. That text is sent to `POST /api/generate-image` (DALL-E 3, section 9) with the fixed style prompt appended:

> *"Children's illustrated storybook style, dreamlike, warm colours, soft lighting, magical forest world, safe and wonder-filled"*

**If DALL-E 3 returns an error:** *"Something went wrong with the picture — want to skip and use a default image?"* Skip option offered.

---

## 6. Image Acceptance

Child sees the generated image full-screen. Three options:

- **Accept** — image becomes their tile token.
- **Try again** — regenerates. Max 3 attempts total. After the 3rd attempt, only **Accept** and **Skip** are offered. No confirmation dialog for "Try again" — the 3-attempt limit is visible so the child/parent is informed.
- **Skip** — tile gets `default_token_image_url` from the `tiles` table.

**Attempt limit behaviour:** The 3-attempt limit is per submission session, enforced in UI state only (not stored in DB). If the child closes the drawer and returns later, the limit resets to 3.

On **Accept** or **Skip**:

1. A `dream_submissions` row is inserted (schema in section 10).
2. Tile state → `completed`.
3. Alex's dream paragraph revealed: a card slides up below the accepted/default image, showing Alex's version of events for this tile (short paragraph in a child's voice, stored in DB as `alex_tip`). This is the reward.
4. **Unlock propagation:** all `tile_unlocks` rows where `from_tile_id` = this tile's ID are processed. Their target tiles move from invisible → `revealed` and pop up on the map with animation (section 8). Terrain tiles in the unlock graph move to `revealed` — they do NOT auto-promote to `unlocked` (see section 1.4).
5. **Opt-in sharing prompt:** *"Share your dream with other kids?"* toggle (defaults off). Sets `is_shared` on the `dream_submissions` row. Moderation and public display are out of scope for Plan 3 — the field is captured here for Plan 5.

---

## 7. Map Pan and Zoom

- **Mobile:** pinch to zoom, drag to pan.
- **Desktop:** scroll wheel to zoom, click-drag to pan.
- **Library:** `react-zoom-pan-pinch`.
- **Zoom range:** 0.5× – 2×.
- The map container is no longer fixed at 600×600px. It grows as new tiles are added. The `react-zoom-pan-pinch` wrapper handles overflow and clipping.

---

## 8. New Tile Appearing — Animation

When unlock propagation moves tiles from invisible → `revealed` (section 6, step 4):

- Each newly revealed tile pops up with a scale animation: scale 0 → 1 over ~400ms with a subtle overshoot bounce (e.g. CSS spring or `framer-motion` spring preset).
- Tiles appear in fogged/silhouette state after the animation settles.
- If multiple tiles unlock simultaneously, stagger the animations by ~100ms per tile.

---

## 9. OpenAI API Routes

Three new Next.js server-side API routes. The `OPENAI_API_KEY` environment variable is used server-side only and is never exposed to the client.

### `POST /api/transcribe`

- **Receives:** multipart form data with audio blob.
- **Calls:** OpenAI Whisper API (`whisper-1` model).
- **Returns:** `{ text: string }` on success, `{ error: string }` on failure.

### `POST /api/describe-drawing`

- **Receives:** `{ image: string }` — base64-encoded image.
- **Calls:** GPT-4o Vision (`gpt-4o`) with the image and a prompt instructing it to describe the drawing as if describing a child's dream scene.
- **Returns:** `{ description: string }` on success, `{ error: string }` on failure.

### `POST /api/generate-image`

- **Receives:** `{ prompt: string }` — the confirmed dream text (style prompt is appended server-side).
- **Calls:** DALL-E 3 (`dall-e-3`, `1024×1024`, `standard` quality).
- **Returns:** `{ imageUrl: string }` on success, `{ error: string }` on failure.
- The generated image is fetched from OpenAI and stored in Supabase Storage bucket `dream-images` (path: `{child_profile_id}/{tile_id}/{uuid}.png`). The bucket is public. `generated_image_url` stores the public Storage URL (not the OpenAI URL, which expires). The storage step happens server-side inside this route before returning.

---

## 10. DB Changes

### 10.1 `child_tile_states.state` — Migration

Add `revealed` as a valid enum value. Remove `locked`. Postgres does not support `DROP VALUE` on an enum, so the type must be rebuilt:

```sql
-- Add 'revealed' to child_tile_states state enum
-- Postgres does not support DROP VALUE, so rebuild the type:
ALTER TYPE tile_state RENAME TO tile_state_old;
CREATE TYPE tile_state AS ENUM ('revealed', 'unlocked', 'listened', 'completed');
ALTER TABLE public.child_tile_states
  ALTER COLUMN state TYPE tile_state
  USING state::text::tile_state;
DROP TYPE tile_state_old;
-- Note: existing 'locked' rows should be deleted or updated before running this migration
-- (locked tiles will be invisible — not rendered — so they can simply be deleted from child_tile_states)
UPDATE public.child_tile_states SET state = NULL WHERE state = 'locked'; -- will fail type cast; delete instead:
DELETE FROM public.child_tile_states WHERE state::text = 'locked';
```

### 10.2 `dream_submissions` Table — New (Migration)

```sql
CREATE TABLE dream_submissions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_profile_id    uuid NOT NULL REFERENCES child_profiles(id) ON DELETE CASCADE,
  tile_id             uuid NOT NULL REFERENCES tiles(id),
  input_type          text NOT NULL CHECK (input_type IN ('text', 'voice', 'drawing')),
  raw_input_url       text,          -- audio file or drawing image in Supabase Storage (bucket: dream-inputs)
  transcribed_text    text,          -- confirmed text used for image generation
  generated_image_url text,          -- final image in Supabase Storage (bucket: dream-images)
  token_image_url     text,          -- accepted generated image or default_token_image_url
  is_shared           boolean NOT NULL DEFAULT false,
  created_at          timestamptz NOT NULL DEFAULT now()
);
```

**Multiple submissions:** Multiple `dream_submissions` rows per `(child_profile_id, tile_id)` are allowed — no unique constraint. The most recent row is canonical for map display.

**RLS policy:**

```sql
create policy "Families can manage their children dream submissions"
  on public.dream_submissions for all
  using (
    auth.uid() = (
      select family_id from public.child_profiles where id = child_profile_id
    )
  )
  with check (
    auth.uid() = (
      select family_id from public.child_profiles where id = child_profile_id
    )
  );
```

**`share_approved` column** is intentionally deferred to Plan 5 (Social Layer) and will be added in that migration.

### 10.3 `tiles` Table — New Column (Migration)

```sql
ALTER TABLE tiles
  ADD COLUMN alex_dream_image_url text;
```

This stores the AI-generated image of Alex's dream, shown on the back of the hovering tile in the entry popup (section 2.2).

### 10.4 `alex_tip` Column

The `alex_tip` column name is retained as-is. No rename migration is needed. It is referenced in code as `tile.alex_tip` and displayed in the UI under the heading "Alex's Dream."

### 10.5 `MappedTile` — Token Image Field

The map reads the token image for a `completed` tile by querying the most recent `dream_submissions` row for that `(child_profile_id, tile_id)` and using its `token_image_url`. This is fetched alongside tile states when the map loads.

`token_image_url` is added as a nullable field on `MappedTile`:

```ts
token_image_url?: string | null;
```

---

## 11. Out of Scope for Plan 3

The following are explicitly deferred:

- **Social sharing / shared dream gallery** — Plan 5
- **Content moderation** (OpenAI Moderation API) — Plan 5
- **Admin panel** for content entry (story text, audio, Alex's tips, unlock graph) — Plan 4
- **Sound effects** on terrain tiles — post-MVP
- **3D tile art** — post-MVP
- **ElevenLabs voice clone** — the `audio_url` field in DB is the hook; voice production is a content task separate from this build
