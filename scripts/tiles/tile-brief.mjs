/**
 * The concept-drawing brief. ONE canonical copy, imported by both
 * `scripts/tiles/concept.mjs` (the CLI) and `app/api/admin/forge/concept`
 * (the admin Forge tab), so the two cannot drift.
 *
 * WHY THE BRIEF IS SHAPED LIKE THIS
 *
 * The drawing is not artwork for its own sake -- it is the INPUT to image-to-3D.
 *
 * 1. Meshy reconstructs geometry from one view, so the subject must be a single
 *    compact object on a plain background. Scenery, ground plane, vignette or
 *    cropping all become geometry we then have to strip.
 *
 * 2. DO NOT ask for isometric or orthographic projection, however much a game tile
 *    seems to call for it. Measured 2026-09-01, base regularity of the
 *    reconstructed hex (0.866 is a perfect hexagon):
 *
 *      original rendered artwork, perspective + soft shading   0.804
 *      concept, perspective + FLAT vector shading              0.558
 *      concept, TRUE ISOMETRIC + flat vector shading           0.326   <- worse
 *      concept, perspective + SOFT shading                     0.814
 *
 *    Parallel projection removes the depth cues Meshy infers geometry from, and
 *    flat vector shading removes the rest. The best input measured is the one that
 *    looks like a RENDERED 3D OBJECT.
 *
 *    So STYLE asks for smooth shading even though the finished tile must be flat:
 *    `kenney-flatten` enforces the flat Kenney palette downstream regardless, so
 *    fidelity spent on shading costs nothing and buys a base that survives instead
 *    of one that must be thrown away and rebuilt.
 *
 * 3. Colour is cheaper to get right here than downstream. `kenney-flatten` snaps to
 *    the palette, but snapping is nearest-neighbour: it fixes noise and off-palette
 *    shades, never a wrong HUE. A blue tree stays a blue tree. So the palette is
 *    named in hex up front -- as a target to stay close to, not a hard lock, since
 *    forbidding intermediate shades would also forbid the shading in 2.
 */

// The 18 Kenney family base colours, measured from Textures/colormap.png. Naming
// them explicitly works far better than asking for "Kenney style" in the abstract.
export const PALETTE = [
  ['dirt / earth brown', '#b06041'], ['sand', '#f2bf99'], ['bright orange', '#ff7e44'],
  ['red', '#de433e'], ['clay orange', '#f1976c'], ['cream', '#fde4c7'],
  ['golden yellow', '#ffc044'], ['leaf green', '#61cb8b'], ['grass teal', '#52d3b3'],
  ['pale sky', '#d0e8ff'], ['water blue', '#8fdbff'], ['bright blue', '#6da4f8'],
  ['stone grey', '#868ba1'], ['light stone', '#a0a8c9'], ['deep blue', '#6794d9'],
  ['purple', '#a878e8'], ['near-black', '#38383d'], ['white', '#ffffff'],
]

const CLAY = '#f1976c'

export const STYLE = `
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
- The tile is a flat-topped hexagonal slab with a plain ${CLAY} clay-orange
  vertical skirt. The skirt is the same height all the way round. The subject sits
  ON TOP of the slab and stays within its footprint.
- The subject reads clearly as a single silhouette. Chunky shapes, not fine detail.
- Background is PURE WHITE and completely empty. No ground, no horizon, no scenery,
  no border, no text, no watermark, no drop shadow under the tile.`

/**
 * Build the full prompt. A revision is phrased as an EDIT of an approved direction
 * rather than a fresh drawing, so the subject and layout survive the change.
 */
export function buildBrief(idea, revise) {
  return revise
    ? `Revise the attached tile concept. Apply this change: ${revise}\n\n`
      + `Keep everything else about the design the same -- same subject, same layout, same\n`
      + `palette. This is an edit of an approved direction, not a new drawing.\n\n`
      + `The original idea was: ${idea}\n${STYLE}`
    : `Draw a concept for a single hexagonal story tile: ${idea}\n${STYLE}`
}
