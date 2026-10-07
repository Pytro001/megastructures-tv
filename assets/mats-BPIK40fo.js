import{i as e}from"./remote-overlay-DttutIvP.js";import{At as t,Dt as n,E as r,N as i,R as a,V as o,_ as s,_t as c,c as l,d as u,et as d,f,h as p,l as m,m as h,p as g,tt as _,x as v,yt as y}from"./sim-shell-99_Ayh-q.js";var b=class extends p{constructor(){super(),e(this,`rt`,void 0),e(this,`scene`,null),e(this,`camera`,null),e(this,`dof`,!0),e(this,`fsq`,void 0),e(this,`u`,{tCol:{value:null},tDepth:{value:null},uNear:{value:.01},uFar:{value:60},uFocus:{value:2},uAperture:{value:0},uMaxR:{value:14},uTexel:{value:new n(1,1)}}),this.needsSwap=!0,this.rt=new t(4,4,{type:o,samples:4}),this.rt.depthTexture=new i(4,4),this.rt.depthTexture.type=a,this.fsq=new h(new y({uniforms:this.u,vertexShader:`varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,fragmentShader:`
        uniform sampler2D tCol, tDepth; uniform float uNear, uFar, uFocus, uAperture, uMaxR; uniform vec2 uTexel;
        varying vec2 vUv;
        float lin(float d){ return uNear * uFar / (uFar - d * (uFar - uNear)); }
        float coc(vec2 uv){ float z = lin(texture2D(tDepth, uv).r); return clamp(uAperture * abs(1.0 - uFocus / z) * 40.0, 0.0, uMaxR); }
        void main(){
          vec3 c0 = texture2D(tCol, vUv).rgb;
          float r0 = coc(vUv);
          if (uAperture <= 0.0 || r0 < 0.5) { gl_FragColor = vec4(c0, 1.0); return; }
          vec3 acc = c0; float w = 1.0;
          const int N = 40;
          for (int i = 1; i < N; i++) {
            float fi = float(i);
            float rr = sqrt(fi / float(N)) * r0;
            float a = fi * 2.39996;
            vec2 o = vec2(cos(a), sin(a)) * rr * uTexel;
            float rs = coc(vUv + o);
            float k = smoothstep(rr - 1.0, rr + 0.5, max(rs, r0 * 0.25));
            vec3 s = texture2D(tCol, vUv + o).rgb;
            float lum = dot(s, vec3(0.3, 0.6, 0.1));
            k *= 1.0 + smoothstep(1.5, 6.0, lum) * 2.0; // bright spots make bokeh
            acc += s * k; w += k;
          }
          gl_FragColor = vec4(acc / w, 1.0);
        }`}))}setSize(e,t){this.rt.setSize(e,t),this.u.uTexel.value.set(1/e,1/t)}render(e,t){this.scene&&this.camera&&(e.setRenderTarget(this.rt),e.setClearColor(0,1),e.clear(!0,!0,!0),e.render(this.scene,this.camera),this.u.tCol.value=this.rt.texture,this.u.tDepth.value=this.rt.depthTexture,this.u.uNear.value=this.camera.near,this.u.uFar.value=this.camera.far,this.dof||(this.u.uAperture.value=0),e.setRenderTarget(this.renderToScreen?null:t),this.fsq.render(e))}},x=class{constructor(r,i=!1){e(this,`renderer`,void 0),e(this,`composer`,void 0),e(this,`scene`,new b),e(this,`clamp`,new l),e(this,`bloom`,void 0),e(this,`lens`,new m),e(this,`out`,new u),this.renderer=new s({canvas:r,antialias:!1,powerPreference:`high-performance`,preserveDrawingBuffer:i}),this.renderer.toneMapping=4,this.renderer.outputColorSpace=c,this.renderer.shadowMap.enabled=!0,this.renderer.shadowMap.type=1;let a=new t(4,4,{type:o});this.composer=new g(this.renderer,a),this.bloom=new f(new n(256,256),.45,.6,1.1),this.composer.addPass(this.scene),this.composer.addPass(this.clamp),this.composer.addPass(this.bloom),this.composer.addPass(this.lens),this.composer.addPass(this.out)}resize(e,t,n){this.renderer.setPixelRatio(n),this.renderer.setSize(e,t,!1),this.composer.setPixelRatio(n),this.composer.setSize(e,t),this.scene.setSize(Math.round(e*n),Math.round(t*n)),this.lens.u.uAspect.value=e/t}setSamples(e){this.scene.rt.samples!==e&&(this.scene.rt.samples=e,this.scene.rt.dispose())}render(e){this.composer.render(e)}},S={z:{value:50},glow:{value:0}},C={z:{value:0},glow:{value:0}},w={z:{value:1e5},glow:{value:0}},T={muck:{value:0},thrust:{value:0},ring:{value:0},cut:{value:0},time:{value:0},face:{value:0},clipX:{value:-1e5}},E=`
float tb_h(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float tb_n(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(tb_h(i), tb_h(i + vec3(1,0,0)), f.x), mix(tb_h(i + vec3(0,1,0)), tb_h(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(tb_h(i + vec3(0,0,1)), tb_h(i + vec3(1,0,1)), f.x), mix(tb_h(i + vec3(0,1,1)), tb_h(i + vec3(1,1,1)), f.x), f.y), f.z); }
float tb_fbm(vec3 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * tb_n(p); p = p * 2.03 + 11.7; a *= 0.5; } return s; }
vec3 tb_bump(vec3 pos, vec3 n, float h, float k){
  vec3 sx = dFdx(pos), sy = dFdy(pos);
  vec3 r1 = cross(sy, n), r2 = cross(n, sx);
  float det = dot(sx, r1);
  vec3 g = sign(det) * (dFdx(h) * r1 + dFdy(h) * r2);
  return normalize(abs(det) * n - g * k);
}
`;function D(e,t={}){let n=t.cut??S,i=new r(t.cap??9212054),a=t.hl?T[t.hl]:{value:0},o=new r(t.hlColor??6215935);e.side=2,e.shadowSide=0,e.onBeforeCompile=e=>{e.uniforms.uCutZ=n.z,e.uniforms.uCutGlow=n.glow,e.uniforms.uCap={value:i},e.uniforms.uCapMetal={value:t.capMetal??.9},e.uniforms.uGrime={value:t.grime??0},e.uniforms.uBump={value:t.bump??0},e.uniforms.uBumpS={value:t.bumpScale??40},e.uniforms.uHl=a,e.uniforms.uHlC={value:o},e.uniforms.uTime=T.time,e.uniforms.uFace=T.face,e.uniforms.uClipX=T.clipX,t.uniforms&&Object.assign(e.uniforms,t.uniforms),e.vertexShader=e.vertexShader.replace(`#include <common>`,`#include <common>
varying vec3 vWP;
varying vec3 vOP;`).replace(`#include <project_vertex>`,`#include <project_vertex>
        { vec4 wp = vec4(transformed, 1.0);
          #ifdef USE_INSTANCING
          wp = instanceMatrix * wp;
          #endif
          vOP = wp.xyz;
          vWP = (modelMatrix * wp).xyz; }`),e.fragmentShader=e.fragmentShader.replace(`#include <common>`,`#include <common>
        varying vec3 vWP; varying vec3 vOP;
        uniform float uCutZ, uCutGlow, uCapMetal, uGrime, uBump, uBumpS, uHl, uTime, uFace, uClipX;
        uniform vec3 uCap, uHlC;
        ${E}
        ${t.pars??``}`).replace(`#include <clipping_planes_fragment>`,`#include <clipping_planes_fragment>
        if (vWP.z > uCutZ || vWP.x < uClipX) discard;
        ${t.discard??``}
        bool tbCap = !gl_FrontFacing;`).replace(`#include <color_fragment>`,`#include <color_fragment>
        ${t.color??``}
        float tbG = 0.0;
        if (uGrime > 0.0) {
          float gn = tb_fbm(vWP * 90.0);
          float nearFace = smoothstep(-0.12, 0.01, vWP.x - uFace);
          tbG = uGrime * smoothstep(0.5, 0.9, gn * 0.75 + nearFace * 0.5);
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.2, 0.15, 0.11), tbG * 0.7);
        }
        if (tbCap) diffuseColor.rgb = uCap * (0.92 + 0.08 * tb_n(vWP * 900.0));`).replace(`#include <roughnessmap_fragment>`,`#include <roughnessmap_fragment>
        roughnessFactor = mix(roughnessFactor, 0.9, tbG);
        if (uBump > 0.0) roughnessFactor *= 0.85 + 0.3 * tb_n(vWP * uBumpS * 2.3);
        if (tbCap) roughnessFactor = 0.32 + 0.1 * tb_n(vec3(vWP.xy * 4000.0, 0.0));`).replace(`#include <metalnessmap_fragment>`,`#include <metalnessmap_fragment>
        metalnessFactor = mix(metalnessFactor, 0.0, tbG);
        if (tbCap) metalnessFactor = uCapMetal;`).replace(`#include <normal_fragment_maps>`,`#include <normal_fragment_maps>
        if (tbCap) normal = normalize((viewMatrix * vec4(0.0, 0.0, 1.0, 0.0)).xyz);
        else if (uBump > 0.0) normal = tb_bump(-vViewPosition, normal, tb_fbm(vWP * uBumpS), uBump * 0.012);`).replace(`#include <emissivemap_fragment>`,`#include <emissivemap_fragment>
        { float e = 1.0 - smoothstep(0.0, 0.0035, uCutZ - vWP.z);
          totalEmissiveRadiance += vec3(0.35, 0.85, 1.0) * e * uCutGlow * 7.0;
          if (uHl > 0.001) {
            float pulse = 0.65 + 0.35 * sin(uTime * 3.0 - vWP.x * 40.0);
            float fres = pow(1.0 - abs(dot(normalize(vViewPosition), normal)), 2.0);
            totalEmissiveRadiance += uHlC * uHl * (0.08 + 0.7 * fres) * pulse;
          } }`)};let s=`tbcut-${n===S?`m`:n===C?`t`:`n`}-${t.hl??``}-${(t.pars??``)+(t.color??``)+(t.discard??``)}`;return e.customProgramCacheKey=()=>s,e}var O=(e,t)=>D(new _(e),t),k=(e,t)=>D(new d(e),t);function A(){return{head:k({color:15312148,metalness:.25,roughness:.42,clearcoat:.35,clearcoatRoughness:.35},{cap:10133672,grime:.9,bump:.25,bumpScale:45}),headDark:O({color:2829617,metalness:.7,roughness:.42},{cap:9212312,grime:.6,bump:.2}),cutter:O({color:10133928,metalness:1,roughness:.22},{cap:11909824,grime:.25}),cutterHub:O({color:3356219,metalness:.9,roughness:.38},{cap:10396585}),carbide:O({color:13159632,metalness:1,roughness:.16},{cap:13159632}),shield:k({color:7172985,metalness:.82,roughness:.36,clearcoat:.15},{cap:10725550,grime:.55,bump:.35,bumpScale:28}),shieldPaint:k({color:1911354,metalness:.35,roughness:.4,clearcoat:.5,clearcoatRoughness:.3},{cap:10133672,grime:.35,bump:.15}),steel:O({color:9080982,metalness:.9,roughness:.32},{cap:11580858,bump:.15}),darkSteel:O({color:2369323,metalness:.8,roughness:.45},{cap:9278104}),motor:k({color:3104138,metalness:.4,roughness:.35,clearcoat:.6,clearcoatRoughness:.2},{cap:10133672}),orange:k({color:14702107,metalness:.3,roughness:.38,clearcoat:.6,clearcoatRoughness:.25},{cap:10133672}),barrel:k({color:14196759,metalness:.35,roughness:.35,clearcoat:.7,clearcoatRoughness:.2},{cap:11580858,hl:`thrust`,hlColor:16752954}),chrome:O({color:15133422,metalness:1,roughness:.06},{cap:13685976,hl:`thrust`,hlColor:16752954}),rubber:O({color:1315862,metalness:0,roughness:.85},{cap:2236966}),screwTube:k({color:9117466,metalness:.35,roughness:.4,clearcoat:.5},{cap:10528170,grime:.4,hl:`muck`,hlColor:16757575}),screwFlight:O({color:10988979,metalness:1,roughness:.3},{cap:12633546,grime:.7}),white:k({color:15264230,metalness:.1,roughness:.45,clearcoat:.3},{cap:11909307,grime:.2}),erector:k({color:15312148,metalness:.25,roughness:.4,clearcoat:.4},{cap:10133672,grime:.2,hl:`ring`,hlColor:8188096}),lamp:new _({color:0,emissive:16769720,emissiveIntensity:9}),lampCool:new _({color:0,emissive:12576511,emissiveIntensity:7}),redLamp:new _({color:0,emissive:16722458,emissiveIntensity:10}),greenLamp:new _({color:0,emissive:3800968,emissiveIntensity:8})}}function j(){let e={cut:C};return{segment:O({color:12433581,metalness:0,roughness:.82},{...e,cap:10262413,capMetal:0,bump:.5,bumpScale:70,hl:`ring`,hlColor:8188096}),key:O({color:13222579,metalness:0,roughness:.8},{...e,cap:10262413,capMetal:0,bump:.5,bumpScale:70,hl:`ring`,hlColor:8188096}),grout:O({color:7304296,metalness:0,roughness:.95},{...e,cap:6120024,capMetal:0,bump:.6,bumpScale:50}),gantry:k({color:15264230,metalness:.15,roughness:.45,clearcoat:.3},{...e,cap:11909307,grime:.15}),rail:O({color:15315734,metalness:.3,roughness:.45},{...e,cap:10528170}),steel:O({color:8423052,metalness:.9,roughness:.34},{...e,cap:11580858}),dark:O({color:2500909,metalness:.7,roughness:.5},{...e,cap:9278104}),cabinet:k({color:3820124,metalness:.4,roughness:.38,clearcoat:.4},{...e,cap:10133672}),tank:k({color:3111509,metalness:.3,roughness:.35,clearcoat:.5},{...e,cap:10133672}),tankBlue:k({color:2776470,metalness:.3,roughness:.35,clearcoat:.5},{...e,cap:10133672}),orange:k({color:14702107,metalness:.3,roughness:.38,clearcoat:.6},{...e,cap:10133672}),duct:O({color:14275780,metalness:0,roughness:.7},{...e,cap:12104612,capMetal:0,bump:.4,bumpScale:20}),belt:O({color:1579291,metalness:0,roughness:.75},{...e,cap:2763566,capMetal:0,hl:`muck`,hlColor:16757575}),pipeR:k({color:11740702,metalness:.3,roughness:.35,clearcoat:.5},{...e,cap:10528170}),pipeB:k({color:2451896,metalness:.3,roughness:.35,clearcoat:.5},{...e,cap:10528170}),pipeG:k({color:3050062,metalness:.3,roughness:.35,clearcoat:.5},{...e,cap:10528170}),cable:O({color:1118740,metalness:.1,roughness:.6},{...e,cap:3355443}),hivis:O({color:16742938,metalness:0,roughness:.6,emissive:2755840},{...e,cap:16742938,capMetal:0}),helmet:O({color:15921902,metalness:0,roughness:.35},{...e,cap:15921902,capMetal:0}),skin:O({color:9067068,metalness:0,roughness:.6},{...e,cap:9067068,capMetal:0}),lamp:new _({color:0,emissive:16769720,emissiveIntensity:7})}}function M(){let e=document.createElement(`canvas`);e.width=e.height=64;let t=e.getContext(`2d`),n=t.createRadialGradient(32,32,0,32,32,32);n.addColorStop(0,`rgba(255,255,255,1)`),n.addColorStop(.25,`rgba(255,255,255,0.6)`),n.addColorStop(1,`rgba(255,255,255,0)`),t.fillStyle=n,t.fillRect(0,0,64,64);let r=new v(e);return r.colorSpace=c,r}export{w as a,A as c,E as i,j as l,C as n,D as o,T as r,M as s,S as t,x as u};