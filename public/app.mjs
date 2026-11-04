import {CHARACTERS,LANGUAGES,getCharacter,phaseFor} from './lib/content.mjs';
import {normalizeInput,completedChunk} from './lib/romaji.mjs';
import {scenery,gardenArt} from './lib/scenery.mjs';
import {gardenRound,gardenType,gardenTick,gardenStats,gardenCommit} from './lib/garden.mjs';
const $=s=>document.querySelector(s),app=$('#app');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const button=(text,cls,fn)=>{const b=el('button',cls,text);b.addEventListener('click',fn);return b;};
let config={hasKey:false,model:''},mode='demo',language='en',screen='home',character=null,story=null,busy=false,epoch=0,typed='',hints=true,errorNode=null,toastTimer,garden=null,gardenTime=0,gardenCategory='nature',gardenChallenge=false;
const images=new Map();
async function api(action,data){const r=await fetch('/api/story/'+action,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data)});const value=await r.json();if(!r.ok)throw new Error(value.error??'The local server could not complete the request.');return value;}
function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3500);}
function clearError(){errorNode?.remove();errorNode=null;}
function showError(error,retry){clearError();errorNode=el('div','error-banner');errorNode.setAttribute('role','alert');errorNode.append(el('span','',error.message));if(retry)errorNode.append(button('Try again','secondary',()=>{clearError();retry();}));errorNode.append(button('Dismiss','quiet',clearError));document.body.append(errorNode);}
function navigation(){epoch++;clearError();busy=false;$('#journal').close();garden=null;$('#journal-button').hidden=true;$('#home-button').hidden=true;if(story){api('close',{id:story.id}).catch(()=>{});story=null;}}
function home(){navigation();screen='home';character=null;renderHome();}
function header(){ $('#home-button').hidden=screen==='home';$('#journal-button').hidden=!story;$('#connection').textContent=story?(story.mode==='demo'?'OFFLINE DEMO':config.model.toUpperCase()):'LOCAL EDITION';}
function renderHome(){
 app.innerHTML=`<section class="home"><div class="intro"><span class="eyebrow">A LITTLE JAPANESE. A LITTLE COURAGE.</span><h1>Every conversation<br>begins with <em>you.</em></h1><p>Meet someone. Share a moment. Learn to say what you feel.</p></div><div class="home-controls"><label>Translation <select id="language" aria-label="Translation language"></select></label><div class="mode-toggle" aria-label="Story mode"></div></div><div class="character-grid"></div><div class="home-footer"><button class="garden-link" id="garden-link"><span>✧</span><span><strong>The Lantern Garden</strong><small>A quiet place to practice your kana →</small></span></button><p id="mode-note"></p></div></section>`;
 for(const [id,label] of Object.entries(LANGUAGES)){const option=el('option','',label);option.value=id;$('#language').append(option);}$('#language').value=language;$('#language').onchange=e=>language=e.target.value;
 const toggle=$('.mode-toggle');for(const [value,label] of [['live','Live story'],['demo','Offline demo']]){const b=button(label,mode===value?'active':'',()=>{mode=value;renderHome();});b.setAttribute('aria-pressed',String(mode===value));toggle.append(b);}
 $('#mode-note').textContent=mode==='demo'?'Offline demo · authored conversations and choices. Free replies need live AI. No API key needed.':config.hasKey?'Live AI · Japanese dialogue, free replies, and a story shaped by your words. Your API key stays on this computer.':'Live AI needs DEEPSEEK_API_KEY in .env. Restart the server after configuring it, or try Offline demo.';
 for(const [i,c] of CHARACTERS.entries()){
  const b=button('','character-card',()=>selectCharacter(c));b.setAttribute('aria-label',`Meet ${c.name}: ${c.trait}`);
  b.innerHTML=`<img src="/assets/characters/${c.id}.png" alt="Anime portrait of ${c.name}" fetchpriority="high"><span class="card-number">0${i+1}</span><span class="card-copy"><span class="trait">${c.trait}</span><h2>${c.name}<small>${c.japaneseName}</small></h2><p>${c.description}</p><span class="card-arrow">↗</span></span>`;$('.character-grid').append(b);
 }$('#garden-link').onclick=showGarden;header();
}
function selectCharacter(c){navigation();character=c;screen='scenes';header();app.innerHTML=`<section class="scenes"><div class="scene-poster"><img src="/assets/characters/${c.id}.png" alt="${c.name}"><strong>${c.name} <small>${c.japaneseName}</small></strong></div><div class="scene-copy"><span class="eyebrow">CHOOSE YOUR FIRST CHAPTER</span><h1>A moment with ${c.name}.</h1><p>${c.description}<br>Where will your story begin?</p><div class="scene-list"></div><button class="quiet" id="back-characters">← Meet someone else</button></div></section>`;
 for(const scene of c.scenes){const b=button('','scene-option',()=>startStory(c,scene));b.innerHTML=`<span class="number">0${scene.id+1}</span><span><strong>${scene.title}</strong><small>${scene.subtitle}</small></span>`;$('.scene-list').append(b);}$('#back-characters').onclick=home;
}
async function startStory(c,scene){
 if(busy)return;clearError();if(mode==='live'&&!config.hasKey){showError(new Error('Set DEEPSEEK_API_KEY in .env and restart the server, or choose Offline demo.'));return;}
 const token=++epoch;busy=true;screen='loading';header();app.innerHTML=`<section class="loading-page"><span class="eyebrow">A NEW CHAPTER</span><div class="spinner"></div><h1>Finding the first words…</h1><p>${c.name} is waiting. A scene is about to unfold.</p><button class="quiet" id="cancel-start">← Back to scenes</button></section>`;$('#cancel-start').onclick=()=>selectCharacter(c);
 try{const result=await api('start',{characterId:c.id,sceneId:scene.id,language,mode});if(token!==epoch){api('close',{id:result.id}).catch(()=>{});return;}story=result;screen='story';typed='';renderStory();}
 catch(e){if(token===epoch){selectCharacter(c);showError(e,()=>startStory(c,scene));}}
 finally{if(token===epoch){busy=false;setBusy(false);}}
}
function activeLine(){return story.stage==='player'?story.playerLine:story.line;}
function renderStory({keepTyped=false}={}){
 if(!keepTyped)typed='';clearError();screen='story';header();const c=getCharacter(story.characterId),scene=c.scenes[story.sceneId];
 app.innerHTML=`<section class="story"><div class="backdrop">${scenery(scene.background)}</div><div class="scene-meta"><span class="eyebrow">${c.name.toUpperCase()}’S STORY · 0${scene.id+1}</span><h1>${scene.title}</h1><p>${scene.subtitle}</p></div><div class="story-status"><span>${phaseFor(story.turn).toUpperCase()} · ${String(story.turn+1).padStart(2,'0')}</span>${story.mode==='demo'?'<span class="demo-badge">OFFLINE DEMO</span>':''}</div><div class="portrait" role="img" aria-label="${c.name}"></div><span class="expression-label"></span><div class="choices"></div><div class="story-dock"><section class="dialogue-box" aria-label="Dialogue"><div class="speaker"></div><div class="jp-dialogue" lang="ja"></div><p class="translation"></p><div class="dialogue-foot"><span>灯りの物語</span><span>Listen with your eyes. Answer with your hands.</span></div></section><div id="interaction"></div></div></section>`;
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
 if(story.mode==='demo'&&story.stage==='reply')holder.lastChild.textContent='Authored demo · choose a reply to try the complete learning loop.';
}
function renderPractice(line){
 $('#interaction').innerHTML=`<section class="practice-box" aria-label="Romaji practice"><div class="practice-head"><span class="eyebrow">${story.stage==='player'?'SAY IT IN JAPANESE':'MAKE THE WORDS YOURS'}</span><button class="quiet" id="hint-button"></button></div><div class="chunks"></div><label class="sr-only" for="romaji-input">Type the romaji for the Japanese sentence</label><input class="practice-input" id="romaji-input" placeholder="Type the romaji…" autocomplete="off" autocapitalize="off" spellcheck="false" inputmode="text"><div class="practice-bottom"><small id="practice-progress"></small><button class="primary" id="continue-button">${story.stage==='player'?'Send reply':'Continue'} <kbd>↵</kbd></button></div>${story.stage==='player'?'<button class="quiet" id="edit-reply">← Edit your words</button>':''}</section>`;
 const chunks=$('.chunks');for(const ch of line.chunks){const n=el('span','chunk');n.append(el('span','jp',ch.japanese),el('span','latin'));chunks.append(n);}
 const input=$('#romaji-input');input.value=typed;input.onpaste=e=>{e.preventDefault();toast('Type each letter yourself. That is how the words stay with you.');};input.ondrop=e=>e.preventDefault();input.oninput=()=>{
  const value=normalizeInput(input.value);if(line.romaji.startsWith(value)&&/^[a-z]*$/.test(value)){typed=value;input.value=typed;updateProgress();}else{input.value=typed;input.classList.remove('error');void input.offsetWidth;input.classList.add('error');if(/[^a-z]/.test(value))toast('Switch to an English keyboard to type romaji.');}
 };input.onkeydown=e=>{if(e.key==='Enter'&&!e.isComposing){e.preventDefault();advance();}if(e.key==='Tab'){e.preventDefault();hints=!hints;updateProgress();}};
 $('#hint-button').onclick=()=>{hints=!hints;updateProgress();};$('#continue-button').onclick=advance;
 if($('#edit-reply'))$('#edit-reply').onclick=()=>storyAction('edit');
 updateProgress();if(!busy)requestAnimationFrame(()=>input.focus({preventScroll:true}));
}
function updateProgress(){
 if(!story||!$('#romaji-input'))return;const line=activeLine(),nodes=$$('.chunk');let active=-1;
 line.chunks.forEach((ch,i)=>{
  const n=nodes[i],done=completedChunk(ch,typed.length),on=!!ch.romaji&&!done&&active<0;if(on)active=i;n.classList.toggle('done',done);n.classList.toggle('active',on);
  const latin=n.querySelector('.latin');latin.replaceChildren();const count=Math.max(0,Math.min(ch.romaji.length,typed.length-ch.start));latin.append(el('span','typed',ch.romaji.slice(0,count)),document.createTextNode(hints?ch.romaji.slice(count):ch.romaji?'·'.repeat(ch.romaji.length-count):''));
 });for(const n of $$('.jp-part'))n.classList.toggle('done',completedChunk({romaji:n.dataset.romaji,start:Number(n.dataset.start),end:Number(n.dataset.end)},typed.length));
 if(active>=0)nodes[active]?.scrollIntoView({block:'nearest',inline:'nearest'});
 $('#practice-progress').textContent=typed.length===line.romaji.length?'✓ Ready when you are':`${typed.length} / ${line.romaji.length} letters · no paste`;
 $('#continue-button').disabled=busy||typed!==line.romaji;$('#hint-button').textContent=hints?'Hide hints ⇥':'Show hints ⇥';
}
function $$(s){return [...document.querySelectorAll(s)];}
async function advance(){if(!story||busy||typed!==activeLine().romaji)return;await storyAction(story.stage==='player'?'send':'read',{romaji:typed});}
function renderComposer(){
 $('#interaction').innerHTML=`<section class="composer" aria-label="Your reply"><div class="practice-head"><label class="eyebrow" for="reply-input">YOUR WORDS, YOUR LANGUAGE</label></div><textarea id="reply-input" placeholder="What would you like to say?"></textarea><div class="composer-footer"><span id="reply-count">0 / 160</span><button class="primary" id="translate-button">Translate & practice →</button></div><p class="muted">First, find your words. Then learn to say them in Japanese.</p></section>`;
 const input=$('#reply-input');input.value=story.draft;input.disabled=story.mode==='demo';if(input.disabled)input.placeholder='Free replies need Live story. Try a choice above.';
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
 $('.choices').replaceChildren();const label={good:'A light to return to',hidden:'Between the lines',bad:'A different goodbye'}[story.line.ending];const n=el('section','ending');n.append(el('div','seal','結'),el('span','eyebrow',`${story.line.ending.toUpperCase()} ENDING`),el('h2','',label),el('p','',story.mode==='demo'?'An authored demo ending. In Live story, your own words decide how the chapter closes.':`A chapter with ${c.name}, shaped by the words you chose to share.`),button('Begin another chapter →','primary',()=>selectCharacter(c)),button('Read our journal','quiet',openJournal));$('.story').append(n);
}
function openJournal(){if(!story)return;const entries=$('#journal-entries');entries.replaceChildren();for(const item of story.journal){const entry=el('div','journal-entry');entry.append(el('strong','',item.speaker),el('p','',item.japanese),el('small','',item.translation));entries.append(entry);}$('#journal').showModal();}
function showGarden(){navigation();screen='garden';header();renderGardenSetup();}
function renderGardenSetup(){
 app.innerHTML=`<section class="garden-screen"><div class="garden-header"><span class="eyebrow">THE LANTERN GARDEN</span><h1>Small words. A warmer world.</h1><p class="muted">Every word lights a lantern. Twelve little lights, one quiet moment.</p></div><div class="garden-stage">${gardenArt(0)}<div class="garden-word"><h2>灯り</h2><p>akari · a little light</p></div></div><div class="garden-panel"><div class="garden-controls"><label>Words <select id="garden-category"><option value="nature">Nature · 18 words</option><option value="everyday">Everyday · 18 words</option><option value="greetings">Greetings · 12 words</option></select></label><label>Mode <select id="garden-mode"><option value="practice">Quiet practice</option><option value="challenge">90-second challenge</option></select></label><button class="primary" id="garden-start">Light the first lantern →</button></div><p class="muted" style="text-align:center;margin:22px 0 0">48 words · alternate spellings accepted · no API needed</p></div></section>`;
 $('#garden-category').value=gardenCategory;$('#garden-mode').value=gardenChallenge?'challenge':'practice';$('#garden-start').onclick=()=>{gardenCategory=$('#garden-category').value;gardenChallenge=$('#garden-mode').value==='challenge';garden=gardenRound(gardenCategory,gardenChallenge);gardenTime=performance.now();renderGardenRound();};
}
function renderGardenRound(){
 const s=garden;app.innerHTML=`<section class="garden-screen"><div class="garden-header"><span class="eyebrow">THE LANTERN GARDEN · ${gardenCategory.toUpperCase()}</span><h1>${s.done?'Look how far you’ve come.':'One word at a time.'}</h1></div><div class="garden-stage"></div><div class="garden-panel"><div class="garden-stats"></div><div id="garden-interaction"></div></div></section>`;
 if(s.done){renderGardenResults();return;}
 $('#garden-interaction').innerHTML=`<label class="sr-only" for="garden-input">Type the romaji for this word</label><input class="practice-input" id="garden-input" placeholder="Type the romaji…" autocomplete="off" autocapitalize="off" spellcheck="false"><div class="practice-bottom"><small id="garden-feedback">Backspace to correct · Tab for hints</small><div><button class="quiet" id="garden-hint">Hide hints</button><button class="secondary" id="garden-pause">Pause</button></div></div><div class="garden-progress"></div>`;
 const input=$('#garden-input');input.onpaste=e=>{e.preventDefault();toast('Let your fingers do the learning. No paste in practice.');};input.ondrop=e=>e.preventDefault();input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();if(gardenCommit(s)){if(s.done)renderGardenRound();else updateGarden();}}if(e.key==='Backspace'){e.preventDefault();if(!s.paused){s.input=s.input.slice(0,-1);input.value=s.input;updateGarden();}}if(e.key==='Tab'){e.preventDefault();hints=!hints;updateGarden();}};
 input.oninput=()=>{const value=normalizeInput(input.value);if(value.startsWith(s.input)){const previous=s.wrong;gardenType(s,value.slice(s.input.length));if(s.wrong>previous){input.classList.remove('error');void input.offsetWidth;input.classList.add('error');}}input.value=s.input;if(s.done)renderGardenRound();else updateGarden();};
 $('#garden-hint').onclick=()=>{hints=!hints;updateGarden();};$('#garden-pause').onclick=()=>{s.paused=!s.paused;gardenTime=performance.now();updateGarden();if(!s.paused)input.focus();};updateGarden();input.focus({preventScroll:true});
}
function updateGarden(){
 const s=garden;if(!s||s.done||!$('.garden-stage'))return;const w=s.words[s.index],guide=[w.romaji,...w.variants].find(v=>v.startsWith(s.input))??w.romaji;
 $('.garden-stage').innerHTML=gardenArt(s.index);const word=el('div','garden-word');word.append(el('h2','',s.paused?'ひと休み':w.kana),el('p','',s.paused?'A little pause. Your lanterns will wait.':w.meaning));if(hints&&!s.paused){const g=el('div','guide');g.append(el('span','typed',guide.slice(0,s.input.length)),document.createTextNode(guide.slice(s.input.length)));word.append(g);}$('.garden-stage').append(word);renderGardenStats();$('.garden-progress').replaceChildren();for(let i=0;i<12;i++)$('.garden-progress').append(el('i',i<s.index?'lit':''));$('#garden-input').disabled=s.paused;$('#garden-input').value=s.input;$('#garden-feedback').textContent=[w.romaji,...w.variants].includes(s.input)?'Press Enter to light this lantern, or finish the longer spelling.':'Backspace to correct · Tab for hints';$('#garden-pause').textContent=s.paused?'Resume':'Pause';$('#garden-hint').textContent=hints?'Hide hints':'Show hints';
}
function renderGardenStats(){const s=garden,stats=gardenStats(s);$('.garden-stats').replaceChildren();for(const [label,value] of [['Lanterns',`${s.index}/12`],['Score',s.score],['Accuracy',`${stats.accuracy}%`],['Streak',s.streak],['KPM',stats.kpm],['Time',s.challenge?`${Math.ceil(s.remaining/1000)}s`:`${Math.floor(s.elapsed/1000)}s`]]){const span=el('span','',label);span.append(el('strong','',String(value)));$('.garden-stats').append(span);}}
function renderGardenResults(){
 const s=garden;$('.garden-stage').innerHTML=gardenArt(s.index);const w=el('div','garden-word');w.append(el('h2','',s.index===12?'おめでとう':'おつかれさま'),el('p','',s.index===12?'Every lantern is glowing.':'A good day’s practice.'));$('.garden-stage').append(w);renderGardenStats();const holder=$('#garden-interaction');holder.replaceChildren();holder.append(el('span','eyebrow','THE WORDS YOU LIT'));const review=el('div','garden-review');for(const w of s.review){const row=el('div');row.append(el('span','',w.kana),el('span','',w.typed),el('span','',w.meaning));review.append(row);}holder.append(review);const controls=el('div','garden-controls');controls.append(button('Another twelve →','primary',()=>{garden=gardenRound(gardenCategory,gardenChallenge);gardenTime=performance.now();renderGardenRound();}),button('Change practice','secondary',renderGardenSetup));holder.append(controls);
}
setInterval(()=>{if(!garden||screen!=='garden'||garden.done)return;const now=performance.now();gardenTick(garden,now-gardenTime);gardenTime=now;if(garden.done)renderGardenRound();else renderGardenStats();},200);
$('#brand').onclick=home;$('#home-button').onclick=home;$('#journal-button').onclick=openJournal;$('#close-journal').onclick=()=>$('#journal').close();
window.addEventListener('keydown',e=>{
 if(e.key==='Escape'&&!$('#journal').open&&screen!=='home'){if(screen==='garden'&&garden&&!garden.done){garden.paused=!garden.paused;gardenTime=performance.now();updateGarden();}else home();return;}
 if($('#journal').open||e.isComposing||/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName))return;
 if(e.key.toLowerCase()==='j'&&story){e.preventDefault();openJournal();}
 if(/^[1-3]$/.test(e.key)&&story?.stage==='reply'&&!busy){e.preventDefault();translateReply(story.line.choices[Number(e.key)-1].text);}
});
window.addEventListener('pagehide',()=>{if(story)fetch('/api/story/close',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:story.id}),keepalive:true}).catch(()=>{});});
try{const r=await fetch('/api/config');if(!r.ok)throw new Error();config=await r.json();mode=config.hasKey?'live':'demo';}catch{toast('Cannot reach the local server. Start it with run.sh or run.bat.');}renderHome();
