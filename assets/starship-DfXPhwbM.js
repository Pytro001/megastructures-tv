import{a as e}from"./tv-DT7ePuF8.js";import{i as t}from"./remote-overlay-DttutIvP.js";import{A as n,At as r,B as i,C as a,Ct as o,D as s,Dt as c,E as l,Et as u,F as d,G as f,I as p,J as m,K as h,L as g,M as _,Ot as v,P as y,R as b,S as x,St as S,T as C,V as w,W as T,X as E,Y as D,Z as O,a as ee,at as te,b as ne,bt as re,dt as ie,et as ae,g as oe,ht as se,i as ce,it as le,j as ue,k as de,kt as fe,mt as pe,n as me,nt as he,o as ge,ot as _e,pt as ve,q as ye,r as be,rt as xe,s as Se,st as Ce,t as we,tt as Te,u as Ee,ut as De,v as Oe,vt as ke,w as Ae,yt as je}from"./sim-shell-99_Ayh-q.js";function Me(e=1){let t=e>>>0;return()=>{t=t+1831565813>>>0;let e=t;return e=Math.imul(e^e>>>15,e|1),e^=e+Math.imul(e^e>>>7,e|61),((e^e>>>14)>>>0)/4294967296}}function Ne(e=64){let t=Me(7),n=e=>{let n=new Float32Array(e*e*e);for(let e=0;e<n.length;e++)n[e]=t();return n},r=[{p:8,w:.5,l:n(8)},{p:16,w:.25,l:n(16)},{p:32,w:.15,l:n(32)},{p:64,w:.1,l:n(64)}],i=new Uint8Array(e*e*e),a=e=>e*e*(3-2*e);for(let t=0;t<e;t++)for(let n=0;n<e;n++)for(let o=0;o<e;o++){let s=0;for(let i of r){let r=i.p/e,c=o*r,l=n*r,u=t*r,d=Math.floor(c),f=Math.floor(l),p=Math.floor(u),m=a(c-d),h=a(l-f),g=a(u-p),_=i.p,v=(e,t,n)=>i.l[e%_+t%_*_+n%_*_*_],y=d,b=d+1,x=f,S=f+1,C=p,w=p+1,T=v(y,x,C)*(1-m)+v(b,x,C)*m,E=v(y,S,C)*(1-m)+v(b,S,C)*m,D=v(y,x,w)*(1-m)+v(b,x,w)*m,O=v(y,S,w)*(1-m)+v(b,S,w)*m,ee=T*(1-h)+E*h,te=D*(1-h)+O*h;s+=(ee*(1-g)+te*g)*i.w}i[o+n*e+t*e*e]=Math.max(0,Math.min(255,Math.round(s*255)))}let o=new ue(i,e,e,e);return o.format=pe,o.type=u,o.minFilter=ye,o.magFilter=ye,o.wrapS=o.wrapT=o.wrapR=se,o.unpackAlignment=1,o.needsUpdate=!0,o}var Pe={value:null},Fe=`
uniform highp sampler3D uNoise3D;
float n3(vec3 p) { return texture(uNoise3D, p).r; }
float fbm2(vec3 p) { return n3(p) * 0.65 + n3(p * 2.7 + 0.31) * 0.35; }
float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * .1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float ign(vec2 px) { return fract(52.9829189 * fract(dot(px, vec2(0.06711056, 0.00583715)))); }
`,Ie=class{collect(e){e.traverse(e=>{let t=e;!t.isMesh||Array.isArray(t.material)||t.userData.fluid||this.materials.has(t.material)&&t.material.type!==`ShaderMaterial`&&this.meshes.add(t)});let t=this.capsOn;this.capsOn=!t,this.setCaps(t)}setCaps(e){if(e!==this.capsOn){this.capsOn=e;for(let t of this.materials){if(t.type!==`ShaderMaterial`)continue;let n=t;e?n.defines.CAPS=1:delete n.defines.CAPS,t.userData.caps=e,t.needsUpdate=!0}for(let n of this.meshes){let r=n.userData.front??n.material;n.userData.front=r;let i=n.geometry;if(e){var t;let e=r.userData.makeBack;if(!e)continue;(t=r.userData).back??(t.back=e());let a=i.index?i.index.count:i.attributes.position.count;i.clearGroups(),i.addGroup(0,a,0),i.addGroup(0,a,1),n.material=[r,r.userData.back]}else i.clearGroups(),n.material=r}}}constructor(e,n,r=0,i=0){t(this,`owner`,void 0),t(this,`extent`,void 0),t(this,`depth`,void 0),t(this,`local`,new te(new v(0,0,-1),10)),t(this,`world`,new te(new v(0,0,-1),10)),t(this,`local2`,new te(new v(0,0,-1),10)),t(this,`world2`,new te(new v(0,0,-1),10)),t(this,`planes`,[this.world]),t(this,`uPlane`,{value:new fe(0,0,-1,10)}),t(this,`uPlane2`,{value:new fe(0,0,0,-1)}),t(this,`wedge`,0),t(this,`uGlow`,{value:0}),t(this,`amount`,0),t(this,`materials`,new Set),t(this,`meshes`,new Set),t(this,`capsOn`,!0),this.owner=e,this.extent=n,this.depth=r,this.wedge=i,i>0&&this.planes.push(this.world2)}get intersect(){return this.wedge>0}update(){let e=this.amount;this.setCaps(e>5e-4);let t=e<=0?1e4:this.depth+(this.extent-this.depth)*(1-e);if(this.owner.updateWorldMatrix(!0,!1),this.wedge>0){let e=Math.cos(this.wedge),n=Math.sin(this.wedge);this.local.normal.set(e,0,-n),this.local2.normal.set(-e,0,-n),this.local.constant=t,this.local2.constant=t,this.world2.copy(this.local2).applyMatrix4(this.owner.matrixWorld),this.uPlane2.value.set(this.world2.normal.x,this.world2.normal.y,this.world2.normal.z,this.world2.constant)}else this.local.normal.set(0,0,-1);this.wedge<=0&&(this.local.constant=t),this.world.copy(this.local).applyMatrix4(this.owner.matrixWorld),this.uPlane.value.set(this.world.normal.x,this.world.normal.y,this.world.normal.z,this.world.constant),this.uGlow.value=e>.002&&e<.998?Math.sin(Math.PI*e):0}},Le={value:new E},Re={uPlane:{value:new fe(0,0,-1,1e4)},uPlane2:{value:new fe(0,0,0,-1)},uGlow:{value:0}},ze=`
uniform vec4 uCutPlane;
uniform vec4 uCutPlane2;
varying vec3 vObj;
varying vec3 vCutObjCam;
varying vec4 vCutPlaneObj;
varying vec4 vCutPlane2Obj;
`,Be=`
{
  vec4 cutP = vec4(transformed, 1.0);
  #ifdef USE_BATCHING
    cutP = batchingMatrix * cutP;
  #endif
  #ifdef USE_INSTANCING
    cutP = instanceMatrix * cutP;
  #endif
  vObj = cutP.xyz;
  vCutObjCam = (inverse(modelMatrix) * vec4(cameraPosition, 1.0)).xyz;
  vCutPlaneObj = uCutPlane * modelMatrix;
  vCutPlane2Obj = uCutPlane2 * modelMatrix;
}
`,Ve=`
uniform vec4 uCutPlane;
uniform vec4 uCutPlane2;
uniform mat4 uCutProj;
uniform float uCutGlow;
varying vec3 vObj;
varying vec3 vCutObjCam;
varying vec4 vCutPlaneObj;
varying vec4 vCutPlane2Obj;
// the removed region is where both planes are negative; clip a ray to it
void cutClip(vec4 P, vec3 ro, vec3 rd, inout float t0, inout float t1, inout int exitId, int id) {
  float dn = dot(P.xyz, rd);
  float d0 = dot(P.xyz, ro) + P.w;
  if (abs(dn) < 1e-9) { if (d0 >= 0.0) { t0 = 1.0; t1 = 0.0; } return; }
  float th = -d0 / dn;
  if (dn > 0.0) { if (th < t1) { t1 = th; exitId = id; } }
  else t0 = max(t0, th);
}
bool cutRemoved(vec3 p) {
  return dot(vCutPlaneObj.xyz, p) + vCutPlaneObj.w < 0.0 && dot(vCutPlane2Obj.xyz, p) + vCutPlane2Obj.w < 0.0;
}
`,He=`
bool cutCap = false;
vec3 cutHit = vObj;
vec3 cutNW = uCutPlane.xyz;
#ifdef CAPS
{
  #ifdef FLIP_SIDED
    bool cutBack = gl_FrontFacing;
  #else
    bool cutBack = !gl_FrontFacing;
  #endif
  if (cutBack) {
    vec3 ro = vCutObjCam;
    vec3 toF = vObj - ro;
    float tf = length(toF);
    vec3 rd = toF / max(tf, 1e-6);
    float t0 = 0.0, t1 = 1e9;
    int exitId = -1;
    cutClip(vCutPlaneObj, ro, rd, t0, t1, exitId, 0);
    cutClip(vCutPlane2Obj, ro, rd, t0, t1, exitId, 1);
    if (exitId >= 0 && t0 < t1 && t1 > 0.0 && t1 < tf) {
      cutCap = true;
      cutHit = ro + rd * t1;
      if (exitId == 1) cutNW = uCutPlane2.xyz;
    }
  }
}
#endif
`,Ue={lox:{color:new l(4638975),emph:{value:1}},ch4:{color:new l(16753210),emph:{value:1}},oxgas:{color:new l(10189823),emph:{value:1}},fuelgas:{color:new l(16734762),emph:{value:1}},fire:{color:new l(16767400),emph:{value:1}}},We={value:0},Ge={value:1},Ke={value:1},qe=`
#include <common>
${ze}
attribute float aS;
varying float vS;
varying vec3 vViewPosition;
#include <clipping_planes_pars_vertex>
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = -mvPosition.xyz;
  vS = aS;
  ${Be}
}
`,Je=`
#include <common>
${Ve}
${Fe}
#include <clipping_planes_pars_fragment>
varying float vS;
varying vec3 vViewPosition;
uniform vec3 uColor;
uniform float uEmph;
uniform float uTime;
uniform float uRate;
uniform float uOn;
uniform float uScale;
uniform float uSpeed;
uniform float uIntensity;
uniform int uMode;
uniform float uGas;
uniform sampler2D uField;
uniform vec2 uFieldRange;

vec3 fireRamp(float T) {
  // cool exhaust (deep violet blue) to white hot chamber gas
  vec3 c0 = vec3(0.16, 0.16, 0.95);
  vec3 c1 = vec3(0.52, 0.22, 1.0);
  vec3 c2 = vec3(1.0, 0.36, 0.42);
  vec3 c3 = vec3(1.0, 0.62, 0.24);
  vec3 c4 = vec3(1.0, 0.93, 0.78);
  if (T < 0.3) return mix(c0, c1, T / 0.3);
  if (T < 0.56) return mix(c1, c2, (T - 0.3) / 0.26);
  if (T < 0.76) return mix(c2, c3, (T - 0.56) / 0.2);
  return mix(c3, c4, (T - 0.76) / 0.24);
}

void main() {
  vec4 diffuseColor = vec4(1.0);
  #include <clipping_planes_fragment>
  ${He}
  if (!gl_FrontFacing && !cutCap) discard;
  #ifndef CAPS
  if (uMode != 3) discard;
  #endif
  vec3 P = cutCap ? cutHit : vObj;
  float t = uTime;
  float thick = cutCap ? length(vObj - cutHit) : 0.0;
  vec3 col = uColor;
  float I = 1.0;

  if (uMode == 3) {
    // Combustion field inside chamber and nozzle.
    float fy = clamp((P.y - uFieldRange.x) / (uFieldRange.y - uFieldRange.x), 0.0, 1.0);
    vec4 fd = texture2D(uField, vec2(fy, 0.5));
    float tof = fd.r, spd = fd.g, T = fd.b, R = max(fd.a, 1e-3);
    float r = length(P.xz) / R;
    float streak = n3(vec3(tof * 1.3 - t * 1.6 * uRate, r * 3.0, P.x * 0.9 + P.z * 0.9));
    float fine = n3(vec3(tof * 4.0 - t * 4.0 * uRate, r * 9.0, 0.37));
    float temp = T * (0.88 + 0.12 * (1.0 - r * r)) + (streak - 0.5) * 0.12;
    col = fireRamp(clamp(temp, 0.0, 1.0));
    float dens = mix(0.55, 1.0, T) * (0.75 + 0.5 * streak) * (0.85 + 0.3 * fine);
    // near the injector face the gas is still mixing: show the jets
    float jets = smoothstep(0.08, 0.0, uFieldRange.y - P.y) * (0.5 + 0.5 * sin(r * 40.0));
    dens += jets * 0.6;
    // sonic line at the throat
    float sonic = exp(-pow((spd - 1.0) * 14.0, 2.0)) * 1.4;
    col += vec3(0.8, 0.9, 1.0) * sonic * 0.6;
    I = dens * (cutCap ? (0.2 + min(thick, 0.6) * 2.6) : 1.2) * mix(0.45, 1.0, T);
  } else {
    float s;
    if (uMode == 0) s = vS;
    else if (uMode == 1) s = P.y;
    else if (uMode == 2) s = -P.y;
    else s = atan(P.z, P.x) * 0.3 + P.y;
    float ph = s / uScale - t * uSpeed * uRate;
    float bands = 0.62 + 0.38 * smoothstep(0.15, 0.85, abs(fract(ph) * 2.0 - 1.0));
    float streak = n3(vec3(ph * 0.35, P.x * 2.3 + P.z * 2.3, P.y * 0.8));
    float fine = n3(vec3(ph * 1.7, P.x * 7.0, P.z * 7.0 + P.y * 3.0));
    I = bands * (0.7 + 0.6 * streak) * (0.85 + 0.3 * fine);
    if (uGas > 0.5) I *= cutCap ? (0.35 + thick * 5.0) : 0.6;
  }
  I *= uIntensity * uEmph * uOn;
  vec3 outc = col * I;
  if (uGas > 0.5) {
    gl_FragColor = vec4(outc, 1.0);
  } else {
    // liquids are opaque: a dim base so they read as a body of liquid when dimmed
    gl_FragColor = vec4(outc + col * 0.05, 0.0);
  }
}
`;function Ye(e,t){let n=Ue[t.kind],r=t.gas??(t.kind===`oxgas`||t.kind===`fuelgas`||t.kind===`fire`),i=new je({vertexShader:qe,fragmentShader:Je,uniforms:{uCutPlane:e.uPlane,uCutPlane2:e.uPlane2,uCutGlow:e.uGlow,uCutProj:Le,uNoise3D:Pe,uColor:{value:n.color},uEmph:t.emph??n.emph,uTime:We,uRate:t.rate??Ge,uOn:t.on??Ke,uScale:{value:t.scale??.12},uSpeed:{value:t.speed??1.2},uIntensity:{value:t.intensity??1.6},uMode:{value:t.mode},uGas:{value:+!!r},uField:{value:t.field??null},uFieldRange:{value:new c(...t.fieldRange??[0,1])}},side:2,defines:e.capsOn?{CAPS:1}:{},clipping:!0,transparent:r,depthWrite:!r,blending:r?2:1});return i.clippingPlanes=e.planes,i.clipIntersection=e.intersect,i.userData.caps=e.capsOn,e.materials.add(i),i.userData.kind=t.kind,i.userData.gas=r,i}var Xe=`
vec3 surfPerturb(vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDir) {
  vec3 vSigmaX = normalize(dFdx(surf_pos.xyz));
  vec3 vSigmaY = normalize(dFdy(surf_pos.xyz));
  vec3 vN = surf_norm;
  vec3 R1 = cross(vSigmaY, vN);
  vec3 R2 = cross(vN, vSigmaX);
  float fDet = dot(vSigmaX, R1) * faceDir;
  vec3 vGrad = sign(fDet) * (dHdxy.x * R1 + dHdxy.y * R2);
  return normalize(abs(fDet) * surf_norm - vGrad);
}
`;function k(e){let t=(e.clearcoat??0)>0||(e.sheen??0)>0||(e.anisotropy??0)>0,n={color:new l(e.color),metalness:e.metalness??1,roughness:e.roughness??.4,envMapIntensity:e.envMapIntensity??1,transparent:e.transparent??!1,opacity:e.opacity??1,flatShading:e.flatShading??!1,vertexColors:e.vertexColors??!1,map:e.map??null,roughnessMap:e.roughnessMap??null},r=t?new ae({color:new l(e.color),metalness:e.metalness??1,roughness:e.roughness??.4,envMapIntensity:e.envMapIntensity??1,clearcoat:e.clearcoat??0,clearcoatRoughness:e.clearcoatRoughness??.1,anisotropy:e.anisotropy??0,anisotropyRotation:e.anisotropyRotation??0,transparent:e.transparent??!1,opacity:e.opacity??1,flatShading:e.flatShading??!1,vertexColors:e.vertexColors??!1,map:e.map??null,roughnessMap:e.roughnessMap??null,sheen:e.sheen??0,sheenColor:new l(e.sheenColor??16777215)}):new Te(n);e.name&&(r.name=e.name),e.emissive!==void 0&&(r.emissive=new l(e.emissive),r.emissiveIntensity=e.emissiveIntensity??1);let i=e.cut??null,a=!!e.capPass;i?(r.side=+!!a,r.userData.caps=a,r.clippingPlanes=i.planes,r.clipIntersection=i.intersect,r.clipShadows=!0,a||(i.materials.add(r),r.userData.makeBack=()=>k({...e,capPass:!0,name:(e.name??`surf`)+`:caps`}))):e.side!==void 0&&(r.side=e.side);let o=e.detail??0,s={uCutPlane:i?i.uPlane:Re.uPlane,uCutPlane2:i?i.uPlane2:Re.uPlane2,uCutGlow:i?i.uGlow:Re.uGlow,uCutProj:Le,uCapColor:{value:new l(e.capColor??13225169)},uCapRough:{value:e.capRoughness??.42},uCapMetal:{value:e.capMetalness??.35},uDetail:{value:new fe(o,e.roughVar??.35,e.colorVar??.12,e.bump??0)},uLayers:{value:new c(e.layers?.[0]??0,e.layers?.[1]??0)},uRibs:{value:new c(e.ribs?.[0]??0,e.ribs?.[1]??0)},uStreaks:{value:e.streaks??0},uTintA:{value:new l(e.tint?.a??0)},uTintB:{value:new l(e.tint?.b??0)},uTintC:{value:new l(e.tint?.c??0)},uTintRange:{value:new v(e.tint?.y0??0,e.tint?.y1??1,e.tint?.strength??0)},uNoise3D:Pe};r.userData.u=s;let u=[];i&&u.push(`#define SURF_CUT`),o>0&&u.push(`#define SURF_DETAIL`),e.tint&&u.push(`#define SURF_TINT`),(e.streaks??0)>0&&u.push(`#define SURF_STREAKS`),((e.bump??0)>0||(e.layers?.[1]??0)>0||(e.ribs?.[1]??0)>0)&&u.push(`#define SURF_BUMP`);let d=u.join(`
`)+`
`;return r.onBeforeCompile=e=>{Object.assign(e.uniforms,s);let t=a?`#define CAPS
#define CAP_ONLY
`:``;e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>\n${ze}`).replace(`#include <project_vertex>`,`#include <project_vertex>\n${Be}`);let n=e.fragmentShader;n=n.replace(`#include <common>`,`${d}${t}#include <common>
${Ve}
${Fe}
${Xe}
uniform vec3 uCapColor; uniform float uCapRough; uniform float uCapMetal;
uniform vec4 uDetail; uniform vec2 uLayers; uniform vec2 uRibs; uniform float uStreaks;
uniform vec3 uTintA; uniform vec3 uTintB; uniform vec3 uTintC; uniform vec3 uTintRange;
`),n=n.replace(`#include <clipping_planes_fragment>`,`#include <clipping_planes_fragment>
#ifdef SURF_CUT
${He}
#ifdef CAP_ONLY
if (!cutCap) discard;
#endif
#else
bool cutCap = false; vec3 cutHit = vObj; vec3 cutNW = uCutPlane.xyz;
#endif
float surfN1 = 0.5, surfN2 = 0.5, surfH = 0.0;
#ifdef SURF_DETAIL
{
  vec3 dp = vObj * uDetail.x;
  surfN1 = fbm2(dp);
  surfN2 = n3(dp * 3.3 + vec3(7.3, 1.1, 3.7));
  surfH = (surfN1 - 0.5) * uDetail.w;
  #ifdef SURF_STREAKS
    float st = n3(vec3(vObj.x * uDetail.x * 2.2, vObj.y * uDetail.x * 0.18, vObj.z * uDetail.x * 2.2));
    surfN1 = mix(surfN1, st, 0.55);
  #endif
}
#endif
if (uLayers.y > 0.0) surfH += sin(vObj.y * uLayers.x) * uLayers.y;
if (uRibs.y > 0.0) surfH += smoothstep(-0.2, 0.9, sin(atan(vObj.z, vObj.x) * uRibs.x)) * uRibs.y;
`),n=n.replace(`#include <color_fragment>`,`#include <color_fragment>
#ifdef SURF_DETAIL
  diffuseColor.rgb *= 1.0 + (surfN1 - 0.5) * uDetail.z * 2.0;
#endif
#ifdef SURF_TINT
{
  float ty = clamp((vObj.y - uTintRange.x) / (uTintRange.y - uTintRange.x), 0.0, 1.0);
  ty = clamp(ty + (surfN2 - 0.5) * 0.18, 0.0, 1.0);
  vec3 tc = ty < 0.5 ? mix(uTintA, uTintB, ty * 2.0) : mix(uTintB, uTintC, ty * 2.0 - 1.0);
  diffuseColor.rgb = mix(diffuseColor.rgb, tc, uTintRange.z);
}
#endif
#ifdef SURF_STREAKS
  diffuseColor.rgb *= 1.0 - uStreaks * smoothstep(0.45, 0.8, surfN1);
#endif
if (cutCap) diffuseColor.rgb = uCapColor;
`),n=n.replace(`#include <metalnessmap_fragment>`,`#include <metalnessmap_fragment>
#ifdef SURF_DETAIL
  roughnessFactor = clamp(roughnessFactor * (1.0 + (surfN2 - 0.5) * uDetail.y * 2.0), 0.03, 1.0);
#endif
if (cutCap) {
  roughnessFactor = uCapRough + (n3(cutHit * 9.0) - 0.5) * 0.08;
  metalnessFactor = uCapMetal;
}
`),n=n.replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
#ifdef SURF_BUMP
  if (!cutCap) normal = surfPerturb(-vViewPosition, normal, vec2(dFdx(surfH), dFdy(surfH)), faceDirection);
#endif
{
  // specular anti-aliasing: widen the lobe where the normal changes quickly across a pixel
  vec3 dn = fwidth(normal);
  float variance = dot(dn, dn);
  roughnessFactor = sqrt(clamp(roughnessFactor * roughnessFactor + min(variance * 0.6, 0.16), 0.0, 1.0));
}
if (cutCap) {
  normal = normalize((viewMatrix * vec4(-cutNW, 0.0)).xyz);
  nonPerturbedNormal = normal;
}
`),n=n.replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
#if defined(SURF_CUT) && !defined(CAP_ONLY)
if (uCutGlow > 0.0) {
  float cdw = dot(vCutPlaneObj.xyz, vObj) + vCutPlaneObj.w;
  float cdw2 = dot(vCutPlane2Obj.xyz, vObj) + vCutPlane2Obj.w;
  float cde = uCutPlane2.w < 0.0 && dot(uCutPlane2.xyz, uCutPlane2.xyz) < 0.5 ? abs(cdw) : max(cdw, cdw2) < 0.0 ? 1.0 : min(abs(cdw), abs(cdw2));
  totalEmissiveRadiance += vec3(0.45, 0.85, 1.0) * exp(-cde * 900.0) * uCutGlow * 14.0;
}
#endif
`),e.fragmentShader=n},r.customProgramCacheKey=()=>`surf|`+d+(a?`caps`:``),r}function Ze(e){let t=0;for(let n=0;n<e.length;n++){let[r,i]=e[n],[a,o]=e[(n+1)%e.length];t+=r*o-a*i}return t/2}function Qe(e){let t=[];for(let n of e){let e=t[t.length-1];(!e||Math.hypot(e[0]-n[0],e[1]-n[1])>1e-7)&&t.push([Math.max(0,n[0]),n[1]])}for(;t.length>2&&Math.hypot(t[0][0]-t[t.length-1][0],t[0][1]-t[t.length-1][1])<1e-7;)t.pop();return t}function A(e,t=96,n=38){let r=Qe(e);Ze(r)<0&&(r=r.slice().reverse());let i=r.length,a=[],o=[];for(let e=0;e<i;e++){let t=r[e],n=r[(e+1)%i],s=n[0]-t[0],c=n[1]-t[1],l=Math.hypot(s,c)||1;a.push([c/l,-s/l]),o.push(l)}let s=Math.cos(n*Math.PI/180),c=[];for(let e=0;e<i;e++){let t=a[(e-1+i)%i],n=a[e];if(t[0]*n[0]+t[1]*n[1]>s){let e=t[0]+n[0],r=t[1]+n[1],i=Math.hypot(e,r)||1;c.push([e/i,r/i])}else c.push(null)}let l=[],u=[],d=[],f=[],p=0;for(let e=0;e<i;e++){let n=r[e],s=r[(e+1)%i],m=c[e]??a[e],h=c[(e+1)%i]??a[e];if(n[0]<1e-9&&s[0]<1e-9){p+=o[e];continue}let g=l.length/3;for(let r=0;r<=t;r++){let i=r/t*Math.PI*2,a=Math.sin(i),c=Math.cos(i);l.push(n[0]*a,n[1],n[0]*c),u.push(m[0]*a,m[1],m[0]*c),d.push(r/t,p),l.push(s[0]*a,s[1],s[0]*c),u.push(h[0]*a,h[1],h[0]*c),d.push(r/t,p+o[e])}for(let e=0;e<t;e++){let t=g+e*2,n=t+1,r=t+2,i=t+3;f.push(t,r,n,n,r,i)}p+=o[e]}let m=new ne;return m.setAttribute(`position`,new g(l,3)),m.setAttribute(`normal`,new g(u,3)),m.setAttribute(`uv`,new g(d,2)),m.setIndex(f),rt(m),m}function $e(e,t,n,r){let i=[];for(let a=0;a<=r;a++){let o=t+(n-t)*a/r;i.push([e(o),o])}return i}function et(e,t,n,r,i=64){let a=$e(t,n,r,i),o=$e(e,r,n,i);return[...a,...o]}function j(e,t,n,r,i=0){if(i<=0)return[[e,n],[t,n],[t,r],[e,r]];let a=Math.min(i,(t-e)/2,(r-n)/2);return[[e,n+a],[e+a,n],[t-a,n],[t,n+a],[t,r-a],[t-a,r],[e+a,r],[e,r-a]]}function tt(e,t,n,r=24){let i=[];for(let a=0;a<r;a++){let o=a/r*Math.PI*2;i.push([e+Math.cos(o)*n,t+Math.sin(o)*n])}return i}function nt(e,t){let n=t.tubular??64,r=t.radial??24,i=typeof t.r==`function`?t.r:()=>t.r,a=t.ri===void 0?()=>0:typeof t.ri==`function`?t.ri:()=>t.ri,o=e.getLength(),s=(t.up??new v(0,0,1)).clone().normalize(),c=[],l=[],u=[],d=[],f=null;for(let t=0;t<=n;t++){let r=t/n,i=e.getPointAt(r),a=e.getTangentAt(r).normalize(),o=s.clone().sub(a.clone().multiplyScalar(s.dot(a)));o.lengthSq()<1e-6&&(o=f?f.clone().sub(a.clone().multiplyScalar(f.dot(a))):new v(1,0,0)),o.normalize(),f&&o.dot(f)<0&&o.lengthSq();let p=new v().crossVectors(a,o).normalize();c.push(i),l.push(a),u.push(o),d.push(p),f=o}let p=[],m=[],h=[],_=[],y=[],b=new v,x=new v,S=e=>{let t=p.length/3;for(let t=0;t<=n;t++){let s=t/n,l=e?a(s):i(s);for(let n=0;n<=r;n++){let i=n/r*Math.PI*2;x.copy(u[t]).multiplyScalar(Math.cos(i)).addScaledVector(d[t],Math.sin(i)),b.copy(c[t]).addScaledVector(x,l),p.push(b.x,b.y,b.z);let a=e?-1:1;m.push(x.x*a,x.y*a,x.z*a),h.push(n/r,s*o),_.push(s*o)}}for(let i=0;i<n;i++)for(let n=0;n<r;n++){let a=t+i*(r+1)+n,o=a+r+1;e?y.push(a,a+1,o,o,a+1,o+1):y.push(a,o,a+1,o,o+1,a+1)}};S(!1);let C=a(0)>0||a(1)>0;C&&S(!0);for(let e of[0,n]){let t=e/n,s=C?a(t):0,f=i(t),g=l[e].clone().multiplyScalar(e===0?-1:1),v=p.length/3;for(let n=0;n<=r;n++){let i=n/r*Math.PI*2;x.copy(u[e]).multiplyScalar(Math.cos(i)).addScaledVector(d[e],Math.sin(i));for(let i of[s,f])b.copy(c[e]).addScaledVector(x,i),p.push(b.x,b.y,b.z),m.push(g.x,g.y,g.z),h.push(n/r,i),_.push(t*o)}for(let t=0;t<r;t++){let n=v+t*2;e===0?y.push(n,n+1,n+2,n+1,n+3,n+2):y.push(n,n+2,n+1,n+1,n+2,n+3)}}let w=new ne;return w.setAttribute(`position`,new g(p,3)),w.setAttribute(`normal`,new g(m,3)),w.setAttribute(`uv`,new g(h,2)),w.setAttribute(`aS`,new g(_,1)),w.setIndex(y),rt(w),w}function rt(e){let t=e.attributes.position,n=e.attributes.normal,r=e.index,i=r.array,a=new v,o=new v,s=new v,c=new v,l=new v;for(let e=0;e<i.length;e+=3)if(a.fromBufferAttribute(t,i[e]),o.fromBufferAttribute(t,i[e+1]),s.fromBufferAttribute(t,i[e+2]),l.subVectors(o,a).cross(s.clone().sub(a)),!(l.lengthSq()<1e-20)&&(c.fromBufferAttribute(n,i[e]).add(new v().fromBufferAttribute(n,i[e+1])).add(new v().fromBufferAttribute(n,i[e+2])),l.dot(c)<0)){let t=i[e+1];i[e+1]=i[e+2],i[e+2]=t}r.needsUpdate=!0}function it(e,t){let n=e.map(e=>new v(...e)),r=new de,i=n[0].clone();for(let e=1;e<n.length-1;e++){let a=n[e-1],o=n[e],s=n[e+1],c=o.clone().sub(a),l=s.clone().sub(o),u=c.length(),d=l.length();c.normalize(),l.normalize();let f=Math.min(t,u*.45,d*.45),p=o.clone().addScaledVector(c,-f),m=o.clone().addScaledVector(l,f);p.distanceTo(i)>1e-6&&r.add(new h(i.clone(),p)),r.add(new De(p,o.clone(),m)),i=m}return r.add(new h(i,n[n.length-1].clone())),r}function at(e,t=12){let n=[],r=[e[0],...e,e[e.length-1]];for(let e=1;e<r.length-2;e++){let i=r[e-1],a=r[e],o=r[e+1],s=r[e+2];for(let e=0;e<t;e++){let r=e/t,c=r*r,l=c*r,u=(e,t,n,i)=>.5*(2*t+(-e+n)*r+(2*e-5*t+4*n-i)*c+(-e+3*t-3*n+i)*l);n.push([u(i[0],a[0],o[0],s[0]),u(i[1],a[1],o[1],s[1])])}}return n.push(e[e.length-1]),n}function ot(e,t){let n=e[0][0],r=1/0;for(let i=0;i<e.length-1;i++){let a=e[i],o=e[i+1],s=Math.min(a[1],o[1]),c=Math.max(a[1],o[1]);if(t>=s&&t<=c&&c>s){let e=(t-a[1])/(o[1]-a[1]);return a[0]+(o[0]-a[0])*e}let l=Math.min(Math.abs(t-a[1]),Math.abs(t-o[1]));l<r&&(r=l,n=Math.abs(t-a[1])<Math.abs(t-o[1])?a[0]:o[0])}return n}at([[.362,.112],[.352,.16],[.318,.23],[.282,.292],[.268,.33]],10),at([[.268,.33],[.287,.36],[.302,.405],[.29,.448],[.262,.47]],8),at([[.262,.47],[.258,.52],[.252,.6],[.246,.66]],6);var st=Math.PI/180,ct=(e,t,n)=>{let r=Math.min(1,Math.max(0,(n-e)/(t-e)));return r*r*(3-2*r)},M=(()=>{let e=.115,t=.205,n=32*st,r=.08,i=1.5*e,a=.382*e,o=32*st,s=8*st,c=.67,l=e+i*(1-Math.cos(n)),u=i*Math.sin(n)+(t-r*(1-Math.cos(n))-l)/Math.tan(n)+r*Math.sin(n),d=-.24-u,f=d-1.6,p=[];for(let e=0;e<=12;e++)p.push([t,-(.24*e)/12]);for(let e=1;e<=16;e++){let t=-(n*e)/16;p.push([.12499999999999999+r*Math.cos(t),d+u+r*Math.sin(t)])}for(let e=0;e<=20;e++){let t=Math.PI-n+n*e/20;p.push([.28750000000000003+i*Math.cos(t),d+i*Math.sin(t)])}for(let e=1;e<=12;e++){let t=Math.PI+o*e/12;p.push([.15893000000000002+a*Math.cos(t),d+a*Math.sin(t)])}let m=p[p.length-1],h=[Math.sin(o),-Math.cos(o)],g=[Math.sin(s),-Math.cos(s)],_=[c,f],v=h[0]*-g[1]-h[1]*-g[0],y=_[0]-m[0],b=_[1]-m[1],x=(y*-g[1]-b*-g[0])/v,S=[m[0]+x*h[0],m[1]+x*h[1]];for(let e=1;e<=96;e++){let t=e/96;p.push([(1-t)*(1-t)*m[0]+2*(1-t)*t*S[0]+t*t*_[0],(1-t)*(1-t)*m[1]+2*(1-t)*t*S[1]+t*t*_[1]])}let C=p.map(e=>e[1]),w=p.map(e=>e[0]);return{Rt:e,Rc:t,Re:c,yT:d,yE:f,yCyl:-.24,Rin:e=>{if(e>=0)return t;if(e<=f)return c;let n=0,r=C.length-1;for(;r-n>1;){let t=n+r>>1;C[t]>e?n=t:r=t}let i=(e-C[n])/(C[r]-C[n]||1);return w[n]+(w[r]-w[n])*i},contour:p,top:1.1}})(),lt=.011,ut=.014,dt=e=>.012+.03*ct(M.yT-.3,M.yT+.06,e),ft=e=>M.Rin(e)+lt,pt=e=>ft(e)+ut,mt=e=>pt(e)+dt(e);M.yE+.21;function ht(e=256){let t=e=>1/e*(2/2.2*(1+.19999999999999996/2*e*e))**(2.2/.3999999999999999),n=(e,n)=>{let r=n?1:1e-4,i=n?12:1;for(let a=0;a<60;a++){let a=(r+i)/2,o=t(a)-e;(n?o>0:o<0)?i=a:r=a}return(r+i)/2},r=M.yE,i=[];for(let t=0;t<e;t++){let a=r+(0-r)*t/(e-1),o=M.Rin(a),s=Math.max((o/M.Rt)**2,1.0001),c=a>M.yT?n(s,!1):n(s,!0);i.push({y:a,M:c,T:1/(1+.19999999999999996/2*c*c),R:o})}let a=Array(e).fill(0),o=0;for(let t=e-2;t>=0;t--){let e=i[t],n=i[t+1],r=Math.max(.12,(e.M+n.M)/2*Math.sqrt((e.T+n.T)/2));o+=(n.y-e.y)/r,a[t]=o}let s=new Float32Array(e*4);for(let t=0;t<e;t++){let e=i[t],n=.5+.5*ct(0,-.12,e.y),r=Math.min(1,Math.max(0,(e.T-.33)/.67*n));s[t*4]=a[t]*.6,s[t*4+1]=e.M,s[t*4+2]=r,s[t*4+3]=e.R}let c=new _(s,e,1,ve,b);return c.minFilter=c.magFilter=ye,c.wrapS=c.wrapT=C,c.needsUpdate=!0,{tex:c,range:[r,0]}}var gt=.63,_t={len:2.1,re:1.18};function vt(e){let t=M.yE+.02,n=M.yE-_t.len,r=e=>{let r=(t-e)/(t-n);return M.Re-.01+(_t.re-M.Re+.01)*(1-(1-r)**1.7)};return{geo:A(et(r,e=>r(e)+.012+.02*Math.exp(-((t-e)/.08)),n,t+.06,90),120),mat:k({name:`rvac`,color:3882305,metalness:.85,roughness:.48,detail:2,roughVar:.3,colorVar:.08,streaks:.25,tint:{y0:n,y1:t,a:2829617,b:4867654,c:7033664,strength:.55},ribs:[360,25e-5],emissive:16734750,emissiveIntensity:0,cut:e,capColor:10133670})}}var yt=class{constructor(e,n,r){t(this,`root`,new i),t(this,`meshes`,[]),t(this,`fluids`,[]),t(this,`base`,[]),t(this,`pos`,[]),t(this,`scale`,[]),t(this,`gimbal`,[]),t(this,`hidden`,[]),t(this,`ring`,[]),t(this,`drop`,0),t(this,`m`,new E),t(this,`q`,new ie),t(this,`e`,new d),t(this,`zero`,new E().makeScale(0,0,0)),this.root.name=r,n.forEach(([e,t,n,r],i)=>{for(let a=0;a<e;a++){this.ring.push(i);let o=n+a/e*Math.PI*2,s=new E().compose(new v(Math.cos(o)*t,0,Math.sin(o)*t),new ie().setFromEuler(new d(0,-o+Math.PI/2,0)),new v(r,r,r));this.base.push(s),this.pos.push(new v(Math.cos(o)*t,0,Math.sin(o)*t)),this.scale.push(r),this.gimbal.push(new c),this.hidden.push(!1)}});let a=this.base.length;for(let t of e){let e=new T(t.geo,t.mat,a);e.castShadow=t.cast&&!t.fluid,e.receiveShadow=!t.fluid,e.frustumCulled=!1,t.fluid?(e.userData.fluid=t.fluid,this.fluids.push(e)):this.meshes.push(e),this.root.add(e)}this.sync()}sync(){for(let e=0;e<this.base.length;e++){let t=this.gimbal[e];this.e.set(t.x,0,t.y),this.q.setFromEuler(this.e),this.m.makeTranslation(this.pos[e].x,1.02-this.drop*(1+this.ring[e]*.9),this.pos[e].z).multiply(new E().makeRotationFromQuaternion(this.q)).multiply(new E().makeTranslation(-this.pos[e].x,-1.02,-this.pos[e].z)).multiply(this.base[e]);for(let t of[...this.meshes,...this.fluids])t.setMatrixAt(e,this.hidden[e]?this.zero:this.m)}for(let e of[...this.meshes,...this.fluids])e.instanceMatrix.needsUpdate=!0}showFluids(e){for(let t of this.fluids)t.visible=e||t.userData.fluid===`fire`}};function bt(e){let t={nozzle:k({name:`nozzle`,color:6251111,metalness:1,roughness:.44,detail:1.3,roughVar:.28,colorVar:.05,bump:2e-4,streaks:.28,tint:{y0:M.yE,y1:M.yT,a:4474958,b:5986915,c:9202247,strength:.6},ribs:[220,35e-5],cut:e,capColor:11844031,capRoughness:.42}),cast:k({name:`cast`,color:10725550,metalness:1,roughness:.44,detail:1.1,roughVar:.22,colorVar:.035,bump:12e-5,cut:e,capColor:11844031,capRoughness:.42}),printed:k({name:`printed`,color:11120051,metalness:1,roughness:.5,detail:1.2,roughVar:.22,colorVar:.035,layers:[2300,4e-5],bump:15e-5,cut:e,capColor:11844031,capRoughness:.42}),machined:k({name:`machined`,color:12896461,metalness:1,roughness:.3,detail:3,roughVar:.15,colorVar:.02,cut:e,capColor:12172739,capRoughness:.42}),dark:k({name:`dark`,color:3422012,metalness:.9,roughness:.4,detail:9,roughVar:.3,cut:e,capColor:9080726}),liner:k({name:`liner`,color:11561538,metalness:1,roughness:.34,detail:3,roughVar:.25,colorVar:.06,cut:e,capColor:13204560,capRoughness:.42})},n=new Map,r=(e,t)=>{let r=n.get(t)??[];r.push(e),n.set(t,r)},i=[],a=ht(),o=M.yT-.3,s=at([[.34,-.07],[.322,-.15],[.282,-.28],[.236,M.yT+.03],[.215,M.yT-.1],[mt(o)+.014,o]],6);r(A(et(e=>ft(e)-.004,mt,M.yE,o,70),64,30),t.nozzle),r(A(et(ft,e=>Math.max(mt(e),ot(s,e)),o,-.07,30),64,30),t.cast),r(A(et(M.Rin,e=>ft(e)-.004,M.yE+.002,-.004,70),64,30),t.liner);for(let e of[M.yT-.58,M.yT-1.02]){let n=mt(e);r(A(j(n-.004,n+.014,e-.022,e+.022,.005),64),t.nozzle)}r(A(tt(M.Re+.03,M.yE+.004,.012,8),64),t.nozzle);let c=M.yE+.19,l=mt(c)+.024;r(A(tt(l,c,.04,10),64),t.cast),r(A([[0,-.07],[.375,-.07],[.375,0],[.33,.06],[.24,.16],[.12,.22],[0,.235]],48,40),t.printed),r(A(tt(.33,.07,.07,10),48),t.printed);let u=new v(0,0,.3);r(A([[0,.3],[.2,.3],[.25,.42],[.26,.62],[.3,.7],[.3,.82],[.2,.9],[.12,1.02],[0,1.04]],40,40).translate(u.x,0,u.z),t.printed),r(A(tt(.27,.78,.07,10),40).translate(u.x,0,u.z),t.cast),r(A(j(0,.13,1,1.12,.01),32).translate(0,0,.14),t.machined),r(new Oe(.16,.12,.16).translate(0,1.02,.28),t.dark),r(A([[0,.12],[.14,.12],[.16,.2],[.16,.32],[0,.32]],32,40).translate(u.x,0,u.z),t.cast);let d=new v(gt,0,.2);{r(A([[0,.28],[.15,.28],[.19,.36],[.19,.6],[.22,.66],[.2,.74],[.1,.8],[0,.82]],32,40).translate(d.x,0,d.z),t.printed),r(A([[0,-.3],[.11,-.3],[.13,-.24],[.13,.26],[0,.28]],28,40).translate(d.x,0,d.z-.07),t.cast),r(A(j(0,.1,.8,.94,.01),28).translate(d.x,0,d.z),t.machined),r(nt(it([[d.x,.02,.13],[.5,.06,.12],[.4,.1,.08]],.08),{r:.085,tubular:16,radial:16}),t.cast);let n=it([[d.x+.05,.4,.33],[.55,.2,.42],[.5,-.6,.38],[l*.7,c+.05,l*.7]],.2);r(nt(n,{r:.045,tubular:32,radial:12}),t.cast);let a=nt(n,{r:.035,tubular:32,radial:10});i.push({geo:a,mat:Ye(e,{kind:`ch4`,mode:0,scale:.18,speed:1.4}),fluid:`ch4`,cast:!1})}i.push({geo:A([[0,.34],[.18,.34],[.22,.46],[.23,.8],[.12,.98],[0,1]],32).translate(u.x,0,u.z),mat:Ye(e,{kind:`lox`,mode:4,scale:.12,speed:1.6,gas:!1}),fluid:`lox`,cast:!1}),i.push({geo:A([[0,.32],[.13,.32],[.16,.4],[.16,.7],[0,.76]],28).translate(d.x,0,d.z),mat:Ye(e,{kind:`ch4`,mode:4,scale:.12,speed:1.6,gas:!1}),fluid:`ch4`,cast:!1});let f=A([[0,-.003],...M.contour.filter(e=>e[1]<-.003).filter((e,t)=>t%3==0).map(e=>[e[0]-.003,e[1]]),[M.Re-.003,M.yE],[0,M.yE]],48);i.push({geo:f,mat:Ye(e,{kind:`fire`,mode:3,field:a.tex,fieldRange:a.range,intensity:1}),fluid:`fire`,cast:!1});let p=[];for(let[e,t]of n){let n=t.map(e=>{let t=e.attributes.position.count;for(let t of Object.keys(e.attributes))[`position`,`normal`,`uv`,`aS`].includes(t)||e.deleteAttribute(t);return e.getAttribute(`uv`)||e.setAttribute(`uv`,new g(new Float32Array(t*2),2)),e.getAttribute(`aS`)||e.setAttribute(`aS`,new g(new Float32Array(t),1)),e.index?e:e.toNonIndexed()}),r=n.some(e=>!e.index),i=ge(r?n.map(e=>e.index?e.toNonIndexed():e):n,!1);i.computeBoundingSphere(),p.push({geo:i,mat:e,cast:!1})}for(let e of i){let t=e.geo.attributes.position.count;e.geo.getAttribute(`aS`)||e.geo.setAttribute(`aS`,new g(new Float32Array(t),1)),p.push(e)}return p}var N=4.5,xt=4.49,P={skirt0:1.7,puck:4.9,fwd0:62,fins:66.4,top:69,hsr0:69,hsr1:72.3},F=72.3,I={skirt1:78.3,puck:76.89999999999999,bay0:103.8,nose0:115.3,top:124.4};I.top;function St(e,t){let n=xt*xt,r=e.yTop+Math.max(e.hTop,0);if(t<e.yBot-e.hBot||t>r)return 0;if(t<e.yBot){let r=(e.yBot-t)/e.hBot;return Math.PI*n*(1-r*r)}if(t<=e.yTop){if(e.hTop<0&&t>e.yTop+e.hTop){let r=(e.yTop-t)/-e.hTop;return Math.PI*n*r*r}return Math.PI*n}let i=(t-e.yTop)/e.hTop;return Math.PI*n*(1-i*i)}function Ct(e){let t=e.yBot-e.hBot,n=e.yTop+Math.max(e.hTop,0),r=2e3,i=(n-t)/r,a=new Float32Array(2001);for(let n=1;n<=r;n++)a[n]=a[n-1]+St(e,t+(n-.5)*i)*i;let o=a[r];return{...e,y0:t,y1:n,volume:o,mass:o*e.rho,level(e){let n=Math.max(0,Math.min(1,e))*o,s=0,c=r;for(;c-s>1;){let e=s+c>>1;a[e]<n?s=e:c=e}let l=a[s],u=a[c];return t+(s+(u>l?(n-l)/(u-l):0))*i}}}var wt=1220,Tt=430,L={B:{lox:Ct({name:`Liquid oxygen`,yBot:6.4,hBot:2,yTop:39,hTop:-2,rho:wt,kind:`lox`}),ch4:Ct({name:`Liquid methane`,yBot:39,hBot:2,yTop:62,hTop:2.2,rho:Tt,kind:`ch4`})},S:{lox:Ct({name:`Liquid oxygen`,yBot:78.3,hBot:1.3,yTop:92.8,hTop:-1.8,rho:wt,kind:`lox`}),ch4:Ct({name:`Liquid methane`,yBot:92.8,hBot:1.8,yTop:101.8,hTop:2,rho:Tt,kind:`ch4`})}},Et=[[3,.98,Math.PI/6,1],[10,2.5,0,.98],[20,3.86,Math.PI/20,.88]],Dt=[[3,1,0,1],[3,2.95,Math.PI/3,.92]],Ot={uLevels:{value:new fe(30,60,F+20,F+29)},uScorch:{value:0},uBaseGlow:{value:new c(1,0)},uTime:We};function kt(e,t,n,r,i){let a=e.onBeforeCompile;e.onBeforeCompile=(t,o)=>{a.call(e,t,o),Object.assign(t.uniforms,n);let s=t.fragmentShader.replace(`#include <common>`,`#include <common>\n${r}`);for(let[e,t]of Object.entries(i))s=s.replace(e,`${e}\n${t}`);t.fragmentShader=s};let o=e.customProgramCacheKey.bind(e);e.customProgramCacheKey=()=>o()+`|`+t;let s=e.userData.makeBack;return s&&(e.userData.makeBack=()=>kt(s(),t,n,r,i)),e}var At=`
uniform vec4 uLevels; uniform float uScorch; uniform vec2 uBaseGlow;
float sHash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
// how cold the outside skin is at this height: 1 below a liquid surface, 0 above
float coldAt(float y){
  float c = 0.0;
  c = max(c, step(${(L.B.lox.y0+1.5).toFixed(2)}, y) * step(y, ${L.B.lox.yTop.toFixed(2)}) * step(y, uLevels.x));
  c = max(c, step(${L.B.ch4.yBot.toFixed(2)}, y) * step(y, uLevels.y));
  c = max(c, step(${(L.S.lox.y0+1.5).toFixed(2)}, y) * step(y, ${L.S.lox.yTop.toFixed(2)}) * step(y, uLevels.z));
  c = max(c, step(${L.S.ch4.yBot.toFixed(2)}, y) * step(y, uLevels.w));
  return c;
}
`;function jt(e,t={}){let n=k({name:t.name??`steel`,color:t.color??12435910,metalness:1,roughness:t.roughness??.36,detail:t.detail??.55,roughVar:.45,colorVar:.07,anisotropy:t.anisotropy??.15,anisotropyRotation:Math.PI/2,bump:t.bump??6e-4,cut:e,capColor:13225169,capRoughness:.4,capMetalness:.6,envMapIntensity:t.envMapIntensity??1}),r=t.frost??!0,i=t.welds??!0;return kt(n,`steel${+r}${+i}${t.base??0}`,Ot,At,{"#include <color_fragment>":`
float stFrost = 0.0, stWeld = 0.0;
if (!cutCap) {
  float y = vObj.y;
  float ang = atan(vObj.z, vObj.x);
  ${i?`
  float ring = floor(y / 1.83);
  float dy = abs(y - (ring + 0.5) * 1.83) - 0.915;
  stWeld = exp(-pow(dy / 0.011, 2.0));
  float tintB = exp(-pow(dy / 0.07, 2.0)) * (0.5 + 0.5 * n3(vObj * 0.9));
  // three vertical seams per ring, staggered
  float seamA = sHash(vec2(ring, 3.1)) * 6.2832;
  float seam = 0.0;
  for (int k = 0; k < 3; k++) { float a = mod(ang - seamA - float(k) * 2.0944 + 9.4248, 6.2832) - 3.1416; seam = max(seam, exp(-pow(a * 4.5 / 0.013, 2.0))); }
  stWeld = max(stWeld, seam * 0.8);
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.02, 0.92, 0.74), tintB * 0.45);
  diffuseColor.rgb *= 1.0 - stWeld * 0.35;
  // slightly different sheet from ring to ring
  diffuseColor.rgb *= 0.95 + 0.1 * sHash(vec2(ring, floor(mod(ang - seamA + 6.2832, 6.2832) / 2.0944)));
  `:``}
  ${t.base?`
  // the base of the booster: soot pushed back up by the plume at altitude
  float soot = smoothstep(${(t.base+4).toFixed(1)}, ${t.base.toFixed(1)}, y + (n3(vObj * vec3(0.4, 0.06, 0.4)) - 0.5) * 3.0);
  diffuseColor.rgb *= 1.0 - soot * 0.7;
  `:``}
  ${r?`
  float cold = coldAt(y);
  // frost: nearly everywhere the liquid is behind the wall, streaked by the airflow, thin near the level
  float streak = n3(vObj * vec3(1.6, 0.05, 1.6));
  float fpatch = fbm2(vObj * vec3(0.35, 0.12, 0.35));
  stFrost = cold * smoothstep(0.18, 0.42, fpatch + stWeld * 0.2) * (0.72 + 0.28 * streak);
  vec3 frostC = vec3(0.84, 0.88, 0.93) * (0.9 + 0.16 * n3(vObj * 5.0));
  diffuseColor.rgb = mix(diffuseColor.rgb, frostC, stFrost);
  `:``}
  // hot staging scorches the top of the booster and the ship's skirt
  float sc = uScorch * (smoothstep(${(P.hsr0-4).toFixed(1)}, ${P.hsr1.toFixed(1)}, y) * step(y, ${(F+2.2).toFixed(1)}) * smoothstep(${(F+2.2).toFixed(1)}, ${(F+.2).toFixed(1)}, y + 0.0) + smoothstep(${(P.hsr0-4).toFixed(1)}, ${P.hsr0.toFixed(1)}, y) * step(y, ${P.hsr1.toFixed(1)}));
  diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(0.32, 0.28, 0.26), clamp(sc, 0.0, 1.0) * (0.6 + 0.4 * n3(vObj * 0.8)));
}
`,"#include <metalnessmap_fragment>":`
if (!cutCap) {
  roughnessFactor = mix(roughnessFactor, 0.55, stWeld * 0.6);
  roughnessFactor = mix(roughnessFactor, 0.92, stFrost);
  metalnessFactor = mix(metalnessFactor, 0.0, stFrost);
}
`})}function Mt(e,t={}){let n=k({name:`tiles`,color:1316118,metalness:0,roughness:.66,detail:3,roughVar:.3,colorVar:.12,cut:e,capColor:15328991,capRoughness:.9,capMetalness:0}),r=t.sector??1.72;return kt(n,`tiles${t.flap?`f`:``}`,Ot,At+`
vec3 hexCell(vec2 p){
  // returns (distance to edge, cell id)
  vec2 r = vec2(1.0, 1.7320508);
  vec2 h = r * 0.5;
  vec2 a = mod(p, r) - h, b = mod(p - h, r) - h;
  vec2 g = dot(a, a) < dot(b, b) ? a : b;
  vec2 id = p - g;
  vec2 q = abs(g);
  float d = 0.5 - max(dot(q, normalize(vec2(1.0, 1.7320508))), q.x);
  return vec3(d, sHash(id * 0.37), 0.0);
}`,{"#include <color_fragment>":`
${t.flap?``:`{
  vec3 P = cutCap ? cutHit : vObj;
  float ang = atan(P.z, P.x);
  float wob = 0.06 * sin(P.y * 0.9) + 0.04 * sin(P.y * 2.3 + 1.0);
  if (abs(ang) > ${r.toFixed(3)} + wob) discard;
}`}
float tGap = 0.0;
if (!cutCap) {
  ${t.flap?`vec2 tp = vec2(vObj.z, vObj.y) / 0.31;`:`vec2 tp = vec2(atan(vObj.z, vObj.x) * 4.5, vObj.y) / 0.31;`}
  vec3 hc = hexCell(tp);
  tGap = 1.0 - smoothstep(0.015, 0.045, hc.x);
  float shade = 0.82 + 0.36 * hc.y;
  float light = step(0.985, hc.y);
  diffuseColor.rgb *= shade;
  diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.42, 0.42, 0.41), light);
  diffuseColor.rgb *= 1.0 - tGap * 0.7;
  float scT = uScorch * smoothstep(${(F+3).toFixed(1)}, ${F.toFixed(1)}, vObj.y);
  diffuseColor.rgb *= 1.0 - scT * 0.4;
}
`,"#include <metalnessmap_fragment>":`
if (!cutCap) roughnessFactor = mix(roughnessFactor, 0.95, tGap);
`})}function Nt(e,t){return kt(k({name:`baseshield`,color:2763048,metalness:.2,roughness:.78,detail:2.2,roughVar:.3,colorVar:.2,cut:e,capColor:10132120,capMetalness:.1,emissive:16738852,emissiveIntensity:1}),`base`+t,Ot,At,{"#include <emissivemap_fragment>":`
if (!cutCap) {
  float g = ${t?`uBaseGlow.y`:`uBaseGlow.x`};
  float n = fbm2(vObj * 0.9);
  totalEmissiveRadiance *= g * (0.2 + 0.8 * smoothstep(0.35, 0.8, n)) * 0.35;
} else totalEmissiveRadiance *= 0.0;
`})}function Pt(e,t,n,r=!1){let i=Ue[t],a=new je({uniforms:{uCutPlane:e.uPlane,uCutPlane2:e.uPlane2,uCutGlow:e.uGlow,uCutProj:Le,uNoise3D:Pe,uColor:{value:i.color},uEmph:i.emph,uTime:We,uOn:Ke,uLevels:Ot.uLevels},vertexShader:`
#include <common>
${ze}
varying vec3 vViewPosition;
#include <clipping_planes_pars_vertex>
void main() {
  #include <begin_vertex>
  #include <project_vertex>
  #include <clipping_planes_vertex>
  vViewPosition = -mvPosition.xyz;
  ${Be}
}`,fragmentShader:`
#include <common>
${Ve}
${Fe}
#include <clipping_planes_pars_fragment>
varying vec3 vViewPosition;
uniform vec3 uColor; uniform float uEmph, uTime, uOn; uniform vec4 uLevels;
void main() {
  vec4 diffuseColor = vec4(1.0);
  #include <clipping_planes_fragment>
  ${He}
  if (!cutCap) discard;
  vec3 P = cutHit;
  float lv = uLevels[${n}];
  float wave = (n3(vec3(P.x * 0.08 + uTime * 0.05, uTime * 0.08, P.z * 0.08)) - 0.5) * 0.35;
  float d = P.y - (lv + wave);
  ${r?`if (d < 0.0) discard;`:`if (d > 0.0) discard;`}
  float thick = length(vObj - cutHit);
  vec3 col;
  ${r?`
  // pressurant gas: hot oxygen or methane from the engines, swirling in from the top
  float sw = n3(vec3(P.x * 0.06, P.y * 0.05 - uTime * 0.12, P.z * 0.06 + uTime * 0.03));
  float I = (0.05 + 0.12 * sw) * min(thick, 6.0) * 0.3 + exp(-d * 1.4) * 0.35;
  col = mix(uColor, vec3(1.0), 0.3) * I;
  gl_FragColor = vec4(col * uEmph * uOn, 1.0);
  `:`
  // looking into a body of liquid: thin at the wall, deep in the middle (Beer Lambert through the far half)
  float k = 1.0 - exp(-thick * 0.45);
  // it drains toward the outlet at the bottom centre: flow lines that converge as they go down
  float rr = length(P.xz);
  float ph = P.y * 0.22 + uTime * 0.55 + rr * 0.08;
  float bands = smoothstep(0.15, 0.85, abs(fract(ph) * 2.0 - 1.0));
  float st = n3(vec3(P.x * 0.07, P.y * 0.03 + uTime * 0.05, P.z * 0.07));
  float fine = n3(vec3(P.x * 0.45, P.y * 0.18 + uTime * 0.3, P.z * 0.45));
  // specks carried down with the flow
  vec2 sg = vec2(P.x * 3.0, P.y * 3.0 + uTime * 1.6);
  vec2 sc = floor(sg), sf = fract(sg) - 0.5;
  float sh = fract(sin(dot(sc, vec2(12.9898, 78.233))) * 43758.5453);
  float speck = step(0.93, sh) * smoothstep(0.18, 0.0, length(sf));
  vec3 shallow = mix(uColor, vec3(1.0), 0.12);
  vec3 c0 = mix(shallow * 1.3, uColor * 0.55, k);
  float I = (0.75 + 0.25 * bands) * (0.75 + 0.45 * st) * (0.9 + 0.2 * fine);
  float skin = exp(d * 4.0) * 2.4 + exp(d * 0.7) * 0.35;
  col = (c0 * I * 1.5 + uColor * skin * 2.0 + vec3(0.9, 0.97, 1.0) * speck * 1.2) * uEmph * uOn;
  gl_FragColor = vec4(col, 1.0);
  `}
}`,side:2,defines:e.capsOn?{CAPS:1}:{},clipping:!0,transparent:r,depthWrite:!r,blending:r?2:1});return a.clippingPlanes=e.planes,a.userData.caps=e.capsOn,e.materials.add(a),a.userData.kind=t,a}function Ft(e,t){let n=Ue[t],r=new je({uniforms:{uColor:{value:n.color},uEmph:n.emph,uTime:We,uOn:Ke,uNoise3D:Pe},vertexShader:`
varying vec3 vW; varying vec3 vO;
#include <clipping_planes_pars_vertex>
void main(){ vO = position; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
#include <clipping_planes_vertex>
}`,fragmentShader:`
${Fe}
#include <clipping_planes_pars_fragment>
uniform vec3 uColor; uniform float uEmph, uTime, uOn;
varying vec3 vW; varying vec3 vO;
void main(){
  #include <clipping_planes_fragment>
  float r = length(vO.xz);
  float rip = n3(vec3(vO.x * 0.25 + uTime * 0.05, uTime * 0.1, vO.z * 0.25));
  float rim = smoothstep(3.6, 4.45, r);
  vec3 V = normalize(cameraPosition - vW);
  float fr = pow(1.0 - abs(V.y), 4.0);
  vec3 c = uColor * (0.5 + 0.6 * rip + rim * 0.8) + vec3(0.8, 0.9, 1.0) * fr * 0.4;
  gl_FragColor = vec4(c * uEmph * uOn * 0.9, 1.0);
}`,side:2,clipping:!0});return r.clippingPlanes=e.planes,r}var It=Math.PI/180;function Lt(e,t,n,r=xt+.005,i=40){let a=[],o=[],s=Math.sign(t);for(let c=0;c<=i;c++){let l=c/i*(Math.PI/2);a.push([r*Math.sin(l),e+t*Math.cos(l)]),o.push([(r-n)*Math.sin(l),e+(t-s*n)*Math.cos(l)-s*n*0])}return[...a,...o.reverse()]}function Rt(e,t=.03){let n=[],r=e.y0+.001,i=e.y1-.001,a=[],o=[];for(let n=0;n<=160;n++){let s=r+(i-r)*n/160,c=St(e,s);if(e.hTop<0&&s>e.yTop+e.hTop){let n=(e.yTop-s)/-e.hTop,r=xt*Math.sqrt(Math.max(0,1-n*n));a.push([xt-t,s]),o.push([r+t,s])}else a.push([Math.max(0,Math.sqrt(c/Math.PI)-t),s])}if(o.length){n.push(...a,...o.reverse());let i=e.yTop+e.hTop;n.push([0,i-t]),n.push([0,r])}else n.push([0,r],...a,[0,i]);return A(n,96)}function R(e,t,n,r,i,a,o=0){let s=new Oe(e,t,n);return s.rotateY(o),s.translate(r,i,a),s}var zt=class{constructor(){t(this,`root`,new i),t(this,`booster`,new i),t(this,`ship`,new i),t(this,`cut`,void 0),t(this,`parts`,[]),t(this,`bEng`,void 0),t(this,`sSL`,void 0),t(this,`sVac`,void 0),t(this,`vacMat`,void 0),t(this,`surfaces`,[]),t(this,`fluids`,[]),t(this,`anchors`,{}),t(this,`finGroups`,[]),t(this,`hsrVents`,[]),t(this,`spanning`,[]),t(this,`noseR`,()=>0),this.root.name=`starship`,this.root.add(this.booster,this.ship);let e=this.cut=new Ie(this.root,N+.7,0),n={steel:jt(e),steelBare:jt(e,{frost:!1,name:`steel-bare`}),steelBase:jt(e,{frost:!1,base:8,name:`steel-base`}),inner:jt(e,{frost:!1,welds:!1,name:`steel-in`,roughness:.42,envMapIntensity:.6}),dome:jt(e,{frost:!1,welds:!1,name:`dome`,roughness:.36,envMapIntensity:.7}),tiles:Mt(e),flapTiles:Mt(e,{flap:!0}),baseB:Nt(e,0),baseS:Nt(e,1),dark:k({name:`darksteel`,color:3816512,metalness:.9,roughness:.42,detail:3,roughVar:.3,cut:e,capColor:10133670}),fin:k({name:`fin`,color:9277589,metalness:1,roughness:.38,detail:2,roughVar:.35,colorVar:.12,streaks:.3,cut:e,capColor:12106946}),copv:k({name:`copv`,color:1908514,metalness:.3,roughness:.32,detail:6,roughVar:.2,clearcoat:.6,clearcoatRoughness:.25,cut:e,capColor:3948356,capMetalness:.1}),sat:k({name:`sat`,color:1450042,metalness:.6,roughness:.3,detail:4,roughVar:.2,cut:e,capColor:9081763}),satFrame:k({name:`satframe`,color:13157044,metalness:.8,roughness:.35,cut:e,capColor:14209732})},r=(e,t,n)=>{let r=new O(e,t);return r.castShadow=!0,r.receiveShadow=!0,n.add(r),r},a=(e,t,n)=>{let r=new i;return r.name=e,t.add(r),this.parts.push({name:e,group:r,dy:n}),r},o=(t,n,r,i,a={})=>{let o=Ye(e,{kind:n,mode:i,scale:a.scale??1.4,speed:a.speed??1.4,intensity:a.intensity??1.5}),s=new O(t,o);return s.userData.fluid=n,r.add(s),this.fluids.push(s),s},s=(e,t,i,a,s=n.dark,c=.6,l=!1)=>{let u=it(e,c),d=Math.max(24,Math.round(u.getLength()*3)),f=r(nt(u,{r:t,ri:t*.82,tubular:d,radial:20}),s,a),p=o(nt(u,{r:t*.8,tubular:d,radial:16}),i,a,0,{scale:Math.max(.6,t*4),speed:1.2});l&&(f.userData.spans=!0,p.userData.spans=!0,this.spanning.push(f,p))},c=bt(e),l=a(`b-engines`,this.booster,-9);this.bEng=new yt(c,Et,`booster-engines`),this.bEng.root.position.y=-M.yE,l.add(this.bEng.root);let u=a(`b-aft`,this.booster,-5);r(A(j(N-.035,N,P.skirt0,L.B.lox.yBot),180),n.steelBase,u);{let e=new re;e.absarc(0,0,xt-.01,0,Math.PI*2,!1);for(let[t,n,r,i]of Et)for(let a=0;a<t;a++){let o=r+a/t*Math.PI*2,s=new xe;s.absarc(Math.cos(o)*n,-Math.sin(o)*n,.47*i,0,Math.PI*2,!0),e.holes.push(s)}let t=new p(e,{depth:.16,bevelEnabled:!1,curveSegments:22});t.rotateX(-Math.PI/2),t.translate(0,P.skirt0,0),r(t,n.baseB,u)}r(A(j(0,1.75,3.35,4.15,.06),64),n.dark,u),r(A(j(3.05,xt-.02,3.35,3.85,.04),160),n.dark,u),r(A(j(1.95,3,3.4,3.75,.03),120),n.dark,u);{let e=[];for(let t=0;t<10;t++){let n=t/10*Math.PI*2+Math.PI/10;e.push(R(2.9,.34,.22,Math.cos(n)*3,3.6,Math.sin(n)*3,-n))}r(ge(e),n.dark,u);let t=[];for(let e=0;e<12;e++){let n=e/12*Math.PI*2+.13,r=new x(.3,.75,6,18);r.translate(Math.cos(n)*3.95,4.62,Math.sin(n)*3.95),t.push(r)}r(ge(t),n.copv,u)}r(A(tt(2.55,4.45,.24,18),160),n.dark,u),o(A(tt(2.55,4.45,.2,14),120),`ch4`,u,4,{scale:1.2}),r(A(tt(1.2,4.42,.2,18),96),n.dark,u),o(A(tt(1.2,4.42,.16,14),80),`lox`,u,4,{scale:1});for(let e of[-3.86,3.86,-2.5,2.5])s([[e*.66,4.45,0],[e,4,0],[e,3.25,0]],.13,`ch4`,u);for(let e of[-.49,.98])s([[e*.3,4.4,0],[e,3.95,0],[e,3.25,0]],.15,`lox`,u);let d=a(`b-lox`,this.booster,-2),f=L.B;r(A(j(N-.03,N,f.lox.yBot,f.lox.yTop),180),n.steel,d),r(A(Lt(f.lox.yBot,-f.lox.hBot,.03),120),n.dome,d);{let e=f.ch4.yBot-f.ch4.hBot,t=new h(new v(0,e+.2,0),new v(0,4.15,0));r(nt(t,{r:.42,ri:.38,tubular:60,radial:32}),n.inner,d),o(nt(t,{r:.37,tubular:60,radial:24}),`ch4`,d,0,{scale:2.2,speed:2.2,intensity:1.7});for(let e=0;e<3;e++)r(R(.06,.9,1.2,0,f.lox.yBot-f.lox.hBot+.6,0,e/3*Math.PI),n.inner,d)}s([[-4.2,3.9,0],[-4.2,f.lox.yTop-2.6,0],[-3.4,f.lox.yTop-2.3,0]],.07,`oxgas`,d,n.inner,.4,!0),this.tank(f.lox,d,0);let m=a(`b-ch4`,this.booster,1);r(A(j(N-.03,N,f.ch4.yBot,f.ch4.yTop),180),n.steel,m),r(A(Lt(f.ch4.yBot,-f.ch4.hBot,.04),120),n.dome,m),r(A(Lt(f.ch4.yTop,f.ch4.hTop,.03),120),n.dome,m),s([[4.2,3.9,0],[4.2,f.ch4.yTop-.6,0],[3.2,f.ch4.yTop+.9,0]],.07,`fuelgas`,m,n.inner,.4,!0),this.tank(f.ch4,m,1);let g=a(`b-fwd`,this.booster,4);r(A(j(N-.03,N,f.ch4.yTop,P.top),180),n.steelBare,g);{let e=this.gridFin();for(let t=0;t<3;t++){let a=(90+t*120)*It,o=new i,s=r(e,n.fin,o);s.castShadow=!0,o.position.set(Math.cos(a)*N,P.fins,Math.sin(a)*N),o.rotation.y=-a,g.add(o),this.finGroups.push(o),r(R(.7,1.2,1.4,Math.cos(a)*(N+.2),P.fins,Math.sin(a)*(N+.2),-a),n.dark,g)}for(let e of[30*It,150*It])r(R(.55,.5,.7,Math.cos(e)*(N+.2),65.2,Math.sin(e)*(N+.2),-e),n.dark,g)}let _=a(`b-race`,this.booster,0);{let e=200*It,t=new x(.28,f.ch4.yTop-8,4,10);t.scale(1,1,1.5),t.rotateY(-e),t.translate(Math.cos(e)*(N+.08),(f.ch4.yTop+8)/2,Math.sin(e)*(N+.08)),r(t,n.steelBare,_)}let y=a(`b-hsr`,this.booster,7);r(A(j(N-.06,N,P.hsr0,P.hsr0+.45,.02),180),n.steelBare,y),r(A(j(N-.06,N,P.hsr1-.42,P.hsr1,.02),180),n.steelBare,y);{let e=[];for(let t=0;t<30;t++){let n=t/30*Math.PI*2,r=new Oe(.1,P.hsr1-P.hsr0-.8,.34);r.rotateZ(0),r.rotateY(-n),r.translate(Math.cos(n)*(N-.05),(P.hsr0+P.hsr1)/2,Math.sin(n)*(N-.05)),e.push(r);let i=n+Math.PI/30;this.hsrVents.push(new v(Math.cos(i)*N,(P.hsr0+P.hsr1)/2,Math.sin(i)*N))}r(ge(e),n.steelBare,y),r(A(Lt(P.hsr0+.1,1.6,.06,N-.08),120),n.dark,y)}let b=a(`s-aft`,this.ship,10);this.sSL=new yt(c,[Dt[0]],`ship-sl`),this.sSL.root.position.y=F+1-M.yE,b.add(this.sSL.root);let C=vt(e);this.vacMat=C.mat,this.sVac=new yt([...c,{geo:C.geo,mat:C.mat,cast:!1}],[Dt[1]],`ship-rvac`),this.sVac.root.position.y=F+.1-(M.yE-_t.len)*Dt[1][3],b.add(this.sVac.root),r(A(j(N-.035,N,F,I.skirt1),180),n.steelBare,b);{let e=new re;e.absarc(0,0,xt-.01,0,Math.PI*2,!1);for(let[t,n,r]of Dt)for(let i=0;i<t;i++){let a=r+i/t*Math.PI*2,o=new xe;o.absarc(Math.cos(a)*n,-Math.sin(a)*n,n>2?1.12:.5,0,Math.PI*2,!0),e.holes.push(o)}let t=new p(e,{depth:.14,bevelEnabled:!1,curveSegments:26});t.rotateX(-Math.PI/2),t.translate(0,F+1.75,0),r(t,n.baseS,b),r(A(j(0,1.6,I.puck-.6,I.puck,.05),64),n.dark,b),r(A(j(1.7,xt-.02,I.puck-.45,I.puck-.05,.03),160),n.dark,b)}this.flap(b,n,!0);let w=a(`s-lox`,this.ship,13),T=L.S;r(A(j(N-.03,N,T.lox.yBot-0,T.lox.yTop),180),n.steel,w),r(A(Lt(T.lox.yBot,-T.lox.hBot,.03),120),n.dome,w),this.tank(T.lox,w,2);{let e=new v(-1.75,F+17.25,0);r(new S(1.2,56,36).translate(e.x,e.y,e.z),n.inner,w);let t=new S(1.14,48,32);t.translate(e.x,e.y,e.z),o(t,`ch4`,w,4,{scale:.8,speed:.4,intensity:1.3}),s([[e.x,e.y-1.2,0],[e.x,F+6,0],[-1,I.puck+.2,0],[-1,F+3.4,0]],.1,`ch4`,w,n.inner,.8,!0),this.anchors.ch4Header=e.clone().add(new v(0,0,.6));let i=new h(new v(0,T.ch4.yBot-T.ch4.hBot+.1,0),new v(0,I.puck,0));r(nt(i,{r:.32,ri:.29,tubular:40,radial:28}),n.inner,w),o(nt(i,{r:.28,tubular:40,radial:20}),`ch4`,w,0,{scale:2,speed:2,intensity:1.7})}let E=a(`s-ch4`,this.ship,16);r(A(j(N-.03,N,T.ch4.yBot,I.bay0),180),n.steel,E),r(A(Lt(T.ch4.yBot,-T.ch4.hBot,.04),120),n.dome,E),r(A(Lt(T.ch4.yTop,T.ch4.hTop,.03),120),n.dome,E),this.tank(T.ch4,E,3);let D=a(`s-bay`,this.ship,19);r(A(j(N-.03,N,I.bay0,I.nose0),180),n.steelBare,D);{let e=[],t=[];for(let n=0;n<12;n++){let r=I.bay0+1.6+n*.78;e.push(R(6,.16,2.9,.2,r,0)),t.push(R(6.1,.06,3,.2,r-.12,0))}r(ge(e),n.sat,D),r(ge(t),n.satFrame,D),r(R(.25,10.4,.5,-3.3,I.bay0+5.6,0),n.dark,D),r(R(.25,10.4,.5,3.6,I.bay0+5.6,0),n.dark,D),r(R(.06,.9,6.4,-N+.01,I.bay0+6,0),n.dark,D)}let ee=a(`s-nose`,this.ship,23);{let e=I.top-I.nose0,t=at([[N,0],[N-.02,1.4],[4.32,3.2],[3.85,5],[3.05,6.5],[2,7.7],[.9,8.6],[0,e]],14),i=e=>{for(let n=0;n<t.length-1;n++)if(t[n+1][1]>=e){let r=(e-t[n][1])/(t[n+1][1]-t[n][1]||1);return t[n][0]+(t[n+1][0]-t[n][0])*r}return 0},a=[];for(let t=0;t<=120;t++){let n=e*t/120;a.push([i(n),I.nose0+n])}for(let t=120;t>=0;t--){let n=Math.min(e-.04,e*t/120);a.push([Math.max(0,i(n)-.035),I.nose0+n-0])}r(A(a,180),n.steelBare,ee);let s=[];for(let t=0;t<=120;t++){let n=e*t/120;s.push([i(n)+.03,I.nose0+n])}for(let t=120;t>=0;t--){let n=e*t/120;s.push([Math.max(0,i(n)+.001),I.nose0+n])}r(A(s,180),n.tiles,ee),this.noseR=i;let c=new v(0,I.nose0+2.6,0),l=new S(1.3,48,32);l.translate(c.x,c.y,c.z),r(l,n.inner,ee);let u=new S(1.22,40,28);u.translate(c.x,c.y,c.z),o(u,`lox`,ee,4,{scale:.8,speed:.4,intensity:1.3}),this.anchors.loxHeader=c.clone().add(new v(0,0,.7))}s([[0,I.nose0+1.3,0],[0,I.nose0+.4,0],[-3.7,I.nose0-.5,0],[-3.7,F+6.4,0],[-2.95,I.puck+.2,0],[-2.95,F+3.2,0]],.12,`lox`,E,n.inner,1,!0);for(let[e,t,i]of[[b,F+.15,T.lox.yBot],[w,T.lox.yBot,T.lox.yTop],[E,T.ch4.yBot,I.bay0],[D,I.bay0,I.nose0]])r(A(j(N+.001,N+.032,t,i),200),n.tiles,e);this.flap(ee,n,!1),this.chines(w,n.flapTiles),Object.assign(this.anchors,{bLox:new v(0,22,N),bCh4:new v(0,50,N),downcomer:new v(0,20,.45),engines:new v(0,0,0),fins:new v(0,P.fins,N+3),hsr:new v(0,(P.hsr0+P.hsr1)/2,N),sLox:new v(0,F+12,N),sCh4:new v(0,F+25,N),bay:new v(0,I.bay0+6,N),nose:new v(0,I.top-3,2),sEngines:new v(0,F+.5,0),puck:new v(0,3.8,0)}),e.collect(this.root),this.root.traverse(e=>{e.frustumCulled=!1})}tank(e,t,n){let r=Rt(e),i=new O(r,Pt(this.cut,e.kind,n));i.userData.fluid=e.kind,t.add(i),this.fluids.push(i);let a=new O(r,Pt(this.cut,e.kind===`lox`?`oxgas`:`fuelgas`,n,!0));a.userData.fluid=e.kind===`lox`?`oxgas`:`fuelgas`,a.renderOrder=2,t.add(a),this.fluids.push(a);let o=new O(new Ae(1,96).rotateX(-Math.PI/2),Ft(this.cut,e.kind));o.userData.fluid=e.kind,t.add(o),this.surfaces.push({mesh:o,tank:e,idx:n})}gridFin(){let e=3.8,t=2.9,n=.55,r=[];r.push(R(t,n,.12,1.75,0,-3.8/2),R(t,n,.12,1.75,0,e/2),R(.14,n,e,.3,0,0),R(.12,n,e,3.1999999999999997,0,0)),r.push(R(.6,n*.8,.9,0,0,0));let i=.3,a=-3.8/2,o=e/2;for(let e of[1,-1])for(let t=-8;t<=8;t+=.3){let s=[],c=(e,t)=>{e>=.299999&&e<=3.200001&&t>=-1.9000009999999998&&t<=1.9000009999999998&&s.push([e,t])};if(c(i,t),c(3.1999999999999997,e*2.9+t),c(i+(a-t)/e,a),c(i+(o-t)/e,o),s.length<2)continue;s.sort((e,t)=>e[0]-t[0]);let[l,u]=[s[0],s[s.length-1]],d=Math.hypot(u[0]-l[0],u[1]-l[1]);if(d<.05)continue;let f=new Oe(d,n*.92,.035);f.rotateY(-Math.atan2(u[1]-l[1],u[0]-l[0])),f.translate((l[0]+u[0])/2,0,(l[1]+u[1])/2),r.push(f)}return ge(r.map(e=>e.toNonIndexed()))}flap(e,t,n){let r=new re;n?(r.moveTo(0,.6),r.lineTo(3.3,1.2),r.lineTo(3.3,7.6),r.lineTo(0,10.2)):(r.moveTo(0,.4),r.lineTo(2.3,1.4),r.lineTo(2.1,4.6),r.lineTo(0,6));let i=new p(r,{depth:.28,bevelEnabled:!0,bevelSize:.06,bevelThickness:.05,bevelSegments:2});i.translate(0,0,-.14);for(let r of[1,-1]){let a=n?r*90*It:r*118*It,o=i.clone(),s=n?F:I.nose0+.8,c=n?N-.05:this.noseR(s-I.nose0+3)-.05;n||o.rotateZ(.16),o.rotateX(0),o.translate(c,s,0),o.rotateY(-a);let l=new O(o,t.flapTiles);l.castShadow=!0,l.receiveShadow=!0,e.add(l);let u=new x(.22,n?9:5,4,10);u.translate(c+.05,s+(n?5.4:3.4),0),u.rotateY(-a),e.add(new O(u,t.steelBare))}}chines(e,t){for(let n of[1,-1]){let r=n*1.72,i=new Oe(.42,I.nose0-F-9,.14,1,8,1);i.translate(N+.18,F+7+(I.nose0-F-9)/2,0),i.rotateY(-r);let a=new O(i,t);a.castShadow=!0,a.receiveShadow=!0,e.add(a)}}update(e){let t=L,n=Ot.uLevels.value;n.set(t.B.lox.level(e.bLox*1e3/t.B.lox.mass),t.B.ch4.level(e.bCh4*1e3/t.B.ch4.mass),t.S.lox.level(e.sLox*1e3/t.S.lox.mass),t.S.ch4.level(e.sCh4*1e3/t.S.ch4.mass));for(let e of this.surfaces){let t=n.getComponent(e.idx),r=Math.sqrt(Math.max(.01,St(e.tank,t))/Math.PI)-.04;e.mesh.position.y=t,e.mesh.scale.set(r,1,r),e.mesh.visible=this.cut.capsOn&&r>.2}let r=e.explode*e.explode*(3-2*e.explode);for(let e of this.parts)e.group.position.y=e.dy*r*1.7;let i=r*3.2;for(let e of[this.bEng,this.sSL,this.sVac])Math.abs(e.drop-i)>1e-4&&(e.drop=i,e.sync());for(let e of this.spanning)e.visible=r<.02&&(!e.userData.fluid||this.cut.capsOn);this.ship.position.y=e.sep,this.cut.amount=e.cut,this.cut.update();let a=this.cut.capsOn;for(let e of this.fluids)e.userData.spans||(e.visible=a);for(let e of[this.bEng,this.sSL,this.sVac])e.showFluids(a)}},Bt=6371e3,Vt={base:3300,top:5600,cirrus:10500};function Ht(){let e=new Uint8Array(1048576),t=9,n=()=>(t=t*16807%2147483647,t/2147483647);function r(e){let t=new Float32Array(e*e*2);for(let e=0;e<t.length;e++)t[e]=n();let r=new Float32Array(262144);for(let n=0;n<512;n++)for(let i=0;i<512;i++){let a=i/512*e,o=n/512*e,s=Math.floor(a),c=Math.floor(o),l=9;for(let n=-1;n<=1;n++)for(let r=-1;r<=1;r++){let i=s+r,u=c+n,d=(i%e+e)%e,f=(u%e+e)%e,p=i+t[(f*e+d)*2],m=u+t[(f*e+d)*2+1],h=(p-a)**2+(m-o)**2;h<l&&(l=h)}r[n*512+i]=Math.sqrt(Math.max(0,1-l*1.7))}return r}function i(e,t){let r=new Float32Array(262144),i=.5,a=e,o=0;for(let e=0;e<t;e++){let e=new Float32Array(a*a);for(let t=0;t<e.length;t++)e[t]=n();for(let t=0;t<512;t++)for(let n=0;n<512;n++){let o=n/512*a,s=t/512*a,c=Math.floor(o),l=Math.floor(s),u=o-c,d=s-l;u=u*u*(3-2*u),d=d*d*(3-2*d);let f=e[l%a*a+c%a],p=e[l%a*a+(c+1)%a],m=e[(l+1)%a*a+c%a],h=e[(l+1)%a*a+(c+1)%a];r[t*512+n]+=i*(f+(p-f)*u+(m-f)*d+(f-p-m+h)*u*d)}o+=i,i*=.5,a*=2}for(let e=0;e<r.length;e++)r[e]/=o;return r}let a=r(10),o=r(24),s=r(48),c=r(96),l=i(4,5);for(let t=0;t<262144;t++)e[t*4]=Math.round(a[t]*255),e[t*4+1]=Math.round((o[t]*.65+s[t]*.35)*255),e[t*4+2]=Math.round(l[t]*255),e[t*4+3]=Math.round(c[t]*255);let u=new _(e,512,512,ve);return u.wrapS=u.wrapT=se,u.magFilter=ye,u.minFilter=m,u.generateMipmaps=!0,u.anisotropy=4,u.needsUpdate=!0,u}var Ut=`
varying vec2 vUv;
uniform vec3 uSun; uniform float uAlt;
const float Re = 6360e3, Ra = 6460e3, Hr = 8000.0, Hm = 1200.0;
const vec3 bR = vec3(5.8e-6, 13.5e-6, 33.1e-6);
const float bM = 21e-6;
vec2 sphere(vec3 o, vec3 d, float r){ float b = dot(o, d), c = dot(o, o) - r * r, h = b * b - c; if (h < 0.0) return vec2(1e9, -1e9); h = sqrt(h); return vec2(-b - h, -b + h); }
vec3 scatter(vec3 dir){
  vec3 o = vec3(0.0, Re + uAlt, 0.0);
  vec2 t = sphere(o, dir, Ra);
  float tmax = t.y;
  vec2 g = sphere(o, dir, Re);
  if (g.x > 0.0) tmax = min(tmax, g.x);
  const int N = 24, M = 8;
  float ds = tmax / float(N), odR = 0.0, odM = 0.0;
  vec3 sR = vec3(0.0), sM = vec3(0.0);
  float mu = dot(dir, uSun);
  float pR = 3.0 / (16.0 * 3.14159) * (1.0 + mu * mu);
  float gg = 0.76;
  float pM = 3.0 / (8.0 * 3.14159) * ((1.0 - gg * gg) * (1.0 + mu * mu)) / ((2.0 + gg * gg) * pow(1.0 + gg * gg - 2.0 * gg * mu, 1.5));
  for (int i = 0; i < N; i++) {
    vec3 p = o + dir * (ds * (float(i) + 0.5));
    float h = length(p) - Re;
    float hr = exp(-h / Hr) * ds, hm = exp(-h / Hm) * ds;
    odR += hr; odM += hm;
    vec2 tl = sphere(p, uSun, Ra);
    float dl = tl.y / float(M), lR = 0.0, lM = 0.0; bool ok = true;
    for (int j = 0; j < M; j++) { vec3 q = p + uSun * (dl * (float(j) + 0.5)); float hq = length(q) - Re; if (hq < 0.0) { ok = false; break; } lR += exp(-hq / Hr) * dl; lM += exp(-hq / Hm) * dl; }
    if (ok) { vec3 tau = bR * (odR + lR) + bM * 1.1 * (odM + lM); vec3 att = exp(-tau); sR += att * hr; sM += att * hm; }
  }
  return 20.0 * (sR * bR * pR + sM * bM * pM);
}
void main(){
  float phi = (vUv.x - 0.5) * 6.2831853, th = (vUv.y - 0.5) * 3.14159265;
  vec3 d = vec3(cos(th) * cos(phi), sin(th), cos(th) * sin(phi));
  gl_FragColor = vec4(scatter(normalize(d)), 1.0);
}`;function Wt(e,t){let n=[58e-7,135e-7,331e-7],r=21e-6,i=new v(0,636e4+t,0),a=0,o=0,s=6e5;for(let t=0;t<200;t++){let n=i.clone().addScaledVector(e,(t+.5)/200*s).length()-636e4;if(n<0)return new l(0,0,0);a+=Math.exp(-n/8e3)*(s/200),o+=Math.exp(-n/1200)*(s/200)}return new l(Math.exp(-(n[0]*a+r*1.1*o)),Math.exp(-(n[1]*a+r*1.1*o)),Math.exp(-(n[2]*a+r*1.1*o)))}var Gt=`
${Fe}
uniform sampler2D tLut, tCloud;
uniform vec3 uSunDir, uSunCol;
uniform float uAlt, uTime, uSteps, uSunSize;
uniform vec2 uOff;
const float RE = ${Bt.toFixed(1)};
const float CB = ${Vt.base.toFixed(1)}, CT = ${Vt.top.toFixed(1)}, CI = ${Vt.cirrus.toFixed(1)};

