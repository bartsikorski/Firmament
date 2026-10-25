# Firmament

Interaktywna mapa nieba w przeglądarce: prawdziwe gwiazdy, 88 gwiazdozbiorów z ilustracjami i opisami oraz widok nieba nad dowolnym miejscem o dowolnej porze. Całość to jeden plik HTML, bez instalacji i bez serwera.

[English](README.md) · interfejs programu jest po polsku

![Niebo letnie w wyglądzie Realistycznym](docs/screenshot-sky.jpg)

| Wygląd „Mitologia” | Wskazany gwiazdozbiór z opisem i podpisami atrybutów |
|---|---|
| ![Ilustracje gwiazdozbiorów](docs/screenshot-mythology.jpg) | ![Orion](docs/screenshot-orion.jpg) |

## Co potrafi

- **Ok. 41 tys. prawdziwych gwiazd do 8 mag** z katalogu Hipparcos, w barwach odpowiadających temperaturze. Po przybliżeniu dochodzi dekoracyjne tło słabszych gwiazd. Znane gwiazdy, takie jak Syriusz, Gwiazda Polarna, Wega czy Algol, mają podpis zawsze.
- **Wszystkie 88 gwiazdozbiorów:** linie figur, granice IAU i nazwy w trzech wielkościach (najmniej znane najmniejsze), każda z małą ikoną figury.
  - Półprzezroczyste **ilustracje** ze Stellarium. Wskazany kursorem gwiazdozbiór podświetla się, a na rysunku pojawiają się podpisy atrybutów, np. maczuga, głowa Meduzy czy kłos zboża.
  - Karta każdego gwiazdozbioru mówi, co przedstawia figura i kto ją wprowadził: Ptolemeusz, Heweliusz, Lacaille…
- **Obiekty Messiera, planety, Księżyc z fazą, Słońce, Droga Mleczna.** Cefeidy mają w karcie okres pulsacji i zakres jasności.
- **Widok z miejsca:** niebo nad wybranym miastem albo współrzędnymi o wybranej porze, z precesją, refrakcją, horyzontem, zmierzchem i strefą czasową miejsca. Upływ czasu można przyspieszać.
- **14 wyglądów** (Realistyczny, Mitologia, Porcelana, Atlas…), edytor palety oraz eksport i import własnych stylów.
- **Wycieczka po niebie** (19 przystanków z podpisami) i 40 celów w zakładce „Na co warto spojrzeć”.
- **Tryb fotograficzny:** kadry 16:9, 3:2, 1:1 i 4:5, eksport do 6K.
- **Jakość obrazu:** bufory HDR, progresywne wygładzanie po zatrzymaniu i płynność w ruchu.

## Uruchomienie

Pobierz **`Firmament.html`** i otwórz go dwuklikiem. Działa w aktualnym Chrome, Edge, Firefoksie i Safari, potrzebuje WebGL. Internet przydaje się tylko do czcionek z Google Fonts; bez niego program działa na czcionkach zastępczych.

Program można też udostępnić przez **GitHub Pages**: *Settings → Pages → Deploy from a branch → `main`, `/ (root)`*. Po chwili będzie dostępny pod adresem `https://<użytkownik>.github.io/<repozytorium>/`; plik `index.html` w głównym folderze przekierowuje na `Firmament.html`. Po każdej zmianie w `src/` uruchom `python build.py` przed commitem, żeby opublikowany plik był aktualny.

## Obsługa

- **Przeciągnij**, aby przesuwać niebo. **Kółko myszy** przybliża w stronę kursora, a **dwuklik** przelatuje do wskazanego miejsca.
- **Najedź kursorem** na gwiazdozbiór, żeby go podświetlić. **Kliknij**, żeby otworzyć kartę gwiazdozbioru, gwiazdy, planety albo obiektu.
- Wyszukiwarka zna nazwy polskie, łacińskie i angielskie (np. „Syriusz”, „Sirius”, „Gwiazda Północna”) oraz numery M.

