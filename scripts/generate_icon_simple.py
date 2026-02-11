import sys
from PIL import Image

def generate_ico(png_path, ico_path):
    print(f"Generating ICO from {png_path} to {ico_path}...")
    try:
        img = Image.open(png_path)
        # Define resolutions for the ICO
        sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
        
        # Save as ICO with multiple sizes
        img.save(ico_path, format='ICO', sizes=sizes)
        print("Done!")
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    png_p = r"c:\Users\McEveritts\Documents\Antigravity\assets\icon_v0.1.1.png"
    ico_p = r"c:\Users\McEveritts\Documents\Antigravity\assets\icon.ico"
    generate_ico(png_p, ico_p)
