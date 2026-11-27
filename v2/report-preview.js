"use strict";

const element = id => document.getElementById(id);
const numbers = new Intl.NumberFormat("en-IN");
const percentages = new Intl.NumberFormat("en-IN", { style: "percent", maximumFractionDigits: 1 });
const dates = new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeZone: "UTC" });
const months = new Intl.DateTimeFormat("en-GB", { month: "short", year: "2-digit", timeZone: "UTC" });
const headlineMonths = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric", timeZone: "UTC" });
let lastReport = null;
let lastSourceCount = 0;

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function bar(fraction) {
  const track = make("span", "track");
  const fill = make("span", "fill");
  track.setAttribute("aria-hidden", "true");
  fill.style.width = (fraction * 100) + "%";
  track.append(fill);
  return track;
}

function describeShare(people, total) {
  if (people.length !== 2) return "Group report";
  if (total < 20) return "Too few messages to grade";
  const largest = Math.max(people[0].messages, people[1].messages);
  if (largest * 100 <= total * 60) return "Evenly shared";
  if (largest * 100 <= total * 75) return "Uneven";
  return "Mostly from one sender";
}

function formatReply(milliseconds) {
  const seconds = Math.round(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (hours) return hours + " hr " + minutes + " min";
  if (minutes) return minutes + " min" + (seconds % 60 ? " " + (seconds % 60) + " sec" : "");
  return seconds + " sec";
}

function sampleReport() {
  const totals = [42, 77, 93, 148, 120, 68];
  const records = [];
  totals.forEach((total, month) => {
    for (let index = 0; index < total; index++) {
      records.push({
        name: index % 5 < 3 ? "Mira" : "Dev",
        t: Date.UTC(2026, month, 1 + Math.floor(index / 7), 18, (index % 7) * 8),
        body: ""
      });
    }
  });
  return analyseRecords(records);
}

function renderReport(report, sourceCount) {
  lastReport = report;
  lastSourceCount = sourceCount;
  const sample = sourceCount === 0;
  const people = [...report.people].sort((left, right) => right.messages - left.messages);
  const strongest = people[0];
  const leadingShare = percentages.format(strongest.messages / report.total);
  const latest = report.months.slice(-6);
  const busiest = latest.reduce((best, month) => month.messages > best.messages ? month : best);
  const range = dates.format(report.first) + " to " + dates.format(report.last);
  const duplicates = report.importDiagnostics?.duplicatesRemoved ?? 0;
  const skipped = report.importDiagnostics?.sources.reduce((total, file) => total + file.invalidTimestampLines.length, 0) ?? 0;
  const replies = document.createDocumentFragment();
  const participants = document.createDocumentFragment();
  const activity = document.createDocumentFragment();

  element("period").textContent = (sample ? "Sample report" : "Your report") + " | " + range;
  if (latest.length > 1) {
    element("finding").textContent = headlineMonths.format(new Date(busiest.month + "-01T00:00:00Z")) + " had the most activity.";
    element("finding-detail").textContent = numbers.format(busiest.messages) + " messages in the busiest of the " + latest.length + " active months shown. " + strongest.name + " sent " + leadingShare + " of all messages in the report.";
  } else {
    element("finding").textContent = numbers.format(report.total) + (report.total === 1 ? " message" : " messages") + " in the selected period.";
    element("finding-detail").textContent = strongest.name + " sent " + leadingShare + " of the recorded messages.";
  }
  element("message-count").textContent = numbers.format(report.total);
  element("active-days").textContent = numbers.format(report.activeDays);
  element("activity-detail").textContent = "Latest " + latest.length + (latest.length === 1 ? " active month. " : " active months. ") + "The first and last months can be partial.";
  element("message-grade").textContent = people.length < 2 ? "One sender recorded" : describeShare(people, report.total);
  element("coverage").textContent = sample
    ? "This report uses fictional messages across six months."
    : sourceCount + (sourceCount === 1 ? " file reviewed. " : " files reviewed. ") + numbers.format(duplicates) + " duplicate messages removed. " + numbers.format(skipped) + " invalid timestamps skipped.";

  for (const month of latest) {
    const entry = make("li", "month");
    entry.append(
      make("span", "month-label", months.format(new Date(month.month + "-01T00:00:00Z"))),
      bar(month.messages / busiest.messages),
      make("strong", "month-count", numbers.format(month.messages))
    );
    activity.append(entry);
  }

  for (const person of people) {
    const fraction = person.messages / report.total;
    const entry = make("li", "participant");
    entry.append(
      make("strong", "", person.name),
      make("span", "", percentages.format(fraction) + " / " + numbers.format(person.messages)),
      bar(fraction)
    );
    participants.append(entry);

    const reply = make("li");
    const count = person.replySamples;
    const time = count === 0 ? "No timed replies" : count < 5
      ? "Too few samples (" + count + ")"
      : formatReply(person.medianReplyMs) + " / " + numbers.format(count) + " samples";
    reply.append(make("strong", "", person.name), make("span", "", time));
    replies.append(reply);
  }

  element("activity").replaceChildren(activity);
  element("participants").replaceChildren(participants);
  element("replies").replaceChildren(replies);
}

const colourButtons = [...document.querySelectorAll("[data-palette]")];
for (const button of colourButtons) {
  button.addEventListener("click", () => {
    document.body.dataset.theme = button.dataset.palette;
    for (const choice of colourButtons) choice.setAttribute("aria-pressed", String(choice === button));
  });
}

const modeToggle = element("mode-toggle");
modeToggle.addEventListener("click", () => {
  const dark = document.body.dataset.mode !== "dark";
  document.body.dataset.mode = dark ? "dark" : "light";
  modeToggle.setAttribute("aria-pressed", String(dark));
  modeToggle.textContent = dark ? "Light mode" : "Dark mode";
});

element("refresh-report").addEventListener("click", () => {
  if (lastReport) renderReport(lastReport, lastSourceCount);
  status.textContent = "Report refreshed.";
});

function reportText(report) {
  const people = [...report.people].sort((left, right) => right.messages - left.messages);
  const lines = [
    "ChatLens conversation report",
    dates.format(report.first) + " to " + dates.format(report.last),
    numbers.format(report.total) + " messages across " + numbers.format(report.activeDays) + " active days.",
    "Conversation sessions: " + numbers.format(report.sessionCount),
    "Longest gap between messages: " + (report.longestGapMs === null ? "not available" : formatReply(report.longestGapMs))
  ];
  for (const person of people) {
    lines.push(
      person.name + ": " + numbers.format(person.messages) + " messages (" +
      percentages.format(person.messages / report.total) + ")."
    );
    lines.push(
      "Median reply interval: " + (person.replySamples < 5
        ? "too few samples (" + person.replySamples + ")"
        : formatReply(person.medianReplyMs) + " from " + person.replySamples + " samples") + "."
    );
  }
  lines.push("", "These are descriptive measures of the selected exports. They do not establish intent or relationship quality.");
  return lines.join("\n");
}

element("download-report").addEventListener("click", () => {
  if (!lastReport) return;
  const file = new Blob([reportText(lastReport)], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(file);
  link.download = "chatlens-conversation-report.txt";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

element("print-report").addEventListener("click", () => window.print());

element("share-report").addEventListener("click", async () => {
  if (!lastReport) return;
  const text = reportText(lastReport);
  try {
    if (navigator.share) await navigator.share({ title: "ChatLens conversation report", text });
    else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      status.textContent = "Report summary copied.";
    } else {
      status.textContent = "Use Download text or Print / save PDF to share this report.";
    }
  } catch (error) {
    if (error.name !== "AbortError") status.textContent = "Could not share the report from this browser.";
  }
});

const fileInput = element("files");
const status = element("status");
const submitButton = element("analyse");
const sampleButton = element("sample");
const form = element("import-form");

fileInput.addEventListener("change", () => {
  element("multi-confirmation").hidden = fileInput.files.length < 2;
  element("same-chat").checked = false;
  status.textContent = "";
});

sampleButton.addEventListener("click", () => {
  form.reset();
  element("multi-confirmation").hidden = true;
  status.textContent = "Sample report displayed.";
  renderReport(sampleReport(), 0);
});

form.addEventListener("submit", async event => {
  event.preventDefault();
  const files = [...fileInput.files];
  if (files.length === 0) return;
  if (files.some(file => !/\.txt$/i.test(file.name))) {
    status.textContent = "Choose WhatsApp TXT export files.";
    return;
  }
  if (files.length > 1 && !element("same-chat").checked) {
    status.textContent = "Confirm the files cover the same conversation before combining them.";
    return;
  }
  const dateOrder = element("date-order").value;
  submitButton.disabled = sampleButton.disabled = fileInput.disabled = true;
  status.textContent = "Reading files on this device…";
  try {
    const exports = await Promise.all(files.map(async file => ({ text: await file.text() })));
    const report = analyseWhatsAppExports(exports, { dateOrder });
    if (report.total === 0) {
      status.textContent = "No messages recognised. Check the export and selected date format.";
      return;
    }
    renderReport(report, files.length);
    element("finding").scrollIntoView({ block: "nearest" });
    status.textContent = "Your report is ready.";
  } catch {
    status.textContent = "Could not read these files. Try exporting the conversation again as TXT.";
  } finally {
    submitButton.disabled = sampleButton.disabled = fileInput.disabled = false;
  }
});

renderReport(sampleReport(), 0);
