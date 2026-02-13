from PIL import Image, ImageDraw, ImageFilter, ImageEnhance
import os

def ensure_dir(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)

def create_gradient(width, height, start_color, end_color):
    """Create a vertical gradient image."""
    base = Image.new('RGBA', (width, height), start_color)
    top = Image.new('RGBA', (width, height), start_color)
    bottom = Image.new('RGBA', (width, height), end_color)
    mask = Image.new('L', (width, height))
    mask_data = []
    for y in range(height):
        for x in range(width):
            mask_data.append(int(255 * (y / height)))
    mask.putdata(mask_data)
    base.paste(bottom, (0, 0), mask)
    return base

def hex_to_rgb(hex_color):
    hex_color = hex_color.lstrip('#')
    return tuple(int(hex_color[i:i+2], 16) for i in (0, 2, 4))

def create_installer_header(output_path):
    """
    150x57 Header Image
    Dark minimalist theme (#131314) with subtle gold accent (#E2C286) at bottom
    """
    WIDTH, HEIGHT = 150, 57
    BG_COLOR = hex_to_rgb("#131314")
    ACCENT_COLOR = hex_to_rgb("#E2C286")
    
    # Create base
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Add subtle circuit/tech pattern (very faint lines)
    # Just draw a few lines for the "tech" feel
    line_color = (30, 31, 32) # Slightly lighter than BG
    draw.line([(0, 0), (WIDTH, HEIGHT)], fill=line_color, width=1)
    draw.line([(0, HEIGHT), (WIDTH, 0)], fill=line_color, width=1)
    draw.line([(WIDTH//2, 0), (WIDTH, HEIGHT//2)], fill=line_color, width=1)
    
    # Add Gold Accent Line at bottom (2px)
    draw.rectangle([(0, HEIGHT-2), (WIDTH, HEIGHT)], fill=ACCENT_COLOR)
    
    # Add a subtle glow above the gold line
    # Create a gradient overlay for glow
    glow = create_gradient(WIDTH, 20, (0,0,0,0), (*ACCENT_COLOR, 100))
    img.paste(glow, (0, HEIGHT-22), glow)

    ensure_dir(output_path)
    img.save(output_path, "BMP")
    print(f"Generated Installer Header: {output_path}")

def create_installer_sidebar(output_path):
    """
    164x314 Sidebar Image (Welcome Page Side image)
    Dark minimalist theme with vertical gold accent line
    """
    WIDTH, HEIGHT = 164, 314
    BG_COLOR = hex_to_rgb("#131314")
    ACCENT_COLOR = hex_to_rgb("#E2C286")
    
    img = Image.new('RGB', (WIDTH, HEIGHT), BG_COLOR)
    draw = ImageDraw.Draw(img)
    
    # Subtle gradient background
    # Darker at top, slightly lighter at bottom
    gradient_bg = create_gradient(WIDTH, HEIGHT, BG_COLOR, (25, 26, 28))
    img.paste(gradient_bg, (0,0))

    # Add localized "glow" or "tech" element
    # Draw a circle glow in corner
    # glow_circle = Image.new('RGBA', (200, 200), (0,0,0,0))
    # draw_glow = ImageDraw.Draw(glow_circle)
    # draw_glow.ellipse([(0,0), (200,200)], fill=(*ACCENT_COLOR, 20))
    # img.paste(glow_circle, (-50, HEIGHT-100), glow_circle)

    # Vertical Accent Line on the right edge (border with content)
    draw.rectangle([(WIDTH-2, 0), (WIDTH, HEIGHT)], fill=ACCENT_COLOR)
    
    ensure_dir(output_path)
    img.save(output_path, "BMP")
    print(f"Generated Installer Sidebar: {output_path}")

if __name__ == "__main__":
    create_installer_header("build/installerHeader.bmp")
    create_installer_sidebar("build/installerSidebar.bmp")
