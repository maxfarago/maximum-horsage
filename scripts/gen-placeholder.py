from PIL import Image, ImageDraw, ImageFont

cols, rows = 4, 3
cw, ch = 480, 360
paper = (232, 220, 196)
ink = (26, 22, 18)
rule = (196, 180, 150)
accent = (107, 42, 26)

img = Image.new("RGB", (cols * cw, rows * ch), paper)
draw = ImageDraw.Draw(img)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 28)
    small = ImageFont.truetype("/System/Library/Fonts/Supplemental/Georgia.ttf", 16)
except OSError:
    font = ImageFont.load_default()
    small = font

for i in range(cols * rows):
    row, col = divmod(i, cols)
    x0, y0 = col * cw, row * ch
    draw.rectangle([x0, y0, x0 + cw - 1, y0 + ch - 1], outline=rule, width=2)
    # fake horse blob drifts right so slice boundaries are obvious
    t = i / (cols * rows - 1)
    bx = x0 + 80 + t * 240
    by = y0 + 160 + (8 if i % 2 else -8)
    draw.ellipse([bx, by, bx + 160, by + 90], fill=ink)
    draw.ellipse([bx + 140, by + 10, bx + 190, by + 55], fill=ink)
    label = f"{i}"
    draw.text((x0 + 16, y0 + 12), label, fill=accent, font=font)
    draw.text((x0 + 16, y0 + 44), "placeholder — not a cycle", fill=rule, font=small)

img.save("data/gait/plate.placeholder.png")
print(img.size)
