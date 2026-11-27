/* ChatLens 2: pure local statistics, no network or sentiment inference.
Input: normalized message records {name, body, t: Date|epoch milliseconds}.
Calendar buckets use UTC; importer must explicitly normalize export wall time. */
function analyseRecords(records,{sessionGapMinutes=360}={}){
 if(!Array.isArray(records)||!Number.isFinite(sessionGapMinutes)||sessionGapMinutes<=0)throw Error("Invalid input");
 const valid=[], rejected=[];
 records.forEach((r,i)=>{const t=r?.t instanceof Date?r.t.getTime():r?.t;
 if(!Number.isFinite(t)||!Number.isFinite(new Date(t).getTime())||typeof r?.name!=="string"||!r.name.trim()||typeof r.body!=="string"){rejected.push(i);return;}
 valid.push({name:r.name.trim(),body:r.body,t,index:i});});
 valid.sort((a,b)=>a.t-b.t||a.index-b.index);
 const people=new Map(), months=new Map(), days=new Set(), sessions=[];
 const gap=sessionGapMinutes*60000;
 let previous=null, current=null, longestGapMs=null;
 for(const r of valid){
 if(!people.has(r.name))people.set(r.name,{name:r.name,messages:0,starts:0,replyIntervalsMs:[]});
 const p=people.get(r.name);p.messages++;
 const day=new Date(r.t).toISOString().slice(0,10),month=day.slice(0,7);
 days.add(day);
 if(!months.has(month))months.set(month,{month,messages:0,participants:new Map()});
 const m=months.get(month);m.messages++;m.participants.set(r.name,(m.participants.get(r.name)||0)+1);
 const delta=previous?r.t-previous.t:null;
 if(delta!==null)longestGapMs=Math.max(longestGapMs??0,delta);
 if(!previous||delta>=gap){current={start:r.t,end:r.t,firstSender:r.name,messages:0};sessions.push(current);if(previous)p.starts++;}
 else if(previous.name!==r.name&&delta>0)p.replyIntervalsMs.push(delta);
 current.end=r.t;current.messages++;previous=r;
 }
 const median=a=>{if(!a.length)return null;const x=[...a].sort((a,b)=>a-b),i=Math.floor(x.length/2);return x.length%2?x[i]:(x[i-1]+x[i])/2;};
 return {total:valid.length,rejectedIndices:rejected,activeDays:days.size,first:valid[0]?.t??null,last:valid.at(-1)?.t??null,longestGapMs,sessionGapMinutes,sessionCount:sessions.length,people:[...people.values()].map(({replyIntervalsMs,...p})=>({...p,replySamples:replyIntervalsMs.length,medianReplyMs:median(replyIntervalsMs)})),months:[...months.values()].map(m=>({...m,participants:[...m.participants].map(([name,messages])=>({name,messages}))})),sessions};
}