| Klawisz | Działanie | Klawisz | Działanie |
|---|---|---|---|
| `H` | widok startowy | `T` | wycieczka |
| `M` | mapa / widok z miejsca | `I` | ilustracje gwiazdozbiorów wł./wył. |
| `N` | niebo dziś o 22:00 | `P` | tryb fotograficzny (`Enter` – zdjęcie) |
| `R` | losowy cel | `spacja` | upływ czasu |
| `Q` / `E` | obrót | `+` / `−` | zoom |
| `/` | wyszukiwarka | `Esc` | odznacz, wyjdź |

Ustawienia, własne style i zapisane widoki są pamiętane w przeglądarce (localStorage).

## Rozwój

Źródła leżą w `src/`. Otwórz `src/index.html` w przeglądarce, edytuj pliki i odświeżaj stronę (F5); **budowanie nie jest potrzebne**. Gdy zmiany są gotowe, złóż jeden plik:

```
python build.py                         # -> Firmament.html
python build.py --out inny/plik.html    # zapis pod inną ścieżką
```

Wystarczy Python 3, bez dodatkowych bibliotek.

| Plik | Zawartość |
|---|---|
| `src/index.html`, `src/styles.css` | Układ i wygląd interfejsu (kolory w `:root`) |
| `src/js/00-util.js` | Matematyka wektorowa, formatowanie, pamięć przeglądarki |
| `src/js/01-data.js` | Rozpakowanie katalogu gwiazd i gwiazdozbiorów |
| `src/js/02-looks.js` | Wyglądy (`LOOKS`), domyślny styl, warstwy i ustawienia |
| `src/js/03-astro.js` | Czas gwiazdowy, precesja, refrakcja, Słońce, Księżyc, planety, strefy czasowe, cefeidy |
| `src/js/04-view.js` | Stan widoku, miejsca obserwacji (`LOCS`), rzutowania, widok startowy (`HOME`) |
| `src/js/05-gl.js` | Renderer WebGL: niebo, Droga Mleczna, gwiazdy, ilustracje |
| `src/js/06-overlay.js` | Nakładka 2D: linie, nazwy z ikonami, podpisy, obiekty, planety |
| `src/js/07-main.js` | Pętla renderu, animacje, wybieranie obiektów, karta, wycieczka, tryb foto |
| `src/js/08-ui.js` | Panel, suwaki, wyszukiwarka, statystyki |
| `src/js/09-boot.js` | Start programu |
| `src/data/content.js` | **Treści pisane ręcznie:** opisy 88 figur, podpisy atrybutów, znane gwiazdy, cele wycieczki |
| `src/data/skydata.js`, `src/data/artdata.js` | Dane wygenerowane przez narzędzia (nie edytuj ręcznie) |
| `tools/prep_data.py`, `tools/prep_art.py` | Generatory danych z plików w `tools/raw/` |
| `build.py` | Składanie `Firmament.html` |
| `index.html`, `.nojekyll` | Przekierowanie na `Firmament.html` dla GitHub Pages; `.nojekyll` wyłącza przetwarzanie strony przez Jekyll |

### Odświeżenie danych

Potrzebne tylko po zmianie `tools/*.py` albo plików w `tools/raw/`:

```
pip install -r tools/requirements.txt
python tools/prep_data.py      # gwiazdy, gwiazdozbiory, Droga Mleczna (kilka minut)
python tools/prep_art.py       # ilustracje i ikony (kilkadziesiąt sekund)
python build.py
```

Pomocnicze API do testów jest dostępne z konsoli przeglądarki jako `window.__firmament`.

## Dokładność

Obliczenia sprawdzono z biblioteką astropy (ERFA) i katalogiem SIMBAD:

- **pozycje gwiazd:** 1–2″;
- **gwiazdy w widoku z miejsca:** poniżej 0,01° (precesja z J2000 do daty obserwacji, refrakcja);
- **Słońce i planety:** poniżej 1′ w latach 1900–2100;
- **Księżyc:** ok. 1′, z paralaksą topocentryczną;
- **przynależność gwiazd do gwiazdozbiorów:** dokładnie według granic IAU w układzie B1875; powierzchnie gwiazdozbiorów zgadzają się z wartościami IAU.

