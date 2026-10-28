"""
Firmament – pobranie i przycięcie zewnętrznych katalogów do tools/raw/.

Pobiera pełne źródła (ok. 40 MB) i zapisuje z nich tylko to, czego używa tools/prep_data.py:

  * hyg_v41_mag8.csv     – gwiazdy do 8 mag z bazy HYG 4.1 (D. Nash, astronexus; CC BY-SA 4.0):
                           pozycje J2000 (epoka i równonoc 2000), ruch własny, odległość z paralaksy
                           Hipparcosa (nowa redukcja), jasność, B−V, typ widmowy, oznaczenia Bayera/Flamsteeda.
                           Gwiazdy bez numeru HIP tylko wtedy, gdy mają numer HR (np. Kastor B, Mizar B).
  * iau_star_names.csv   – oficjalne nazwy gwiazd IAU WGSN (zestawienie: github.com/cyschneck/iau-star-names, MIT).
  * openngc_messier.csv  – pozycje, typy i rozmiary obiektów Messiera z OpenNGC (M. Verga; CC BY-SA 4.0).

Uruchomienie (z folderu projektu):  python tools/fetch_sources.py
Potrzebny jest internet; biblioteki – tylko standardowe.
"""
import csv, io, os, urllib.request

HERE = os.path.dirname(os.path.abspath(__file__)); RAW = os.path.join(HERE, 'raw')
SRC = {
    'hyg': 'https://raw.githubusercontent.com/astronexus/HYG-Database/main/hyg/CURRENT/hygdata_v41.csv',
    'iau': 'https://raw.githubusercontent.com/cyschneck/iau-star-names/main/iau_proper_stars.csv',
    'ngc': 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/NGC.csv',
    'add': 'https://raw.githubusercontent.com/mattiaverga/OpenNGC/master/database_files/addendum.csv',
}
get = lambda k: urllib.request.urlopen(SRC[k], timeout=120).read().decode('utf-8')

def main():
    os.makedirs(RAW, exist_ok=True)
    # --- HYG: stars to 8 mag
    keep = ['hip', 'hr', 'proper', 'ra', 'dec', 'dist', 'pmra', 'pmdec', 'mag', 'ci', 'spect', 'bayer', 'flam', 'bf', 'con']
    rows = [r for r in csv.DictReader(io.StringIO(get('hyg')))
            if r['id'] != '0' and r['mag'] and float(r['mag']) <= 8.0 and (r['hip'] or r['hr'])]
    with open(os.path.join(RAW, 'hyg_v41_mag8.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, keep, extrasaction='ignore'); w.writeheader(); w.writerows(rows)
    print('HYG:', len(rows), 'gwiazd')
    # --- IAU names
    rows = list(csv.DictReader(io.StringIO(get('iau'))))
    keep = ['Proper Names', 'Designation', 'HIP', 'Bayer ID', 'Constellation', 'Date of Adoption']
    with open(os.path.join(RAW, 'iau_star_names.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, keep, extrasaction='ignore'); w.writeheader(); w.writerows(rows)
    print('IAU:', len(rows), 'nazw')
    # --- OpenNGC: Messier objects only
    keep = ['M', 'Name', 'Type', 'RA', 'Dec', 'MajAx', 'MinAx', 'PosAng', 'V-Mag', 'B-Mag', 'NGC', 'Common names']
    rows = [r for k in ('ngc', 'add') for r in csv.DictReader(io.StringIO(get(k)), delimiter=';') if (r.get('M') or '').strip()]
    rows.sort(key=lambda r: int(r['M']))
    with open(os.path.join(RAW, 'openngc_messier.csv'), 'w', newline='', encoding='utf-8') as f:
        w = csv.DictWriter(f, keep, extrasaction='ignore'); w.writeheader(); w.writerows(rows)
    print('OpenNGC:', len(rows), 'obiektów Messiera')

if __name__ == '__main__':
    main()
