'use strict';
/* Sideloaded Android apps announce a release; Android confirms installation.
   Web copies use the latest Netlify deployment and do not need APK notices. */
(() => {
  const cap=window.Capacitor;
  if(!cap?.isNativePlatform?.())return;
  const repository='AVOcontrol/FIXTURE-HUNTER';
  const endpoint='https://api.github.com/repos/'+repository+'/releases/latest';
  const notice=document.getElementById('update-notice');
  const checkButton=document.getElementById('check-updates');
  let checking=false;
  async function check(manual=false){
    if(checking)return;checking=true;
    if(checkButton)checkButton.disabled=true;
    try{
      const last=Number(localStorage.getItem('fh-update-checked')||0);
      if(!manual&&Date.now()-last<6*60*60*1000)return;
      const signal=AbortSignal.timeout(12000);
      const [localResponse,releaseResponse]=await Promise.all([
        fetch('build-info.json',{cache:'no-store',signal}),
        fetch(endpoint,{headers:{Accept:'application/vnd.github+json'},cache:'no-store',signal})
      ]);
      if(!localResponse.ok||!releaseResponse.ok)throw Error('Update service unavailable');
      const [local,release]=await Promise.all([localResponse.json(),releaseResponse.json()]);
      const match=String(release.body||'').match(/<!--fixture-hunter-update\s+([\s\S]*?)-->/);
      if(!match)throw Error('Release metadata unavailable');
      const latest=JSON.parse(match[1]);
      if(latest.appId!==local.appId||!Number.isSafeInteger(latest.versionCode)||!Number.isSafeInteger(local.versionCode))throw Error('Invalid update metadata');
      const asset=(release.assets||[]).find(a=>a.name==='AVOcontrol-Fixture-Hunter.apk');
      const expected='https://github.com/'+repository+'/releases/download/';
      if(!asset?.browser_download_url?.startsWith(expected))throw Error('APK asset unavailable');
      localStorage.setItem('fh-update-checked',String(Date.now()));
      if(latest.versionCode<=local.versionCode){if(manual)window.FixtureHunterNotice?.('La aplicación está actualizada.');return}
      document.getElementById('update-message').textContent=(window.FHT||(s=>s))('Nueva versión disponible. Android te pedirá confirmar la instalación.');
      const link=document.getElementById('update-download');link.href=asset.browser_download_url;
      link.onclick=e=>{e.preventDefault();window.open(link.href,'_blank','noopener')};
      notice.hidden=false;
    }catch{
      if(manual)window.FixtureHunterNotice?.('No se han podido comprobar las actualizaciones. Revisa la conexión.');
    }finally{checking=false;if(checkButton)checkButton.disabled=false}
  }
  document.getElementById('update-dismiss')?.addEventListener('click',()=>{notice.hidden=true});
  if(checkButton){checkButton.hidden=false;checkButton.addEventListener('click',()=>check(true))}
  window.addEventListener('online',()=>check(false));
  check(false);
})();
