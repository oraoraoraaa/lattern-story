import {VOCABULARY} from './vocabulary.mjs';
import {normalizeInput} from './romaji.mjs';
export function gardenRound(category='nature',challenge=false,random=Math.random){
  const pool=VOCABULARY.filter(w=>w.category===category);
  for(let i=pool.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[pool[i],pool[j]]=[pool[j],pool[i]];}
  return {words:pool.slice(0,12),index:0,input:'',correct:0,wrong:0,streak:0,best:0,score:0,challenge,remaining:90000,elapsed:0,done:false,paused:false,review:[]};
}
export function gardenType(s,text){
  if(s.done||s.paused) return;
  for(const ch of normalizeInput(text)){
    if(!/^[a-z]$/.test(ch)) continue;
    const word=s.words[s.index], candidate=s.input+ch, variants=[word.romaji,...word.variants];
    if(variants.some(v=>v.startsWith(candidate))){s.input=candidate;s.correct++;}
    else{s.wrong++;s.streak=0;}
    if(variants.includes(s.input)&&!variants.some(v=>v.length>s.input.length&&v.startsWith(s.input)))gardenCommit(s);
  }
}
export function gardenCommit(s){
  if(s.done||s.paused)return false;
  const word=s.words[s.index];if(![word.romaji,...word.variants].includes(s.input))return false;
  s.streak++;s.best=Math.max(s.best,s.streak);s.score+=100+Math.min(s.streak,10)*10;
  s.review.push({...word,typed:s.input});s.index++;s.input='';
  if(s.index===s.words.length)s.done=true;
  return true;
}
export function gardenTick(s,ms){
  if(s.done||s.paused) return;
  s.elapsed+=ms;
  if(s.challenge){s.remaining=Math.max(0,s.remaining-ms);if(!s.remaining)s.done=true;}
}
export const gardenStats=s=>({accuracy:s.correct+s.wrong?Math.round(100*s.correct/(s.correct+s.wrong)):100,kpm:s.elapsed?Math.round(s.correct*60000/s.elapsed):0});
