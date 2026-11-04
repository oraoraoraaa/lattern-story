import {randomBytes} from 'node:crypto';
import {getCharacter,LANGUAGES} from '../public/lib/content.mjs';
import {normalizeInput} from '../public/lib/romaji.mjs';
export class GameError extends Error {constructor(message,status=400){super(message);this.status=status;}}
export class Sessions {
 constructor(live,demo,{now=Date.now,max=100}={}){this.live=live;this.demo=demo;this.now=now;this.max=max;this.items=new Map();}
 sweep(){for(const [id,s] of this.items)if(this.now()-s.touched>7200000){s.revoked=true;s.controller?.abort();this.items.delete(id);}}
 get(id){this.sweep();const s=this.items.get(id);if(!s)throw new GameError('This story expired. Start a new scene.',404);s.touched=this.now();return s;}
 snapshot(s){return {id:s.id,characterId:s.character.id,sceneId:s.scene.id,language:s.language,mode:s.mode,turn:s.turn,stage:s.stage,line:s.line,playerLine:s.playerLine??null,draft:s.draft??'',journal:s.journal};}
 async exclusive(s,work){
  if(s.busy)throw new GameError('A request is already in progress.',409);
  s.busy=true;s.controller=new AbortController();
  try{const result=await work(s.controller.signal);if(s.revoked)throw new GameError('Story was closed.',410);return result;}
  finally{s.busy=false;s.controller=null;}
 }
 async start({characterId,sceneId,language='en',mode='live'}){
  this.sweep();const character=getCharacter(characterId),scene=character?.scenes.find(x=>x.id===sceneId);
  if(!scene||!LANGUAGES[language]||!['live','demo'].includes(mode))throw new GameError('Choose a valid character, scene and language.');
  if(this.items.size>=this.max)throw new GameError('Too many local stories. Close a scene and try again.',429);
  const s={id:randomBytes(24).toString('hex'),character,scene,language,mode,turn:0,history:[],memory:'',journal:[],stage:'character',touched:this.now()};
  const provider=mode==='demo'?this.demo:this.live;
  const line=await this.exclusive(s,signal=>provider.narrative(s,signal));
  s.line=line;s.memory=line.memory;s.history=[{role:'assistant',content:line.japanese}];s.journal=[{speaker:character.name,...line}];this.items.set(s.id,s);
  return this.snapshot(s);
 }
 async action(id,action,payload={}){
  const s=this.get(id);
  if(action==='close'){s.revoked=true;s.controller?.abort();this.items.delete(id);return {closed:true};}
  if(s.busy)throw new GameError('A request is already in progress.',409);
  const provider=s.mode==='demo'?this.demo:this.live;
  if(action==='read'){
   if(s.stage!=='character')throw new GameError('Read the current character line first.',409);
   this.requirePractice(s.line,payload.romaji);s.stage=s.line.ending==='none'?'reply':'ending';return this.snapshot(s);
  }
  if(action==='edit'){
   if(s.stage!=='player')throw new GameError('There is no translated reply to edit.',409);
   s.stage='reply';return this.snapshot(s);
  }
  if(action==='draft'){
   if(s.stage!=='reply')throw new GameError('Finish practicing the current line first.',409);
   const text=typeof payload.text==='string'?payload.text.trim():'';
   if(!text||[...text].length>160)throw new GameError('Write 1–160 characters.');
   const playerLine=await this.exclusive(s,signal=>provider.translate(s,text,signal));
   s.draft=text;s.playerLine=playerLine;s.path=s.line.choices.find(c=>c.text===text)?.path;s.stage='player';return this.snapshot(s);
  }
  if(action==='send'){
   if(s.stage!=='player')throw new GameError('Translate and practice your reply first.',409);
   this.requirePractice(s.playerLine,payload.romaji);
   const history=[...s.history,{role:'user',content:s.playerLine.japanese}];
   const prospective={...s,turn:s.turn+1,history};
   const line=await this.exclusive(s,signal=>provider.narrative(prospective,signal));
   // Commit the entire round only after a validated reply. A retry cannot duplicate it.
   s.turn++;s.history=[...history,{role:'assistant',content:line.japanese}];s.memory=line.memory;
   s.journal.push({speaker:'You',...s.playerLine},{speaker:s.character.name,...line});
   s.line=line;s.stage='character';s.playerLine=null;s.draft='';return this.snapshot(s);
  }
  throw new GameError('Unknown story action.',404);
 }
 requirePractice(line,input){if(typeof input!=='string'||normalizeInput(input)!==line.romaji)throw new GameError('Type the complete romaji line before continuing.',409);}
}
