import {phaseFor} from '../public/lib/content.mjs';
export function compactMemory(value){
  const chars=[...String(value??'').replace(/\s+/g,' ').trim()];
  return chars.length<=360?chars.join(''):[...chars.slice(0,96),'…',...chars.slice(-260)].join('');
}
function terms(text){
  return new Set((text.match(/[\p{Script=Han}\p{Script=Katakana}]{2,}/gu)??[]).flatMap(w=>Array.from({length:w.length-1},(_,i)=>w.slice(i,i+2))));
}
export function contextFor(s,history=s.history){
  const recent=history.slice(-6), old=history.slice(1,-6), latest=terms(history.findLast(m=>m.role==='user')?.content??'');
  const recalled=old.map((m,i)=>({m,i,score:[...terms(m.content)].filter(t=>latest.has(t)).length})).filter(x=>x.score).sort((a,b)=>b.score-a.score||b.i-a.i).slice(0,2).sort((a,b)=>a.i-b.i).map(x=>x.m);
  const opening=history.length>6?[history[0]]:[];
  return {phase:phaseFor(s.turn),memory:compactMemory(s.memory),messages:[...opening,...recalled,...recent]};
}
