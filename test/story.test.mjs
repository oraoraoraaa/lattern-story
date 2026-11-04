import test from 'node:test';
import assert from 'node:assert/strict';
import {Sessions} from '../lib/sessions.mjs';
import {demoProvider} from '../lib/demo.mjs';
import {validateNarrative,narrativePrompt,translationPrompt,createProvider} from '../lib/provider.mjs';
import {CHARACTERS} from '../public/lib/content.mjs';
import {compactMemory,contextFor} from '../lib/memory.mjs';
const request={characterId:'haruka',sceneId:0,language:'en',mode:'demo'};
async function reply(store,s,path){s=await store.action(s.id,'read',{romaji:s.line.romaji});s=await store.action(s.id,'draft',{text:s.line.choices.find(c=>c.path===path).text});return store.action(s.id,'send',{romaji:s.playerLine.romaji});}
test('all nine scenes, all languages, align their authored opening and translated choices',async()=>{
 for(const character of CHARACTERS)for(const scene of character.scenes)for(const language of ['en','zh','es']){
  const store=new Sessions(demoProvider,demoProvider);let s=await store.start({...request,characterId:character.id,sceneId:scene.id,language});
  assert.equal(s.line.chunks.map(c=>c.japanese).join(''),s.line.japanese);assert.equal(s.line.choices.length,3);s=await reply(store,s,'hidden');assert.equal(s.turn,1);assert.equal(s.line.emotion,'shy');
 }
});
test('three six-round stories reach good, hidden and bad; final line must be practiced',async()=>{
 for(const path of ['good','hidden','bad']){
  const store=new Sessions(demoProvider,demoProvider);let s=await store.start(request);
  for(let i=0;i<6;i++){s=await reply(store,s,path);assert.equal(s.turn,i+1);assert.equal(s.line.ending,i<5?'none':path);}
  assert.equal(s.stage,'character');assert.equal(s.journal.length,13);s=await store.action(s.id,'read',{romaji:s.line.romaji});assert.equal(s.stage,'ending');await assert.rejects(()=>store.action(s.id,'draft',{text:'again'}));
 }
});
test('practice gates cannot be skipped; editing must translate again',async()=>{
 const store=new Sessions(demoProvider,demoProvider);let s=await store.start(request);
 await assert.rejects(()=>store.action(s.id,'draft',{text:'a'}));await assert.rejects(()=>store.action(s.id,'read',{romaji:'issho'}));
 s=await store.action(s.id,'read',{romaji:s.line.romaji});s=await store.action(s.id,'draft',{text:s.line.choices[1].text});assert.match(s.playerLine.japanese,/抱きしめる/);
 await assert.rejects(()=>store.action(s.id,'send',{romaji:'wrong'}));s=await store.action(s.id,'edit');assert.equal(s.stage,'reply');await assert.rejects(()=>store.action(s.id,'send',{romaji:s.playerLine.romaji}));
});
test('failed AI round is retryable without duplicate history or lost practice',async()=>{
 let fail=true;const provider={...demoProvider,async narrative(s){if(s.turn&&fail){fail=false;throw new Error('temporary failure');}return demoProvider.narrative(s);}};
 const store=new Sessions(provider,provider);let s=await store.start(request);s=await store.action(s.id,'read',{romaji:s.line.romaji});s=await store.action(s.id,'draft',{text:s.line.choices[0].text});
 await assert.rejects(()=>store.action(s.id,'send',{romaji:s.playerLine.romaji}));assert.equal(store.get(s.id).history.length,1);assert.equal(store.get(s.id).stage,'player');
 s=await store.action(s.id,'send',{romaji:s.playerLine.romaji});assert.equal(s.turn,1);assert.equal(s.journal.length,3);assert.equal(store.get(s.id).history.length,3);
});
test('closing an in-flight scene revokes its response and prevents double sends',async()=>{
 let release;const wait=new Promise(r=>release=r);const provider={...demoProvider,async translate(s,t){await wait;return demoProvider.translate(s,t);}};
 const store=new Sessions(provider,provider);let s=await store.start(request);s=await store.action(s.id,'read',{romaji:s.line.romaji});const pending=store.action(s.id,'draft',{text:s.line.choices[0].text});await assert.rejects(()=>store.action(s.id,'draft',{text:'duplicate'}),/already in progress/);await store.action(s.id,'close');release();await assert.rejects(()=>pending,/closed/);assert.equal(store.items.size,0);
});
test('sessions expire and new scenes do not inherit memories',async()=>{
 let now=0;const store=new Sessions(demoProvider,demoProvider,{now:()=>now});const a=await store.start(request);now=7200001;assert.throws(()=>store.get(a.id),/expired/);const b=await store.start({...request,characterId:'hana'});assert.equal(b.turn,0);assert.equal(b.journal.length,1);
});
function narrative(){return {japanese:'本です。',translation:'It is a book.',chunks:[{japanese:'本',reading:'ほん'},{japanese:'です',reading:'です'},{japanese:'。',reading:''}],emotion:'normal',ending:'none',memory:'At the library.',choices:['good','hidden','bad'].map((path,i)=>({path,text:`choice ${i}`}))};}
test('provider response validates emotion, distinct choices and ending pace',()=>{
 const c=CHARACTERS[1];assert.equal(validateNarrative({...narrative(),emotion:'pensive'},c,0).emotion,'thoughtful');
 for(const change of [{emotion:'unknown'},{ending:'good'},{choices:[]},{memory:null},{choices:[{path:'good',text:'same'},{path:'hidden',text:'same'},{path:'bad',text:'x'}]}])assert.throws(()=>validateNarrative({...narrative(),...change},c,0));
 assert.throws(()=>validateNarrative(narrative(),c,6));assert.equal(validateNarrative({...narrative(),ending:'hidden',choices:[]},c,6).ending,'hidden');
});
test('short prompts and bounded context preserve opening, recap and related older turns',()=>{
 const s={character:CHARACTERS[1],scene:CHARACTERS[1].scenes[0],turn:6,language:'en',history:Array.from({length:20},(_,i)=>({role:i%2?'user':'assistant',content:i===1?'図書館の約束':`turn ${i}`})),memory:'あ'.repeat(900)};
 s.history[19].content='図書館に行こう';const context=contextFor(s);assert.ok([...context.memory].length<=360);assert.ok(context.messages.length<=9);assert.ok(context.messages.some(m=>m.content==='図書館の約束'));assert.equal(context.messages[0],s.history[0]);assert.equal(context.messages.at(-1),s.history.at(-1));assert.equal([...compactMemory('あ'.repeat(1000))].length,357);
 for(const character of CHARACTERS)for(const scene of character.scenes)assert.ok(narrativePrompt({...s,character,scene}).length<1400);assert.ok(translationPrompt('en').length<650);
});
test('OpenAI-compatible request uses server key, JSON format and bounded history',async()=>{
 let request;const config={key:'test-secret',model:'test-model',baseURL:'https://api.deepseek.com'};const provider=createProvider(config,async(url,options)=>{request={url,...options};return {ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(narrative())}}]})};});
 const s={character:CHARACTERS[1],scene:CHARACTERS[1].scenes[0],turn:0,language:'en',history:[]};await provider.narrative(s);const body=JSON.parse(request.body);assert.equal(request.headers.Authorization,'Bearer test-secret');assert.equal(request.url,'https://api.deepseek.com/chat/completions');assert.deepEqual(body.response_format,{type:'json_object'});assert.equal(body.thinking.type,'disabled');assert.equal(body.model,'test-model');
});
test('Japanese choice labels get a small language repair without changing paths or story',async()=>{
 let calls=0;const data=narrative();data.choices=data.choices.map(c=>({...c,text:'一緒に読もう'+c.path}));
 const provider=createProvider({key:'test-secret',model:'test',baseURL:'https://api.deepseek.com'},async()=>({ok:true,json:async()=>({choices:[{message:{content:JSON.stringify(++calls===1?data:{labels:['一起读书','轻轻拥抱','独自离开']})}}]})}));
 const line=await provider.narrative({character:CHARACTERS[1],scene:CHARACTERS[1].scenes[0],turn:0,language:'zh',history:[]});assert.equal(calls,2);assert.deepEqual(line.choices.map(c=>c.path),['good','hidden','bad']);assert.equal(line.choices[0].text,'一起读书');assert.equal(line.japanese,data.japanese);
});
