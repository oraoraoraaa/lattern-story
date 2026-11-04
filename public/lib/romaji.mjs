import {KANA} from './kana.mjs';
const PARTICLES=new Set(['に','は','へ','を','が','と','で','も','の','か','よ','ね','から','まで','だけ']);
const AUX=['ませんでした','でしょう','ました','ません','でした','ます','です','たい','ない'];
export const isPunctuation=s=>/^[\s\p{P}\p{S}]*$/u.test(s);
export const hiragana=s=>s.normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
export function normalizeInput(s){
  return s.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]/gu,'');
}
export function kanaRomaji(reading){
  const s=hiragana(reading); let result='';
  for(let i=0;i<s.length;i++){
    const ch=s[i];
    if(isPunctuation(ch)&&ch!=='ー') continue;
    if(ch==='っ'){
      if(i===s.length-1) continue;
      const next=KANA[s.slice(i+1,i+3)]??KANA[s[i+1]];
      if(!next||!/^[bcdfghjkmprstvwz]/.test(next)) throw new Error('Small っ needs a following consonant.');
      result+=next[0]; continue;
    }
    if(ch==='ー'){
      const vowel=result.match(/[aeiou](?=[^aeiou]*$)/)?.[0];
      if(!vowel) throw new Error('Long vowel has no preceding vowel.');
      result+=vowel; continue;
    }
    const pair=KANA[s.slice(i,i+2)];
    if(pair){result+=pair;i++;continue;}
    if(!KANA[ch]) throw new Error('The reading must contain kana, not kanji or Latin text.');
    result+=KANA[ch];
  }
  return result;
}
function chunk(japanese,reading){
  const kind=isPunctuation(japanese)?'punctuation':PARTICLES.has(japanese)?'particle':AUX.includes(japanese)?'auxiliary':'word';
  if(kind==='punctuation') return {japanese,reading:'',kind,romaji:''};
  // Never trust a model's reading for a surface written entirely in kana.
  if(/^[ぁ-ゖァ-ヶー]+$/u.test(japanese)) reading=japanese;
  if(japanese==='こんにちは') reading='こんにちわ';
  if(japanese==='こんばんは') reading='こんばんわ';
  if(kind==='particle') reading=({'は':'わ','へ':'え','を':'お'})[japanese]??japanese;
  if(typeof reading!=='string'||reading.length>200) throw new Error('Missing kana reading.');
  const romaji=kanaRomaji(reading);
  if(!romaji) throw new Error('Empty pronunciation.');
  return {japanese,reading,kind,romaji};
}
function splitChunk(japanese,reading){
  if(!japanese) return [];
  // Punctuation boundaries are local and deterministic. Divide matching kana suffixes
  // into a stem + grammatical ending, even when a provider combines them.
  if(isPunctuation(japanese)) return [chunk(japanese,'')];
  const leading=japanese.match(/^[\s\p{P}\p{S}]+/u)?.[0]?.replace(/ー.*$/,'')??'';
  if(leading)return [chunk(leading,''),...splitChunk(japanese.slice(leading.length),String(reading).replace(/^[\s\p{P}\p{S}]+/u,''))];
  const trailing=japanese.match(/[\s\p{P}\p{S}]+$/u)?.[0]??'';
  if(trailing&&!trailing.includes('ー'))return [...splitChunk(japanese.slice(0,-trailing.length),String(reading).replace(/[\s\p{P}\p{S}]+$/u,'')),chunk(trailing,'')];
  // Kana-only words such as この / もっと are lexical units, not particle suffixes.
  // Their lexical boundaries come from the provider; pronouncing their kana is local.
  if(/^[ぁ-ゖァ-ヶー]+$/u.test(japanese))return [chunk(japanese,reading)];
  for(const suffix of [...AUX,...PARTICLES].sort((a,b)=>b.length-a.length)){
    if(japanese.length>suffix.length&&japanese.endsWith(suffix)&&hiragana(reading).endsWith(suffix)){
      return [...splitChunk(japanese.slice(0,-suffix.length),hiragana(reading).slice(0,-suffix.length)),chunk(suffix,suffix)];
    }
  }
  return [chunk(japanese,reading)];
}
export function makeLine(data,{maxLength=220}={}){
  if(!data||typeof data.japanese!=='string'||!data.japanese.trim()||[...data.japanese].length>maxLength||typeof data.translation!=='string'||!data.translation.trim()||data.translation.length>1000) throw new Error('Invalid dialogue text.');
  if(!Array.isArray(data.chunks)||!data.chunks.length||data.chunks.length>120) throw new Error('Missing learning chunks.');
  if(data.chunks.some(c=>!c||typeof c.japanese!=='string'||!c.japanese)||data.chunks.map(c=>c.japanese).join('')!==data.japanese) throw new Error('Japanese and learning chunks do not match.');
  let chunks=data.chunks.flatMap(c=>splitChunk(c.japanese,c.reading??''));
  for(let i=0;i<chunks.length-1;i++){
    // A consonant before a boundary belongs to the preceding small っ.
    if(hiragana(chunks[i].reading).endsWith('っ')&&chunks[i+1].romaji&&/^[bcdfghjkmprstvwz]/.test(chunks[i+1].romaji)) chunks[i].romaji+=chunks[i+1].romaji[0];
  }
  let end=0;
  chunks=chunks.map(c=>({...c,start:end,end:(end+=c.romaji.length)}));
  if(!end) throw new Error('No pronounceable Japanese.');
  return {japanese:data.japanese,translation:data.translation.trim(),chunks,romaji:chunks.map(c=>c.romaji).join('')};
}
export const completedChunk=(chunk,count)=>chunk.romaji?count>=chunk.end:count>=chunk.start;
