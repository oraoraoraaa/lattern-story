import test from 'node:test';import assert from 'node:assert/strict';
import {romajiStatus,acceptsRomaji,makeLine,kanaRomaji} from '../public/lib/romaji.mjs';
import {KANA} from '../public/lib/kana.mjs';import {spellings} from '../public/lib/romaji-options.mjs';
import {DICTIONARY} from '../lib/learning.mjs';
test('every listed spelling accepts all prefixes and completes its exact kana',()=>{
 for(const kana of Object.keys(KANA))for(const spelling of spellings(kana)){
  assert.equal(acceptsRomaji(kana,spelling),true,`${kana}: ${spelling}`);
  for(let i=0;i<=spelling.length;i++)assert.equal(romajiStatus(kana,spelling.slice(0,i)).valid,true,`${kana}: ${spelling.slice(0,i)}`);
 }
});
test('mixed romanization, explicit small kana, particles, nasal and long vowels',()=>{
 for(const [reading,input] of [['かしこく','cacicoqu'],['ほん','hoxn'],['しょ','syo'],['しょ','silyo'],['じゃじゅじょ','zyajyujyo'],['ぢゃぢゅぢょ','dyadyudyo'],['いっしょ','issyo'],['まっちゃ','matcha'],['まっちゃ','maccha'],['まっちゃ','mattya'],['がっこう','gaxtsukou'],['ほん','honn'],['ほんや',"hon'ya"],['コーヒー','ko-hi-'],['ティッシュ','thissyu'],['ふぁ','hula']])assert.equal(acceptsRomaji(reading,input),true,`${reading}: ${input}`);
 assert.equal(acceptsRomaji('まっちゃ','mactya'),false);assert.equal(acceptsRomaji('しょ','shiyo'),false);assert.equal(acceptsRomaji('ほん','honna'),false);
 const l=makeLine({japanese:'こんにちは。私は本を読みませんか。',translation:'test',chunks:[{japanese:'こんにちは',reading:'こんにちは'},{japanese:'。',reading:''},{japanese:'私',reading:'わたし'},{japanese:'は',reading:'は'},{japanese:'本',reading:'ほん'},{japanese:'を',reading:'を'},{japanese:'読み',reading:'よみ'},{japanese:'ません',reading:'ません'},{japanese:'か',reading:'か'},{japanese:'。',reading:''}]});
 assert.equal(acceptsRomaji(l,'konnitihawatasihahonnwoyomimasenka'),true);
});
test('variable-length spellings keep Japanese progress aligned, including backspace and small tsu across chunks',()=>{
 const l=makeLine({japanese:'私と一緒に。',translation:'test',chunks:[{japanese:'私',reading:'わたし'},{japanese:'と',reading:'と'},{japanese:'一緒',reading:'いっしょ'},{japanese:'に',reading:'に'},{japanese:'。',reading:''}]});
 let p=romajiStatus(l,'watasi');assert.equal(p.chunks[0].done,true);assert.equal(p.chunks[1].done,false);assert.equal(p.chunks[1].remaining,'to');
 p=romajiStatus(l,'watasitoissyo');assert.equal(p.chunks[2].done,true);assert.equal(p.chunks[3].done,false);
 p=romajiStatus(l,'watasitoissy');assert.equal(p.chunks[2].done,false);
 const wait=makeLine({japanese:'待って。',translation:'wait',chunks:[{japanese:'待っ',reading:'まっ'},{japanese:'て',reading:'て'},{japanese:'。',reading:''}]});
 assert.equal(romajiStatus(wait,'mat').chunks[0].done,true);assert.equal(romajiStatus(wait,'mat').chunks[1].done,false);assert.equal(acceptsRomaji(wait,'maxtsute'),true);
});
test('all bundled dictionary readings have a valid locally generated canonical spelling',()=>{
 for(const word of DICTIONARY.entries)for(const reading of word.readings)assert.equal(acceptsRomaji(reading,kanaRomaji(reading)),true,`${word.kanji}: ${reading}`);
});
