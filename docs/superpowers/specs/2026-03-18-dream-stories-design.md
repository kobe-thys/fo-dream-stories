# FO's Dream Stories — Product Design Spec
**Date:** 2026-03-18
**Author:** FriendlyOnion (@FOs_dream_stories)
**Status:** Approved

---

## 1. Vision

A mobile-first web app that recreates the magic of a parent telling bedtime stories to their children — an interactive dream world built around a hexagonal map, where each story is a place to explore, and every child's imagination shapes the world they leave behind.

Rooted in a real ritual: a father telling his boys to close their eyes, breathe deep, and walk toward the light at the end of the dark tunnel — into a world of their own making. The Mother Tree is their base. The map is their world.

---

## 2. Product Overview

**Platform:** Mobile-first web app (Next.js), optimised for iPad and phone. No app store required at launch. Instagram (@FOs_dream_stories) used as a promotional funnel.

**Users:**
- **Families** — one account per family, created and managed by a parent
- **Child profiles** — up to 4 profiles per family account, each with independent map progress and dream journal
- **Admin (owner)** — private panel for content and map management

**Book:** A future physical product, built from real children's dreams collected through the platform. Not in scope for this build.

---

## 3. The Core Loop

```
Open map → tap a reachable story tile → screen goes black →
listen to story intro (own voice narration) → imagine & finish the story →
screen stays dark until tap or movement →
next session: submit dream (text / voice / drawing) →
AI generates dream image → accept / rework / skip →
tile marked complete, personal token placed on map →
Alex's tip revealed as reward →
"Share with other dreamers?" opt-in toggle
```

---

## 4. The Map

