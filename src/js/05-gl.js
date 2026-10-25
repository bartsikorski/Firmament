'use strict';
/* FIRMAMENT · renderer WebGL
   Shadery nieba, Drogi Mlecznej, horyzontu, gwiazd i ilustracji gwiazdozbiorów; klasa SkyGL; dane
   wierzchołków gwiazd (prawdziwe do 8 mag + dekoracyjne tło); siatki ilustracji; parametry renderu (buildR).
   Wygląd gwiazd stroisz w VS_STAR / FS_STAR, nieba w FS_SKY, ilustracji w FS_ART. */
/* 3D simplex noise (snoise) from webgl-noise by Ian McEwan and Stefan Gustavson, Ashima Arts,
   MIT License – https://github.com/ashima/webgl-noise (notice in THIRD_PARTY_NOTICES.md) */
const GLSL_NOISE = `
vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}
float snoise(vec3 v){
  const vec2 C=vec2(1.0/6.0,1.0/3.0); const vec4 D=vec4(0.0,0.5,1.0,2.0);
  vec3 i=floor(v+dot(v,C.yyy)); vec3 x0=v-i+dot(i,C.xxx);
  vec3 g=step(x0.yzx,x0.xyz); vec3 l=1.0-g; vec3 i1=min(g.xyz,l.zxy); vec3 i2=max(g.xyz,l.zxy);
  vec3 x1=x0-i1+C.xxx; vec3 x2=x0-i2+C.yyy; vec3 x3=x0-D.yyy;
  i=mod289(i);
  vec4 p=permute(permute(permute(i.z+vec4(0.0,i1.z,i2.z,1.0))+i.y+vec4(0.0,i1.y,i2.y,1.0))+i.x+vec4(0.0,i1.x,i2.x,1.0));
  float n_=0.142857142857; vec3 ns=n_*D.wyz-D.xzx;
  vec4 j=p-49.0*floor(p*ns.z*ns.z);
  vec4 x_=floor(j*ns.z); vec4 y_=floor(j-7.0*x_);
  vec4 x=x_*ns.x+ns.yyyy; vec4 y=y_*ns.x+ns.yyyy; vec4 h=1.0-abs(x)-abs(y);
  vec4 b0=vec4(x.xy,y.xy); vec4 b1=vec4(x.zw,y.zw);
  vec4 s0=floor(b0)*2.0+1.0; vec4 s1=floor(b1)*2.0+1.0; vec4 sh=-step(h,vec4(0.0));
  vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy; vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;
  vec3 p0=vec3(a0.xy,h.x); vec3 p1=vec3(a0.zw,h.y); vec3 p2=vec3(a1.xy,h.z); vec3 p3=vec3(a1.zw,h.w);
  vec4 nm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
  p0*=nm.x;p1*=nm.y;p2*=nm.z;p3*=nm.w;
  vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0); m=m*m;
  return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
}
float fbm(vec3 p){float a=0.5,s=0.0;for(int i=0;i<4;i++){s+=a*snoise(p);p=p*2.03+vec3(1.7,9.2,3.1);a*=0.5;}return s;}
float fbm3(vec3 p){float a=0.5,s=0.0;for(int i=0;i<3;i++){s+=a*snoise(p);p=p*2.07+vec3(4.1,1.3,7.7);a*=0.5;}return s;}
`;
const GLSL_HOR = `
float hs(float k,float p,float a){return 0.5+0.5*sin(k*a+p);}
float horizonH(float a){return 0.004+0.020*hs(2.0,0.3,a)*hs(5.0,1.1,a)+0.012*hs(9.0,2.0,a)*hs(3.0,0.7,a)+0.005*hs(17.0,0.2,a)*hs(6.0,2.4,a)+0.0025*hs(31.0,1.7,a)+0.0012*hs(57.0,0.4,a);}
vec3 shiftAlt(vec3 h,float dDeg){float l=length(h.xy); if(l<1e-6) return h; float a=asin(clamp(h.z,-1.0,1.0))+radians(dDeg); return vec3(h.xy/l*cos(a),sin(a));}
float refrD(float h){ if(h<-2.0) return 0.0; float x=max(h,-1.9); float R=1.02/tan(radians(x+10.3/(x+5.11)))/60.0; return h<-1.0 ? R*(h+2.0) : R; }
float unrefrD(float h){ if(h<-2.0) return 0.0; float x=max(h,-1.9); float R=1.0/tan(radians(x+7.31/(x+4.4)))/60.0; return h<-1.0 ? R*(h+2.0) : R; }
vec3 refrV(vec3 h){ return shiftAlt(h, refrD(degrees(asin(clamp(h.z,-1.0,1.0))))); }
vec3 unrefrV(vec3 h){ return shiftAlt(h, -unrefrD(degrees(asin(clamp(h.z,-1.0,1.0))))); }
`;
const GLSL_INV = `
uniform vec2 uRes; uniform float uScale; uniform float uProj;
vec3 invProj(vec2 fc, out float valid){
  vec2 p=(fc-0.5*uRes)/uScale; valid=1.0;
  if(uProj<0.5){ float r2=dot(p,p); float a=(4.0-r2)/(4.0+r2); return vec3(p*(1.0+a)*0.5,a); }
  else if(uProj<1.5){ float th=length(p); if(th>3.14159265){valid=0.0; th=3.14159265;} vec2 d= th>1e-6 ? p/th : vec2(0.0); return vec3(d*sin(th),cos(th)); }
  float r2=dot(p,p); if(r2>1.0){ valid=0.0; return vec3(normalize(p),0.0);} return vec3(p,sqrt(1.0-r2));
}
`;
const PREC = `#ifdef GL_FRAGMENT_PRECISION_HIGH
precision highp float;
#else
precision mediump float;
#endif
`;
const VS_QUAD = `attribute vec2 aPos; void main(){ gl_Position=vec4(aPos,0.0,1.0); }`;
const FS_SKY = PREC + GLSL_NOISE + GLSL_HOR + GLSL_INV + `
uniform mat3 uLocToEq, uGal, uLocToHor, uHorToEq; uniform float uRefr; uniform sampler2D uMW; uniform vec2 uJitter;
uniform vec3 uBg0,uBg1,uMwLo,uMwHi,uNeb; uniform float uMwAmt,uNebAmt,uDust,uVig;
void main(){
  float valid; vec3 L=invProj(gl_FragCoord.xy+uJitter,valid);
  vec3 eq= uRefr>0.5 ? uHorToEq*unrefrV(uLocToHor*L) : uLocToEq*L; vec3 gal=uGal*eq;
  vec2 sc=(gl_FragCoord.xy-0.5*uRes)/uRes.y; float rr=length(sc);
  float l=atan(gal.y,gal.x); float b=asin(clamp(gal.z,-1.0,1.0));
  float m=texture2D(uMW,vec2(fract(l/6.2831853),b/3.14159265+0.5)).r;
  float vr=fbm3(eq*1.4+4.0)*0.5+0.5;
  float base=clamp(0.30+0.45*vr+0.55*m*uMwAmt,0.0,1.25)*(1.0-uVig*min(rr*rr*0.85,0.9));
  vec3 col=mix(uBg1,uBg0,base);
  float n1=fbm(gal*8.0); float rid=1.0-abs(snoise(gal*21.0+2.7)); rid=rid*rid*rid; float n3=snoise(gal*44.0+1.9);
  float cloud=m*(0.66+0.46*n1+0.17*rid+0.12*n3);
  float lane=smoothstep(0.05,0.6,fbm3(gal*9.0+3.1)*0.5+0.32)*exp(-pow(gal.z/0.075,2.0));
  float wisp=smoothstep(0.55,0.95,1.0-abs(snoise(gal*13.0+8.1)));
  cloud*=1.0-uDust*clamp(lane*0.85+wisp*0.35*m,0.0,0.92);
  cloud=max(cloud,0.0);
  vec3 mwc=mix(uMwLo,uMwHi,smoothstep(0.08,1.0,cloud));
  col+=mwc*cloud*uMwAmt*0.9;
  float nb=fbm3(eq*2.1+11.0)*0.5+0.5; nb=smoothstep(0.45,0.95,nb);
  col+=uNeb*nb*nb*uNebAmt*(0.35+m*0.9);
  if(valid<0.5) col=uBg1*0.35;
  gl_FragColor=vec4(col,1.0);
}`;
const FS_COMP = PREC + GLSL_HOR + GLSL_INV + `
uniform sampler2D uSky; uniform float uObs,uGroundOn,uDay,uTwi,uGlowAmt,uGrain,uTime;
uniform mat3 uLocToHor; uniform vec3 uSunHor,uGround,uGlow,uDayZen,uDayHor,uTwiCol,uEdge;
float hash(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453);}
void main(){
  vec3 col=texture2D(uSky,gl_FragCoord.xy/uRes).rgb;
  float valid; vec3 L=invProj(gl_FragCoord.xy,valid);
  if(uObs>0.5 && valid>0.5){
    vec3 h=uLocToHor*L; float alt=asin(clamp(h.z,-1.0,1.0)); float az=atan(h.y,h.x);
    float sd=max(dot(h,uSunHor),0.0);
    col+=uGlow*exp(-max(alt,0.0)/0.12)*uGlowAmt*(1.0-uDay);
    vec3 tw=uTwiCol*(0.25+0.75*sd*sd)*exp(-max(alt,0.0)/0.32);
    col=mix(col,col*0.55+tw,uTwi);
    vec3 dayc=mix(uDayZen,uDayHor,pow(clamp(1.0-h.z,0.0,1.0),2.5))+vec3(0.85,0.78,0.62)*pow(max(sd,1e-4),40.0)*0.45;
    col=mix(col,dayc,uDay);
    if(uGroundOn>0.5){
      float hh=horizonH(az); vec2 p=(gl_FragCoord.xy-0.5*uRes)/uScale;
      float px=1.3/(uScale*(1.0+dot(p,p)*0.25));
      float g=smoothstep(hh-px,hh+px,alt);
      float depth=clamp((hh-alt)/0.5,0.0,1.0);
      vec3 grd=uGround*(1.0-0.5*depth)+uGlow*0.22*exp(-max(hh-alt,0.0)/0.03)*(1.0-uDay);
      grd=mix(grd,grd*2.2+uDayHor*0.10,uDay);
      col=mix(grd,col,g);
    }
  }
  if(valid<0.5){ col=uEdge; }
  float n=hash(gl_FragCoord.xy+fract(uTime*0.37)*91.0);
  col+=(n-0.5)*(1.2+uGrain*7.0)/255.0;
  gl_FragColor=vec4(col,1.0);
}`;
const VS_STAR = GLSL_HOR + `
attribute vec3 aPos; attribute vec3 aInfo;
uniform mat3 uEqToLoc,uEqToHor,uHorToLoc; uniform vec2 uRes; uniform float uScale,uProj,uRefr;
uniform float uMagLim,uSize,uSizeExp,uBright,uGlow,uSpike,uSat,uTwinkle,uTime,uPR,uObs,uGroundOn,uStarVis,uSpectral,uMaxPt;
uniform vec3 uHot,uMid,uCool;
varying vec3 vCol; varying float vCore,vHalo,vHaloR,vSpike,vSize,vA;
void main(){
  vec3 hT=uEqToHor*aPos; vec3 hA= uRefr>0.5 ? refrV(hT) : hT;
  vec3 L= uRefr>0.5 ? uHorToLoc*hA : uEqToLoc*aPos; vec2 p; float ok=1.0;
  if(uProj<0.5){ if(L.z<-0.86) ok=0.0; p=L.xy*2.0/(1.0+max(L.z,-0.86)); }
  else if(uProj<1.5){ float s=length(L.xy); float th=atan(s,L.z); p= s>1e-7 ? L.xy/s*th : vec2(0.0); }
  else { if(L.z<0.0) ok=0.0; p=L.xy; }
  float mag=aInfo.x;
  if(uObs>0.5){ vec3 h=hA; float alt=asin(clamp(h.z,-1.0,1.0));
    if(uGroundOn>0.5 && alt<horizonH(atan(h.y,h.x))) ok=0.0;
    float sa=max(sin(alt),0.0); mag+=0.1*(1.0/(sa+0.06)-1.0); }
  float dm=uMagLim-mag;
  if(dm<-0.4) ok=0.0;
  if(ok<0.5){ gl_Position=vec4(2.0,2.0,2.0,1.0); gl_PointSize=0.0; vA=0.0; return; }
  float f=pow(10.0,0.4*dm);
  float vis=smoothstep(-0.4,0.7,dm)*uStarVis;
  float tw=1.0+uTwinkle*0.32*sin(uTime*(1.6+aInfo.z*4.2)+aInfo.z*91.0)*clamp(1.15-0.12*dm,0.35,1.0);
  float core=max(uPR*uSize*(0.5+0.46*pow(f,uSizeExp)),0.85);
  float lf=log2(1.0+f);
  vA=uBright*vis*tw*clamp(0.3+0.2*lf,0.0,1.4);
  vHalo=uGlow*0.32*clamp((lf-2.5)/6.0,0.0,1.4);
  vHaloR=core*2.2+uPR*2.0;
  vSpike=uSpike*0.6*smoothstep(6.5,11.5,lf);
  float spikeL=core*10.0*uSpike;
  float sz=2.0*max(max(core*2.8, vHalo>0.002 ? vHaloR*4.2 : 0.0), vSpike>0.002 ? spikeL : 0.0)+2.0;
  vSize=min(sz,uMaxPt); vCore=core;
  float t=clamp((aInfo.y+0.33)/2.1,0.0,1.0);
  vec3 c= t<0.4 ? mix(uHot,uMid,t/0.4) : mix(uMid,uCool,(t-0.4)/0.6);
  c=mix(uMid,c,uSpectral);
  float g=dot(c,vec3(0.299,0.587,0.114)); vCol=mix(vec3(g),c,uSat);
  gl_PointSize=vSize;
  gl_Position=vec4(p*uScale/(0.5*uRes),0.0,1.0);
}`;
const FS_STAR = PREC + `
varying vec3 vCol; varying float vCore,vHalo,vHaloR,vSpike,vSize,vA;
void main(){
  vec2 d=(gl_PointCoord-0.5)*vSize; float r2=dot(d,d); float r=sqrt(r2);
  float core=exp(-r2/(vCore*vCore*0.85));
  float halo=vHalo*exp(-r/vHaloR);
  float sp=0.0;
  if(vSpike>0.0){ float w=0.6; float L=vSize*0.17; sp=vSpike*(exp(-abs(d.y)/w)*exp(-abs(d.x)/L)+exp(-abs(d.x)/w)*exp(-abs(d.y)/L)); }
  float edge=1.0-smoothstep(0.38,0.5,length(gl_PointCoord-0.5));
  float I=(core+halo+sp)*edge;
  vec3 col=mix(vCol,vec3(1.0),clamp(core*0.5,0.0,1.0));
  gl_FragColor=vec4(col*I*vA,1.0);
}`;
const VS_ART = GLSL_HOR + `
attribute vec3 aPos; attribute vec2 aUv;
uniform mat3 uEqToLoc,uEqToHor,uHorToLoc; uniform vec2 uRes; uniform float uScale,uProj,uRefr;
varying vec2 vUv; varying vec3 vHor; varying float vZ;
void main(){
  vec3 hT=uEqToHor*aPos; vec3 hA= uRefr>0.5 ? refrV(hT) : hT;
  vec3 L= uRefr>0.5 ? uHorToLoc*hA : uEqToLoc*aPos; vec2 p;
  if(uProj<0.5){ p=L.xy*2.0/(1.0+max(L.z,-0.9)); }
  else if(uProj<1.5){ float s=length(L.xy); float th=atan(s,L.z); p= s>1e-7 ? L.xy/s*th : vec2(0.0); }
  else { p=L.xy; }
  vUv=aUv; vHor=hA; vZ=L.z;
  gl_Position=vec4(p*uScale/(0.5*uRes),0.0,1.0);
}`;
/* Constellation illustration: keeps the drawing's own shading, tinted by the look; a highlighted
   figure brightens and gets a slow diagonal sheen. The texture carries the drawing (luminance) and the
   figure's coverage mask (alpha): the mask dims the sky under the figure ("ink"), so dark strokes of the
   drawing – attributes, folds, faces – read as lines instead of holes in the glow. */
