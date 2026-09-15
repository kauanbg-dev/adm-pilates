from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ASSETS = Path("/home/ubuntu/.cursor/projects/workspace/assets")
OUT = Path("/workspace/img")


def s_curve(x, amount=0.18):
    return np.clip(x + amount * (x - 0.5) * (1 - (2 * x - 1) ** 2), 0, 1)


def enhance(path, crop, max_side, warm=0.04):
    im = Image.open(path).convert("RGB")
    w, h = im.size
    l, t, r, b = crop
    im = im.crop((int(w * l), int(h * t), int(w * r), int(h * b)))
    w, h = im.size
    scale = max_side / max(w, h)
    if scale < 1:
        im = im.resize((max(1, int(w * scale)), max(1, int(h * scale))), Image.Resampling.LANCZOS)

    arr = np.asarray(im).astype(np.float32) / 255.0
    lo = np.percentile(arr, 1.2, axis=(0, 1))
    hi = np.percentile(arr, 99.2, axis=(0, 1))
    arr = np.clip((arr - lo) / np.maximum(hi - lo, 0.08), 0, 1)
    arr = s_curve(arr, 0.16)
    arr[..., 0] = np.clip(arr[..., 0] * (1 + warm), 0, 1)
    arr[..., 2] = np.clip(arr[..., 2] * (1 - warm * 0.7), 0, 1)
    mx = arr.max(axis=2, keepdims=True)
    mn = arr.min(axis=2, keepdims=True)
    sat = np.where(mx > 0.02, (mx - mn) / np.maximum(mx, 1e-4), 0)
    boost = 1.14
    gray = arr.mean(axis=2, keepdims=True)
    arr = np.clip(gray + (arr - gray) * boost, 0, 1)

    out = Image.fromarray(np.round(arr * 255).astype(np.uint8), "RGB")
    out = ImageEnhance.Contrast(out).enhance(1.08)
    out = ImageEnhance.Brightness(out).enhance(1.04)
    out = out.filter(ImageFilter.UnsharpMask(radius=1.6, percent=118, threshold=3))
    return out


jobs = [
    (
        "e4616c12-1e91-417c-ae8e-afc9919e1f5d.png",
        "estudio-sala.jpg",
        (0.0, 0.02, 1.0, 0.99),
        1800,
    ),
    (
        "78fb453b-c424-493c-9564-b1c7d698ac20.png",
        "estudio-aparelhos.jpg",
        (0.0, 0.04, 1.0, 0.98),
        1800,
    ),
    (
        "f934e385-5b96-4bd0-974c-f0f066f5c986.png",
        "estudio-torres.jpg",
        (0.0, 0.05, 1.0, 0.99),
        1800,
    ),
    (
        "baa734ba-3a86-4e9b-a592-0a68e11125c9.png",
        "estudio-entrada.jpg",
        (0.0, 0.06, 0.94, 0.99),
        1800,
    ),
]

for src, dest, crop, side in jobs:
    img = enhance(ASSETS / src, crop, side)
    dest_path = OUT / dest
    img.save(dest_path, "JPEG", quality=86, optimize=True, progressive=True)
    print(dest, img.size, dest_path.stat().st_size)
