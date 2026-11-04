/** The phone page: one self-contained document, no external hosts, no build step. */
export const COMPANION_PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<meta name="theme-color" content="#111214">
<meta name="referrer" content="no-referrer">
<title>Emdash</title>
<style>
:root{color-scheme:dark;--bg:#111214;--card:#1b1d21;--line:#2a2d33;--fg:#e8e9ec;--dim:#8b909a}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px system-ui,sans-serif;padding:env(safe-area-inset-top) 12px 24px}
h1{font-size:17px;margin:14px 2px 10px;display:flex;justify-content:space-between;align-items:center}
#conn{font-size:12px;color:var(--dim)}
.card{background:var(--card);border:1px solid var(--line);border-radius:12px;padding:12px;margin-bottom:10px}
.row{display:flex;gap:8px;align-items:center}.grow{flex:1;min-width:0}
.t{font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.s{color:var(--dim);font-size:12px}
.dot{width:10px;height:10px;border-radius:50%;flex:none;background:#666}
.working .dot{background:#4c8dff;animation:p 1.2s infinite}.awaiting-input .dot{background:#f5a524}
.completed .dot{background:#3fb950}.error .dot{background:#f85149}
@keyframes p{50%{opacity:.35}}
.badge{font-size:11px;border:1px solid var(--line);border-radius:99px;padding:2px 8px;color:var(--dim)}
.awaiting-input .badge{color:#f5a524;border-color:#f5a524}.error .badge{color:#f85149;border-color:#f85149}
form{display:flex;gap:8px;margin-top:10px}
input[type=text]{flex:1;min-width:0;background:#0d0e10;color:var(--fg);border:1px solid var(--line);border-radius:8px;padding:10px;font:inherit}
button{background:#2f6fed;color:#fff;border:0;border-radius:8px;padding:10px 14px;font:inherit}
button:disabled{opacity:.5}
#alerts .card{border-color:#f5a524}#alerts .done{border-color:#3fb950}#alerts .err{border-color:#f85149}
.fail{color:#f85149;font-size:12px;margin-top:6px;min-height:1em}
</style></head><body>
<h1>Emdash <span id="conn">connecting</span></h1>
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
  function notify(a){
    if(navigator.vibrate)navigator.vibrate(a.kind==='done'?120:[120,60,120]);
    if(window.Notification&&Notification.permission==='granted'){try{new Notification(a.title,{body:a.text})}catch(e){}}
    var c=el('div','card '+(a.kind==='done'?'done':a.kind==='error'?'err':''));
    c.appendChild(el('div','t',a.title));c.appendChild(el('div','s',a.text));
    c.onclick=function(){c.remove()};alerts.prepend(c);document.title=(a.kind==='needs-input'?'(!) ':'')+'Emdash';
  }
  function render(sessions){
    list.textContent='';
    if(!sessions.length)list.appendChild(el('div','s','No agent sessions'));
    sessions.forEach(function(s){
      var c=el('div','card '+s.status),r=el('div','row'),g=el('div','grow');
      r.appendChild(el('span','dot'));g.appendChild(el('div','t',s.task+' - '+s.title));
      g.appendChild(el('div','s',s.project+' / '+s.provider));r.appendChild(g);
      r.appendChild(el('span','badge',LABEL[s.status]||s.status));c.appendChild(r);
      if(s.canMessage){
        var f=el('form'),i=el('input');i.type='text';i.placeholder='Follow-up message';i.maxLength=4000;i.autocomplete='off';
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
      conn.textContent='live';
      if(seeded)s.alerts.forEach(notify);
      seeded=true;last=s.lastAlertId;
      if(!typing)render(s.sessions);
    }).catch(function(e){conn.textContent=e.message==='auth'?'not authorised - re-scan QR':'offline'});
  }
  document.body.addEventListener('click',function(){
    if(window.Notification&&Notification.permission==='default')try{Notification.requestPermission()}catch(e){}
  },{once:true});
  poll();setInterval(poll,2500);
})();
</script></body></html>`;
