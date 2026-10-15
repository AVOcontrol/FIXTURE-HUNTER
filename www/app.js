'use strict';
(() => {
  const el=id=>document.getElementById(id);
  const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
  const compact=s=>norm(s).replace(/[^a-z0-9]/g,'');
  const words=s=>norm(s).split(/[^a-z0-9]+/).filter(Boolean);
  const contains=(text,query)=>words(query).every(word=>compact(text).includes(compact(word)));
  const escape=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const safeFilePart=s=>String(s||'fixture').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^A-Za-z0-9._-]+/g,'_').replace(/^_+|_+$/g,'').slice(0,120)||'fixture';
  const fixtureViewKey=(manufacturer,model)=>compact(manufacturer)+'|'+compact(model);
  const fixtureViewFor=f=>f?(window.FixtureViewManifest?.[fixtureViewKey(f[1],f[2])]||null):null;
  const viewAssetUrl=url=>url?(window.FixtureViewAssetData?.[url]||url):'';
  const fixtureGLBUrl=view=>viewAssetUrl(view?.glb||'');
  const fixture3DUrl=view=>viewAssetUrl(view?.tresd||view?.threeD||view?.image3d||'');
  const viewSourceLabel=view=>{
    if(!view)return 'Sin vista 2D preparada';
    if(view.source==='capture-native')return '2D nativo de Capture';
    if(view.source==='approved-reconstruction')return 'Reconstrucción 2D aprobada';
    if(view.quality==='family')return '2D compartido por familia';
    return 'Reconstrucción 2D';
  };
  function dataUrlToBlob(url){
    const match=String(url||'').match(/^data:([^;,]+)?(?:;charset=[^;,]+)?(;base64)?,([\s\S]*)$/i);
    if(!match)return null;
    const mime=match[1]||'application/octet-stream';
    const raw=match[3]||'';
    try{
      if(match[2]){
        const bin=atob(raw),bytes=new Uint8Array(bin.length);
        for(let i=0;i<bin.length;i++)bytes[i]=bin.charCodeAt(i);
        return new Blob([bytes],{type:mime});
      }
      return new Blob([decodeURIComponent(raw)],{type:mime});
    }catch{return null}
  }
  async function downloadUrl(url,filename){
    if(!url)return;
    if(location.protocol==='file:'&&!/^(data:|blob:)/i.test(url)&&/\.(png|glb)$/i.test(url)){
      try{
        await loadScript(url+'.js','png-download-'+url);
        url=window.FixtureViewAssetData?.[url]||url;
      }catch(e){console.error(e);return}
    }
    let href=url,objectUrl='';
    if(/^data:/i.test(url)){
      const blob=dataUrlToBlob(url);
      if(blob){objectUrl=URL.createObjectURL(blob);href=objectUrl}
    }
    const a=document.createElement('a');
    a.href=href;
    a.download=filename||'fixture.png';
    a.rel='noopener';
    a.style.display='none';
    document.body.appendChild(a);
    a.click();
    a.remove();
    if(objectUrl)setTimeout(()=>URL.revokeObjectURL(objectUrl),1500);
  }
  function applyFixtureViewButtons(f){
    const view=fixtureViewFor(f);
    const three=el('detail-3d'),plant=el('detail-planta'),front=el('detail-frontal'),table=el('detail-table'),manual=el('detail-manual');
    const prep=(button,url,label)=>{button.disabled=!url;button.dataset.assetUrl=url||'';button.textContent=url?label:'SIN '+label;button.title=url?('Abrir '+label):'No hay una imagen preparada para este modelo.';};
    prep(three,fixtureGLBUrl(view),'3D GLB');prep(plant,viewAssetUrl(view?.planta),'PLANTA PNG');prep(front,viewAssetUrl(view?.frontal),'FRONTAL PNG');
    table.disabled=true;manual.disabled=false;
    return view;
  }
  function csvCell(v){const s=String(v??'');return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s}
  const uniqueChannels=channels=>{const seen=new Set();return channels.filter(channel=>{const key=JSON.stringify(channel);if(seen.has(key))return false;seen.add(key);return true})};
  function exportSelectedTable(){
    if(!selectedDetailData?.mode)return;
    const {f,m,mode}=selectedDetailData;
    const lines=[['Fabricante','Modelo','Modo','Canal','Atributo','ID atributo','Célula','Resolución','Funciones / rangos'].map(x=>(window.FHT||(y=>y))(x)).map(csvCell).join(',')];
    for(const c of uniqueChannels(mode.canales)){
      const def=selectedDetailData.data.atributos[c[1]];
      const fx=(def?.hijos||[]).filter(n=>n.tipo==='Function').map(n=>(n.datos?.Dmx??'')+' '+(n.datos?.Name??'')).join(' | ');
      lines.push([f[1],f[2],m[2],c[0],c[2],c[1],c[3]||(window.FHT||(y=>y))('Principal'),c[5]>1?c[5]*8+' bits':'8 bits',fx].map(csvCell).join(','));
    }
    for(const c of mode.sinAsignacion||[])lines.push([f[1],f[2],m[2],c,(window.FHT||(y=>y))('Sin asignación'),'','','',''].map(csvCell).join(','));
    const blob=new Blob(['\ufeff'+lines.join('\r\n')],{type:'text/csv;charset=utf-8'});
    const url=URL.createObjectURL(blob);downloadUrl(url,`${safeFilePart(f[1])}_${safeFilePart(f[2])}_${safeFilePart(m[2])}_canales.csv`);setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function openSelectedManualSearch(){
    if(!selectedDetailData)return;
    const {f}=selectedDetailData;const q=encodeURIComponent(`${f[1]} ${f[2]} manual PDF`);
    window.open(`https://www.google.com/search?q=${q}`,'_blank','noopener');
  }


  let catalog,fixtures,tokens,modeById,results=[],suggestions=[],searchContext=null,page=0,selectedMode=null,functionOptions=[],selectedDetailData=null;
  const perPage=25,loads=new Map(),cache=new Map();
  let dmxSeq=0;
  let d4ApiActive=false,d4ProbeDone=false,d4ProbePromise=null,d4ResolveTimer=null;
  const d4Cache=new Map();
  let searchDebounceTimer=null,openDmxCombo=null;
  let viewerLoading=null;
  const CHANNEL_OPTIONS=Array.from({length:100},(_,i)=>String(i+1));
  const VIRTUAL_ROW_H=40;

  function hasActiveCriteria(state){
    return !!(state.manufacturer||state.model||state.count!==null||state.cells!==null||state.dmxFilters?.length);
  }

  function currentCriteria(){
    const manufacturer=norm(el('manufacturer').value.trim()),model=norm(el('model').value.trim());
    const number=id=>el(id).value===''?null:Number(el(id).value);
    return {manufacturer,model,count:number('footprint'),cells:number('cells'),comparison:el('comparison').value,dmxFilters:getDmxFilters()};
  }

  function queueSearch(immediate=false){
    clearTimeout(searchDebounceTimer);
    if(!catalog)return;
    if(immediate){search();return}
    searchDebounceTimer=setTimeout(search,110);
  }

  function resetToEmptyState({clearFields=false}={}){
    clearTimeout(searchDebounceTimer);
    if(el('hunter-detail').open)el('hunter-detail').close();
    if(clearFields){
      el('manufacturer').value='';
      el('model').value='';
      el('footprint').value='';
      el('cells').value='';
      el('comparison').value='eq';
      clearDmxFilters();
      updateModelList();
    }
    results=[];
    suggestions=[];
    searchContext={manufacturer:'',model:'',count:null,cells:null,comparison:'eq',dmxFilters:[],empty:true,suggestionReason:null};
    page=0;
    render();
  }

  async function unpack(encoded){
    if(!window.DecompressionStream)throw new Error('Este navegador no soporta la descompresión necesaria para Fixture Hunter.');
    const bytes=Uint8Array.from(atob(encoded),c=>c.charCodeAt(0));
    return JSON.parse(await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'))).text());
  }

  function distanceLabel(actual,requested){
    if(requested===null||requested===undefined)return '';
    const d=actual-requested;
    if(d===0)return 'exacto';
    return Math.abs(d)+' canal'+(Math.abs(d)===1?'':'es')+' '+(d<0?'menos':'más');
  }

  function dice(a,b){
    a=compact(a);b=compact(b);if(!a||!b)return 0;if(a===b)return 1;if(a.includes(b)||b.includes(a))return .94;
    if(a.length<2||b.length<2)return a===b?1:0;
    const bag=new Map();for(let i=0;i<a.length-1;i++){const g=a.slice(i,i+2);bag.set(g,(bag.get(g)||0)+1)}
    let hits=0;for(let i=0;i<b.length-1;i++){const g=b.slice(i,i+2),n=bag.get(g)||0;if(n){hits++;bag.set(g,n-1)}}
    return 2*hits/((a.length-1)+(b.length-1));
  }

  function textScore(text,query){
    if(!query)return 1;if(contains(text,query))return 1;
    const q=words(query),parts=words(text);if(!q.length)return 1;
    return q.reduce((sum,w)=>sum+Math.max(dice(text,w),...parts.map(p=>dice(p,w))),0)/q.length;
  }

  function attributeDisplayName(raw){
    const value=String(raw||'').trim();
    const firstSpace=value.indexOf(' ');
    return firstSpace>0&&value.slice(firstSpace+1).trim()?value.slice(firstSpace+1).trim():value;
  }

  function buildFunctionOptions(){
    const unique=new Map();
    for(const raw of catalog?.atributos||[]){
      const label=attributeDisplayName(raw);
      if(!label)continue;
      const key=norm(label).replace(/\s+/g,' ').trim();
      if(key&&!unique.has(key))unique.set(key,label);
    }
    functionOptions=[...unique.values()].sort((a,b)=>a.localeCompare(b,'es',{numeric:true,sensitivity:'base'}));
  }

  function comboMarkup(kind,value=''){
    const isChannel=kind==='channel';
    const placeholder=isChannel?'Selecciona 1–100':'Selecciona una función';
    const inputClass=isChannel?'dmx-channel':'dmx-attribute';
    const buttonClass=isChannel?'dmx-channel-button':'dmx-attribute-button';
    const safe=escape(value??'');
    return `<div class="dmx-combo" data-combo-kind="${kind}">`+
      `<input class="${inputClass}" type="hidden" value="${safe}">`+
      `<button class="dmx-combo-button ${buttonClass}" type="button" aria-haspopup="listbox" aria-expanded="false"><span class="dmx-combo-value ${safe?'':'is-placeholder'}">${safe||placeholder}</span><span class="dmx-combo-arrow" aria-hidden="true">▾</span></button>`+
      `<div class="dmx-combo-menu" hidden><div class="dmx-combo-scroll" role="listbox"><div class="dmx-virtual-space"></div><div class="dmx-virtual-items"></div></div></div>`+
      `</div>`;
  }

  function comboOptions(combo){
    return combo?.dataset.comboKind==='channel'?CHANNEL_OPTIONS:functionOptions;
  }

  function syncComboDisplay(combo){
    if(!combo)return;
    const hidden=combo.querySelector(combo.dataset.comboKind==='channel'?'.dmx-channel':'.dmx-attribute');
    const value=hidden?.value||'';
    const display=combo.querySelector('.dmx-combo-value');
    if(!display)return;
    display.textContent=value||(combo.dataset.comboKind==='channel'?'Selecciona 1–100':'Selecciona una función');
    display.classList.toggle('is-placeholder',!value);
  }

  function setComboValue(combo,value,{searchNow=true}={}){
    if(!combo)return;
    const hidden=combo.querySelector(combo.dataset.comboKind==='channel'?'.dmx-channel':'.dmx-attribute');
    if(hidden)hidden.value=String(value??'');
    syncComboDisplay(combo);
    closeDmxCombo(combo);
    if(searchNow)queueSearch(true);
  }

  function renderVirtualCombo(combo){
    if(!combo||combo!==openDmxCombo)return;
    const options=comboOptions(combo),scroll=combo.querySelector('.dmx-combo-scroll'),items=combo.querySelector('.dmx-virtual-items');
    if(!scroll||!items)return;
    const visible=Math.ceil((scroll.clientHeight||120)/VIRTUAL_ROW_H)+6;
    const start=Math.max(0,Math.floor(scroll.scrollTop/VIRTUAL_ROW_H)-3);
    const end=Math.min(options.length,start+visible);
    const current=(combo.querySelector(combo.dataset.comboKind==='channel'?'.dmx-channel':'.dmx-attribute')?.value||'');
    let html='';
    for(let i=start;i<end;i++){
      const option=options[i];
      html+=`<button class="dmx-combo-option${String(option)===current?' selected':''}" type="button" role="option" aria-selected="${String(option)===current?'true':'false'}" data-combo-index="${i}" style="top:${i*VIRTUAL_ROW_H}px;height:${VIRTUAL_ROW_H}px">${escape(option)}</button>`;
    }
    items.innerHTML=html;
  }

  function closeDmxCombo(combo=openDmxCombo){
    if(!combo)return;
    combo.classList.remove('open');
    const menu=combo.querySelector('.dmx-combo-menu');if(menu)menu.hidden=true;
    const btn=combo.querySelector('.dmx-combo-button');if(btn)btn.setAttribute('aria-expanded','false');
    if(openDmxCombo===combo)openDmxCombo=null;
  }

  function openCombo(combo){
    if(!combo)return;
    if(openDmxCombo&&openDmxCombo!==combo)closeDmxCombo(openDmxCombo);
    openDmxCombo=combo;combo.classList.add('open');
    const menu=combo.querySelector('.dmx-combo-menu'),btn=combo.querySelector('.dmx-combo-button'),scroll=combo.querySelector('.dmx-combo-scroll'),space=combo.querySelector('.dmx-virtual-space');
    if(menu)menu.hidden=false;if(btn)btn.setAttribute('aria-expanded','true');
    const options=comboOptions(combo);if(space)space.style.height=(options.length*VIRTUAL_ROW_H)+'px';
    const current=combo.querySelector(combo.dataset.comboKind==='channel'?'.dmx-channel':'.dmx-attribute')?.value||'';
    const idx=current?options.findIndex(v=>String(v)===String(current)):-1;
    if(scroll){scroll.scrollTop=idx>=0?Math.max(0,idx*VIRTUAL_ROW_H-VIRTUAL_ROW_H):0;scroll.onscroll=()=>renderVirtualCombo(combo)}
    renderVirtualCombo(combo);
  }

  function addDmxFilter(initial={},afterRow=null){
    const row=document.createElement('div');
    row.className='dmx-filter-row';row.dataset.filterId=String(++dmxSeq);
    row.innerHTML=`<label>Canal DMX${comboMarkup('channel',initial.channel??'')}</label>`+
      `<label>Función contiene${comboMarkup('attribute',initial.attribute??'')}</label>`+
      `<button class="dmx-row-btn dmx-add" type="button" data-add-dmx aria-label="Añadir otro filtro DMX">+</button>`+
      `<button class="dmx-row-btn dmx-remove" type="button" data-remove-dmx aria-label="Eliminar este filtro DMX">−</button>`;
    const rows=el('dmx-filter-rows');
    if(afterRow&&afterRow.parentNode===rows)afterRow.after(row);else rows.appendChild(row);
    refreshDmxRemoveButtons();
    return row;
  }

  function refreshDmxRemoveButtons(){
    const rows=[...document.querySelectorAll('.dmx-filter-row')];
    rows.forEach(r=>{const b=r.querySelector('[data-remove-dmx]');if(b)b.disabled=rows.length===1});
  }

  function clearDmxFilters(){
    const rows=el('dmx-filter-rows');rows.innerHTML='';addDmxFilter();
  }

  function getDmxFilters(){
    return [...document.querySelectorAll('.dmx-filter-row')].map(row=>{
      const c=row.querySelector('.dmx-channel').value.trim();
      const a=row.querySelector('.dmx-attribute').value.trim();
      return {id:row.dataset.filterId,channel:c===''?null:Number(c),attribute:norm(a),attributeRaw:a};
    }).filter(f=>f.channel!==null||f.attribute);
  }

  function updateModelList(){
    if(!catalog)return;
    const manufacturer=el('manufacturer').value.trim();
    const names=[];const seen=new Set();
    for(const f of catalog.aparatos){
      if(manufacturer&&!contains(f[1],manufacturer)&&textScore(f[1],manufacturer)<.72)continue;
      if(!seen.has(f[2])){seen.add(f[2]);names.push(f[2]);if(names.length>=600)break;}
    }
    names.sort((a,b)=>a.localeCompare(b));
    el('model-list').innerHTML=names.map(name=>'<option value="'+escape(name)+'">').join('');
  }

  function imageAccessAttributes(f){const view=fixtureViewFor(f);return fixtureGLBUrl(view)||view?.planta||view?.frontal?'':'disabled';}
  function actionHtml(m){
    return `<div class="row-actions"><button type="button" data-fixture-mode="${m[0]}">VER APARATO</button><button type="button" data-fixture-images="${m[0]}" ${imageAccessAttributes(fixtures.get(m[1]))}>IMÁGENES / 3D</button><button type="button" class="d4-action" data-d4-mode="${m[0]}" disabled>.d4 Node/PC</button></div>`;
  }

  function suggestionHtml(m,requested){
    const f=fixtures.get(m[1]),dist=requested===null?'':distanceLabel(m[3],requested);
    return `<article class="hunter-suggestion"><div><strong>${escape(f[1])} · ${escape(f[2])}</strong><small>${escape(m[2])}${m[4]?' · '+m[4]+' células':''}</small></div>`+
      `<div class="hunter-suggestion-meta"><span class="hunter-dmx-count">${m[3]} ch</span>${dist?'<span class="hunter-distance">'+escape(dist)+'</span>':''}<div class="suggestion-actions"><button type="button" data-mode="${m[0]}">Ver canales</button><button type="button" class="d4-action" data-d4-mode="${m[0]}" disabled>.d4 Node/PC</button></div></div></article>`;
  }

  function renderSuggestions(){
    const box=el('hunter-suggestions');
    if(!suggestions.length){box.hidden=true;box.innerHTML='';return}
    const reason=searchContext?.suggestionReason||'nearby';
    const requested=searchContext?.count??null;
    const channelTitle=searchContext?.comparison==='min'?'No hay modos que alcancen el mínimo de canales indicado':searchContext?.comparison==='max'?'No hay modos dentro del máximo de canales indicado':'No existe ese número exacto de canales con esos filtros';
    const title=reason==='filters'?'Tus filtros opcionales pueden estar ocultando el aparato':reason==='fuzzy'?'No hay coincidencia literal. Estas son las opciones más parecidas':channelTitle;
    const intro=reason==='filters'?'He mantenido marca y modelo, pero he relajado los filtros opcionales para enseñarte candidatos útiles.':reason==='fuzzy'?'Las sugerencias se calculan por similitud de fabricante/modelo y, si indicaste canales, también por cercanía del modo DMX.':'He mantenido fabricante, modelo y filtros DMX, ordenando los modos por cercanía al número de canales solicitado.';
    box.innerHTML=`<div class="hunter-suggestions-head"><div><span class="hunter-suggestions-kicker">Coincidencias cercanas</span><h3>${title}</h3><p>${intro}</p></div></div>`+
      `<div class="hunter-suggestion-grid">${suggestions.map(m=>suggestionHtml(m,requested)).join('')}</div>`+
      `<div class="hunter-suggestion-actions">${requested!==null?'<button type="button" class="avc-btn" data-relax-count>Buscar sin limitar canales</button>':''}${reason==='filters'?'<button type="button" class="avc-btn" data-clear-optionals>Quitar filtros opcionales</button>':''}</div>`+
      `<p class="hunter-smart-hint">Las alternativas nunca se mezclan con los resultados exactos. Sirven para detectar un modo distinto, un número de canales recordado de forma aproximada o una pequeña variación en el nombre.</p>`;
    box.hidden=false;
  }

  function activeFilterHtml(){
    const parts=[];
    const standard=[['manufacturer','Marca contiene'],['model','Modelo contiene'],['footprint','Total de canales'],['cells','Células']];
    for(const [id,label] of standard){
      const input=el(id);if(!input||!input.value.trim())continue;
      const extra=id==='footprint'?' ('+el('comparison').selectedOptions[0].text+')':'';
      parts.push(`<button type="button" data-clear="${id}" aria-label="Quitar filtro ${escape(label)}">${escape(label)}: ${escape(input.value)}${escape(extra)} <span aria-hidden="true">×</span></button>`);
    }
    for(const f of getDmxFilters()){
      const bits=[];if(f.channel!==null)bits.push('canal '+f.channel);if(f.attributeRaw)bits.push('“'+f.attributeRaw+'”');
      parts.push(`<button type="button" data-clear-dmx="${escape(f.id)}" aria-label="Quitar filtro DMX">DMX: ${escape(bits.join(' · '))} <span aria-hidden="true">×</span></button>`);
    }
    return parts.join('');
  }

  function render(){
    const criteria=currentCriteria();
    const active=hasActiveCriteria(criteria);
    const rows=results.slice(page*perPage,(page+1)*perPage);
    const emptyMessage=!active
      ? '0 aparatos encontrados. Escribe o selecciona algún filtro para empezar.'
      : (suggestions.length
        ? 'No hay coincidencias exactas. Revisa las alternativas cercanas que aparecen debajo.'
        : '0 aparatos encontrados con estos filtros.');
    el('hunter-results').innerHTML=rows.map(m=>{const f=fixtures.get(m[1]),thumb=fixture3DUrl(fixtureViewFor(f));return `<tr class="${selectedMode===m[0]?'is-selected':''}" data-result-mode="${m[0]}"><td><button type="button" class="device-button" data-fixture-mode="${m[0]}">${thumb?`<img src="${escape(thumb)}" alt="" loading="lazy">`:'<span class="thumb-missing" aria-hidden="true">◇</span>'}<span data-no-tr><strong>${escape(f[2])}</strong><small>${escape(f[1])}</small></span></button><div class="result-resources"><button type="button" data-mode="${m[0]}">Canales</button><button type="button" data-fixture-images="${m[0]}" ${imageAccessAttributes(f)}>IMÁGENES / 3D</button><button type="button" class="d4-action" data-d4-mode="${m[0]}" disabled>.D4</button></div></td><td class="mode-cell"><span data-no-tr>${escape(m[2])}</span>${m[4]?`<br><small>${m[4]} células</small>`:''}${m[5]?'<br><span class="hunter-notice">Datos por comprobar</span>':''}</td><td><span class="channel-count">${m[3]}</span></td></tr>`}).join('')||`<tr class="hunter-empty"><td colspan="3">${emptyMessage}</td></tr>`;
    el('hunter-status').textContent=!active
      ? '0 aparatos encontrados'
      : (results.length
        ? results.length.toLocaleString('es-ES')+' coincidencias exactas'
        : (suggestions.length ? '0 exactos · '+suggestions.length+' alternativas cercanas' : '0 aparatos encontrados'));
    el('page-count').textContent=results.length?`${page+1} / ${Math.ceil(results.length/perPage)}`:'0 resultados';
    el('previous').disabled=page===0||!results.length;el('next').disabled=!results.length||(page+1)*perPage>=results.length;
    el('active-filters').innerHTML=activeFilterHtml();
    el('clear-extra').hidden=!(getDmxFilters().length||el('cells').value.trim());
    renderSuggestions();
    scheduleD4Resolve();
  }

  function search(){
    el('channels-view').hidden=true;el('results-view').hidden=false;
    const {manufacturer,model,count,cells,comparison,dmxFilters}=currentCriteria();
    if(!hasActiveCriteria({manufacturer,model,count,cells,dmxFilters})){
      results=[];suggestions=[];searchContext={manufacturer,model,count,cells,comparison,dmxFilters,empty:true,suggestionReason:null};
      page=0;render();
      return;
    }
    const matchNames=m=>{const f=fixtures.get(m[1]);return (!manufacturer||contains(f[1],manufacturer))&&(!model||contains(f[2],model))};
    const matchExtras=m=>{
      if(cells!==null&&m[4]!==cells)return false;
      return dmxFilters.every(filter=>(m[6]||[]).some(c=>(filter.channel===null||c[0]===filter.channel)&&(!filter.attribute||contains(tokens[c[1]],filter.attribute))));
    };
    const matchCount=m=>count===null||(comparison==='eq'?m[3]===count:comparison==='min'?m[3]>=count:m[3]<=count);
    results=catalog.modos.filter(m=>matchNames(m)&&matchCount(m)&&matchExtras(m));
    suggestions=[];searchContext={manufacturer,model,count,cells,comparison,dmxFilters,suggestionReason:null};

    if(!results.length){
      let pool=[];
      if(count!==null){
        pool=catalog.modos.filter(m=>matchNames(m)&&matchExtras(m));
        if(pool.length)searchContext.suggestionReason='nearby';
      }
      if(!pool.length&&(dmxFilters.length||cells!==null)){
        pool=catalog.modos.filter(m=>matchNames(m)&&matchCount(m));
        if(pool.length)searchContext.suggestionReason='filters';
      }
      if(!pool.length&&(manufacturer||model)){
        const fixtureScores=new Map();
        for(const f of catalog.aparatos){
          const ms=manufacturer?textScore(f[1],manufacturer):1,qs=model?textScore(f[2],model):1;
          let score=(manufacturer&&model)?ms*.32+qs*.68:manufacturer?ms:qs;
          if(manufacturer&&ms<.38)score*=.55;
          if(model&&qs<.38)score*=.45;
          if(score>=.42)fixtureScores.set(f[0],score);
        }
        pool=catalog.modos.filter(m=>fixtureScores.has(m[1]));
        pool.sort((a,b)=>(fixtureScores.get(b[1])-fixtureScores.get(a[1]))||((count===null?0:Math.abs(a[3]-count))-(count===null?0:Math.abs(b[3]-count))));
        if(pool.length)searchContext.suggestionReason='fuzzy';
      }
      if(pool.length&&searchContext.suggestionReason!=='fuzzy'){
        pool.sort((a,b)=>((count===null?0:Math.abs(a[3]-count))-(count===null?0:Math.abs(b[3]-count)))||fixtures.get(a[1])[2].localeCompare(fixtures.get(b[1])[2])||a[2].localeCompare(b[2]));
      }
      const seen=new Set();suggestions=pool.filter(m=>{if(seen.has(m[0]))return false;seen.add(m[0]);return true}).slice(0,12);
    }
    page=0;render();
  }

  async function loadScript(src,key){
    if(!loads.has(key))loads.set(key,new Promise((resolve,reject)=>{const s=document.createElement('script');s.src=src;s.onload=resolve;s.onerror=()=>{loads.delete(key);s.remove();reject(new Error('No se ha podido cargar un recurso de Fixture Hunter. Comprueba que la carpeta assets acompaña a la web.'))};document.head.appendChild(s)}));
    return loads.get(key);
  }

  async function fixtureDetail(fid){
    if(cache.has(fid))return cache.get(fid);
    const shard=fid%128,functionChunkSize=16384;
    if(!window.HunterChunks?.[shard])await loadScript(`assets/hunter/chunks/${shard}.js`,'fixture-chunk-script-'+shard);
    const encoded=window.HunterChunks?.[shard]?.[fid];
    if(!encoded)throw new Error('No se ha encontrado el detalle de esta personalidad.');
    const data=await unpack(encoded);
    const functionIds=[...new Set(Object.values(data.atributos).flatMap(items=>items.map(([,ref])=>Math.floor(ref/functionChunkSize))))];
    await Promise.all(functionIds.map(async cid=>{
      if(!window.HunterFunctionChunks?.[cid])await loadScript(`assets/hunter/functions/${cid}.js`,'function-chunk-script-'+cid);
      if(!loads.has('function-chunk-'+cid))loads.set('function-chunk-'+cid,unpack(window.HunterFunctionChunks[cid]));
      await loads.get('function-chunk-'+cid);
    }));
    const pools=new Map();for(const cid of functionIds)pools.set(cid,await loads.get('function-chunk-'+cid));
    Object.keys(data.atributos).forEach(id=>{data.atributos[id]={hijos:data.atributos[id].map(([localId,ref])=>{const cid=Math.floor(ref/functionChunkSize),entry=pools.get(cid)[ref%functionChunkSize];return {...entry,datos:{...entry.datos,ID:localId}}})}});
    cache.set(fid,data);return data;
  }

  function functions(definition,byteCount){
    const entries=(definition?.hijos||[]).filter(n=>n.tipo==='Function');
    if(!entries.length)return '<span class="hunter-note">Sin funciones descritas en la personalidad.</span>';
    const conditions=n=>(n.hijos||[]).map(c=>escape(c.tipo)+': '+escape(JSON.stringify(c.datos))).join('; ');
    return `<details><summary>${entries.length} funciones / rangos</summary>${byteCount>1?'<p class="hunter-note">Rango del atributo combinado de '+(byteCount*8)+' bits.</p>':''}<ul class="hunter-ranges">`+entries.map(n=>`<li><code>${escape(n.datos.Dmx??'Sin rango')}</code> · ${escape(n.datos.Name)}${conditions(n)?'<br><span class="hunter-note">'+conditions(n)+'</span>':''}</li>`).join('')+'</ul></details>';
  }

  function unavailableImage(label='IMAGEN NO DISPONIBLE'){
    return `<div class="fixture-image-unavailable"><span>${escape(label)}</span></div>`;
  }

  const downloadIcon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" fill="none" stroke="currentColor" stroke-width="2"/></svg>';
  function imageViewer(url,kind,f,hero=false){
    const download=hero?'':`<button class="btn png-download" type="button" data-image-url="${escape(url)}" data-image-kind="${escape(kind)}" aria-label="Descargar ${escape(kind)} PNG" title="Descargar ${escape(kind)} PNG">${downloadIcon}<span>PNG</span></button>`;
    return `<figure class="png-viewer ${hero?'fixture-3d-frame':''}"><img src="${escape(url)}" alt="${escape(kind+' · '+f[1]+' '+f[2])}">${download}</figure>`;
  }
  function imageResources(f){
    const view=fixtureViewFor(f),items=[['PLANTA',viewAssetUrl(view?.planta)],['FRONTAL',viewAssetUrl(view?.frontal)],['3D',fixtureGLBUrl(view)]];
    const note=view?.source==='approved-reconstruction'?'Dibujo reconstruido aprobado.':view?.quality==='family'?'Dibujo orientativo compartido por familia.':view?.review?'Dibujo orientativo; vista pendiente de revisión.':'';
    return `<section class="available-images" id="available-images"><div class="png-tabs" role="tablist" aria-label="Vistas del aparato">${items.map(([kind,url])=>`<button class="btn png-tab" id="png-tab-${kind}" type="button" role="tab" aria-selected="false" aria-controls="png-panel" tabindex="${url?0:-1}" data-view-kind="${kind}" ${url?'':'disabled'}>${kind==='3D'?'3D GLB':kind+' PNG'}</button>`).join('')}</div><div id="png-panel" role="tabpanel" hidden></div><p class="png-hint">Selecciona planta o frontal para descargar su PNG. El modelo 3D se descarga en GLB cuando está disponible.</p>${note?`<p class="hunter-note">Planta / frontal: ${escape(note)}</p>`:''}</section>`;
  }
  function ensureModelViewer(){
    if(!viewerLoading)viewerLoading=new Promise((resolve,reject)=>{const script=document.createElement('script');script.type='module';script.src='vendor/model-viewer.min.js';script.onload=()=>customElements.whenDefined('model-viewer').then(resolve);script.onerror=()=>reject(new Error('No se puede cargar el visor 3D.'));document.head.appendChild(script)});
    return viewerLoading;
  }
  function openImage(kind){
    if(!selectedDetailData)return;
    const {f,view}=selectedDetailData,url=kind==='3D'?fixtureGLBUrl(view):viewAssetUrl(view?.[kind.toLowerCase()]);
    if(!url)return;
    const panel=el('png-panel');if(!panel)return;
    document.querySelectorAll('.png-tab').forEach(b=>{b.setAttribute('aria-selected',String(b.dataset.viewKind===kind));b.tabIndex=b.dataset.viewKind===kind?0:-1});
    const hero=el('fixture-hero');if(hero)hero.hidden=true;
    panel.innerHTML=kind==='3D'?`<div class="glb-download-panel"><model-viewer src="${escape(url)}" alt="${escape(f[1]+' '+f[2])}" camera-controls interaction-prompt="none" shadow-intensity="0.4" exposure="1.2"><p class="model-fallback" slot="poster">Cargando modelo 3D…</p></model-viewer><button class="btn png-download glb-download" type="button" data-glb-url="${escape(url)}">${downloadIcon}<span>GLB</span></button><p class="hunter-note">${escape(view?.glbNote||'Modelo 3D exportado de Capture en formato GLB')}</p></div>`:imageViewer(url,kind,f);
    panel.hidden=false;panel.setAttribute('aria-labelledby','png-tab-'+kind);
    const hint=document.querySelector('.png-hint');if(hint)hint.hidden=true;
    if(kind==='3D'){
      ensureModelViewer().catch(e=>{const fallback=panel.querySelector('.model-fallback');if(fallback)fallback.textContent=e.message+' Puedes descargar el GLB.'});
      panel.querySelector('model-viewer')?.addEventListener('error',()=>{const fallback=panel.querySelector('.model-fallback');if(fallback)fallback.textContent='Vista 3D no disponible en este navegador. Puedes descargar el GLB.'});
    }
  }
  function openFirstImage(){
    const tab=document.querySelector('.png-tab:not(:disabled)');if(tab)openImage(tab.dataset.viewKind);
    scrollImages();
  }
  function scrollImages(){
    if(matchMedia('(max-width:880px)').matches)el('hunter-detail').scrollIntoView({block:'start',behavior:'smooth'});
  }
  const sharpPreviews={12594:'macquantumwash',12593:'macquantumprofile',15857:'robinespritefresnel',5073:'sharpy'};
  function showFixtureCard(id,{preservePane=false}={}){
    const m=modeById.get(id),f=m&&fixtures.get(m[1]);if(!m||!f)return;
    selectedMode=id;selectedDetailData={f,m,mode:null,data:null,view:fixtureViewFor(f)};
    const view=selectedDetailData.view,three=fixture3DUrl(view),sharp=sharpPreviews[f[0]];
    if(!preservePane){el('channels-view').hidden=true;el('results-view').hidden=false}
    el('detail-manufacturer').textContent=f[1];el('detail-title').textContent=f[2];el('detail-title').dataset.noTr='';el('detail-mode').textContent=`${m[2]} · ${m[3]} canales DMX`;
    applyFixtureViewButtons(f);el('detail-table').disabled=true;el('center-export').disabled=true;
    const db=el('detail-d4');db.dataset.d4Mode=String(id);applyD4Button(db,id);scheduleD4Resolve();
    const hero=sharp?imageViewer('assets/studio-previews/'+sharp+'_render.png','3D',f,true):three?imageViewer(three,'3D',f,true):unavailableImage();
    el('detail-body').innerHTML=`<div id="fixture-hero">${hero}<p class="preview-caption">${sharp?'Vista de la malla · sin texturas':three?'Miniatura original de Capture':''}</p></div>${imageResources(f)}`;
    if(!sharp&&three)el('fixture-hero').querySelector('figure')?.classList.add('is-thumbnail');
    el('inspector-empty').hidden=true;
    if(!el('hunter-detail').open)el('hunter-detail').show();
    document.querySelectorAll('[data-result-mode]').forEach(row=>row.classList.toggle('is-selected',Number(row.dataset.resultMode)===id));
  }
  async function show(id){
    const m=modeById.get(id),f=m&&fixtures.get(m[1]);if(!m||!f)return;
    showFixtureCard(id,{preservePane:true});const view=fixtureViewFor(f);
    el('results-view').hidden=true;el('channels-view').hidden=false;
    el('channels-title').textContent=f[1]+' · '+f[2];el('channels-title').dataset.noTr='';
    el('channels-subtitle').textContent=`${m[2]} · ${m[3]} canales DMX`;
    el('channels-body').textContent=(window.FHT||(y=>y))('Cargando distribución…');
    try{
      const data=await fixtureDetail(m[1]);if(selectedMode!==id||!el('hunter-detail').open||el('channels-view').hidden)return;
      const mode=data.modos[id];if(!mode)throw new Error('No se ha encontrado este modo en el detalle de la personalidad.');
      const rows=uniqueChannels(mode.canales).map(c=>`<tr><td class="hunter-channel-heading">${c[0]}</td><td><span data-no-tr>${escape(c[2])}</span><small data-no-tr>${escape(c[1])}</small></td><td>${escape(c[3]||(window.FHT||(y=>y))('Principal'))}</td><td>${c[5]>1?(c[4]===1?'Coarse / grueso':'Fine / fino')+' · '+c[5]*8+' bits':'8 bits'}</td><td>${functions(data.atributos[c[1]],c[5])}</td></tr>`);
      for(const c of mode.sinAsignacion)rows.push(`<tr class="hunter-unassigned"><td>${c}</td><td colspan="4">Sin asignación en la personalidad</td></tr>`);
      selectedDetailData={f,m,mode,data,view};el('detail-table').disabled=false;el('center-export').disabled=false;
      el('channels-body').innerHTML=(mode.incidencias.length?'<p class="hunter-notice detail-banner">Esta personalidad contiene datos por comprobar: '+escape([...new Set(mode.incidencias)].join('; '))+'. Se conserva lo que indica el archivo original.</p>':'')+
        '<div class="detail-table-card"><div class="detail-table-wrap"><table class="detail-table"><thead><tr><th>Canal</th><th>Atributo</th><th>Célula</th><th>Resolución</th><th>Funciones DMX</th></tr></thead><tbody>'+rows.join('')+'</tbody></table></div></div>'+
        '<div class="detail-footnotes"><p class="hunter-note">Los rangos se conservan tal como aparecen en la librería. Un rango de 16 bits corresponde al atributo combinado. Los atributos virtuales no ocupan canales físicos.</p>'+
        (mode.virtuales.length?'<details class="detail-virtuals"><summary>Atributos sin canal físico ('+mode.virtuales.length+')</summary><p class="hunter-note">'+escape(mode.virtuales.map(v=>(v.celula?v.celula+' · ':'')+v.nombre).join(', '))+'</p></details>':'')+'</div>';
    }catch(e){if(selectedMode===id)el('channels-body').textContent=e.message}
  }

  async function probeD4Api(){
    if(window.FixtureHunterStatic){d4ProbeDone=true;d4ApiActive=false;el('d4-api-badge').textContent='Catálogo de aparatos';return false}
    if(d4ProbeDone)return d4ApiActive;
    if(d4ProbePromise)return d4ProbePromise;
    d4ProbePromise=(async()=>{
      try{
        const r=await fetch('/api/d4/status',{cache:'no-store'});if(!r.ok)throw new Error('not available');
        const d=await r.json();d4ApiActive=!!d.enabled;
        const badge=el('d4-api-badge');
        if(d4ApiActive){badge.textContent='Smart Search · .d4 local';badge.title=(d.roots||[]).filter(x=>x.exists).map(x=>x.label).join(' · ')}
        else{badge.textContent='Smart Search · sin librería .d4 local';}
      }catch{d4ApiActive=false;const badge=el('d4-api-badge');badge.textContent='Standalone · Smart Search';}
      d4ProbeDone=true;return d4ApiActive;
    })();
    return d4ProbePromise;
  }

  function d4TargetForMode(id){
    const m=modeById?.get(Number(id));if(!m)return null;const f=fixtures.get(m[1]);if(!f)return null;
    return {clientId:String(m[0]),manufacturer:f[1],model:f[2],mode:m[2],channels:m[3]};
  }

  function applyD4Button(button,id){
    if(!button)return;const state=d4Cache.get(Number(id));
    button.removeAttribute('data-ready');delete button.dataset.download;
    if(!d4ProbeDone){button.disabled=true;button.textContent='Comprobando .d4…';return}
    if(!d4ApiActive){const sm=modeById?.get(Number(id)),sf=sm&&fixtures.get(sm[1]);if(sf&&sf[3]&&(window.FixtureHunterD4Sources||[]).length&&(!window.FixtureHunterD4Files||window.FixtureHunterD4Files.has(sf[3]))){button.disabled=false;button.textContent='DESCARGAR .D4';button.dataset.ready='1';button.dataset.d4File=sf[3];button.title=sf[3];}else{delete button.dataset.d4File;button.disabled=true;button.textContent='SIN ARCHIVO .D4';button.title='El catálogo contiene sus canales, pero el archivo .d4 no está en la biblioteca disponible.';}return}
    delete button.dataset.d4File;
    if(!state){button.disabled=true;button.textContent='Buscando .d4…';return}
    if(state.available){button.disabled=false;button.textContent='DESCARGAR .D4';button.dataset.ready='1';button.dataset.download=state.downloadUrl;button.title=state.fileName||'Descargar personalidad .d4';}
    else{button.disabled=true;button.textContent='Sin .d4 local';button.title=state.reason||'No se encontró un .d4 local validado para este aparato.';}
  }

  function applyAllD4Buttons(){
    document.querySelectorAll('[data-d4-mode]').forEach(b=>applyD4Button(b,Number(b.dataset.d4Mode)));
  }

  function scheduleD4Resolve(){
    clearTimeout(d4ResolveTimer);d4ResolveTimer=setTimeout(resolveVisibleD4,90);
  }

  async function resolveVisibleD4(){
    const active=await probeD4Api();applyAllD4Buttons();if(!active||!catalog)return;
    const ids=[...new Set([...document.querySelectorAll('[data-d4-mode]')].map(b=>Number(b.dataset.d4Mode)).filter(Number.isFinite))];
    const missing=ids.filter(id=>!d4Cache.has(id));if(!missing.length)return;
    missing.forEach(id=>d4Cache.set(id,{pending:true}));applyAllD4Buttons();
    const items=missing.map(d4TargetForMode).filter(Boolean).slice(0,40);
    try{
      const r=await fetch('/api/d4/resolve-batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({items}),cache:'no-store'});
      if(!r.ok)throw new Error('HTTP '+r.status);
      const d=await r.json();
      for(const result of d.results||[]){d4Cache.set(Number(result.clientId),result)}
      for(const id of missing)if(d4Cache.get(id)?.pending)d4Cache.set(id,{available:false,reason:'No se recibió respuesta de resolución.'});
    }catch(e){for(const id of missing)d4Cache.set(id,{available:false,reason:'No se pudo consultar la librería .d4 local.'});console.warn(e)}
    applyAllD4Buttons();
  }

  let d4StaticBusy=false;
  async function staticD4Download(button){
    if(d4StaticBusy)return;d4StaticBusy=true;
    const file=button.dataset.d4File,label=button.textContent;let blob=null;
    button.textContent='Descargando…';
    for(const base of window.FixtureHunterD4Sources||[]){
      try{
        const r=await fetch(base+encodeURIComponent(file),{cache:'no-store'});if(!r.ok)continue;
        const got=await r.blob();const head=await got.slice(0,600).text();
        if(/<Fixture[\s>]/.test(head)){blob=got;break}
      }catch{}
    }
    d4StaticBusy=false;
    if(!blob){button.textContent='.d4 no disponible';button.title='No se ha podido obtener el archivo. Comprueba la conexión a internet.';setTimeout(()=>applyAllD4Buttons(),2600);return}
    button.textContent=label;
    const url=URL.createObjectURL(new Blob([blob],{type:'application/octet-stream'}));
    downloadUrl(url,file);setTimeout(()=>URL.revokeObjectURL(url),60000);
  }
  function triggerD4Download(button){
    if(button.dataset.ready==='1'&&button.dataset.d4File){staticD4Download(button);return}
    if(button.dataset.ready!=='1'||!button.dataset.download)return;
    const a=document.createElement('a');a.href=button.dataset.download;a.rel='noopener';document.body.appendChild(a);a.click();a.remove();
  }

  el('dmx-filter-builder').addEventListener('click',e=>{
    const comboButton=e.target.closest('.dmx-combo-button');
    if(comboButton){const combo=comboButton.closest('.dmx-combo');if(combo===openDmxCombo)closeDmxCombo(combo);else openCombo(combo);return}
    const option=e.target.closest('[data-combo-index]');
    if(option&&openDmxCombo){const opts=comboOptions(openDmxCombo),idx=Number(option.dataset.comboIndex);if(Number.isInteger(idx)&&opts[idx]!==undefined)setComboValue(openDmxCombo,opts[idx]);return}
    const row=e.target.closest('.dmx-filter-row');if(!row)return;
    if(e.target.closest('[data-add-dmx]')){const n=addDmxFilter({},row);n.querySelector('.dmx-combo-button')?.focus();return}
    if(e.target.closest('[data-remove-dmx]')){if(document.querySelectorAll('.dmx-filter-row').length>1){if(openDmxCombo&&row.contains(openDmxCombo))closeDmxCombo();row.remove();refreshDmxRemoveButtons();if(catalog)search()}return}
  });

  document.addEventListener('click',e=>{if(openDmxCombo&&!e.target.closest('.dmx-combo'))closeDmxCombo()});
  document.addEventListener('keydown',e=>{if(e.key==='Escape'&&openDmxCombo){closeDmxCombo();e.preventDefault()}});

  el('manufacturer').addEventListener('input',()=>{updateModelList();queueSearch()});
  el('model').addEventListener('input',()=>queueSearch());
  el('footprint').addEventListener('input',()=>queueSearch());
  el('cells').addEventListener('input',()=>queueSearch());
  el('comparison').addEventListener('change',()=>queueSearch(true));
  el('hunter-form').addEventListener('submit',e=>{e.preventDefault();search()});
  el('hunter-form').addEventListener('reset',()=>queueMicrotask(()=>resetToEmptyState({clearFields:true})));
  el('active-filters').addEventListener('click',e=>{
    const clear=e.target.closest('[data-clear]');if(clear){el(clear.dataset.clear).value='';if(clear.dataset.clear==='manufacturer')updateModelList();search();return}
    const d=e.target.closest('[data-clear-dmx]');if(d){const row=document.querySelector(`.dmx-filter-row[data-filter-id="${CSS.escape(d.dataset.clearDmx)}"]`);if(row){if(document.querySelectorAll('.dmx-filter-row').length>1){if(openDmxCombo&&row.contains(openDmxCombo))closeDmxCombo();row.remove()}else{setComboValue(row.querySelector('[data-combo-kind="channel"]'),'',{searchNow:false});setComboValue(row.querySelector('[data-combo-kind="attribute"]'),'',{searchNow:false})}refreshDmxRemoveButtons();search()}}
  });
  el('clear-extra').addEventListener('click',()=>{el('cells').value='';clearDmxFilters();search()});
  el('previous').addEventListener('click',()=>{page--;render()});el('next').addEventListener('click',()=>{page++;render()});
  el('hunter-results').addEventListener('click',e=>{const images=e.target.closest('[data-fixture-images]');if(images){showFixtureCard(Number(images.dataset.fixtureImages));openFirstImage();return}const d4=e.target.closest('[data-d4-mode]');if(d4){triggerD4Download(d4);return}const fixture=e.target.closest('[data-fixture-mode]');if(fixture){showFixtureCard(Number(fixture.dataset.fixtureMode));return}const button=e.target.closest('[data-mode]');if(button)show(Number(button.dataset.mode))});
  el('hunter-suggestions').addEventListener('click',e=>{const d4=e.target.closest('[data-d4-mode]');if(d4){triggerD4Download(d4);return}const mode=e.target.closest('[data-mode]');if(mode){show(Number(mode.dataset.mode));return}if(e.target.closest('[data-relax-count]')){el('footprint').value='';search();return}if(e.target.closest('[data-clear-optionals]')){el('cells').value='';clearDmxFilters();search()}});
  el('detail-d4').addEventListener('click',e=>triggerD4Download(e.currentTarget));
  [['detail-3d','3D'],['detail-planta','PLANTA'],['detail-frontal','FRONTAL']].forEach(([id,kind])=>el(id).addEventListener('click',()=>{if(!selectedDetailData)return;const {f,view}=selectedDetailData;const url=kind==='3D'?fixtureGLBUrl(view):viewAssetUrl(view?.[kind.toLowerCase()]);downloadUrl(url,`${safeFilePart(f[1])}_${safeFilePart(f[2])}_${kind}.${kind==='3D'?'glb':'png'}`)}));
  el('detail-table').addEventListener('click',exportSelectedTable);
  el('detail-manual').addEventListener('click',openSelectedManualSearch);
  el('detail-body').addEventListener('click',e=>{
    const tab=e.target.closest('[data-view-kind]');if(tab){openImage(tab.dataset.viewKind);return}
    const fixture=e.target.closest('[data-fixture-mode]');if(fixture){showFixtureCard(Number(fixture.dataset.fixtureMode));return}
    const ch=e.target.closest('[data-open-channels]');if(ch){show(Number(ch.dataset.openChannels));return}
    const glb=e.target.closest('[data-glb-url]');if(glb){const f=selectedDetailData?.f;downloadUrl(glb.dataset.glbUrl,`${safeFilePart(f?.[1])}_${safeFilePart(f?.[2])}.glb`);return}
    const img=e.target.closest('[data-image-url]');if(img){const f=selectedDetailData?.f;downloadUrl(img.dataset.imageUrl,`${safeFilePart(f?.[1])}_${safeFilePart(f?.[2])}_${safeFilePart(img.dataset.imageKind)}.png`);return}
    const d4=e.target.closest('[data-card-d4]');if(d4){const b=el('detail-d4');triggerD4Download(b);return}
    if(e.target.closest('[data-card-manual]')){openSelectedManualSearch();return}
    if(e.target.closest('[data-scroll-images]'))openFirstImage();
  });
  el('detail-body').addEventListener('keydown',e=>{if(!e.target.matches('.png-tab')||!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...document.querySelectorAll('.png-tab:not(:disabled)')];let i=tabs.indexOf(e.target);i=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(e.key==='ArrowRight'?1:-1)+tabs.length)%tabs.length;tabs[i]?.focus();if(tabs[i])openImage(tabs[i].dataset.viewKind)});
  el('back-results').addEventListener('click',()=>{el('channels-view').hidden=true;el('results-view').hidden=false});
  el('center-export').addEventListener('click',exportSelectedTable);
  el('inspector-channels').addEventListener('click',()=>{if(selectedMode!==null)show(selectedMode)});
  el('close-detail').addEventListener('click',()=>el('hunter-detail').close());
  el('hunter-detail').addEventListener('close',()=>{selectedMode=null;selectedDetailData=null;el('inspector-empty').hidden=false;el('channels-view').hidden=true;el('results-view').hidden=false;document.querySelectorAll('.is-selected').forEach(row=>row.classList.remove('is-selected'))});

  let hunterStarting=false;
  async function initHunter(){
    if(catalog||hunterStarting)return;hunterStarting=true;clearDmxFilters();
    try{
      if(!window.HunterIndex)await loadScript('assets/hunter/index.js','hunter-index-script');
      const data=await unpack(window.HunterIndex);catalog=data;fixtures=new Map(data.aparatos.map(f=>[f[0],f]));tokens=data.atributos.map(norm);modeById=new Map(data.modos.map(m=>[m[0],m]));delete window.HunterIndex;
      el('fixture-count').textContent=data.aparatos.length.toLocaleString('es-ES');el('mode-count').textContent=data.modos.length.toLocaleString('es-ES');
      buildFunctionOptions();
      el('manufacturer-list').innerHTML=[...new Set(data.aparatos.map(f=>f[1]))].sort((a,b)=>a.localeCompare(b)).map(name=>'<option value="'+escape(name)+'">').join('');
      el('search-button').disabled=false;
      // Arranque blindado: siempre 0 resultados hasta que exista al menos un criterio real.
      resetToEmptyState({clearFields:true});
      probeD4Api().then(()=>scheduleD4Resolve());
    }catch(e){el('hunter-status').textContent='No se puede cargar el catálogo en este navegador. Usa una versión actual de Chrome, Edge o Firefox.';console.error(e)}
    finally{hunterStarting=false}
  }
  window.addEventListener('pageshow',e=>{if(e.persisted&&catalog)resetToEmptyState({clearFields:true})});
  initHunter();
})();
