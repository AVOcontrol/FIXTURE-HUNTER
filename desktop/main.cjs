'use strict';
const {app,BrowserWindow,protocol,net,shell,dialog}=require('electron');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
const content=process.env.FH_CONTENT_ROOT?path.resolve(process.env.FH_CONTENT_ROOT):path.join(__dirname,'content');
const storage=process.env.FH_QA_USERDATA?path.resolve(process.env.FH_QA_USERDATA):path.join(path.dirname(app.getPath('exe')),'datos-usuario');
fs.mkdirSync(storage,{recursive:true});app.setPath('userData',storage);
app.setName('AVOcontrol Fixture Hunter');
protocol.registerSchemesAsPrivileged([{scheme:'fixturehunter',privileges:{standard:true,secure:true,supportFetchAPI:true,corsEnabled:true,stream:true}}]);
const inside=(root,file)=>{const relative=path.relative(root,file);return !relative.startsWith('..')&&!path.isAbsolute(relative)};
function external(url){if(/^https?:\/\//i.test(url))shell.openExternal(url).catch(()=>{})}
let main;
if(!app.requestSingleInstanceLock()){app.quit()}else{
 app.on('second-instance',()=>{if(main){if(main.isMinimized())main.restore();main.show();main.focus()}});
 app.whenReady().then(()=>{
  protocol.handle('fixturehunter',async request=>{
   const url=new URL(request.url);if(url.host!=='app')return new Response('Not found',{status:404});
   try{
    const pathname=decodeURIComponent(url.pathname);
    const isD4=pathname.startsWith('/d4/');
    const root=path.join(content,isD4?'d4':'www');
    const relative=(isD4?pathname.slice(4):pathname).replace(/^\/+/, '');
    let file=path.resolve(root,relative||'index.html');
    if(!inside(root,file))return new Response('Forbidden',{status:403});
    if(fs.statSync(file).isDirectory())file=path.join(file,'index.html');
    return await net.fetch(pathToFileURL(file).toString());
   }catch{return new Response('Not found',{status:404})}
  });
  main=new BrowserWindow({width:1460,height:1000,minWidth:560,minHeight:500,show:!process.env.FH_QA_USERDATA,backgroundColor:'#0a0c0f',title:'AVOcontrol Fixture Hunter',icon:path.join(content,'www/favicon.ico'),autoHideMenuBar:true,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,webSecurity:true}});
  main.removeMenu();
  main.webContents.setWindowOpenHandler(({url})=>{external(url);return {action:'deny'}});
  main.webContents.on('will-navigate',(event,url)=>{if(!url.startsWith('fixturehunter://app/')){event.preventDefault();external(url)}});
  main.webContents.session.setPermissionRequestHandler((_contents,_permission,callback)=>callback(false));
  main.webContents.session.on('will-download',(_event,item)=>{
   if(process.env.FH_QA_DOWNLOADS){
    const destination=path.resolve(process.env.FH_QA_DOWNLOADS);fs.mkdirSync(destination,{recursive:true});
    item.setSavePath(path.join(destination,path.basename(item.getFilename())));
   }
  });
  main.on('closed',()=>{main=null;app.quit()});
  main.loadURL('fixturehunter://app/index.html');
 }).catch(error=>{if(!process.env.FH_QA_USERDATA)dialog.showErrorBox('Fixture Hunter',String(error.message||error));console.error(error);app.exit(1)});
}
app.on('window-all-closed',()=>app.quit());
process.on('uncaughtException',error=>{console.error(error);if(!process.env.FH_QA_USERDATA)dialog.showErrorBox('Fixture Hunter',String(error.message||error));app.exit(1)});
