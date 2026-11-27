
const assert=(x,m)=>{if(!x)throw Error(m);};
const t=Date.UTC(2026,0,31,23,50), min=60000;
const row=(name,offset,body="hi")=>({name,t:t+offset*min,body});
const r=analyseRecords([row("B",15),row("A",0),row("B",5),row("A",365),row("A",365),{name:"X",t:NaN,body:"bad"}]);
assert(r.total===5,"total including identical legitimate messages");
assert(r.rejectedIndices[0]===5,"invalid record");
assert(r.activeDays===2&&r.months.length===2,"calendar rollover");
assert(r.sessionCount===1,"gap below threshold");
assert(r.people[0].starts===0,"first message not restart");
assert(r.people[1].medianReplyMs===5*min,"reply median");
assert(r.people[0].medianReplyMs===350*min,"sender transition");
const s=analyseRecords([row("A",0),row("B",360),row("A",360)]);
assert(s.sessionCount===2&&s.people[1].starts===1,"exact threshold");
assert(s.people[0].replySamples===0,"simultaneous timestamps excluded");
assert(analyseRecords([]).longestGapMs===null,"empty input");
assert(analyseRecords([row("A",0)]).people[0].medianReplyMs===null,"single message");