const FS_ART = PREC + GLSL_HOR + `
uniform sampler2D uTex; uniform vec3 uTint; uniform float uAlpha,uHi,uTime,uObs,uGroundOn,uProj,uInk;
varying vec2 vUv; varying vec3 vHor; varying float vZ;
void main(){
  if(uProj>1.5 && vZ<0.0) discard;
  if(uObs>0.5 && uGroundOn>0.5){ vec3 h=normalize(vHor); if(asin(clamp(h.z,-1.0,1.0))<horizonH(atan(h.y,h.x))) discard; }
  vec4 t=texture2D(uTex,vUv); float a=t.r, cov=t.a;
  float e=smoothstep(0.0,0.035,min(min(vUv.x,vUv.y),min(1.0-vUv.x,1.0-vUv.y)));
  float lum=a*a*0.9+a*0.24;
  float band=fract(dot(vUv,vec2(0.62,0.38))-uTime*0.11);
  float sweep=uHi*pow(max(0.0,1.0-abs(band-0.5)*7.0),4.0)*smoothstep(0.12,0.5,a);
  vec3 col=uTint*lum*(1.0+0.75*uHi)+vec3(0.92,0.96,1.0)*sweep*0.6;
  float k=uAlpha*e;
  gl_FragColor=vec4(col*k, min(0.9,cov*k*uInk*(1.0+0.35*uHi)));   // premultiplied: sky*(1-alpha)+col
}`;
function upMat(gl, loc, A) { if (loc) gl.uniformMatrix3fv(loc, false, new Float32Array(tr(A))); }
/* SkyGL – renderer nieba.
   Przebieg: (1) niebo (tło, Droga Mleczna, mgławice) do bufora pozaekranowego,
   (2) kompozycja: horyzont, atmosfera, dzień/zmierzch, dithering, (3) gwiazdy jako punkty addytywnie.
   Podczas ruchu niebo liczone jest w obniżonej rozdzielczości (bufor tLo). Po zatrzymaniu
   bufor tAcc w pełnej rozdzielczości uśrednia kolejne próbki z subpikselowym przesunięciem
   (sekwencja Haltona) – to „dopracowanie” z wygładzaniem. Gdy przeglądarka pozwala,
   bufory są zmiennoprzecinkowe (half-float), co usuwa pasmowanie ciemnych gradientów. */
