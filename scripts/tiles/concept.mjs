/**
 * Generate a CONCEPT DRAWING for a story tile, from an idea in plain words.
 *
 *   node scripts/tiles/concept.mjs "a dragon asleep on a volcano" out.png [options]
 *
 *   --provider=gemini-3-pro-image | gemini-3.1-flash-image | openai   (default gemini-3-pro-image)
 *   --revise=notes    change request applied to --from
 *   --from=prev.png   the image being revised (kept as reference so the revision
 *                     is an EDIT of the approved direction, not a fresh redraw)
 *
 * This is stage one of the tile forge: idea -> drawing -> (revise)* -> approved
 * drawing -> Meshy image-to-3D -> normalize -> kenney-flatten -> installed.
 *
 * WHY THE PROMPT IS SHAPED LIKE THIS
 *
 * The drawing is not artwork for its own sake -- it is the INPUT to image-to-3D.
 * Two constraints follow, and both matter more than prettiness:
 *
 * 1. Meshy reconstructs geometry from one view, so the subject must be a single
 *    compact object on a plain background at a 3/4 elevated angle. Scenery,
 *    ground plane, vignette or cropping all become geometry we then have to strip.
 *
 * 1b. DO NOT ask for isometric or orthographic projection, however much a game tile
 *    seems to call for it. Measured 2026-09-01, base regularity of the reconstructed
 *    hex (0.866 is a perfect hexagon):
 *
 *      original rendered artwork, perspective + soft shading   0.804
 *      concept, perspective + flat vector shading              0.558
 *      concept, TRUE ISOMETRIC + flat vector shading           0.326   <- worse
 *
 *    Parallel projection removes the depth cues Meshy infers geometry from, so the
 *    base comes back worse, not better. Flat vector shading removes the rest of them.
 *    The best input measured is the one that looks like a RENDERED 3D OBJECT: gentle
 *    perspective, soft shading, visible form.
 *
 *    This is why STYLE below asks for smooth shading rather than flat colour, even
 *    though the finished tile must be flat: `kenney-flatten` enforces the flat Kenney
 *    palette downstream regardless, so spending the concept's fidelity on shading
 *    costs nothing and buys a base that survives.
 *
 *    It matters because a deformed base has to be thrown away and replaced by
 *    `normalize-tile --rebuild-base`, which is destructive whenever the base itself
 *    carries artwork -- it flattened the pegasus's cloud mound.
 *
 * 2. Colour is cheaper to get right here than downstream. `kenney-flatten` can
 *    enforce the palette by snapping, but snapping is nearest-neighbour: it can
 *    fix noise and off-palette shades, never a wrong HUE. A blue tree stays a
 *    blue tree. So the palette is named in hex up front -- getting green canopies
 *    here saves a --remap later. It is named as a target to stay close to, not as a
 *    hard lock: forbidding intermediate shades also forbids the shading in 1b.
 */
import fs from 'fs'

// The 18 Kenney family base colours, measured from Textures/colormap.png. Naming
// them explicitly works far better than asking for "Kenney style" in the abstract.
const PALETTE = [
  ['dirt / earth brown', '#b06041'], ['sand', '#f2bf99'], ['bright orange', '#ff7e44'],
  ['red', '#de433e'], ['clay orange', '#f1976c'], ['cream', '#fde4c7'],
  ['golden yellow', '#ffc044'], ['leaf green', '#61cb8b'], ['grass teal', '#52d3b3'],
  ['pale sky', '#d0e8ff'], ['water blue', '#8fdbff'], ['bright blue', '#6da4f8'],
  ['stone grey', '#868ba1'], ['light stone', '#a0a8c9'], ['deep blue', '#6794d9'],
  ['purple', '#a878e8'], ['near-black', '#38383d'], ['white', '#ffffff'],
]

