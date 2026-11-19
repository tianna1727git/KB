import {loginRobotFront,loginRobotSheet} from './login-robot.mjs';
import {loginHandwritingFont} from './login-font.mjs';
export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
export function loginPage(message = '') {
  return page(`<section class="login-scene">
    <header class="brand"><h1>Innatia<span class="brand-dot">.</span></h1><p class="slogan">Turn Knowledge &amp; Insights into B2B Content</p></header>
    <div class="login-workspace"><div class="mechanic" aria-hidden="true"><div class="robot-turntable"><div class="robot-actor">
      <div class="robot-pose robot-front"></div><div class="robot-pose robot-open"></div><div class="robot-pose robot-back"></div>
      <div class="feeding-arm">
        <div class="arm-ink"></div>
        <svg class="robot-key" viewBox="0 0 1001 1571" preserveAspectRatio="none" fill="none">
          <defs><filter id="graphite" x="-15%" y="-15%" width="130%" height="130%">
            <feTurbulence type="fractalNoise" baseFrequency=".17" numOctaves="3" result="grain"/>
            <feDisplacementMap in="SourceGraphic" in2="grain" scale="3"/>
          </filter></defs>
          <g stroke="#302e2b" stroke-linejoin="round" stroke-linecap="round" filter="url(#graphite)">
            <path stroke-width="8" d="M799 677c-20-2-33-15-31-33 2-18 17-29 34-27 20 2 31 16 28 34-2 16-15 27-31 26z"/>
            <path stroke-width="5" d="M801 664c-12 1-21-8-20-18s9-16 20-16c11 1 18 9 17 19-1 8-8 14-17 15z"/>
            <path stroke-width="8" d="m795 678 1 108 15 1-1-14 18-1-1-14-17 1-1-14 18-1-1-13-18 1-2-55"/>
            <path stroke-width="2" opacity=".55" d="m802 686 1 39m-26-88q6-16 23-16"/>
          </g>
        </svg>
      </div>
    </div></div></div><div class="login-form"><h2 class="sr-only">登录工作台</h2>
    ${message ? `<p class="error" role="alert">${escapeHTML(message)}</p>` : ''}
    <form action="/auth/login" method="post"><label for="username">Username</label><input id="username" name="username" autocomplete="username" required maxlength="80" placeholder=" ">
    <label for="password">Password</label><input id="password" name="password" type="password" autocomplete="current-password" required maxlength="256" placeholder=" ">
    <button type="submit"><span>Log in</span><svg class="login-key" aria-hidden="true" viewBox="0 0 80 30" fill="none"><g stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="14" r="8"/><circle cx="12" cy="14" r="3"/><path d="M20 14h27m-8 0v6h5v-6m-15 0v4m30-12q10-3 14 8l-1 12-18 1-1-11q0-7 6-10zm0 8h5l-1 9h-5z"/></g></svg></button></form>
    </div></div></section>`);
}
export function page(content) {
  return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="strict-origin-when-cross-origin"><title>登录 · Innatia</title><style>
  *{box-sizing:border-box}body{margin:0;min-height:100dvh;display:grid;place-items:center;padding:32px 24px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif;background:#fbfaf7;color:#262625;-webkit-font-smoothing:antialiased}main{width:100%;max-width:352px;padding:24px 0}h1{font-size:28px;line-height:1.35;font-weight:650;letter-spacing:-.7px;margin:0 0 36px}label{display:block;font-size:13px;font-weight:500;line-height:1.5;margin:22px 0 8px}input{display:block;width:100%;height:44px;padding:10px 12px;border:1px solid #d9d9d6;border-radius:4px;background:#fff;color:inherit;font:inherit;font-size:14px;transition:border-color .15s}input::placeholder{color:#a1a19d}input:hover{border-color:#b4b4b0}input:focus-visible{outline:2px solid #40403e;outline-offset:2px;border-color:#40403e}button,.button{display:block;text-align:center;width:100%;margin-top:28px;padding:11px 16px;border:1px solid #262625;border-radius:4px;background:#262625;color:#fff;font:inherit;font-size:14px;font-weight:500;line-height:1.5;cursor:pointer;text-decoration:none;transition:background .15s}button:hover,.button:hover{background:#41413e}button:focus-visible,a:focus-visible{outline:2px solid #747470;outline-offset:3px}.error{font-size:13px;line-height:1.7;padding:12px;border:1px solid #dededb;border-radius:4px;background:#f7f7f5;color:#494945;margin:0 0 20px}.intro{color:#787873;font-size:14px;line-height:1.8}#feedback{font-size:13px;color:#787873;line-height:1.7;margin:16px 0 0}#feedback:empty{display:none}@media(max-width:480px){main{max-width:352px}h1{font-size:26px}}@media(prefers-reduced-motion:reduce){*{transition:none!important}}
@font-face{font-family:Innatia Hand;src:url(data:font/woff;base64,${loginHandwritingFont}) format('woff');font-weight:400;font-display:swap}
main:has(.login-scene){max-width:1080px;padding:0}.login-scene{width:100%;--paper:#fbfaf7;--pencil:#36372f}.login-scene .brand{text-align:center}.login-scene .brand h1{font-family:Georgia,'Times New Roman',serif;font-weight:600;font-size:clamp(80px,9vw,132px);line-height:1.08;letter-spacing:-6px;margin:0;color:var(--pencil)}.brand-dot{color:#8e927e}.login-scene .slogan{font-family:Innatia Hand,sans-serif;color:#8c8d80;font-size:22px;letter-spacing:.35px;line-height:1.6;margin:24px 0 0}.login-workspace{display:grid;grid-template-columns:340px minmax(0,380px);gap:120px;align-items:center;justify-content:center;margin:64px auto 0}.mechanic{position:relative;width:340px;height:420px;isolation:isolate;pointer-events:none;user-select:none}.robot-turntable{position:relative;width:300px;height:600px;margin:-85px auto 0;transform:perspective(900px) rotateY(0deg);transition:transform .5s cubic-bezier(.4,0,.2,1)}.robot-actor{position:relative;width:100%;height:100%;transform-origin:50% 80%;animation:sketch-life 10s ease-in-out infinite}.robot-pose{position:absolute;inset:15% 4%;background-image:url('${loginRobotSheet}');background-repeat:no-repeat;background-size:200% 100%;pointer-events:none}.robot-actor { --front-art: url('${loginRobotFront}'); }
.robot-front, .robot-open {
  background-image: var(--front-art);
  background-position: center;
  background-size: 100% 100%;
  /* Trace the seam below both lenses in the original drawing. */
}
.robot-front { clip-path: polygon(0% 36%, 8% 38%, 20% 41%, 34% 44%, 52% 45.5%, 65% 45%, 67% 45%, 67% 51%, 53.5% 53%, 53.5% 64%, 100% 64%, 100% 100%, 0% 100%); }
.robot-open {
  clip-path: polygon(0% 0%, 100% 0%, 100% 42.5%, 88% 42.5%, 76% 42.8%, 71% 42.4%, 67% 41.7%, 65% 45%, 52% 45.5%, 34% 44%, 20% 41%, 8% 38%, 0% 36%);
  transform-origin: 8% 38%;
  animation: open-lid 10s ease-in-out infinite;
}
.robot-back { background-position: 0 0; opacity: 0; transition: opacity .22s ease; }
/* Shoulder pivot and fingers use the original artwork coordinates. */
.feeding-arm { position:absolute; inset:15% 4%; transform-origin:53.5% 54.5%; animation:feed-key 10s ease-in-out infinite; }
.arm-ink { position:absolute; inset:0; background:var(--front-art) center / 100% 100% no-repeat; clip-path:polygon(53.5% 53.5%, 75% 53.5%, 75% 46%, 90% 46%, 90% 64%, 53.5% 64%); }
.robot-key { position:absolute; inset:0; width:100%; height:100%; transform-origin:80% 50%; animation:key-snack 10s ease-in-out infinite; }
@keyframes feed-key {
  0%, 46%, 78%, 100% { transform:rotate(0); }
  59%, 66% { transform:rotate(-53deg); }
}
.login-scene:has(#password:hover,#password:focus,#password:not(:placeholder-shown)) .feeding-arm { visibility:hidden; }
@media(prefers-reduced-motion:reduce){ .feeding-arm {animation:none;} }
@keyframes open-lid {
  0%, 43%, 78%, 100% { transform: rotate(0); }
  52%, 67% { transform: rotate(-45deg); }
}
@keyframes key-snack {
  0%, 59%, 100% { opacity:1; transform:rotate(0); }
  65%, 83% { opacity:0; transform:translate(-7%, -2%) scale(.25); }
  87% { opacity:0; transform:rotate(0); }
  94% { opacity:1; transform:rotate(0); }
}
@keyframes sketch-life{0%,40%,100%{transform:translateY(0) rotate(0)}24%{transform:translateY(-2px) rotate(.35deg)}65%{transform:translateY(1px) rotate(-.3deg)}76%{transform:translateY(3px) rotate(.3deg)}82%{transform:translateY(0)}}
.login-scene:has(#password:hover,#password:focus,#password:not(:placeholder-shown)) .robot-turntable{transform:perspective(900px) rotateY(180deg)}
.login-scene:has(#password:hover,#password:focus,#password:not(:placeholder-shown)) .robot-front,.login-scene:has(#password:hover,#password:focus,#password:not(:placeholder-shown)) .robot-open,.login-scene:has(#password:hover,#password:focus,#password:not(:placeholder-shown)) .robot-key{animation:none!important;opacity:0!important}
.login-scene:has(#password:hover,#password:focus,#password:not(:placeholder-shown)) .robot-back{opacity:1!important}
.login-scene:has(#password:hover,#password:focus,#password:not(:placeholder-shown)) .robot-actor{animation-play-state:paused}
.login-form label,.login-form input,.login-form button{font-family:Innatia Hand,sans-serif;font-weight:400}.login-form label{font-size:22px;color:#808274;margin:0 0 10px}.login-form input{border:0;border-bottom:1px solid #b7b8aa;border-radius:0;background:transparent;padding:10px 0;height:55px;font-size:25px;margin-bottom:35px;color:#45473e;transition:border-color .2s}.login-form input:hover{border-bottom-color:#737866}.login-form input:focus-visible{outline:2px solid #9ca18a;outline-offset:6px;border-bottom-color:#45473e}.login-form input[type=password]{font-family:system-ui,sans-serif;font-size:20px}.login-form button{display:flex;align-items:center;justify-content:space-between;gap:32px;width:210px;margin-top:48px;padding:8px 0;border:0;border-bottom:1px solid #9fa38f;border-radius:0;background:transparent;color:#585d4b;font-size:24px}.login-form button:hover{background:transparent;border-color:#363b2b}.login-key{width:76px;height:32px}.login-key g{transition:transform .2s}.login-form button:hover .login-key g{transform:translateX(3px)}.login-form .error{margin-bottom:26px;border:0;border-left:2px solid #9b7662;background:transparent;padding:6px 12px;color:#865f4b}.sr-only{position:absolute;width:1px;height:1px;padding:0;margin:-1px;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0}
@media(max-width:780px){.login-workspace{grid-template-columns:280px minmax(0,320px);gap:40px}.mechanic{width:280px}.login-scene .slogan{font-size:19px}}
@media(max-width:600px){main:has(.login-scene){max-width:380px}.login-scene .brand h1{font-size:76px;letter-spacing:-3px}.login-scene .slogan{font-size:17px;margin-top:14px}.login-workspace{grid-template-columns:1fr;gap:10px;margin-top:30px}.mechanic{width:100%;height:245px}.robot-turntable{width:200px;height:400px;margin:-54px auto 0}.login-form{padding:0 12px}.login-form label{font-size:20px}.login-form input{height:44px;margin-bottom:26px}.login-form button{font-size:22px;margin-top:28px;width:190px}}
@media(prefers-reduced-motion:reduce){.robot-actor,.robot-pose,.robot-key{animation:none!important;transition:none!important}.robot-turntable{transition:none!important}.robot-front,.robot-key{opacity:1}.robot-back{opacity:0}.login-scene:has(#password:hover,#password:focus,#password:not(:placeholder-shown)) .robot-turntable{transform:none}}

  </style></head><body><main>${content}</main></body></html>`;
}
