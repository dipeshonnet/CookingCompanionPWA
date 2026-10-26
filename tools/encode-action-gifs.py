"""Encode crisp, palette-stable loops with per-frame rectangle compression."""
import json
import sys
from io import BytesIO
from base64 import b64decode
from pathlib import Path
from PIL import Image

payload = json.loads(sys.stdin.read())
frames = [Image.open(BytesIO(b64decode(frame))).convert('RGB').resize((320, 200), Image.Resampling.LANCZOS) for frame in payload['frames']]
# One palette for the entire loop prevents shimmering edges and wasted colors.
atlas = Image.new('RGB', (320, 200 * len(frames)))
for index, frame in enumerate(frames):
    atlas.paste(frame, (0, index * 200))
palette = atlas.quantize(colors=40, method=Image.Quantize.MEDIANCUT)
indexed = [frame.quantize(palette=palette, dither=Image.Dither.NONE) for frame in frames]
target = Path(payload['output'])
target.parent.mkdir(parents=True, exist_ok=True)
indexed[0].save(target, save_all=True, append_images=indexed[1:], duration=[120, 130] * (len(indexed) // 2), loop=0, optimize=True, disposal=1)
print(target.stat().st_size)
