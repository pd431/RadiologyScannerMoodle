#!/usr/bin/env python3
"""Generate a placeholder "MRI-like" slice stack.

Each slice is an SVG containing three nested polygons (an outer hexagon,
a mid square and an inner triangle). Every layer rotates at its own rate
as the slice index increases, so the stack reads as a twisting 3D volume
when scrubbed through - a stand-in for real cross-sectional anatomy that
is good enough to build/test the annotation and quiz tools against.

Run: python3 scripts/generate_slices.py
Output: data/slices/slice-NNN.svg + data/slices/manifest.json
"""

import json
import math
import os

OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "data", "slices")
SIZE = 400
CENTER = SIZE / 2
SLICE_COUNT = 40

LAYERS = [
    {"id": "outer", "label": "Outer ring", "sides": 6, "radius": 150,
     "deg_per_slice": 2, "fill": "#3b6ea5", "opacity": 0.35, "stroke": "#204a72"},
    {"id": "mid", "label": "Mid band", "sides": 4, "radius": 95,
     "deg_per_slice": -3, "fill": "#4c9a72", "opacity": 0.45, "stroke": "#2c6b4a"},
    {"id": "core", "label": "Core", "sides": 3, "radius": 45,
     "deg_per_slice": 5, "fill": "#b5533c", "opacity": 0.55, "stroke": "#833a29"},
]

# Fixed landmark dot (does not rotate) so orientation stays legible slice to
# slice, similar to an A/P marker on a real scan.
LANDMARK_RADIUS = 6
LANDMARK_OFFSET = 175


def polygon_points(sides, radius, rotation_deg):
    rotation = math.radians(rotation_deg - 90)  # start first vertex pointing up
    pts = []
    for k in range(sides):
        angle = rotation + k * 2 * math.pi / sides
        x = CENTER + radius * math.cos(angle)
        y = CENTER + radius * math.sin(angle)
        pts.append(f"{x:.2f},{y:.2f}")
    return " ".join(pts)


def render_slice(index):
    layers_svg = []
    for layer in LAYERS:
        rotation = index * layer["deg_per_slice"]
        points = polygon_points(layer["sides"], layer["radius"], rotation)
        layers_svg.append(
            f'  <polygon data-layer="{layer["id"]}" points="{points}" '
            f'fill="{layer["fill"]}" fill-opacity="{layer["opacity"]}" '
            f'stroke="{layer["stroke"]}" stroke-width="2" stroke-linejoin="round" />'
        )

    landmark = (
        f'  <circle data-layer="landmark" cx="{CENTER}" cy="{CENTER - LANDMARK_OFFSET}" '
        f'r="{LANDMARK_RADIUS}" fill="#e8b93a" stroke="#8a6a10" stroke-width="1.5" />'
    )

    svg = "\n".join([
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
        f'width="{SIZE}" height="{SIZE}">',
        f'  <circle cx="{CENTER}" cy="{CENTER}" r="{CENTER - 5}" '
        f'fill="#0d1117" stroke="#30363d" stroke-width="2" />',
        *layers_svg,
        landmark,
        "</svg>",
        "",
    ])
    return svg


def main():
    os.makedirs(OUT_DIR, exist_ok=True)

    manifest = {
        "size": SIZE,
        "sliceCount": SLICE_COUNT,
        "layers": [{"id": l["id"], "label": l["label"]} for l in LAYERS] + [
            {"id": "landmark", "label": "Fixed landmark (does not rotate)"}
        ],
        "files": [],
    }

    for i in range(SLICE_COUNT):
        filename = f"slice-{i + 1:03d}.svg"
        with open(os.path.join(OUT_DIR, filename), "w") as f:
            f.write(render_slice(i))
        manifest["files"].append(filename)

    with open(os.path.join(OUT_DIR, "manifest.json"), "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    print(f"Wrote {SLICE_COUNT} slices + manifest.json to {os.path.abspath(OUT_DIR)}")


if __name__ == "__main__":
    main()
