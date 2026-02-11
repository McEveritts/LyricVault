
import os
import sys
from pathlib import Path

# Add venv site-packages to path if not automatically added
# (Run this with the venv python)

try:
    import cairosvg
    from PIL import Image
    import io
except ImportError as e:
    print(f"ImportError: {e}")
    sys.exit(1)

def generate_icon():
    base_dir = Path(__file__).resolve().parent.parent
    svg_path = base_dir / "assets" / "logo.svg"
    ico_path = base_dir / "assets" / "icon_v0.1.1.ico"
    png_path = base_dir / "assets" / "icon_v0.1.1.png"

    if not svg_path.exists():
        print(f"Error: {svg_path} not found")
        sys.exit(1)

    print(f"Converting {svg_path} to icons...")

    try:
        # Convert SVG to PNG data
        png_data = cairosvg.svg2png(url=str(svg_path), output_width=256, output_height=256)
        
        # Load into PIL
        image = Image.open(io.BytesIO(png_data))
        
        # Save as PNG
        image.save(png_path, format="PNG")
        print(f"Saved {png_path}")

        # Save as ICO
        # ICO needs sizes. Default (256, 128, 64, 48, 32, 16)
        image.save(ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])
        print(f"Saved {ico_path}")

    except Exception as e:
        print(f"Error converting icon: {e}")
        sys.exit(1)

if __name__ == "__main__":
    generate_icon()
