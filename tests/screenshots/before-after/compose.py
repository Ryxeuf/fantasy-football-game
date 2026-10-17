"""Assemble une capture AVANT et une capture APRÈS, l'une sous l'autre.

    python3 compose.py avant.png apres.png sortie.png "AVANT — …" "APRÈS — …" \
        [x0,y0,x1,y1 [x0,y0,x1,y1]]

Une découpe s'applique aux deux images ; deux découpes, une à chacune (la page
d'avant peut ne pas exister : un 404 n'a pas la hauteur de la page d'après).
La police des bandeaux n'a pas d'emoji : les éviter dans les libellés.
"""
import sys
from PIL import Image, ImageDraw, ImageFont

BAND = 44
GAP = 16


def font(size):
    for path in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
    ):
        try:
            return ImageFont.truetype(path, size)
        except OSError:
            pass
    return ImageFont.load_default()


def labelled(img, text, color):
    out = Image.new("RGB", (img.width, img.height + BAND), "white")
    draw = ImageDraw.Draw(out)
    draw.rectangle([0, 0, img.width, BAND], fill=color)
    draw.text((14, 9), text, fill="white", font=font(22))
    out.paste(img, (0, BAND))
    return out


def crop(path, box):
    img = Image.open(path).convert("RGB")
    if not box:
        return img
    left, top, right, bottom = box
    return img.crop((left, top, min(right, img.width), min(bottom, img.height)))


def parse_box(raw):
    return tuple(int(v) for v in raw.split(",")) if raw else None


def main():
    before, after, out, label_before, label_after = sys.argv[1:6]
    boxes = [parse_box(raw) for raw in sys.argv[6:8]]
    box_before = boxes[0] if boxes else None
    box_after = boxes[1] if len(boxes) > 1 else box_before
    top = labelled(crop(before, box_before), label_before, (160, 40, 40))
    bottom = labelled(crop(after, box_after), label_after, (30, 120, 60))
    canvas = Image.new(
        "RGB",
        (max(top.width, bottom.width), top.height + bottom.height + GAP),
        (230, 230, 230),
    )
    canvas.paste(top, (0, 0))
    canvas.paste(bottom, (0, top.height + GAP))
    # Palette 256 couleurs : des captures d'interface, 3 à 4 fois plus légères.
    canvas.quantize(256).save(out, optimize=True)


main()
