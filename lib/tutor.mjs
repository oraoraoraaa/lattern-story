import {createHash,randomBytes} from 'node:crypto';
import {createJSONClient} from './provider.mjs';
import {hiragana,kanaRomaji} from '../public/lib/romaji.mjs';
import {meaningsFor} from './learning.mjs';
import {GameError} from './sessions.mjs';
const languages={en:'English',zh:'Simplified Chinese',es:'Spanish'};
export class Tutor{
 constructor(db,learning,config,{fetcher=fetch,now=Date.now}={}){this.db=db;this.learning=learning;this.config=config;this.call=createJSONClient(config,fetcher);this.now=now;this.threads=new Map();this.pending=new Map();this.limits=new Map();}
 limit(userId){
  const now=this.now();for(const [id,t] of this.threads)if(t.expires<now)this.threads.delete(id);
  for(const [id,t] of this.limits)if(t.until<now)this.limits.delete(id);
  const limit=this.limits.get(userId)??{count:0,until:now+600000};if(limit.count>=60)throw new GameError('Let the tutor catch its breath. Please try again in a few minutes.',429);
  limit.count++;this.limits.set(userId,limit);
 }
 context(user,entryId,reading,language){
  const word=this.learning.byId.get(entryId);
  if(!word||!this.learning.canDiscuss(user,entryId))throw new GameError('Choose a word from your studies first.',403);
  if(!languages[language])throw new GameError('Choose a supported translation language.');
  reading=word.readings.includes(reading)?reading:word.readings[0];
  return {word,reading,language,meaning:meaningsFor(word,reading).slice(0,4).join('; ')};
 }
 async example(user,{entryId,reading,language='en'}){
  const context=this.context(user,entryId,reading,language),model=this.config.studyModel??'deepseek-flash';
  const key=createHash('sha256').update(JSON.stringify([context,model])).digest('hex');
  let example;const cached=this.db.prepare('SELECT payload FROM tutor_examples WHERE cache_key=?').get(key);
  if(cached)example=JSON.parse(cached.payload);
  else{
   if(!this.pending.has(key)){
    this.limit(user.id);
    const request=(async()=>{
     const data=await this.call([{role:'system',content:`Japanese tutor. Give ONE natural everyday beginner example using the exact writing and specified reading. JSON: {japanese,reading,translation,note}. reading: whole sentence in kana. translation and brief usage note in ${languages[language]}. No markdown.`},{role:'user',content:JSON.stringify({word:context.word.kanji,reading:context.reading,meaning:context.meaning})}],undefined,{model,maxTokens:550,temperature:0.4});
     if(!data||typeof data.japanese!=='string'||data.japanese.length>180||!data.japanese.includes(context.word.kanji)||typeof data.reading!=='string'||data.reading.length>240||!hiragana(data.reading).includes(hiragana(context.reading))||typeof data.translation!=='string'||!data.translation.trim()||data.translation.length>500||typeof data.note!=='string'||data.note.length>650)throw new GameError('The tutor lost its place. Ask for the example again.',502);
     kanaRomaji(data.reading);const clean={japanese:data.japanese,reading:data.reading,translation:data.translation,note:data.note};
     this.db.prepare('INSERT OR REPLACE INTO tutor_examples VALUES(?,?,?)').run(key,this.now(),JSON.stringify(clean));return clean;
    })();this.pending.set(key,request);
   }
   try{example=await this.pending.get(key);}finally{this.pending.delete(key);}
  }
  while(this.threads.size>=100)this.threads.delete(this.threads.keys().next().value);
  const threadId=randomBytes(18).toString('hex');this.threads.set(threadId,{userId:user.id,context,example,messages:[],expires:this.now()+3600000,busy:false});
  return {example,threadId};
 }
 async chat(user,{threadId,question}){
  const t=this.threads.get(threadId);
  if(!t||t.userId!==user.id||t.expires<this.now())throw new GameError('Open an example to start a new conversation with the tutor.',404);
  if(t.busy)throw new GameError('The tutor is finishing its reply.',409);
  question=typeof question==='string'?question.trim():'';
  if(!question||[...question].length>400)throw new GameError('Keep your question within 400 characters.');
  this.limit(user.id);t.busy=true;
  try{
   const c=t.context;
   const reply=await this.call([{role:'system',content:`You are a concise Japanese tutor. Topic: ${c.word.kanji} (${c.reading}): ${c.meaning}. Example: ${t.example.japanese}. Answer in ${languages[c.language]}, <=120 words. Only examples may be Japanese; add kana readings. Stay on Japanese learning. JSON only: {answer}.`},...t.messages.slice(-4),{role:'user',content:question}],undefined,{model:this.config.studyModel??'deepseek-flash',maxTokens:600,temperature:0.4});
   if(typeof reply?.answer!=='string'||!reply.answer.trim()||reply.answer.length>2400)throw new GameError('The tutor lost its place. Please ask again.',502);
   t.messages.push({role:'user',content:question},{role:'assistant',content:reply.answer});t.messages=t.messages.slice(-4);t.expires=this.now()+3600000;return {answer:reply.answer};
  }finally{t.busy=false;}
 }
 forget(userId){for(const [id,t] of this.threads)if(t.userId===userId)this.threads.delete(id);}
}
