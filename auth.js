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
  setTimeout(async()=>{try{const {data,error}=await client.from('entitlements').select('plan').eq('user_id',session.user.id).maybeSingle();if(error)throw error;if(ticket===planRequest)target.textContent=data?.plan==='premium'?'Current plan: Premium (paid features not yet available)':'Current plan: Free';}catch{if(ticket===planRequest)target.textContent='Account plan temporarily unavailable. Free analysis is still available.';}},0);
 }

 const premiumCard=[...document.querySelectorAll('h3')].find(x=>x.textContent.trim()==='Premium report')?.parentElement;
 if(premiumCard){
 const pay=document.createElement('button');pay.type='button';pay.textContent='Test checkout — ₹99';
 const result=document.createElement('p');result.setAttribute('role','status');result.textContent='Sandbox only. No real charges or premium access.';
 premiumCard.append(pay,result);
 pay.onclick=async()=>{
 pay.disabled=true;
 try{
 const {data:{session},error}=await client.auth.getSession();
 if(error||!session){result.textContent='Sign in to ChatLens first.';return;}
 result.textContent='Creating test order…';
 const {data,error:orderError}=await client.functions.invoke('razorpay-create-order',{body:{}});
 if(orderError){let msg=orderError.message;try{msg=(await orderError.context.json()).error||msg}catch{}throw new Error(msg);}
 if(!data?.success||!data.key_id?.startsWith('rzp_test_')||data.amount!==9900||data.currency!=='INR'||!data.order_id)throw new Error('Unexpected test order response');
 if(!window.Razorpay)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://checkout.razorpay.com/v1/checkout.js';s.onload=resolve;s.onerror=()=>reject(new Error('Checkout could not load'));document.head.append(s)});
 result.textContent='Test order created. Opening sandbox checkout.';
 const checkout=new window.Razorpay({key:data.key_id,amount:data.amount,currency:data.currency,order_id:data.order_id,name:'Vespa Labs',description:'ChatLens test report — no real charge',handler:async response=>{result.textContent='Verifying sandbox payment…';try{const {data:verified,error}=await client.functions.invoke('razorpay-verify-payment',{body:{razorpay_order_id:data.order_id,razorpay_payment_id:response.razorpay_payment_id,razorpay_signature:response.razorpay_signature}});if(error||!verified?.verified||!verified.test_mode)throw Error('Verification pending or unsuccessful. Check Payment History before retrying.');result.textContent='Sandbox payment verified. No real charge or premium access.';if(activeTab==='Payment History')drawAccount();}catch(e){result.textContent=e.message;}},modal:{ondismiss:()=>{pay.disabled=false;}}});
 checkout.on('payment.failed',()=>{result.textContent='Test payment failed. No premium access granted.';});
 checkout.open();
 }catch(e){result.textContent=e.message||'Test checkout unavailable.';}
 finally{pay.disabled=false;}
 };
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
  if(activeTab==='Overview'){p('Your account and plan are shown above. Basic analysis remains free.');p('Saved reports: '+readReports().length+' on this browser.');}
  if(activeTab==='My Reports'){
   p('Reports are saved only when you choose Save to My Reports. They remain on this browser, not in the cloud. Anyone with access to this browser storage may access them.');
   const records=readReports();if(!records.length)p('No saved reports on this device.');
   for(const record of records){p('Report · '+new Date(record.date).toLocaleString());button('Download PDF',()=>{const a=document.createElement('a');a.href=record.pdf;a.download='ChatLens-report.pdf';a.click()});button('Delete report',()=>{try{localStorage.setItem(storageKey(),JSON.stringify(readReports().filter(x=>x.id!==record.id)));drawAccount()}catch{p('Unable to delete report.')}});}
  }
  if(activeTab==='Payment History'){
   p('Sandbox transactions only. No real charges.');const user=accountUser;const loading=p('Loading transactions…');
   setTimeout(async()=>{try{const {data,error}=await client.from('chatlens_payments').select('razorpay_order_id,razorpay_payment_id,amount,currency,status,test_mode,created_at').eq('user_id',user).order('created_at',{ascending:false}).limit(100);if(!loading.isConnected||accountUser!==user)return;if(error)throw error;loading.textContent=data.length?'Latest transactions':'No transactions yet.';for(const item of data){p(new Date(item.created_at).toLocaleString()+' · '+item.currency+' '+(item.amount/100).toFixed(2)+' · '+item.status+' · '+(item.test_mode?'TEST':'LIVE'));p(item.razorpay_payment_id||item.razorpay_order_id);}}catch{if(loading.isConnected)loading.textContent='Unable to load transactions. Try again later.';}},0);
  }
  if(activeTab==='Help & Support'){p('File upload: export WhatsApp without media, accept privacy consent, and choose TXT or ZIP. If ZIP fails, extract it in Files first.');p('PDF: use Download PDF or Share PDF after analysis.');p('Billing: checkout is test-only. Live billing and refund support are not yet available.');p('Support contact and ticket submission are pending. Do not share private chats or payment secrets.');}
  if(activeTab==='Settings'){p('Use Forgot password on the sign-in screen to reset your password.');button('Delete all saved reports on this device',()=>{if(confirm('Delete your saved reports from this browser?')){try{localStorage.removeItem(storageKey());drawAccount()}catch{p('Unable to delete reports.')}}});}
 }
 for(const name of ['Overview','My Reports','Payment History','Help & Support','Settings']){const b=document.createElement('button');b.type='button';b.textContent=name;b.onclick=()=>{activeTab=name;drawAccount()};tabs.append(b)}
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
