# Ryciny gwiazdozbiorów z atlasu Bodego

Ilustracje gwiazdozbiorów w Firmamencie pochodzą z atlasu **Johanna Elerta Bodego, *Uranographia sive astrorum descriptio*** (Berlin 1801). Atlas jest w domenie publicznej. Skany udostępnia ETH-Bibliothek Zürich w serwisie [e-rara.ch](https://www.e-rara.ch/zut/content/titleinfo/3341734).

Atlas ma 20 rycin. Ryciny III–XX pokazują całe niebo w rzucie stożkowym, a dwie półkule z rycin I i II nie są potrzebne. Na każdej rycinie są figury, siatka współrzędnych dla roku 1800 i ok. 17 tys. gwiazd. Ten folder zawiera kroki, które zamieniają skany w obrazy rozpięte na niebie.

| Krok | Plik | Co robi |
|---|---|---|
| 1 | `fetch_plates.py` | Pobiera 18 rycin (3200 px, odcienie szarości, ok. 25 MB) do `plates/`. |
| 2 | `fit_plates.py` | Dopasowuje rycinę do nieba i zapisuje wynik w `models/m_pNN.json`. Szczegóły niżej. |
| 3 | `clean_plates.py` | Usuwa z ryciny siatkę, pasy równika i ekliptyki oraz symbole gwiazd i wyrównuje papier. Wyznacza też obszar, któremu można ufać: wnętrze ramki mapy, z dala od grzbietu. Wynik trafia do `work/`. |
| 4 | `make_figures.py` | Składa obraz każdego gwiazdozbioru z rycin, które go obejmują, i zapisuje go w `tools/raw/bode/`. Wąski pas nieba ukryty w zgięciu grzbietu jest dopełniany sąsiednią treścią ryciny. |
| 5 | `../prep_art.py` | Pakuje ryciny i ikony do `src/data/artdata.js`. |

**Dopasowanie (krok 2):**
- Program wykrywa wygrawerowane symbole gwiazd i paruje je z gwiazdami katalogu HYG.
- Punkt startowy to kilka ręcznie wskazanych jasnych gwiazd z `anchors.json`.
- Każda strona rozkładówki ma własny model, a położenie grzbietu książki zapisuje `gutter.json`. Model to stożek, zgodnie z rzutem Bodego, z gładką poprawką na wygięcie papieru. Dla map okołorównikowych model jest wielomianowy.
- Typowy błąd to 2–3 px, czyli ok. 0,1°.
- Kontrola: każda gwiazda do 4,5 mag wewnątrz ramki mapy musi leżeć na swoim symbolu.

Wyniki kroków 2 i 4 są w repozytorium, więc do zwykłej pracy wystarczy `python tools/prep_art.py`. Pełne odtworzenie od skanów wygląda tak:

```
pip install -r tools/requirements.txt
python tools/bode/fetch_plates.py
python tools/bode/fit_plates.py --check      # opcjonalnie; modele są już w models/
python tools/bode/clean_plates.py
python tools/bode/make_figures.py            # kilkanaście minut
python tools/prep_art.py
python build.py
```

Na rycinach widać też gwiazdozbiory, które Bode zaliczał do nieba, a które później wyszły z użycia, np.:
- Kota (Felis);
- Balon (Globus Aerostaticus);
- Maszynę Elektryczną;
- Drukarnię (Officina Typographica);
- Lutnię Jerzego (Harpa Georgii);
- Byka Poniatowskiego (Taurus Poniatovii).

Każdy z nich leży w granicach któregoś z dzisiejszych gwiazdozbiorów i pokazuje się razem z nim.
