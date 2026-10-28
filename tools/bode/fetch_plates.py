"""
Firmament – pobranie rycin III–XX atlasu J. E. Bodego „Uranographia” (Berlin 1801).

Skany pochodzą z e-rara.ch (ETH-Bibliothek Zürich) i są pobierane przez publiczne API obrazów IIIF w szerokości
3200 px, w odcieniach szarości (ok. 25 MB razem). Dzieło jest w domenie publicznej.
Ryciny I i II (półkule nieba) nie są potrzebne. Pliki trafiają do tools/bode/plates/ (poza repozytorium).

Uruchomienie (z folderu projektu):  python tools/bode/fetch_plates.py
"""
import os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, 'plates')
FIRST = 3341749                     # identyfikator obrazu ryciny I w e-rara; kolejne ryciny co 3
URL = 'https://www.e-rara.ch/i3f/v20/{}/full/3200,/0/gray.jpg'

def main():
    os.makedirs(OUT, exist_ok=True)
    for n in range(3, 21):
        path = os.path.join(OUT, f'p{n:02d}.jpg')
        if os.path.exists(path): continue
        req = urllib.request.Request(URL.format(FIRST + 3 * (n - 1)), headers={'User-Agent': 'Firmament (sky map; tools/bode)'})
        data = urllib.request.urlopen(req, timeout=180).read()
        open(path, 'wb').write(data); print(f'rycina {n:2d}: {len(data) // 1024} KB')

if __name__ == '__main__':
    main()
