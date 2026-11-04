import test from 'node:test';
import assert from 'node:assert/strict';
import {kanaRomaji,makeLine,normalizeInput,completedChunk} from '../public/lib/romaji.mjs';
const line=(japanese,reading)=>makeLine({japanese,translation:'test',chunks:[{japanese,reading}]});
test('local Hepburn converter covers kana, digraphs, long vowels and consonants',()=>{
 for(const [kana,expected] of [['いっしょ','issho'],['コーヒー','koohii'],['がっこう','gakkou'],['しゃしん','shashin'],['ティー','tii'],['ヴァイオリン','vaiorin'],['きって','kitte']])assert.equal(kanaRomaji(kana),expected);
 assert.throws(()=>kanaRomaji('読む'));assert.throws(()=>kanaRomaji('っあ'));assert.throws(()=>kanaRomaji('っっ'));assert.throws(()=>kanaRomaji('ー'));
});
test('uniform grammatical chunks keep ません whole and derive kana locally',()=>{
 const l=makeLine({japanese:'一緒に読みませんか。',translation:'Shall we read together?',chunks:[{japanese:'一緒に',reading:'いっしょに'},{japanese:'読みませんか',reading:'よみませんか'},{japanese:'。',reading:''}]});
 assert.equal(l.romaji,'isshoniyomimasenka');assert.deepEqual(l.chunks.map(c=>c.japanese),['一緒','に','読み','ません','か','。']);
 assert.equal(line('に','と').romaji,'ni');assert.equal(line('は','は').romaji,'wa');assert.equal(line('へ','へ').romaji,'e');assert.equal(line('こんにちは','まちがい').romaji,'konnichiwa');
 assert.equal(completedChunk(l.chunks[0],4),false);assert.equal(completedChunk(l.chunks[0],5),true);assert.equal(completedChunk(l.chunks[1],6),false);assert.equal(completedChunk(l.chunks[1],7),true);
});
test('small tsu bridges chunks but cannot jump punctuation',()=>{
 const build=chunks=>makeLine({japanese:chunks.map(c=>c.japanese).join(''),translation:'test',chunks});
 assert.equal(build([{japanese:'待っ',reading:'まっ'},{japanese:'て',reading:'て'}]).romaji,'matte');
 assert.equal(build([{japanese:'えっ',reading:'えっ'},{japanese:'、',reading:''},{japanese:'と',reading:'と'}]).romaji,'eto');
});
test('mismatched text, bogus readings and oversized responses are rejected',()=>{
 assert.throws(()=>makeLine({japanese:'読む',translation:'read',chunks:[{japanese:'読',reading:'よむ'}]}));
 assert.throws(()=>line('読む','read'));assert.throws(()=>line('読む',''));assert.throws(()=>line('。','あ'));
 assert.throws(()=>line('本'.repeat(221),'ほん'));assert.equal(normalizeInput(' ISSHO ni, YOMIMASEN ka？'),'isshoniyomimasenka');
});
test('kana lexical units stay whole and punctuation detaches from mixed chunks',()=>{
 assert.deepEqual(line('この','この').chunks.map(c=>c.japanese),['この']);assert.deepEqual(line('もっと','もっと').chunks.map(c=>c.japanese),['もっと']);
 const l=line('「読みませんか？」','よみませんか');assert.equal(l.romaji,'yomimasenka');assert.deepEqual(l.chunks.map(c=>c.japanese),['「','読み','ません','か','？」']);
});
