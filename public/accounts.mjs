export async function request(route,data){
 const response=await fetch(route,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:data===undefined?{}:{'Content-Type':'application/json'},body:data===undefined?undefined:JSON.stringify(data)});
 const payload=await response.json();if(!response.ok){const error=new Error(payload.error??'Something went wrong. Please try again.');error.status=response.status;if(response.status===401&&(route.startsWith('/api/learn/')||route.startsWith('/api/tutor/')))window.dispatchEvent(new Event('lantern-auth-expired'));throw error;}return payload;
}
export function createAccountsUI(onChange){
 let user=null,busy=false,register=false;const modal=document.createElement('dialog');modal.id='account-dialog';document.body.append(modal);
 const header=document.querySelector('#account-button');
 function update(){header.textContent=user?user.username:'Sign in';}
 function render(){
  modal.innerHTML=`<div class="dialog-head"><div><span class="eyebrow">YOUR LITTLE CORNER</span><h2>${user?'Welcome back.':'Keep your place.'}</h2></div><button class="quiet" id="account-close">Close</button></div><div id="account-content"></div>`;
  modal.querySelector('#account-close').onclick=()=>modal.close();const content=modal.querySelector('#account-content');
  if(user){
   const text=document.createElement('p');text.textContent=`You’re signed in as ${user.username}. Your garden will remember where you left off.`;content.append(text);
   const out=document.createElement('button');out.className='secondary';out.textContent='Sign out';out.onclick=async()=>{if(busy)return;busy=true;out.disabled=true;try{await request('/api/account/logout',{});user=null;update();modal.close();onChange(user);}catch(e){error(e.message);}finally{busy=false;out.disabled=false;}};content.append(out);return;
  }
  content.innerHTML=`<p class="muted">A name, a password, and a garden that remembers.</p><form id="account-form"><label>Your name<input name="username" autocomplete="username" required minlength="3" maxlength="24" pattern="[a-zA-Z0-9_.-]+" placeholder="3–24 letters, numbers, . _ or -"></label><label>Password<input name="password" type="password" autocomplete="${register?'new-password':'current-password'}" required minlength="${register?'8':'1'}" maxlength="128" placeholder="${register?'At least 8 characters':'Your password'}"></label><p id="account-error" role="alert"></p><button class="primary" type="submit">${register?'Create my account':'Sign in'}</button></form><button class="quiet" id="account-toggle">${register?'Already have a garden? Sign in':'New here? Create an account'}</button>`;
  content.querySelector('#account-toggle').onclick=()=>{if(!busy){register=!register;render();}};
  content.querySelector('#account-form').onsubmit=async event=>{
   event.preventDefault();if(busy)return;const form=event.currentTarget,submit=form.querySelector('button');busy=true;submit.disabled=true;error('');
   try{const result=await request('/api/account/'+(register?'register':'login'),{username:form.elements.username.value,password:form.elements.password.value});user=result.user;form.elements.password.value='';update();modal.close();onChange(user);}catch(e){error(e.message);}finally{busy=false;submit.disabled=false;}
  };
 }
 function error(message){let target=modal.querySelector('#account-error');if(!target){target=document.createElement('p');target.id='account-error';target.setAttribute('role','alert');modal.querySelector('#account-content').append(target);}target.textContent=message;}
 function open(){register=false;render();if(!modal.open)modal.showModal();}
 window.addEventListener('lantern-auth-expired',()=>{if(user){user=null;update();onChange(user);}});
 modal.addEventListener('close',()=>{const password=modal.querySelector('input[type=password]');if(password)password.value='';});
 header.onclick=open;
 return {get user(){return user;},open,async init(){try{user=(await request('/api/account')).user;}catch{user=null;}update();}};
}
