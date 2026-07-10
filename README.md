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

`data/slices/` contains a placeholder "MRI-like" slice stack: each
slice is an SVG with three nested polygons (hexagon / square /
triangle) that each rotate at their own rate as the slice index
increases, plus a fixed landmark dot for orientation. It's a stand-in
for real cross-sectional anatomy, good enough to build and test the
annotation/quiz tools against.

Regenerate it with:

```
python3 scripts/generate_slices.py
```

This writes `data/slices/slice-001.svg` … `slice-040.svg` and a
`data/slices/manifest.json` describing the stack (slice count, layer
ids/labels, file list).

Open `preview.html` (served over HTTP, e.g. `python3 -m http.server`)
to scrub through the generated stack.
