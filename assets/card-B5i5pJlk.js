import{c as e,r as t,u as n}from"./tv-DT7ePuF8.js";var r={measuredAt:`2026-10-07T17:54:06.162Z`,machine:`Apple Silicon Mac, headless Chromium (ANGLE Metal), 1920x1080, vsync off`,rows:[{sim:`tbm`,chapter:`street`,mode:`desktop`,fps:35.24377773579773,p95:55.899999999999636,calls:303,tris:478079,px:`1920x1080`,scale:1},{sim:`tbm`,chapter:`street`,mode:`TV mode`,fps:56.19603733093777,p95:37,calls:373,tris:482551,px:`1920x1080`,scale:1},{sim:`starship`,chapter:`climb`,mode:`desktop`,fps:21.95953381231503,p95:36.900000000001455,calls:248,tris:5953940,px:`1920x1080`,scale:1},{sim:`starship`,chapter:`climb`,mode:`TV mode`,fps:69.9250158099196,p95:13.799999999999272,calls:248,tris:5953940,px:`1920x1080`,scale:1},{sim:`tsunami`,chapter:`city`,mode:`desktop`,fps:40.93158718128089,p95:44.29999999999927,calls:66,tris:1980187,px:`1920x1080`,scale:1},{sim:`tsunami`,chapter:`city`,mode:`TV mode`,fps:67.48682586631905,p95:26.799999999999272,calls:66,tris:1234387,px:`1920x1080`,scale:1}]},i=document.getElementById(`card`),a=e.get(`card`)??`arch`;t&&document.body.classList.add(`tv-film`);var o=`<i class="b live">live</i>`,s=`<i class="b ready">code ready</i>`;if(a===`perf`){let e={tbm:`Tunnel Boring Machine`,starship:`Starship`,tsunami:`Tsunami`},t=[...new Set(r.rows.map(e=>e.sim))],n=Math.max(...r.rows.map(e=>e.fps))/.8;i.className=`c-perf`,i.innerHTML=`<h1>TV performance mode</h1><p class="sub">No multisampling, smaller shadow maps, a fixed light budget, lower ray march steps and terrain detail, dynamic resolution</p>
    <div class="bars">${t.map((t,i)=>{let a=r.rows.find(e=>e.sim===t&&e.mode===`desktop`),o=r.rows.find(e=>e.sim===t&&e.mode===`TV mode`);return`<div class="pr" style="--i:${i}"><div class="pn">${e[t]??t}</div>
        <div class="pb"><i class="d" style="--w:${a.fps/n*100}%"></i><span>${a.fps.toFixed(0)} fps</span></div>
        <div class="pb"><i class="t" style="--w:${o.fps/n*100}%"></i><span>${o.fps.toFixed(0)} fps</span></div></div>`}).join(``)}</div>
    <div class="legend" style="--i:4"><i class="sw d"></i>desktop quality &nbsp;&nbsp; <i class="sw t"></i>TV mode &nbsp;&nbsp; measured at 1920x1080 on a laptop GPU, vsync off</div>`}else if(a===`built`)i.className=`c-built`,i.innerHTML=`<h1>Built during the hackathon</h1><ul>${[`Fire OS shell`,`D-pad UI`,`Voice to simulation`,`TV performance mode`,`Open source engine`].map((e,t)=>`<li style="--i:${t}"><span class="tick"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></span>${e}</li>`).join(``)}</ul>`;else{i.className=`c-arch`;let e=(e,t,n,r)=>`<div class="n" style="--i:${e}"><div class="nt">${t}${r}</div><div class="ns">${n}</div></div>`;i.innerHTML=`
    <h1>How a question changes the film</h1>
    <div class="flow">
      ${e(0,`Fire TV remote`,`D-pad for chapters and settings. Menu to ask.`,``)}
      <span class="ar" style="--i:0.5"></span>
      ${e(1,`Fire OS app`,`Kotlin WebView shell, Leanback launcher, key bridge, SpeechRecognizer`,s)}
      <span class="ar" style="--i:1.5"></span>
      ${e(2,`Live 3D film`,`Three.js scene engine in TV performance mode`,o)}
      <span class="ar" style="--i:2.5"></span>
      ${e(3,`Answer service`,`/api/ask in Node today. Same handler for AWS Lambda and API Gateway.`,o)}
      <span class="ar" style="--i:3.5"></span>
      ${e(4,`Amazon Bedrock`,`Claude Sonnet 4.5, Converse API, tool use`,o)}
    </div>
    <div class="back" style="--i:5">
      <div class="tools"><code>jumpToChapter</code><code>setParam</code><code>explain</code></div>
      <div class="bt">Tool calls come back, are checked against the live ranges on screen, and move the simulation. The answer is spoken and captioned.</div>
    </div>
    <div class="legend" style="--i:6">${o} ran in this video &nbsp;&nbsp; ${s} written, not deployed: Lambda, API Gateway, Amazon Polly, S3, Fire OS build</div>`}t&&(n(0),window.__film={ready:!0,step:(e,t=1)=>{for(let r=0;r<t;r++)n(e)}});