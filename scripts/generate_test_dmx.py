"""
Generates a synthetic DMX channel table image used to test the /api/fixtures/scan endpoint.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(__file__), "..", "assets", "test-dmx-manual.png")

W, H = 1400, 900
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)

try:
    title = ImageFont.truetype("arial.ttf", 44)
    body = ImageFont.truetype("arial.ttf", 30)
except Exception:
    title = ImageFont.load_default()
    body = ImageFont.load_default()

d.text((40, 30), "CHAUVET INTIMIDATOR SPOT 360", fill="black", font=title)
d.text((40, 90), "12-Channel DMX Mode", fill="black", font=body)
d.line([(40, 140), (W - 40, 140)], fill="black", width=3)

rows = [
    ("Ch.1", "Pan", "0-255"),
    ("Ch.2", "Pan Fine", "0-255"),
    ("Ch.3", "Tilt", "0-255"),
    ("Ch.4", "Tilt Fine", "0-255"),
    ("Ch.5", "Color Wheel", "0-255"),
    ("Ch.6", "Gobo Wheel", "0-255"),
    ("Ch.7", "Shutter / Strobe", "0-255"),
    ("Ch.8", "Dimmer", "0-255"),
    ("Ch.9", "Pan/Tilt Speed", "0-255"),
    ("Ch.10", "Macro / Program", "0-255"),
    ("Ch.11", "Reset", "0-255"),
    ("Ch.12", "Sound Active", "0-255"),
]
y = 170
for ch, fn, rng in rows:
    d.text((40, y), ch, fill="black", font=body)
    d.text((200, y), fn, fill="black", font=body)
    d.text((700, y), rng, fill="black", font=body)
    y += 55

img.save(OUT)
print(f"Generated {OUT}")
