import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import './build-locales.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const web=path.join(root,'www');
const vendor=path.join(web,'vendor');fs.mkdirSync(vendor,{recursive:true});
fs.copyFileSync(path.join(root,'node_modules/@google/model-viewer/dist/model-viewer.min.js'),path.join(vendor,'model-viewer.min.js'));
fs.copyFileSync(path.join(root,'node_modules/@google/model-viewer/LICENSE'),path.join(vendor,'model-viewer-LICENSE.txt'));
const d4Files=fs.readdirSync(path.join(root,'d4')).filter(name=>name.toLowerCase().endsWith('.d4')).sort();
const d4Set=new Set(d4Files);
fs.writeFileSync(path.join(web,'d4-files.js'),'window.FixtureHunterD4Files=new Set('+JSON.stringify(d4Files)+');\n');
const required=['index.html','intro.js','app.js','studio.css','i18n.js','i18n.css','locales.js','suggest.js','native-bridge.js','updates.js','d4-config.js','d4-files.js','vendor/model-viewer.min.js','descargar/index.html','assets/hunter/index.js','assets/fixture_views/manifest.js'];
for(const relative of required)if(!fs.statSync(path.join(web,relative)).isFile())throw Error('Missing web file: '+relative);
for(const html of ['index.html','descargar/index.html']){
 const text=fs.readFileSync(path.join(web,html),'utf8');
 if(!/<!doctype html>/i.test(text))throw Error('Invalid HTML: '+html);
 for(const match of text.matchAll(/(?:src|href)=["']([^"']+)["']/g)){
  const rel=match[1];if(/^(?:#|https?:|data:|mailto:|javascript:)/i.test(rel))continue;
  const target=path.resolve(path.dirname(path.join(web,html)),decodeURIComponent(rel.split(/[?#]/)[0]));
  if(!target.startsWith(web+path.sep)&&target!==web)throw Error('Asset escapes web root: '+rel);
  if(!fs.existsSync(target))throw Error('Missing '+rel+' referenced by '+html);
 }
}
const context={window:{}};vm.runInNewContext(fs.readFileSync(path.join(web,'assets/fixture_views/manifest.js'),'utf8'),context);
let references=0;for(const view of Object.values(context.window.FixtureViewManifest))for(const kind of ['planta','frontal','tresd','glb']){
 const rel=view[kind];if(!rel)continue;const target=path.resolve(web,rel);
 if(!target.startsWith(web+path.sep)||!fs.existsSync(target))throw Error('Missing fixture asset: '+rel);references++;
}
const version=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8')).version;
const hash=createHash('sha256').update(fs.readFileSync(path.join(web,'assets/hunter/index.js'))).digest('hex');
const hunterContext={window:{}};vm.runInNewContext(fs.readFileSync(path.join(web,'assets/hunter/index.js'),'utf8'),hunterContext);
const catalog=JSON.parse(gunzipSync(Buffer.from(hunterContext.window.HunterIndex,'base64')));
const missingD4=catalog.aparatos.filter(f=>!d4Set.has(f[3])).map(f=>f[3]);
const versionCode=Math.floor(Date.now()/1000);
fs.writeFileSync(path.join(web,'build-info.json'),JSON.stringify({appId:'com.avocontrol.fixturehunter',version,versionCode,fixtureAssetReferences:references,catalogSHA256:hash,fixtures:catalog.aparatos.length,modes:catalog.modos.length,d4Files:d4Files.length,missingD4:missingD4.length},null,2)+'\n');
console.log('Fixture Hunter '+version+': web ready in www; '+references+' fixture asset references verified.');
if(missingD4.length)console.log(missingD4.length+' catalogue entries have no source .d4 file; downloads are disabled for those entries.');
