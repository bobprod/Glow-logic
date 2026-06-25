from pathlib import Path

from PIL import Image, ImageChops, ImageDraw, ImageFilter


def lerp_color(start, end, factor):
    return tuple(int(start[index] + (end[index] - start[index]) * factor) for index in range(3))


def draw_linear_gradient(size, start_color, end_color):
    width, height = size
    image = Image.new("RGBA", size)
    pixels = image.load()
    for y in range(height):
        for x in range(width):
            factor = (x + y) / (width + height - 2)
            r, g, b = lerp_color(start_color, end_color, factor)
            pixels[x, y] = (r, g, b, 255)
    return image


def draw_radial_glow(size, center, radius, color, intensity):
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(glow)
    for step in range(radius, 0, -1):
        alpha = int(intensity * 255 * (step / radius) ** 2)
        bbox = [center[0] - step, center[1] - step, center[0] + step, center[1] + step]
        draw.ellipse(bbox, fill=(*color, alpha))
    return glow.filter(ImageFilter.GaussianBlur(radius=18))


def draw_launcher_icon(size=512):
    image = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    mask = Image.new("L", (size, size), 0)
    mask_draw = ImageDraw.Draw(mask)
    radius = int(size * 0.22)
    inset = int(size * 0.07)
    mask_draw.rounded_rectangle([inset, inset, size - inset, size - inset], radius=radius, fill=255)

    background = draw_linear_gradient((size, size), (7, 17, 31), (17, 27, 46))
    background.putalpha(mask)
    image.alpha_composite(background)

    cyan_glow = draw_radial_glow((size, size), (int(size * 0.36), int(size * 0.34)), int(size * 0.24), (0, 231, 255), 0.10)
    amber_glow = draw_radial_glow((size, size), (int(size * 0.66), int(size * 0.62)), int(size * 0.20), (255, 179, 71), 0.12)
    cyan_glow.putalpha(ImageChops.multiply(cyan_glow.getchannel("A"), mask))
    amber_glow.putalpha(ImageChops.multiply(amber_glow.getchannel("A"), mask))
    image.alpha_composite(cyan_glow)
    image.alpha_composite(amber_glow)

    beams = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    beam_draw = ImageDraw.Draw(beams)
    beam_draw.polygon(
        [
            (int(size * 0.30), int(size * 0.18)),
            (int(size * 0.47), int(size * 0.52)),
            (int(size * 0.38), int(size * 0.52)),
            (int(size * 0.23), int(size * 0.28)),
        ],
        fill=(106, 247, 255, 65),
    )
    beam_draw.polygon(
        [
            (int(size * 0.73), int(size * 0.16)),
            (int(size * 0.61), int(size * 0.53)),
            (int(size * 0.54), int(size * 0.53)),
            (int(size * 0.66), int(size * 0.25)),
        ],
        fill=(255, 179, 71, 58),
    )
    beams = beams.filter(ImageFilter.GaussianBlur(radius=8))
    image.alpha_composite(beams)

    draw = ImageDraw.Draw(image)
    ring_box = [int(size * 0.30), int(size * 0.27), int(size * 0.70), int(size * 0.67)]
    ring_width = max(16, int(size * 0.065))
    for index, color in enumerate(((124, 140, 255), (18, 169, 255), (106, 247, 255))):
        offset = index * 2
        draw.arc(
            [ring_box[0] - offset, ring_box[1] - offset, ring_box[2] + offset, ring_box[3] + offset],
            start=20,
            end=336,
            fill=color,
            width=max(8, ring_width - index * 6),
        )

    bar_y = int(size * 0.46)
    draw.line(
        [(int(size * 0.63), bar_y), (int(size * 0.48), bar_y)],
        fill=(255, 179, 71, 255),
        width=max(10, int(size * 0.05)),
        joint="curve",
    )
    draw.arc(
        [int(size * 0.47), int(size * 0.40), int(size * 0.64), int(size * 0.59)],
        start=340,
        end=92,
        fill=(255, 179, 71, 255),
        width=max(10, int(size * 0.05)),
    )

    line_width = max(6, int(size * 0.018))
    left_node = (int(size * 0.24), int(size * 0.65))
    middle_node = (int(size * 0.50), int(size * 0.57))
    right_node = (int(size * 0.76), int(size * 0.63))
    draw.line([left_node, middle_node], fill=(98, 239, 255, 190), width=line_width)
    draw.line([middle_node, right_node], fill=(255, 179, 71, 180), width=line_width)

    for center, stroke, outer, inner_radius in (
        (left_node, (99, 245, 255), (8, 19, 30), int(size * 0.034)),
        (middle_node, (99, 245, 255), (8, 19, 30), int(size * 0.026)),
        (right_node, (255, 179, 71), (8, 19, 30), int(size * 0.031)),
    ):
        radius_outer = inner_radius + max(6, int(size * 0.012))
        draw.ellipse([center[0] - radius_outer, center[1] - radius_outer, center[0] + radius_outer, center[1] + radius_outer], fill=outer)
        draw.ellipse([center[0] - radius_outer, center[1] - radius_outer, center[0] + radius_outer, center[1] + radius_outer], outline=stroke, width=max(4, int(size * 0.01)))

    spark_layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    spark_draw = ImageDraw.Draw(spark_layer)
    for x, y, r, color in (
        (int(size * 0.35), int(size * 0.24), int(size * 0.018), (106, 247, 255, 120)),
        (int(size * 0.67), int(size * 0.22), int(size * 0.020), (255, 179, 71, 105)),
    ):
        spark_draw.ellipse([x - r, y - r, x + r, y + r], fill=color)
    spark_layer = spark_layer.filter(ImageFilter.GaussianBlur(radius=8))
    image.alpha_composite(spark_layer)

    return image


if __name__ == "__main__":
    root = Path(__file__).resolve().parents[1]
    assets_dir = root / "assets"
    assets_dir.mkdir(parents=True, exist_ok=True)

    icon = draw_launcher_icon(512)
    png_path = assets_dir / "launcher-icon.png"
    ico_path = assets_dir / "launcher-icon.ico"

    icon.save(png_path)
    icon.save(ico_path, format="ICO", sizes=[(256, 256), (128, 128), (64, 64), (48, 48), (32, 32), (16, 16)])

    print(f"Generated {png_path}")
    print(f"Generated {ico_path}")
