import os
from PIL import Image

sizes = {
    "mipmap-mdpi": (48, 48),
    "mipmap-hdpi": (72, 72),
    "mipmap-xhdpi": (96, 96),
    "mipmap-xxhdpi": (144, 144),
    "mipmap-xxxhdpi": (192, 192),
}

base_res = "android/app/src/main/res"
icon_img = Image.open("assets/icon.png")
fg_img = Image.open("assets/android-icon-foreground.png")
bg_img = Image.open("assets/android-icon-background.png")

for folder, size in sizes.items():
    dir_path = os.path.join(base_res, folder)
    if not os.path.exists(dir_path):
        continue
    
    # 1. ic_launcher.webp
    icon_resized = icon_img.resize(size, Image.Resampling.LANCZOS)
    icon_resized.save(os.path.join(dir_path, "ic_launcher.webp"), "WEBP")
    icon_resized.save(os.path.join(dir_path, "ic_launcher_round.webp"), "WEBP")
    
    # 2. ic_launcher_foreground.webp & background
    fg_size = (int(size[0] * 1.5), int(size[1] * 1.5))
    fg_resized = fg_img.resize(fg_size, Image.Resampling.LANCZOS)
    fg_resized.save(os.path.join(dir_path, "ic_launcher_foreground.webp"), "WEBP")
    
    bg_resized = bg_img.resize(size, Image.Resampling.LANCZOS)
    bg_resized.save(os.path.join(dir_path, "ic_launcher_background.webp"), "WEBP")

print("Android res mipmap icons successfully updated!")
