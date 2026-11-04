export const SCENE_WORD_LIMIT=80;
export const SCENE_CHARACTER_LIMIT=500;
const segmenter=new Intl.Segmenter('ja',{granularity:'word'});
export const sceneWordCount=text=>[...segmenter.segment(String(text))].filter(s=>s.isWordLike).length;
export function validateScene(text){
 if(typeof text!=='string'||!text.trim())throw new Error('Describe the moment you would like to share.');
 const description=text.trim();
 if(sceneWordCount(description)>SCENE_WORD_LIMIT||[...description].length>SCENE_CHARACTER_LIMIT)throw new Error('Keep your scene within 80 words and 500 characters.');
 return description;
}
