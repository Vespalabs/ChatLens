const el=id=>document.getElementById(id);
const status=msg=>el('account-status').textContent=msg;
try {
 const {createClient}=await import('https://esm.sh/@supabase/supabase-js@2.89.0');
 const client=createClient('https://jncvvbaaazwrjklaxzts.supabase.co','sb_publishable_yMW55RrzHiYe9kR-9uG-tQ_Rjccs6nL');
 const form=el('account-form'), logout=el('account-logout');
 function render(session){
  form.hidden=!!session; logout.hidden=!session;
  el('account-email-display').textContent=session?.user?.email||'';
  status(session?'Signed in. Basic analysis remains free.':'Sign in or create an optional account.');
 }
 const {data,error}=await client.auth.getSession();
 if(error) throw error;
 render(data.session);
 client.auth.onAuthStateChange((_event,session)=>render(session));
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
