# Builds the short phone setup animation from the real screenshots in web/public/start.
# Output: web/public/start/workflow.webp (site) and docs/posts/img/workflow.gif (X posts).
# Run: .venv/Scripts/python scripts/media/workflow_animation.py
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
SHOTS = ROOT / "web" / "public" / "start"
W, H = 1280, 720
BG, SURFACE, LINE = (13, 20, 32), (21, 30, 45), (40, 52, 70)
INK, MUTED, LIME = (242, 244, 245), (150, 160, 175), (196, 240, 66)
FONTS = Path("C:/Windows/Fonts")


def font(bold, size):
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]):
        if (FONTS / name).exists():
            return ImageFont.truetype(str(FONTS / name), size)
    return ImageFont.load_default()


F_STEP, F_HEAD, F_BODY, F_BIG = font(True, 22), font(True, 40), font(False, 26), font(True, 64)

STEPS = [
    (["template"], "Use the template", "Tap Use this template, then Create a new repository."),
    (["private"], "Keep it private", "Your forecast receipts are saved here."),
    (["repo"], "Open it in Claude Code", "claude.ai/code or the Code tab in the Claude app."),
    (["envmenu", "envname"], "Create the Forewit environment", "Cloud menu, New environment, name it Forewit."),
    (["network"], "Allow the listed websites", "Network access stays Limited; paste the list from the Start page."),
    (["envvars"], "Add your Predict.fun key", "Optional, for any market. It stays in your environment."),
    (["connector"], "Add the Forewit connector", "Optional. Read only; it never sends anything."),
]


def base():
    im = Image.new("RGB", (W, H), BG)
    d = ImageDraw.Draw(im)
    d.text((56, 40), "Forewit", font=F_STEP, fill=INK)
    d.text((56 + d.textlength("Forewit ", font=F_STEP), 40), "· set up on your phone", font=F_STEP, fill=MUTED)
    return im, d


def title_card(head, sub, foot):
    im, d = base()
    d.rectangle((56, 300, 64, 380), fill=LIME)
    d.text((88, 290), head, font=F_BIG, fill=INK)
    d.text((88, 380), sub, font=F_BODY, fill=MUTED)
    d.text((56, H - 70), foot, font=F_STEP, fill=LIME)
    return im


def step_card(i, names, head, sub):
    im, d = base()
    d.text((56, 120), f"STEP {i} OF {len(STEPS)}", font=F_STEP, fill=LIME)
    d.text((56, 156), head, font=F_HEAD, fill=INK)
    d.text((56, 214), sub, font=F_BODY, fill=MUTED)
    shots = [Image.open(SHOTS / f"{n}.webp").convert("RGB") for n in names]
    box_w, box_h, top = W - 112, H - 290, 266
    gap = 24
    each_w = (box_w - gap * (len(shots) - 1)) // len(shots)
    x = 56
    for s in shots:
        k = min(each_w / s.width, box_h / s.height, 1.6)
        s = s.resize((int(s.width * k), int(s.height * k)), Image.LANCZOS)
        cx = x + (each_w - s.width) // 2
        d.rounded_rectangle((cx - 2, top - 2, cx + s.width + 1, top + s.height + 1), radius=6, outline=LINE, width=2)
        im.paste(s, (cx, top))
        x += each_w + gap
    # progress bar
    d.rectangle((56, H - 24, W - 56, H - 20), fill=SURFACE)
    d.rectangle((56, H - 24, 56 + int((W - 112) * i / len(STEPS)), H - 20), fill=LIME)
    return im


def main():
    cards = [(title_card("Your edge, on the record.", "Set up Forewit on your phone in about five minutes.", "forewit.xyz"), 2200)]
    cards += [(step_card(i + 1, *s), 2600) for i, s in enumerate(STEPS)]
    cards.append((title_card("Say \u201cPlay Forewit\u201d.", "Approve in the Binance App. Auto reveal does the rest.", "forewit.xyz/#/start"), 2800))
    frames, durations = [], []
    for j, (im, ms) in enumerate(cards):
        frames.append(im)
        durations.append(ms)
        nxt = cards[(j + 1) % len(cards)][0]
        for a in (0.25, 0.5, 0.75):  # short crossfade
            frames.append(Image.blend(im, nxt, a))
            durations.append(70)
    webp = SHOTS / "workflow.webp"
    frames[0].save(webp, save_all=True, append_images=frames[1:], duration=durations, loop=0, quality=82, method=6)
    gif_frames = [f.resize((960, 540), Image.LANCZOS).quantize(colors=128, method=Image.Quantize.MEDIANCUT) for f in frames]
    gif = ROOT / "docs" / "posts" / "img" / "workflow.gif"
    gif_frames[0].save(gif, save_all=True, append_images=gif_frames[1:], duration=durations, loop=0, optimize=True)
    frames[4].save(ROOT / "docs" / "posts" / "img" / "workflow_poster.png")
    for p in (webp, gif):
        print(p.relative_to(ROOT), round(p.stat().st_size / 1024), "KB")
    print("seconds", round(sum(durations) / 1000, 1))


main()
