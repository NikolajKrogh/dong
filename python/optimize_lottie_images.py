"""Create a lower-memory Lottie variant from embedded raster image frames."""

from __future__ import annotations

import argparse
import base64
import io
import json
from pathlib import Path
from typing import Any

from PIL import Image


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Resize embedded Lottie images and preserve their rendered size."
    )
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--width", type=int, required=True)
    parser.add_argument("--quality", type=int, default=90)
    return parser.parse_args()


def optimize_lottie(
    document: dict[str, Any], target_width: int, quality: int
) -> tuple[int, int, int]:
    if target_width <= 0:
        raise ValueError("Target width must be positive")

    composition_width = int(document["w"])
    composition_height = int(document["h"])
    target_height = round(composition_height * target_width / composition_width)
    source_dimensions: dict[str, tuple[int, int]] = {}

    for asset in document.get("assets", []):
        data_uri = asset.get("p")
        if not isinstance(data_uri, str) or not data_uri.startswith("data:image/"):
            continue

        header, encoded = data_uri.split(",", 1)
        if ";base64" not in header:
            raise ValueError(f"Asset {asset.get('id')} is not base64 encoded")

        source_width = int(asset["w"])
        source_height = int(asset["h"])
        expected_height = round(source_height * target_width / source_width)
        if expected_height != target_height:
            raise ValueError(
                f"Asset {asset.get('id')} has an unexpected aspect ratio"
            )

        with Image.open(io.BytesIO(base64.b64decode(encoded))) as image:
            resized = image.resize(
                (target_width, target_height), Image.Resampling.LANCZOS
            )
            output = io.BytesIO()
            resized.save(output, format="WEBP", quality=quality, method=6)

        asset_id = str(asset["id"])
        source_dimensions[asset_id] = (source_width, source_height)
        asset["w"] = target_width
        asset["h"] = target_height
        asset["p"] = (
            "data:image/webp;base64,"
            + base64.b64encode(output.getvalue()).decode("ascii")
        )

    if not source_dimensions:
        raise ValueError("No embedded image assets were found")

    scaled_layers = 0
    for layer in document.get("layers", []):
        ref_id = str(layer.get("refId"))
        if ref_id not in source_dimensions:
            continue

        scale = layer.get("ks", {}).get("s", {}).get("k")
        if not isinstance(scale, list) or len(scale) < 2:
            raise ValueError(f"Layer {layer.get('ind')} has an unsupported scale")

        source_width, source_height = source_dimensions[ref_id]
        scale[0] = round(float(scale[0]) * source_width / target_width, 6)
        scale[1] = round(float(scale[1]) * source_height / target_height, 6)
        scaled_layers += 1

    if scaled_layers != len(source_dimensions):
        raise ValueError(
            f"Expected {len(source_dimensions)} image layers, scaled {scaled_layers}"
        )

    return len(source_dimensions), target_width, target_height


def main() -> None:
    args = parse_args()
    document = json.loads(args.input.read_text(encoding="utf-8"))
    count, width, height = optimize_lottie(document, args.width, args.quality)
    args.output.write_text(
        json.dumps(document, separators=(",", ":")), encoding="utf-8"
    )
    decoded_bytes = count * width * height * 4
    print(
        f"Optimized {count} frames to {width}x{height}; "
        f"decoded RGBA footprint is approximately {decoded_bytes / 1_000_000:.1f} MB"
    )


if __name__ == "__main__":
    main()