vec3 lut(vec3 d){ float phi = atan(d.z, d.x), th = asin(clamp(d.y, -1.0, 1.0)); return texture2D(tLut, vec2(phi / 6.2831853 + 0.5, th / 3.14159265 + 0.5)).rgb; }

// altitude of a point (vehicle frame, the camera sits at uAlt + o.y) with the Earth curving away
float altAt(vec3 p){ return p.y + uAlt + dot(p.xz, p.xz) / (2.0 * RE); }
// first t >= 0 where altAt(o + t d) = L, or -1
float hitLayer(vec3 o, vec3 d, float L, bool second){
  float a = dot(d.xz, d.xz) / (2.0 * RE);
  float b = d.y + dot(o.xz, d.xz) / RE;
  float c = altAt(o) - L;
  if (a < 1e-12) { float t = -c / b; return t > 0.0 ? t : -1.0; }
  float disc = b * b - 4.0 * a * c;
  if (disc < 0.0) return -1.0;
  float s = sqrt(disc);
  // stable roots
  float q = -0.5 * (b + sign(b) * s);
  float t1 = q / a, t2 = c / q;
  float tn = min(t1, t2), tf = max(t1, t2);
  if (second) return tf > 0.0 ? tf : -1.0;
  return tn > 0.0 ? tn : (tf > 0.0 ? tf : -1.0);
}

