import {CHARACTERS,LANGUAGES,getCharacter,phaseFor} from './lib/content.mjs';
import {normalizeInput,romajiStatus} from './lib/romaji.mjs';
import {scenery} from './lib/scenery.mjs';
import {createAccountsUI} from './accounts.mjs';
import {createLearningUI,openTypingGuide} from './learning.mjs';
import {sceneWordCount,SCENE_WORD_LIMIT,SCENE_CHARACTER_LIMIT} from './lib/scene.mjs';
const $=s=>document.querySelector(s),app=$('#app');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,cls,fn)=>{const b=el('button',cls,text);b.addEventListener('click',fn);return b;};
let config={hasKey:false},mode='demo',language='en',screen='home',character=null,story=null,busy=false,epoch=0,typed='',hints=true,errorNode=null,toastTimer;
const images=new Map();
async function api(action,data){const r=await fetch('/api/story/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw new Error(value.error??'The local server could not complete the request.');return value;}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function clearError(){errorNode?.remove();errorNode=null;}
function showError(error,retry){clearError();errorNode=el('div','error-banner');errorNode.setAttribute('role','alert');errorNode.append(el('span','',error.message));if(retry)errorNode.append(button('Try again','secondary',()=>{clearError();retry();}));errorNode.append(button('Dismiss','quiet',clearError));document.body.append(errorNode);}
function navigation(){epoch++;clearError();busy=false;$('#journal').close();learningUI.cancel();$('#journal-button').hidden=true;$('#home-button').hidden=true;if(story){api('close',{id:story.id}).catch(()=>{});story=null;}}
function home(){navigation();screen='home';character=null;renderHome();}
function header(){ $('#home-button').hidden=screen==='home';$('#journal-button').hidden=!story;}
function renderHome(){
 app.innerHTML=`<section class="home"><div class="intro"><span class="eyebrow">A LITTLE JAPANESE. A LITTLE COURAGE.</span><h1>Every conversation<br>begins with <em>you.</em></h1><p>Meet someone. Share a moment. Learn to say what you feel.</p></div><div class="home-controls"><label>Translation <select id="language" aria-label="Translation language"></select></label><div class="mode-toggle" aria-label="Story mode"></div></div><div class="character-grid"></div><div class="home-footer"><button class="garden-link" id="garden-link"><span>✧</span><span><strong>The Lantern Garden</strong><small>Meet kanji. Remember their stories →</small></span></button><p id="mode-note"></p></div></section>`;
 for(const [id,label] of Object.entries(LANGUAGES)){const option=el('option','',label);option.value=id;$('#language').append(option);}$('#language').value=language;$('#language').onchange=e=>language=e.target.value;
 const toggle=$('.mode-toggle');for(const [value,label] of [['live','Your story'],['demo','Sample chapter']]){const b=button(label,mode===value?'active':'',()=>{mode=value;renderHome();});b.setAttribute('aria-pressed',String(mode===value));toggle.append(b);}
 $('#mode-note').textContent=mode==='demo'?'A short chapter to get to know someone.':'Choose a moment. Let your words shape what happens next.';
 for(const [i,c] of CHARACTERS.entries()){
  const b=button('','character-card',()=>selectCharacter(c));b.setAttribute('aria-label',`Meet ${c.name}: ${c.trait}`);
  b.innerHTML=`<img src="/assets/characters/${c.id}.png" alt="Anime portrait of ${c.name}" fetchpriority="high"><span class="card-number">0${i+1}</span><span class="card-copy"><span class="trait">${c.trait}</span><h2>${c.name}<small>${c.japaneseName}</small></h2><p>${c.description}</p><span class="card-arrow">↗</span></span>`;$('.character-grid').append(b);
 }$('#garden-link').onclick=showGarden;header();
}
function selectCharacter(c){navigation();character=c;screen='scenes';header();app.innerHTML=`<section class="scenes"><div class="scene-poster"><img src="/assets/characters/${c.id}.png" alt="${c.name}"><strong>${c.name} <small>${c.japaneseName}</small></strong></div><div class="scene-copy"><span class="eyebrow">CHOOSE YOUR FIRST CHAPTER</span><h1>A moment with ${c.name}.</h1><p>${c.description}<br>Where will your story begin?</p><div class="scene-list"></div><button class="quiet" id="back-characters">← Meet someone else</button></div></section>`;
 for(const scene of c.scenes){const b=button('','scene-option',()=>startStory(c,scene));b.innerHTML=`<span class="number">0${scene.id+1}</span><span><strong>${scene.title}</strong><small>${scene.subtitle}</small></span>`;$('.scene-list').append(b);}$('#back-characters').onclick=home;renderCustomScene(c);
}

function renderCustomScene(c){
 const form=el('form','custom-scene');
 form.innerHTML=`<label for="custom-scene-text">Or imagine your own moment</label><textarea id="custom-scene-text" placeholder="A rainy evening in a little bookshop. She has found a letter tucked inside an old novel…" maxlength="650"></textarea><div class="custom-scene-foot"><small id="scene-count"></small><button type="submit" class="secondary">Begin my chapter →</button></div><p class="muted" id="custom-scene-note"></p>`;
 const input=form.querySelector('textarea'),submit=form.querySelector('button');
 function count(){const words=sceneWordCount(input.value),characters=[...input.value].length;form.querySelector('#scene-count').textContent=`${words} / ${SCENE_WORD_LIMIT} words · ${characters} / ${SCENE_CHARACTER_LIMIT} characters`;submit.disabled=!input.value.trim()||words>SCENE_WORD_LIMIT||characters>SCENE_CHARACTER_LIMIT||mode!=='live'||!config.hasKey;}
 form.querySelector('#custom-scene-note').textContent=mode==='demo'?'Choose Your story on the home screen to imagine a new chapter.':!config.hasKey?'Custom chapters are resting for now. Try a sample chapter.':'Set the place, the mood, and the small thing about to happen.';
 input.oninput=count;form.onsubmit=e=>{e.preventDefault();if(!submit.disabled)startStory(c,{id:'custom',description:input.value.trim()});};count();$('#back-characters').before(form);
}

async function startStory(c,scene){
 if(busy)return;clearError();if(mode==='live'&&!config.hasKey){showError(new Error('The storyteller is resting. Try a sample chapter for now.'));return;}
 const token=++epoch;busy=true;screen='loading';header();app.innerHTML=`<section class="loading-page"><span class="eyebrow">A NEW CHAPTER</span><div class="spinner"></div><h1>Finding the first words…</h1><p>${c.name} is waiting. A scene is about to unfold.</p><button class="quiet" id="cancel-start">← Back to scenes</button></section>`;$('#cancel-start').onclick=()=>selectCharacter(c);
 try{const result=await api('start',{characterId:c.id,sceneId:scene.id,sceneDescription:scene.description,language,mode});if(token!==epoch){api('close',{id:result.id}).catch(()=>{});return;}story=result;screen='story';typed='';renderStory();}
 catch(e){if(token===epoch){selectCharacter(c);showError(e,()=>startStory(c,scene));}}
 finally{if(token===epoch){busy=false;setBusy(false);}}
}
function activeLine(){return story.stage==='player'?story.playerLine:story.line;}
function renderStory({keepTyped=false}={}){
 if(!keepTyped)typed='';clearError();screen='story';header();const c=getCharacter(story.characterId),scene=story.scene??c.scenes[story.sceneId];
 app.innerHTML=`<section class="story"><div class="backdrop">${scenery(scene.background)}</div><div class="scene-meta"><span class="eyebrow">${c.name.toUpperCase()}’S STORY · ${scene.custom?'YOUR CHAPTER':'0'+(scene.id+1)}</span><h1>${scene.title}</h1><p>${scene.subtitle}</p></div><div class="story-status"><span>${phaseFor(story.turn).toUpperCase()} · ${String(story.turn+1).padStart(2,'0')}</span>${story.mode==='demo'?'<span class="demo-badge">SAMPLE CHAPTER</span>':''}</div><div class="portrait" role="img" aria-label="${c.name}"></div><span class="expression-label"></span><div class="choices"></div><div class="story-dock"><section class="dialogue-box" aria-label="Dialogue"><div class="speaker"></div><div class="jp-dialogue" lang="ja"></div><p class="translation"></p><div class="dialogue-foot"><span>灯りの物語</span><span>Listen with your eyes. Answer with your hands.</span></div></section><div id="interaction"></div></div></section>`;
 drawPortrait(c,story.line.emotion);$('.expression-label').textContent=story.line.emotion;$('.portrait').setAttribute('aria-label',`${c.name}, ${story.line.emotion} expression`);
 const line=activeLine();$('.speaker').textContent=story.stage==='player'?'YOU · REHEARSE YOUR REPLY':c.name.toUpperCase();$('.translation').textContent=line.translation;
 for(const ch of line.chunks){const span=el('span','jp-part',ch.japanese);span.dataset.end=ch.end;span.dataset.start=ch.start;span.dataset.romaji=ch.romaji;if(['reply','ending'].includes(story.stage))span.classList.add('done');$('.jp-dialogue').append(span);}
 if(story.stage==='ending'){renderEnding(c);return;}
 renderChoices();if(story.stage==='reply')renderComposer();else renderPractice(line);setBusy(busy);
}
let lastPortrait=null;
async function drawPortrait(c,emotion){
 const holder=$('.portrait'),key=c.id,pose=c.emotions.indexOf(emotion);
 const old=lastPortrait?.id===key?lastPortrait:null;lastPortrait={id:key,pose};
 let image=images.get(key);if(!image){image=new Image();image.src=`/assets/expressions/${key}.png`;images.set(key,image);}
 try{await image.decode();}catch{return;}if(!holder.isConnected)return;
 function draw(index,opacity){const canvas=el('canvas');canvas.width=370;canvas.height=611;const ctx=canvas.getContext('2d');ctx.drawImage(image,index%3*418+24,Math.floor(index/3)*627+8,370,611,0,0,370,611);canvas.style.opacity=opacity;holder.append(canvas);return canvas;}
 if(old&&old.pose!==pose){const previous=draw(old.pose,'1'),next=draw(pose,'0');requestAnimationFrame(()=>requestAnimationFrame(()=>{previous.style.opacity='0';next.style.opacity='1';}));setTimeout(()=>previous.remove(),460);}else draw(pose,'1');
}
function renderChoices(){
 const holder=$('.choices');holder.replaceChildren();if(!['reply','character'].includes(story.stage)||story.line.ending!=='none')return;
 holder.append(el('div','choices-title',story.stage==='reply'?'What would you like to say?':'A FEW POSSIBLE WORDS'));
 for(const [i,choice] of story.line.choices.entries()){
  const b=button('','choice',()=>translateReply(choice.text));b.disabled=story.stage!=='reply'||busy;b.append(el('kbd','',String(i+1)),el('span','',choice.text),el('span','arrow','→'));holder.append(b);
 }holder.append(el('p','choices-note',story.stage==='reply'?'Or write your own reply below. Every word changes the story.':'Practice this line first. Then the conversation is yours.'));
 if(story.mode==='demo'&&story.stage==='reply')holder.lastChild.textContent='Choose a reply to continue this sample chapter.';
}
function renderPractice(line){
 $('#interaction').innerHTML=`<section class="practice-box" aria-label="Romaji practice"><div class="practice-head"><span class="eyebrow">${story.stage==='player'?'SAY IT IN JAPANESE':'MAKE THE WORDS YOURS'}</span><span><button class="quiet" id="typing-help">Guide</button> · <button class="quiet" id="hint-button"></button></span></div><div class="chunks"></div><label class="sr-only" for="romaji-input">Type the romaji for the Japanese sentence</label><input class="practice-input" id="romaji-input" placeholder="Type the romaji…" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text"><div class="practice-bottom"><small id="practice-progress"></small><button class="primary" id="continue-button">${story.stage==='player'?'Send reply':'Continue'} <kbd>↵</kbd></button></div>${story.stage==='player'?'<button class="quiet" id="edit-reply">← Edit your words</button>':''}</section>`;
 const chunks=$('.chunks');for(const ch of line.chunks){const n=el('span','chunk');n.append(el('span','jp',ch.japanese),el('span','latin'));chunks.append(n);}
 const input=$('#romaji-input');input.value=typed;input.onpaste=e=>{e.preventDefault();toast('Type each letter yourself. That is how the words stay with you.');};input.ondrop=e=>e.preventDefault();input.oninput=()=>{
  const value=normalizeInput(input.value);if(romajiStatus(line,value).valid){typed=value;input.value=typed;updateProgress();}else{input.value=typed;input.classList.remove('error');void input.offsetWidth;input.classList.add('error');if(/[^a-z'-]/.test(value))toast('Switch to an English keyboard to type romaji.');}
 };input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();advance();}if(e.key==='Tab'){e.preventDefault();hints=!hints;updateProgress();}};
 $('#typing-help').onclick=openTypingGuide;$('#hint-button').onclick=()=>{hints=!hints;updateProgress();};$('#continue-button').onclick=advance;
 if($('#edit-reply'))$('#edit-reply').onclick=()=>storyAction('edit');
 updateProgress();if(!busy)requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
function updateProgress(){
 if(!story||!$('#romaji-input'))return;const line=activeLine(),nodes=$$('.chunk'),status=romajiStatus(line,typed);let active=-1;
 line.chunks.forEach((ch,i)=>{
  const progress=status.chunks[i]??{done:false,typed:'',remaining:ch.romaji};
  const n=nodes[i],on=!!ch.romaji&&!progress.done&&active<0;if(on)active=i;n.classList.toggle('done',progress.done);n.classList.toggle('active',on);
  const latin=n.querySelector('.latin');latin.replaceChildren();latin.append(el('span','typed',progress.typed),document.createTextNode(hints?progress.remaining:'·'.repeat(progress.remaining.length)));
 });for(const [i,n] of $$('.jp-part').entries())n.classList.toggle('done',!!status.chunks[i]?.done);
 if(active>=0)nodes[active]?.scrollIntoView({block:'nearest',inline:'nearest'});
 $('#practice-progress').textContent=status.complete?'✓ Ready when you are':`${typed.length} letters · keep going`;
 $('#continue-button').disabled=busy||!status.complete;$('#hint-button').textContent=hints?'Hide hints ⇥':'Show hints ⇥';
}

function $$(s){return [...document.querySelectorAll(s)];}
async function advance(){if(!story||busy||!romajiStatus(activeLine(),typed).complete)return;await storyAction(story.stage==='player'?'send':'read',{romaji:typed});}
function renderComposer(){
 $('#interaction').innerHTML=`<section class="composer" aria-label="Your reply"><div class="practice-head"><label class="eyebrow" for="reply-input">YOUR WORDS, YOUR LANGUAGE</label></div><textarea id="reply-input" placeholder="What would you like to say?"></textarea><div class="composer-footer"><span id="reply-count">0 / 160</span><button class="primary" id="translate-button">Translate & practice →</button></div><p class="muted">First, find your words. Then learn to say them in Japanese.</p></section>`;
 const input=$('#reply-input');input.value=story.draft;input.disabled=story.mode==='demo';if(input.disabled)input.placeholder='Choose a reply above to continue this chapter.';
 const count=()=>{$('#reply-count').textContent=`${[...input.value].length} / 160`;$('#translate-button').disabled=busy||input.disabled||!input.value.trim()||[...input.value.trim()].length>160;};input.oninput=count;input.onkeydown=e=>{if(e.key==='Enter'&&(e.ctrlKey||e.metaKey)&&!e.isComposing){e.preventDefault();translateReply(input.value);}};$('#translate-button').onclick=()=>translateReply(input.value);count();
}
async function translateReply(text){if(busy||story?.stage!=='reply')return;await storyAction('draft',{text});}
async function storyAction(action,data={}){
 if(busy||!story)return;const token=epoch,id=story.id;clearError();setBusy(true);
 try{const result=await api(action,{id,...data});if(token!==epoch)return;story=result;typed='';busy=false;renderStory();}
 catch(e){if(token===epoch)showError(e,()=>storyAction(action,data));}
 finally{if(token===epoch)setBusy(false);}
}
function setBusy(value){
 busy=value;if(screen!=='story')return;
 for(const b of $$('.choice'))b.disabled=value||story.stage!=='reply';
 for(const b of $$('#interaction button'))b.disabled=value;
 for(const input of $$('#interaction input, #interaction textarea'))input.disabled=value||input.tagName==='TEXTAREA'&&story.mode==='demo';
 $('.notice')?.remove();if(value){const n=el('div','notice');n.append(el('div','spinner'),el('h2','','Finding the words…'),el('p','','Take a breath. Your story is still here.'));$('.story').append(n);}else{updateProgress();if(story.stage==='reply')$('#reply-input')?.dispatchEvent(new Event('input'));}
}
function renderEnding(c){
 $('.choices').replaceChildren();const label={good:'A light to return to',hidden:'Between the lines',bad:'A different goodbye'}[story.line.ending];const n=el('section','ending');n.append(el('div','seal','結'),el('span','eyebrow',`${story.line.ending.toUpperCase()} ENDING`),el('h2','',label),el('p','',story.mode==='demo'?'One small chapter, a few words worth keeping.':`A chapter with ${c.name}, shaped by the words you chose to share.`),button('Begin another chapter →','primary',()=>selectCharacter(c)),button('Read our journal','quiet',openJournal));$('.story').append(n);
}
function openJournal(){if(!story)return;const entries=$('#journal-entries');entries.replaceChildren();for(const item of story.journal){const entry=el('div','journal-entry');entry.append(el('strong','',item.speaker),el('p','',item.japanese),el('small','',item.translation));entries.append(entry);}$('#journal').showModal();}
const accounts=createAccountsUI(()=>{if(screen==='garden')learningUI.mount();});
const learningUI=createLearningUI({app,getUser:()=>accounts.user,signIn:()=>accounts.open(),getLanguage:()=>language,notify:toast,hasTutor:()=>config.hasKey});
function showGarden(){navigation();screen='garden';header();learningUI.mount();}
$('#brand').onclick=home;$('#home-button').onclick=home;$('#journal-button').onclick=openJournal;$('#close-journal').onclick=()=>$('#journal').close();
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!document.querySelector('dialog[open]')&&screen!=='home'){home();return;}
 if(document.querySelector('dialog[open]')||e.isComposing||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
 if(e.key.toLowerCase()==='j'&&story){e.preventDefault();openJournal();}
 if(/^[1-3]$/.test(e.key)&&story?.stage==='reply'&&!busy){e.preventDefault();translateReply(story.line.choices[Number(e.key)-1].text);}
});
window.addEventListener('pagehide',()=>{if(story)fetch('/api/story/close',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:story.id}),keepalive:true}).catch(()=>{});});
try{const r=await fetch('/api/config');if(!r.ok)throw new Error();config=await r.json();mode=config.hasKey?'live':'demo';}catch{toast('The lanterns have gone quiet. Please reopen the game.');}await accounts.init();renderHome();
