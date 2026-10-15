'use strict';
/* Solo actúa dentro de la APK (Capacitor). En la web no hace nada.
   El WebView de Android ignora <a download>; aquí se guarda el archivo y se abre el menú Compartir/Guardar. */
(() => {
  const cap=window.Capacitor;
  if(!cap||typeof cap.isNativePlatform!=='function'||!cap.isNativePlatform())return;
  const call=(plugin,method,opts)=>{
    const p=cap.Plugins&&cap.Plugins[plugin];
    if(p&&typeof p[method]==='function')return p[method](opts);
    if(typeof cap.nativePromise==='function')return cap.nativePromise(plugin,method,opts);
    return Promise.reject(new Error('Plugin '+plugin+' no disponible'));
  };
  const toBase64=blob=>new Promise((ok,ko)=>{const r=new FileReader();r.onload=()=>ok(String(r.result).split(',')[1]||'');r.onerror=()=>ko(r.error);r.readAsDataURL(blob)});
  function notice(text){
    let n=document.getElementById('fh-native-notice');
    if(!n){n=document.createElement('div');n.id='fh-native-notice';n.style.cssText='position:fixed;left:12px;right:12px;bottom:calc(env(safe-area-inset-bottom,0px) + 12px);z-index:99999;padding:12px 14px;background:#101216;border:1px solid #5c5d66;border-left:4px solid #ed2930;color:#fff;font:600 14px/1.35 system-ui,sans-serif';}
    (document.querySelector('dialog[open]')||document.body).appendChild(n);
    n.textContent=text;n.hidden=false;clearTimeout(notice.t);notice.t=setTimeout(()=>{n.hidden=true},3500);
  }
  window.FixtureHunterNotice=text=>notice((window.FHT||(s=>s))(text));
  async function save(href,name){
    try{
      const response=await fetch(href);if(!response.ok)throw new Error('HTTP '+response.status);
      const blob=await response.blob();
      const data=await toBase64(blob);
      const file=await call('Filesystem','writeFile',{path:name,data,directory:'CACHE',recursive:true});
      try{await call('Share','share',{title:name,url:file.uri,dialogTitle:'Guardar o compartir '+name})}
      catch(e){if(!/cancel/i.test(String(e&&e.message)))throw e}
    }catch(e){console.error('[native-bridge]',e);notice('No se ha podido guardar '+name+'.')}
  }
  document.addEventListener('click',e=>{
    const a=e.target&&e.target.closest?e.target.closest('a[download]'):null;
    if(!a||!a.href)return;
    e.preventDefault();e.stopImmediatePropagation();
    save(a.href,(a.getAttribute('download')||'fixture').replace(/[\\/:*?"<>|]+/g,'_'));
  },true);
  // Enlaces externos (botón MANUAL): abrir en el navegador del sistema.
  window.open=(url)=>{
    if(!/^https?:\/\//i.test(String(url)))return null;
    call('Browser','open',{url:String(url),toolbarColor:'#0a0c0f'}).catch(()=>notice('No se ha podido abrir el navegador.'));
    return null;
  };
})();