### 4.1 Structure
- Hexagonal tile grid, same underlying world for all families
- Mother Tree at the centre — always visible, always accessible
- Named story locations match the existing drawio map (The Tinkle Trunk, The Upside-down Waterfall, Raindrop Castle, Sun Cave, Elven Forest / Enid's Kingdom, Dragon Mountains, Syrup Tree, Mt. Clastonia, The Lighthouse, The Sunken Elven Ship, The Once-in-a-Lifetime Portal, The Griffon in the Echoing Queen Conch Shell, Pegasus, and others)
- Terrain tiles (Forest, Land, Water, Mountain) connect story tiles — no story content, free to pass through

### 4.2 Tile States

| State | Appearance | Behaviour |
|---|---|---|
| Mother Tree | Purple, always visible | Start point, never locked |
| Story — unlocked | Blue | Tap to begin story experience |
| Story — completed | Blue + gold border + personal token | Dream submitted, Alex's tip revealed |
| Story — locked | Dark grey, name visible | Unlocks when specific adjacent story is completed |
| Terrain — open | Green with terrain art (post-MVP) | Tap for sensory description |
| Terrain — fogged | Mid grey | Visible but not yet passable |
| Unknown | Completely dark | Beyond current reach, invisible |

### 4.3 Tile Completion State
A story tile is **complete** when the child has submitted a dream (Phase 3). Listening to the story alone (Phase 2) does not complete the tile — it sets the tile to a "listened" sub-state (tracked in the database but not visually distinct). This means:
- Terrain around the tile does **not** open after listening — only after dream submission
- Alex's tip is **not** revealed after listening — only after dream submission
- A child can listen without submitting; the tile stays "unlocked" and they can submit later

### 4.4 Navigation Rules
1. Start at Mother Tree. Its immediate adjacent story tiles unlock on account creation.
2. Completing a story tile (submitting a dream) opens surrounding terrain tiles and unlocks the next story tile(s) in that direction.
3. Terrain tiles are always free — no submission required. Tap for a brief descriptive sensory moment (a line of evocative text: what you hear, what you smell, what you feel underfoot). Sound effects may accompany this post-MVP.
4. A new **region** (e.g. Elven Forest, Dragon Mountains) only opens when its designated gateway story tile is completed. The admin defines which story unlocks which region.
5. Deep unknown tiles remain dark until the admin adds a new story tile and connects it to the network.
6. The admin never needs to touch code to expand the map.

### 4.5 Visual Polish (post-MVP)
- Terrain tiles display illustrated art: trees for forest, waves for water, rock faces for mountains
- Option for a 2D illustrated top-down view with a 3D fly-through mode for region entry moments
- Art style: children's illustrated storybook, warm colours, soft lighting

---

## 5. The Story Experience

### Phase 1 — Entry (screen on)
- Tap a story tile on the map
- Screen shows: story title, location art, two options:
  - **"Read it to me"** — scrollable text, parent reads aloud
  - **"Play it for me"** — audio narration plays

### Phase 2 — Dream Mode (screen goes black)
- Screen fades to black. No text. No prompts. Soft pulsing light only.
- Narration plays (recorded in the owner's own voice for all 50 launch stories).
- Screen stays completely dark until the child taps or moves the mouse/finger.
- No automatic prompts or timers. Darkness is the experience.
- On wake: a single gentle message — *"Sweet dreams. Come back tomorrow to tell us what you found."* Then return to map.

### Phase 3 — Dream Submission (next session or next morning)
- The completed tile glows on the map: *"How did your adventure end?"*
- Three submission options (any one counts as a valid submission):
  - **Write it** — text input, parent types for young children
  - **Tell it** — voice recording via device microphone. On submit, audio is transcribed to text using OpenAI Whisper API. If transcription fails, the user sees: *"We couldn't hear that clearly — want to try again or type it instead?"* and is offered the text input fallback.
  - **Draw it** — finger drawing canvas or photo upload of a paper drawing. The drawing/photo is sent to GPT-4o Vision to generate a text description of what was drawn. That description is then passed to DALL-E 3 for image generation. If vision analysis fails, the user is offered the text input fallback.
- The resulting text (typed, transcribed, or vision-described) is sent to DALL-E 3 with the fixed style prompt: *"Children's illustrated storybook style, dreamlike, warm colours, soft lighting, magical forest world, safe and wonder-filled"*
- Child sees the generated image and chooses:
  - **Accept** — image becomes their tile token on the map
  - **Try again** — regenerates (max 3 attempts per submission session; limit resets if child returns later and submits again)
  - **Skip** — tile gets a default illustrated token based on story location
- When the 3-attempt limit is reached, only **Accept** (the last image) or **Skip** are offered.
- If DALL-E 3 returns an error at any point, the child is shown: *"Something went wrong with the picture — want to skip and use a default image?"* and offered the Skip option.
- Tile is marked complete. Alex's tip is revealed. Opt-in sharing prompt appears.

### Alex's Tip
Alex is the owner's youngest son. After each story was told, Alex would describe what he had dreamed and discovered. His version — his actual imagination — is stored as the "Alex's tip" for each story tile. It is a short paragraph (2–5 sentences) written in a child's voice, describing what Alex found in that location: what he saw, what happened, what he discovered. It is revealed only after the child submits their own dream, as a reward — a moment of *"here's what another kid found, now compare it to yours."* The admin panel stores one Alex's tip per story tile. It is plain text, displayed in a styled card after dream submission.

### Audio Narration
- First 50 stories: recorded by the owner in his own voice. Personal, warm, authentic.
- Future stories: owner's voice cloned via ElevenLabs for scalable generation.
- Real recordings preserved for the most important stories (Mother Tree intro, all region gateway stories).

---

## 6. Social Layer

- Shared dreams appear on the tile for other families after they submit their own dream — discovery is a reward, not a shortcut
- Tile shows a small gallery: *"3 other kids explored this place"*
- Each shared dream shows: AI-generated image (or default token if skipped), dream text, first name and age only (e.g. *"Emma, age 7"*)
- No comments, no likes, no full usernames — safe and age-appropriate by design

**Moderation flow:**
- On submission with sharing enabled, the dream text passes through OpenAI moderation API automatically
- If flagged: dream is saved privately (child sees it on their own map) but not made public. Child sees: *"Your dream is saved! We're just making sure it's ready to share with other kids."* No alarm, no rejection message.
- If approved: dream becomes visible to other families on that tile immediately
- Owner can review all shared dreams in the admin panel and remove any content manually at any time
- Parent of the sharing child can withdraw their child's shared dream at any time from the child's profile settings

---

## 7. Accounts & Profiles

- **Family account:** email + password, created by a parent. Holds subscription, billing, settings, and parental controls.
- **Child profiles:** up to 4 per family. Each has: name, date of birth (stored), and computed age (calculated from DOB at display time so it stays accurate). Each profile has its own map state, dream journal, and token collection.
- **No child accounts independently** — always under a parent's family account.
- Parents manage sharing permissions per child profile.
- **Legal compliance:** The app collects personal data from children (names, ages, voice recordings, drawings, dream text). A legal review for COPPA (US) and GDPR-K (EU) compliance is required before public launch. This affects: what data is stored, parental consent flows, data deletion rights, and the sharing mechanism. Account creation must include explicit parental consent.

---

## 8. Admin Panel

Private dashboard accessible only to the owner and designated collaborators:

- Add/edit story tiles: title, map position, story text, audio file upload, Alex's tip, unlock dependencies (which tile(s) this completion unlocks)
- Add/edit terrain tiles: type (forest/land/water/mountain), map position, sensory moment text
- Define unlock graph: which completed story unlocks which tile or region
- Moderate shared dreams: review all public dreams, remove flagged content
- View stats: active families, tile exploration rates, dream submission rate, most-shared stories
- Beta access controls: enable/disable open signup, manage beta invite codes or cap counter

No code changes required to expand the map.

---

## 9. Rough Data Model (Supabase / PostgreSQL)

```
families
  id, email, password_hash, subscription_status, created_at

child_profiles
  id, family_id, name, date_of_birth, created_at

tiles
  id, type (story | terrain | mother_tree), name, position_x, position_y,
  terrain_type (forest | land | water | mountain | null),
  story_text, audio_url, alex_tip, sensory_moment_text,
  default_token_image_url, created_at

tile_unlocks
  id, from_tile_id, to_tile_id
  (defines the unlock graph: completing from_tile_id unlocks to_tile_id)

child_tile_states
  id, child_profile_id, tile_id,
  state (locked | unlocked | listened | completed),
  listened_at, completed_at

dream_submissions
  id, child_profile_id, tile_id,
  input_type (text | voice | drawing),
  raw_input_url (audio file or drawing image, if applicable),
  transcribed_text,
  generated_image_url,
  is_shared (bool), share_approved (bool),
  created_at

shared_dreams
  id, dream_submission_id, visible (bool), flagged (bool), removed_at
```

---

## 10. Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Frontend | Next.js (React) | Mobile-first, fast, iPad-optimised |
| Database + Auth + Storage | Supabase | Single platform for users, data, file storage |
| Hosting | Vercel | Free tier covers early traffic |
| Audio narration | Owner's recorded voice + ElevenLabs voice clone | Real voice for launch, cloned voice for scale |
| Voice transcription | OpenAI Whisper API | Converts voice recordings to text |
| Drawing analysis | GPT-4o Vision | Converts drawings to text descriptions for image generation |
| AI image generation | DALL-E 3 (OpenAI API) | ~$0.04/image, only on dream submission |
| Content moderation | OpenAI Moderation API | Free, runs on all shared dream text before publishing |
| Instagram | Canva + Later | Post design and scheduling |

**Estimated monthly cost at launch:** under $20/month (Vercel free, Supabase free to 50k users, ElevenLabs ~$5/month, OpenAI APIs pay-per-use).

---

## 11. Monetisation

**Launch phase (beta):** Free for the first 100 subscribers. Beta cap enforced via a counter in the admin panel — when the counter hits 100, signup shows a waitlist form instead of account creation. Admin can raise or remove the cap at any time.

**Growth phase:** Simple subscription model.
- Suggested pricing: ~$3-5/month or ~$20/year per family
- Terrain tiles always free (movement = exploration = engagement)
- Story tiles and dream submission included in subscription
- No coin mechanic at launch — introduce later as a bonus/gamification layer if desired

**Why subscription over coins:** Recurring revenue vs. one-time purchase. 10,000 subscribers at $20/year = $200k/year. Coins can complement subscription later (earn coins by sharing your dream, spend on extras).

---

## 12. Content Strategy

- **Launch target:** 50 stories ready before public launch
- Stories written in sequence — later stories reference earlier ones
- Each story: intro text + audio recording + Alex's tip + designated map position + unlock dependencies
- Stories written and recorded in parallel with the technical build
- Instagram used to build audience pre-launch: story previews, behind-the-scenes, the origin story

---

## 13. Launch Sequence

1. Build MVP: map (5-10 tiles), story experience (black screen + audio), dream submission, Alex's tip reveal
2. Internal test with real children (owner's network)
3. Write and record all 50 stories in parallel with build
4. Legal review (COPPA / GDPR-K compliance) before any public launch
5. Beta launch: first 100 subscribers free, gather feedback
6. Iterate on UX, add visual polish to map tiles
7. Public launch with subscription model
8. Expand map continuously — new regions, new stories, keep the world growing
9. Physical book when sufficient dream content collected from community

---

## 14. Error States & Empty States

| Situation | User sees |
|---|---|
| Audio file fails to load | "We're having trouble playing the story — try refreshing, or ask a parent to read it to you." Read-it-to-me text shown as fallback. |
| DALL-E 3 API error | "Something went wrong with the picture — want to skip and use a default image?" Skip option offered. |
| Voice transcription fails | "We couldn't hear that clearly — want to try again or type it instead?" Text input shown as fallback. |
| Drawing vision analysis fails | "We had trouble reading your drawing — want to describe it in words instead?" Text input shown as fallback. |
| No internet mid-story | Dream mode continues (audio should be buffered before starting). On reconnect, submission is enabled. |
| Child profile limit reached (5th profile attempt) | "You've reached the maximum of 4 child profiles. Contact us if you need more." |
| Waitlist (beta cap hit) | Signup replaced with waitlist form — email captured, user told they'll be notified when a spot opens. |

---

## 15. Out of Scope (for now)

- Native iOS/Android app (website first, app later if warranted)
- Coin economy (post-launch feature)
- 3D map view (post-MVP visual enhancement)
- Physical book (future product)
- Multi-language support (future)
- Sound effects for terrain tiles (post-MVP)
