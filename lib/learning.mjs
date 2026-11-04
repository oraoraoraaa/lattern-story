import {readFileSync} from 'node:fs';
import {randomBytes} from 'node:crypto';
import {acceptsRomaji,hiragana,kanaRomaji} from '../public/lib/romaji.mjs';
import {GameError} from './sessions.mjs';
import {scheduleReview,DAY} from './review.mjs';
import {transaction} from './database.mjs';
export const DICTIONARY=JSON.parse(readFileSync(new URL('../public/data/jmdict-starter.json',import.meta.url),'utf8'));
const id=()=>randomBytes(12).toString('hex');
const contentWords=text=>new Set((text.toLowerCase().match(/[a-z]+/g)??[]).filter(w=>w.length>2&&!['the','and','for','with','from','that','this','into','one','being','have','having','something','someone','person','thing','used','esp','also','e.g'].includes(w)).map(w=>w.replace(/(?:ing|ed|s)$/,'')));
const shuffled=array=>{const a=[...array];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
export const meaningsFor=(word,reading=word.readings[0])=>[...new Set(word.senses.filter(s=>s.readings.includes(reading)).flatMap(s=>s.meanings))];
export class Learning{
 constructor(db,{now=Date.now,dictionary=DICTIONARY}={}){this.db=db;this.now=now;this.dictionary=dictionary;this.words=dictionary.entries;this.byId=new Map(this.words.map(w=>[w.id,w]));}
 progress(userId){return this.db.prepare('SELECT * FROM vocab_progress WHERE user_id=?').all(userId).filter(p=>this.byId.has(p.entry_id));}
 summary(user){
  const rows=this.progress(user.id),now=this.now();
  const events=this.db.prepare('SELECT entry_id,at,kind,result FROM review_events WHERE user_id=? ORDER BY id DESC LIMIT 100').all(user.id);
  return {goal:this.db.prepare('SELECT goal FROM users WHERE id=?').get(user.id).goal,total:this.words.length,studied:rows.length,mastered:rows.filter(r=>r.mastered).length,due:rows.filter(r=>!r.mastered&&r.due_at<=now).length,newRemaining:this.words.length-rows.length,active:this.load(user.id)?this.snapshot(this.load(user.id)):null,records:rows.sort((a,b)=>b.last_at-a.last_at).map(p=>({...p,kanji:this.byId.get(p.entry_id).kanji,readings:this.byId.get(p.entry_id).readings,meaning:meaningsFor(this.byId.get(p.entry_id)).slice(0,3).join('; ')})),events:events.map(e=>({...e,kanji:this.byId.get(e.entry_id)?.kanji??e.entry_id})),source:{name:this.dictionary.source,url:this.dictionary.documentation,licence:this.dictionary.licence,retrieved:this.dictionary.retrieved}};
 }
 load(userId){const row=this.db.prepare('SELECT state FROM learning_sessions WHERE user_id=?').get(userId);return row?JSON.parse(row.state):null;}
 save(s){this.db.prepare('INSERT INTO learning_sessions(user_id,id,state) VALUES(?,?,?) ON CONFLICT(user_id) DO UPDATE SET id=excluded.id,state=excluded.state').run(s.userId,s.id,JSON.stringify(s));}
 check(user,sessionId,itemId){const s=this.load(user.id);if(!s||s.id!==sessionId||s.current?.id!==itemId)throw new GameError('This question has changed. Resume your session.',409);return s;}
 snapshot(s){
  const current=s.current,word=current?this.byId.get(current.entryId):null;
  return {id:s.id,index:s.index,total:s.queue.length,newCount:s.newCount,reviewCount:s.reviewCount,stage:s.stage,results:s.results,current:word?{id:current.id,entryId:word.id,kanji:word.kanji,kind:s.queue[s.index].kind,answeredReading:current.reading??null,options:s.stage==='meaning'?current.options:[],wrongChoices:current.wrongChoices??[],hint:current.hint??null}:null,result:s.stage==='result'?s.result:null};
 }
 next(s){
  while(s.index<s.queue.length){
   const entry=s.queue[s.index],word=this.byId.get(entry.entryId),p=this.db.prepare('SELECT mastered FROM vocab_progress WHERE user_id=? AND entry_id=?').get(s.userId,entry.entryId);
   if(word&&!p?.mastered){s.current={id:id(),entryId:entry.entryId,hadError:false};s.stage='reading';this.save(s);return this.snapshot(s);}
   s.index++;
  }
  s.current=null;s.stage='done';this.save(s);return this.snapshot(s);
 }
 plan(user,goal){
  if(!Number.isInteger(goal)||goal<1||goal>100)throw new GameError('Choose a goal between 1 and 100 new words.');
  const rows=this.progress(user.id),known=new Set(rows.map(r=>r.entry_id)),now=this.now();
  const due=rows.filter(r=>!r.mastered&&r.due_at<=now).sort((a,b)=>(b.due_at===null?0:now-b.due_at)-(a.due_at===null?0:now-a.due_at));
  const reviews=due.slice(0,Math.min(60,Math.max(10,goal))).map(r=>({entryId:r.entry_id,kind:'review'}));
  // If nothing is due, a short optional warm-up carries prior learning into the next session.
  if(!reviews.length)reviews.push(...rows.filter(r=>!r.mastered).sort((a,b)=>a.last_at-b.last_at).slice(0,Math.min(5,Math.ceil(goal/5))).map(r=>({entryId:r.entry_id,kind:'warmup'})));
  const fresh=this.words.filter(w=>!known.has(w.id)).slice(0,goal).map(w=>({entryId:w.id,kind:'new'}));
  const queue=[];let n=0,r=0;
  while(n<fresh.length||r<reviews.length){if(r<reviews.length)queue.push(reviews[r++]);for(let i=0;i<2&&n<fresh.length;i++)queue.push(fresh[n++]);}
  if(!queue.length)throw new GameError('Your garden is up to date. Come back when a review is ready.');
  this.db.prepare('UPDATE users SET goal=? WHERE id=?').run(goal,user.id);
  const s={id:id(),userId:user.id,queue,index:0,newCount:fresh.length,reviewCount:reviews.length,results:[]};return this.next(s);
 }
 options(word,reading){
  const meanings=meaningsFor(word,reading),correct=meanings.slice(0,3).join('; '),own=new Set(word.senses.flatMap(s=>s.meanings).map(s=>s.toLowerCase()));
  const ownTerms=contentWords([...own].join(' '));
  const distractors=shuffled(this.words.filter(w=>w.id!==word.id&&w.kanji!==word.kanji&&!w.senses.some(s=>s.meanings.some(m=>own.has(m.toLowerCase())))));
  const labels=[correct];for(const w of distractors){const text=meaningsFor(w).slice(0,3).join('; ');if(!labels.includes(text)&&![...contentWords(text)].some(t=>ownTerms.has(t)))labels.push(text);if(labels.length===4)break;}
  if(labels.length!==4)throw new GameError('There are not enough distinct dictionary meanings for this quiz.');
  const choices=labels.map(label=>({id:id(),text:label}));return {options:shuffled(choices),correctId:choices[0].id};
 }
 act(user,action,data){
  return transaction(this.db,()=>{
   const s=this.check(user,data.sessionId,data.itemId),word=this.byId.get(s.current.entryId);
   if(action==='next'){
    if(s.stage!=='result')throw new GameError('Finish this question first.',409);s.index++;return {session:this.next(s)};
   }
   if(action==='hint'){
    if(!['reading','meaning'].includes(s.stage))throw new GameError('That question is already finished.',409);
    s.current.hadError=true;s.current.hint={readings:word.readings,romaji:word.readings.map(kanaRomaji),meanings:s.stage==='meaning'?meaningsFor(word,s.current.reading).slice(0,3):[]};this.save(s);return {session:this.snapshot(s)};
   }
   if(action==='pass')return this.finish(s,word,false,true);
   if(action==='reading'){
    if(s.stage!=='reading')throw new GameError('The reading has already been answered.',409);
    const answer=typeof data.answer==='string'?data.answer.trim():'';
    if(!answer||answer.length>200)throw new GameError('Type a reading in kana or romaji.');
    const reading=word.readings.find(r=>hiragana(answer)===hiragana(r)||acceptsRomaji(r,answer));
    if(!reading){s.current.hadError=true;this.save(s);return {correct:false,feedback:'Not quite. Try another reading, or turn the card for a hint.',session:this.snapshot(s)};}
    s.current.reading=reading;Object.assign(s.current,this.options(word,reading));s.current.hint=null;s.stage='meaning';this.save(s);return {correct:true,session:this.snapshot(s)};
   }
   if(action==='meaning'){
    if(s.stage!=='meaning')throw new GameError('Answer the reading first.',409);
    if(!s.current.options.some(c=>c.id===data.choiceId))throw new GameError('Choose one of the meanings shown.');
    if(data.choiceId!==s.current.correctId){s.current.hadError=true;s.current.wrongChoices=[...new Set([...(s.current.wrongChoices??[]),data.choiceId])];this.save(s);return {correct:false,feedback:'That meaning does not fit this reading. Try again.',session:this.snapshot(s)};}
    return this.finish(s,word,!s.current.hadError,false);
   }
   throw new GameError('Unknown learning step.',404);
  });
 }
 finish(s,word,correct,passed){
  if(!['reading','meaning'].includes(s.stage))throw new GameError('That word has already been recorded.',409);
  const old=this.db.prepare('SELECT * FROM vocab_progress WHERE user_id=? AND entry_id=?').get(s.userId,word.id);
  const p=scheduleReview(old,{correct,passed,now:this.now()});
  this.db.prepare(`INSERT INTO vocab_progress(user_id,entry_id,attempts,successes,lapses,level,last_at,last_success_at,due_at,mastered,passed) VALUES(?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(user_id,entry_id) DO UPDATE SET attempts=excluded.attempts,successes=excluded.successes,lapses=excluded.lapses,level=excluded.level,last_at=excluded.last_at,last_success_at=excluded.last_success_at,due_at=excluded.due_at,mastered=excluded.mastered,passed=excluded.passed`).run(s.userId,word.id,p.attempts,p.successes,p.lapses,p.level,p.last_at,p.last_success_at??null,p.due_at,p.mastered,p.passed);
  const kind=s.queue[s.index].kind;this.db.prepare('INSERT INTO review_events(user_id,entry_id,at,kind,result) VALUES(?,?,?,?,?)').run(s.userId,word.id,this.now(),kind,passed?2:correct?1:0);
  s.result={entryId:word.id,kanji:word.kanji,readings:word.readings,reading:s.current.reading??word.readings[0],meanings:meaningsFor(word,s.current.reading).slice(0,8),sourceIds:word.sourceIds,correct,passed,mastered:!!p.mastered,level:p.level,dueAt:p.due_at,kind};
  s.results.push({entryId:word.id,kanji:word.kanji,correct,passed,mastered:!!p.mastered,kind});s.stage='result';this.save(s);return {correct:true,session:this.snapshot(s)};
 }
 canDiscuss(user,entryId){const active=this.load(user.id);return !!this.db.prepare('SELECT 1 FROM vocab_progress WHERE user_id=? AND entry_id=?').get(user.id,entryId)||active?.current?.entryId===entryId;}
}
