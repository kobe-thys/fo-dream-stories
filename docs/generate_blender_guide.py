from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH

doc = Document()

# Title style helper
def heading(doc, text, level=1):
    p = doc.add_heading(text, level=level)
    return p

def body(doc, text):
    p = doc.add_paragraph(text)
    p.style.font.size = Pt(11)
    return p

def step(doc, number, text):
    p = doc.add_paragraph(style='List Number')
    p.add_run(f"{text}")
    p.style.font.size = Pt(11)
    return p

def note(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(f"⚠ {text}")
    run.bold = True
    run.font.color.rgb = RGBColor(0xC0, 0x50, 0x00)
    return p

def tip(doc, text):
    p = doc.add_paragraph()
    run = p.add_run(f"💡 {text}")
    run.italic = True
    return p

# ── TITLE ────────────────────────────────────────────────────────────────────

doc.add_heading("Blender & Threedium — Tile Creation Guide", 0)
body(doc, "Reference guide for creating GLB tile models for the FO Dream Stories map.")
doc.add_paragraph()

# ── PART 1 ───────────────────────────────────────────────────────────────────

heading(doc, "Part 1 — Convert a PNG to GLB using Threedium", level=1)
body(doc, "Use this when you have a flat image (PNG) and want to turn it into a 3D tile model.")
doc.add_paragraph()

heading(doc, "Steps", level=2)
for i, text in enumerate([
    "Go to your Threedium account and open the 3D editor.",
    "Create a new project or open an existing one.",
    "Import your PNG image as a texture onto a flat plane or tile base shape.",
    "Adjust the geometry as needed (resize, add depth, etc.).",
    "When ready to export, click Export / Download.",
    "In the export options:\n   • Format: GLB\n   • ✅ Pack UV (also called 'Pack Textures' or 'Embed Textures') — THIS IS CRITICAL.\n     Without this, textures won't show in the app.",
    "Click Export and save the .glb file.",
], 1):
    step(doc, i, text)

note(doc, "Always tick Pack UV. If you forget, the model will appear grey in the app.")
tip(doc, "After exporting, drag the GLB into https://gltf-viewer.donmccurdy.com to verify colors show correctly before uploading.")

doc.add_paragraph()

# ── PART 2 ───────────────────────────────────────────────────────────────────

heading(doc, "Part 2 — Resize and rotate a tile in Blender using grass as a reference", level=1)
body(doc, "Use this to scale and orient a new tile so it fits perfectly on the hex map, using the grass tile as a size reference.")
doc.add_paragraph()

heading(doc, "Setup", level=2)
for i, text in enumerate([
    "Open Blender. File → New → General.",
    "Delete the default cube: press X → Delete.",
    "Import the grass reference tile:\n   File → Import → glTF 2.0 → select grass.glb\n   This is your size reference — don't modify it.",
    "Import your new tile:\n   File → Import → glTF 2.0 → select your-new-tile.glb",
], 1):
    step(doc, i, text)

heading(doc, "Resize your tile", level=2)
for i, text in enumerate([
    "Click your new tile to select it (right-click if needed, or left-click depending on your Blender settings).",
    "Press S to scale. Move the mouse to resize.\n   • To scale on one axis only: press S then X, Y, or Z.\n   • Type a number while scaling for exact scale (e.g. S → 1.5 → Enter = scale to 1.5×).",
    "Match the footprint of your tile to the grass tile visually. The grass tile fills one hex cell.",
    "Press Enter or left-click to confirm the scale.",
], 1):
    step(doc, i, text)

heading(doc, "Rotate your tile", level=2)
for i, text in enumerate([
    "Press R to rotate freely. Move the mouse.",
    "To rotate on one axis only: press R then X, Y, or Z.",
    "Type a number for exact rotation: R → Z → 90 → Enter = rotate 90° on Z axis.",
    "Press Enter or left-click to confirm.",
], 1):
    step(doc, i, text)

heading(doc, "Position your tile", level=2)
for i, text in enumerate([
    "Press G to grab/move. Move the mouse.",
    "To move on one axis: press G then X, Y, or Z.",
    "Move your tile so it sits centered at the same position as the grass tile.",
    "When happy, press Enter to confirm.",
], 1):
    step(doc, i, text)

tip(doc, "Use the numpad keys to change view: Numpad 1 = Front, Numpad 3 = Side, Numpad 7 = Top. Top view is great for checking the hex footprint.")
note(doc, "When done, you can hide the grass tile (click the eye icon next to it in the Outliner panel on the top right) or delete it — it's just a reference.")

heading(doc, "Apply transforms (important!)", level=2)
body(doc, "Before exporting, always apply your transforms so the scale/rotation is baked in:")
for i, text in enumerate([
    "Select your tile object.",
    "Press Ctrl+A → Apply → All Transforms.",
    "This ensures the GLB exports with correct size and orientation.",
], 1):
    step(doc, i, text)

note(doc, "If you skip Ctrl+A, the model may appear wrong size or rotated in the app.")

doc.add_paragraph()

# ── PART 3 ───────────────────────────────────────────────────────────────────

heading(doc, "Part 3 — Export a single tile from Blender to GLB", level=1)
body(doc, "Use this when you have a finished tile and want to export it.")
doc.add_paragraph()

for i, text in enumerate([
    "Select your tile object (click it). Make sure only the tile is selected, not the grass reference.",
    "File → Export → glTF 2.0 (.glb/.gltf)",
    "In the right-hand export panel, set these options:\n   • Format: GLB\n   • Include → Limit to: ✅ Selected Objects\n   • Geometry → Apply Modifiers: ✅\n   • Materials: Automatic\n   • Images: Automatic (this embeds textures)\n   • Leave everything else as default.",
    "Name your file using lowercase letters and dashes:\n   Good: pine-forest.glb, grass-path-straight.glb\n   Bad: Pine Forest.glb, tile_v3_FINAL.glb",
    "Click Export glTF 2.0.",
    "Verify: drag the exported .glb into https://gltf-viewer.donmccurdy.com\n   If it looks correct there, it will look correct in the app.",
], 1):
    step(doc, i, text)

doc.add_paragraph()

# ── PART 4 ───────────────────────────────────────────────────────────────────

heading(doc, "Part 4 — Create a combined tile (e.g. grass + path, dirt + water)", level=1)
body(doc, "Use this to layer an overlay (path, water, road) on top of a base tile in one GLB file.")
doc.add_paragraph()

for i, text in enumerate([
    "Open Blender. File → New → General. Delete the default cube.",
    "Import your base tile: File → Import → glTF 2.0 → e.g. grass.glb",
    "Import your overlay: File → Import → glTF 2.0 → e.g. path.glb",
    "Select the overlay object.",
    "In the Properties panel on the right, click the orange square icon (Object Properties).",
    "Under Transform, set Z Location to 0.01\n   This lifts the overlay just above the base to prevent z-fighting (flickering).",
    "Switch to Material Preview mode (the sphere icon, top-right of the 3D viewport) and check it looks correct.",
    "Press A to select all objects.",
    "Export: File → Export → glTF 2.0\n   • Format: GLB\n   • Include → Limit to: ✅ Selected Objects\n   • Materials: Automatic\n   • Images: Automatic",
    "Name it clearly: grass-path-straight.glb, dirt-water.glb, etc.",
], 1):
    step(doc, i, text)

tip(doc, "Naming convention: base-overlay-variant.glb — e.g. grass-path-curve.glb, grass-path-straight.glb")

doc.add_paragraph()

# ── PART 5 ───────────────────────────────────────────────────────────────────

heading(doc, "Part 5 — Fix grey model (missing textures from Threedium export)", level=1)
body(doc, "If your model appears grey in the app, the textures weren't embedded. Here's how to fix it in Blender without going back to Threedium.")
doc.add_paragraph()

for i, text in enumerate([
    "Open your .blend file (or re-import the GLB from Threedium).",
    "Switch to Material Preview mode — if colors show here, Blender has the textures loaded.",
    "Go to File → External Data → Pack Resources.",
    "If it says 'no new files have been packed', the textures are already packed. Move to step 5.",
    "If it says 'report missing files', click that option, then use Find Missing Files to point Blender to the folder containing your original Threedium export.",
    "Now export to GLB: File → Export → glTF 2.0\n   Make sure Images is set to Automatic (not None) in the export panel.",
    "The exported GLB will now have textures embedded.",
], 1):
    step(doc, i, text)

note(doc, "Always verify with https://gltf-viewer.donmccurdy.com after exporting.")

doc.add_paragraph()

# ── PART 6 ───────────────────────────────────────────────────────────────────

heading(doc, "Part 6 — Upload a finished GLB to the app", level=1)
doc.add_paragraph()

heading(doc, "Option A: Upload via GitHub website (simplest)", level=2)
for i, text in enumerate([
    "Go to github.com/kobe-thys/fo-dream-stories",
    "Navigate to public/models/",
    "Click Add file → Upload files",
    "Drag in your .glb file and .png thumbnail",
    "Click Commit changes",
    "Vercel deploys automatically within ~1 minute",
    "Tell Claude 'I uploaded X to GitHub' so the server can sync",
], 1):
    step(doc, i, text)

heading(doc, "Option B: Copy file to server, ask Claude to push", level=2)
for i, text in enumerate([
    "Copy your .glb and .png to /root/fo-dream-stories/public/models/ on the server",
    "Tell Claude: 'I added X.glb and X.png to public/models — please commit and push'",
    "Claude handles the git commands",
], 1):
    step(doc, i, text)

heading(doc, "PNG thumbnail", level=2)
body(doc, "Every GLB should have a matching PNG thumbnail with the same filename (e.g. grass-path-straight.png). This shows in the admin map tile picker. If you don't have one, the thumbnail area will just be blank — not a problem, but nice to have.")

doc.add_paragraph()

# ── QUICK REFERENCE ──────────────────────────────────────────────────────────

heading(doc, "Quick Reference — Blender keyboard shortcuts", level=1)

table = doc.add_table(rows=1, cols=2)
table.style = 'Light List Accent 1'
hdr = table.rows[0].cells
hdr[0].text = "Shortcut"
hdr[1].text = "What it does"

shortcuts = [
    ("S", "Scale"),
    ("S → X / Y / Z", "Scale on one axis"),
    ("R", "Rotate"),
    ("R → X / Y / Z", "Rotate on one axis"),
    ("G", "Grab / Move"),
    ("G → X / Y / Z", "Move on one axis"),
    ("Ctrl+A → All Transforms", "Apply scale/rotation (do before export)"),
    ("Tab", "Toggle Edit Mode / Object Mode"),
    ("3 (in Edit Mode)", "Face Select mode"),
    ("A", "Select all"),
    ("X → Delete", "Delete selected"),
    ("Numpad 7", "Top view"),
    ("Numpad 1", "Front view"),
    ("Numpad 3", "Side view"),
    ("Numpad 5", "Toggle perspective/orthographic"),
]

for shortcut, description in shortcuts:
    row = table.add_row().cells
    row[0].text = shortcut
    row[1].text = description

doc.add_paragraph()
tip(doc, "Always verify your export at gltf-viewer.donmccurdy.com before uploading to the app.")

# Save
output_path = "/root/FOs_dream_stories/docs/blender-tile-guide.docx"
doc.save(output_path)
print(f"Saved to {output_path}")
