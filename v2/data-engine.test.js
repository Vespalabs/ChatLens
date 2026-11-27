
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

const phoneExport =
  "\uFEFF\u200e[27/11/26, 12:01:00\u202fa.m.] Mina: can we talk?\r\n" +
  "Let's discuss it: tomorrow.\r\n" +
  "[27/11/26, 12:08:00\u00a0P.M.] Ravi: yes\r\n" +
  "[27/11/26, 1:08:00\u202fp.m.] Mina: thanks\r\n" +
  "[27/11/26, 1:12:00 PM] Ravi: of course\r\n";
const iphone = parseWhatsAppExport(phoneExport);
assert(iphone.records.map(r => r.name).join(",") === "Mina,Ravi,Mina,Ravi", "iPhone sender names");
assert(iphone.records[0].body === "can we talk?\nLet's discuss it: tomorrow.", "multiline body");
assert(iphone.records[0].t === Date.UTC(2026, 10, 27, 0, 1), "midnight a.m.");
assert(iphone.records[1].t === Date.UTC(2026, 10, 27, 12, 8), "noon P.M.");
assert(iphone.records[2].t === Date.UTC(2026, 10, 27, 13, 8), "afternoon p.m.");
assert(iphone.records[3].t === Date.UTC(2026, 10, 27, 13, 12), "uppercase undotted PM");

const phoneStats = analyseWhatsAppExport(phoneExport);
assert(phoneStats.total === 4 && phoneStats.people.length === 2, "end-to-end message counts");
assert(phoneStats.people[0].starts === 0 && phoneStats.people[1].starts === 1, "only observed restarts");
assert(phoneStats.people[0].medianReplyMs === 60 * min && phoneStats.people[1].medianReplyMs === 4 * min, "correct reply timing");

const android = parseWhatsAppExport(
  "1/31/2026, 23:58 - Messages and calls are end-to-end encrypted.\n" +
  "1/31/2026, 23:59 - Mina: hello\n" +
  "2/1/2026, 00:02:15 - Ravi: hi\n",
  { dateOrder: "mdy" }
);
assert(android.diagnostics.systemRecords === 1 && android.records.length === 2, "Android system event excluded");
assert(android.records[0].t === Date.UTC(2026, 0, 31, 23, 59), "month-first date parsing");
assert(android.records[1].t === Date.UTC(2026, 1, 1, 0, 2, 15), "24-hour timestamp with seconds");
const rollover = analyseWhatsAppExport("31/01/26, 23:59 - Mina: hello\n01/02/26, 00:02 - Ravi: hi");
assert(rollover.months.map(m => m.month).join(",") === "2026-01,2026-02", "wall-clock month rollover");
assert(
  parseWhatsAppExport("08/03/26, 02:30 - Mina: hello").records[0].t === Date.UTC(2026, 2, 8, 2, 30),
  "wall-clock timestamp independent of DST"
);

const invalid = parseWhatsAppExport(
  "[29/02/26, 9:00 AM] Mina: invalid leap day\n" +
  "[01/03/26, 0:00 AM] Ravi: invalid 12-hour clock\n" +
  "[01/03/26, 10:60 AM] Mina: invalid minute\n" +
  "[01/03/26, 10:00:60 AM] Ravi: invalid second\n" +
  "[01/03/26, 10:00 AM] Mina: valid"
);
assert(invalid.diagnostics.invalidTimestampLines.join(",") === "1,2,3,4", "invalid timestamps reported");
assert(invalid.records.length === 1 && invalid.records[0].body === "valid", "invalid records excluded");
assert(parseWhatsAppExport("29/02/24, 10:00 - Mina: leap day").records.length === 1, "valid leap day");
assert(analyseWhatsAppExport("").total === 0, "empty export");

const olderExport = { text:
  "27/11/26, 09:00 - Mina: hello\n" +
  "27/11/26, 09:10 - Ravi: yes\n" +
  "27/11/26, 09:10 - Ravi: yes\n"
};
const newerExport = { dateOrder: "mdy", text:
  "[11/27/26, 9:10 a.m.] Ravi: yes\n" +
  "[11/27/26, 9:11 a.m.] Mina: thanks\n" +
  "[11/27/26, 9:11 a.m.] Mina: one more thing\n"
};

const mergedStats = analyseWhatsAppExports([newerExport, olderExport, olderExport]);
assert(mergedStats.total === 5, "merge overlap without losing messages unique to an export");
assert(mergedStats.importDiagnostics.duplicatesRemoved === 4, "count duplicate records removed");
assert(mergedStats.importDiagnostics.sources.every(source => source.messages === 3), "per-source counts");
assert(mergedStats.first === Date.UTC(2026, 10, 27, 9), "merge files in chronological order");
assert(mergedStats.people[1].messages === 2, "retain identical messages repeated within a source");
assert(mergedStats.people[0].messages === 3, "retain distinct messages at the same timestamp");
assert(mergedStats.people[0].medianReplyMs === min, "reply timing computed from merged history");
assert(analyseWhatsAppExports([olderExport, newerExport]).total === 5, "overlap count independent of file order");
assert(analyseWhatsAppExports([olderExport]).total === analyseWhatsAppExport(olderExport.text).total, "single-file parity");
