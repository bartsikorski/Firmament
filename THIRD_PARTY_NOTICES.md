# Third-party notices / Licencje materiałów zewnętrznych

Kod Firmamentu jest udostępniony na licencji MIT (plik `LICENSE`). Poniższe dane, grafiki i fragmenty kodu pochodzą od innych autorów i podlegają ich licencjom.
*The Firmament code is MIT-licensed (`LICENSE`). The data, artwork and code fragments below come from other authors and keep their licences.*

| Składnik / Component | Gdzie / Where | Autor / Author | Licencja / Licence |
|---|---|---|---|
| Ilustracje gwiazdozbiorów, kultura nieba „modern” / constellation illustrations, “modern” sky culture | `tools/raw/art/*.png`; przetworzone (odcienie szarości, wyrównanie jasności, maski, ikony) / processed (greyscale, levels, masks, icons) w `src/data/artdata.js` | Stellarium team, https://stellarium.org | Free Art License 1.3 |
| Punkty zaczepienia ilustracji, baza nazw gwiazd / illustration anchors, star-name database | `tools/raw/stellarium_modern_index.json`; użyte w / used in `src/data/artdata.js`, `src/data/skydata.js` | Stellarium team | CC BY-SA 4.0 |
| Gwiazdy (Hipparcos), linie, granice i etykiety gwiazdozbiorów, obiekty Messiera, kontury Drogi Mlecznej / stars, constellation lines, boundaries and labels, Messier objects, Milky Way outlines | `tools/raw/*.json`; przetworzone w / processed into `src/data/skydata.js` | Olaf Frohn, d3-celestial, https://github.com/ofrohn/d3-celestial | BSD-3-Clause |
| Katalog Hipparcos / Hipparcos catalogue (via d3-celestial) | `src/data/skydata.js` | ESA (1997), *The Hipparcos and Tycho Catalogues*, ESA SP-1200 | wolne użycie z podaniem źródła / free use with acknowledgement |
| Szum simpleksowy 3D (GLSL) / 3D simplex noise (GLSL) | `src/js/05-gl.js` (`GLSL_NOISE`) | Ian McEwan, Stefan Gustavson, Ashima Arts — webgl-noise | MIT |
| mulberry32 PRNG | `src/js/00-util.js` | Tommy Ettinger | public domain |
| Czcionki / Fonts: JetBrains Mono, Cormorant Garamond, Barlow Semi Condensed | ładowane z / loaded from Google Fonts (nie dołączone / not bundled) | JetBrains; Christian Thalmann; Jeremy Tribby | SIL Open Font License 1.1 |

Utwory pochodne od ilustracji Stellarium (obrazy i ikony w `src/data/artdata.js`) są rozpowszechniane na tej samej licencji Free Art License 1.3.
*Derivatives of the Stellarium illustrations (images and icons in `src/data/artdata.js`) are distributed under the same Free Art License 1.3.*

Do weryfikacji obliczeń (poza programem) użyto / *Used for verification only (not distributed):* astropy and ERFA (BSD-3-Clause), SIMBAD (CDS, Strasbourg).

---

## Free Art License 1.3 (Licence Art Libre)

Pełny tekst / full text: https://artlibre.org/licence/lal/en/

Wolno kopiować, rozpowszechniać i przekształcać utwór, także komercyjnie, pod warunkiem podania autora, wskazania licencji i udostępnienia utworów pochodnych na tej samej licencji.
*You may copy, distribute and transform the work, including commercially, provided you credit the author, indicate the licence and release derivatives under the same licence.*

## Creative Commons Attribution-ShareAlike 4.0

Pełny tekst / full text: https://creativecommons.org/licenses/by-sa/4.0/legalcode

## d3-celestial — BSD-3-Clause

```
Copyright (c) 2015, Olaf Frohn
All rights reserved.

Redistribution and use in source and binary forms, with or without modification, are permitted provided that the following conditions are met:

1. Redistributions of source code must retain the above copyright notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above copyright notice, this list of conditions and the following disclaimer in the documentation and/or other materials provided with the distribution.

3. Neither the name of the copyright holder nor the names of its contributors may be used to endorse or promote products derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
```

## webgl-noise — MIT

```
Copyright (C) 2011 by Ashima Arts (Simplex noise)
Copyright (C) 2011-2016 by Stefan Gustavson (Classic noise and others)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
```
