# Builds public/home/gallery-hero.webp, the homepage hero room: the gallery
# band of Codex's approved desktop concept (generated image
# exec-a1f137c2-6050-4714-82b3-850fef84b3a9.png, top 506px) with its mock
# text, buttons and placeholder painting removed, so the site's own copy and a
# real registered work can sit in the same places.
#
# Each removed box is refilled with a Coons patch spanning the wall just
# outside it (smooth, like the painted wall around it), then given back the
# wall's plaster grain from a clean patch of the same wall.
#   python scripts/home-gallery-hero.py <concept.png> public/home/gallery-hero.webp [preview.png]
import sys
import numpy as np
from PIL import Image
from scipy.ndimage import gaussian_filter, gaussian_filter1d

src = np.asarray(Image.open(sys.argv[1]).convert("RGB")).astype(np.float32)[:506]
img = src.copy()
H, W, _ = img.shape

BOXES = [
    (160, 10, 428, 70),     # POTE GALLERY / 포트 갤러리 logo
    (580, 22, 914, 56),     # top navigation
    (1498, 22, 1642, 54),   # menu icon, KR / EN
    (158, 118, 542, 274),   # hero heading
    (163, 282, 212, 300),   # short rule
    (158, 313, 428, 380),   # sub copy
    (164, 394, 362, 460),   # orange button
    (380, 408, 494, 452),   # secondary link
    (1484, 138, 1607, 260), # vertical side copy
    (650, 58, 1340, 444),   # placeholder painting and its shadow
]

# Plaster grain: high-pass of a clean wall patch between the copy and the painting.
patch = src[90:400, 560:660]
grain = patch - gaussian_filter(patch, (6, 6, 0))
rng = np.random.default_rng(7)

def edge(values, axis_len):
    return gaussian_filter1d(values, sigma=max(2.0, axis_len / 40), axis=0, mode="nearest")

for x0, y0, x1, y1 in BOXES:
    h, w = y1 - y0, x1 - x0
    L = edge(img[y0:y1, x0 - 4:x0 - 1].mean(1), h)
    R = edge(img[y0:y1, x1 + 1:x1 + 4].mean(1), h)
    T = edge(img[y0 - 4:y0 - 1, x0:x1].mean(0), w)
    B = edge(img[y1 + 1:y1 + 4, x0:x1].mean(0), w)
    u = np.linspace(0, 1, w)[None, :, None]
    v = np.linspace(0, 1, h)[:, None, None]
    P00, P10 = img[y0 - 2, x0 - 2], img[y0 - 2, x1 + 1]
    P01, P11 = img[y1 + 1, x0 - 2], img[y1 + 1, x1 + 1]
    fill = ((1 - u) * L[:, None] + u * R[:, None] + (1 - v) * T[None] + v * B[None]
            - ((1 - u) * (1 - v) * P00 + u * (1 - v) * P10 + (1 - u) * v * P01 + u * v * P11))
    # Tile grain from random offsets.
    g = np.zeros((h, w, 3), np.float32)
    ph, pw = grain.shape[:2]
    for yy in range(0, h, ph):
        for xx in range(0, w, pw):
            oy, ox = rng.integers(0, 1), rng.integers(0, 1)
            tile = grain[oy:, ox:]
            g[yy:yy + ph, xx:xx + pw] = tile[:min(ph, h - yy), :min(pw, w - xx)]
    fill = fill + g * 0.9
    # Feather the patch edge 3px into the original.
    m = np.ones((h, w), np.float32)
    ramp = np.minimum.reduce([np.arange(w)[None, :].repeat(h, 0), np.arange(w)[::-1][None, :].repeat(h, 0),
                              np.arange(h)[:, None].repeat(w, 1), np.arange(h)[::-1][:, None].repeat(w, 1)])
    m = np.clip(ramp / 3.0, 0, 1)[..., None]
    img[y0:y1, x0:x1] = fill * m + img[y0:y1, x0:x1] * (1 - m)

out = Image.fromarray(np.clip(img, 0, 255).astype(np.uint8))
out.save(sys.argv[2], quality=92, method=6)
if len(sys.argv) > 3:
    out.save(sys.argv[3])
print(out.size)
