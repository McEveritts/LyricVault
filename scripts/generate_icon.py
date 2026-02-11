import sys
import os

try:
    import cairosvg
    from PIL import Image
    from io import BytesIO
except ImportError:
    print("Missing dependencies. Installing cairosvg and Pillow...")
    import subprocess
    subprocess.check_call([sys.executable, "-m", "pip", "install", "cairosvg", "Pillow"])
    import cairosvg
    from PIL import Image
    from io import BytesIO

def generate_ico(svg_path, ico_path):
    print(f"Generating ICO from {svg_path} to {ico_path}...")
    
    # Define resolutions for the ICO
    sizes = [16, 32, 48, 64, 128, 256]
    images = []
    
    for size in sizes:
        print(f"  Rendering {size}x{size}...")
        png_data = cairosvg.svg2png(url=svg_path, output_width=size, output_height=size)
        img = Image.open(BytesIO(png_data))
        images.append(img)
    
    # Save as ICO
    images[0].save(ico_path, format='ICO', append_images=images[1:], sizes=[(img.width, img.height) for img in images])
    print("Done!")

if __name__ == "__main__":
    svg_p = r"c:\Users\McEveritts\Documents\Antigravity\assets\logo.svg"
    ico_p = r"c:\Users\McEveritts\Documents\Antigravity\assets\icon.ico"
    generate_ico(svg_p, ico_p)
