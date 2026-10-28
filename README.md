# Firmament

An interactive sky map that runs in the browser. It shows real stars, all 88 constellations with illustrations and descriptions, and the sky above any place at any time. The whole program is one HTML file: no install, no server.

[Polski](README.pl.md) · the user interface is in Polish

![Firmament right after opening: the Milky Way core, constellation names with icons, and the Sagittarius illustration under the cursor](docs/screenshot-sky.jpg)

<p align="center"><sub>Right after opening: the core of the Milky Way, all constellation names with their icons, and the illustration of the constellation under the cursor.</sub></p>

| “Mythology” look, Warsaw at 22:00 | Constellation card with attribute labels | Observer view at dusk |
|---|---|---|
| ![All constellation illustrations over the autumn sky](docs/screenshot-mythology.jpg) | ![Orion selected: card with description, attribute labels on the drawing](docs/screenshot-orion.jpg) | ![The Milky Way setting over the south-western horizon](docs/screenshot-observer.jpg) |

## Features

- **About 41,000 real stars down to magnitude 8** from the HYG database (Hipparcos), coloured by temperature and moved by their proper motion to the date shown. A decorative layer of fainter stars fills in when you zoom in. Well-known stars such as Sirius, Polaris, Vega and Algol are always labelled; names follow the official IAU list, with Polish forms for the best known.
- **Star cards** give the distance in light years and parsecs (from the Hipparcos parallax, flagged when uncertain), how bright the star really is compared with the Sun, its spectral type and temperature.
- **Double stars:** close pairs such as Albireo, Mizar and Alcor or ε Lyrae have a note and a *Show the pair* button. Zoom goes down to 0.1°, where the two stars separate and show their colours (Albireo: gold and blue).
- **All 88 constellations:** stick figures, IAU boundaries, and names in three sizes (the least known are smallest), each with a small icon of the figure.
  - Translucent **illustrations** engraved for Johann Elert Bode’s atlas *Uranographia* (1801), cleaned of their grid and star symbols and laid precisely on the sky. The constellation under the cursor lights up and its drawing gets attribute labels, such as the club, Medusa’s head or the ear of wheat.
  - Each constellation card says what the figure shows and who introduced it: Ptolemy, Hevelius, Lacaille and others.
- **Messier objects, planets, the Moon with its phase, the Sun, and the Milky Way.** Cepheids list their pulsation period and brightness range.
- **Observer view:** the sky above a chosen city or coordinates at a chosen time, with precession, refraction, horizon, twilight and the local time zone. Time can run faster.
- **14 looks** (Realistic, Mythology, Porcelain, Atlas…), a palette editor, and style import/export.
- **Sky tour:** 19 captioned stops, plus 40 hand-picked targets.
- **Meridians:** draw any hour circle (pick it on the sky or with a slider) or the local meridian over the observing site. The panel lists the constellations it crosses from north to south, and the view can ride along it, naming each one in turn (`L`).
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
| `L` | ride along the meridian | `/` | search |
| `Esc` | deselect, leave | | |

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
| `src/js/10-meridian.js` | Meridians: drawing, constellations crossed, the ride |
| `src/js/99-boot.js` | Start-up |
| `src/data/content.js` | **Hand-written content:** descriptions of the 88 figures, attribute labels, famous stars, tour targets |
| `src/data/skydata.js`, `src/data/artdata.js` | Generated data (do not edit by hand) |
| `tools/fetch_sources.py` | Downloads the HYG, IAU and OpenNGC catalogues and trims them into `tools/raw/` |
| `tools/prep_data.py`, `tools/prep_art.py` | Data generators that read `tools/raw/` |
| `tools/bode/` | Turning the scans of Bode’s atlas into sky-mapped illustrations (`tools/raw/bode/`); see [`tools/bode/README.md`](tools/bode/README.md) |
| `build.py` | Builds `Firmament.html` |
| `index.html`, `.nojekyll` | GitHub Pages entry point redirecting to `Firmament.html`; `.nojekyll` turns off Jekyll processing |

### Regenerating the data

This is only needed after changing `tools/*.py` or `tools/raw/`:

