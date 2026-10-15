import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const source=JSON.parse(fs.readFileSync(path.join(root,'locales/source.json'),'utf8'));
const keys=Object.keys(source);
const definitions=[
 ['en','English','English','Language','ltr'],['es','Español','Spanish','Idioma','ltr'],
 ['fr','Français','French','Langue','ltr'],['de','Deutsch','German','Sprache','ltr'],
 ['it','Italiano','Italian','Lingua','ltr'],['pt','Português','Portuguese','Idioma','ltr'],
 ['ru','Русский','Russian','Язык','ltr'],['zh-Hans','简体中文','Simplified Chinese','语言','ltr'],
 ['hi','हिन्दी','Hindi','भाषा','ltr'],['ar','العربية','Arabic','اللغة','rtl']
];
const patterns=JSON.parse(fs.readFileSync(path.join(root,'locales/patterns.json'),'utf8'));
const languages=definitions.map(([code,nativeName,englishName,languageLabel,dir])=>{
 let messages;
 if(code==='en')messages=Object.values(source);
 else if(code==='es')messages=keys;
 else{
  messages=Array(keys.length);
  const text=fs.readFileSync(path.join(root,'locales',code+'.txt'),'utf8');
  for(const row of text.split(/\r?\n/)){
   if(!row.trim()||row.startsWith('#'))continue;
   const split=row.indexOf('|'),id=Number(row.slice(0,split)),value=row.slice(split+1);
   if(split<1||!Number.isInteger(id)||id<0||id>=keys.length||messages[id]!==undefined||!value.trim())throw Error('Invalid '+code+' message: '+row);
   messages[id]=value;
  }
  for(let id=0;id<keys.length;id++)if(!messages[id])throw Error('Missing '+code+' message '+id+' ('+source[keys[id]]+')');
 }
 if(!patterns[code])throw Error('Missing dynamic messages for '+code);
 return {code,nativeName,englishName,languageLabel,dir,messages,patterns:patterns[code]};
});
fs.writeFileSync(path.join(root,'www/locales.js'),'/* Offline interface translations. Fixture catalogue data remains original. */\nwindow.FHLocales='+JSON.stringify({keys,languages})+';\n');
console.log('Locales: '+languages.length+' languages, '+keys.length+' interface messages each.');