// cumulus: a height field of billows over a slowly varying coverage
float coverage(vec2 xz){
  vec2 uv = (xz + uOff) / 90000.0;
  float c = texture2D(tCloud, uv).b;
  float c2 = texture2D(tCloud, uv * 3.3 + 0.37).b;
  return smoothstep(0.28, 0.72, c * 0.7 + c2 * 0.3);
}
float gCov = 0.75;
float topAt(vec2 xz, float lod){
  vec2 uv = (xz + uOff) / 26000.0;
  // warp the billows by the slow coverage field so the tile never repeats visibly from high up
  uv += (texture2D(tCloud, uv * 0.11 + 0.17).bb - 0.5) * vec2(0.9, -0.7);
  float w1 = texture2D(tCloud, uv).r;
  float w2 = texture2D(tCloud, uv * 2.3 + 0.21).g;
  float w3 = lod < 0.5 ? texture2D(tCloud, uv * 7.1 + 0.53).a : 0.5;
  float sh = w1 * 0.6 + w2 * 0.28 + w3 * 0.12;
  float cov = gCov;
  float h = clamp((sh - (1.0 - cov) * 0.9) / max(cov * 0.9, 0.05), 0.0, 1.0);
  return CB + 300.0 + pow(h, 0.75) * (CT - CB - 300.0) - (1.0 - step(0.001, h)) * 900.0;
}
float density(vec3 p, float lod){
  float a = altAt(p);
  if (a > CT + 80.0 || a < CB) return 0.0;
  float top = topAt(p.xz, lod);
  float d = (top - a) / 260.0;
  if (d < -0.5) return 0.0;
  // cauliflower: 3D noise rounds and eats the surface a little
  if (lod < 0.5) {
    vec3 q = p + vec3(uOff.x, -uTime * 2.0, uOff.y);
    float n = n3(q * vec3(1.0 / 1300.0, 1.0 / 900.0, 1.0 / 1300.0)) * 0.7 + n3(q * (1.0 / 420.0) + 0.37) * 0.3;
    d += (n - 0.5) * 0.7;
  }
  return clamp(d, 0.0, 1.0) * 0.012 * smoothstep(CB, CB + 500.0, a);
}
float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }

