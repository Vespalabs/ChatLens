const el=id=>document.getElementById(id);
const status=msg=>el('account-status').textContent=msg;
try {
 const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.89.0');
 const client=createClient('https://jncvvbaaazwrjklaxzts.supabase.co','sb_publishable_yMW55RrzHiYe9kR-9uG-tQ_Rjccs6nL',{auth:{storage:{getItem(k){return sessionStorage.getItem(k)??localStorage.getItem(k)},setItem(k,v){const persistent=el('remember-login')?.checked||!!localStorage.getItem('chatlens-remember-email');const target=persistent?localStorage:sessionStorage,other=persistent?sessionStorage:localStorage;target.setItem(k,v);other.removeItem(k)},removeItem(k){sessionStorage.removeItem(k);localStorage.removeItem(k)}}}});
 const form=el('account-form'), logout=el('account-logout');const remember=el('remember-login');try{const saved=localStorage.getItem('chatlens-remember-email');if(saved){el('account-email').value=saved;remember.checked=true}}catch{}remember.onchange=()=>{if(!remember.checked)try{localStorage.removeItem('chatlens-remember-email')}catch{}};
 const reset=document.createElement('form');
 reset.hidden=true;
 reset.innerHTML='<label>New password <input type="password" id="new-password" autocomplete="new-password" minlength="8" required></label><label>Confirm new password <input type="password" id="confirm-password" autocomplete="new-password" minlength="8" required></label><button type="submit">Reset password</button>';
 logout.before(reset);
 const forgot=document.createElement('button');
 forgot.type='button';forgot.className='forgot-link';forgot.textContent='Forgot password?';form.append(forgot);
 let recovery=false,planRequest=0;
 function showPlan(session){
  const target=el('account-plan');if(!target)return;
  const ticket=++planRequest;target.textContent=session?'Checking account plan…':'';
  if(!session)return;
  setTimeout(async()=>{try{const {data,error}=await client.from('entitlements').select('plan').eq('user_id',session.user.id).maybeSingle();if(error)throw error;if(ticket===planRequest)target.textContent=data?.plan==='premium'?'Current plan: Free (paid features locked)':'Current plan: Free';}catch{if(ticket===planRequest)target.textContent='Account plan temporarily unavailable. Please try again later.';}},0);
 }

 const dashboard=document.createElement('section');
 dashboard.hidden=true;
 dashboard.innerHTML='<h3>My Account</h3><div class="tabs" role="group" aria-label="Account sections"></div><div class="account-panel"></div>';
 logout.before(dashboard);
 const tabs=dashboard.querySelector('.tabs'),panel=dashboard.querySelector('.account-panel');
 let accountUser=null,activeTab='Overview';
 const storageKey=()=> 'chatlens-reports:'+accountUser;
 const readReports=()=>{try{return JSON.parse(localStorage.getItem(storageKey())||'[]')}catch{return []}};
 const encode=b=>{let x='';for(const v of new Uint8Array(b))x+=String.fromCharCode(v);return btoa(x)};
 const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 async function derive(pass,salt){const material=await crypto.subtle.importKey('raw',new TextEncoder().encode(pass),'PBKDF2',false,['deriveKey']);return crypto.subtle.deriveKey({name:'PBKDF2',salt,iterations:600000,hash:'SHA-256'},material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])}
 async function encryptReport(file,pass){const salt=crypto.getRandomValues(new Uint8Array(16)),iv=crypto.getRandomValues(new Uint8Array(12));const key=await derive(pass,salt);return {v:1,salt:encode(salt),iv:encode(iv),cipher:encode(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,await file.arrayBuffer()))}}
 async function downloadReport(record,user){if(accountUser!==user)return;if(!record.cipher){alert('This older report is unencrypted. Download it only on a trusted device.');const a=document.createElement('a');a.href=record.pdf;a.download='ChatLens-report.pdf';a.click();return}const pass=prompt('Enter this report’s encryption passphrase');if(!pass)return;try{const key=await derive(pass,decode(record.salt));const bytes=await crypto.subtle.decrypt({name:'AES-GCM',iv:decode(record.iv)},key,decode(record.cipher));if(accountUser!==user)return;const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));const a=document.createElement('a');a.href=url;a.download='ChatLens-report.pdf';a.click();setTimeout(()=>URL.revokeObjectURL(url),60000)}catch{alert('Unable to unlock report. Check your passphrase.')}}
 function drawAccount(){
  dashboard.hidden=!accountUser||recovery;
  if(dashboard.hidden){panel.replaceChildren();return;}
  for(const b of tabs.children)b.classList.toggle('active',b.textContent===activeTab);
  panel.replaceChildren();
  const p=t=>{const x=document.createElement('p');x.textContent=t;panel.append(x);return x};
  const button=(t,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=fn;panel.append(b);return b};
  if(activeTab==='Overview'){p('Your account and plan are shown above. Three free analyses per account.');p('Saved reports: '+readReports().length+' on this browser.');const user=accountUser;const purchases=p('Checking purchases…');setTimeout(async()=>{try{const {data,error}=await client.from('chatlens_purchases').select('product,active,test_mode,created_at').eq('user_id',user).order('created_at',{ascending:false}).limit(100);if(!purchases.isConnected||accountUser!==user)return;if(error)throw error;purchases.textContent='Verified sandbox purchases: '+data.filter(x=>x.test_mode).length+' · Active live purchases: '+data.filter(x=>!x.test_mode&&x.active).length;}catch{if(purchases.isConnected)purchases.textContent='Purchase records unavailable.';}},0);}
  if(activeTab==='My Reports'){
   p('Reports are saved only when you choose Save to My Reports. New reports are encrypted with a passphrase on this browser, not in the cloud. Older reports may be unencrypted; delete and recreate them if needed. Lost passphrases cannot be recovered.');
   const records=readReports();if(!records.length)p('No saved reports on this device.');
   for(const record of records){p('Report · '+new Date(record.date).toLocaleString());p(record.cipher?'Encrypted report':'Legacy unencrypted report');const owner=accountUser;button('Download PDF',()=>downloadReport(record,owner));button('Delete report',()=>{try{localStorage.setItem(storageKey(),JSON.stringify(readReports().filter(x=>x.id!==record.id)));drawAccount()}catch{p('Unable to delete report.')}});}
  }
  if(activeTab==='Payment History'){
   p('Sandbox transactions only. No real charges.');const user=accountUser;const loading=p('Loading transactions…');
   setTimeout(async()=>{try{const {data,error}=await client.from('chatlens_payments').select('razorpay_order_id,razorpay_payment_id,amount,currency,status,test_mode,created_at').eq('user_id',user).order('created_at',{ascending:false}).limit(100);if(!loading.isConnected||accountUser!==user)return;if(error)throw error;loading.textContent=data.length?'Latest transactions':'No transactions yet.';for(const item of data){p(new Date(item.created_at).toLocaleString()+' · '+item.currency+' '+(item.amount/100).toFixed(2)+' · '+item.status+' · '+(item.test_mode?'TEST':'LIVE'));p(item.razorpay_payment_id||item.razorpay_order_id);}}catch{if(loading.isConnected)loading.textContent='Unable to load transactions. Try again later.';}},0);
  }
  if(activeTab==='Help & Support'){p('File upload: export WhatsApp without media, accept privacy consent, and choose TXT or ZIP. If ZIP fails, extract it in Files first.');p('PDF: use Download PDF or Share PDF after analysis.');p('Billing: paid plans and checkout are currently disabled.');p('Do not include private chats, passwords or payment secrets in support requests.');
   const user=accountUser;
   const subject=document.createElement('input');subject.placeholder='Subject';subject.maxLength=150;subject.setAttribute('aria-label','Support subject');
   const category=document.createElement('select');category.setAttribute('aria-label','Support category');for(const name of ['general','technical','billing','refund','privacy'])category.add(new Option(name,name));
   const message=document.createElement('textarea');message.placeholder='Describe your issue';message.maxLength=3000;message.rows=4;message.setAttribute('aria-label','Support message');
   panel.append(subject,category,message);
   const feedback=p('');
   const send=button('Submit support ticket',async()=>{if(accountUser!==user||!subject.value.trim()||!message.value.trim()){feedback.textContent='Enter a subject and message.';return;}send.disabled=true;try{const {error}=await client.from('chatlens_support').insert({subject:subject.value.trim(),category:category.value,message:message.value.trim()});if(error)throw error;if(accountUser===user&&feedback.isConnected){drawAccount();p('Support ticket submitted.');}}catch{feedback.textContent='Unable to submit ticket. Try again later.';}finally{send.disabled=false;}});
   const loading=p('Loading your tickets…');
   setTimeout(async()=>{try{const {data,error}=await client.from('chatlens_support').select('id,subject,category,status,admin_reply,created_at').eq('user_id',user).order('created_at',{ascending:false}).limit(50);if(!loading.isConnected||accountUser!==user)return;if(error)throw error;loading.textContent=data.length?'Your support tickets':'No support tickets yet.';for(const t of data){p(t.subject+' · '+t.status+' · '+new Date(t.created_at).toLocaleString());if(t.admin_reply)p('Support reply: '+t.admin_reply);}}catch{if(loading.isConnected)loading.textContent='Unable to load tickets.';}},0);}
  if(activeTab==='Security'){p('Connection: '+(location.protocol==='https:'?'HTTPS':'Not HTTPS'));p('Chat analysis stays on your device. New saved reports use AES-256-GCM with a passphrase. Older reports may be unencrypted.');p('Downloaded and shared PDFs are not encrypted. Account MFA and self-service account deletion are not yet enabled.');button('Request account deletion',()=>{activeTab='Help & Support';drawAccount();p('Choose privacy and request account deletion. Do not include passwords.');});}if(activeTab==='Settings'){p('Use Forgot password on the sign-in screen to reset your password.');button('Delete all saved reports on this device',()=>{if(confirm('Delete your saved reports from this browser?')){try{localStorage.removeItem(storageKey());drawAccount()}catch{p('Unable to delete reports.')}}});}
 }
 for(const name of ['Overview','My Reports','Payment History','Help & Support','Settings','Security']){const b=document.createElement('button');b.type='button';b.innerHTML='<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({"Security":"<path d='M12 3l8 3v6c0 5-4 8-8 10-4-2-8-5-8-10V6z'/>","Overview":"<rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/>","My Reports":"<path d='M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6'/>","Payment History":"<rect x='3' y='5' width='18' height='14' rx='3'/><path d='M3 10h18 M7 15h4'/>","Help & Support":"<circle cx='12' cy='12' r='9'/><path d='M9 9a3 3 0 1 1 4 3c-1 1-1 2-1 2 M12 17h.01'/>","Settings":"<circle cx='12' cy='12' r='3'/><path d='M12 2v4 M12 18v4 M2 12h4 M18 12h4 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3'/>"})[name]+'</svg><span>'+name+'</span>';b.onclick=()=>{activeTab=name;drawAccount()};tabs.append(b)}
 window.addEventListener('chatlens-save-report',async e=>{
  const user=accountUser,notify=e.detail.notify;if(!user||recovery){notify('Sign in to save a report.');return;}
  const pass=prompt('Choose a report encryption passphrase (at least 12 characters). It cannot be recovered.');if(!pass)return;if(pass.length<12){notify('Use at least 12 characters.');return;}if(prompt('Confirm report encryption passphrase')!==pass){notify('Passphrases do not match.');return;}
  try{const encrypted=await encryptReport(e.detail.file,pass);if(accountUser!==user)return;const records=readReports();records.unshift({id:crypto.randomUUID(),date:Date.now(),...encrypted});localStorage.setItem(storageKey(),JSON.stringify(records));drawAccount();notify('Encrypted and saved to My Reports on this device.');}catch{notify('Unable to save report. Browser storage may be full.');}
 });
 const redirectTo='https://vespalabs.github.io/ChatLens/';
 forgot.addEventListener('click',async()=>{
  const field=el('account-email');
  if(!field.reportValidity()){field.focus();status('Enter your account email to receive a password reset link.');return;}
  forgot.disabled=true;
  try{
   const {error}=await client.auth.resetPasswordForEmail(field.value.trim(),{redirectTo});
   if(error)throw error;
   status('If an account exists for this email, a reset link will be sent.');
  }catch{status('Unable to request a reset right now. Please try again later.');}
  finally{forgot.disabled=false;}
 });
 reset.addEventListener('submit',async e=>{
  e.preventDefault();
  const p=el('new-password').value;
  if(p!==el('confirm-password').value){status('Passwords do not match.');return;}
  const b=reset.querySelector('button');b.disabled=true;
  try{
   const {error}=await client.auth.updateUser({password:p});
   if(error)throw error;
   reset.reset();recovery=false;
   const result=await client.auth.signOut();
   if(result.error)throw result.error;
   render(null);status('Password updated. Sign in with your new password.');
  }catch(err){status(err.message||'Unable to reset password.');}
  finally{b.disabled=false;}
 });
 let quotaEpoch=0;
 async function refreshQuota(){const epoch=++quotaEpoch,user=accountUser,target=el('quota-status');if(!user||recovery){target.textContent='Sign in to unlock three free analyses.';return;}target.textContent='Checking allowance…';try{const {data,error}=await client.from('chatlens_usage').select('used').eq('user_id',user).maybeSingle();if(error)throw error;if(epoch===quotaEpoch)target.textContent=(3-(data?.used||0))+' of 3 free analyses remaining';}catch{if(epoch===quotaEpoch)target.textContent='Allowance unavailable. Please try again later.';}}
 window.chatlensAnalysisOwner=()=>recovery?null:accountUser;
 window.chatlensCanAnalyse=()=>!!accountUser&&!recovery;
 window.chatlensConsumeAnalysis=async()=>{const user=accountUser;if(!user||recovery)throw Error('Sign in to analyse your chat.');const {data,error}=await client.rpc('chatlens_consume_analysis');if(error)throw Error('Unable to verify analysis allowance. Try again later.');if(user!==accountUser||recovery)throw Error('Account changed. Sign in again.');await refreshQuota();if(data===-1)throw Error('All three free analyses have been used. Premium is coming soon.');if(!Number.isInteger(data)||data<0||data>2)throw Error('Invalid allowance response.');return data;};
 function render(session){
  form.hidden=!!session||recovery; logout.hidden=!session||recovery; reset.hidden=!session||!recovery;
  const nextUser=session?.user?.id||null;if(accountUser!==nextUser){el('out')?.replaceChildren();if(el('file'))el('file').value='';if(el('file-info'))el('file-info').textContent='';if(el('status'))el('status').textContent='Waiting for a file.';}accountUser=nextUser;drawAccount();setTimeout(()=>void refreshQuota(),0);
  showPlan(recovery?null:session);
  if(recovery&&session){status('Enter and confirm your new password.');return;}
  el('account-email-display').textContent=session?.user?.email||'';
  status(session?'Signed in. Three free analyses per account.':'Sign in or create an account to analyse chats.');
 }
 client.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY')recovery=true;if(event==='SIGNED_OUT')recovery=false;render(session);});
 const {data,error}=await client.auth.getSession();
 if(error) throw error;
 render(data.session);

 form.addEventListener('submit',async e=>{
  e.preventDefault();
  const signup=e.submitter?.value==='signup';
  const email=el('account-email').value.trim(),password=el('account-password').value;
  const buttons=form.querySelectorAll('button');buttons.forEach(b=>b.disabled=true);
  try {
   try{if(remember.checked)localStorage.setItem('chatlens-remember-email',email);else localStorage.removeItem('chatlens-remember-email')}catch{}
   const result=signup?await client.auth.signUp({email,password,options:{emailRedirectTo:'https://vespalabs.github.io/ChatLens/'}}):await client.auth.signInWithPassword({email,password});
   if(result.error) throw result.error;
   el('account-password').value='';
   if(signup&&!result.data.session)status('Check your email for a confirmation link.');
   else render(result.data.session);
  }catch(err){status(err.message||'Authentication failed. Try again.');}
  finally{buttons.forEach(b=>b.disabled=false);}
 });
 logout.addEventListener('click',async()=>{try{const {error}=await client.auth.signOut();if(error)throw error;render(null);}catch(err){status(err.message||'Sign out failed.');}});
}catch{status('Account service unavailable. Sign in is required for analysis.');}
