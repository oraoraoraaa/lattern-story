import test from 'node:test';import assert from 'node:assert/strict';import {mkdtempSync,rmSync,statSync} from 'node:fs';import {tmpdir} from 'node:os';import path from 'node:path';
import {openDatabase} from '../lib/database.mjs';import {Accounts} from '../lib/accounts.mjs';import {Learning,DICTIONARY,meaningsFor} from '../lib/learning.mjs';import {scheduleReview,DAY,MASTERY_LEVEL} from '../lib/review.mjs';
async function setup(t,options={}){const db=openDatabase(':memory:');t.after(()=>db.close());const accounts=new Accounts(db,options);const {user,token}=await accounts.register('learner','password123');return {db,accounts,user,token,learning:new Learning(db,options)};}
function complete(learning,user,s,{hint=false}={}){
 const word=learning.byId.get(s.current.entryId);if(hint)learning.act(user,'hint',{sessionId:s.id,itemId:s.current.id});
 s=learning.act(user,'reading',{sessionId:s.id,itemId:s.current.id,answer:word.readings[0]}).session;
 const correct=learning.load(user.id).current.correctId;
 return learning.act(user,'meaning',{sessionId:s.id,itemId:s.current.id,choiceId:correct}).session;
}
test('accounts use salted scrypt hashes and hashed, expiring, revocable session tokens',async t=>{
 let now=1000;const {db,accounts,user,token}=await setup(t,{now:()=>now});const other=await accounts.register('another','password123');
 const rows=db.prepare('SELECT password_hash FROM users').all();assert.notEqual(rows[0].password_hash,rows[1].password_hash);assert.ok(rows.every(r=>r.password_hash.startsWith('scrypt$')&&!r.password_hash.includes('password123')));
 assert.equal(accounts.authenticate(token).id,user.id);assert.notEqual(db.prepare('SELECT token_hash FROM auth_sessions WHERE user_id=?').get(user.id).token_hash,token);
 const login=await accounts.login('LEARNER','password123');assert.equal(login.user.id,user.id);await assert.rejects(()=>accounts.login('learner','incorrect'),/incorrect/);await assert.rejects(()=>accounts.register('learner','password123'),/already taken/);accounts.logout(login.token);assert.equal(accounts.authenticate(login.token),null);now+=604800001;assert.equal(accounts.authenticate(token),null);
});
test('accounts and study state survive database close/reopen, with private storage',async()=>{
 const dir=mkdtempSync(path.join(tmpdir(),'lantern-db-')),filename=path.join(dir,'data','test.sqlite');let db;
 try{db=openDatabase(filename);const accounts=new Accounts(db);const {user,token}=await accounts.register('persistent','password123');const learning=new Learning(db);const s=learning.plan(user,30);complete(learning,user,s);db.close();db=openDatabase(filename);assert.equal(new Accounts(db).authenticate(token).id,user.id);const resumed=new Learning(db);assert.equal(resumed.load(user.id).stage,'result');assert.equal(resumed.summary(user).studied,1);if(process.platform!=='win32'){assert.equal(statSync(filename).mode&0o777,0o600);assert.equal(statSync(path.dirname(filename)).mode&0o777,0o700);}}finally{db?.close();rmSync(dir,{recursive:true,force:true});}
});
test('thirty new words are queued, a later goal mixes reviews, and manual passes never return',async t=>{
 let now=Date.UTC(2026,10,4);const {learning,user}=await setup(t,{now:()=>now});let s=learning.plan(user,30);assert.equal(s.newCount,30);assert.equal(s.total,30);const passed=s.current.entryId;
 s=learning.act(user,'pass',{sessionId:s.id,itemId:s.current.id}).session;assert.equal(s.result.mastered,true);assert.equal(s.result.passed,true);s=learning.act(user,'next',{sessionId:s.id,itemId:s.current.id}).session;const studied=s.current.entryId;s=complete(learning,user,s);assert.equal(s.stage,'result');
 let next=learning.plan(user,30);assert.equal(next.newCount,30);assert.ok(next.reviewCount>0);assert.ok(learning.load(user.id).queue.some(q=>q.entryId===studied&&q.kind==='warmup'));assert.ok(!learning.load(user.id).queue.some(q=>q.entryId===passed));
 now+=DAY;next=learning.plan(user,30);assert.equal(next.current.kind,'review');assert.equal(next.current.entryId,studied);assert.equal(learning.summary(user).mastered,1);
});
test('reading and meaning are separate gates, hints/mistakes trigger review, and repeated submissions cannot duplicate records',async t=>{
 const {learning,user,db}=await setup(t);let s=learning.plan(user,3);await assert.throws(()=>learning.act(user,'meaning',{sessionId:s.id,itemId:s.current.id,choiceId:'forged'}),/reading/);
 const wrong=learning.act(user,'reading',{sessionId:s.id,itemId:s.current.id,answer:'wrong'});assert.equal(wrong.correct,false);assert.equal(wrong.session.stage,'reading');s=complete(learning,user,s);assert.equal(s.result.correct,false);const row=db.prepare('SELECT * FROM vocab_progress').get();assert.equal(row.lapses,1);assert.ok(row.due_at-row.last_at===600000);assert.throws(()=>learning.act(user,'meaning',{sessionId:s.id,itemId:s.current.id,choiceId:'again'}));assert.equal(db.prepare('SELECT count(*) AS n FROM review_events').get().n,1);
});
test('meaning choices follow the given reading and exclude overlapping dictionary definitions',async t=>{
 const {learning,user}=await setup(t);const word=DICTIONARY.entries.find(w=>w.kanji==='金');const kane=learning.options(word,'かね'),kin=learning.options(word,'きん');
 assert.equal(kane.options.length,4);assert.equal(new Set(kane.options.map(o=>o.text)).size,4);assert.equal(kane.options.find(o=>o.id===kane.correctId).text,meaningsFor(word,'かね').slice(0,3).join('; '));assert.equal(kin.options.find(o=>o.id===kin.correctId).text,meaningsFor(word,'きん').slice(0,3).join('; '));
});
test('memory schedule resets on misses; early warm-ups cannot farm mastery or postpone reviews',()=>{
 let now=Date.UTC(2026,10,4),p=scheduleReview(null,{correct:true,now});assert.equal(p.level,1);assert.equal(p.due_at,now+DAY);const due=p.due_at,success=p.last_success_at;
 for(let i=0;i<10;i++)p=scheduleReview(p,{correct:true,now:now+1000*(i+1)});assert.equal(p.level,1);assert.equal(p.due_at,due);assert.equal(p.last_success_at,success);
 for(let i=1;i<MASTERY_LEVEL;i++){now=p.due_at;p=scheduleReview(p,{correct:true,now});}assert.equal(p.mastered,1);assert.equal(p.due_at,null);
 const failed=scheduleReview({...p,mastered:0},{correct:false,now:now+DAY});assert.equal(failed.level,0);assert.equal(failed.due_at,now+DAY+600000);const early=scheduleReview(failed,{correct:true,now:now+DAY+1000});assert.equal(early.level,0);assert.equal(early.due_at,failed.due_at);assert.equal(scheduleReview(null,{correct:false,passed:true,now}).mastered,1);
});
test('users cannot resume, grade or discuss another account’s private study state',async t=>{
 const {learning,user,accounts}=await setup(t);const {user:other}=await accounts.register('second','password123');const s=learning.plan(user,2);assert.throws(()=>learning.act(other,'pass',{sessionId:s.id,itemId:s.current.id}),/changed/);assert.equal(learning.summary(other).studied,0);assert.equal(learning.canDiscuss(other,s.current.entryId),false);
});