Weryfikacja wychwyciła i usunęła lub poprawiła 31 błędnych nazw gwiazd w danych źródłowych (np. cefeida η Aquilae była podpisana nazwą γ Aql – „Tarazed”). Gwiazdy tła słabsze niż 8 mag są generowane dekoracyjnie (rozkład podąża za Drogą Mleczną) i nie odpowiadają prawdziwym gwiazdom.

## Licencja

- **Kod programu** (`src/js/`, `src/index.html`, `src/styles.css`, `src/data/content.js`, `build.py`, `tools/*.py`): licencja **MIT**, zob. [`LICENSE`](LICENSE).
- **Dane i grafiki** mają licencje swoich autorów:
  - ilustracje i ikony gwiazdozbiorów (`src/data/artdata.js`, `tools/raw/art/`) – **Free Art License 1.3** (Stellarium);
  - dane katalogowe (`src/data/skydata.js`, `tools/raw/*.json`) – **BSD-3-Clause** (d3-celestial) i **CC BY-SA 4.0** (Stellarium).

  Szczegóły i pełne teksty licencji: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Podziękowania i inspiracje

**Dane i grafiki**
- [Stellarium](https://stellarium.org): ilustracje gwiazdozbiorów (kultura nieba „modern”), ich punkty zaczepienia i baza nazw gwiazd użyta do weryfikacji. Z niego pochodzi też sposób rozpinania rysunku na sferze według trzech gwiazd.
- [d3-celestial](https://github.com/ofrohn/d3-celestial) (Olaf Frohn): gwiazdy (Hipparcos), linie, granice i etykiety gwiazdozbiorów, obiekty Messiera, kontury Drogi Mlecznej.
- Katalog Hipparcos: ESA (1997), *The Hipparcos and Tycho Catalogues*, ESA SP-1200.

**Cudzy kod w programie**
- [webgl-noise](https://github.com/ashima/webgl-noise) (Ian McEwan, Stefan Gustavson, Ashima Arts, MIT): szum simpleksowy 3D w shaderach nieba i Drogi Mlecznej.
- mulberry32 (Tommy Ettinger, domena publiczna): generator liczb pseudolosowych dla gwiazd tła.

**Algorytmy i źródła naukowe**
- J. Meeus, *Astronomical Algorithms* (2. wyd., 1998): czas gwiazdowy, teoria Księżyca (główne wyrazy), paralaksa.
- J. H. Lieske i in. (1977), A&A 58, 1: precesja IAU 1976.
- G. G. Bennett (1982), *Journal of Navigation* 35, 255 oraz Þ. Sæmundsson (1986), *Sky & Telescope* 72, 70: refrakcja atmosferyczna.
- E. M. Standish, JPL: *Keplerian Elements for Approximate Positions of the Major Planets*. Poprawki dla planet zewnętrznych dopasowano do efemeryd ERFA (astropy).
- E. Delporte (1930): granice gwiazdozbiorów. N. G. Roman (1987), PASP 99, 695: wyznaczanie gwiazdozbioru po przeniesieniu pozycji do epoki B1875.
- F. J. Ballesteros (2012), EPL 97, 34008: temperatura gwiazdy z barwy B−V.
- J. H. Halton (1960): ciąg o niskiej rozbieżności, użyty do przesunięć próbek przy wygładzaniu.

**Inspiracje**
- Plakat *88 Constellations and Their Brightest Stars* ([Dark Sky New Mexico](https://darkskynewmexico.com/2019-6-3-88-constellations-and-their-brightest-stars/)): pomysł na wygląd „Mitologia”.
- DeepZoom: paleta barw i minimalistyczny interfejs.
- Stellarium: ogólny wzór interaktywnego planetarium.

**Weryfikacja:** [astropy](https://www.astropy.org) / ERFA i baza [SIMBAD](https://simbad.u-strasbg.fr) (CDS, Strasburg). **Czcionki:** JetBrains Mono, Cormorant Garamond, Barlow Semi Condensed (Google Fonts, SIL OFL).

Program powstał przy pomocy asystenta AI Claude (Anthropic).
