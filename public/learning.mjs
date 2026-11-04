import {request} from './accounts.mjs';
import {gardenArt} from './lib/scenery.mjs';
import {KANA} from './lib/kana.mjs';
import {spellings} from './lib/romaji-options.mjs';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,cls,fn)=>{const n=el('button',cls,text);n.type='button';n.onclick=fn;return n;};
export function openTypingGuide(){
 let modal=document.querySelector('#typing-guide');
 if(!modal){
  modal=el('dialog');modal.id='typing-guide';const head=el('div','dialog-head');head.append(el('h2','','More than one way to type'),button('Close','quiet',()=>modal.close()));modal.append(head,el('p','muted','Hepburn, Kunrei / Nihon-shiki and common IME spellings work together. You can mix them within a sentence.'));
  const table=el('table','spelling-table'),body=el('tbody');
  for(const kana of Object.keys(KANA)){const choices=spellings(kana);if(choices.length<2)continue;const row=el('tr');row.append(el('th','',kana),el('td','',choices.join(' / ')));body.append(row);}table.append(body);modal.append(table);
  for(const text of ["ん accepts n, nn, n' or xn. Small っ accepts a matching doubled consonant, xtsu / ltsu / xtu / ltu; っち also accepts tchi.","Long ー accepts its repeated vowel or a hyphen. Particles は / へ / を accept wa / ha, e / he, o / wo. Greetings ending in は accept both wa and ha.","Small kana can be typed with x or l: きゃ → kya / kixya / kilya. Case and spaces are ignored. The accepted alternatives follow the displayed Japanese, so a spelling for a different sound will not count."]){modal.append(el('p','muted',text));}document.body.append(modal);
 }
 modal.showModal();
}
export function createLearningUI({app,getUser,signIn,getLanguage,notify,hasTutor}){
 let root,session=null,summary=null,generation=0,busy=false,draft='',feedback='',tutor=null;
 const alive=token=>token===generation&&root?.isConnected;
 function frame(){
  app.innerHTML=`<section class="learning-screen"><div class="learning-heading"><span class="eyebrow">THE LANTERN GARDEN</span><h1>Words worth remembering.</h1><p class="muted">A little recall today. A steadier memory tomorrow.</p></div><div class="learning-art" aria-hidden="true">${gardenArt(session?Math.floor(session.index/Math.max(session.total,1)*12):0)}</div><div class="learning-content"></div><p class="dictionary-credit">Dictionary: <a href="https://www.edrdg.org/jmdict/j_jmdict.html" target="_blank" rel="noopener noreferrer">JMdict · EDRDG</a> · <a href="/data/CC-BY-SA-4.0.txt" target="_blank" rel="noopener">CC BY-SA 4.0</a></p></section>`;
  root=app.querySelector('.learning-screen');return root.querySelector('.learning-content');
 }
 function error(message){feedback=message;const n=root?.querySelector('.learning-feedback');if(n)n.textContent=message;else notify(message);}
 async function mount(){
  const token=++generation;session=null;tutor=null;busy=false;const content=frame();
  if(!getUser()){const gate=el('section','learning-card account-gate');gate.append(el('h2','','A garden of your own.'),el('p','muted','Sign in to set a goal, revisit familiar words, and keep your progress.'),button('Sign in or create an account →','primary',signIn));content.append(gate);return;}
  content.append(el('p','muted','Opening your garden…'));
  try{summary=await request('/api/learn/summary');if(alive(token))dashboard();}catch(e){if(alive(token)){content.replaceChildren(el('p','learning-feedback',e.message),button('Try again','secondary',mount));}}
 }
 function metrics(content){const stats=el('div','learning-stats');for(const [name,value] of [['Words met',summary.studied],['Ready to review',summary.due],['Mastered',summary.mastered],['Still to discover',summary.newRemaining]]){const box=el('div');box.append(el('strong','',String(value)),el('span','',name));stats.append(box);}content.append(stats);}
 function dashboard(){
  session=null;tutor=null;draft='';feedback='';const content=frame();metrics(content);
  const goalCard=el('section','learning-card goal-card');goalCard.append(el('span','eyebrow','YOUR NEXT LITTLE PROMISE'),el('h2','','How many new words?'));
  const form=el('form','goal-form'),label=el('label','','New words'),input=el('input');input.type='number';input.min='1';input.max='100';input.required=true;input.value=summary.goal;input.setAttribute('aria-label','New vocabulary goal');label.append(input);form.append(label);const begin=el('button','primary','Begin my session →');begin.type='submit';form.append(begin);goalCard.append(form,el('p','muted','Due reviews come back between new words. If nothing is due, a short warm-up keeps earlier words close. Mastered words stay retired.'),el('p','learning-feedback'));
  form.onsubmit=async event=>{event.preventDefault();if(busy)return;busy=true;begin.disabled=true;const token=generation;try{const result=await request('/api/learn/plan',{goal:Number(input.value)});if(alive(token)){session=result.session;renderQuiz();}}catch(e){if(alive(token))error(e.message);}finally{if(alive(token)){busy=false;begin.disabled=false;}}};
  if(summary.active&&summary.active.stage!=='done')goalCard.append(button(`Resume your ${summary.active.total}-word session →`,'secondary',async()=>{const token=generation;try{const result=await request('/api/learn/resume',{});if(alive(token)&&result.session){session=result.session;renderQuiz();}}catch(e){error(e.message);}}));
  content.append(goalCard);renderRecords(content);
 }
 function renderRecords(content){
  const details=el('details','learning-card records');details.append(el('summary','',`Your learning record · ${summary.studied} words`));
  const controls=el('div','record-controls'),search=el('input');search.type='search';search.placeholder='Find a word or reading…';search.setAttribute('aria-label','Find a learned word');const filter=el('select');filter.setAttribute('aria-label','Learning status');for(const [value,text] of [['all','All words'],['learning','Learning'],['mastered','Mastered']]){const opt=el('option','',text);opt.value=value;filter.append(opt);}controls.append(search,filter);details.append(controls);const list=el('div','record-list');details.append(list);
  function draw(){const term=search.value.trim().toLowerCase();const rows=summary.records.filter(r=>(filter.value==='all'||(filter.value==='mastered'?!!r.mastered:!r.mastered))&&[r.kanji,...r.readings,r.meaning].join(' ').toLowerCase().includes(term));list.replaceChildren();for(const r of rows){const row=el('div','record-row');const name=el('div');name.append(el('strong','',r.kanji),el('small','',r.readings.join(' · ')));const detail=el('div');detail.append(el('p','',r.meaning),el('small','',r.mastered?(r.passed?'Mastered · passed':'Mastered'):r.due_at<=Date.now()?'Ready to review':`Next review ${new Date(r.due_at).toLocaleString()}`));row.append(name,detail,el('span','record-level',r.mastered?'✧':`${r.level}/6`));list.append(row);}if(!rows.length)list.append(el('p','muted','No words here yet. Your first session is waiting.'));}
  search.oninput=draw;filter.onchange=draw;draw();content.append(details);
  if(summary.events.length){const history=el('details','learning-card');history.append(el('summary','','Recent study log'));const log=el('div','study-log');for(const item of summary.events.slice(0,30)){const row=el('p');row.append(el('strong','',item.kanji),el('span','',item.result===2?' Passed':item.result===1?' Recalled':' Revisit soon'),el('small','',new Date(item.at).toLocaleString()));log.append(row);}history.append(log);content.append(history);}
 }
 function renderQuiz(){
  draft=session.stage==='reading'?draft:'';feedback='';const content=frame();
  if(session.stage==='done'){const card=el('section','learning-card session-finish');card.append(el('span','eyebrow','A LITTLE MORE LIGHT'),el('h2','','Your session is complete.'),el('p','muted',`${session.newCount} new words · ${session.reviewCount} reviews and warm-ups`));const list=el('div','session-results');for(const result of session.results){const n=el('span',result.mastered?'mastered':'',result.kanji+(result.passed?' · passed':result.correct?' ✓':' ↻'));list.append(n);}card.append(list,button('Return to my garden →','primary',mount));content.append(card);return;}
  const current=session.current,card=el('section','learning-card quiz-card');
  const top=el('div','quiz-top');top.append(el('span','eyebrow',`${{new:'FIRST MEETING',review:'TIME TO REMEMBER',warmup:'A FAMILIAR FACE'}[current.kind]} · ${session.index+1} / ${session.total}`),button('My garden','quiet',mount));card.append(top);
  const kanji=el('h2','quiz-kanji',current.kanji);kanji.lang='ja';card.append(kanji);
  if(session.stage==='reading')renderReading(card,current);
  if(session.stage==='meaning')renderMeaning(card,current);
  if(session.stage==='result'){renderResult(card,session.result);}
  if(session.stage!=='result'){
   const tools=el('div','quiz-tools');tools.append(button('Turn the card for a hint','quiet',()=>act('hint')),button('I know this word · Pass','quiet',()=>act('pass')),button('Typing guide','quiet',openTypingGuide));card.append(tools);
   if(current.hint){const hint=el('div','quiz-hint');hint.append(el('p','',current.hint.readings.join(' · ')),el('small','',current.hint.romaji.join(' / ')));if(current.hint.meanings.length)hint.append(el('p','',current.hint.meanings.join('; ')));card.append(hint);}
  }
  card.append(el('p','learning-feedback'));content.append(card);
  if(session.stage==='result'){
   if(tutor?.itemId!==current.id){tutor={itemId:current.id,loading:false,example:null,threadId:null,messages:[],error:'',busy:false};if(!session.result.passed)queueMicrotask(loadExample);}
   renderTutor(content);
  }
 }
 function renderReading(card,current){
  card.append(el('p','quiz-question','読み方は？ How do you read this word?'));
  const form=el('form','reading-form'),label=el('label','sr-only','Reading in kana or romaji'),input=el('input','practice-input');input.id='quiz-reading';label.htmlFor=input.id;input.name='reading';input.placeholder='Kana or romaji…';input.maxLength=200;input.autocomplete='off';input.spellcheck=false;input.autocapitalize='off';input.value=draft;const submit=el('button','primary','Check my reading →');submit.type='submit';form.append(label,input,submit);card.append(form);
  input.oninput=()=>draft=input.value;input.onpaste=e=>{e.preventDefault();notify('Let your fingers do the remembering.');};input.ondrop=e=>e.preventDefault();
  let composing=false;input.oncompositionstart=()=>composing=true;input.oncompositionend=()=>composing=false;
  form.onsubmit=e=>{e.preventDefault();if(!busy&&!composing)act('reading',{answer:input.value});};input.onkeydown=e=>{if(e.key==='Enter'&&e.isComposing){e.preventDefault();e.stopPropagation();}};requestAnimationFrame(()=>{if(input.isConnected)input.focus({preventScroll:true});});
 }
 function renderMeaning(card,current){
  card.append(el('p','quiz-reading',current.answeredReading),el('p','quiz-question','Choose its English meaning.'));const options=el('div','meaning-options');
  for(const [i,choice] of current.options.entries()){const n=button('','meaning-option',()=>act('meaning',{choiceId:choice.id}));n.append(el('kbd','',String(i+1)),el('span','',choice.text));n.disabled=current.wrongChoices.includes(choice.id);if(n.disabled)n.classList.add('incorrect');options.append(n);}card.append(options);
 }
 function renderResult(card,result){
  card.append(el('p','quiz-reading',result.readings.join(' · ')));const meanings=el('ul','dictionary-meanings');for(const meaning of result.meanings)meanings.append(el('li','',meaning));card.append(meanings);
  const message=result.passed?'Already yours. This word is retired from future sessions.':result.mastered?'A steady memory. This word is now mastered.':result.correct?'Well remembered. Its next review is on the way.':'Let’s revisit this one soon. A little repetition will help.';
  card.append(el('p',result.mastered?'mastery-note':'muted',message));if(result.dueAt)card.append(el('small','muted',`Next review: ${new Date(result.dueAt).toLocaleString()}`));card.append(button('Next word →','primary',()=>act('next')));
 }
 async function act(action,data={}){
  if(busy||!session?.current)return;busy=true;const token=generation;for(const b of root.querySelectorAll('.quiz-card button'))b.disabled=true;
  try{const result=await request('/api/learn/'+action,{sessionId:session.id,itemId:session.current.id,...data});if(!alive(token))return;session=result.session;if(result.correct||action==='next')draft='';renderQuiz();if(result.feedback)error(result.feedback);}
  catch(e){if(alive(token)){if(e.status===401){await mount();}else if(e.status===409){try{const result=await request('/api/learn/resume',{});if(alive(token)&&result.session){session=result.session;renderQuiz();}}catch(recoveryError){error(recoveryError.message);}}else{renderQuiz();error(e.message);}}}
  finally{busy=false;}
 }
 function renderTutor(content){
  const card=el('section','learning-card tutor-card');card.id='word-tutor';card.append(el('span','eyebrow','A WORD IN THE WORLD'),el('h2','','Try it in a sentence.'));
  if(tutor.loading)card.append(el('p','muted','Finding a sentence…'));
  else if(tutor.example){const example=el('div','tutor-example');example.append(el('p','example-japanese',tutor.example.japanese),el('p','example-reading',tutor.example.reading),el('p','',tutor.example.translation),el('small','muted',tutor.example.note));card.append(example,el('p','tutor-label','AI tutor example · ask if something feels unclear.'));}
  else{card.append(el('p','muted',tutor.error||'Would you like to see this word in a sentence?'),button('Ask for an example','secondary',loadExample));}
  if(tutor.threadId){
   const log=el('div','tutor-chat');log.setAttribute('aria-live','polite');for(const message of tutor.messages){const n=el('div','tutor-message '+message.role);n.append(el('small','',message.role==='user'?'You':'Tutor'),el('p','',message.text));log.append(n);}card.append(log);
   const form=el('form','tutor-form'),label=el('label','','Ask about this word'),input=el('textarea');input.name='question';input.maxLength=400;input.placeholder='Why is this reading used? Can you show another example?';label.append(input);const send=el('button','secondary',tutor.busy?'Thinking…':'Ask the tutor →');send.type='submit';send.disabled=tutor.busy;form.append(label,el('small','muted','Up to 400 characters'),send);form.onsubmit=e=>{e.preventDefault();sendQuestion(input.value);};card.append(form);if(tutor.error)card.append(el('p','learning-feedback',tutor.error));
  }
  content.append(card);
 }
 function refreshTutor(){const content=root?.querySelector('.learning-content');if(!content||!tutor||session?.stage!=='result')return;root.querySelector('#word-tutor')?.remove();renderTutor(content);}
 async function loadExample(){
  if(!tutor||tutor.loading||session?.stage!=='result')return;const token=generation,itemId=tutor.itemId;tutor.loading=true;tutor.error='';refreshTutor();
  if(!hasTutor()){tutor.loading=false;tutor.error='The sentence tutor is taking a break. Your quiz progress is still saved.';refreshTutor();return;}
  try{const result=await request('/api/tutor/example',{entryId:session.result.entryId,reading:session.result.reading,language:getLanguage()});if(alive(token)&&tutor?.itemId===itemId){tutor.example=result.example;tutor.threadId=result.threadId;}}
  catch(e){if(alive(token)&&tutor?.itemId===itemId)tutor.error=e.message;}
  finally{if(alive(token)&&tutor?.itemId===itemId){tutor.loading=false;refreshTutor();}}
 }
 async function sendQuestion(question){
  if(!tutor||tutor.busy||!question.trim()||[...question].length>400)return;const token=generation,itemId=tutor.itemId;tutor.busy=true;tutor.error='';const text=question.trim();tutor.messages.push({role:'user',text});refreshTutor();
  try{const result=await request('/api/tutor/chat',{threadId:tutor.threadId,question:text});if(alive(token)&&tutor?.itemId===itemId)tutor.messages.push({role:'assistant',text:result.answer});}
  catch(e){if(alive(token)&&tutor?.itemId===itemId){tutor.messages.pop();tutor.error=e.message;}}
  finally{if(alive(token)&&tutor?.itemId===itemId){tutor.busy=false;refreshTutor();}}
 }
 window.addEventListener('keydown',event=>{
  if(!root?.isConnected||document.querySelector('dialog[open]')||event.isComposing||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
  if(session?.stage==='meaning'&&/^[1-4]$/.test(event.key)){
   const choice=session.current.options[Number(event.key)-1];if(choice&&!session.current.wrongChoices.includes(choice.id)){event.preventDefault();act('meaning',{choiceId:choice.id});}
  }
 });
 return {mount,cancel(){generation++;session=null;tutor=null;busy=false;}};
}
