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
