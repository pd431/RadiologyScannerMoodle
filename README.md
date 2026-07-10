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
