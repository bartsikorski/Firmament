# Firmament

An interactive sky map that runs in the browser. It shows real stars, all 88 constellations with illustrations and descriptions, and the sky above any place at any time. The whole program is one HTML file: no install, no server.

[Polski](README.pl.md) · the user interface is in Polish

![Summer sky, Realistic look](docs/screenshot-sky.jpg)

| “Mythology” look | A selected constellation with its description and attribute labels |
|---|---|
| ![Constellation illustrations](docs/screenshot-mythology.jpg) | ![Orion](docs/screenshot-orion.jpg) |

## Features

- **About 41,000 real stars down to magnitude 8** from the Hipparcos catalogue, coloured by temperature. A decorative layer of fainter stars fills in when you zoom in. Well-known stars such as Sirius, Polaris, Vega and Algol are always labelled.
- **All 88 constellations:** stick figures, IAU boundaries, and names in three sizes (the least known are smallest), each with a small icon of the figure.
  - Translucent **illustrations** from Stellarium. The constellation under the cursor lights up and its drawing gets attribute labels, such as the club, Medusa’s head or the ear of wheat.
  - Each constellation card says what the figure shows and who introduced it: Ptolemy, Hevelius, Lacaille and others.
- **Messier objects, planets, the Moon with its phase, the Sun, and the Milky Way.** Cepheids list their pulsation period and brightness range.
- **Observer view:** the sky above a chosen city or coordinates at a chosen time, with precession, refraction, horizon, twilight and the local time zone. Time can run faster.
- **14 looks** (Realistic, Mythology, Porcelain, Atlas…), a palette editor, and style import/export.
- **Sky tour:** 19 captioned stops, plus 40 hand-picked targets.
- **Photo mode:** 16:9, 3:2, 1:1 and 4:5 crops, export up to 6K.
- **Image quality:** HDR buffers, progressive anti-aliasing once the view stops, and smooth motion.

## Running it

Download **`Firmament.html`** and open it. It works in current Chrome, Edge, Firefox and Safari and needs WebGL. An internet connection is only used for Google Fonts; without it the program falls back to system fonts.

You can also publish it with **GitHub Pages**: *Settings → Pages → Deploy from a branch → `main`, `/ (root)`*. After a minute it is live at `https://<user>.github.io/<repository>/`; the root `index.html` redirects to `Firmament.html`. After changing `src/`, run `python build.py` before committing so the published file is up to date.

## Controls

- **Drag** to pan. The **mouse wheel** zooms towards the cursor; a **double-click** flies to the point.
- **Hover** over a constellation to highlight it. **Click** to open a card for the constellation, star, planet or object.
- Search understands Polish, Latin and English names (“Syriusz”, “Sirius”, “North Star”) and Messier numbers.

| Key | Action | Key | Action |
|---|---|---|---|
| `H` | home view | `T` | sky tour |
| `M` | sky map / observer view | `I` | constellation illustrations on/off |
| `N` | tonight at 22:00 | `P` | photo mode (`Enter` takes the shot) |
| `R` | random target | `space` | run time |
| `Q` / `E` | rotate | `+` / `−` | zoom |
| `/` | search | `Esc` | deselect, leave |

Settings, custom looks and saved views are stored in the browser (localStorage).

## Development

The sources are in `src/`. Open `src/index.html` in a browser, edit, and reload; **no build step is needed** while working. To produce the single-file app:

```
python build.py                         # -> Firmament.html
python build.py --out other/file.html   # write somewhere else
```

Only Python 3 is required.

| File | Contents |
|---|---|
| `src/index.html`, `src/styles.css` | Interface layout and styles (colours in `:root`) |
| `src/js/00-util.js` | Vector maths, formatting, browser storage |
| `src/js/01-data.js` | Decoding of the star and constellation data |
| `src/js/02-looks.js` | Looks (`LOOKS`), default style, layers and settings |
| `src/js/03-astro.js` | Sidereal time, precession, refraction, Sun, Moon, planets, time zones, Cepheids |
| `src/js/04-view.js` | View state, observing sites (`LOCS`), projections, home view (`HOME`) |
| `src/js/05-gl.js` | WebGL renderer: sky, Milky Way, stars, illustrations |
| `src/js/06-overlay.js` | 2D overlay: figures, names with icons, labels, objects, planets |
| `src/js/07-main.js` | Render loop, animation, picking, info card, tour, photo mode |
| `src/js/08-ui.js` | Panel, sliders, search, statistics |
| `src/js/09-boot.js` | Start-up |
| `src/data/content.js` | **Hand-written content:** descriptions of the 88 figures, attribute labels, famous stars, tour targets |
| `src/data/skydata.js`, `src/data/artdata.js` | Generated data (do not edit by hand) |
| `tools/prep_data.py`, `tools/prep_art.py` | Data generators that read `tools/raw/` |
| `build.py` | Builds `Firmament.html` |
| `index.html`, `.nojekyll` | GitHub Pages entry point redirecting to `Firmament.html`; `.nojekyll` turns off Jekyll processing |

