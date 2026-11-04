"""Download the 3D pictures the site needs and save them as small WebP files.

Source: Microsoft Fluent Emoji, https://github.com/microsoft/fluentui-emoji (MIT licence).
Usage:  python3 tools/fetch_images.py <file listing the repository's 3D png paths>
The listing comes from:  git ls-tree -r --name-only HEAD  in a clone of that repository.
"""
import io, re, subprocess, sys, urllib.parse, urllib.request
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public' / 'assets' / 'img' / '3d'
RAW = 'https://raw.githubusercontent.com/microsoft/fluentui-emoji/main/'
SIZE = 192  # pixels; shown at up to 96 css px, so sharp on 2x screens

def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

def main(listing):
    paths = [p.strip() for p in Path(listing).read_text().splitlines() if '/3D/' in p]
    by_slug = {}
    for p in paths:
        name = p.split('/')[1]
        if re.search(r'_(light|medium-light|medium|medium-dark|dark)\.png$', p):
            continue
        by_slug.setdefault(slug(name), p)
    wanted = subprocess.run(['node', str(ROOT / 'tools' / 'images.mjs')], capture_output=True, text=True, check=True).stdout.split()
    OUT.mkdir(parents=True, exist_ok=True)
    missing = [s for s in wanted if s not in by_slug]
    if missing:
        sys.exit('Not in the Fluent repository: ' + ', '.join(missing))
    for s in wanted:
        dest = OUT / f'{s}.webp'
        if dest.exists():
            continue
        url = RAW + urllib.parse.quote(by_slug[s])
        data = urllib.request.urlopen(url, timeout=30).read()
        img = Image.open(io.BytesIO(data)).convert('RGBA')
        img.thumbnail((SIZE, SIZE), Image.LANCZOS)
        img.save(dest, 'WEBP', quality=86, method=6)
        print('saved', dest.name, dest.stat().st_size, 'bytes')
    print(len(wanted), 'pictures ready in', OUT)

if __name__ == '__main__':
    main(sys.argv[1])
