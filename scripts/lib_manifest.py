"""Shared helper: scan data/slices/ for image files and (re)write
manifest.json from whatever is actually there, sorted alphabetically.

Used by both generate_slices.py (the apple sample dataset) and
build_manifest.py (for rebuilding the index after manually adding,
removing, or renaming images in the folder).
"""

import json
import os

IMAGE_EXTENSIONS = {".svg", ".png", ".jpg", ".jpeg", ".gif", ".webp"}

DEFAULTS = {"size": 400, "axis": "", "layers": []}


def scan_slice_files(slices_dir):
    """Image filenames in slices_dir, sorted the way a person reading
    them alphabetically would expect (case-insensitive). Zero-pad any
    numbers in your filenames (01, 02, ... 10) if you want numeric
    order - plain alphabetical sorts "10" before "2"."""
    names = [
        f for f in os.listdir(slices_dir)
        if os.path.splitext(f)[1].lower() in IMAGE_EXTENSIONS
    ]
    return sorted(names, key=str.lower)


def build_manifest(slices_dir, overrides=None):
    """Scan slices_dir and write manifest.json there. size/axis/layers
    are preserved from any existing manifest.json unless overridden;
    sliceCount/files always reflect the current directory contents."""
    manifest_path = os.path.join(slices_dir, "manifest.json")
    overrides = overrides or {}

    existing = {}
    if os.path.exists(manifest_path):
        with open(manifest_path) as f:
            try:
                existing = json.load(f)
            except json.JSONDecodeError:
                existing = {}

    files = scan_slice_files(slices_dir)

    manifest = {
        "size": overrides.get("size", existing.get("size", DEFAULTS["size"])),
        "sliceCount": len(files),
        "axis": overrides.get("axis", existing.get("axis", DEFAULTS["axis"])),
        "layers": overrides.get("layers", existing.get("layers", DEFAULTS["layers"])),
        "files": files,
    }

    with open(manifest_path, "w") as f:
        json.dump(manifest, f, indent=2)
        f.write("\n")

    return manifest
