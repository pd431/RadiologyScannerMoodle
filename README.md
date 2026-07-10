# Radiology Scanner (Moodle-friendly annotation + quiz tools)

A very lightweight pair of static, client-only tools (pure HTML/CSS/JS,
no server-side storage) built around a stack of sliced scan images:

1. **Annotator** (educator) — mark up features on a slice stack and
   export the annotations as a file.
2. **Quiz** (student) — load a slice stack + exported annotation file,
   and practice placing the known features on the correct slice.

Everything the site needs is just files in this folder — it can be
hosted as-is (e.g. as a Moodle-embeddable static page).

## Dataset

`data/slices/` contains a placeholder "apple cross-section" slice
stack: each slice is a horizontal cut through an apple, scanned bottom
to top. The outer silhouette starts small at the base, grows to its
widest at the equator, then narrows toward the stem; a star-shaped
core with 5 seed pockets fades in and out around the middle; a calyx
dimple shows at the very bottom slices and a stem nub at the very top
ones. A shape that visibly grows/shrinks with height reads much more
naturally as "moving through a volume" than an abstract rotating
polygon did — it's a stand-in for real cross-sectional anatomy, good
enough to build and test the annotation/quiz tools against.

Layers per slice (see `data-layer` attribute in each SVG, and
`manifest.json`): `skin`, `flesh`, `core`, `seed`, `stem`, `calyx` —
the last two only appear near the top/bottom of the stack.

Regenerate it with:

```
python3 scripts/generate_slices.py
```

This writes `data/slices/slice-001.svg` … `slice-040.svg` and a
`data/slices/manifest.json` describing the stack (slice count, layer
ids/labels, file list).

Open `preview.html` (served over HTTP, e.g. `python3 -m http.server`)
to scrub through the generated stack.

## Annotator (`annotator/`)

The educator-facing tool. Works on desktop, iPad and phones — the
layout collapses to a single column below ~1100px, and touch targets
grow on touchscreens. Scrub through the slice stack and add one of
three annotation types from the palette onto the slice: drag-and-drop
with a mouse, or on touch, tap a type (it "arms") then tap the slice
to place it.

- **Text label** — a short string shown right on the image.
- **Pin + description** — a marker with a longer write-up (visible on
  hover as a tooltip, and in full when the pin is opened).
- **MCQ** — a marker with a question and a dropdown of options (default
  "Rot / Bite mark / Healthy apple", both editable), with one option
  marked as the correct answer.

Wherever an annotation is dropped, its `layer` is auto-detected from
the `data-layer` attribute of the SVG shape under the cursor (skin,
flesh, core, seed, stem, calyx) — no manual tagging needed. Clicking an
existing marker (or a list entry) opens it in the **inspector** panel
on the right, where every field is live-bound — no separate save step.
Markers can be dragged to reposition (a plain click opens the
inspector instead; dragging re-detects the layer on release).

Every annotation also carries an **acceptable range** — the tolerance
the quiz tool will use to judge a student's placement as correct. The
inspector's "Acceptable range" section offers two modes:

- **Radius** (default, quick) — a slider sets a tolerance circle
  centred on the pin, shown live on the slice.
- **Custom shape** — click "Draw shape" and click points directly on
  the slice to trace an arbitrary polygon (doesn't need to be centred
  on, or even touch, the pin); "Finish shape" needs at least 3 points,
  "Undo point"/"Cancel" are also available.

The **All annotations** panel (left sidebar, expandable) lists every
annotation across the whole stack, sortable by slice order, type, or
title (A–Z / Z–A); clicking an entry jumps straight to its slice and
opens it in the inspector.

Annotations autosave to the browser's local storage as you work, and
**Export annotations** downloads everything as a single
`annotations.json` (schema below) for the quiz tool to consume;
**Import…** loads one back in.

```jsonc
{
  "version": 1,
  "dataset": { "size": 400, "sliceCount": 40, "axis": "height, bottom to top" },
  "annotations": [
    { "id": "…", "type": "label", "sliceIndex": 18, "layer": "core", "x": 0.5, "y": 0.5, "text": "Core",
      "tolerance": { "mode": "radius", "radius": 0.06 } },
    { "id": "…", "type": "pin", "sliceIndex": 18, "layer": "flesh", "x": 0.28, "y": 0.5,
      "title": "Flesh", "description": "…",
      "tolerance": { "mode": "radius", "radius": 0.2 } },
    { "id": "…", "type": "mcq", "sliceIndex": 18, "layer": "flesh", "x": 0.5, "y": 0.38,
      "question": "What condition does this point to?",
      "options": ["Rot", "Bite mark", "Healthy apple"], "answer": "Healthy apple",
      "tolerance": { "mode": "polygon", "polygon": [{ "x": 0.42, "y": 0.35 }, { "x": 0.58, "y": 0.35 }, { "x": 0.58, "y": 0.55 }, { "x": 0.42, "y": 0.55 }] } }
  ]
}
```

`x`/`y` (and polygon point coordinates) are fractions (0–1) of the
slice image, so positions stay correct regardless of display size.
`tolerance.radius` is also a fraction of the image width.