const STYLE = `
STYLE -- these are hard requirements, not suggestions:
- Low-poly 3D game asset in the Kenney.nl style: flat-shaded faceted polygons,
  clean hard edges, chunky simplified forms, friendly and toylike.
- Rendered as a clean 3D object, not a flat vector illustration: smooth soft
  shading, gentle gradients, clear light and shadow on every form.
- No texture detail, no noise, no grain, no painterly brushwork, no photographic
  material. Surfaces stay clean and simple.
- Lighting is a single soft key from the upper left, with enough falloff that the
  form of every shape is unmistakable.
- NO cast shadow on the ground beneath the tile. NO outlines.

PALETTE -- keep close to these hues; darker and lighter shades of them are fine:
${PALETTE.map(([n, h]) => `  ${h}  ${n}`).join('\n')}

THE BASE -- this is what most often goes wrong:
- The camera looks DOWN on the tile from roughly 35 degrees above horizontal. The
  hexagonal TOP FACE must be clearly visible and clearly read as a regular hexagon.
  Do not drop to a side-on or eye-level view -- the top face must not be a sliver.
- Render it like a real 3D object with a gentle, natural camera. Soft smooth shading
  and subtle gradients ON THE SLAB are wanted here: they are the depth cues the
  reconstruction needs.
- ALL SIX SIDES of the hexagon must be visible and unobstructed. The subject must not
  hang over, cover or touch the rim. Leave a clear margin of empty slab all the way
  round, so the full hexagonal outline reads.
- The slab is a plain, undecorated hexagonal prism with a flat top and a vertical
  skirt of constant height. No bevels, no steps, no rounded corners, no rim moulding.

COMPOSITION -- required:
- ONE hexagonal game tile, centred in frame, like a single board-game piece
  photographed on a plain white sweep with nothing else in shot.
- NOTHING BEHIND THE SUBJECT. No backdrop, no panel, no card, no sky, no night sky,
  no wall, no circle or hexagon behind the tile, no framing shape of any kind. Stars
  or sparkles, if any, float as small separate shapes against the white page.
- The tile is a flat-topped hexagonal slab with a plain ${PALETTE[4][1]} clay-orange
  vertical skirt. The skirt is the same height all the way round. The subject sits
  ON TOP of the slab and stays within its footprint.
- The subject reads clearly as a single silhouette. Chunky shapes, not fine detail.
- Background is PURE WHITE and completely empty. No ground, no horizon, no scenery,
  no border, no text, no watermark, no drop shadow under the tile.`

const args = process.argv.slice(2)
const positional = args.filter(a => !a.startsWith('--'))
const [IDEA, OUT] = positional
const flag = (n, d) => { const h = args.find(a => a.startsWith(`--${n}=`)); return h ? h.slice(n.length + 3) : d }

if (!IDEA || !OUT) {
  console.error('usage: concept.mjs "<idea>" <out.png> [--provider=...] [--revise="..."] [--from=prev.png]')
  process.exit(1)
}

const provider = flag('provider', 'gemini-3-pro-image')
const revise = flag('revise')
const from = flag('from')

const brief = revise
  ? `Revise the attached tile concept. Apply this change: ${revise}\n\n`
    + `Keep everything else about the design the same -- same subject, same layout, same\n`
    + `palette. This is an edit of an approved direction, not a new drawing.\n\n`
    + `The original idea was: ${IDEA}\n${STYLE}`
  : `Draw a concept for a single hexagonal story tile: ${IDEA}\n${STYLE}`

async function gemini(model) {
  const key = process.env.GEMINI_API_KEY
  if (!key) throw new Error('GEMINI_API_KEY is not set -- run: set -a && . /root/.secrets/tokens.env && set +a')
  const parts = [{ text: brief }]
  if (from) {
    parts.unshift({ inlineData: { mimeType: 'image/png', data: fs.readFileSync(from).toString('base64') } })
  }
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    })
  const json = await res.json()
  if (!res.ok) throw new Error(`gemini ${res.status}: ${JSON.stringify(json).slice(0, 400)}`)
  const cand = json.candidates?.[0]?.content?.parts ?? []
  const img = cand.find(p => p.inlineData)
  if (!img) throw new Error(`no image returned: ${JSON.stringify(json).slice(0, 400)}`)
  return Buffer.from(img.inlineData.data, 'base64')
}

async function openai() {
  const key = process.env.OPENAI_API_KEY
  if (!key) throw new Error('OPENAI_API_KEY is not set')
  // gpt-image-1 has a true edit endpoint, so a revision references the previous
  // image rather than redrawing from the prompt alone.
  if (from) {
    const fd = new FormData()
    fd.append('model', 'gpt-image-1')
    fd.append('prompt', brief)
    fd.append('size', '1024x1024')
    fd.append('image', new Blob([fs.readFileSync(from)], { type: 'image/png' }), 'prev.png')
    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST', headers: { Authorization: `Bearer ${key}` }, body: fd,
    })
    const json = await res.json()
    if (!res.ok) throw new Error(`openai ${res.status}: ${JSON.stringify(json).slice(0, 400)}`)
    return Buffer.from(json.data[0].b64_json, 'base64')
  }
  const res = await fetch('https://api.openai.com/v1/images/generations', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gpt-image-1', prompt: brief, size: '1024x1024', background: 'opaque',
    }),
  })
  const json = await res.json()
  if (!res.ok) throw new Error(`openai ${res.status}: ${JSON.stringify(json).slice(0, 400)}`)
  return Buffer.from(json.data[0].b64_json, 'base64')
}

const t0 = Date.now()
const png = provider === 'openai' ? await openai() : await gemini(provider)
fs.writeFileSync(OUT, png)
console.log(`${provider}  ${(png.length / 1024).toFixed(0)}KB  ${((Date.now() - t0) / 1000).toFixed(1)}s  -> ${OUT}`)