```
pip install -r tools/requirements.txt
python tools/fetch_sources.py  # optional: fresh copies of the star, name and Messier catalogues (~40 MB download)
python tools/prep_data.py      # stars, constellations, Milky Way (a few minutes)
python tools/prep_art.py       # illustrations and icons (under a minute)
python build.py
```

The illustrations themselves are made from the scans of Bode’s atlas by the scripts in `tools/bode/` (see the README there); their output is already in `tools/raw/bode/`.

A small debugging API is available from the browser console as `window.__firmament`.

## Accuracy

Results were checked against astropy (ERFA), SIMBAD and an independent copy of the catalogues:

- **star positions:** Hipparcos (new reduction, J2000) moved to the shown date by proper motion; HYG and the earlier d3-celestial data agree to a median of 0.14″;
- **stars in the observer view:** better than 0.01° (precession from J2000 to the date, refraction);
- **Sun and planets:** better than 1′ for 1900–2100;
- **Moon:** about 1′, including topocentric parallax;
- **Messier objects:** centres, sizes and orientation from OpenNGC (the previous data was off by up to 19′ for some objects);
- **constellation membership:** exact, using the IAU boundaries in the B1875 frame, in which every edge runs along a line of constant RA or Dec. The boundaries are recomputed in that frame, which also removed an error in the source data near the north celestial pole (the Ursa Minor/Cepheus border was drawn up to 0.45° too far south). Constellation areas match the IAU values.

Star names come from the official IAU WGSN list, which fixed several names inherited from older data (for example, the Cepheid η Aquilae was once labelled “Tarazed”, the name of γ Aql). Background stars fainter than magnitude 8 are decorative: their distribution follows the Milky Way, but they are not real stars.

## Licence

- **Program code** (`src/js/`, `src/index.html`, `src/styles.css`, `src/data/content.js`, `build.py`, `tools/*.py`): **MIT**, see [`LICENSE`](LICENSE).
- **Data and artwork** keep their authors’ licences:
  - constellation illustrations (`src/data/artdata.js`, `tools/raw/bode/`): engravings by J. E. Bode (1801), **public domain**; their processing is part of the MIT-licensed code;
  - catalogue data (`src/data/skydata.js`, `tools/raw/`): **CC BY-SA 4.0** (HYG, OpenNGC), **BSD-3-Clause** (d3-celestial) and **MIT** (IAU name list compiled by C. Schneck).

  Details and full licence texts: [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md).

## Credits and inspiration

**Data and artwork**
- Johann Elert Bode, *Uranographia sive astrorum descriptio* (Berlin 1801): the constellation illustrations and icons. Scans: ETH-Bibliothek Zürich, [e-rara.ch](https://www.e-rara.ch/zut/content/titleinfo/3341734).
- [HYG Database](https://github.com/astronexus/HYG-Database) 4.1 by David Nash: stars with proper motions, distances, spectral types and Bayer/Flamsteed designations.
- [IAU Working Group on Star Names](https://www.iau.org/public/themes/naming_stars/): official star names, via the list compiled by [Cora Schneck](https://github.com/cyschneck/iau-star-names).
- [OpenNGC](https://github.com/mattiaverga/OpenNGC) by Mattia Verga: Messier positions, sizes and orientations.
- [d3-celestial](https://github.com/ofrohn/d3-celestial) by Olaf Frohn: constellation lines, boundaries and labels, the Messier list, Milky Way outlines.
- Hipparcos: ESA (1997), *The Hipparcos and Tycho Catalogues*, ESA SP-1200; F. van Leeuwen (2007), A&A 474, 653.

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
- Stellarium served as the general model of an interactive planetarium; the technique of pinning a drawing to the sphere by three points also comes from it.

**Verification:** [astropy](https://www.astropy.org) / ERFA and [SIMBAD](https://simbad.u-strasbg.fr) (CDS, Strasbourg). **Fonts:** JetBrains Mono, Cormorant Garamond, Barlow Semi Condensed (Google Fonts, SIL OFL).

Built with the help of Claude, an AI assistant by Anthropic.
