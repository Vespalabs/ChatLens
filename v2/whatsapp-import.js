/* Import WhatsApp text before passing records to analyseRecords.
   WhatsApp exports omit timezone offsets. Store the displayed clock as a UTC
   calendar value so device timezone and DST rules cannot shift or discard it. */
function parseWhatsAppExport(text, { dateOrder = "dmy" } = {}) {
  if (typeof text !== "string") throw new TypeError("Expected WhatsApp export text.");
  if (dateOrder !== "dmy" && dateOrder !== "mdy") {
    throw new RangeError("Choose day/month/year or month/day/year.");
  }

  const records = [];
  const invalidTimestampLines = [];
  let systemRecords = 0;
  let currentMessage = null;

  const date = /(\d{1,2})([./-])(\d{1,2})\2(\d{2}|\d{4})/;
  const time = /(\d{1,2}):(\d{2})(?::(\d{2}))?(?:[ \t\u00a0\u202f]*([ap])\.?m\.?)?/;
  const stamp = date.source + ",?[ \\t\\u00a0\\u202f]+" + time.source;
  const bracketed = new RegExp("^\\[" + stamp + "\\][ \\t\\u00a0\\u202f]*(.*)$", "i");
  const dashed = new RegExp("^" + stamp + "[ \\t\\u00a0\\u202f]+-[ \\t\\u00a0\\u202f]+(.*)$", "i");

  const lines = text.split(/\r\n|\n|\r/);

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (index === lines.length - 1 && line === "") break;
    const header = line.replace(/^[\uFEFF\p{Bidi_Control}]+/u, "");
    const match = header.match(bracketed) || header.match(dashed);
    if (!match) {
      if (currentMessage) currentMessage.body += "\n" + line;
      continue;
    }

    currentMessage = null;
    const [, first, , second, yearText, hourText, minuteText, secondText, period, payload] = match;
    const day = Number(dateOrder === "dmy" ? first : second);
    const month = Number(dateOrder === "dmy" ? second : first);
    const year = Number(yearText) + (yearText.length === 2 ? 2000 : 0);
    const minute = Number(minuteText);
    const seconds = Number(secondText ?? 0);
    let hour = Number(hourText);
    const invalidHour = period ? hour < 1 || hour > 12 : hour > 23;
    if (period) hour = hour % 12 + (period.toLowerCase() === "p" ? 12 : 0);

    const t = new Date(0);
    t.setUTCFullYear(year, month - 1, day);
    t.setUTCHours(hour, minute, seconds, 0);
    if (
      invalidHour || minute > 59 || seconds > 59 ||
      t.getUTCFullYear() !== year || t.getUTCMonth() !== month - 1 || t.getUTCDate() !== day
    ) {
      invalidTimestampLines.push(index + 1);
      continue;
    }

    const message = payload.match(/^([^:]+):[ \t\u00a0\u202f](.*)$/);
    const name = message?.[1].replace(/\p{Bidi_Control}/gu, "").trim();
    if (!name) {
      systemRecords++;
      continue;
    }

    currentMessage = { name, body: message[2], t: t.getTime() };
    records.push(currentMessage);
  }

  return { records, diagnostics: { invalidTimestampLines, systemRecords } };
}

function analyseWhatsAppExport(text, { dateOrder = "dmy", sessionGapMinutes = 360 } = {}) {
  const { records, diagnostics } = parseWhatsAppExport(text, { dateOrder });
  return { ...analyseRecords(records, { sessionGapMinutes }), importDiagnostics: diagnostics };
}

/* Each export must cover the same conversation and use the same displayed clock.
   Preserve repeated messages in one export and match exact copies across exports. */
function mergeWhatsAppExports(exports, { dateOrder = "dmy" } = {}) {
  if (!Array.isArray(exports) || exports.length === 0) {
    throw new TypeError("Provide at least one export of the same conversation.");
  }

  const records = [];
  const sourceDiagnostics = [];
  const mergedCounts = new Map();
  let duplicatesRemoved = 0;

  for (let index = 0; index < exports.length; index++) {
    const source = exports[index];
    const parsed = parseWhatsAppExport(source?.text, { dateOrder: source?.dateOrder ?? dateOrder });
    sourceDiagnostics.push({ sourceIndex: index, messages: parsed.records.length, ...parsed.diagnostics });
    const sourceCounts = new Map();

    for (const record of parsed.records) {
      const key = JSON.stringify([record.t, record.name, record.body]);
      const occurrence = (sourceCounts.get(key) ?? 0) + 1;
      sourceCounts.set(key, occurrence);
      if (occurrence > (mergedCounts.get(key) ?? 0)) {
        records.push(record);
        mergedCounts.set(key, occurrence);
      } else {
        duplicatesRemoved++;
      }
    }
  }

  records.sort((left, right) => left.t - right.t);
  return { records, diagnostics: { duplicatesRemoved, sources: sourceDiagnostics } };
}

function analyseWhatsAppExports(exports, { dateOrder = "dmy", sessionGapMinutes = 360 } = {}) {
  const { records, diagnostics } = mergeWhatsAppExports(exports, { dateOrder });
  return { ...analyseRecords(records, { sessionGapMinutes }), importDiagnostics: diagnostics };
}
