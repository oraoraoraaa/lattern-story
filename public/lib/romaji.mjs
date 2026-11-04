import {KANA} from './kana.mjs';
import {spellings} from './romaji-options.mjs';
const PARTICLES=new Set(['に','は','へ','を','が','と','で','も','の','か','よ','ね','から','まで','だけ']);
const AUX=['ませんでした','でしょう','ました','ません','でした','ます','です','たい','ない'];
export const isPunctuation=s=>/^[\s\p{P}\p{S}]*$/u.test(s);
export const hiragana=s=>s.normalize('NFKC').replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0x60));
export function normalizeInput(s){
  return s.normalize('NFKC').toLowerCase().replace(/[’ʼ]/g,"'").replace(/[\s\p{P}\p{S}]/gu,c=>c==="'"||c==='-'?c:'');
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
  if(end>1600||chunks.reduce((n,c)=>n+c.reading.length,0)>800)throw new Error('The pronunciation is too long for one line.');
  return {japanese:data.japanese,translation:data.translation.trim(),chunks,romaji:chunks.map(c=>c.romaji).join('')};
}
export const completedChunk=(chunk,count)=>chunk.romaji?count>=chunk.end:count>=chunk.start;

function readingUnits(chunks){
  const units=[];let canonical='';
  chunks.forEach((chunk,owner)=>{
    if(chunk.kind==='punctuation'){units.push({owner,options:[''],barrier:true});return;}
    const s=hiragana(chunk.reading);
    for(let i=0;i<s.length;i++){
      let kana=KANA[s.slice(i,i+2)]?s.slice(i,i+2):s[i];if(kana.length===2)i++;
      if(isPunctuation(kana)&&kana!=='ー')continue;
      if(kana==='っ'){units.push({owner,sokuon:true});continue;}
      let options;
      if(kana==='ー'){
        const vowel=canonical.match(/[aeiou](?=[^aeiou]*$)/)?.[0];
        if(!vowel)throw new Error('Long vowel has no preceding vowel.');options=[vowel,'-'];
      }else options=spellings(kana);
      if(!options.length)throw new Error('Unsupported kana.');
      if(chunk.kind==='particle'&&s.length===1){
        if(chunk.japanese==='は')options=['wa','ha'];
        if(chunk.japanese==='へ')options=['e','he'];
        if(chunk.japanese==='を')options=['o','wo'];
      }
      if(i===s.length-1&&['こんにちは','こんばんは'].includes(chunk.japanese))options=['wa','ha'];
      units.push({owner,options});canonical+=options[0];
    }
  });
  for(let i=0;i<units.length;i++)if(units[i].sokuon){
    const next=units[i+1],explicit=['xtsu','ltsu','xtu','ltu'];
    if(!next||next.barrier)units[i].options=['',...explicit];
    else{
      const consonants=[...new Set((next.options??[]).map(s=>s[0]).filter(c=>/[bcdfghjklmpqrstvwxyz]/.test(c)))];
      if((next.options??[]).some(s=>s.startsWith('ch')))consonants.push('t');
      if(!consonants.length)throw new Error('Small っ needs a following consonant.');
      units[i].options=[...new Set(consonants),...explicit];
    }
  }
  return units;
}
// Memoized graph matching avoids enumerating the exponential combinations of aliases.
// Each selected edge retains its Japanese owner, so variable-length spellings highlight correctly.
export function romajiStatus(value,raw){
  const chunks=typeof value==='string'?[{japanese:value,reading:value,kind:'word'}]:value.chunks;
  const input=normalizeInput(String(raw??''));
  if(!/^[a-z'-]*$/.test(input)||input.length>1800)return {valid:false,complete:false,chunks:[]};
  const units=readingUnits(chunks),memo=new Map();
  const allowed=(text,constraint)=>!constraint||text.startsWith(constraint)||(constraint==='t'&&text.startsWith('ch'));
  const tail=(i,constraint)=>{
    const list=[];
    for(;i<units.length;i++){
      const u=units[i],text=u.options.find(s=>allowed(s,constraint))??u.options[0];
      list.push({owner:u.owner,text,used:0,done:false});constraint=u.sokuon&&text.length===1?text:null;
    }return list;
  };
  function walk(i,offset,constraint){
    if(i===units.length)return offset===input.length?{complete:true,rank:i,plan:[]}:null;
    const key=i+':'+offset+':'+(constraint??'');if(memo.has(key))return memo.get(key);
    const u=units[i],remaining=input.slice(offset);let best=null;
    for(const text of u.options){
      if(!allowed(text,constraint))continue;
      const next=u.sokuon&&text.length===1?text:null;let result;
      if(remaining.length<text.length&&text.startsWith(remaining))result={complete:false,rank:i,plan:[{owner:u.owner,text,used:remaining.length,done:false},...tail(i+1,next)]};
      else if(remaining.startsWith(text)){
        const child=walk(i+1,offset+text.length,next);
        if(child)result={...child,plan:[{owner:u.owner,text,used:text.length,done:true},...child.plan]};
      }
      if(result&&(!best||Number(result.complete)>Number(best.complete)||result.complete===best.complete&&result.rank>best.rank))best=result;
    }
    memo.set(key,best);return best;
  }
  const match=walk(0,0,null);
  if(!match)return {valid:false,complete:false,chunks:[]};
  const progress=chunks.map((_,owner)=>{
    const frames=match.plan.filter(p=>p.owner===owner);
    return {typed:frames.map(p=>p.text.slice(0,p.used)).join(''),remaining:frames.map(p=>p.text.slice(p.used)).join(''),done:frames.length?frames.every(p=>p.done):match.complete};
  });
  return {valid:true,complete:match.complete,chunks:progress,guide:match.plan.map(p=>p.text).join('')};
}
export const acceptsRomaji=(value,input)=>romajiStatus(value,input).complete;