class SkyGL {
  constructor(canvas) {
    const o = { antialias: false, alpha: false, depth: false, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' };
    let gl = canvas.getContext('webgl2', o); this.v2 = !!gl;
    if (!gl) gl = canvas.getContext('webgl', o);
    if (!gl) throw new Error('no webgl');
    this.gl = gl; this.c = canvas;
    this.pSky = this.prog(VS_QUAD, FS_SKY); this.pComp = this.prog(VS_QUAD, FS_COMP); this.pStar = this.prog(VS_STAR, FS_STAR); this.pArt = this.prog(VS_ART, FS_ART);
    this.arts = []; this.aniso = gl.getExtension('EXT_texture_filter_anisotropic');
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.mw = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.mw); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array([0]));
    this.texParams(gl.CLAMP_TO_EDGE);
    this.starBuf = gl.createBuffer(); this.nReal = 0; this.nAll = 0;
    const r = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE); this.maxPt = r ? r[1] : 64;
    this.maxDim = Math.min(gl.getParameter(gl.MAX_TEXTURE_SIZE), gl.getParameter(gl.MAX_RENDERBUFFER_SIZE), (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [16384])[0]);
    this.fmt = this.detectHDR();
    this.tLo = null; this.tAcc = null; this.loKey = ''; this.accKey = ''; this.accK = 0;
  }
  get label() {
    let name = '';
    try { const ext = this.gl.getExtension('WEBGL_debug_renderer_info'); name = String(this.gl.getParameter(ext ? ext.UNMASKED_RENDERER_WEBGL : this.gl.RENDERER) || ''); } catch (e) { }
    const m = name.match(/ANGLE \(([^,]*),\s*([^,(]*)/); if (m) name = m[2];
    name = name.replace(/\(.*?\)/g, '').replace(/NVIDIA|GeForce|AMD|Radeon\s*\(TM\)|Intel\s*\(R\)|Direct3D.*|OpenGL.*|vs_\d.*|Mesa.*/gi, '').replace(/\s+/g, ' ').trim();
    return `${this.v2 ? 'WebGL2' : 'WebGL'}${this.hdr ? ' · HDR' : ''}${name ? ' · ' + name : ''}`;
  }
  detectHDR() {
    const gl = this.gl; let cand = null;
    if (this.v2) { if (gl.getExtension('EXT_color_buffer_float')) cand = { ifmt: gl.RGBA16F, fmt: gl.RGBA, type: gl.HALF_FLOAT }; }
    else { const h = gl.getExtension('OES_texture_half_float'), hl = gl.getExtension('OES_texture_half_float_linear'), cb = gl.getExtension('EXT_color_buffer_half_float'); if (h && hl && cb) cand = { ifmt: gl.RGBA, fmt: gl.RGBA, type: h.HALF_FLOAT_OES }; }
    if (cand) { const t = this.makeTarget(4, 4, cand); const ok = t.ok; this.freeTarget(t); if (ok) { this.hdr = true; return cand; } }
    this.hdr = false; return { ifmt: gl.RGBA, fmt: gl.RGBA, type: gl.UNSIGNED_BYTE };
  }
  makeTarget(w, h, fmt) {
    const gl = this.gl; fmt = fmt || this.fmt;
    const tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tex); gl.texImage2D(gl.TEXTURE_2D, 0, fmt.ifmt, w, h, 0, fmt.fmt, fmt.type, null); this.texParams(gl.CLAMP_TO_EDGE);
    const fb = gl.createFramebuffer(); gl.bindFramebuffer(gl.FRAMEBUFFER, fb); gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE; gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return { tex, fb, w, h, ok };
  }
  freeTarget(t) { this.gl.deleteTexture(t.tex); this.gl.deleteFramebuffer(t.fb); }
  ensure(name, w, h) {
    let t = this[name]; if (t && t.w === w && t.h === h) return t;
    if (t) this.freeTarget(t);
    t = this.makeTarget(w, h);
    if (!t.ok) { this.freeTarget(t); const gl = this.gl; this.fmt = { ifmt: gl.RGBA, fmt: gl.RGBA, type: gl.UNSIGNED_BYTE }; this.hdr = false; t = this.makeTarget(w, h); }
    this[name] = t; if (name === 'tLo') this.loKey = ''; else { this.accKey = ''; this.accK = 0; }
    return t;
  }
  release() { for (const n of ['tLo', 'tAcc']) if (this[n]) { this.freeTarget(this[n]); this[n] = null; } this.loKey = this.accKey = ''; this.accK = 0; }
  prog(vs, fs) {
    const gl = this.gl, p = gl.createProgram();
    for (const [t, s] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) { const sh = gl.createShader(t); gl.shaderSource(sh, s); gl.compileShader(sh); if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(sh)); gl.attachShader(p, sh); }
    gl.bindAttribLocation(p, 0, 'aPos'); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, inf.name); }
    return { p, u, aInfo: gl.getAttribLocation(p, 'aInfo'), aUv: gl.getAttribLocation(p, 'aUv') };
  }
  texParams(wrapS) { const gl = this.gl; gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, wrapS); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
  setMW(img) { const gl = this.gl; gl.bindTexture(gl.TEXTURE_2D, this.mw); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, gl.LUMINANCE, gl.UNSIGNED_BYTE, img); this.texParams(gl.REPEAT); this.loKey = this.accKey = ''; }
  setStars(arr, nReal) { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuf); gl.bufferData(gl.ARRAY_BUFFER, arr, gl.STATIC_DRAW); this.nAll = arr.length / 6; this.nReal = nReal; }
  // illustrations: one shared mesh buffer, one texture per figure (mipmapped)
  setArt(list) {
    const gl = this.gl; let nv = 0, ni = 0; for (const A of list) { nv += A.mesh.length / 5; ni += A.idx.length; }
    const vb = new Float32Array(nv * 5), ib = new Uint16Array(ni); let ov = 0, oi = 0; this.arts = [];
    for (const A of list) {
      vb.set(A.mesh, ov * 5); for (let k = 0; k < A.idx.length; k++) ib[oi + k] = A.idx[k] + ov;
      this.arts.push({ first: oi * 2, count: A.idx.length, tex: null }); ov += A.mesh.length / 5; oi += A.idx.length;
    }
    this.artVB = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.artVB); gl.bufferData(gl.ARRAY_BUFFER, vb, gl.STATIC_DRAW);
    this.artIB = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.artIB); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ib, gl.STATIC_DRAW);
  }
  setArtImage(k, A) { // A: { w, h, data } – drawing and coverage mask, 2 bytes per pixel
    const gl = this.gl, t = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, t);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE_ALPHA, A.w, A.h, 0, gl.LUMINANCE_ALPHA, gl.UNSIGNED_BYTE, A.data);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4); gl.generateMipmap(gl.TEXTURE_2D);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    if (this.aniso) gl.texParameterf(gl.TEXTURE_2D, this.aniso.TEXTURE_MAX_ANISOTROPY_EXT, 4);
    if (this.arts[k]) this.arts[k].tex = t;
  }
  drawArt(R) {
    const gl = this.gl; if (!R.art || !R.art.length || !this.artVB) return;
    const S = this.pArt; gl.useProgram(S.p); const u = S.u, Wd = this.c.width, Hd = this.c.height;
    gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
    gl.uniform2f(u.uRes, Wd, Hd); gl.uniform1f(u.uScale, R.scalePx); gl.uniform1f(u.uProj, R.proj); gl.uniform1f(u.uRefr, R.refr ? 1 : 0);
    upMat(gl, u.uEqToLoc, R.eqToLoc); upMat(gl, u.uEqToHor, R.eqToHor); upMat(gl, u.uHorToLoc, R.horToLoc);
    gl.uniform1f(u.uObs, R.obs ? 1 : 0); gl.uniform1f(u.uGroundOn, R.groundOn ? 1 : 0); gl.uniform1f(u.uTime, R.time); gl.uniform3fv(u.uTint, R.artTint); gl.uniform1f(u.uInk, R.artInk);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.artVB); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, this.artIB);
    gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 20, 0);
    gl.enableVertexAttribArray(S.aUv); gl.vertexAttribPointer(S.aUv, 2, gl.FLOAT, false, 20, 12);
    gl.activeTexture(gl.TEXTURE2); gl.uniform1i(u.uTex, 2);
    for (const [k, alpha, hi] of R.art) {
      const A = this.arts[k]; if (!A || !A.tex) continue;
      gl.bindTexture(gl.TEXTURE_2D, A.tex); gl.uniform1f(u.uAlpha, alpha * R.starVis); gl.uniform1f(u.uHi, hi);
      gl.drawElements(gl.TRIANGLES, A.count, gl.UNSIGNED_SHORT, A.first);
    }
    gl.disableVertexAttribArray(S.aUv); gl.disable(gl.BLEND);
  }
  drawQuad() { const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, this.quad); gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0); gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); }
  drawSky(t, R, jx, jy, alpha) {
    const gl = this.gl, c = R.lk.c, p = R.lk.p, Wd = this.c.width;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fb); gl.viewport(0, 0, t.w, t.h);
    if (alpha < 1) { gl.enable(gl.BLEND); gl.blendColor(0, 0, 0, alpha); gl.blendFunc(gl.CONSTANT_ALPHA, gl.ONE_MINUS_CONSTANT_ALPHA); } else gl.disable(gl.BLEND);
    const S = this.pSky; gl.useProgram(S.p); const u = S.u;
    gl.uniform2f(u.uRes, t.w, t.h); gl.uniform1f(u.uScale, R.scalePx * t.w / Wd); gl.uniform1f(u.uProj, R.proj); gl.uniform2f(u.uJitter, jx, jy);
    upMat(gl, u.uLocToEq, R.locToEq); upMat(gl, u.uGal, GAL); upMat(gl, u.uLocToHor, R.locToHor); upMat(gl, u.uHorToEq, R.horToEq); gl.uniform1f(u.uRefr, R.refr ? 1 : 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.mw); gl.uniform1i(u.uMW, 0);
    gl.uniform3fv(u.uBg0, c.bg0); gl.uniform3fv(u.uBg1, c.bg1); gl.uniform3fv(u.uMwLo, c.mwLo); gl.uniform3fv(u.uMwHi, c.mwHi); gl.uniform3fv(u.uNeb, c.neb);
    gl.uniform1f(u.uMwAmt, R.mwOn ? p.mw * R.mwMul : 0); gl.uniform1f(u.uNebAmt, R.mwOn ? p.neb * R.mwMul : 0); gl.uniform1f(u.uDust, p.dust); gl.uniform1f(u.uVig, R.vignette);
    this.drawQuad(); gl.disable(gl.BLEND);
  }
  // returns the number of accumulated full-resolution samples (0 while moving)
  render(R) {
    const gl = this.gl, Wd = this.c.width, Hd = this.c.height; const c = R.lk.c, p = R.lk.p;
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, null);
    let src;
    if (R.refine) {
      src = this.ensure('tAcc', Wd, Hd);
      if (R.skyKey !== this.accKey) { this.accKey = R.skyKey; this.accK = 0; }
      for (let s = 0; s < (R.samplesPerFrame || 1) && this.accK < R.aa; s++) {
        const k = this.accK; const jx = k ? halton(k, 2) - 0.5 : 0, jy = k ? halton(k, 3) - 0.5 : 0;
        this.drawSky(src, R, jx, jy, 1 / (k + 1)); this.accK++;
      }
    } else {
      src = this.ensure('tLo', Math.max(2, Math.round(Wd * R.loScale)), Math.max(2, Math.round(Hd * R.loScale)));
      if (R.skyKey !== this.loKey) { this.drawSky(src, R, 0, 0, 1); this.loKey = R.skyKey; }
      this.accK = 0; this.accKey = '';
    }
    gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, Wd, Hd);
    const C = this.pComp; gl.useProgram(C.p); let u = C.u;
    gl.uniform2f(u.uRes, Wd, Hd); gl.uniform1f(u.uScale, R.scalePx); gl.uniform1f(u.uProj, R.proj);
    gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, src.tex); gl.uniform1i(u.uSky, 1);
    gl.uniform1f(u.uObs, R.obs ? 1 : 0); gl.uniform1f(u.uGroundOn, R.groundOn ? 1 : 0); gl.uniform1f(u.uDay, R.day); gl.uniform1f(u.uTwi, R.twi);
    gl.uniform1f(u.uGlowAmt, R.airglow); gl.uniform1f(u.uGrain, R.grain); gl.uniform1f(u.uTime, R.time);
    upMat(gl, u.uLocToHor, R.locToHor); gl.uniform3fv(u.uSunHor, R.sunHor);
    gl.uniform3fv(u.uGround, c.ground); gl.uniform3fv(u.uGlow, c.glow); gl.uniform3fv(u.uDayZen, R.dayZen); gl.uniform3fv(u.uDayHor, R.dayHor); gl.uniform3fv(u.uTwiCol, R.twiCol); gl.uniform3fv(u.uEdge, R.edge);
    this.drawQuad();
    this.drawArt(R);
    if (R.stars && this.nAll) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
      const S = this.pStar; gl.useProgram(S.p); u = S.u;
      gl.uniform2f(u.uRes, Wd, Hd); gl.uniform1f(u.uScale, R.scalePx); gl.uniform1f(u.uProj, R.proj);
      upMat(gl, u.uEqToLoc, R.eqToLoc); upMat(gl, u.uEqToHor, R.eqToHor); upMat(gl, u.uHorToLoc, R.horToLoc); gl.uniform1f(u.uRefr, R.refr ? 1 : 0);
      gl.uniform1f(u.uMagLim, R.magLim); gl.uniform1f(u.uSize, R.size); gl.uniform1f(u.uSizeExp, R.sizeExp); gl.uniform1f(u.uBright, R.bright);
      gl.uniform1f(u.uGlow, p.glow); gl.uniform1f(u.uSpike, p.spikes); gl.uniform1f(u.uSat, p.sat); gl.uniform1f(u.uTwinkle, R.twinkle); gl.uniform1f(u.uTime, R.time);
      gl.uniform1f(u.uPR, R.pr); gl.uniform1f(u.uObs, R.obs ? 1 : 0); gl.uniform1f(u.uGroundOn, R.groundOn ? 1 : 0); gl.uniform1f(u.uStarVis, R.starVis); gl.uniform1f(u.uSpectral, R.spectral); gl.uniform1f(u.uMaxPt, this.maxPt);
      gl.uniform3fv(u.uHot, c.hot); gl.uniform3fv(u.uMid, c.mid); gl.uniform3fv(u.uCool, c.cool);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.starBuf);
      gl.enableVertexAttribArray(0); gl.vertexAttribPointer(0, 3, gl.FLOAT, false, 24, 0);
      gl.enableVertexAttribArray(S.aInfo); gl.vertexAttribPointer(S.aInfo, 3, gl.FLOAT, false, 24, 12);
      gl.drawArrays(gl.POINTS, 0, R.faint ? this.nAll : this.nReal);
      gl.disableVertexAttribArray(S.aInfo); gl.disable(gl.BLEND);
    }
    return this.accK;
  }
}
// star vertex data
const realStars = new Float32Array(NS * 6);
{ const rnd = mulberry32(7); for (let i = 0; i < NS; i++) { realStars.set([STAR.v[i * 3], STAR.v[i * 3 + 1], STAR.v[i * 3 + 2], STAR.mag[i], STAR.bv[i], rnd()], i * 6); } }
let allStars = realStars;
function genFaint(img) {
  const cv = document.createElement('canvas'); cv.width = 512; cv.height = 256; const c2 = cv.getContext('2d', { willReadFrequently: true }); c2.drawImage(img, 0, 0, 512, 256);
  let d; try { d = c2.getImageData(0, 0, 512, 256).data; } catch (e) { return realStars; }
  const rnd = mulberry32(20261022), out = [];
  // decorative background stars start where the real catalogue ends (8 mag)
  const k = 0.42 * Math.LN10, a = 8.0, b = 10.5, span = Math.exp(k * (b - a)) - 1;
  let n = 0, guard = 0;
  while (n < 120000 && guard < 1500000) {
    guard++;
    const z = rnd() * 2 - 1, ph = rnd() * TAU, r = Math.sqrt(1 - z * z);
    const px = Math.min(511, (ph / TAU * 512) | 0), py = Math.min(255, ((Math.asin(z) / Math.PI + 0.5) * 256) | 0);
    const m = d[(py * 512 + px) * 4] / 255;
    if (rnd() > 0.14 + 0.86 * Math.pow(m, 0.7)) continue;
    const ve = mtv(GAL, [r * Math.cos(ph), r * Math.sin(ph), z]);
    const mag = a + Math.log(1 + rnd() * span) / k;
    const bv = 0.62 + (rnd() + rnd() + rnd() - 1.5) * 0.55;
    out.push(ve[0], ve[1], ve[2], mag, bv, rnd()); n++;
  }
  const arr = new Float32Array(realStars.length + out.length); arr.set(realStars); arr.set(out, realStars.length); return arr;
}

