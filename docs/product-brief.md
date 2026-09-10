# FO's Dream Stories — Product Brief

**Version:** 1.0
**Date:** 2026-03-20
**Author:** Kobe Thys (@FOs_dream_stories)

---

## The Idea in One Sentence

A bedtime story world that a child builds with their own imagination — one dream at a time.

---

## Where It Comes From

Every night, Kobe tells his two boys (Alex and Matthias) to close their eyes, breathe deep, and walk toward the light at the end of the dark tunnel. Into a world of their own making. The Mother Tree is their base. The map is their world.

Alex — the younger one — would always describe, in vivid detail, exactly what he found. The Tinkle Trunk. The Upside-down Waterfall. Raindrop Castle. Syrup Tree. He has already mapped an entire world.

FO's Dream Stories is that world, made real.

---

## What It Is

A **mobile-first web app** for families. Parents read or play magical bedtime stories to their children on a **hexagonal dream map**. After each story, the child imagines and submits their dream. AI generates a personalised dream image as a token, placed permanently on the child's map. Alex's (the creator's son's) real dream for that location is then revealed — as a reward, a comparison, a moment of *"here's what another kid found."*

The map grows as the child completes stories. Every tile the child visits is theirs. Every dream they submit leaves a mark.

---

## The Core Loop

```
Open map
→ Tap a reachable story tile
→ Listen to the story (or read along)
→ Screen goes dark — imagine the world
→ Tap when ready — "Sweet dreams. Come back tomorrow."
→ Next session: tell us what you found (text / voice / drawing)
→ AI generates your dream as an image
→ Accept it, try again, or skip
→ Tile marked complete. Token placed on your map.
→ Alex's dream revealed as a reward.
→ "Share with other dreamers?" (opt-in)
```

---

## The Map

- **Hexagonal grid** — same underlying world for all families, each child's map reflects their own progress
- **Mother Tree at the centre** — always accessible, the anchor and starting point
- **Story tiles** expand outward — each completion unlocks adjacent tiles and reveals new territory
- **Terrain tiles** (forest, water, mountains, meadow) connect the world — free to pass through, with a brief sensory description on tap
- **Unknown territory** stays dark until unlocked — the world grows with the child

### Tile State Philosophy

Every tile follows a strict state progression driven by the child's progress.

**Tile types**
- **Undefined** — no type; invisible to dreamers (architect only)
- **Terrain** — landscape tiles (forest, water, mountains); passable, no story
- **Story** — named locations linked to a story record
- **Mother Tree** — fixed anchor tile; always the first story available

**States**

| State | Visual | Meaning |
|---|---|---|
| Hidden | Not rendered | Has `linkedToStoryId`; parent dream not yet submitted |
| Grey | Slightly darker than full colour | No parent link, OR parent dream just submitted |
| Revealed | Full colour | Terrain: tapped once. Story: listened or read. |
| Completed | Full colour + amber glow | Story: dream submitted |

**State logic**
1. `linkedToStoryId = null` → tile starts as **Grey** (terrain or story)
2. `linkedToStoryId = Sxxx` → tile starts **Hidden**; becomes **Grey** once Sxxx dream is submitted
3. Terrain tile tapped → if Grey: state becomes Revealed; FO panel always shown
4. Story tile tapped (Grey) → show story pane (Listen / Read). After listening/reading → Revealed
5. Story tile (Revealed) tapped → show pane (Listen again / Read again / Submit dream). After submit → Completed; linked tiles become Grey
6. Story tile (Completed) tapped → show full pane (listen/read again, submit new dream, see other dreamers)

### Current map (as of launch)
13 named story locations designed by Alex, including:
The Tinkle Trunk · The Upside-down Waterfall · Raindrop Castle · Sun Cave · Elven Forest / Enid's Kingdom · Dragon Mountains · Syrup Tree · Mt. Clastonia · The Lighthouse · The Sunken Elven Ship · The Once-in-a-Lifetime Portal · The Griffon in the Echoing Queen Conch Shell · Pegasus

Target: **50 stories ready before public launch**.

---

## The Story Experience

