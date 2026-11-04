import {makeLine} from '../public/lib/romaji.mjs';
const first={
 yuri:[['一緒にお茶を飲みませんか。','いっしょ|に|おちゃ|を|のみ|ません|か|。','一緒|に|お茶|を|飲み|ません|か|。',['Shall we have tea together?','一起喝茶好吗？','¿Tomamos té juntos?']],['一緒に料理を作りましょう。','いっしょ|に|りょうり|を|つくり|ましょう|。','一緒|に|料理|を|作り|ましょう|。',['Let’s cook together.','一起做饭吧。','Cocinemos juntos.']],['一緒に祭りを楽しみましょう。','いっしょ|に|まつり|を|たのしみ|ましょう|。','一緒|に|祭り|を|楽しみ|ましょう|。',['Let’s enjoy the festival together.','一起享受祭典吧。','Disfrutemos del festival juntos.']]],
 haruka:[['一緒に読みませんか。','いっしょ|に|よみ|ません|か|。','一緒|に|読み|ません|か|。',['Shall we read together?','要一起读书吗？','¿Leemos juntos?']],['お水をください。','おみず|を|ください|。','お水|を|ください|。',['Could I have some water?','请给我一些水。','¿Me das un poco de agua?']],['一緒に本屋に行きませんか。','いっしょ|に|ほんや|に|いき|ません|か|。','一緒|に|本屋|に|行き|ません|か|。',['Shall we go to the bookstore together?','一起去书店好吗？','¿Vamos juntos a la librería?']]],
 hana:[['このバグを見てください。','この|ばぐ|を|みて|ください|。','この|バグ|を|見て|ください|。',['Please take a look at this bug.','请看看这个漏洞。','Mira este error, por favor.']],['私のゲームで遊びませんか。','わたし|の|げーむ|で|あそび|ません|か|。','私|の|ゲーム|で|遊び|ません|か|。',['Would you like to play my game?','想玩玩我做的游戏吗？','¿Quieres jugar a mi juego?']],['少し休みませんか。','すこし|やすみ|ません|か|。','少し|休み|ません|か|。',['Shall we take a little break?','稍微休息一下好吗？','¿Descansamos un poco?']]]
};
const tr=(s,values)=>values[{en:0,zh:1,es:2}[s.language]];
function line(s,[japanese,readings,surfaces,translations]){return makeLine({japanese,translation:tr(s,translations),chunks:surfaces.split('|').map((japanese,i)=>({japanese,reading:readings.split('|')[i]}))});}
const responses={
 good:['一緒だと安心します。','いっしょ|だ|と|あんしん|し|ます|。','一緒|だ|と|安心|し|ます|。',['I feel at ease with you.','和你在一起很安心。','Contigo me siento tranquila.']],
 hidden:['その気持ちを大切にします。','その|きもち|を|たいせつ|に|し|ます|。','その|気持ち|を|大切|に|し|ます|。',['I will treasure that feeling.','我会珍惜这份心意。','Guardaré ese sentimiento con cariño.']],
 bad:['今は少し悲しいです。','いま|は|すこし|かなしい|です|。','今|は|少し|悲しい|です|。',['I feel a little sad right now.','现在有一点难过。','Ahora estoy un poco triste.']]
};
const endings={
 good:['また一緒に過ごしましょう。','また|いっしょ|に|すごし|ましょう|。','また|一緒|に|過ごし|ましょう|。',['Let’s spend time together again.','下次还一起度过吧。','Pasemos tiempo juntos otra vez.']],
 hidden:['言葉より心が伝わりました。','ことば|より|こころ|が|つたわり|ました|。','言葉|より|心|が|伝わり|ました|。',['Your heart said more than words.','心意比言语传达得更多。','Tu corazón dijo más que las palabras.']],
 bad:['今日はここで別れましょう。','きょう|は|ここ|で|わかれ|ましょう|。','今日|は|ここ|で|別れ|ましょう|。',['Let’s part ways here for today.','今天就到这里告别吧。','Por hoy, despidámonos aquí.']]
};
const choiceData={
 good:['あなたと一緒にいたいです。','あなた|と|いっしょ|に|い|たい|です|。','あなた|と|一緒|に|い|たい|です|。',['I want to stay here with you.','我想留在这里陪你。','Quiero quedarme aquí contigo.']],
 hidden:['（何も言わずに抱きしめる。）','（|なにも|いわ|ず|に|だきしめる|。|）','（|何も|言わ|ず|に|抱きしめる|。|）',['(Hug her without saying a word.)','（什么也不说，抱住她。）','(Abrazarla sin decir una palabra.)']],
 bad:['一人にしてください。','ひとり|に|して|ください|。','一人|に|して|ください|。',['Please leave me alone.','请让我一个人待着。','Por favor, déjame a solas.']]
};
export const demoProvider={
 async narrative(s){
  const path=s.path??'good',done=s.turn>=6;
  return {...line(s,s.turn?(done?endings[path]:responses[path]):first[s.character.id][s.scene.id]),emotion:s.turn?(path==='bad'?'sad':path==='hidden'?'shy':'loving'):'normal',ending:done?path:'none',memory:`Offline authored demo, ${s.character.name}, turn ${s.turn}.`,choices:done?[]:['good','hidden','bad'].map(path=>({path,text:tr(s,choiceData[path][3])}))};
 },
 async translate(s,text){const choice=s.line.choices.find(c=>c.text===text);if(!choice)throw new Error('This sample follows its suggested replies. Choose one to keep going.');return line(s,choiceData[choice.path]);}
};
