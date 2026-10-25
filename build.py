"""
Firmament – składanie programu w jeden plik.

    python build.py                  -> Firmament.html (otwierasz w przeglądarce, działa offline poza czcionkami)
    python build.py --out PLIK       -> zapis pod inną ścieżką
    python build.py --artifact X     -> dodatkowo X: wersja bez szkieletu <html>/<body> (np. do osadzenia w innej stronie)

Składa src/index.html + src/styles.css + skrypty z src/data/ i src/js/ (w kolejności z index.html)
w jeden samowystarczalny plik HTML. Nie wymaga żadnych bibliotek – wystarczy Python 3.
"""
import os, re, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, 'src')
read = lambda p: open(p, encoding='utf-8').read()

def block(html, name):
    m = re.search(r'<!-- build:%s -->(.*?)<!-- /build:%s -->' % (name, name), html, re.S)
    if not m: raise SystemExit(f'Brak bloku build:{name} w src/index.html')
    return m.group(1).strip('\n')

def main():
    html = read(os.path.join(SRC, 'index.html'))
    head, body, scripts = block(html, 'head'), block(html, 'body'), block(html, 'scripts')
    css = read(os.path.join(SRC, 'styles.css'))
    head = head.replace('<link rel="stylesheet" href="styles.css">', '<style>\n' + css + '\n</style>')
    parts = []
    for src in re.findall(r'<script src="([^"]+)"></script>', scripts):
        code = read(os.path.join(SRC, src))
        if '</script' in code.lower(): raise SystemExit(f'{src} zawiera tekst </script – nie da się go osadzić')
        parts.append(f'/* ===== {src} ===== */\n' + code)
    bundle = "<script>\n(function () {\n'use strict';\n" + '\n'.join(parts) + '\n})();\n</script>'
    full = ('<!doctype html>\n<html lang="pl">\n<head>\n<meta charset="utf-8">\n'
            '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
            + head + '\n</head>\n<body>\n' + body + '\n' + bundle + '\n</body>\n</html>\n')
    out = sys.argv[sys.argv.index('--out') + 1] if '--out' in sys.argv else os.path.join(ROOT, 'Firmament.html')
    if os.path.dirname(out): os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, 'w', encoding='utf-8').write(full)
    print(f'Zapisano {out} ({len(full.encode()) // 1024} KB)')
    if '--artifact' in sys.argv:
        dst = sys.argv[sys.argv.index('--artifact') + 1]
        open(dst, 'w', encoding='utf-8').write(head + '\n' + body + '\n' + bundle + '\n')
        print(f'Zapisano {dst}')

if __name__ == '__main__':
    main()
