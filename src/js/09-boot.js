'use strict';
/* FIRMAMENT · start
   Budowa interfejsu, wczytanie ilustracji, ikon i tekstury Drogi Mlecznej, wygenerowanie słabych gwiazd tła
   i start pętli. */
buildLooks(); buildPalSel(); buildTargets(); syncStyleUI(); syncNavUI(); syncTimeUI(true); syncHistUI(); syncTourUI();
if (sky) { sky.setStars(realStars, NS); sky.setArt(ART); }
// illustrations decode in the background; each figure appears as soon as its image is ready
ART.forEach((A, k) => {
  const im = new Image(), mk = new Image(); let n = 0;
  const done = () => {
    if (++n < 2) return;
    try { artImgs[k] = artTexture(im, mk); } catch (e) { console.warn('Ilustracja', A.c, e); return; }
    if (sky) sky.setArtImage(k, artImgs[k]); if (thumbGL) thumbGL.setArtImage(k, artImgs[k]); glDirty = true; thumbsDirty = true;
  };
  im.onload = mk.onload = done; im.src = A.img; mk.src = A.mask;
});
{ const im = new Image(); im.onload = () => { ICON.img = im; ICON.tint.clear(); ovDirty = true; }; im.src = ICONDATA.img; }
{
  const img = new Image();
  img.onload = () => { mwImg = img; if (sky) { sky.setMW(img); allStars = genFaint(img); sky.setStars(allStars, NS); } if (thumbGL) thumbGL.setMW(img); invalidate(); };
  img.src = MWTEX;
}
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { ovDirty = true; thumbsDirty = true; });
pushHist();
requestAnimationFrame(t => { lastT = t; frame(t); });
// handle for debugging from the browser console
window.__firmament = { st, style, layers, settings, select, flyTo, setMode, setTime, setPhoto, capture, invalidate, vec };