### Regenerating the data

This is only needed after changing `tools/*.py` or `tools/raw/`:

```
pip install -r tools/requirements.txt
python tools/prep_data.py      # stars, constellations, Milky Way (a few minutes)
python tools/prep_art.py       # illustrations and icons (under a minute)
python build.py
```

A small debugging API is available from the browser console as `window.__firmament`.

## Accuracy

Results were checked against astropy (ERFA) and SIMBAD:

- **star positions:** 1–2″;
- **stars in the observer view:** better than 0.01° (precession from J2000 to the date, refraction);
- **Sun and planets:** better than 1′ for 1900–2100;
- **Moon:** about 1′, including topocentric parallax;
- **constellation membership:** exact, using the IAU boundaries in the B1875 frame; constellation areas match the IAU values.

The checks found 31 wrong star names in the source data, which were removed or corrected. For example, the Cepheid η Aquilae was labelled with γ Aql’s name, “Tarazed”. Background stars fainter than magnitude 8 are decorative: their distribution follows the Milky Way, but they are not real stars.

## Licence

- **Program code** (`src/js/`, `src/index.html`, `src/styles.css`, `src/data/content.js`, `build.py`, `tools/*.py`): **MIT**, see [`LICENSE`](LICENSE).
- **Data and artwork** keep their authors’ licences:
  - constellation illustrations and icons (`src/data/artdata.js`, `tools/raw/art/`): **Free Art License 1.3** (Stellarium);
  - catalogue data (`src/data/skydata.js`, `tools/raw/*.json`): **BSD-3-Clause** (d3-celestial) and **CC BY-SA 4.0** (Stellarium).

  Details and full licence texts: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Credits and inspiration

**Data and artwork**
- [Stellarium](https://stellarium.org): constellation illustrations (“modern” sky culture), their anchor stars, and the star-name database used for verification. The technique of pinning a drawing to the sphere by three stars also comes from Stellarium.
- [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn: stars (Hipparcos), constellation lines, boundaries and labels, Messier objects, Milky Way outlines.
- Hipparcos: ESA (1997), *The Hipparcos and Tycho Catalogues*, ESA SP-1200.

**Third-party code included in the program**
- [webgl-noise](https://github.com/ashima/webgl-noise) by Ian McEwan and Stefan Gustavson (Ashima Arts, MIT): 3D simplex noise in the sky and Milky Way shaders.
- mulberry32 by Tommy Ettinger (public domain): pseudo-random generator for the background stars.

**Algorithms and references**
- J. Meeus, *Astronomical Algorithms* (2nd ed., 1998): sidereal time, the main terms of the lunar theory, parallax.
- J. H. Lieske et al. (1977), A&A 58, 1: IAU 1976 precession.
- G. G. Bennett (1982), *Journal of Navigation* 35, 255, and Þ. Sæmundsson (1986), *Sky & Telescope* 72, 70: atmospheric refraction.
- E. M. Standish, JPL: *Keplerian Elements for Approximate Positions of the Major Planets*. Corrections for the outer planets were fitted to ERFA ephemerides via astropy.
- E. Delporte (1930): constellation boundaries. N. G. Roman (1987), PASP 99, 695: identifying a constellation by precessing a position to B1875.
- F. J. Ballesteros (2012), EPL 97, 34008: stellar temperature from B−V.
- J. H. Halton (1960): the low-discrepancy sequence used for anti-aliasing sample offsets.

**Inspiration**
- The poster *88 Constellations and Their Brightest Stars* ([Dark Sky New Mexico](https://darkskynewmexico.com/2019-6-3-88-constellations-and-their-brightest-stars/)) inspired the “Mythology” look.
- DeepZoom inspired the colour palette and the minimal interface.
- Stellarium served as the general model of an interactive planetarium.

**Verification:** [astropy](https://www.astropy.org) / ERFA and [SIMBAD](https://simbad.u-strasbg.fr) (CDS, Strasbourg). **Fonts:** JetBrains Mono, Cormorant Garamond, Barlow Semi Condensed (Google Fonts, SIL OFL).

Built with the help of Claude, an AI assistant by Anthropic.
