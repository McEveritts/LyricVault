
import os
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

# Google Pixel 10 Pro / App Colors
COLOR_BG = "#131314"       # Dark background
COLOR_SURFACE = "#1E1F20"  # Surface
COLOR_GOLD = "#E2C286"     # Main accent (Google Gold)
COLOR_GOLD_DARK = "#C4A468"
COLOR_GOLD_LIGHT = "#F4E0B8"

def generate_icon():
    base_dir = Path(__file__).resolve().parent.parent
    assets_dir = base_dir / "assets"
    
    # Ensure assets dir exists
    assets_dir.mkdir(parents=True, exist_ok=True)
    
    ico_path = assets_dir / "icon_v0.1.1.ico"
    png_path = assets_dir / "icon_v0.1.1.png"

    print("Generating Apple Music-style icon with App Colors...")

    # Create a large base image (512x512) for high quality downscaling
    size = 1024
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(image)

    # 1. Background Shape (Rounded Rectangle / Squircle)
    # Apple Music icon is a rounded square. 
    # Use a gradient-like effect or solid surface color? 
    # Let's use COLOR_SURFACE with a subtle border of COLOR_GOLD text-glow style
    
    rect_margin = 0
    radius = size // 5
    
    # Draw Background (Dark Surface)
    draw.rounded_rectangle(
        [(rect_margin, rect_margin), (size - rect_margin, size - rect_margin)],
        radius=radius,
        fill=COLOR_SURFACE,
        outline=COLOR_SURFACE, 
        width=10
    )

    # 2. Add a musical note
    # Since we don't have a font file guaranteed, we will draw a geometric musical note (beamed eighth notes)
    # Coordinates are relative to 1024x1024 canvas
    
    note_color = COLOR_GOLD  # The "text/icon" color
    
    # Note construction
    # Left stem
    stem_width = 70
    stem_height = 450
    left_stem_x = 300
    left_stem_y = 250
    
    # Right stem
    right_stem_x = 650
    right_stem_y = 250
    
    # Beam
    beam_height = 80
    beam_slope = 0 # flat beam for simplicity or slight slope? Apple music is generic note.
    
    # Draw Left Bulb (Ellipse aligned at bottom left)
    bulb_width = 160
    bulb_height = 130
    draw.ellipse(
        [
            (left_stem_x - bulb_width + stem_width , left_stem_y + stem_height - bulb_height//2), 
            (left_stem_x + stem_width + 20, left_stem_y + stem_height + bulb_height//2)
        ],
        fill=note_color
    )

    # Draw Right Bulb
    draw.ellipse(
        [
            (right_stem_x - bulb_width + stem_width , right_stem_y + stem_height - bulb_height//2), 
            (right_stem_x + stem_width + 20, right_stem_y + stem_height + bulb_height//2)
        ],
        fill=note_color
    )
    
    # Draw Stems
    draw.rectangle([(left_stem_x, left_stem_y), (left_stem_x + stem_width, left_stem_y + stem_height)], fill=note_color)
    draw.rectangle([(right_stem_x, right_stem_y), (right_stem_x + stem_width, right_stem_y + stem_height)], fill=note_color)
    
    # Draw Beam (Connecting top of stems)
    # A simple thick rectangle connecting the tops
    draw.rectangle(
        [(left_stem_x, left_stem_y), (right_stem_x + stem_width, left_stem_y + beam_height)],
        fill=note_color
    )
    
    # 3. Add a subtle gradient/glow effect (Simulated by drawing translucent shapes underneath or overlay)
    # Skipping complex effects for PIL primitive drawing, keeping it clean and vector-like.

    # Resize/Resample for output
    # Save PNG
    img_png = image.resize((512, 512), resample=Image.Resampling.LANCZOS)
    img_png.save(png_path, format="PNG")
    print(f"Saved {png_path}")

    # Save ICO (Multi-size)
    # Standard ICO sizes: 256, 128, 64, 48, 32, 16
    img_256 = image.resize((256, 256), resample=Image.Resampling.LANCZOS)
    img_128 = image.resize((128, 128), resample=Image.Resampling.LANCZOS)
    img_64 = image.resize((64, 64), resample=Image.Resampling.LANCZOS)
    img_48 = image.resize((48, 48), resample=Image.Resampling.LANCZOS)
    img_32 = image.resize((32, 32), resample=Image.Resampling.LANCZOS)
    img_16 = image.resize((16, 16), resample=Image.Resampling.LANCZOS)
    
    img_256.save(
        ico_path, 
        format="ICO", 
        sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)],
        append_images=[img_128, img_64, img_48, img_32, img_16]
    )
    print(f"Saved {ico_path}")

if __name__ == "__main__":
    generate_icon()
