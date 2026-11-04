import test from 'node:test';import assert from 'node:assert/strict';
import {gardenRound,gardenType,gardenTick,gardenStats,gardenCommit} from '../public/lib/garden.mjs';import {VOCABULARY} from '../public/lib/vocabulary.mjs';
test('48 words form distinct twelve-word rounds; aliases, scoring and review work',()=>{
 assert.equal(VOCABULARY.length,48);for(const cat of ['nature','everyday','greetings']){const s=gardenRound(cat,false,()=>.5);assert.equal(s.words.length,12);assert.equal(new Set(s.words.map(w=>w.kana)).size,12);for(const w of s.words)gardenType(s,w.variants[0]??w.romaji);assert.equal(s.done,true);assert.equal(s.index,12);assert.equal(s.review.length,12);assert.equal(s.best,12);assert.equal(gardenStats(s).accuracy,100);}
});
test('wrong letters count, undo is local, pause stops clock, practice never times out',()=>{
 const s=gardenRound('nature');gardenType(s,'x');assert.equal(s.wrong,1);assert.equal(s.input,'');s.paused=true;gardenTick(s,30000);assert.equal(s.elapsed,0);gardenType(s,s.words[0].romaji);assert.equal(s.index,0);s.paused=false;gardenTick(s,120000);assert.equal(s.done,false);gardenType(s,s.words[0].romaji);assert.ok(gardenStats(s).accuracy<100);assert.ok(s.score>0);
 const t=gardenRound('nature',true);gardenTick(t,90001);assert.equal(t.done,true);assert.equal(t.remaining,0);
});

test('an ambiguous spelling can finish with Enter or the longer alias',()=>{
 const s=gardenRound('everyday');s.words=[VOCABULARY.find(w=>w.romaji==='hon')];gardenType(s,'hon');assert.equal(s.index,0);assert.equal(gardenCommit(s),true);assert.equal(s.done,true);
 const t=gardenRound('everyday');t.words=[VOCABULARY.find(w=>w.romaji==='hon')];gardenType(t,'honn');assert.equal(t.index,1);assert.equal(t.wrong,0);
});
