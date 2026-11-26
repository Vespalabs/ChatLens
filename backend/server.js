import express from 'express';
import helmet from 'helmet';
import {rateLimit} from 'express-rate-limit';
import {createClient} from '@supabase/supabase-js';
const {SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, APP_ORIGIN, PORT=8080}=process.env;
if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY||!APP_ORIGIN) throw new Error('Missing deployment configuration');
const app=express();
app.disable('x-powered-by');
app.use(helmet());
app.use((req,res,next)=>{
  if(req.headers.origin===APP_ORIGIN){
    res.set('Access-Control-Allow-Origin',APP_ORIGIN);
    res.set('Access-Control-Allow-Headers','Authorization, Content-Type');
    res.set('Access-Control-Allow-Methods','GET, OPTIONS');
    res.vary('Origin');
  }
  if(req.method==='OPTIONS')return res.sendStatus(req.headers.origin===APP_ORIGIN?204:403);
  next();
});
app.use(rateLimit({windowMs:60000,limit:60}));
app.get('/health',(_,res)=>res.json({ok:true}));
app.get('/account',async(req,res)=>{
  res.set('Cache-Control','no-store');
  const token=req.headers.authorization?.match(/^Bearer (\S+)$/i)?.[1];
  if(!token)return res.sendStatus(401);
  try{
    const client=createClient(SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY,{auth:{persistSession:false,autoRefreshToken:false},global:{headers:{Authorization:'Bearer '+token}}});
    const {data:{user},error}=await client.auth.getUser(token);
    if(error||!user)return res.sendStatus(401);
    const {data,error:dbError}=await client.from('entitlements').select('plan').eq('user_id',user.id).maybeSingle();
    if(dbError)return res.sendStatus(503);
    res.json({id:user.id,plan:data?.plan??'free'});
  }catch{return res.sendStatus(503);}
});
app.listen(Number(PORT));