vec3 ocean(vec3 o, vec3 d, float t){
  vec3 p = o + d * t;
  // long swell, small glints, a sun path on the water
  vec3 n = normalize(vec3((n3(vec3((p.xz + uOff) / 3000.0, uTime * 0.01)) - 0.5) * 0.08, 1.0, (n3(vec3((p.zx + uOff) / 2600.0, 3.0)) - 0.5) * 0.08));
  vec3 r = reflect(d, n);
  float fres = 0.02 + 0.98 * pow(1.0 - max(dot(-d, n), 0.0), 5.0);
  vec3 sky = lut(vec3(r.x, abs(r.y), r.z));
  vec3 deep = vec3(0.004, 0.018, 0.03);
  float spec = pow(max(dot(r, uSunDir), 0.0), 900.0) * 60.0 + pow(max(dot(r, uSunDir), 0.0), 60.0) * 0.6;
  return mix(deep, sky, fres) + uSunCol * spec * fres;
}

// the whole world in one direction: sky, sun, cirrus, cumulus, sea; with haze over distance
vec3 world(vec3 o, vec3 d, float jitter, bool env){
  vec3 sky = lut(d);
  float cs = dot(d, uSunDir);
  vec3 col = sky;
  float tGround = hitLayer(o, d, 0.0, false);
  bool ground = tGround > 0.0;
  if (!ground) {
    // the sun: limb darkened disc and its aureole
    float sd = acos(clamp(cs, -1.0, 1.0));
    float disc = smoothstep(uSunSize, uSunSize * 0.92, sd);
    float limb = sqrt(max(0.0, 1.0 - pow(sd / uSunSize, 2.0)));
    col += uSunCol * disc * (0.4 + 0.6 * limb) * 9000.0 * (env ? 0.0 : 1.0);
    col += uSunCol * exp(-sd * 90.0) * 2.5;
  }
  // cirrus veil above the cumulus: thin, fibrous, bright
  {
    float tc = hitLayer(o, d, CI, false);
    if (tc > 0.0 && (!ground || tc < tGround)) {
      vec3 p = o + d * tc;
      vec2 q = (p.xz + uOff * 0.6 + vec2(uTime * 6.0, 0.0));
      vec2 w = vec2(texture2D(tCloud, q / 60000.0).b, texture2D(tCloud, q / 60000.0 + 0.5).b) - 0.5;
      q += w * 9000.0;
      float c = texture2D(tCloud, q / vec2(90000.0, 9000.0)).b * 0.6 + texture2D(tCloud, q / vec2(30000.0, 3000.0) + 0.3).b * 0.4;
      c = smoothstep(0.52, 0.78, c) * smoothstep(0.35, 0.65, texture2D(tCloud, q / 140000.0).b) * 0.42;
      float fade = exp(-tc / 260000.0);
      vec3 cc = uSunCol * (hg(cs, 0.7) * 7.0 + 1.6) + lut(vec3(0.0, 1.0, 0.0)) * 1.2;
      col = mix(col, cc, c * fade);
    }
  }
  // cumulus deck
  float t0, t1;
  float camA = altAt(o);
  if (camA > CT) { t0 = hitLayer(o, d, CT + 80.0, false); t1 = t0 < 0.0 ? -1.0 : hitLayer(o, d, CB, false); if (t1 < 0.0 && t0 > 0.0) t1 = hitLayer(o, d, CT + 80.0, true); }
  else { t0 = 0.0; t1 = hitLayer(o, d, CT + 80.0, false); }
  vec3 base = ground ? ocean(o, d, tGround) : col;
  if (ground) {
    float hz = 1.0 - exp(-tGround / mix(60000.0, 260000.0, smoothstep(5000.0, 60000.0, uAlt)));
    base = mix(base, sky, hz);
  }
  vec3 acc = vec3(0.0);
  float T = 1.0;
  if (t0 > 0.0 && t1 > t0) {
    float lod = t0 > 60000.0 ? 1.0 : 0.0;
    gCov = mix(0.55, 0.95, coverage((o + d * t0).xz));
    float len = min(t1 - t0, 9000.0);
    int n = int(uSteps);
    float dt = len / float(n);
    float t = t0 + dt * jitter;
    vec3 amb = lut(vec3(0.0, 1.0, 0.0)) * 1.1 + lut(normalize(vec3(-uSunDir.x, 0.15, -uSunDir.z))) * 0.35;
    // from high up the LUT holds a black sky; the clouds still sit under a blue one
    amb = mix(amb, vec3(0.32, 0.5, 0.95), smoothstep(12000.0, 35000.0, uAlt));
    float ph = mix(hg(cs, 0.72), hg(cs, -0.2), 0.45);
    for (int i = 0; i < 64; i++) {
      if (i >= n || T < 0.04) break;
      vec3 p = o + d * t;
      float den = density(p, lod);
      if (den > 0.0) {
        // shadow: march toward the sun through the height field
        float od = 0.0;
        for (int j = 1; j <= 3; j++) {
          vec3 q = p + uSunDir * (float(j * j) * 190.0);
          od += density(q, 1.0) * float(j * 2 - 1) * 190.0;
        }
        float sh = exp(-od * 1.1) * 0.75 + exp(-od * 0.25) * 0.25;
        float a = altAt(p);
        float hf = smoothstep(CB, CT, a);
        float powder = 1.0 - exp(-den * 2.0 * 260.0);
        vec3 L = uSunCol * sh * (ph * 6.0 * mix(0.6, 1.0, powder) + 0.55) * 3.2 + amb * (0.25 + 0.75 * hf);
        float ext = den * dt;
        float tr = exp(-ext);
        acc += T * L * (1.0 - tr);
        T *= tr;
      }
      t += dt;
    }
    // distance haze on the clouds
    float hz = 1.0 - exp(-t0 / mix(70000.0, 300000.0, smoothstep(5000.0, 60000.0, uAlt)));
    vec3 hzc = lut(normalize(vec3(d.x, max(d.y, -0.02), d.z)));
    acc = mix(acc, hzc * (1.0 - T), hz);
  }
  return acc + base * T;
}
`,Kt=`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,qt=class{constructor(e){t(this,`renderer`,void 0),t(this,`lutRT`,new r(256,128,{type:w,wrapS:se})),t(this,`cloudTex`,Ht()),t(this,`sun`,new v(.6,.12,-.8).normalize()),t(this,`sunCol`,new l(1,1,1)),t(this,`alt`,7e3),t(this,`off`,new c),t(this,`lutMat`,new je({uniforms:{uSun:{value:new v},uAlt:{value:0}},vertexShader:Kt,fragmentShader:Ut,depthTest:!1,depthWrite:!1})),t(this,`lutScene`,new ke),t(this,`ortho`,new he(-1,1,1,-1,0,1)),t(this,`lastLut`,{alt:-1,sun:new v}),t(this,`u`,{tLut:{value:this.lutRT.texture},tCloud:{value:this.cloudTex},uSunDir:{value:this.sun},uSunCol:{value:new v},uAlt:{value:7e3},uTime:{value:0},uSteps:{value:56},uSunSize:{value:.0058},uOff:{value:this.off},uNoise3D:Pe}),t(this,`rt`,new r(4,4,{type:w})),t(this,`screenMat`,void 0),t(this,`screen`,new ke),t(this,`invVP`,{value:new E}),t(this,`studio`,{value:0}),t(this,`skyScale`,{value:1}),t(this,`camPos`,{value:new v}),t(this,`back`,new ke),t(this,`envScene`,new ke),t(this,`pmrem`,void 0),t(this,`envRT`,null),t(this,`lastEnv`,{alt:-1e9,sun:new v,off:new c(1e9,0)}),this.renderer=e;let n=new O(new _e(2,2),this.lutMat);n.frustumCulled=!1,this.lutScene.add(n),this.screenMat=new je({uniforms:{...this.u,uInvVP:this.invVP,uCam:this.camPos},vertexShader:Kt,fragmentShader:`
        ${Gt}
        uniform mat4 uInvVP; uniform vec3 uCam;
        varying vec2 vUv;
        void main(){
          vec4 w = uInvVP * vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
          vec3 d = normalize(w.xyz / w.w - uCam);
          float j = ign(gl_FragCoord.xy);
          gl_FragColor = vec4(world(uCam, d, j, false), 1.0);
        }`,depthTest:!1,depthWrite:!1});let i=new O(new _e(2,2),this.screenMat);i.frustumCulled=!1,this.screen.add(i);let a=new je({uniforms:{tSky:{value:this.rt.texture},uTexel:{value:new c(1,1)},uStudio:this.studio,uSkyScale:this.skyScale},vertexShader:Kt,fragmentShader:`uniform sampler2D tSky; uniform vec2 uTexel; uniform float uStudio, uSkyScale; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tSky, vUv).rgb * 0.36;
          c += texture2D(tSky, vUv + vec2(uTexel.x, 0.0)).rgb * 0.12; c += texture2D(tSky, vUv - vec2(uTexel.x, 0.0)).rgb * 0.12;
          c += texture2D(tSky, vUv + vec2(0.0, uTexel.y)).rgb * 0.12; c += texture2D(tSky, vUv - vec2(0.0, uTexel.y)).rgb * 0.12;
          c += texture2D(tSky, vUv + uTexel).rgb * 0.04; c += texture2D(tSky, vUv - uTexel).rgb * 0.04;
          c += texture2D(tSky, vUv + vec2(uTexel.x, -uTexel.y)).rgb * 0.04; c += texture2D(tSky, vUv + vec2(-uTexel.x, uTexel.y)).rgb * 0.04;
          // the clean studio behind the cutaway: deep blue, lighter in the middle, like the engine exhibit
          vec2 q = vUv - vec2(0.55, 0.5);
          float g = exp(-dot(q * vec2(1.3, 1.0), q * vec2(1.3, 1.0)) * 3.2);
          vec3 studio = mix(vec3(0.006, 0.009, 0.02), vec3(0.03, 0.05, 0.1), g) + vec3(0.02, 0.025, 0.05) * smoothstep(0.35, 0.0, vUv.y) * 0.6;
          gl_FragColor = vec4(mix(c * uSkyScale, studio, uStudio), 1.0);
        }`,depthTest:!1,depthWrite:!1}),o=new O(new _e(2,2),a);o.frustumCulled=!1,o.renderOrder=-100,this.back.add(o);let s=new je({uniforms:{...this.u,uSteps:{value:16}},vertexShader:`varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`${Gt}
        varying vec3 vD;
        void main(){ vec3 c = world(vec3(0.0), normalize(vD), 0.5, true); if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0); gl_FragColor = vec4(min(c, vec3(24.0)), 1.0); }`,side:1,depthWrite:!1});this.envScene.add(new O(new S(10,64,32),s)),this.pmrem=new oe(e)}setSun(e){this.sun.copy(e).normalize()}resize(e,t){let n=Math.max(2,Math.round(e*.5)),r=Math.max(2,Math.round(t*.5));this.rt.setSize(n,r),this.back.children[0].material.uniforms.uTexel.value.set(.8/n,.8/r)}update(e,t,n){this.alt=t;let r=this.renderer;this.u.uAlt.value=t,this.u.uTime.value=n;let i=Wt(this.sun,Math.max(0,t));if(this.sunCol.copy(i),this.u.uSunCol.value.set(i.r,i.g,i.b).multiplyScalar(1),Math.abs(this.lastLut.alt-t)>60||this.lastLut.sun.distanceToSquared(this.sun)>1e-7){this.lastLut.alt=t,this.lastLut.sun.copy(this.sun),this.lutMat.uniforms.uSun.value.copy(this.sun),this.lutMat.uniforms.uAlt.value=t;let e=r.getRenderTarget();r.setRenderTarget(this.lutRT),r.render(this.lutScene,this.ortho),r.setRenderTarget(e)}if(e.updateMatrixWorld(),this.studio.value>.999)return;this.invVP.value.copy(e.projectionMatrix).invert().premultiply(e.matrixWorld),this.camPos.value.copy(e.position);let a=r.getRenderTarget();r.setRenderTarget(this.rt),r.render(this.screen,this.ortho),r.setRenderTarget(a)}env(e=!1){let t=Math.abs(this.lastEnv.alt-this.alt)>Math.max(200,this.alt*.04)||this.lastEnv.sun.distanceToSquared(this.sun)>1e-5||this.lastEnv.off.distanceTo(this.off)>3e3;if(!e&&!t&&this.envRT)return null;this.lastEnv.alt=this.alt,this.lastEnv.sun.copy(this.sun),this.lastEnv.off.copy(this.off);let n=this.envRT;return this.envRT=this.pmrem.fromScene(this.envScene,0,.1,100),n?.dispose(),this.envRT.texture}},Jt=`
varying vec3 vL;
void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`,Yt=`
precision highp float;
${Fe}
varying vec3 vL;
uniform vec3 uCamL;
uniform vec4 uRings[3];
uniform vec3 uRingOn;
uniform float uLen, uRmax, uRcl, uExp, uCell, uStr, uHot, uSpread, uAfter, uVac, uInt, uTime, uSteps, uShock;

vec3 ramp(float T){
  vec3 c0 = vec3(0.6, 0.1, 0.01), c1 = vec3(1.0, 0.3, 0.03), c2 = vec3(1.0, 0.48, 0.08), c3 = vec3(1.0, 0.72, 0.3), c4 = vec3(1.0, 0.93, 0.8);
  if (T < 0.25) return mix(c0, c1, T / 0.25);
  if (T < 0.5) return mix(c1, c2, (T - 0.25) / 0.25);
  if (T < 0.78) return mix(c2, c3, (T - 0.5) / 0.28);
  return mix(c3, c4, (T - 0.78) / 0.22);
}

// one Raptor's jet, in exit radius units: X downstream, R from its axis
vec3 jet(float X, float R, float tu){
  float L = uCell;
  float b = uExp * (1.0 - 0.35 * exp(-X / 1.6)) + 0.35 * exp(-X / 1.6) * 1.0;
  float A = (uExp - 1.0) * 0.4 + 0.04;
  float bb = max(0.35, (b - A * cos(6.2831853 * X / L) * exp(-X / (2.4 * L))) * (1.0 + 0.02 * X));
  float inside = smoothstep(bb * 1.06, bb * 0.84, R);
  float k0 = floor(X / L - 0.55 + 0.5);
  float xk = (k0 + 0.55) * L;
  float strk = uStr * exp(-max(k0, 0.0) * 0.62) * step(-0.5, k0);
  float dx = (X - xk) / (0.15 * L);
  float bd = min(bb, 1.3);
  float spindle = exp(-dx * dx) * exp(-pow(R / (0.24 * bd * (1.0 - 0.3 * dx * dx)), 2.0));
  float disk = exp(-dx * dx * 6.0) * exp(-pow(R / (0.12 * bd), 2.0));
  float ph = fract(X / L);
  float rs = bb * abs(1.0 - 2.0 * ph);
  float sheet = exp(-pow((R - rs) / (0.1 * bb), 2.0)) * inside * exp(-X / (2.6 * L));
  vec3 e = vec3(0.0);
  e += vec3(1.0, 0.9, 0.86) * disk * strk * 22.0;
  e += vec3(1.0, 0.62, 0.7) * spindle * strk * 6.0;
  e += vec3(0.75, 0.5, 1.0) * sheet * 0.18 * uShock;
  // the violet body of the jet, brightest right out of the bell
  e += vec3(0.55, 0.4, 1.0) * inside * (0.03 + 0.25 * exp(-X / 1.4)) * (0.75 + 0.5 * tu);
  e += vec3(0.85, 0.7, 1.0) * exp(-X / 0.3) * exp(-pow(R / 0.97, 8.0)) * 2.0;
  // the hot core of each jet: a pink white flame a few exit diameters long, visible from far away
  e += vec3(1.0, 0.74, 0.86) * exp(-pow(R / (0.55 * bb), 2.0)) * exp(-X / 7.0) * smoothstep(0.0, 0.6, X) * 1.6;
  return e / max(1.0, bb * bb * 0.7);
}

vec3 emit(vec3 p, out float ext){
  float x = p.y;
  vec2 q = vec2(p.x, -p.z);
  float r = length(q);
  float ang = atan(q.y, q.x);
  float tu = n3(vec3(x * 0.035 - uTime * 0.9, p.x * 0.06, p.z * 0.06));
  float tu2 = n3(vec3(x * 0.11 - uTime * 2.6, p.x * 0.2 + 3.1, p.z * 0.2 + 1.7));
  float turb = tu * 0.6 + tu2 * 0.4;
  vec3 e = vec3(0.0);
  ext = 0.0;

  // ---------- near field: each engine's own jet ----------
  float wJ = exp(-x / (7.0 + 9.0 * uVac));
  if (wJ > 0.01) {
    for (int k = 0; k < 3; k++) {
      vec4 Rg = uRings[k];
      float on = uRingOn[k];
      if (Rg.x < 0.5 || on < 0.01) continue;
      float st = 6.2831853 / Rg.x;
      float idx = floor((ang - Rg.z) / st + 0.5);
      float a = Rg.z + idx * st;
      vec2 c = vec2(cos(a), sin(a)) * Rg.y;
      float d = length(q - c);
      // the neighbour on the other side too, where jets overlap
      float a2 = a + (mod(ang - a + 3.14159, 6.28318) - 3.14159 > 0.0 ? st : -st);
      float d2 = length(q - vec2(cos(a2), sin(a2)) * Rg.y);
      float re = Rg.w;
      e += jet(x / re, d / re, tu2) * on * wJ / re;
      #ifdef NEIGHBOURS
      e += jet(x / re, d2 / re, tu2) * on * wJ / re * step(0.5, Rg.x - 1.5);
      #endif
    }
  }

  // ---------- the merged column ----------
  float Rc = uRcl * (1.0 + uSpread * x) + 0.5;
  float merge = smoothstep(0.0, 6.0 + 10.0 * uVac, x);
  float u = r / Rc;
  // big eddies and fine streaks, both carried downstream
  float nb = n3(vec3(x * 0.011 - uTime * 1.1, p.x * 0.035 + 0.3, p.z * 0.035));
  float ns = n3(vec3(x * 0.026 - uTime * 2.7, p.x * 0.16 + 1.7, p.z * 0.16 + 0.4));
  float nf = n3(vec3(x * 0.07 - uTime * 6.0, p.x * 0.5, p.z * 0.5 + 2.2));
  float Tf = exp(-x / uHot);
  float Te = clamp(Tf * (1.1 - 0.5 * u * u) + (nb - 0.5) * 0.36 + (ns - 0.5) * 0.16, 0.0, 1.0);
  float edge = Rc * (1.0 + (nb - 0.5) * 0.9 + (ns - 0.5) * 0.4) * smoothstep(-2.0, 8.0, x);
  // lumpy, patchy luminosity: hot pockets and cooler gaps
  float pockets = smoothstep(0.25, 0.75, nb * 0.55 + ns * 0.3 + nf * 0.15);
  float body = smoothstep(edge * 1.05, edge * 0.5, r) * (0.35 + 0.9 * pockets + 0.2 * nf);
  float fadeEnd = exp(-max(x - uLen * 0.6, 0.0) / (uLen * 0.3));
  float I = (0.05 + 0.5 * Te * Te + 2.6 * Te * Te * Te * Te) * body * merge * fadeEnd;
  e += ramp(Te) * I * (1.0 - uVac * 0.85);
  // afterburning: tongues of orange flame on the outside, where hot fuel rich gas meets air
  float tongue = smoothstep(0.42, 0.9, nb * 0.6 + ns * 0.4);
  float mantle = exp(-pow((r / edge - 1.0) / 0.22, 2.0)) * smoothstep(5.0, 25.0, x) * exp(-x / (uLen * 0.5));
  e += vec3(1.0, 0.36, 0.08) * mantle * tongue * uAfter * 1.2;
  // base glow where the outer jets turn in
  e += vec3(1.0, 0.6, 0.38) * exp(-x / 1.8) * exp(-pow(r / (uRcl + 0.4), 8.0)) * 0.5 * (1.0 - uVac);

  // ---------- thin air: a wide faint violet cloud ----------
  float bv = uRcl + 1.0 + x * 0.55;
  vec3 ev = vec3(0.5, 0.38, 1.0) * exp(-pow(r / bv, 2.0) * 1.6) * exp(-x / 70.0) / (bv * 0.12) * (0.7 + 0.6 * turb) * 0.3;
  ev += vec3(0.6, 0.45, 1.0) * exp(-pow((r - bv * 0.8) / (0.2 * bv), 2.0)) * exp(-x / 60.0) * (0.6 + 0.6 * tu2) * 0.35;
  e += ev * uVac * 0.06;

  ext = body * merge * (0.001 + 0.006 * (1.0 - Te)) * fadeEnd * (1.0 - uVac);
  return e;
}

void main(){
  vec3 ro = uCamL;
  vec3 rd = normalize(vL - uCamL);
  // bounding cylinder around +y, y in [0, uLen * 1.25]
  float yMax = uLen * 1.25;
  float a = dot(rd.xz, rd.xz);
  float b = 2.0 * dot(ro.xz, rd.xz);
  float c = dot(ro.xz, ro.xz) - uRmax * uRmax;
  float disc = b * b - 4.0 * a * c;
  if (disc <= 0.0 || a < 1e-9) discard;
  float sq = sqrt(disc);
  float t0 = (-b - sq) / (2.0 * a), t1 = (-b + sq) / (2.0 * a);
  float ty0 = (0.0 - ro.y) / rd.y, ty1 = (yMax - ro.y) / rd.y;
  if (ty0 > ty1) { float tt = ty0; ty0 = ty1; ty1 = tt; }
  t0 = max(max(t0, ty0), 0.0);
  t1 = min(min(t1, ty1), length(vL - uCamL) + 0.01);
  if (t1 <= t0) discard;
  // two segments: the first 20 m below the nozzles get most of the samples
  float tn = (20.0 - ro.y) / rd.y;
  float jit = ign(gl_FragCoord.xy + fract(uTime * 7.13) * 64.0);
  vec3 acc = vec3(0.0);
  float Tr = 1.0;
  for (int s = 0; s < 2; s++) {
    float a0 = t0, a1 = t1;
    bool nearFirst = rd.y > 0.0 ? ro.y < 20.0 : ro.y > 20.0;
    bool nearSeg = (s == 0) == nearFirst;
    // near segment is where y < 20
    if (rd.y > 0.0) { if (nearSeg) a1 = min(t1, tn); else a0 = max(t0, tn); }
    else { if (nearSeg) a0 = max(t0, tn); else a1 = min(t1, tn); }
    if (a1 <= a0) continue;
    float n = nearSeg ? uSteps : uSteps * 0.7;
    float dt = (a1 - a0) / n;
    for (int i = 0; i < 72; i++) {
      if (float(i) >= n) break;
      vec3 p = ro + rd * (a0 + (float(i) + jit) * dt);
      float rr = length(p.xz);
      if (rr > uRcl * (1.3 + uSpread * p.y * 1.4) + 3.0 + uVac * (2.0 + p.y * 0.6)) continue;
      float ex;
      vec3 e = emit(p, ex) * smoothstep(uRmax, uRmax * 0.6, rr);
      acc += Tr * e * dt;
      Tr *= exp(-ex * dt);
    }
  }
  float flick = 0.94 + 0.06 * n3(vec3(uTime * 3.1, 0.2, 0.7)) + 0.03 * sin(uTime * 47.0);
  gl_FragColor = vec4(acc * uInt * flick, 1.0 - Tr);
}
`,Xt=class{constructor(e,r,i){t(this,`clusterR`,void 0),t(this,`lightParent`,void 0),t(this,`mesh`,void 0),t(this,`mat`,void 0),t(this,`lights`,[]),t(this,`s`,{exp:1.3,cell:3.2,str:.8,hot:40,spread:.03,after:1,vac:0,int:1,len:140}),this.clusterR=r,this.lightParent=i;let a=new n(r+8,70,325,48,1,!1);a.translate(0,325/2,0);let o=e.map(e=>new fe(e.count,e.radius,e.phase,e.re));for(;o.length<3;)o.push(new fe(0,0,0,1));this.mat=new je({vertexShader:Jt,fragmentShader:Yt,uniforms:{uCamL:{value:new v},uRings:{value:o},uRingOn:{value:new v(1,1,1)},uLen:{value:140},uRmax:{value:70},uRcl:{value:r},uExp:{value:1.3},uCell:{value:3.2},uStr:{value:.8},uHot:{value:40},uSpread:{value:.03},uAfter:{value:1},uVac:{value:0},uInt:{value:1},uTime:{value:0},uSteps:{value:44},uShock:{value:1},uNoise3D:Pe},side:1,transparent:!0,depthWrite:!1,depthTest:!0,blending:5,blendSrc:201,blendDst:205,blendSrcAlpha:200,blendDstAlpha:201}),this.mesh=new O(a,this.mat),this.mesh.frustumCulled=!1,this.mesh.renderOrder=5,this.mesh.rotation.x=Math.PI;for(let[e,t]of[[16756848,6],[16747072,28]]){let n=new Ce(e,0,160,1.4);n.userData.y=t,i.add(n),this.lights.push(n)}}at(e){this.mesh.position.set(0,e,0);for(let t of this.lights)t.position.set(0,e-t.userData.y,0)}update(e,t,n,r,i,a,o){let s=94e3*Math.max(r,.3),c=Math.min(Math.max(s/Math.max(n,1),.3),1e5),l=D.smoothstep(Math.log10(c),1.1,2.6),u=D.clamp(c**.3,.8,3.2),d=this.s,f=1-Math.exp(-e*3),p={exp:u,cell:3*u**.85,str:(.55+1*Math.min(Math.abs(Math.log(c)),1.5))*(1-l),hot:38+30*(1-Math.min(1,n/101325))*(1-l),spread:.022+.05*Math.min(1,Math.log10(c+1)/2),after:Math.min(1,n/4e4)*(1-l),vac:l,int:i*(.45+.55*r),len:110+80*(1-Math.min(1,n/101325))};for(let e of Object.keys(p))d[e]+=(p[e]-d[e])*f;let m=this.mat.uniforms;m.uExp.value=d.exp,m.uCell.value=d.cell,m.uStr.value=d.str,m.uHot.value=d.hot,m.uSpread.value=d.spread,m.uAfter.value=d.after,m.uVac.value=d.vac,m.uInt.value=d.int,m.uLen.value=d.len,m.uTime.value=t,m.uRingOn.value.set(...a),this.mesh.visible=d.int>.01,this.mesh.updateMatrixWorld();let h=this.mesh.matrixWorld.clone().invert();m.uCamL.value.copy(o.position).applyMatrix4(h);let g=.9+.1*Math.sin(t*29)*Math.sin(t*13.7);this.lights[0].intensity=700*d.int*g*(1-d.vac*.5),this.lights[1].intensity=500*d.int*g*(1-d.vac*.7)}};M.Re;var Zt=class{constructor(){t(this,`mesh`,void 0),t(this,`u`,{uCamL:{value:new v},uTime:{value:0},uSun:{value:new v},uSunCol:{value:new v(1,1,1)},uSky:{value:new v(.3,.45,.8)},uAlt:{value:7e3},uOn:{value:1},uGlow:{value:1},uY0:{value:90},uLen:{value:3200},uM:{value:new E},uWidth:{value:1},uNoise3D:Pe});let e=new n(150,14,3200,40,1,!1);e.translate(0,-1600,0),this.mesh=new O(e,new je({uniforms:this.u,vertexShader:`varying vec3 vL; void main(){ vL = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,fragmentShader:`
        precision highp float;
        ${Fe}
        varying vec3 vL;
        uniform vec3 uCamL, uSun, uSunCol, uSky; uniform float uTime, uAlt, uOn, uGlow, uY0, uLen, uWidth; uniform mat4 uM;
        float W(float s){ return (10.0 + s * 0.045 + 18.0 * smoothstep(0.0, 600.0, s)) * uWidth; }
        float dens(vec3 p, out float s){
          s = -p.y - uY0;
          if (s < 0.0) return 0.0;
          float r = length(p.xz) / W(s);
          if (r > 1.6) return 0.0;
          float n = n3(vec3(p.x / 38.0, (p.y + uTime * 18.0) / 70.0, p.z / 38.0)) * 0.65 + n3(vec3(p.x / 11.0, (p.y + uTime * 30.0) / 18.0, p.z / 11.0)) * 0.35;
          float d = exp(-r * r * 2.2) * smoothstep(0.25, 0.75, n + 0.25 - r * 0.3);
          // it thins out as it spreads and drifts
          d *= smoothstep(0.0, 60.0, s) * exp(-s / 2600.0);
          // it disappears into the cloud deck below
          float a = uAlt + (uM * vec4(p, 1.0)).y;
          d *= smoothstep(${Vt.top.toFixed(1)} - 200.0, ${Vt.top.toFixed(1)} + 400.0, a);
          return d;
        }
        float hg(float c, float g){ float g2 = g * g; return (1.0 - g2) / (4.0 * 3.14159 * pow(1.0 + g2 - 2.0 * g * c, 1.5)); }
        void main(){
          vec3 ro = uCamL, rd = normalize(vL - uCamL);
          float tEnd = length(vL - uCamL);
          // start where the ray enters the bounding cylinder (or at the camera)
          float a = dot(rd.xz, rd.xz), b = 2.0 * dot(ro.xz, rd.xz), c = dot(ro.xz, ro.xz) - 150.0 * 150.0;
          float disc = b * b - 4.0 * a * c;
          float t0 = 0.0;
          if (disc > 0.0 && a > 1e-9) t0 = max(0.0, (-b - sqrt(disc)) / (2.0 * a));
          float ty = (-uY0 - ro.y) / rd.y;
          if (ro.y > -uY0 && ty > 0.0) t0 = max(t0, ty);
          if (tEnd <= t0) discard;
          const int N = 18;
          float dt = (tEnd - t0) / float(N);
          float jit = ign(gl_FragCoord.xy + fract(uTime * 5.3) * 40.0);
          vec3 sunL = normalize((inverse(uM) * vec4(uSun, 0.0)).xyz);
          float ph = hg(dot(rd, sunL), 0.6) * 5.0 + 0.3;
          vec3 acc = vec3(0.0); float T = 1.0;
          for (int i = 0; i < N; i++) {
            vec3 p = ro + rd * (t0 + (float(i) + jit) * dt);
            float s;
            float d = dens(p, s) * 0.012;
            if (d <= 0.0) continue;
            vec3 L = uSunCol * ph * 2.4 + uSky * 1.4;
            // lit from inside by the plume near the top
            L += vec3(1.0, 0.5, 0.2) * uGlow * 30.0 * exp(-s / 70.0);
            float e = exp(-d * dt);
            acc += T * L * (1.0 - e);
            T *= e;
            if (T < 0.03) break;
          }
          gl_FragColor = vec4(acc * uOn, (1.0 - T) * uOn);
        }`,side:1,transparent:!0,depthWrite:!1,blending:5,blendSrc:201,blendDst:205})),this.mesh.frustumCulled=!1,this.mesh.renderOrder=3}update(e,t,n,r,i,a,o,s,c){this.mesh.updateMatrixWorld(),this.u.uM.value.copy(this.mesh.matrixWorld),this.u.uCamL.value.copy(t.position).applyMatrix4(this.mesh.matrixWorld.clone().invert()),this.u.uTime.value=e,this.u.uSun.value.copy(n),this.u.uSunCol.value.set(r.r,r.g,r.b),this.u.uSky.value.copy(i),this.u.uAlt.value=a,this.u.uOn.value=o,this.u.uY0.value=s,this.u.uWidth.value=c,this.mesh.visible=o>.01}},Qt=class{constructor(e){t(this,`group`,new i),t(this,`u`,{uTime:{value:0},uK:{value:0},uSun:{value:new v},uSunCol:{value:new v(1,1,1)},uSky:{value:new v(.3,.45,.8)},uNoise3D:Pe});let n=new je({uniforms:this.u,vertexShader:`varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec2 vUv; void main(){ vO = position; vUv = uv; vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,fragmentShader:`
        ${Fe}
        varying vec3 vO; varying vec3 vW; varying vec3 vN; varying vec2 vUv;
        uniform float uTime, uK; uniform vec3 uSun, uSunCol, uSky;
        void main(){
          float a = atan(vO.z, vO.x);
          // vUv.y runs along the collar: 1 at the shoulder where it forms, 0 at the tail
          float v = vUv.y;
          float n = n3(vec3(cos(a) * 1.3, sin(a) * 1.3, v * 2.5 - uTime * 3.0)) * 0.6 + n3(vec3(cos(a) * 4.0 + 3.0, sin(a) * 4.0, v * 7.0 - uTime * 6.0)) * 0.4;
          float d = smoothstep(0.0, 0.25, v) * smoothstep(1.0, 0.85, v) * smoothstep(0.35, 0.75, n + v * 0.25);
          vec3 V = normalize(cameraPosition - vW);
          float edge = pow(1.0 - abs(dot(V, vN)), 1.5);
          float al = d * uK * (0.18 + 0.55 * edge);
          float fw = pow(max(dot(-V, uSun), 0.0), 6.0);
          vec3 c = uSunCol * (1.2 + 5.0 * fw) + uSky * 1.2;
          gl_FragColor = vec4(c * al, al);
        }`,transparent:!0,depthWrite:!1,side:2,blending:5,blendSrc:201,blendDst:205});for(let t of e){let e=[];for(let n=0;n<=24;n++){let r=n/24;e.push(new c(t.r+t.flare*r**.7,t.y-t.len*r))}let r=new f(e,96),i=r.attributes.uv;for(let e=0;e<i.count;e++)i.setY(e,1-i.getY(e));let a=new O(r,n);a.renderOrder=4,a.frustumCulled=!1,this.group.add(a)}}update(e,t,n,r,i){let a=Math.exp(-(((t-1.04)/.11)**2));this.u.uK.value=a,this.u.uTime.value=e,this.u.uSun.value.copy(n),this.u.uSunCol.value.set(r.r,r.g,r.b),this.u.uSky.value.copy(i),this.group.visible=a>.01}},$t=class{constructor(e){t(this,`mesh`,void 0),t(this,`u`,{uTime:{value:0},uK:{value:0},uNoise3D:Pe});let n=new s(1,1,24,12,!0);n.translate(0,-.5,0),n.rotateZ(Math.PI/2);let r=new je({uniforms:this.u,vertexShader:`varying vec3 vO; varying float vI; varying vec3 vN; varying vec3 vW; void main(){ vO = position; vI = float(gl_InstanceID); vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0); vW = w.xyz; vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }`,fragmentShader:`
        ${Fe}
        varying vec3 vO; varying float vI; varying vec3 vN; varying vec3 vW;
        uniform float uTime, uK;
        void main(){
          float x = vO.x; // 0 at the vent, 1 at the tip
          // a cone of gas: thick where we look through its middle, thin at the silhouette
          float r = 1.0 - abs(dot(normalize(vN), normalize(cameraPosition - vW)));
          float n = n3(vec3(x * 1.5 - uTime * 4.0, vO.y * 1.5 + vI * 0.37, vO.z * 1.5));
          float n2 = n3(vec3(x * 4.0 - uTime * 9.0, vO.y * 4.0, vO.z * 4.0 + vI));
          float T = exp(-x * 2.6) * (0.7 + 0.6 * n);
          vec3 c = mix(vec3(1.0, 0.36, 0.1), vec3(1.0, 0.9, 0.7), smoothstep(0.35, 0.9, T));
          c = mix(c, vec3(0.75, 0.55, 1.0), exp(-x * 9.0) * 0.6);
          float a = smoothstep(1.0, 0.2, r) * smoothstep(0.3, 0.7, n * 0.6 + n2 * 0.4 + 0.25 - x * 0.35) * (1.0 - smoothstep(0.6, 1.0, x));
          gl_FragColor = vec4(c * a * uK * (2.0 + 8.0 * T), 1.0);
        }`,transparent:!0,depthWrite:!1,side:2,blending:2});this.mesh=new T(n,r,e.length);let i=new E;e.forEach((e,t)=>{let n=Math.atan2(e.z,e.x);i.compose(e,new ie().setFromEuler(new d(0,-n,-.25)),new v(24,2.6,2.6)),this.mesh.setMatrixAt(t,i)}),this.mesh.frustumCulled=!1,this.mesh.renderOrder=6}update(e,t){this.u.uTime.value=e,this.u.uK.value=t,this.mesh.visible=t>.01}},en=9.80665,tn=6371e3,nn={tfSL:280,ispSL:350,ae:Math.PI*.67*.67,get mdot(){return this.tfSL*1e3/this.ispSL},get fVac(){return this.tfSL*1e3*en+101325*this.ae}};function rn(e){let t=Math.max(0,e)/1e3,n;n=t<11?288.15-6.5*t:t<20?216.65:t<32?216.65+(t-20):t<47?228.65+2.8*(t-32):t<51?270.65:Math.max(186.9,270.65-2.8*(t-51));let r=101325*Math.exp(-t/7.6)*(t<11?1+.06*Math.sin(t/11*Math.PI):1),i=r/(287.05*n),a=Math.sqrt(401.87*n);return{T:n,p:r,rho:i,a}}var an=32e4,on=L.B.lox.mass+L.B.ch4.mass,sn=L.S.lox.mass+L.S.ch4.mass,cn=.085;function ln(e,t,n){let r=.9;return e>36&&e<80&&(r=Math.min(r,.9-.2*Math.sin((e-36)/44*Math.PI))),n>3&&(r=Math.min(r,r*3/n)),Math.max(.4,r)}var un=(()=>{let e=[],t=.05,n=0,r=0,i=0,a=0,o=0,s=on,c=sn,l=0,u=1.6,d=1/0,f=!1;for(let p=0;n<=200+1e-6;p++){let m=Math.hypot(a,o),h=rn(i),g=.5*h.rho*m*m,_=m>1?Math.atan2(a,o):0;l=n<10?0:n<26?(n-10)/16*.105:Math.max(_,.105*Math.exp(-(n-26)/30)+_);let v=33,y=f?0:ln(n,g,u);!f&&s<=on*cn&&(f=!0,d=n),f&&(v=3,y=.5);let b=6e5+s+c,x=Math.max(0,nn.fVac*y-h.p*nn.ae),S=f?0:x*v,C=f?0:nn.mdot*y*v,w=g*(.28+.3*Math.exp(-(((m/h.a-1.15)/.45)**2)))*Math.PI*4.5*4.5,T=tn+i,E=en*(tn/T)**2,D=(S*Math.sin(l)-w*(m>1?a/m:0))/b+a*o/T*0,O=(S*Math.cos(l)-w*(m>1?o/m:0))/b-E+a*a/T;if(u=S/b/en,p%2==0){let t=s/on,d=c/sn;e.push({t:n,h:i,v:m,vx:a,vy:o,x:r,gamma:_,pitch:l,mach:m/h.a,q:g,acc:f?0:u,pa:h.p,thr:f?0:y,engines:f?0:v,mB:an+s,mS:28e4+c,bLox:L.B.lox.mass*t/1e3,bCh4:L.B.ch4.mass*t/1e3,sLox:L.S.lox.mass*d/1e3,sCh4:L.S.ch4.mass*d/1e3})}a+=D*t,o+=O*t,r+=a*t*(tn/T),i+=o*t,s=Math.max(0,s-C*t),n+=t}return e.meco=d,e})(),dn=un.meco;function fn(e){let t=Math.max(0,Math.min(un.length-1.0001,e/.1)),n=Math.floor(t),r=t-n,i=un[n],a=un[n+1],o={};for(let e of Object.keys(i))o[e]=i[e]+(a[e]-i[e])*r;return o.engines=i.engines,o}var pn=e=>{let t=Math.max(0,Math.round(e));return`T+${Math.floor(t/60)}:${String(t%60).padStart(2,`0`)}`},mn=e=>440*2**((e-69)/12),hn={climb:{pad:[38,45,50,57,62,69],arp:[],energy:0,cut:900},cut:{pad:[41,48,53,60,64],arp:[72,76,79,84,79,76,72,67],energy:2,cut:1700},tanks:{pad:[36,43,52,59,64],arp:[67,71,74,79,83,79,74,71],energy:2,cut:2100},engines:{pad:[38,45,50,57,62,69],arp:[74,77,81,86,89,86,81,77],energy:3,cut:3200},explode:{pad:[43,50,55,62,67],arp:[74,0,79,0,83,0,79,0],energy:1,cut:1300},staging:{pad:[36,43,52,60,64,71],arp:[79,81,84,88,91,88,84,81],energy:4,cut:4200},outro:{pad:[41,48,57,64,69,72],arp:[],energy:0,cut:1500}},gn=class{constructor(e){t(this,`ctx`,void 0),t(this,`bus`,void 0),t(this,`wet`,void 0),t(this,`padFilter`,void 0),t(this,`padGain`,void 0),t(this,`padOsc`,[]),t(this,`timeline`,[]),t(this,`seed`,1234567),t(this,`noiseBuf`,void 0),t(this,`shaper`,void 0),t(this,`nextStep`,0),t(this,`bpm`,112),this.ctx=e;let n=e.createDynamicsCompressor();n.threshold.value=-16,n.knee.value=10,n.ratio.value=4,n.attack.value=.004,n.release.value=.25;let r=e.createGain();r.gain.value=.85,n.connect(r).connect(e.destination),this.bus=e.createGain(),this.bus.connect(n);let i=e.createConvolver(),a=e.sampleRate,o=Math.floor(a*3.2),s=e.createBuffer(2,o,a);for(let e=0;e<2;e++){let t=s.getChannelData(e);for(let e=0;e<o;e++)t[e]=(this.rnd()*2-1)*(1-e/o)**3.2*(e<a*.01?e/(a*.01):1)}i.buffer=s,this.wet=e.createGain(),this.wet.gain.value=.42,this.wet.connect(i).connect(n),this.noiseBuf=e.createBuffer(1,a*2,a);let c=this.noiseBuf.getChannelData(0);for(let e=0;e<c.length;e++)c[e]=this.rnd()*2-1;this.shaper=e.createWaveShaper();let l=new Float32Array(1024);for(let e=0;e<1024;e++){let t=e/1023*2-1;l[e]=Math.round(t*5)/5}this.shaper.curve=l,this.shaper.connect(this.bus),this.shaper.connect(this.wet),this.padFilter=e.createBiquadFilter(),this.padFilter.type=`lowpass`,this.padFilter.Q.value=.7,this.padFilter.frequency.value=600,this.padGain=e.createGain(),this.padGain.gain.value=0,this.padFilter.connect(this.padGain),this.padGain.connect(this.bus),this.padGain.connect(this.wet);let u=e.createOscillator();u.frequency.value=.09;let d=e.createGain();d.gain.value=260,u.connect(d).connect(this.padFilter.frequency),u.start(0);for(let t=0;t<12;t++){let n=e.createOscillator();n.type=t%2?`sawtooth`:`triangle`,n.frequency.value=110,n.detune.value=(t%2?1:-1)*(4+t*.7);let r=e.createGain();r.gain.value=.045,n.connect(r).connect(this.padFilter),n.start(0),this.padOsc.push(n)}}rnd(){return this.seed=this.seed*16807%2147483647,this.seed/2147483647}out(e,t=.4){if(e.connect(this.bus),t>0){let n=this.ctx.createGain();n.gain.value=t,e.connect(n).connect(this.wet)}}env(e,t,n,r){let i=this.ctx.createGain();return i.gain.setValueAtTime(0,e),i.gain.linearRampToValueAtTime(r,e+t),i.gain.exponentialRampToValueAtTime(1e-4,e+t+n),i}noise(e,t){let n=this.ctx.createBufferSource();return n.buffer=this.noiseBuf,n.loop=!0,n.start(e,this.rnd()*1.5),n.stop(e+t+.05),n}osc(e,t,n,r){let i=this.ctx.createOscillator();return i.type=e,i.frequency.setValueAtTime(t,n),i.start(n),i.stop(n+r+.05),i}mood(e,t){let n=hn[t]??hn.cut;this.timeline.push({t:e,mood:n}),this.timeline.sort((e,t)=>e.t-t.t),n.pad.forEach((t,n)=>{for(let r of[0,1]){let i=this.padOsc[n*2+r];i&&i.frequency.setTargetAtTime(mn(t),e,.35)}});for(let t=n.pad.length*2;t<this.padOsc.length;t++)this.padOsc[t].frequency.setTargetAtTime(mn(n.pad[t%n.pad.length]+12),e,.35);this.padFilter.frequency.setTargetAtTime(n.cut??1200,e,.6),this.padGain.gain.setTargetAtTime(.3+n.energy*.04,e,.5)}fadeOut(e,t){this.padGain.gain.setTargetAtTime(1e-4,e,t/4),this.timeline.push({t:e,mood:{pad:[],arp:[],energy:0}})}moodAt(e){let t=null;for(let n of this.timeline)if(n.t<=e+1e-4)t=n.mood;else break;return t}music(e,t){let n=60/this.bpm/4,r=Math.max(this.nextStep,Math.ceil(e/n-1e-6));for(;r*n<t;r++){let e=r*n,t=this.moodAt(e);if(!t)continue;let i=r%16;if(t.arp.length&&t.energy>=1){let n=t.arp[r%t.arp.length];n&&(t.energy>=2||i%2==0)&&this.pluck(e,mn(n),.05+(i%4==0?.025:0),t.energy>=3?2400:1500)}t.energy>=2&&i%4==0&&this.kick(e,i===0?.5:.32),t.energy>=3&&i%4==2&&this.hat(e,.05),t.energy>=4&&i%2==1&&this.hat(e,.025)}this.nextStep=r}resetGrid(e){this.nextStep=Math.ceil(e/(60/this.bpm/4))}pluck(e,t,n,r){let i=this.osc(`sawtooth`,t,e,.5),a=this.osc(`square`,t*2.001,e,.5),o=this.ctx.createBiquadFilter();o.type=`lowpass`,o.Q.value=6,o.frequency.setValueAtTime(r,e),o.frequency.exponentialRampToValueAtTime(220,e+.22);let s=this.env(e,.004,.42,n),c=this.ctx.createGain();c.gain.value=.25,i.connect(o),a.connect(c).connect(o),o.connect(s),this.out(s,.55)}kick(e,t){let n=this.osc(`sine`,120,e,.5);n.frequency.exponentialRampToValueAtTime(38,e+.18);let r=this.env(e,.002,.45,t);n.connect(r),this.out(r,.05)}hat(e,t){let n=this.noise(e,.06),r=this.ctx.createBiquadFilter();r.type=`highpass`,r.frequency.value=8e3;let i=this.env(e,.001,.05,t);n.connect(r).connect(i),this.out(i,.15)}play(e,t,n={}){let r=(e,t)=>typeof n[e]==`number`?n[e]:t,i=this.ctx;switch(e){case`mood`:this.mood(t,String(n.key));break;case`fadeout`:this.fadeOut(t,r(`d`,2));break;case`blip`:{let e=r(`f`,880),n=r(`v`,.12),i=this.osc(`sine`,e,t,.6),a=this.osc(`triangle`,e*2,t,.3),o=this.env(t,.003,r(`d`,.5),n),s=this.env(t,.002,.12,n*.4);i.connect(o),a.connect(s),this.out(o,.6),this.out(s,.6);break}case`tick`:{let e=this.noise(t,.03),n=i.createBiquadFilter();n.type=`bandpass`,n.frequency.value=r(`f`,3e3),n.Q.value=8;let a=this.env(t,.001,.03,r(`v`,.25));e.connect(n).connect(a),this.out(a,.3);break}case`whoosh`:{let e=r(`d`,1.2),a=n.dir!==`down`,o=this.noise(t,e),s=i.createBiquadFilter();s.type=`bandpass`,s.Q.value=1.4,s.frequency.setValueAtTime(a?250:3500,t),s.frequency.exponentialRampToValueAtTime(a?3500:200,t+e);let c=i.createGain();c.gain.setValueAtTime(1e-4,t),c.gain.exponentialRampToValueAtTime(r(`v`,.35),t+e*.7),c.gain.exponentialRampToValueAtTime(1e-4,t+e),o.connect(s).connect(c),this.out(c,.5);break}case`impact`:{let e=r(`v`,.7),n=this.osc(`sine`,90,t,1.6);n.frequency.exponentialRampToValueAtTime(30,t+.9);let a=this.env(t,.003,1.4,e);n.connect(a),this.out(a,.3);let o=this.noise(t,.5),s=i.createBiquadFilter();s.type=`lowpass`,s.frequency.setValueAtTime(3e3,t),s.frequency.exponentialRampToValueAtTime(120,t+.4);let c=this.env(t,.002,.45,e*.5);o.connect(s).connect(c),this.out(c,.7);break}case`snap`:{let e=this.noise(t,.12),n=i.createBiquadFilter();n.type=`highpass`,n.frequency.value=2500;let r=this.env(t,.001,.09,.7);e.connect(n).connect(r),this.out(r,.6);for(let[e,n,r]of[[431,1.6,.08],[1187,1.1,.06],[2273,.7,.04],[3311,.5,.03]]){let i=this.osc(`sine`,e*(.98+this.rnd()*.04),t,n),a=this.env(t,.001,n,r);i.connect(a),this.out(a,.7)}this.play(`impact`,t,{v:.8});let a=this.osc(`sawtooth`,60,t,.5),o=this.env(t,.002,.4,.12),s=i.createBiquadFilter();s.type=`bandpass`,s.frequency.value=900,s.Q.value=3,a.connect(s).connect(o),o.connect(this.shaper);break}case`glitch`:{let e=r(`d`,1),n=t;for(;n<t+e;){let e=.02+this.rnd()*.06,t=this.osc(this.rnd()<.5?`square`:`sawtooth`,80+this.rnd()**2*2400,n,e),r=i.createGain();r.gain.setValueAtTime(.09,n),r.gain.setValueAtTime(0,n+e),t.connect(r).connect(this.shaper),n+=e+this.rnd()*.05}break}case`powerdown`:{let e=r(`d`,1.6),n=this.osc(`sawtooth`,520,t,e),a=this.osc(`square`,261,t,e);n.frequency.exponentialRampToValueAtTime(28,t+e),a.frequency.exponentialRampToValueAtTime(14,t+e);let o=i.createBiquadFilter();o.type=`lowpass`,o.frequency.setValueAtTime(4e3,t),o.frequency.exponentialRampToValueAtTime(90,t+e);let s=i.createGain();s.gain.setValueAtTime(.22,t),s.gain.exponentialRampToValueAtTime(1e-4,t+e),n.connect(o),a.connect(o),o.connect(s),this.out(s,.6);break}case`riser`:{let e=r(`d`,2),n=this.noise(t,e),a=i.createBiquadFilter();a.type=`bandpass`,a.Q.value=3,a.frequency.setValueAtTime(300,t),a.frequency.exponentialRampToValueAtTime(6e3,t+e);let o=i.createGain();o.gain.setValueAtTime(1e-4,t),o.gain.exponentialRampToValueAtTime(.22,t+e),o.gain.linearRampToValueAtTime(0,t+e+.02),n.connect(a).connect(o),this.out(o,.5);let s=this.osc(`sine`,220,t,e);s.frequency.exponentialRampToValueAtTime(1760,t+e);let c=i.createGain();c.gain.setValueAtTime(1e-4,t),c.gain.exponentialRampToValueAtTime(.05,t+e),c.gain.linearRampToValueAtTime(0,t+e+.02),s.connect(c),this.out(c,.6);break}case`chatter`:{let e=r(`d`,1.5),n=r(`n`,30),i=r(`v`,.04);for(let r=0;r<n;r++){let n=t+this.rnd()*e,r=600+Math.floor(this.rnd()*12)*180,a=this.osc(`square`,r,n,.04),o=this.env(n,.001,.035,i);a.connect(o),this.out(o,.4)}break}case`hum`:{let e=r(`d`,4);for(let[n,r]of[[50,.12],[100,.07],[150,.04],[250,.02]]){let a=this.osc(`sine`,n,t,e),o=i.createGain();o.gain.setValueAtTime(1e-4,t),o.gain.exponentialRampToValueAtTime(r,t+e*.3),o.gain.setValueAtTime(r,t+e*.7),o.gain.exponentialRampToValueAtTime(1e-4,t+e),a.connect(o),this.out(o,.2)}break}case`buzz`:{let e=r(`d`,2),n=r(`v`,.05),a=this.osc(`sawtooth`,2350,t,e),o=i.createBiquadFilter();o.type=`bandpass`,o.frequency.value=2400,o.Q.value=6;let s=this.osc(`square`,23,t,e),c=i.createGain();c.gain.value=140,s.connect(c).connect(a.frequency);let l=i.createGain();l.gain.setValueAtTime(1e-4,t),l.gain.exponentialRampToValueAtTime(n,t+.12),l.gain.setValueAtTime(n,t+e-.15),l.gain.exponentialRampToValueAtTime(1e-4,t+e),a.connect(o).connect(l),this.out(l,.25);let u=t;for(;u<t+e;){let e=.004+this.rnd()*.01,t=this.noise(u,e),r=i.createBiquadFilter();r.type=`highpass`,r.frequency.value=2500+this.rnd()*4e3;let a=this.env(u,5e-4,e,n*(.6+this.rnd()*1.4));t.connect(r).connect(a),this.out(a,.2),u+=.008+this.rnd()*.03}break}case`sweep`:{let e=r(`d`,1),n=this.osc(`sawtooth`,160,t,e),a=i.createBiquadFilter();a.type=`lowpass`,a.frequency.value=700,n.frequency.setValueAtTime(140,t),n.frequency.linearRampToValueAtTime(220,t+e*.3),n.frequency.setValueAtTime(220,t+e*.7),n.frequency.linearRampToValueAtTime(130,t+e);let o=i.createGain();o.gain.setValueAtTime(1e-4,t),o.gain.exponentialRampToValueAtTime(.07,t+.08),o.gain.setValueAtTime(.07,t+e-.1),o.gain.exponentialRampToValueAtTime(1e-4,t+e),n.connect(a).connect(o),this.out(o,.15);let s=this.noise(t,e),c=i.createBiquadFilter();c.type=`bandpass`,c.frequency.value=5200,c.Q.value=.8;let l=i.createGain();l.gain.setValueAtTime(1e-4,t),l.gain.exponentialRampToValueAtTime(.09,t+e*.5),l.gain.exponentialRampToValueAtTime(1e-4,t+e),s.connect(c).connect(l),this.out(l,.3);break}case`fan`:{let e=r(`d`,6),n=r(`v`,.05),a=this.noise(t,e),o=i.createBiquadFilter();o.type=`lowpass`,o.frequency.value=420;let s=i.createGain();s.gain.setValueAtTime(1e-4,t),s.gain.exponentialRampToValueAtTime(n*2,t+1),s.gain.setValueAtTime(n*2,t+e-1),s.gain.exponentialRampToValueAtTime(1e-4,t+e),a.connect(o).connect(s),this.out(s,.2);let c=this.osc(`triangle`,118,t,e),l=i.createGain();l.gain.setValueAtTime(1e-4,t),l.gain.exponentialRampToValueAtTime(n*.5,t+1),l.gain.setValueAtTime(n*.5,t+e-1),l.gain.exponentialRampToValueAtTime(1e-4,t+e),c.connect(l),this.out(l,.1);break}case`rumble`:{let e=r(`d`,6),n=r(`v`,1),a=this.noise(t,e),o=i.createBiquadFilter();o.type=`lowpass`,o.frequency.value=160,o.Q.value=.4;let s=i.createBiquadFilter();s.type=`lowpass`,s.frequency.value=420;let c=i.createGain();c.gain.setValueAtTime(1e-4,t),c.gain.exponentialRampToValueAtTime(.5*n,t+.8),c.gain.setValueAtTime(.5*n,t+e-1.2),c.gain.exponentialRampToValueAtTime(1e-4,t+e),a.connect(o).connect(s).connect(c),this.out(c,.15);let l=this.osc(`sine`,34,t,e),u=i.createGain();u.gain.setValueAtTime(1e-4,t),u.gain.exponentialRampToValueAtTime(.22*n,t+1),u.gain.setValueAtTime(.22*n,t+e-1.2),u.gain.exponentialRampToValueAtTime(1e-4,t+e);let d=this.osc(`sine`,3.1,t,e),f=i.createGain();f.gain.value=6,d.connect(f).connect(l.frequency),l.connect(u),this.out(u,.05);let p=t+.3;for(;p<t+e-.6;){let e=.003+this.rnd()*.012,t=this.noise(p,e),r=i.createBiquadFilter();r.type=`bandpass`,r.frequency.value=500+this.rnd()*2200,r.Q.value=.7;let a=this.env(p,5e-4,e*2,n*(.05+this.rnd()*.12));t.connect(r).connect(a),this.out(a,.25),p+=.006+this.rnd()*.05}break}case`ignite`:{let e=r(`v`,1);this.play(`impact`,t,{v:.9*e});let n=this.noise(t,3),a=i.createBiquadFilter();a.type=`bandpass`,a.Q.value=.6,a.frequency.setValueAtTime(220,t),a.frequency.exponentialRampToValueAtTime(1400,t+.4),a.frequency.exponentialRampToValueAtTime(300,t+3);let o=i.createGain();o.gain.setValueAtTime(1e-4,t),o.gain.exponentialRampToValueAtTime(.45*e,t+.08),o.gain.exponentialRampToValueAtTime(1e-4,t+3),n.connect(a).connect(o),this.out(o,.5);break}case`beam`:{let e=r(`d`,2),n=r(`f`,1320);for(let r of[1,1.25,1.5,2]){let a=this.osc(`sine`,n*r,t,e),o=i.createGain();o.gain.setValueAtTime(1e-4,t),o.gain.exponentialRampToValueAtTime(.018,t+.3),o.gain.exponentialRampToValueAtTime(1e-4,t+e);let s=this.osc(`sine`,9+r*3,t,e),c=i.createGain();c.gain.value=.01,s.connect(c).connect(o.gain),a.connect(o),this.out(o,.8)}break}}}},z=null,_n=null,vn=()=>0,yn=!1,bn=[];function xn(e,t){_n?_n.push({t:vn(),name:e,o:t}):z&&!yn?z.synth.play(e,z.ctx.currentTime+.01,t):e===`mood`&&(bn.length=0,bn.push({t:0,name:e,o:t}))}var Sn={start(){if(!_n){if(!z){let e=new AudioContext({latencyHint:`interactive`}),t=new gn(e);z={ctx:e,synth:t},t.resetGrid(e.currentTime);for(let n of bn)t.play(n.name,e.currentTime+.02,n.o);bn.length||t.mood(e.currentTime,`climb`),bn.length=0}z.ctx.resume()}},get on(){return!!z&&!yn&&z.ctx.state===`running`},toggle(){return z?(yn=!yn,yn?z.ctx.suspend():(z.ctx.resume(),z.synth.resetGrid(z.ctx.currentTime)),!yn):(this.start(),yn=!1,!0)},tick(){z&&!yn&&z.ctx.state===`running`&&z.synth.music(z.ctx.currentTime,z.ctx.currentTime+.25)},film(e){_n=[],vn=e},filmReset(){_n&&(_n.length=0)},async renderFilm(e,t){let n=48e3,r=new OfflineAudioContext(2,Math.ceil(n*e),n),i=new gn(r);for(let n of _n??[]){let r=Math.max(0,n.t-t);r<e&&i.play(n.name,r+.001,n.o)}return i.music(0,e),i.play(`fadeout`,Math.max(0,e-2.6),{d:2.6}),Cn(await r.startRendering())}};function Cn(e){let t=e.numberOfChannels,n=e.length,r=44+n*t*2,i=new DataView(new ArrayBuffer(r)),a=(e,t)=>{for(let n=0;n<t.length;n++)i.setUint8(e+n,t.charCodeAt(n))};a(0,`RIFF`),i.setUint32(4,r-8,!0),a(8,`WAVE`),a(12,`fmt `),i.setUint32(16,16,!0),i.setUint16(20,1,!0),i.setUint16(22,t,!0),i.setUint32(24,e.sampleRate,!0),i.setUint32(28,e.sampleRate*t*2,!0),i.setUint16(32,t*2,!0),i.setUint16(34,16,!0),a(36,`data`),i.setUint32(40,n*t*2,!0);let o=Array.from({length:t},(t,n)=>e.getChannelData(n)),s=44;for(let e=0;e<n;e++)for(let n=0;n<t;n++){let t=Math.max(-1,Math.min(1,o[n][e]));i.setInt16(s,t<0?t*32768:t*32767,!0),s+=2}let c=new Uint8Array(i.buffer),l=``;for(let e=0;e<c.length;e+=32768)l+=String.fromCharCode(...c.subarray(e,e+32768));return btoa(l)}var wn=D.clamp,Tn=D.lerp,En=e=>(e=wn(e,0,1),e<.5?4*e*e*e:1-(-2*e+2)**3/2),Dn=(e,t,n)=>En((e-t)/(n-t)),B=(e,t,n)=>new v(e,t,n),On=class{constructor(){t(this,`pos`,new v(160,60,420)),t(this,`tgt`,new v(0,60,0)),t(this,`fov`,30),t(this,`roll`,0),t(this,`cache`,new Map)}shot(e,t){let n=this.cache.get(e);n||(n={p:new a(e.map(e=>B(...e[1])),!1,`centripetal`),t:new a(e.map(e=>B(...e[2])),!1,`centripetal`)},this.cache.set(e,n));let r=0;for(;r<e.length-2&&t>e[r+1][0];)r++;let i=wn((t-e[r][0])/(e[r+1][0]-e[r][0]),0,1),o=(r+i)/(e.length-1);n.p.getPoint(o,this.pos),n.t.getPoint(o,this.tgt);let s=e[r][3]??30,c=e[r+1][3]??s;this.fov=Tn(s,c,i)}orbit(e,t,n){let r=this.pos.clone().sub(this.tgt),i=new o().setFromVector3(r);i.theta-=e*.005,i.phi=wn(i.phi-t*.005,.05,Math.PI-.05),i.radius=wn(i.radius*Math.exp(n*.001),6,2500),this.pos.copy(this.tgt).add(r.setFromSpherical(i))}apply(e,t){t.updateMatrixWorld(),e.position.copy(this.pos).applyMatrix4(t.matrixWorld);let n=this.tgt.clone().applyMatrix4(t.matrixWorld);e.up.set(0,1,0),e.lookAt(n),this.roll&&e.rotateZ(this.roll),Math.abs(e.fov-this.fov)>.01&&(e.fov=this.fov,e.updateProjectionMatrix());let r=wn(e.position.distanceTo(n)*.02,.05,4);Math.abs(e.near-r)>r*.1&&(e.near=r,e.far=4e5,e.updateProjectionMatrix())}},V=-1;function kn(e){V=e}var An=e=>{for(let[t,n,r]of e)if(V>=t&&V<n)return r;return``};function jn(e,t,n){let r=n.clone().project(e.cam),i=+(r.z<1&&Math.abs(r.x)<1.05&&Math.abs(r.y)<1.05);return{x:(r.x*.5+.5)*t.w,y:(-r.y*.5+.5)*t.h,vis:i}}function H(e,t,n,r,i,a,o,s=`#7fd8ff`,c){let l=c?e.v.parts.find(e=>e.name===c).group:e.v.root;l.updateMatrixWorld();let u=jn(e,t,r.clone().applyMatrix4(l.matrixWorld));return{id:n,text:i,sub:a,x:u.x,y:u.y,vis:u.vis*wn(o,0,1),dot:s}}var U={lox:`#46c8ff`,ch4:`#ffa23a`,gas:`#9b7bff`,fire:`#ffd9a8`,steel:`#dfe6f0`},Mn=e=>`${Math.round(e).toLocaleString(`en-US`)}`;function Nn(e){let t=fn(e.clock);return[{k:`Clock`,v:pn(e.clock),c:`cool`},{k:`Altitude`,v:(t.h/1e3).toFixed(1),u:`km`},{k:`Speed`,v:Math.round(t.v*3.6).toLocaleString(`en-US`),u:`km/h`}]}function Pn(e,t){!t.auto&&(t.pointer.dx||t.pointer.dy||t.pointer.wheel)&&e.rig.orbit(t.pointer.dx,t.pointer.dy,t.pointer.wheel)}var Fn=44.5;function In(e){let t=[[0,[-300,380,1700],[0,-40,0],30],[.45,[-180,160,820],[0,0,0],30],[.8,[-90,50,380],[0,10,0],30],[1,[-75,45,320],[0,18,0],30]];return{id:`climb`,tab:`Above the clouds`,kicker:`Starship V3 · ascent`,length:12,enter(){e.studioT=0,e.studio=0,e.clock=41.5,e.rate=.5,e.cutT=0,e.explodeT=0,e.cut=0,e.explode=0,e.staging=!1,e.stage=-1,xn(`mood`,{key:`climb`}),xn(`rumble`,{d:12,v:.9})},script(n){e.rig.shot(t,En(n))},update(t){Pn(e,t)},stats:()=>Nn(e),text:()=>`<b>124 m</b> of steel on <b>33 Raptor 3</b> engines, going through the speed of sound.`,caption:()=>An([[.05,.5,`Starship, T+0:45.`],[.5,.98,`Mach 1, above the clouds.`]]),labels:()=>[]}}function Ln(e){let t=[[0,[-40,70,240],[0,62,0],30],[.5,[10,66,200],[0,62,0],32],[1,[40,62,190],[0,62,0],32]];return{id:`cut`,tab:`Cut in half`,kicker:`Section through the stack`,length:11,enter(){e.studioT=0,e.clock=Fn,e.rate=.05,e.cutT=0,e.explodeT=0,e.follow=`all`,xn(`mood`,{key:`cut`}),xn(`whoosh`,{d:1.6})},script(n){e.rig.shot(t,En(n)),e.cutT=Dn(n,.12,.42),e.studioT=+(n>.08)},update(t){Pn(e,t)},stats:()=>{let t=fn(e.clock);return[{k:`Oxygen`,v:Mn(t.bLox+t.sLox),u:`t`,c:`cool`},{k:`Methane`,v:Mn(t.bCh4+t.sCh4),u:`t`,c:`warm`},{k:`Steel`,v:`4`,u:`mm wall`}]},text:()=>`Four tanks: <b style="color:${U.lox}">liquid oxygen</b> below, <b style="color:${U.ch4}">liquid methane</b> above, in each stage.`,caption:()=>An([[.04,.45,`Cut it in half.`],[.45,.98,`Almost all propellant.`]]),labels:t=>{let n=Dn(V<0?1:V,.42,.55);return[H(e,t,`blox`,B(-2.2,20,0),`Liquid oxygen`,`${Mn(fn(e.clock).bLox)} t`,n,U.lox,`b-lox`),H(e,t,`bch4`,B(-2.2,51,0),`Liquid methane`,`${Mn(fn(e.clock).bCh4)} t`,n,U.ch4,`b-ch4`),H(e,t,`slox`,B(-2.2,F+12,0),`Oxygen`,`${Mn(fn(e.clock).sLox)} t`,n,U.lox,`s-lox`),H(e,t,`sch4`,B(-2.2,F+25,0),`Methane`,`${Mn(fn(e.clock).sCh4)} t`,n,U.ch4,`s-ch4`),H(e,t,`bay`,B(-2.5,I.bay0+6,0),`Payload bay`,`Starlink satellites`,n,U.steel,`s-bay`)]}}}function Rn(e){let t=[[0,[26,66,54],[0,60,0],34],[.35,[22,44,46],[0,40,0],34],[.7,[20,22,44],[0,20,0],34],[1,[24,12,52],[0,12,0],34]],n=0;return{id:`tanks`,tab:`Tanks`,kicker:`What is in the tanks`,length:13,enter(){e.studioT=1,e.clock=Fn,e.rate=.05,e.cutT=1,e.explodeT=0,xn(`mood`,{key:`tanks`}),n=0},script(r){e.rig.shot(t,En(r)),e.rate=r>.45&&r<.9?6:.05,r>.45&&n<=.45&&xn(`riser`,{d:1.6}),n=r},update(t){Pn(e,t)},stats:()=>{let t=fn(e.clock);return[{k:`Booster O₂`,v:Mn(t.bLox),u:`t`,c:`cool`},{k:`Booster CH₄`,v:Mn(t.bCh4),u:`t`,c:`warm`},{k:`Flow`,v:(33*nn.mdot*t.thr/1e3).toFixed(1),u:`t/s`}]},text:()=>`Methane falls through the <b>downcomer</b>, a pipe straight through the oxygen tank.`,caption:()=>An([[.04,.42,`Methane falls through the oxygen.`],[.45,.98,`Frost line = liquid level.`]]),labels:t=>[H(e,t,`dc`,B(0,30,.5),`Downcomer`,`methane in the oxygen tank`,Dn(V<0?1:V,.05,.15)*(1-Dn(V<0?0:V,.6,.7)),U.ch4,`b-lox`),H(e,t,`lvl`,B(-N,(t=>e.v.cut.capsOn?t===0?L.B.lox.level(fn(e.clock).bLox*1e3/L.B.lox.mass):L.B.ch4.level(fn(e.clock).bCh4*1e3/L.B.ch4.mass):0)(0),-.4),`Frost line`,`liquid level inside`,Dn(V<0?1:V,.45,.55),U.steel,`b-lox`),H(e,t,`gox`,B(-4.2,26,0),`Hot oxygen gas`,`keeps the tank pressed`,Dn(V<0?1:V,.15,.25)*(1-Dn(V<0?0:V,.45,.5)),U.gas,`b-lox`),H(e,t,`cd`,B(2,37.2,0),`Common dome`,`one wall, two liquids`,Dn(V<0?1:V,.1,.2)*(1-Dn(V<0?0:V,.4,.45)),U.steel,`b-lox`)]}}function zn(e){let t=[[0,[44,-4,40],[0,4,0],34],[.5,[30,-9,34],[0,2,0],36],[1,[10,-12,36],[0,1,0],38]];return{id:`engines`,tab:`33 engines`,kicker:`Super Heavy · Raptor 3`,length:12,enter(){e.studioT=0,e.clock=Fn,e.rate=.05,e.cutT=0,e.explodeT=0,xn(`mood`,{key:`engines`}),xn(`rumble`,{d:12,v:1})},script(n){e.rig.shot(t,En(n))},update(t){Pn(e,t);let n=e.v.bEng.gimbal;for(let e=0;e<3;e++)n[e].set(Math.sin(t.t*.9+e*2.1)*.06,Math.cos(t.t*.7+e*1.3)*.06);e.v.bEng.sync()},stats:()=>[{k:`Engines`,v:`33`,u:`Raptor 3`,c:`warm`},{k:`Thrust`,v:9240 .toLocaleString(`en-US`),u:`tf`},{k:`Each`,v:`280`,u:`tf`}],text:()=>`<b>3</b> steer, <b>10</b> around them, <b>20</b> fixed on the outside.`,caption:()=>An([[.04,.5,`33 Raptor 3 engines.`],[.5,.98,`Over twice a Saturn V.`]]),labels:t=>{let n=Dn(V<0?1:V,.2,.3);return[H(e,t,`r1`,B(.98,0,0),`Center 3`,`steer`,n,U.fire,`b-engines`),H(e,t,`r2`,B(-2.5,0,0),`Middle 10`,`steer`,n,U.fire,`b-engines`),H(e,t,`r3`,B(3.86,0,-.6),`Outer 20`,`fixed`,n,U.fire,`b-engines`)]}}}function Bn(e){let t=[[0,[-90,70,230],[0,64,0],34],[.45,[-60,72,260],[0,72,0],36],[1,[-20,76,250],[0,76,0],36]];return{id:`explode`,tab:`Pulled apart`,kicker:`Every section`,length:12,enter(){e.studioT=1,e.cutT=0,e.clock=Fn,e.rate=.05,xn(`mood`,{key:`explode`}),xn(`whoosh`,{d:1.4,dir:`down`})},script(n){e.rig.shot(t,En(n)),e.explodeT=Dn(n,.08,.4),e.cutT=Dn(n,.55,.75)},update(t){Pn(e,t)},stats:()=>[{k:`Height`,v:I.top.toFixed(1),u:`m`},{k:`Booster`,v:P.hsr1.toFixed(1),u:`m`},{k:`Ship`,v:(I.top-F).toFixed(1),u:`m`}],text:()=>`Super Heavy below, the ship on top. They split at the <b>hot stage ring</b>.`,caption:()=>An([[.04,.5,`Pull it apart.`],[.5,.98,`Two rockets, stacked.`]]),labels:t=>{let n=Dn(V<0?1:V,.32,.42);return[H(e,t,`e1`,B(N,2.5,0),`Engine bay`,`33 engines, 12 pressure bottles`,n,U.fire,`b-aft`),H(e,t,`e2`,B(N,22,0),`Oxygen tank`,`Super Heavy`,n,U.lox,`b-lox`),H(e,t,`e3`,B(N,50,0),`Methane tank`,`Super Heavy`,n,U.ch4,`b-ch4`),H(e,t,`e4`,B(N+3,P.fins,0),`Grid fins`,`steer it back to the tower`,n,U.steel,`b-fwd`),H(e,t,`e5`,B(N,(P.hsr0+P.hsr1)/2,0),`Hot stage ring`,`separation here`,n,`#ff6a8a`,`b-hsr`),H(e,t,`e6`,B(N,F+3,0),`Six engines`,`3 sea level, 3 vacuum`,n,U.fire,`s-aft`),H(e,t,`e7`,B(N,F+13,0),`Oxygen tank`,`Ship`,n,U.lox,`s-lox`),H(e,t,`e8`,B(N,F+25,0),`Methane tank`,`Ship`,n,U.ch4,`s-ch4`),H(e,t,`e9`,B(N,I.bay0+6,0),`Payload bay`,`Starlink`,n,U.steel,`s-bay`),H(e,t,`e10`,B(N-1,I.nose0+4,0),`Nose`,`oxygen header tank, flaps`,n,U.steel,`s-nose`)]}}}function Vn(e){let t=[[0,[-14,52,160],[0,70,0],34],[.35,[-10,62,135],[0,76,0],32],[.7,[-30,105,270],[0,108,0],34],[1,[-50,150,400],[0,145,0],34]];return{id:`staging`,tab:`Hot staging`,kicker:`Stage separation`,length:15,enter(){e.studioT=0,e.studio=0,e.clock=dn-2.5,e.rate=1,e.cutT=0,e.explodeT=0,e.cut=0,e.explode=0,e.staging=!0,e.stage=-1,xn(`mood`,{key:`staging`})},script(n){e.rig.shot(t,En(n))},update(t){Pn(e,t)},stats:()=>{let t=fn(e.clock);return[{k:`Clock`,v:pn(e.clock),c:`cool`},{k:`Altitude`,v:(t.h/1e3).toFixed(0),u:`km`},{k:`Speed`,v:Math.round(t.v*3.6).toLocaleString(`en-US`),u:`km/h`}]},text:()=>`The ship lights while still bolted to the booster.`,caption:()=>An([[.03,.2,`T+2:12.`],[.2,.55,`The ship lights while attached.`],[.55,.98,`And pushes off.`]]),labels:t=>{let n=+(e.stage>0&&e.stage<3);return[H(e,t,`vents`,B(-N,(P.hsr0+P.hsr1)/2,0),`Hot stage ring`,`fire out of the vents`,n,`#ff6a8a`,`b-hsr`)]}}}var Hn=[In,Ln,Rn,zn,Bn,Vn];function Un(e,t){return[{kind:`seg`,id:`follow`,label:`Follow`,options:[[`all`,`All`],[`lox`,`Oxygen`],[`ch4`,`Methane`],[`fire`,`Fire`]],get:()=>e.follow,set:t=>{e.follow=t}},{kind:`seg`,id:`view`,label:`Starship`,options:[[`whole`,`Whole`],[`cut`,`Cutaway`],[`exploded`,`Exploded`]],get:()=>e.explodeT>.5?`exploded`:e.cutT>.5?`cut`:`whole`,set:t=>{e.cutT=+(t===`cut`),e.explodeT=+(t===`exploded`),e.studioT=t===`whole`?0:1}},{kind:`slider`,id:`clock`,label:`Mission clock`,min:0,max:Math.floor(dn+18),step:.5,get:()=>e.clock,set:t=>{e.clock=t,e.stage=t>dn?t-dn:-1,e.staging=t>dn-3},fmt:e=>`${pn(e)} · ${(fn(e).h/1e3).toFixed(1)} km`},{kind:`seg`,id:`rate`,label:`Time`,options:[[`0`,`Frozen`],[`0.1`,`Slow`],[`1`,`Real time`]],get:()=>e.rate<=.001?`0`:e.rate<.5?`0.1`:`1`,set:t=>{e.rate=+t}},{kind:`button`,id:`stage`,label:`Stage separation`,text:()=>e.stage>0?`Again`:`Hot stage now`,run:()=>{e.clock=dn-1.5,e.stage=-1,e.staging=!0,e.rate=1,e.cutT=0,e.explodeT=0}}]}function Wn(e,t){let n={lox:1,ch4:1,oxgas:1,fuelgas:1,fire:1};e.follow===`lox`&&(n.ch4=.12,n.fuelgas=.1,n.fire=.3),e.follow===`ch4`&&(n.lox=.12,n.oxgas=.1,n.fire=.3),e.follow===`fire`&&(n.lox=.15,n.ch4=.15,n.oxgas=.1,n.fuelgas=.1,n.fire=1.6);let r=1-Math.exp(-t*6);for(let e of Object.keys(n))Ue[e].emph.value+=(n[e]-Ue[e].emph.value)*r}var Gn=new URLSearchParams(location.search),Kn=Gn.has(`film`),qn=e?{...be,lights:{...be.lights,PointLight:4}}:{...me};Pe.value=Ne(64);var Jn=document.getElementById(`gl`),W=new Ee(Jn,Kn),Yn=W.renderer;Yn.localClippingEnabled=!0,Yn.shadowMap.type=2;var Xn=new ke,Zn=new le(30,16/9,.5,4e5),G=new qt(Yn);G.setSun(new v(.25,.2,-.95));var K=new zt;Xn.add(K.root);var Qn=new y(16777215,4);Qn.castShadow=!0,Qn.shadow.mapSize.set(Kn?4096:2048,Kn?4096:2048),Yn.shadowMap.autoUpdate=!1,Qn.shadow.bias=-3e-4,Qn.shadow.normalBias=.04;var $n=Qn.shadow.camera;$n.left=-72,$n.right=72,$n.top=72,$n.bottom=-72,$n.near=1,$n.far=600,Xn.add(Qn,Qn.target);var er=Se(Yn),tr=new y(14674175,0),nr=new y(9417983,0);Xn.add(tr,tr.target,nr,nr.target);var rr=[[L.B.lox,4638975,`b-lox`],[L.B.ch4,16753210,`b-ch4`],[L.S.lox,4638975,`s-lox`],[L.S.ch4,16753210,`s-ch4`]].map(([e,t,n])=>{let r=new Ce(t,0,26,1.6);return r.position.set(-.5,(e.yBot+e.yTop)/2,-1.2),K.parts.find(e=>e.name===n).group.add(r),r}),ir={tex:null},ar=new Xt(Et.map(([e,t,n,r])=>({count:e,radius:t,phase:n,re:M.Re*r})),N-.3,K.booster);ar.at(0),K.booster.add(ar.mesh);var or=new Xt(Dt.map(([e,t,n,r],i)=>({count:e,radius:t,phase:n,re:i?_t.re*r:M.Re*r})),3.4,K.ship);or.at(F+.1),K.ship.add(or.mesh);var sr=new Zt;K.root.add(sr.mesh);var cr=new Qt([{y:P.hsr1+1.5,r:N+.25,len:16,flare:3},{y:I.nose0+3.2,r:N-.1,len:13,flare:2.4},{y:P.fins+1,r:N+.6,len:12,flare:2.6}]);K.root.add(cr.group);var lr=new $t(K.hsrVents);K.booster.add(lr.mesh);for(let e of W.composer.passes){let t=e.fsq?.material;t?.uniforms?.uMax&&(t.uniforms.uMax.value=45)}if(G.u.uSteps.value=Kn?64:qn.tv?16:34,Kn)for(let e of[ar,or])e.mat.defines.NEIGHBOURS=1,e.mat.needsUpdate=!0;ar.mat.uniforms.uSteps.value=Kn?48:qn.tv?16:30,or.mat.uniforms.uSteps.value=Kn?48:qn.tv?16:30,qn.tv&&(W.setSamples(qn.samples),ee(Xn,qn.shadowMap),ce(Xn,qn.lights)),W.layers.layers=[{scene:G.back,camera:new he(-1,1,1,-1,0,1)},{scene:Xn,camera:Zn}];var ur=new On,q={v:K,cam:Zn,rig:ur,studio:0,studioT:0,clock:44.5,rate:.5,cut:0,cutT:0,explode:0,explodeT:0,follow:`all`,stage:-1,staging:!1},J=Hn.map(e=>e(q)),dr=e=>document.querySelector(e),Y={kicker:dr(`#kicker`),stats:dr(`#stats`),text:dr(`#text`),cap:dr(`#cap`),controls:dr(`#controls`),tabs:dr(`#tabs`),labels:dr(`#labels`),play:dr(`#play`),auto:dr(`#auto`)},X=Math.max(0,J.findIndex(e=>e.id===Gn.get(`c`))),Z=!Gn.has(`manual`),fr=0,pr=0,mr=``,hr=``,gr=``,_r=Un(q,()=>wr());function vr(){Y.tabs.innerHTML=J.map((e,t)=>`<button data-i="${t}" class="tab${t===X?` on`:``}"><i></i>${e.tab}</button>`).join(``),Y.tabs.querySelectorAll(`button`).forEach(e=>e.addEventListener(`click`,()=>{Cr(+e.getAttribute(`data-i`))}))}var yr=e=>typeof e.text==`function`?e.text():e.text;function br(e){return e.kind===`seg`?`<div class="row"><div class="lab">${e.label}</div><div class="seg" data-id="${e.id}">${e.options.map(([e,t])=>`<button data-v="${e}">${t}</button>`).join(``)}</div></div>`:e.kind===`slider`?`<div class="row"><div class="lab">${e.label}<span class="val" data-val="${e.id}"></span></div><input type="range" data-id="${e.id}" min="${e.min}" max="${e.max}" step="${e.step}"></div>`:`<div class="row"><div class="lab">${e.label}</div><button class="btn" data-id="${e.id}">${yr(e)}</button></div>`}function xr(){Y.controls.innerHTML=_r.map(br).join(``)+`<div class="hint">Drag to look around. Scroll to zoom.</div>`;for(let e of _r){if(e.kind===`seg`&&Y.controls.querySelectorAll(`.seg[data-id="${e.id}"] button`).forEach(t=>t.addEventListener(`click`,()=>{wr(),e.set(t.dataset.v),xn(`tick`,{f:1800,v:.15}),Sr()})),e.kind===`slider`){let t=Y.controls.querySelector(`input[data-id="${e.id}"]`);t.addEventListener(`input`,()=>{wr(),e.set(+t.value),Sr()})}e.kind===`button`&&Y.controls.querySelector(`.btn[data-id="${e.id}"]`).addEventListener(`click`,()=>{wr(),e.run(),Sr()})}Sr()}function Sr(){for(let e of _r){if(e.kind===`seg`){let t=e.get();Y.controls.querySelectorAll(`.seg[data-id="${e.id}"] button`).forEach(e=>e.classList.toggle(`on`,e.dataset.v===t))}if(e.kind===`slider`){let t=Y.controls.querySelector(`input[data-id="${e.id}"]`);document.activeElement!==t&&(t.value=String(e.get()));let n=(e.get()-e.min)/(e.max-e.min);t.style.setProperty(`--p`,`${(n*100).toFixed(1)}%`),Y.controls.querySelector(`[data-val="${e.id}"]`).textContent=e.fmt(e.get())}if(e.kind===`button`){let t=Y.controls.querySelector(`.btn[data-id="${e.id}"]`),n=yr(e);t.textContent!==n&&(t.textContent=n)}}}function Cr(e){X=(e+J.length)%J.length,fr=0,pr=0,J[X].enter(),Y.tabs.querySelectorAll(`button`).forEach((e,t)=>e.classList.toggle(`on`,t===X)),Y.labels.innerHTML=``,Lr.clear(),Z?kn(0):(J[X].script(.6,$),kn(-1),q.cut=q.cutT,q.explode=q.explodeT),Tr(),Sr()}function wr(){Z&&(Z=!1,kn(-1),Tr())}function Tr(){Y.play.classList.toggle(`playing`,Z),Y.play.setAttribute(`aria-label`,Z?`Pause the tour`:`Play the tour`),Y.auto.textContent=Z?`plays itself`:`your turn`}Y.play.addEventListener(`click`,()=>{Z=!Z,Z?(fr=0,J[X].enter()):kn(-1),Tr()});var Er={dx:0,dy:0,wheel:0,down:!1,click:null},Dr=0,Or=0;Jn.addEventListener(`pointerdown`,e=>{Er.down=!0,Dr=e.clientX,Or=e.clientY,Jn.setPointerCapture(e.pointerId),wr()}),Jn.addEventListener(`pointermove`,e=>{Er.down&&(Er.dx+=e.clientX-Dr,Er.dy+=e.clientY-Or,Dr=e.clientX,Or=e.clientY)}),Jn.addEventListener(`pointerup`,()=>{Er.down=!1}),Jn.addEventListener(`pointercancel`,()=>{Er.down=!1}),Jn.addEventListener(`wheel`,e=>{e.preventDefault(),Er.wheel+=e.deltaY,wr()},{passive:!1});var kr=1,Ar=1,jr=Kn?1:qn.tv?qn.maxScale:Math.min(devicePixelRatio,1.5),Mr=jr;function Nr(){kr=Kn?1920:innerWidth,Ar=Kn?1080:innerHeight,W.resize(kr,Ar,jr),G.resize(kr*Math.min(jr,1),Ar*Math.min(jr,1)),Zn.aspect=kr/Ar,Zn.updateProjectionMatrix()}var Pr=0,Fr=0;function Ir(e){if(Kn||qn.tv||(Pr+=e,Fr++,Fr<40))return;let t=Pr/Fr;Pr=0,Fr=0;let n=t>30?Math.max(.55,jr*.85):t<17?Math.min(Mr,jr*1.1):jr;Math.abs(n-jr)>.02&&(jr=n,Nr())}addEventListener(`resize`,Nr);var Q={hide:``,exp:0,pk:1,cam:null,sun:-1,env:-1,pts:-1};window.__dbg=Q;var $=0,Lr=new Map,Rr=0,zr=!1,Br=``,Vr=new v,Hr=new l;function Ur(e){$+=e;let t=J[X];if(Z){if(fr+=e,fr>=t.length)return Cr(X+1),Ur(0);kn(fr/t.length),t.script(fr/t.length,$)}let n={w:kr,h:Ar,t:$,dt:e,auto:Z,pointer:Er};t.update(n),Er.dx=0,Er.dy=0,Er.wheel=0,Er.click=null,q.clock=Math.min(dn+18,q.clock+e*q.rate),q.staging&&q.clock>=dn?(zr||(xn(`ignite`,{v:1}),zr=!0),q.stage=q.clock-dn):(q.stage=-1,zr=!1);let r=q.stage,i=fn(q.clock),a=1-Math.exp(-e*2.4);q.cut+=(q.cutT-q.cut)*a,q.explode+=(q.explodeT-q.explode)*a,Math.abs(q.cut-q.cutT)<.002&&(q.cut=q.cutT),Math.abs(q.explode-q.explodeT)<.002&&(q.explode=q.explodeT);let o=r>1.4?1.3*(r-1.4)**2:0;if(K.update({bLox:i.bLox,bCh4:i.bCh4,sLox:i.sLox,sCh4:i.sCh4,explode:q.explode,sep:o,cut:q.cut}),K.root.rotation.z=-i.pitch,r>2.5){let e=.035*(r-2.5)**2;K.booster.rotation.z=e;let t=new v(0,36,0);K.booster.position.copy(t).sub(t.clone().applyAxisAngle(new v(0,0,1),e)),K.booster.position.y-=1*(r-2.5)**2}else K.booster.rotation.z=0,K.booster.position.set(0,0,0);Q.cam&&(ur.pos.set(Q.cam[0],Q.cam[1],Q.cam[2]),ur.tgt.set(Q.cam[3],Q.cam[4],Q.cam[5]),ur.fov=Q.cam[6]??30),ur.apply(Zn,K.root),Zn.updateMatrixWorld();let s=i.h;G.off.set(i.x*Math.cos(0)+0,0).set(i.x,-1800+$*0),G.update(Zn,s,$),q.studio+=(q.studioT-q.studio)*(1-Math.exp(-e*2.2)),Math.abs(q.studio-q.studioT)<.002&&(q.studio=q.studioT);let c=D.smoothstep(q.studio,0,1),l=D.lerp(D.lerp(.32,.2,D.smoothstep(i.h,2e4,5e4)),.8,c),u=D.lerp(.32,.2,D.smoothstep(i.h,2e4,5e4))/l;G.studio.value=c,G.skyScale.value=u;let d=G.env();d&&(ir.tex=d),Xn.environment=c<.5?ir.tex:er,Xn.environmentIntensity=c<.5?u:.32,Hr.copy(G.sunCol),Qn.color.copy(Hr),Qn.intensity=17*u*(1-c),tr.intensity=.9*c,nr.intensity=1.1*c,tr.target.position.set(0,60,0).applyMatrix4(K.root.matrixWorld),tr.position.copy(tr.target.position).add(new v(-260,220,120)),nr.position.copy(tr.target.position).add(new v(240,120,-220)),nr.target.position.copy(tr.target.position);for(let e of rr)e.intensity=K.cut.capsOn?70*c:0;let f=new v(0,62,0).applyMatrix4(K.root.matrixWorld);Qn.position.copy(f).addScaledVector(G.sun,300),Qn.target.position.copy(f);let p=`${i.pitch.toFixed(3)}|${q.explode.toFixed(3)}|${o.toFixed(1)}|${K.booster.rotation.z.toFixed(3)}|${q.cut.toFixed(3)}`;p!==Br&&(Yn.shadowMap.needsUpdate=!0,Br=p),Vr.set(.18,.3,.6).multiplyScalar(1-D.smoothstep(i.h,2e4,7e4)*.8);let m=r<0,h=m||r<3.2?1:Math.max(0,1-(r-3.2)/.6),g=m?[1,1,1]:[1,0,0];ar.update(e,$,i.pa,m?i.thr:.45,h*(q.explode>.3?0:1)*(1-c)*Q.pk,g,Zn);let _=r>.35?Math.min(1,(r-.35)/.4):0;or.update(e,$,i.pa,1,_*Math.min(1,o/12+.25),[1,1,0],Zn);for(let e of or.lights)e.intensity*=.12;if(lr.update($,r>.3?Math.min(1,(r-.3)/.25)*Math.exp(-Math.max(0,r-1.2)*.9)*+(o<18):0),K.vacMat.emissiveIntensity=_*2.2,Ot.uScorch.value=r>.4?Math.min(1,(r-.4)/1.5):0,Ot.uBaseGlow.value.set(h*(q.explode>.3?0:1)*(.6+.4*Math.min(1,(101325-i.pa)/6e4)),_),We.value=$,Ge.value=1,Ke.value=1,Wn(q,e),sr.update($,Zn,G.sun,G.sunCol,Vr,i.h,m&&q.explode<.3?1-c:0,ar.s.len*.55,1+2.5*D.smoothstep(i.h,1e4,5e4)),cr.update($,i.mach,G.sun,G.sunCol,Vr),cr.group.visible=cr.group.visible&&q.explode<.05&&q.cut<.05&&c<.05,Q.hide)for(let e of Q.hide.split(`,`)){let t={plume:ar.mesh,splume:or.mesh,trail:sr.mesh,vapor:cr.group,vehicle:K.root.children[0]}[e];t&&(t.visible=!1)}Q.sun>=0&&(Qn.intensity=Q.sun),Q.env>=0&&(Xn.environmentIntensity=Q.env),Q.pts>=0&&Xn.traverse(e=>{e.isPointLight&&(e.intensity=Q.pts)}),pr=Math.min(1,pr+e/.4);let y=Z?D.clamp((t.length-fr)/.35,0,1):1;W.lens.u.uFade.value=Math.min(X===0&&Z?Math.min(1,fr/1.2):pr,y),Yn.toneMappingExposure=Q.exp||l,W.bloom.strength=D.lerp(.5,.45,c),W.bloom.radius=.55,W.bloom.threshold=D.lerp(24,3,c);let b=Zn.position.clone().addScaledVector(G.sun,1e3).project(Zn),x=b.z<1&&Math.abs(b.x)<1.2&&Math.abs(b.y)<1.2;W.lens.u.uSun.value.set(b.x*.5+.5,b.y*.5+.5),W.lens.u.uSunVis.value=x?.35*Wr()*(1-c):0,W.lens.u.uTime.value=$,W.render(e),Y.kicker.textContent=t.kicker;let S=t.stats().map(e=>`<div class="stat"><div class="k">${e.k}</div><div class="v ${e.c??``}">${e.v}${e.u?`<small>${e.u}</small>`:``}</div></div>`).join(``);S!==mr&&(Y.stats.innerHTML=S,mr=S);let C=t.text();C!==hr&&(Y.text.innerHTML=C,hr=C);let w=Z?t.caption():``;w!==gr&&(Y.cap.textContent=w,Rr=0,gr=w),Rr+=e;let T=Math.min(1,Rr/.5),E=1-(1-T)**3;Y.cap.style.transform=`translate(-50%, ${((1-E)*14).toFixed(1)}px)`,Y.cap.style.filter=T<1?`blur(${((1-E)*6).toFixed(1)}px)`:`none`,Y.cap.style.opacity=String(W.lens.u.uFade.value*Math.min(1,T*2.5));let O=new Set;for(let e of t.labels(n)){O.add(e.id);let t=Lr.get(e.id);(!t||!t.isConnected)&&(t=document.createElement(`div`),t.className=`pill`,Y.labels.appendChild(t),Lr.set(e.id,t));let n=`<i style="${e.dot?`background:${e.dot};color:${e.dot}`:``}"></i><b>${e.text}</b>${e.sub?`<span>${e.sub}</span>`:``}`;t.dataset.h!==n&&(t.innerHTML=n,t.dataset.h=n),t.style.transform=`translate(${e.x.toFixed(1)}px, ${e.y.toFixed(1)}px)`,t.style.opacity=String(e.vis*W.lens.u.uFade.value)}for(let[e,t]of Lr)O.has(e)||(t.remove(),Lr.delete(e));Gr.tick(e),Math.floor($*4)!==Math.floor(($-e)*4)&&Sr(),dr(`#progress`).style.width=`${Z?fr/t.length*100:0}%`}function Wr(){let e=K.root.matrixWorld.clone().invert(),t=Zn.position.clone().applyMatrix4(e),n=G.sun.clone().transformDirection(e),r=1;for(let e=0;e<=40;e++){let i=(I.top*e/40-t.y)/(n.y||1e-6);if(i<=0)continue;let a=t.clone().addScaledVector(n,i),o=Math.hypot(a.x,a.z);r=Math.min(r,D.smoothstep(o,N*.9,N*1.3))}return r}Nr(),vr(),xr(),document.body.classList.toggle(`film`,Kn);var Gr=we({id:`starship`,title:`Starship`,chapters:J.map(e=>({id:e.id,tab:e.tab,kicker:e.kicker,length:e.length})),controls:_r,index:()=>X,go:(e,t)=>{t&&wr(),Cr(e)},isAuto:()=>Z,setAuto:e=>{e!==Z&&(Z=e,Z?(fr=0,J[X].enter()):kn(-1),Tr())},progress:()=>fr/J[X].length,text:()=>J[X].text(),kicker:()=>J[X].kicker,stats:()=>J[X].stats(),renderer:Yn,quality:qn,setScale:e=>{jr=e,Nr()},getScale:()=>jr});if(window.__sim={sim:q,vehicle:K,sky:G,cam:Zn,rig:ur,bPlume:ar,sPlume:or,renderer:Yn,scene:Xn,pipe:W},Kn){Sn.film(()=>$),Cr(X);let e=0;window.__film={step:(e,t=1)=>{for(let n=0;n<t;n++)Ur(e)},goto:(e,t=!1)=>{Z=!0,Cr(e),fr=0,t&&(pr=1)},startAudio:()=>{Sn.filmReset(),e=$},audio:t=>Sn.renderFilm(t,e),chapters:J.map(e=>({id:e.id,length:e.length})),ready:!0}}else{Cr(X);let e=performance.now(),t=n=>{let r=n-e,i=Math.min(.05,r/1e3);e=n,Ir(r),Ur(i),requestAnimationFrame(t)};requestAnimationFrame(t)}