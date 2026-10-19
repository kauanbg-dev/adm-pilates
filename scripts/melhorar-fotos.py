"""Trata as fotos do estúdio a partir dos originais em scripts/fotos-originais/.

Uso: python scripts/melhorar-fotos.py
"""

from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
ORIGINAIS = ROOT / "scripts" / "fotos-originais"
SAIDA = ROOT / "img"

# Recorte em frações da imagem: (esquerda, topo, direita, base).
FOTOS = {
    "estudio-sala.jpg": (0.02, 0.07, 0.0, 0.12),
    "estudio-aparelhos.jpg": (0.0, 0.18, 0.0, 0.07),
    "estudio-torres.jpg": (0.0, 0.05, 0.0, 0.08),
    "estudio-entrada.jpg": (0.0, 0.06, 0.04, 0.05),
}


def recortar(img, frac):
    w, h = img.size
    l, t, r, b = frac
    return img.crop((round(w * l), round(h * t), round(w * (1 - r)), round(h * (1 - b))))


def ampliar(img):
    # As fotos do celular têm cerca de 1500px. Em tela retina o quadro fica
    # maior que isso e a imagem pixeliza. Lanczos 2x dá folga, e o unsharp
    # leve devolve o contorno sem o halo do filtro do celular.
    w, h = img.size
    maior = img.resize((w * 2, h * 2), Image.Resampling.LANCZOS)
    return maior.filter(ImageFilter.UnsharpMask(radius=1.6, percent=70, threshold=2))


def balanco_de_branco(rgb):
    lum = rgb.mean(axis=2)
    sat = rgb.max(axis=2) - rgb.min(axis=2)
    lo, hi = np.percentile(lum, [60, 97])
    neutros = (lum > lo) & (lum < hi) & (sat < 0.12)
    if neutros.sum() < 500:
        return rgb
    media = rgb[neutros].mean(axis=0)
    ganho = media.mean() / media
    ganho *= np.array([1.035, 1.0, 0.955])
    return np.clip(rgb * ganho, 0, 1)


def curva_tons(rgb):
    topo = np.percentile(rgb.mean(axis=2), 99.0)
    rgb = rgb * (0.97 / max(topo, 1e-3))
    rgb = np.clip(rgb, 0, 1) ** 0.88
    joelho = 0.86
    rgb = np.where(rgb > joelho, joelho + (rgb - joelho) * 0.65, rgb)
    meio = 0.55
    rgb = meio + (rgb - meio) * 1.06
    return np.clip(rgb, 0, 1)


def saturacao(rgb, fator):
    cinza = rgb.mean(axis=2, keepdims=True)
    return np.clip(cinza + (rgb - cinza) * fator, 0, 1)


def vinheta(rgb, forca=0.10):
    h, w, _ = rgb.shape
    y, x = np.ogrid[-1:1:h * 1j, -1:1:w * 1j]
    d = np.sqrt(x * x + y * y) / np.sqrt(2)
    mascara = 1 - forca * d ** 2.2
    return rgb * mascara[..., None]


def tratar(nome, frac):
    img = Image.open(ORIGINAIS / nome).convert("RGB")
    img = recortar(img, frac)
    rgb = np.asarray(img).astype(np.float32) / 255.0
    rgb = balanco_de_branco(rgb)
    rgb = curva_tons(rgb)
    rgb = saturacao(rgb, 0.95)
    rgb = vinheta(rgb, 0.04)
    img = Image.fromarray((np.clip(rgb, 0, 1) * 255 + 0.5).astype(np.uint8))
    out = ampliar(img)
    out.save(
        SAIDA / nome,
        quality=92,
        subsampling=0,
        optimize=True,
        progressive=True,
    )
    return out.size


def main():
    for nome, frac in FOTOS.items():
        w, h = tratar(nome, frac)
        print(f"{nome}: {w}x{h}")


if __name__ == "__main__":
    main()
