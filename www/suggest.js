/* Sugerencias propias para Marca y Modelo.
   El <datalist> nativo no se muestra en iPhone/iPad ni en varios navegadores
   integrados (Instagram, WhatsApp), asi que se sustituye por un desplegable
   propio que funciona igual en PC, Android e iOS. */
(function(){
  'use strict';
  var MAX=8;
  var norm=function(s){return String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'')};
  var css='.fh-sg-host{position:relative}'+
    '.fh-sg{position:absolute;left:0;right:0;top:100%;margin-top:4px;z-index:40;background:#0b0b0f;border:1px solid #c53c45;box-shadow:0 18px 40px #000c;max-height:336px;overflow-y:auto;-webkit-overflow-scrolling:touch}'+
    '.fh-sg[hidden]{display:none!important}'+
    '.fh-sg div{padding:12px 13px;min-height:42px;color:#f1f1f4;font:500 15px/1.25 var(--sans,system-ui);letter-spacing:0;text-transform:none;border-bottom:1px solid #22222a;cursor:pointer;-webkit-tap-highlight-color:transparent}'+
    '.fh-sg div:last-child{border-bottom:0}'+
    '.fh-sg div.on,.fh-sg div:hover{background:#2a1216;color:#fff}'+
    '.fh-sg b{color:#ff7a80;font-weight:700}';
  var st=document.createElement('style');st.textContent=css;document.head.appendChild(st);

  function esc(s){return String(s).replace(/[&<>"]/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]})}

  function attach(inputId,listId){
    var input=document.getElementById(inputId),list=document.getElementById(listId);
    if(!input||!list)return;
    input.removeAttribute('list');
    input.setAttribute('autocapitalize','off');
    input.setAttribute('autocorrect','off');
    input.setAttribute('spellcheck','false');
    var host=input.closest('label')||input.parentNode;
    host.classList.add('fh-sg-host');
    var box=document.createElement('div');box.className='fh-sg';box.hidden=true;
    host.appendChild(box);
    var items=[],active=-1;

    function options(){
      var out=[],o=list.options||list.querySelectorAll('option');
      for(var i=0;i<o.length;i++)out.push(o[i].value);
      return out;
    }
    function mark(name,q){
      /* resalta el trozo escrito cuando coincide tal cual */
      var i=name.toLowerCase().indexOf(q.toLowerCase());
      if(i<0)return esc(name);
      return esc(name.slice(0,i))+'<b>'+esc(name.slice(i,i+q.length))+'</b>'+esc(name.slice(i+q.length));
    }
    function render(){
      var raw=input.value.trim(),q=norm(raw);
      if(!q){hide();return}
      var starts=[],inside=[],all=options();
      for(var i=0;i<all.length;i++){
        var n=norm(all[i]);
        if(!n)continue;
        if(n.indexOf(q)===0)starts.push(all[i]);
        else if(n.indexOf(q)>0)inside.push(all[i]);
      }
      items=starts.concat(inside).slice(0,MAX);
      /* si solo queda lo ya escrito, no hace falta mostrar nada */
      if(!items.length||(items.length===1&&norm(items[0])===q)){hide();return}
      active=-1;
      box.innerHTML=items.map(function(name,i){return '<div data-i="'+i+'">'+mark(name,raw)+'</div>'}).join('');
      box.hidden=false;
    }
    function hide(){box.hidden=true;box.innerHTML='';items=[];active=-1}
    function choose(i){
      if(i<0||i>=items.length)return;
      input.value=items[i];
      hide();
      input.dispatchEvent(new Event('input',{bubbles:true}));
      hide();
    }
    function paint(){
      var d=box.children;
      for(var i=0;i<d.length;i++)d[i].classList.toggle('on',i===active);
      if(active>=0&&d[active]&&d[active].scrollIntoView)d[active].scrollIntoView({block:'nearest'});
    }

    input.addEventListener('input',function(e){if(e.isTrusted!==false)render()});
    input.addEventListener('focus',render);
    input.addEventListener('blur',function(){setTimeout(hide,180)});
    input.addEventListener('keydown',function(e){
      if(box.hidden)return;
      if(e.key==='ArrowDown'){e.preventDefault();active=Math.min(active+1,items.length-1);paint()}
      else if(e.key==='ArrowUp'){e.preventDefault();active=Math.max(active-1,0);paint()}
      else if(e.key==='Enter'&&active>=0){e.preventDefault();choose(active)}
      else if(e.key==='Escape'){hide()}
    });
    /* pointerdown + preventDefault: el campo no pierde el foco ni se cierra el teclado */
    var pick=function(e){
      var d=e.target.closest('[data-i]');if(!d)return;
      e.preventDefault();e.stopPropagation();
      choose(Number(d.dataset.i));
    };
    box.addEventListener('mousedown',function(e){e.preventDefault()});
    box.addEventListener('click',pick);
  }

  function start(){attach('manufacturer','manufacturer-list');attach('model','model-list')}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
