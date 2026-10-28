# Third-party notices / Licencje materiałów zewnętrznych

Kod Firmamentu jest udostępniony na licencji MIT (plik `LICENSE`). Poniższe dane, grafiki i fragmenty kodu pochodzą od innych autorów i podlegają ich licencjom.
*The Firmament code is MIT-licensed (`LICENSE`). The data, artwork and code fragments below come from other authors and keep their licences.*

| Składnik / Component | Gdzie / Where | Autor / Author | Licencja / Licence |
|---|---|---|---|
| Ilustracje gwiazdozbiorów / constellation illustrations: ryciny III–XX atlasu / plates III–XX of the atlas *Uranographia sive astrorum descriptio* (Berlin 1801) | skany / scans: `tools/bode/fetch_plates.py`; oczyszczone i rozpięte na niebie / cleaned and mapped onto the sky: `tools/raw/bode/`; przetworzone (wyrównanie jasności, maski, ikony) / processed (levels, masks, icons) w `src/data/artdata.js` | Johann Elert Bode (1747–1826); skany / scans: ETH-Bibliothek Zürich, e-rara.ch, https://www.e-rara.ch/zut/content/titleinfo/3341734 | domena publiczna / public domain |
| Gwiazdy do 8 mag: pozycje, ruch własny, odległości, jasności, B−V, typy widmowe, oznaczenia Bayera i Flamsteeda / stars to mag 8: positions, proper motions, distances, magnitudes, B−V, spectral types, Bayer and Flamsteed designations | `tools/raw/hyg_v41_mag8.csv` (wycinek / extract); przetworzone w / processed into `src/data/skydata.js` | David Nash, HYG Database 4.1, https://github.com/astronexus/HYG-Database (na podstawie / based on Hipparcos, Yale BSC, Gliese) | CC BY-SA 4.0 |
| Oficjalne nazwy gwiazd IAU / official IAU star names (WGSN) | `tools/raw/iau_star_names.csv`; użyte w / used in `src/data/skydata.js` | IAU Working Group on Star Names; zestawienie / compiled by Cora Schneck, https://github.com/cyschneck/iau-star-names | MIT (zestawienie / compilation) |
| Pozycje, rozmiary i kąty położenia obiektów Messiera / Messier positions, sizes and position angles | `tools/raw/openngc_messier.csv` (wycinek / extract); użyte w / used in `src/data/skydata.js` | Mattia Verga, OpenNGC, https://github.com/mattiaverga/OpenNGC | CC BY-SA 4.0 |
| Linie, granice i etykiety gwiazdozbiorów, lista i typy obiektów Messiera, kontury Drogi Mlecznej / constellation lines, boundaries and labels, Messier list and types, Milky Way outlines | `tools/raw/*.json`; przetworzone w / processed into `src/data/skydata.js` (granice przeliczone przez układ B1875 / boundaries recomputed via the B1875 frame) | Olaf Frohn, d3-celestial, https://github.com/ofrohn/d3-celestial | BSD-3-Clause |
| Katalog Hipparcos / Hipparcos catalogue (przez HYG / via HYG) | `src/data/skydata.js` | ESA (1997), *The Hipparcos and Tycho Catalogues*, ESA SP-1200; F. van Leeuwen (2007), A&A 474, 653 | wolne użycie z podaniem źródła / free use with acknowledgement |
| Szum simpleksowy 3D (GLSL) / 3D simplex noise (GLSL) | `src/js/05-gl.js` (`GLSL_NOISE`) | Ian McEwan, Stefan Gustavson, Ashima Arts — webgl-noise | MIT |
| mulberry32 PRNG | `src/js/00-util.js` | Tommy Ettinger | public domain |
| Czcionki / Fonts: JetBrains Mono, Cormorant Garamond, Barlow Semi Condensed | ładowane z / loaded from Google Fonts (nie dołączone / not bundled) | JetBrains; Christian Thalmann; Jeremy Tribby | SIL Open Font License 1.1 |

Ryciny Bodego są w domenie publicznej. Ich obróbka (usunięcie siatki i symboli gwiazd, rzut na niebo, maski, ikony) jest częścią Firmamentu i podlega licencji MIT. Plik danych `src/data/skydata.js` zawiera dane z HYG i OpenNGC, więc jako całość jest udostępniony na licencji CC BY-SA 4.0 (z zachowaniem informacji o licencji BSD-3 dla części z d3-celestial).
*Bode’s plates are in the public domain. Their processing (grid and star symbols removed, projection onto the sky, masks, icons) is part of Firmament and MIT-licensed. The data file `src/data/skydata.js` contains HYG and OpenNGC data, so as a whole it is released under CC BY-SA 4.0 (keeping the BSD-3 notice for the d3-celestial parts).*

Do weryfikacji obliczeń (poza programem) użyto / *Used for verification only (not distributed):* astropy and ERFA (BSD-3-Clause), SIMBAD (CDS, Strasbourg).

---

## Creative Commons Attribution-ShareAlike 4.0

Pełny tekst / full text: https://creativecommons.org/licenses/by-sa/4.0/legalcode

## iau-star-names — MIT

```
MIT License

Copyright (c) 2025 Cora Schneck

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

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
