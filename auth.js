const el=id=>document.getElementById(id);
const status=msg=>el('account-status').textContent=msg;
try {
 const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.89.0');
 const client=createClient('https://jncvvbaaazwrjklaxzts.supabase.co','sb_publishable_yMW55RrzHiYe9kR-9uG-tQ_Rjccs6nL');
 const form=el('account-form'), logout=el('account-logout');
 const reset=document.createElement('form');
 reset.hidden=true;
 reset.innerHTML='<label>New password <input type="password" id="new-password" autocomplete="new-password" minlength="8" required></label><label>Confirm new password <input type="password" id="confirm-password" autocomplete="new-password" minlength="8" required></label><button type="submit">Reset password</button>';
 logout.before(reset);
 const forgot=document.createElement('button');
 forgot.type='button';forgot.textContent='Forgot password?';form.append(forgot);
 let recovery=false,planRequest=0;
 function showPlan(session){
  const target=el('account-plan');if(!target)return;
  const ticket=++planRequest;target.textContent=session?'Checking account plan…':'';
  if(!session)return;
  setTimeout(async()=>{try{const {data,error}=await client.from('entitlements').select('plan').eq('user_id',session.user.id).maybeSingle();if(error)throw error;if(ticket===planRequest)target.textContent=data?.plan==='premium'?'Current plan: Free (paid features locked)':'Current plan: Free';}catch{if(ticket===planRequest)target.textContent='Account plan temporarily unavailable. Free analysis is still available.';}},0);
 }

 const dashboard=document.createElement('section');
 dashboard.hidden=true;
 dashboard.innerHTML='<h3>My Account</h3><div class="tabs" role="group" aria-label="Account sections"></div><div class="account-panel"></div>';
 logout.before(dashboard);
 const tabs=dashboard.querySelector('.tabs'),panel=dashboard.querySelector('.account-panel');
 let accountUser=null,activeTab='Overview';
 const storageKey=()=> 'chatlens-reports:'+accountUser;
 const readReports=()=>{try{return JSON.parse(localStorage.getItem(storageKey())||'[]')}catch{return []}};
 function drawAccount(){
  dashboard.hidden=!accountUser||recovery;
  if(dashboard.hidden){panel.replaceChildren();return;}
  for(const b of tabs.children)b.classList.toggle('active',b.textContent===activeTab);
  panel.replaceChildren();
  const p=t=>{const x=document.createElement('p');x.textContent=t;panel.append(x);return x};
  const button=(t,fn)=>{const b=document.createElement('button');b.type='button';b.textContent=t;b.onclick=fn;panel.append(b);return b};
  if(activeTab==='Overview'){p('Your account and plan are shown above. Basic analysis remains free.');p('Saved reports: '+readReports().length+' on this browser.');const user=accountUser;const purchases=p('Checking purchases…');setTimeout(async()=>{try{const {data,error}=await client.from('chatlens_purchases').select('product,active,test_mode,created_at').eq('user_id',user).order('created_at',{ascending:false}).limit(100);if(!purchases.isConnected||accountUser!==user)return;if(error)throw error;purchases.textContent='Verified sandbox purchases: '+data.filter(x=>x.test_mode).length+' · Active live purchases: '+data.filter(x=>!x.test_mode&&x.active).length;}catch{if(purchases.isConnected)purchases.textContent='Purchase records unavailable.';}},0);}
  if(activeTab==='My Reports'){
   p('Reports are saved only when you choose Save to My Reports. They remain on this browser, not in the cloud. Anyone with access to this browser storage may access them.');
   const records=readReports();if(!records.length)p('No saved reports on this device.');
   for(const record of records){p('Report · '+new Date(record.date).toLocaleString());button('Download PDF',()=>{const a=document.createElement('a');a.href=record.pdf;a.download='ChatLens-report.pdf';a.click()});button('Delete report',()=>{try{localStorage.setItem(storageKey(),JSON.stringify(readReports().filter(x=>x.id!==record.id)));drawAccount()}catch{p('Unable to delete report.')}});}
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
  if(activeTab==='Settings'){p('Use Forgot password on the sign-in screen to reset your password.');button('Delete all saved reports on this device',()=>{if(confirm('Delete your saved reports from this browser?')){try{localStorage.removeItem(storageKey());drawAccount()}catch{p('Unable to delete reports.')}}});}
 }
 for(const name of ['Overview','My Reports','Payment History','Help & Support','Settings']){const b=document.createElement('button');b.type='button';b.innerHTML='<svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+({"Overview":"<rect x='3' y='3' width='7' height='7' rx='1'/><rect x='14' y='3' width='7' height='7' rx='1'/><rect x='3' y='14' width='7' height='7' rx='1'/><rect x='14' y='14' width='7' height='7' rx='1'/>","My Reports":"<path d='M6 3h8l4 4v14H6z M14 3v5h4 M9 12h6 M9 16h6'/>","Payment History":"<rect x='3' y='5' width='18' height='14' rx='3'/><path d='M3 10h18 M7 15h4'/>","Help & Support":"<circle cx='12' cy='12' r='9'/><path d='M9 9a3 3 0 1 1 4 3c-1 1-1 2-1 2 M12 17h.01'/>","Settings":"<circle cx='12' cy='12' r='3'/><path d='M12 2v4 M12 18v4 M2 12h4 M18 12h4 M5 5l3 3 M16 16l3 3 M5 19l3-3 M16 8l3-3'/>"})[name]+'</svg><span>'+name+'</span>';b.onclick=()=>{activeTab=name;drawAccount()};tabs.append(b)}
 window.addEventListener('chatlens-save-report',async e=>{
  const user=accountUser,notify=e.detail.notify;if(!user||recovery){notify('Sign in to save a report.');return;}
  if(!confirm('Save this private PDF in this browser? It is not encrypted by ChatLens.'))return;
  try{const reader=new FileReader();const pdf=await new Promise((resolve,reject)=>{reader.onload=()=>resolve(reader.result);reader.onerror=reject;reader.readAsDataURL(e.detail.file)});if(accountUser!==user)return;const records=readReports();records.unshift({id:crypto.randomUUID(),date:Date.now(),pdf});localStorage.setItem(storageKey(),JSON.stringify(records));drawAccount();notify('Saved to My Reports on this device.');}catch{notify('Unable to save report. Browser storage may be full.');}
 });
 const redirectTo='https://vespalabs.github.io/ChatLens/';
 forgot.addEventListener('click',async()=>{
  const field=el('account-email');
  if(!field.reportValidity()){field.focus();return;}
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
 function render(session){
  form.hidden=!!session||recovery; logout.hidden=!session||recovery; reset.hidden=!session||!recovery;
  accountUser=session?.user?.id||null;drawAccount();
  showPlan(recovery?null:session);
  if(recovery&&session){status('Enter and confirm your new password.');return;}
  el('account-email-display').textContent=session?.user?.email||'';
  status(session?'Signed in. Basic analysis remains free.':'Sign in or create an optional account.');
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
   const result=signup?await client.auth.signUp({email,password,options:{emailRedirectTo:'https://vespalabs.github.io/ChatLens/'}}):await client.auth.signInWithPassword({email,password});
   if(result.error) throw result.error;
   el('account-password').value='';
   if(signup&&!result.data.session)status('Check your email for a confirmation link.');
   else render(result.data.session);
  }catch(err){status(err.message||'Authentication failed. Try again.');}
  finally{buttons.forEach(b=>b.disabled=false);}
 });
 logout.addEventListener('click',async()=>{try{const {error}=await client.auth.signOut();if(error)throw error;render(null);}catch(err){status(err.message||'Sign out failed.');}});
}catch{status('Account service unavailable. You can still use local chat analysis.');}
