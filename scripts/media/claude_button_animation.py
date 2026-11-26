# Builds the "Forecast in Claude" animation from real 1280x720 captures of forewit.xyz (dark theme):
# 1_home, 2_plugin, 3_copied, 4_connector, 5_cli, 6_open (PNG, captured with playwright-cli).
# Output: docs/posts/img/forecast_in_claude.gif (X posts) and a still, forecast_in_claude_poster.png.
# Run: .venv/Scripts/python scripts/media/claude_button_animation.py <capture folder>
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[2]
CAP = Path(sys.argv[1])
W, H, BAR = 1280, 720, 96
BG, INK, MUTED, LIME, CLAUDE = (13, 20, 32), (242, 244, 245), (150, 160, 175), (196, 240, 66), (217, 119, 87)
FONTS = Path("C:/Windows/Fonts")


def font(bold, size):
    for name in (["segoeuib.ttf", "arialbd.ttf"] if bold else ["segoeui.ttf", "arial.ttf"]):
        if (FONTS / name).exists():
            return ImageFont.truetype(str(FONTS / name), size)
    return ImageFont.load_default()


F_STEP, F_HEAD, F_BIG, F_BODY = font(True, 20), font(True, 30), font(True, 60), font(False, 26)
STEPS = [
    ("1_home", "Find Forecast in Claude on Today's picks"),
    ("2_plugin", "Plugin: two lines for Claude Code"),
    ("3_copied", "Copy them, paste them in Claude Code"),
    ("4_connector", "Connector: one address for any Claude chat"),
    ("5_cli", "CLI: one command on any computer"),
    ("6_open", "No computer? Open Claude Code on your phone"),
]


def step(i, name, caption):
    im = Image.new("RGB", (W, H + BAR), BG)
    d = ImageDraw.Draw(im)
    d.text((40, 20), f"STEP {i} OF {len(STEPS)}", font=F_STEP, fill=CLAUDE)
    d.text((40, 46), caption, font=F_HEAD, fill=INK)
    d.rectangle((0, BAR - 4, int(W * i / len(STEPS)), BAR - 1), fill=CLAUDE)
    im.paste(Image.open(CAP / f"{name}.png").convert("RGB").resize((W, H)), (0, BAR))
    return im


def card(head, sub, foot):
    im = Image.new("RGB", (W, H + BAR), BG)
    d = ImageDraw.Draw(im)
    d.rectangle((60, 330, 68, 420), fill=CLAUDE)
    d.text((92, 322), head, font=F_BIG, fill=INK)
    d.text((92, 410), sub, font=F_BODY, fill=MUTED)
    d.text((60, H + BAR - 80), foot, font=F_STEP, fill=LIME)
    return im


cards = [(card("Forecast in Claude", "Three ways in, from one button on forewit.xyz.", "forewit.xyz"), 2200)]
cards += [(step(i + 1, *s), 2600) for i, s in enumerate(STEPS)]
cards.append((card("Your edge, on the record.", "Say \u201cForecast with Forewit\u201d. Approve in the Binance App.", "forewit.xyz"), 2800))

gif = ROOT / "docs" / "posts" / "img" / "forecast_in_claude.gif"
q = [im.quantize(colors=256, method=Image.Quantize.MAXCOVERAGE, dither=Image.Dither.NONE) for im, _ in cards]
q[0].save(gif, save_all=True, append_images=q[1:], duration=[ms for _, ms in cards], loop=0, optimize=True)
cards[2][0].save(ROOT / "docs" / "posts" / "img" / "forecast_in_claude_poster.png")
for p in (gif,):
    print(p.relative_to(ROOT), round(p.stat().st_size / 1024), "KB")
print("seconds", sum(ms for _, ms in cards) / 1000)
