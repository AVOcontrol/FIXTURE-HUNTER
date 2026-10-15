import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=path.join(root,'d4');
const publicAssets=path.join(root,'android/app/src/main/assets/public');
if(!fs.existsSync(path.join(publicAssets,'index.html')))throw Error('Run cap sync android before adding the offline library.');
const files=fs.readdirSync(source).filter(name=>name.toLowerCase().endsWith('.d4'));
if(!files.length)throw Error('The original d4 library is missing.');
const destination=path.join(publicAssets,'d4');
fs.mkdirSync(destination,{recursive:true});
for(const name of files)fs.copyFileSync(path.join(source,name),path.join(destination,name));
console.log('Android: '+files.length+' original .d4 files included for offline downloads.');
