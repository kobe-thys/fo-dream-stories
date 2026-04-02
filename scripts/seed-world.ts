/**
 * Seed script: imports new_world.json into Supabase.
 * Run with: npx ts-node --project tsconfig.json scripts/seed-world.ts
 *
 * Requires env vars from /root/.secrets/tokens.env:
 *   SUPABASE_SERVICE_ROLE, NEXT_PUBLIC_SUPABASE_URL
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE!

const db = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false },
})

// Fixed UUIDs for stories — stable across re-runs
const STORY_IDS = {
  MOTHER_TREE:       '10000000-0000-0000-0000-000000000001',
  TINKLE_TRUNK:      '10000000-0000-0000-0000-000000000002',
  UPSIDE_DOWN_WFALL: '10000000-0000-0000-0000-000000000003',
  RAINDROP_CASTLE:   '10000000-0000-0000-0000-000000000004',
  SYRUP_TREE:        '10000000-0000-0000-0000-000000000005',
  DRAGON_MOUNTAINS:  '10000000-0000-0000-0000-000000000006',
  ELVEN_FOREST:      '10000000-0000-0000-0000-000000000007',
  SUN_CAVE:          '10000000-0000-0000-0000-000000000008',
  THE_LIGHTHOUSE:    '10000000-0000-0000-0000-000000000009',
}

// Story content (real text exported from production DB before migration)
const MOTHER_TREE_TEXT = `Let's take our first steps in this new world. Go and lie down in your favourite sleeping position, close your eyes and breathe deeply in and out through your nose.

You'll see a lot of colors, images and thoughts popping up in front of your eyes. Tell these thoughts that you'll take time for them later, but that they need to leave you alone for now and you'll see that they will disappear...

Before we begin, remember that this is a magical world where nothing can harm you, where you are completely safe.

Now, imagine yourself in a big forest. It's nice and warm, and the sun is shining. You see beautiful, tall trees all around you. All the trees have different colours shining in their own unique way: deep-red, emerald-blue, silver, rose-golden, jade-white... colours you never even heard of... When you look up, you see colourful birds silently swooping through the trees and high in the sky. You decide to follow them and you walk deeper and deeper into the forest. While walking, breathe in deeply through your nose... that must be the scent of fresh honey and warm milk.

This is your first time in this forest, but it already feels like home, and while walking you're drawn to this majestic towering tree in the center clearing. The tree is so big that you can't even see the top of it, as it disappears into the clouds and it's so wide that you would need a hundred people to give it a big mommabear hug.

You see a staircase carved into the side of the tree that spirals higher and higher, and from time to time it stops at a door in the trunk. You feel at home here and you know that this is your mother tree.

For tonight, let's take time to explore all the rooms in your mother tree and see what's there. Anything you can imagine can be in here, every room can bring you a new surprise and new things to do... keep your eyes closed and imagine yourself exploring your home base and gently fall asleep.`

const MOTHER_TREE_TIP = `Swimming pool with diving board, cotton candy machine, monkey world, trampoline park, giant slide, gaming room, mirror-maze, cinema, bowling alley, costume room, nerf park with all the nerf guns you can imagine and also the ones you can't imagine...`

const TINKLE_TRUNK_TEXT = `As always, just lie down in your favourite sleeping position, close your eyes and breathe in and out through your nose. In... and out...

Before we begin, remember that we're going to your own magical world, where nothing can harm you, where you are completely safe and there is nothing to worry about. Just one fantastic adventure after another...

Okay, now that you're lying down and closed your eyes, remember to breathe in and out, slowly... You'll see a lot of colors, images and thoughts popping up in front of your eyes. Tell these thoughts "I'll take my time for you later, but not now" and you'll see that they will disappear. Keep doing this as long as new thoughts keep popping up, until it slows down.

We begin our journey again at the foot of our mother tree. A few steps away, there's a little trunk that I'm sure you hadn't noticed before. It's not an ugly trunk, it's actually quite pretty for a trunk. Let's go closer and take a look. I have to tell you now that this is not just a trunk, but a very special portal that the whistling elves have installed after they came to our land, so we can connect with them more easily.

Notice that while you're walking, and you listen very carefully, you can already start to hear a very quiet whistling sound. When you're near the trunk, you see that there's a little hole in the side of the trunk and there's a faint light inside.

You call out... "hello?" but no response. You try again... "hello?" still nothing... and then you see something written underneath the hole... it says "where there's a whistle, there's a way" so you try to do the only thing you can think of and make a short whistling sound. Next thing you know is you're becoming smaller and smaller and you're being drawn into the trunk and you see all colours of the world twisting and turning, until your feet land on the softest grass you've ever felt. When you look around, you see the same trunk, but you're in a completely different place. However, it's not completely the same - this trunk says: "Welcome to Enid's kingdom of the Elves... where there's a whistle, there's also a way back."

As we don't have too much time tonight, we will only be able to explore a tiny part of the elven forest and I know the best place to go to... turn around and walk 10 steps away from the trunk: 1, 2, 3, 4, 5, 6, 7, 8, 9, 10. You're standing in front of a curtain of leaves and liana vines. When you pull away the curtain, you'll see something very special, but the funny thing is that everyone I asked sees something different. What will be there for you? Keep your eyes closed and imagine... tomorrow you can tell us all about your discoveries.`

const TINKLE_TRUNK_TIP = `A pond with singing and dancing ducks`

const UPSIDE_DOWN_WFALL_TEXT = `As always, just lie down in your favourite sleeping position, close your eyes and breathe in and out through your nose. In... and out...

Before we begin, remember that we're going to your own magical world, where nothing can harm you, where you are completely safe and there is nothing to worry about. Just one fantastic adventure after another...

Okay, now that you're lying down and closed your eyes, remember to breathe in and out, slowly... You'll see a lot of colors, images and thoughts popping up in front of your eyes. Tell these thoughts "I'll take my time for you later, but not now" and you'll see that they will disappear. Keep doing this as long as new thoughts keep popping up, until it slows down.

Imagine you're standing at the foot of the mother tree. Have you noticed that there is a little creek flowing clear blue water to the west, where the sun is starting to set in a warm orange light. If you follow the stream and keep walking past the trees you get to a little meadow in the forest. The grass in the meadow is covered with daisies, white and yellow flowers sticking out their heads above the grass. Here in the meadow you can feel the warmth of the setting sun on your skin and it makes you feel so comfortable.

When you keep following the stream you see that there's a little lake in the middle of the meadow. And while you're walking closer you noticed that there is something very strange about this lake - something you hadn't seen earlier - but there's a waterfall not going into the lake but the water is streaming upwards. It's an upside down waterfall and the top of the waterfall disappears into the clouds. I have been told by other travelers that there is true magic at the top of this waterfall so let's plunge into the water and let ourselves be carried upwards the upside down waterfall to see what's at the top in the clouds. Keep your eyes closed and imagine... tomorrow you can tell us all about your discoveries.`

const UPSIDE_DOWN_WFALL_TIP = `Flying dolphins`

// Gemini storyId → our stories UUID
const GEMINI_STORY_ID_MAP: Record<string, string> = {
  'S1':             STORY_IDS.MOTHER_TREE,
  'S1774454970528': STORY_IDS.TINKLE_TRUNK,
  'S1774454867487': STORY_IDS.UPSIDE_DOWN_WFALL,
}

interface GeminiTile {
  id: string
  q: number
  r: number
  model: string
  type: string
  linkedToStoryId: string | null
  rotation: number
  storyId?: string
  name?: string
}

async function main() {
  const mapPath = path.join('/root/fo-dream-stories-gemini/public/maps/new_world.json')
  const tiles: GeminiTile[] = JSON.parse(fs.readFileSync(mapPath, 'utf8'))

  console.log(`Loaded ${tiles.length} tiles from new_world.json`)

  // ── 1. Insert stories ──────────────────────────────────────────────────
  console.log('Inserting stories...')
  const { error: storiesError } = await db.from('stories').upsert([
    { id: STORY_IDS.MOTHER_TREE,       title: 'Mother Tree',               story_text: MOTHER_TREE_TEXT,       alex_dream: MOTHER_TREE_TIP },
    { id: STORY_IDS.TINKLE_TRUNK,      title: 'The Tinkle Trunk',          story_text: TINKLE_TRUNK_TEXT,      alex_dream: TINKLE_TRUNK_TIP },
    { id: STORY_IDS.UPSIDE_DOWN_WFALL, title: 'The Upside-down Waterfall', story_text: UPSIDE_DOWN_WFALL_TEXT, alex_dream: UPSIDE_DOWN_WFALL_TIP },
    { id: STORY_IDS.RAINDROP_CASTLE,   title: 'Raindrop Castle' },
    { id: STORY_IDS.SYRUP_TREE,        title: 'The Syrup Tree' },
    { id: STORY_IDS.DRAGON_MOUNTAINS,  title: 'Dragon Mountains' },
    { id: STORY_IDS.ELVEN_FOREST,      title: 'Elven Forest' },
    { id: STORY_IDS.SUN_CAVE,          title: 'Sun Cave' },
    { id: STORY_IDS.THE_LIGHTHOUSE,    title: 'The Lighthouse' },
  ], { onConflict: 'id' })

  if (storiesError) { console.error('Stories error:', storiesError); process.exit(1) }
  console.log('Stories inserted ✓')

  // ── 2. Build a stable tile-UUID map keyed on "q,r" ─────────────────────
  function tileUuid(q: number, r: number): string {
    const qHex = (q + 100).toString(16).padStart(4, '0')
    const rHex = (r + 100).toString(16).padStart(12, '0')
    return `20000000-0000-0000-${qHex}-${rHex}`
  }

  // Map from Gemini storyId → tile UUID (needed for building tile_unlocks)
  const geminiStoryToTileUuid: Record<string, string> = {}
  for (const tile of tiles) {
    if (tile.storyId) {
      geminiStoryToTileUuid[tile.storyId] = tileUuid(tile.q, tile.r)
    }
  }

  // ── 3. Insert tiles ────────────────────────────────────────────────────
  console.log('Inserting tiles...')
  const tileRows = tiles.map(tile => {
    const type = tile.storyId === 'S1' ? 'story' : tile.type
    const story_id = tile.storyId ? (GEMINI_STORY_ID_MAP[tile.storyId] ?? null) : null

    return {
      id:          tileUuid(tile.q, tile.r),
      type,
      name:        tile.name ?? null,
      position_q:  tile.q,
      position_r:  tile.r,
      model:       tile.model,
      rotation:    tile.rotation ?? 0,
      story_id,
      terrain_type:         null,
      sensory_moment_text:  null,
    }
  })

  const { error: tilesError } = await db.from('tiles').upsert(tileRows, { onConflict: 'position_q,position_r' })
  if (tilesError) { console.error('Tiles error:', tilesError); process.exit(1) }
  console.log(`${tileRows.length} tiles inserted ✓`)

  // ── 4. Build tile_unlocks from linkedToStoryId ─────────────────────────
  console.log('Building tile_unlocks...')
  const unlockRows: { from_tile_id: string; to_tile_id: string }[] = []

  for (const tile of tiles) {
    if (!tile.linkedToStoryId) continue
    const fromTileUuid = geminiStoryToTileUuid[tile.linkedToStoryId]
    if (!fromTileUuid) {
      console.warn(`  No source tile found for linkedToStoryId=${tile.linkedToStoryId} on tile ${tile.id}`)
      continue
    }
    const toTileUuid = tileUuid(tile.q, tile.r)
    if (fromTileUuid === toTileUuid) continue  // skip self-links
    unlockRows.push({ from_tile_id: fromTileUuid, to_tile_id: toTileUuid })
  }

  const { error: unlocksError } = await db.from('tile_unlocks').upsert(unlockRows, { onConflict: 'from_tile_id,to_tile_id' })
  if (unlocksError) { console.error('Unlocks error:', unlocksError); process.exit(1) }
  console.log(`${unlockRows.length} tile_unlocks inserted ✓`)

  console.log('\n✅ Seed complete!')
}

main().catch(err => { console.error(err); process.exit(1) })
