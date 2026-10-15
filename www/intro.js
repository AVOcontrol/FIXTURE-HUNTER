/* Keep the cover separate from the search interface until the user opens it. */
(() => {
 'use strict';
 function start(){
  const intro=document.getElementById('app-intro');
  const content=document.getElementById('app-content');
  const button=document.getElementById('intro-open');
  if(!intro||!content||!button)return;
  function open(event){
   content.inert=false;
   content.removeAttribute('aria-hidden');
   intro.hidden=true;
   document.documentElement.classList.remove('intro-active');
   window.scrollTo(0,0);
   if(event?.detail===0)document.getElementById('manufacturer')?.focus({preventScroll:true});
  }
  button.addEventListener('click',open,{once:true});
  intro.addEventListener('keydown',event=>{
   if(event.key!=='Tab')return;
   const controls=[...intro.querySelectorAll('button:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(element=>element.getClientRects().length);
   const first=controls[0],last=controls.at(-1),active=document.activeElement;
   if(!first)return;
   if(event.shiftKey&&(active===first||active===intro)){event.preventDefault();last.focus()}
   else if(!event.shiftKey&&(active===last||active===intro)){event.preventDefault();first.focus()}
  });
  intro.focus({preventScroll:true});
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