### Phase 1 — Choose your mode
Tap a tile → popup with two options:
- **Listening mode** — screen goes fullscreen dark, story plays (TTS now, owner's recorded voice at launch)
- **Reading mode** — story text on screen, parent reads aloud

### Phase 2 — Dream mode
Screen fades to black. No text, no prompts, no timers. A soft pulsing light. The darkness is the experience. The child imagines. A gentle tap wakes them: *"Sweet dreams. Come back and tell us what you found."*

### Phase 3 — Dream submission (next session)
- **Write it** — type a description (parent types for young children)
- **Tell it** — voice recording, transcribed via OpenAI Whisper
- **Draw it** — finger drawing or photo upload, described via GPT-4o Vision
- **DALL-E 3** generates the dream image from the description
- Child accepts, tries again (max 3), or skips (default token used)
- Tile marked complete. Alex's tip revealed. Optional sharing enabled.

---

## FO — The Mascot

FO is a warm, Pixar-style anthropomorphic onion with a burlap backpack full of storybooks. He lives in the Mother Tree. He guides children through the world — appearing next to story popups, reacting to what the child does, encouraging them forward.

He is not a narrator. He is a companion.

*"I know this story well. I helped write it."*
*"Tap the tile to hear the story, or read along with a grown-up."*
*"What did you find in there? I can't wait to hear."*

---

## Alex's Dream

After each story was told, Alex would describe — in his own words — what he found. His actual imagination, his real version of the world. That description lives in the app as **Alex's tip**: a short paragraph, written in a child's voice.

It is revealed only after the child submits their own dream. It is a reward, not a shortcut. The moment of comparison — *"here's what another kid found, now compare it to yours"* — is the emotional heart of the product.

---

## The Social Layer

- **Shared dreams** appear on tiles after a family submits their own — discovery is a reward, not a shortcut
- Each tile shows: generated image (or default token), dream text, first name and age only (e.g. *"Emma, age 7"*)
- No comments, no likes, no full usernames — safe and age-appropriate by design
- Automated moderation via OpenAI Moderation API before any dream is made public
- Owner can remove any content from the admin panel; parents can withdraw their child's shared dream

---

## Accounts

- **Family account** — one per family, managed by a parent (email + password)
- **Child profiles** — up to 4 per family account, independent map progress and dream journal
- Each profile: name, date of birth (age computed dynamically), sharing permissions
- Legal compliance (COPPA / GDPR-K) required before public launch — parental consent flow, data deletion rights

---

## The Admin Panel (Plan 4 — next)

Private dashboard for the owner:
- Add/edit story tiles: title, map position, story text, audio upload, Alex's tip, unlock rules
- Add/edit terrain tiles: type, map position, sensory moment text
- Define the unlock graph: which completed story unlocks which tile
- Moderate shared dreams: review, approve, remove
- View stats: active families, tile exploration rates, dream submission rates, most-shared stories
- Beta access controls: cap signup at N users, manage invite codes

**No code changes required to expand the map.** This is a design principle.

---

## Audio

- **At launch:** owner's own voice, recorded for all 50 stories. Personal, warm, authentic.
- **At scale:** owner's voice cloned via ElevenLabs for new story generation.
- Real recordings always preserved for the most important stories (Mother Tree intro, all region gateway stories).

---

## Business Model

**Beta phase:** Free for the first 100 families. Admin-controlled signup cap. Waiting list when cap is hit.

**Growth phase:** Subscription
- ~$3–5/month or ~$20/year per family
- All terrain tiles always free (movement = exploration = engagement)
- Story experience and dream submission included in subscription
- Coin mechanic possible later as a bonus gamification layer

**Why subscription:** 10,000 subscribers at $20/year = $200k/year. Simple, predictable, family-friendly pricing.

**Future:** Physical book built from real children's dreams collected through the platform.

---

## Tech Stack

| Layer | Tool |
|---|---|
| Frontend | Next.js 16 (App Router), TypeScript, Tailwind v4 |
| Database + Auth + Storage | Supabase (PostgreSQL + RLS) |
| Hosting | Vercel |
| Voice transcription | OpenAI Whisper API |
| Drawing analysis | GPT-4o Vision |
| AI image generation | DALL-E 3 |
| Content moderation | OpenAI Moderation API |
| Audio narration | Owner's voice + ElevenLabs (future) |

**Estimated monthly cost at launch:** under $20/month.
**DALL-E 3 cost:** ~$0.04/image, only triggered on dream submission.

---

## Build Progress

| Plan | Status | What it covered |
|---|---|---|
| 1 — Foundation | ✅ Complete | Auth, family/child profiles, map data model, hex grid |
| 2 — Visual + Map | ✅ Complete | Hex tile states, fog logic, FO mascot, pan/zoom |
| 3 — Story Experience | ✅ Complete | Listening/reading modes, dream submission, AI image generation, Alex's dream reveal |
| 4 — Admin Panel | ⏳ Next | Story/audio upload, tile management, moderation, stats |
| 5 — Social Layer | 🔜 Planned | Shared dreams, community gallery per tile |
| 6 — Polish + Launch | 🔜 Planned | Real audio recordings, tile illustrations, COPPA/GDPR review, beta cap |

---

## What Makes This Different

1. **It's real.** The world was created by a real child (Alex). The stories are true bedtime rituals. The emotional core is personal.
2. **The child builds it.** Every token on the map is the child's own dream, in their own words, visualised by AI. The map is a diary.
3. **It earns the reward.** Alex's dream is only revealed after the child submits their own. The sequence matters.
4. **It's safe by design.** No usernames, no comments, no algorithmic feed. Sharing is opt-in and moderated.
5. **It grows forever.** The admin can keep expanding the world. No code changes required.

---

## The Vision

This is not an app. It is a world.

Every night, somewhere, a child taps a hexagonal tile on a dream map and enters a story. They imagine their version. They tell someone what they found. Their dream becomes permanent — a token on the map, a mark they left on the world.

Years from now, that child looks at their map and sees every story they ever entered. Every dream they ever told. Their imagination, rendered in watercolour and light.

That is the product.
