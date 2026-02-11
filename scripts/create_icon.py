"""Generate LyricVault icon.ico from scratch using Pillow."""
from PIL import Image, ImageDraw
import os

SIZE = 512
CENTER = SIZE // 2

# Create RGBA canvas with dark navy background
img = Image.new("RGBA", (SIZE, SIZE), (10, 15, 30, 255))  # #0A0F1E
draw = ImageDraw.Draw(img)

# Gold colors
GOLD_LIGHT = (226, 194, 134, 255)  # #E2C286
GOLD_DARK = (197, 160, 89, 255)    # #C5A059
GOLD_MID = (211, 177, 111, 255)
WHITE_50 = (255, 255, 255, 128)
WHITE_30 = (255, 255, 255, 76)

# ── Glow effect behind the vault shape ──
glow_img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
glow_draw = ImageDraw.Draw(glow_img)
for i in range(30, 0, -1):
    alpha = int(8 * (30 - i) / 30)
    glow_color = (226, 194, 134, alpha)
    glow_draw.rounded_rectangle(
        [128 - i, 128 - i, 384 + i, 384 + i],
        radius=48 + i,
        outline=glow_color,
        width=2
    )
img = Image.alpha_composite(img, glow_img)
draw = ImageDraw.Draw(img)

# ── Vault rounded rectangle (stroke) ──
STROKE_W = 22
for offset in range(STROKE_W):
    t = offset / max(STROKE_W - 1, 1)
    r = int(GOLD_LIGHT[0] * (1 - t) + GOLD_DARK[0] * t)
    g = int(GOLD_LIGHT[1] * (1 - t) + GOLD_DARK[1] * t)
    b = int(GOLD_LIGHT[2] * (1 - t) + GOLD_DARK[2] * t)
    draw.rounded_rectangle(
        [128 + offset, 128 + offset, 384 - offset, 384 - offset],
        radius=max(48 - offset, 2),
        outline=(r, g, b, 255),
        width=1
    )

# ── Music note stem ──
stem_x = CENTER
stem_top = 180
stem_bottom = 300
for dx in range(-10, 11):
    t = (dx + 10) / 20
    r = int(GOLD_LIGHT[0] * (1 - t) + GOLD_DARK[0] * t)
    g = int(GOLD_LIGHT[1] * (1 - t) + GOLD_DARK[1] * t)
    b = int(GOLD_LIGHT[2] * (1 - t) + GOLD_DARK[2] * t)
    draw.line([(stem_x + dx, stem_top), (stem_x + dx, stem_bottom)], fill=(r, g, b, 255))

# Round caps on stem
draw.ellipse([stem_x - 10, stem_top - 10, stem_x + 10, stem_top + 10], fill=GOLD_LIGHT)
draw.ellipse([stem_x - 10, stem_bottom - 10, stem_x + 10, stem_bottom + 10], fill=GOLD_DARK)

# ── Music note head (large circle at bottom-left of stem) ──
note_cx = 220
note_cy = 300
note_r = 36
draw.ellipse(
    [note_cx - note_r, note_cy - note_r, note_cx + note_r, note_cy + note_r],
    fill=GOLD_MID
)
# Add gradient-ish shading on note head
for ri in range(note_r, 0, -1):
    t = ri / note_r
    r = int(GOLD_LIGHT[0] * t + GOLD_DARK[0] * (1 - t))
    g = int(GOLD_LIGHT[1] * t + GOLD_DARK[1] * (1 - t))
    b = int(GOLD_LIGHT[2] * t + GOLD_DARK[2] * (1 - t))
    alpha = 60
    draw.ellipse(
        [note_cx - ri, note_cy - ri, note_cx + ri, note_cy + ri],
        outline=(r, g, b, alpha),
        width=1
    )

# ── Vault dial center dot ──
dial_r = 12
draw.ellipse(
    [CENTER - dial_r, CENTER - dial_r, CENTER + dial_r, CENTER + dial_r],
    fill=WHITE_50
)

# ── Vault dial cross marks ──
mark_len = 20
for sx, sy, ex, ey in [
    (CENTER, 220, CENTER, 240),
    (CENTER, 272, CENTER, 292),
    (220, CENTER, 240, CENTER),
    (272, CENTER, 292, CENTER),
]:
    for dx in range(-2, 3):
        for dy in range(-2, 3):
            draw.line([(sx + dx, sy + dy), (ex + dx, ey + dy)], fill=WHITE_30)

# ── Save as ICO with multiple sizes ──
out_path = os.path.join("assets", "icon.ico")

# Create resized versions for the ICO
sizes = [256, 128, 64, 48, 32, 16]
images = []
for s in sizes:
    resized = img.resize((s, s), Image.LANCZOS)
    images.append(resized)

# Save - Pillow's ICO writer takes the first image and sizes
img_256 = img.resize((256, 256), Image.LANCZOS)
img_256.save(out_path, format="ICO", sizes=[(s, s) for s in sizes])

# Also save a 256x256 PNG for electron-builder
png_path = os.path.join("assets", "icon.png")
img_256.save(png_path, format="PNG")

print(f"Created {out_path} and {png_path} successfully!")
print(f"ICO size: {os.path.getsize(out_path)} bytes")
print(f"PNG size: {os.path.getsize(png_path)} bytes")
