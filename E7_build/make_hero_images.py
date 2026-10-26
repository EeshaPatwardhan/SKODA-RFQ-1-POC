"""Prepares the two V9 hero photographs from the supplied references (assets/src_login.png, assets/src_home.png).

The references are small mock-ups with UI drawn over them, so only the clean photographic regions are cropped, upscaled and given a light
grade + film grain (which also hides the softness of the enlargement).  If you have the original photographs (no UI on top), drop them in
as assets/login_hero.jpg and assets/home_hero.jpg and delete the matching crop below — build_e7.py embeds whatever is in assets/.

    python make_hero_images.py
"""
import os, sys
import numpy as np
from PIL import Image, ImageFilter, ImageEnhance

HERE = os.path.dirname(os.path.abspath(__file__))
A = lambda n: os.path.join(HERE, "assets", n)

def grade(im, scale, box, out, grain=3.2, vignette=.28, contrast=1.06, sat=1.04):
    im = im.convert("RGB").crop(box)
    im = im.resize((im.width * scale, im.height * scale), Image.LANCZOS)
    im = im.filter(ImageFilter.UnsharpMask(radius=2.2, percent=70, threshold=2))
    im = ImageEnhance.Contrast(im).enhance(contrast); im = ImageEnhance.Color(im).enhance(sat)
    a = np.asarray(im).astype(np.float32)
    h, w = a.shape[:2]
    yy, xx = np.mgrid[0:h, 0:w]
    d = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    a *= (1 - vignette * np.clip(d - .55, 0, 1) ** 1.4)[..., None]
    rng = np.random.default_rng(7)
    a += rng.normal(0, grain, (h, w, 1))
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out, quality=84, optimize=True, progressive=True)
    print("wrote", out, os.path.getsize(out) // 1024, "KB", (w, h))

login = Image.open(A("src_login.png"))
home = Image.open(A("src_home.png"))
# login: the car + glass building on wet tarmac, left of the sign-in card and clear of the baked-in wordmark / tagline text
grade(login, 4, (0, 110, 222, 360), A("login_hero.jpg"))
# home: mountains, forest, car and road, right of the greeting cards and left of the baked-in motto text
grade(home, 5, (208, 37, 314, 202), A("home_hero.jpg"))
