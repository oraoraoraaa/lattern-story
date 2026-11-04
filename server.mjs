import {openDatabase} from './lib/database.mjs';
import {Accounts,cookieToken,sessionCookie} from './lib/accounts.mjs';
import {Learning} from './lib/learning.mjs';
import {Tutor} from './lib/tutor.mjs';
import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {fileURLToPath,pathToFileURL} from 'node:url';
import path from 'node:path';
import {spawn} from 'node:child_process';
import {createProvider} from './lib/provider.mjs';
import {demoProvider} from './lib/demo.mjs';
import {Sessions,GameError} from './lib/sessions.mjs';
const ROOT=fileURLToPath(new URL('.',import.meta.url));
export async function loadConfig(){
 const values={};
 try{for(const line of (await readFile(path.join(ROOT,'.env'),'utf8')).split(/\r?\n/)){
  const m=line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);if(m)values[m[1]]=m[2].replace(/^(['"])(.*)\1$/,'$2');
 }}catch(e){if(e.code!=='ENOENT')throw e;}
 const get=(key,fallback)=>process.env[key]??values[key]??fallback;
 const baseURL=get('DEEPSEEK_BASE_URL','https://api.deepseek.com').replace(/\/+$/,'');
 const url=new URL(baseURL);if(url.protocol!=='https:'&&!(url.protocol==='http:'&&['localhost','127.0.0.1','[::1]'].includes(url.hostname)))throw new Error('Use HTTPS for remote AI services.');
 return {key:get('DEEPSEEK_API_KEY',''),baseURL,model:get('DEEPSEEK_MODEL','deepseek-flash'),studyModel:get('DEEPSEEK_STUDY_MODEL','deepseek-flash'),databasePath:path.join(get('LANTERN_DATA_DIR',path.join(ROOT,'data')),'lantern.sqlite'),port:Number(get('PORT','8787'))};
}
const TYPES={'.html':'text/html; charset=utf-8','.css':'text/css; charset=utf-8','.mjs':'text/javascript; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.otf':'font/otf','.txt':'text/plain; charset=utf-8','.json':'application/json; charset=utf-8'};
async function bodyJSON(req){
 if(!req.headers['content-type']?.startsWith('application/json'))throw new GameError('Expected JSON.',415);
 let bytes=0;const parts=[];
 for await(const part of req){bytes+=part.length;if(bytes>12000)throw new GameError('Request too large.',413);parts.push(part);}
 try{const value=JSON.parse(Buffer.concat(parts).toString('utf8'));if(!value||Array.isArray(value)||typeof value!=='object')throw new Error();return value;}catch{throw new GameError('Invalid JSON.');}
}
export function createApp(config,{provider,sessions,database,tutorFetcher}={}){
 const db=database??openDatabase(config.databasePath??':memory:');
 const accounts=new Accounts(db),learning=new Learning(db),tutor=new Tutor(db,learning,config,{fetcher:tutorFetcher??fetch});
 const store=sessions??new Sessions(provider??createProvider(config),demoProvider);
 const server=createServer(async(req,res)=>{
  const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
  try{
   const port=server.address()?.port;
   const hosts=[`127.0.0.1:${port}`,`localhost:${port}`];
   if(!hosts.includes(req.headers.host))throw new GameError('Invalid local host.',403);
   const origin=req.headers.origin;
   if(origin&&!hosts.some(host=>origin===`http://${host}`))throw new GameError('Cross-site requests are not allowed.',403);
   const url=new URL(req.url,`http://${req.headers.host}`);
   const token=cookieToken(req.headers.cookie);
   if(url.pathname==='/api/config'&&req.method==='GET')return json(200,{hasKey:!!config.key});
   if(url.pathname==='/api/account'&&req.method==='GET')return json(200,{user:accounts.authenticate(token)});
   if(url.pathname==='/api/learn/summary'&&req.method==='GET')return json(200,learning.summary(accounts.require(token)));
   if(url.pathname.startsWith('/api/')){
    if(req.method!=='POST')throw new GameError('Use POST.',405);
    const data=await bodyJSON(req);
    if(['/api/account/register','/api/account/login'].includes(url.pathname)){
     const result=await accounts[url.pathname.split('/').pop()](data.username,data.password,'local');
     if(token)accounts.logout(token);res.setHeader('Set-Cookie',sessionCookie(result.token));return json(200,{user:result.user});
    }
    if(url.pathname==='/api/account/logout'){
     const user=accounts.authenticate(token);accounts.logout(token);if(user)tutor.forget(user.id);res.setHeader('Set-Cookie',sessionCookie('',0));return json(200,{signedOut:true});
    }
    if(url.pathname.startsWith('/api/learn/')){
     const user=accounts.require(token),action=url.pathname.split('/').pop();
     if(action==='plan')return json(200,{session:learning.plan(user,data.goal)});
     if(action==='resume'){const session=learning.load(user.id);return json(200,{session:session?learning.snapshot(session):null});}
     return json(200,learning.act(user,action,data));
    }
    if(url.pathname.startsWith('/api/tutor/')){
     const user=accounts.require(token),action=url.pathname.split('/').pop();
     if(!['example','chat'].includes(action))throw new GameError('Not found.',404);
     return json(200,await tutor[action](user,data));
    }
    const result=url.pathname==='/api/story/start'?await store.start(data):url.pathname.startsWith('/api/story/')?await store.action(data.id,url.pathname.split('/').pop(),data):null;
    if(!result)throw new GameError('Not found.',404);return json(200,result);
   }
   if(!['GET','HEAD'].includes(req.method))throw new GameError('Method not allowed.',405);
   let pathname;try{pathname=decodeURIComponent(url.pathname);}catch{throw new GameError('Invalid URL.');}
   const parts=pathname.split(/[\\/]/);if(parts.some(p=>p.startsWith('.')||p.includes('\0')))throw new GameError('Not found.',404);
   const filename=path.join(ROOT,'public',pathname==='/'?'index.html':pathname);
   if(!filename.startsWith(path.join(ROOT,'public')+path.sep))throw new GameError('Not found.',404);
   let info;try{info=await stat(filename);}catch{throw new GameError('Not found.',404);}if(!info.isFile())throw new GameError('Not found.',404);
   res.writeHead(200,{'Content-Type':TYPES[path.extname(filename)]??'application/octet-stream','Content-Length':info.size,'Cache-Control':'no-cache'});res.end(req.method==='HEAD'?undefined:await readFile(filename));
  }catch(error){
   if(!(error instanceof GameError))console.error('[Lantern]',String(error.message??'Request failed.').replaceAll(config.key||'\u0000','[redacted]'));
   const message=error instanceof GameError?error.message:req.url?.startsWith('/api/tutor/')?'The tutor could not find the words. Please try again.':'The storyteller could not find the words. Please try again.';
   json(error.status??502,{error:message});
  }
 });
 server.on('close',()=>{for(const s of store.items.values())s.controller?.abort();store.items.clear();if(!database)db.close();});
 return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const config=await loadConfig();
 if(!Number.isInteger(config.port)||config.port<1||config.port>65535)throw new Error('PORT must be between 1 and 65535.');
 const server=createApp(config);
 server.on('error',e=>{console.error(e.code==='EADDRINUSE'?`Port ${config.port} is busy. Close the existing server or change PORT in .env.`:e.message);process.exitCode=1;});
 server.listen(config.port,'127.0.0.1',()=>{
  const url=`http://127.0.0.1:${config.port}`;
  console.log(`\n  Lantern Stories\n  Local: ${url}\n  AI: ${config.key?config.model:'not configured — Offline demo available'}\n  Stop: Ctrl+C\n`);
  if(process.argv.includes('--open')){
   const child=process.platform==='darwin'?spawn('open',[url],{stdio:'ignore'}):process.platform==='win32'?spawn('cmd',['/c','start','',url],{stdio:'ignore'}):spawn('xdg-open',[url],{stdio:'ignore'});child.on('error',()=>console.log(`Open ${url} in your browser.`));child.unref();
  }
 });
 for(const event of ['SIGINT','SIGTERM'])process.once(event,()=>{server.close();server.closeAllConnections();});
}
