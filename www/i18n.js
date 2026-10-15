/* Offline interface localization. Catalogue names, channel data and files remain original. */
(() => {
 'use strict';
 const catalogue=window.FHLocales;
 if(!catalogue?.languages?.length){console.error('Fixture Hunter locale catalogue is missing.');return}
 const languages=new Map(catalogue.languages.map(value=>[value.code,value]));
 const indexes=new Map(catalogue.keys.map((key,index)=>[key,index]));
 const attributes=['placeholder','title','aria-label','alt','data-label'];
 const preferenceKey='fh-language-v2';
 const originalText=new WeakMap(),originalAttributes=new WeakMap(),explicitTranslations=new Map();
 const protectedContent='.fh-lang,.fh-sg,[data-no-tr],#detail-title,#detail-manufacturer,#channels-title,#manufacturer-list,#model-list,.hunter-ranges li,.detail-table td:nth-child(2)';
 let language='en',current=languages.get('en'),numberFormat=new Intl.NumberFormat('en'),selector;
 const template=(key,values={})=>current.patterns[key].replace(/\{(\w+)\}/g,(_match,name)=>String(values[name]??''));
 const count=value=>numberFormat.format(Number(String(value).replace(/[.,]/g,'')));
 function translate(value){
  const source=String(value),text=source.trim();
  if(!text)return source;
  const exact=indexes.get(text);
  if(exact!==undefined)return source.replace(text,current.messages[exact]);
  let match,result;
  if(text==='PLANTA')result=current.patterns.top;
  else if(text==='FRONTAL')result=current.patterns.front;
  else if(text==='Resultados de búsqueda')result=current.patterns.searchResults;
  else if(text==='Aparato seleccionado')result=current.patterns.selectedFixture;
  else if((match=text.match(/^([\d.,]+) coincidencias exactas$/)))result=template('exactMatches',{n:count(match[1])});
  else if((match=text.match(/^0 exactos · (\d+) alternativas cercanas$/)))result=template('alternatives',{n:count(match[1])});
  else if((match=text.match(/^(\d+) canal(?:es)? (menos|más)$/)))result=template(match[2]==='menos'?'fewer':'more',{n:count(match[1])});
  else if((match=text.match(/^(.*) · (\d+) células$/)))result=template('cells',{name:match[1],n:count(match[2])});
  else if((match=text.match(/^(\d+) células$/)))result=template('cells',{name:'',n:count(match[1])}).replace(/^\s*·\s*/,'');
  else if((match=text.match(/^(.*) · (\d+) canales DMX(?: · (.*))?$/)))result=match[1]+' · '+template('dmx',{n:count(match[2])})+(match[3]?' · '+match[3]:'');
  else if((match=text.match(/^(\d+) canales DMX$/)))result=template('dmx',{n:count(match[1])});
  else if((match=text.match(/^(Marca contiene|Modelo contiene|Total de canales|Células): (.*)$/)))result=translate(match[1])+': '+translate(match[2]);
  else if((match=text.match(/^(.*) \((Igual a|Al menos|Como máximo)\)$/)))result=translate(match[1])+' ('+translate(match[2])+')';
  else if((match=text.match(/^Quitar filtro (.+)$/)))result=translate('Quitar filtro')+' '+translate(match[1]);
  else if((match=text.match(/^Abrir (.+)$/)))result=translate('Abrir')+' '+translate(match[1]);
  else if((match=text.match(/^(PLANTA|FRONTAL|3D) · (.+)$/)))result=translate(match[1])+' · '+match[2];
  else if((match=text.match(/^canal (\d+)(.*)$/)))result=translate('Canal').toLocaleLowerCase(language)+' '+match[1]+match[2];
  else if((match=text.match(/^Atributos sin canal físico \((\d+)\)$/)))result=template('unmapped',{n:count(match[1])});
  else if((match=text.match(/^Esta personalidad contiene datos por comprobar:(.*)$/)))result=translate('Esta personalidad contiene datos por comprobar')+':'+match[1];
  else if((match=text.match(/^(.*)\. Se conserva lo que indica el archivo original\.$/)))result=template('preserved',{text:match[1]});
  else if((match=text.match(/^Descargar (.+) PNG$/)))result=template('downloadView',{view:translate(match[1])});
  else if((match=text.match(/^Planta \/ frontal: (.*)$/)))result=template('views',{text:translate(match[1])});
  else if((match=text.match(/^(\d+) funciones \/ rangos$/)))result=template('ranges',{n:count(match[1])});
  else if((match=text.match(/^SIN (.+)$/)))result=template('noAsset',{asset:translate(match[1])});
  return result===undefined?source:source.replace(text,result);
 }
 window.FHT=value=>{
  const source=String(value),translated=translate(source);
  if(translated!==source)explicitTranslations.set(translated,source);
  return translated;
 };
 function skip(node){
  const parent=node.nodeType===1?node:node.parentElement;
  return !parent||/^(SCRIPT|STYLE|TEXTAREA|NOSCRIPT)$/.test(parent.nodeName)||parent.closest(protectedContent);
 }
 function localizeText(node){
  if(skip(node))return;
  const value=node.nodeValue,previous=originalText.get(node);
  const source=previous&&value===previous.rendered?previous.source:(explicitTranslations.get(value)||value);
  let rendered=translate(source);
  if(node.parentElement.closest('.stats')&&/^\d{1,3}(?:\.\d{3})+$/.test(source.trim()))rendered=count(source.trim());
  if(rendered!==source||previous){originalText.set(node,{source,rendered});if(value!==rendered)node.nodeValue=rendered}
 }
 function localizeAttributes(element){
  if(skip(element))return;
  let saved=originalAttributes.get(element);
  for(const name of attributes){
   const value=element.getAttribute(name);if(value===null)continue;
   const previous=saved?.[name],source=previous&&value===previous.rendered?previous.source:(explicitTranslations.get(value)||value);
   const rendered=translate(source);
   if(rendered!==source||previous){saved??={};saved[name]={source,rendered};originalAttributes.set(element,saved);if(value!==rendered)element.setAttribute(name,rendered)}
  }
 }
 function walk(root){
  if(root.nodeType===Node.TEXT_NODE){localizeText(root);return}
  if(root.nodeType!==Node.ELEMENT_NODE&&root.nodeType!==Node.DOCUMENT_NODE)return;
  if(root.nodeType===Node.ELEMENT_NODE){if(skip(root))return;localizeAttributes(root)}
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_ELEMENT|NodeFilter.SHOW_TEXT);
  for(let node=walker.nextNode();node;node=walker.nextNode())if(node.nodeType===Node.TEXT_NODE)localizeText(node);else localizeAttributes(node);
 }
 const observer=new MutationObserver(records=>{
  for(const record of records){
   if(record.type==='characterData')localizeText(record.target);
   else if(record.type==='attributes')localizeAttributes(record.target);
   else for(const node of record.addedNodes)walk(node);
  }
 });
 const originalTitle=document.title;
 function setLanguage(code,{save=false}={}){
  if(!languages.has(code))code='en';
  language=code;current=languages.get(code);numberFormat=new Intl.NumberFormat(code);
  document.documentElement.lang=code;document.documentElement.dir=current.dir;
  walk(document.body);document.title=translate(originalTitle);
  if(selector){selector.value=code;selector.setAttribute('aria-label',current.languageLabel);selector.closest('.fh-lang').title=current.languageLabel;selector.closest('.fh-lang').querySelector('.fh-lang-label').textContent=current.languageLabel}
  if(save){try{localStorage.setItem(preferenceKey,code)}catch{}}
  window.dispatchEvent(new CustomEvent('fh-languagechange',{detail:{language:code}}));
 }
 function addSelector(){
  const wrapper=document.createElement('label');wrapper.className='fh-lang';wrapper.htmlFor='fh-language';
  wrapper.innerHTML='<svg class="fh-lang-globe" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c5 5 5 13 0 18M12 3c-5 5-5 13 0 18"/></svg><span class="fh-lang-label"></span>';
  selector=document.createElement('select');selector.id='fh-language';selector.className='fh-language-select';selector.dir='ltr';
  for(const definition of languages.values()){
   const option=new Option(definition.nativeName,definition.code);option.lang=definition.code;option.dir='auto';selector.appendChild(option);
  }
  wrapper.appendChild(selector);
  wrapper.insertAdjacentHTML('beforeend','<svg class="fh-lang-chevron" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>');
  selector.addEventListener('change',()=>setLanguage(selector.value,{save:true}));
  const top=document.querySelector('.top .wrap'),intro=document.getElementById('app-intro');
  function toHeader(){
   wrapper.classList.remove('fh-lang-intro');wrapper.classList.add('fh-lang-top');
   top.insertBefore(wrapper,document.getElementById('d4-api-badge'));
  }
  if(intro&&!intro.hidden){wrapper.classList.add('fh-lang-intro');intro.appendChild(wrapper);document.getElementById('intro-open')?.addEventListener('click',toHeader,{once:true})}
  else if(top)toHeader();
  else{wrapper.classList.add('fh-lang-intro');document.body.appendChild(wrapper)}
 }
 function start(){
  addSelector();
  let initial='en';try{const saved=localStorage.getItem(preferenceKey);if(languages.has(saved))initial=saved}catch{}
  setLanguage(initial);
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
  window.FixtureHunterI18n={setLanguage,translate,get language(){return language},supported:[...languages.keys()]};
 }
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