// ---------------------------------------------------------------- constellation illustrations
/* Each drawing is pinned to three stars (as in Stellarium): B maps image coordinates (u, v, 1) to
   a vector on the celestial sphere, B = S · P⁻¹, where S holds the anchor stars and P their image positions.
   A 12×12 mesh follows the projection's curvature. */
function inv3(m) {
  const [a, b, c, d, e, f, g, h, i] = m, A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g, det = a * A + b * B + c * C;
  return [A / det, -(b * i - c * h) / det, (b * f - c * e) / det, B / det, (a * i - c * g) / det, -(a * f - c * d) / det, C / det, -(a * h - b * g) / det, (a * e - b * d) / det];
}
const nrm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
const ART = (typeof ARTDATA !== 'undefined' ? ARTDATA : []).map(A => {
  const S = A.a.map(a => vec(a[2], a[3]));
  const B = mm([S[0][0], S[1][0], S[2][0], S[0][1], S[1][1], S[2][1], S[0][2], S[1][2], S[2][2]], inv3([A.a[0][0], A.a[1][0], A.a[2][0], A.a[0][1], A.a[1][1], A.a[2][1], 1, 1, 1]));
  const N = 12, mesh = [], idx = [];
  for (let j = 0; j <= N; j++) for (let i = 0; i <= N; i++) { const w = nrm(mv(B, [i / N, j / N, 1])); mesh.push(w[0], w[1], w[2], i / N, j / N); }
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const k = j * (N + 1) + i; idx.push(k, k + 1, k + N + 1, k + 1, k + N + 2, k + N + 1); }
  const cv = nrm(mv(B, [0.5, 0.5, 1])); let r = 0; for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) r = Math.max(r, angDist(cv, nrm(mv(B, [u, v, 1]))));
  return { c: A.c, img: A.img, mask: A.mask, B, mesh: new Float32Array(mesh), idx, cv, r, cur: 0, hi: 0 };
});
// figures shared by several constellations: Argo Navis (Carina, Puppis, Vela), Serpens held by Ophiuchus
const ART_ALIAS = { Pup: 'Car', Vel: 'Car', Ser: 'Oph' };
const artOfCon = ci => ci < 0 ? -1 : ART.findIndex(a => a.c === (ART_ALIAS[CONS[ci].id] || CONS[ci].id));
const artImgs = [];   // decoded textures { w, h, data }
function loadArt(target) { // target: SkyGL
  target.setArt(ART);
  ART.forEach((A, k) => { if (artImgs[k]) target.setArtImage(k, artImgs[k]); });
}
/* joins the drawing and its (smaller) coverage mask into one luminance–alpha texture */
function artTexture(img, mask) {
  const w = img.naturalWidth, h = img.naturalHeight, cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const x = cv.getContext('2d', { willReadFrequently: true });
  x.drawImage(img, 0, 0); const L = x.getImageData(0, 0, w, h).data;
  x.clearRect(0, 0, w, h); x.imageSmoothingQuality = 'high'; x.drawImage(mask, 0, 0, w, h); const M = x.getImageData(0, 0, w, h).data;
  const data = new Uint8Array(w * h * 2); for (let i = 0; i < w * h; i++) { data[i * 2] = L[i * 4]; data[i * 2 + 1] = M[i * 4]; }
  return { w, h, data };
}
// ---------------------------------------------------------------- render parameters
// in the observer view the Moon gets topocentric parallax
const calcBodies = () => computeBodies(jdOf(st.time), st.mode === 'hor' ? st.loc : null);
let bodies = calcBodies(), bodiesT = st.time;
const bodyById = id => bodies.find(b => b.id === id);
function sunInfo() {
  const s = bodyById('sun'); if (st.mode !== 'hor') return { alt: -90, hor: [0, 0, -1] };
  const h = mv(frameF(), s.v); return { alt: Math.asin(clamp(h[2], -1, 1)) * R2D, hor: h };
}
function buildR(view, lk, o) {
  const F = view.F, Vt = tr(view.V);
  const obs = st.mode === 'hor';
  const si = sunInfo();
  const atm = obs && layers.atmosphere;
  const day = atm ? smooth(-4, 12, si.alt) : 0;
  const twi = atm ? smooth(-18, -5, si.alt) * (1 - smooth(2, 14, si.alt)) : 0;
  const c = lk.c;
  const dayZen = mix3(mix3(c.bg0, [0.20, 0.30, 0.46], 0.75), c.mwHi, 0.08), dayHor = mix3(dayZen, [0.55, 0.62, 0.70], 0.55);
  const twiCol = mix3(mix3(c.accent, [0.78, 0.45, 0.28], 0.55), c.bg0, 0.35).map(x => x * 0.55);
  const fovEff = view.fov; const ex = o.exposure || 1;
  const R = {
    lk, proj: view.proj, scalePx: view.scale * o.pr, loScale: o.loScale || 0.5, pr: o.starPr, mwMul: Math.pow(ex, 0.8),
    locToEq: Vt, locToHor: obs ? tr(view.VF) : I3, horToEq: tr(F), horToLoc: view.VF, refr: !!view.refr, eqToLoc: view.V, eqToHor: F,
    art: o.art || null, artInk: style.artInk, artTint: mix3(mix3(c.label, c.mwHi, 0.45), [1, 1, 1], 0.1),
    obs, groundOn: obs && layers.ground, day, twi, sunHor: si.hor, dayZen, dayHor, twiCol, edge: c.bg1.map(x => x * 0.4),
    airglow: style.airglow, grain: style.grain, vignette: style.vignette, time: o.time, mwOn: layers.mw,
    stars: layers.stars, faint: layers.faint, magLim: magLimit(fovEff), size: style.size * zoomSize(fovEff) * (o.sizeMul || 1), sizeExp: SIZEEXP[style.sizeMode] || 0.27,
    bright: style.bright * ex, twinkle: settings.reduce ? 0 : style.twinkle, starVis: Math.max(0.02, 1 - 0.97 * day - 0.45 * twi), spectral: style.spectral
  };
  R.skyKey = [view.V.map(x => x.toFixed(6)).join(','), view.scale.toFixed(3), view.proj, o.pr, ex.toFixed(3), view.W, view.H, view.refr ? 'r' : '', ...CKEYS.map(([k]) => c[k].map(x => x.toFixed(3)).join(',')), PKEYS.map(k => lk.p[k].toFixed(3)).join(','), style.vignette, layers.mw].join('|');
  return R;
}

