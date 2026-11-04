import {KANA} from './kana.mjs';
import {IME_SPELLINGS} from './ime-table.mjs';
// Hepburn, Kunrei/Nihon-shiki and common IME key sequences. Canonical first.
Object.assign(KANA, {'ゐ':'wi','ゑ':'we','ゕ':'ka','ゖ':'ke','いぇ':'ye','うぁ':'wha','うゅ':'wyu','くぁ':'kwa','くぃ':'kwi','くぇ':'kwe','くぉ':'kwo','ぐぁ':'gwa','ぐぃ':'gwi','ぐぇ':'gwe','ぐぉ':'gwo','つぁ':'tsa','つぃ':'tsi','つぇ':'tse','つぉ':'tso','すぃ':'si','ずぃ':'zi','ふゅ':'fyu','ゔゅ':'vyu','ぢぇ':'je'});
export const ROMAJI_ALIASES={
 'し':['shi','si'],'ち':['chi','ti'],'つ':['tsu','tu'],'ふ':['fu','hu'],'じ':['ji','zi'],'ぢ':['ji','di','zi'],'づ':['zu','du'],'を':['o','wo'],'ゐ':['wi','wyi'],'ゑ':['we','wye'],
 'しゃ':['sha','sya'],'しゅ':['shu','syu'],'しょ':['sho','syo'],'しぇ':['she','sye'],
 'じゃ':['ja','jya','zya'],'じゅ':['ju','jyu','zyu'],'じょ':['jo','jyo','zyo'],'じぇ':['je','jye','zye'],
 'ちゃ':['cha','tya','cya'],'ちゅ':['chu','tyu','cyu'],'ちょ':['cho','tyo','cyo'],'ちぇ':['che','tye','cye'],
 'ぢゃ':['ja','dya','jya','zya'],'ぢゅ':['ju','dyu','jyu','zyu'],'ぢょ':['jo','dyo','jyo','zyo'],'ぢぇ':['je','dye','jye','zye'],
 'ティ':['ti','thi'],'ディ':['di','dhi'],'トゥ':['tu','twu'],'ドゥ':['du','dwu'],
 'ふぁ':['fa','fwa'],'ふぃ':['fi','fwi'],'ふぇ':['fe','fwe'],'ふぉ':['fo','fwo'],
 'うぃ':['wi','whi'],'うぇ':['we','whe'],'うぉ':['wo','who'],
 'くぁ':['kwa','qa','qwa'],'くぃ':['kwi','qi','qwi'],'くぇ':['kwe','qe','qwe'],'くぉ':['kwo','qo','qwo'],
 'すぃ':['si','swi'],'ずぃ':['zi','zwi'],
 'ぁ':['a','xa','la'],'ぃ':['i','xi','li','xyi','lyi'],'ぅ':['u','xu','lu'],'ぇ':['e','xe','le','xye','lye'],'ぉ':['o','xo','lo'],
 'ゃ':['ya','xya','lya'],'ゅ':['yu','xyu','lyu'],'ょ':['yo','xyo','lyo'],'ゎ':['wa','xwa','lwa'],'ゕ':['ka','xka','lka'],'ゖ':['ke','xke','lke'],
 'ん':['n','nn',"n'"]
};
for(const [key,values] of Object.entries(ROMAJI_ALIASES))if(/[ァ-ヶ]/.test(key)){const hira=key.replace(/[ァ-ヶ]/g,c=>String.fromCharCode(c.charCodeAt(0)-96));ROMAJI_ALIASES[hira]=values;delete ROMAJI_ALIASES[key];}
for(const [kana,values] of Object.entries(IME_SPELLINGS)){
 if(kana==='っ'||kana.length>2)continue; // small tsu uses the contextual rule in romajiStatus.
 if(!KANA[kana])KANA[kana]=values[0];
 ROMAJI_ALIASES[kana]=[...new Set([KANA[kana],...(ROMAJI_ALIASES[kana]??[]),...values])];
}
export function spellings(kana){
 const result=[...(ROMAJI_ALIASES[kana]??[KANA[kana]])];
 if(kana.length===2&&/[ぁぃぅぇぉゃゅょゎ]/.test(kana[1])){
  const bases=ROMAJI_ALIASES[kana[0]]??[KANA[kana[0]]];
  const small=(ROMAJI_ALIASES[kana[1]]??[]).filter(s=>/^[xl]/.test(s));
  for(const base of bases)for(const tail of small)if(base)result.push(base+tail);
 }
 return [...new Set(result.filter(Boolean))];
}
