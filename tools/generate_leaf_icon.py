import math
from PIL import Image, ImageDraw

def create_leaf_icon():
    size = 1024
    
    # 1. Background image: soft pale green #E7F5EC
    bg = Image.new("RGBA", (size, size), (231, 245, 236, 255))
    bg.save("assets/android-icon-background.png", "PNG")
    
    # 2. Foreground image: Leaf icon in #13865A
    fg = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    fg_draw = ImageDraw.Draw(fg)
    
    # Draw leaf shape (Ionicons leaf style)
    # The leaf is tilted at ~45 degrees, pointed at top-right, stem at bottom-left
    # Main leaf body
    center_x, center_y = 512, 512
    primary_color = (19, 134, 90, 255) # #13865A
    accent_color = (25, 160, 108, 255)
    
    # Draw high quality polygon/bezier approximation for leaf
    # Tip at (750, 270), Base at (280, 740)
    # Right curved arc and Left curved arc
    points_right = []
    points_left = []
    
    steps = 60
    for i in range(steps + 1):
        t = i / steps
        # Left curve
        x_left = (1 - t)**2 * 280 + 2 * (1 - t) * t * 240 + t**2 * 750
        y_left = (1 - t)**2 * 740 + 2 * (1 - t) * t * 290 + t**2 * 270
        points_left.append((x_left, y_left))
        
        # Right curve
        x_right = (1 - t)**2 * 280 + 2 * (1 - t) * t * 730 + t**2 * 750
        y_right = (1 - t)**2 * 740 + 2 * (1 - t) * t * 780 + t**2 * 270
        points_right.append((x_right, y_right))
        
    leaf_poly = points_left + points_right[::-1]
    fg_draw.polygon(leaf_poly, fill=primary_color)
    
    # Draw stem & center vein
    # Stem: curve from base to (200, 820)
    fg_draw.line([(280, 740), (220, 800), (190, 830)], fill=primary_color, width=28)
    
    # Center vein (lighter green line through middle of leaf)
    vein_points = []
    for i in range(35):
        t = i / 35
        vx = (1 - t) * 300 + t * 720
        vy = (1 - t) * 720 + t * 300
        vein_points.append((vx, vy))
    fg_draw.line(vein_points, fill=(231, 245, 236, 220), width=18)
    
    # Side small veins
    for t_val, side, dx, dy in [(0.3, 1, 70, -20), (0.45, -1, -60, -30), (0.6, 1, 60, -30), (0.75, -1, -50, -30)]:
        x0 = (1 - t_val) * 300 + t_val * 720
        y0 = (1 - t_val) * 720 + t_val * 300
        fg_draw.line([(x0, y0), (x0 + dx, y0 + dy)], fill=(231, 245, 236, 190), width=12)
        
    fg.save("assets/android-icon-foreground.png", "PNG")
    
    # 3. Combined App Icon: #E7F5EC background + rounded container leaf
    full_icon = Image.new("RGBA", (size, size), (231, 245, 236, 255))
    full_icon.paste(fg, (0, 0), fg)
    full_icon.save("assets/icon.png", "PNG")
    full_icon.save("assets/splash-icon.png", "PNG")
    print("Leaf icons successfully created in assets/!")

if __name__ == "__main__":
    create_leaf_icon()
