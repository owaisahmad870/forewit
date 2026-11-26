# Exact size PNGs from the 2x renders (png.mjs). Run: .venv/Scripts/python.exe scripts/brand/resize.py
import os
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P, PUB = os.path.join(ROOT, 'brand/png'), os.path.join(ROOT, 'web/public')


def out(src, size, dst):
    im = Image.open(os.path.join(P, src + '@2x.png')).convert('RGBA')
    im.resize(size, Image.LANCZOS).save(dst, optimize=True)
    print(os.path.relpath(dst, ROOT), size)


out('x_header', (1500, 500), os.path.join(P, 'x_header_1500x500.png'))
out('x_avatar', (400, 400), os.path.join(P, 'x_avatar_400.png'))
out('x_avatar', (800, 800), os.path.join(P, 'x_avatar_800.png'))
out('og', (1200, 630), os.path.join(PUB, 'og.png'))
out('icon_dark', (512, 512), os.path.join(P, 'icon_dark_512.png'))
out('icon_light', (512, 512), os.path.join(P, 'icon_light_512.png'))
out('x_avatar', (180, 180), os.path.join(PUB, 'apple-touch-icon.png'))
out('icon_dark', (32, 32), os.path.join(PUB, 'favicon-32.png'))
out('wordmark_dark', (2400, 656), os.path.join(P, 'wordmark_dark.png'))
out('wordmark_light', (2400, 656), os.path.join(P, 'wordmark_light.png'))
