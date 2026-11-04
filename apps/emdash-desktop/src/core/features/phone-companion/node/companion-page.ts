/** The phone page: one self-contained document, no external hosts, no build step. */
export const COMPANION_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#111214">
<meta name="referrer" content="no-referrer">
<title>Emdash</title>
<style>
:root{color-scheme:dark;--bg:#0e0f12;--card:#17191d;--line:#262930;--fg:#eceef2;--dim:#8d929c;
--blue:#4c8dff;--amber:#f5a524;--green:#3fb950;--red:#f85149}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.4 -apple-system,system-ui,sans-serif;
padding:0 12px calc(24px + env(safe-area-inset-bottom))}
header{position:sticky;top:0;z-index:1;background:var(--bg);display:flex;justify-content:space-between;align-items:center;
padding:calc(12px + env(safe-area-inset-top)) 4px 10px}
h1{font-size:20px;margin:0;letter-spacing:-.2px}
#conn{font-size:12px;color:var(--dim);display:flex;align-items:center;gap:6px}
#conn::before{content:'';width:7px;height:7px;border-radius:50%;background:var(--dim)}
#conn.live::before{background:var(--green)}
.card{background:var(--card);border:1px solid var(--line);border-radius:14px;padding:14px;margin-bottom:10px}
.working{border-color:#2b4a85}.awaiting-input{border-color:#6b4f1a}.error{border-color:#6e2a27}
.row{display:flex;gap:10px;align-items:center}.grow{flex:1;min-width:0}
.t{font-weight:600;font-size:16px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.s{color:var(--dim);font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.dot{width:10px;height:10px;border-radius:50%;flex:none;background:#5a5f69}
.working .dot{background:var(--blue);animation:p 1.2s infinite}.awaiting-input .dot{background:var(--amber)}
.completed .dot{background:var(--green)}.error .dot{background:var(--red)}
@keyframes p{50%{opacity:.3}}
.badge{flex:none;font-size:12px;font-weight:600;border-radius:99px;padding:3px 10px;background:#23262c;color:var(--dim)}
.working .badge{background:#16274a;color:#8fb6ff}.awaiting-input .badge{background:#3a2a0b;color:var(--amber)}
.completed .badge{background:#12301b;color:#6fdc86}.error .badge{background:#3d1514;color:#ff8a83}
.reply{margin-top:10px;padding:10px 12px;border-radius:10px;background:#101215;color:#c9ccd3;font-size:14px;
white-space:pre-wrap;word-break:break-word;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.reply.open{display:block}
form{display:flex;gap:8px;margin-top:10px}
input[type=text]{flex:1;min-width:0;background:#101215;color:var(--fg);border:1px solid var(--line);border-radius:10px;padding:11px 12px;font:inherit;font-size:16px}
input[type=text]:focus{outline:none;border-color:var(--blue)}
button{background:var(--blue);color:#fff;border:0;border-radius:10px;padding:0 16px;font:inherit;font-weight:600}
button:disabled{opacity:.5}
.fail{color:var(--red);font-size:13px;margin-top:6px}.fail:empty{display:none}
#alerts .card{border-color:#6b4f1a}#alerts .card.done{border-color:#1f5a2c}#alerts .card.err{border-color:#6e2a27}
#alerts .card .s{white-space:normal}
.empty{text-align:center;color:var(--dim);padding:48px 12px}
</style></head><body>
<header><h1>Emdash</h1><span id="conn">connecting</span></header>
<div id="alerts"></div><div id="list"></div>
<script>
(function(){
  var KEY='emdash-companion-token',q=new URLSearchParams(location.search),t=q.get('t');
  if(t){try{localStorage.setItem(KEY,t)}catch(e){}history.replaceState(null,'',location.pathname)}
  var token=t||(function(){try{return localStorage.getItem(KEY)}catch(e){return null}})();
  var last=0,seeded=false,list=document.getElementById('list'),alerts=document.getElementById('alerts'),conn=document.getElementById('conn');
  var LABEL={idle:'Idle',working:'Working','awaiting-input':'Needs input',completed:'Done',error:'Error'};
  function api(path,opts){opts=opts||{};opts.headers={Authorization:'Bearer '+token,'Content-Type':'application/json'};
    return fetch(path,opts).then(function(r){if(r.status===401||r.status===429)throw new Error('auth');return r.json()})}
  function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
  function ago(ms){var m=Math.round((Date.now()-ms)/60000);return m<1?'just now':m<60?m+'m ago':Math.round(m/60)+'h ago'}
  function cap(x){return x?x.charAt(0).toUpperCase()+x.slice(1):''}
  var ORDER={'awaiting-input':0,working:1,error:2,completed:3,idle:4},open={};
  function notify(a){
    if(navigator.vibrate)navigator.vibrate(a.kind==='done'?120:[120,60,120]);
    if(window.Notification&&Notification.permission==='granted'){try{new Notification(a.title,{body:a.text})}catch(e){}}
    var c=el('div','card '+(a.kind==='done'?'done':a.kind==='error'?'err':''));
    c.appendChild(el('div','t',a.title));c.appendChild(el('div','s',a.text));
    c.onclick=function(){c.remove()};alerts.prepend(c);document.title=(a.kind==='needs-input'?'(!) ':'')+'Emdash';
  }
  function render(sessions){
    list.textContent='';
    if(!sessions.length){list.appendChild(el('div','empty','No agent sessions running'));return}
    sessions.slice().sort(function(a,b){return (ORDER[a.status]-ORDER[b.status])||((b.activityAt||0)-(a.activityAt||0))})
    .forEach(function(s){
      var c=el('div','card '+s.status),r=el('div','row'),g=el('div','grow');
      r.appendChild(el('span','dot'));g.appendChild(el('div','t',s.task));
      g.appendChild(el('div','s',[cap(s.provider),s.project].concat(s.activityAt?[ago(s.activityAt)]:[]).join(' \u00b7 ')));
      r.appendChild(g);r.appendChild(el('span','badge',LABEL[s.status]||s.status));c.appendChild(r);
      if(s.lastReply){var p=el('div','reply'+(open[s.id]?' open':''),s.lastReply);
        p.onclick=function(){open[s.id]=!open[s.id];p.classList.toggle('open')};c.appendChild(p)}
      if(s.canMessage){
        var f=el('form'),i=el('input');i.type='text';i.placeholder='Reply to '+cap(s.provider);i.maxLength=4000;i.autocomplete='off';i.enterKeyHint='send';
        var b=el('button',null,'Send');b.type='submit';var m=el('div','fail');
        f.onsubmit=function(ev){ev.preventDefault();if(!i.value.trim())return;b.disabled=true;
          api('/api/sessions/'+encodeURIComponent(s.id)+'/message',{method:'POST',body:JSON.stringify({text:i.value})})
            .then(function(res){if(res.ok){i.value='';m.textContent=''}else m.textContent=res.error||'Failed'})
            .catch(function(){m.textContent='Failed'}).then(function(){b.disabled=false})};
        f.appendChild(i);f.appendChild(b);c.appendChild(f);c.appendChild(m);
      }
      list.appendChild(c);
    });
  }
  var typing=false;
  document.addEventListener('focusin',function(e){typing=e.target.tagName==='INPUT'});
  document.addEventListener('focusout',function(){typing=false});
  function poll(){
    if(!token){conn.textContent='scan the QR code in Emdash settings';return}
    api('/api/state?since='+last).then(function(s){
      conn.textContent='live';conn.className='live';
      if(seeded)s.alerts.forEach(notify);
      seeded=true;last=s.lastAlertId;
      if(!typing)render(s.sessions);
    }).catch(function(e){conn.className='';conn.textContent=e.message==='auth'?'not authorised - re-scan QR':'offline'});
  }
  document.body.addEventListener('click',function(){
    if(window.Notification&&Notification.permission==='default')try{Notification.requestPermission()}catch(e){}
  },{once:true});
  poll();setInterval(poll,2500);
})();
</script></body></html>`;
