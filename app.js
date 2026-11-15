"use strict";
const $ = s => document.querySelector(s), main = $("#main"), panel = $("#panel");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const LANGS = { en: "English", "zh-Hant": "繁體中文", ja: "日本語" };
const store = { get() { try { return localStorage.getItem("lang"); } catch (e) { return null; } }, set(v) { try { localStorage.setItem("lang", v); } catch (e) {} } };
const pickLang = () => {
  const q = new URLSearchParams(location.search).get("lang"); if (LANGS[q]) return q;
  const s = store.get(); if (LANGS[s]) return s;
  for (const l of navigator.languages || [navigator.language || "en"]) { if (/^zh/i.test(l)) return "zh-Hant"; if (/^ja/i.test(l)) return "ja"; if (/^en/i.test(l)) return "en"; }
  return "en";
};
let LANG = pickLang(), UI = {};
// English is the key. The other languages are in data/ui.json (built from i18n/ui.json).
const t = (s, ...a) => { const v = LANG === "en" ? s : (UI[s] && UI[s][LANG]) || s; return a.length ? v.replace(/\{(\d)\}/g, (m, i) => a[+i]) : v; };
const num = n => Number(n || 0).toLocaleString("en-US");
function chrome() {
  document.documentElement.lang = LANG; document.title = "明孝宗實錄 · " + t("a dated table with persons and places");
  document.querySelectorAll("[data-i18n]").forEach(e => e.textContent = t(e.dataset.i18n));
  $("#q").placeholder = t("search the text");
  $("#langs").innerHTML = Object.entries(LANGS).map(([k, v]) => `<button data-lang="${k}" ${k === LANG ? "aria-current='true'" : ""}>${v}</button>`).join("");
}
const CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const cn = n => n <= 10 ? CN[n] : n < 20 ? "十" + CN[n - 10] : "二十" + CN[n - 20];
const METHOD = {
  "office-in-text-dated": () => t("CBDB records an office for this person that is named in the record, with years that cover the date."),
  "office-in-text": () => t("CBDB records an office for this person that is named in the record, but gives no years for it."),
  "office-elsewhere": () => t("Several people share this name. Office evidence chose this one for the same name in other records of the reign."),
  "unique-fits-date": () => t("Only one person of this name in CBDB was alive at the date."),
  "unique-undated": () => t("Only one candidate was left, and CBDB gives no dates for this person."),
  "only-dated-candidate": () => t("Several candidates were left; only this one has dates that fit."),
  "ambiguous": () => t("Several people of this name fit, and nothing in the record decides. No id is given."),
  "no-candidate-fits": () => t("CBDB has this name, but nobody of that name fits the date."),
  "not-in-cbdb": () => t("This name is not in CBDB as written. It may be a misreading, a eunuch, a minor officer or a foreigner."),
  "title-only": () => t("A title without a personal name. Not looked up."),
  "one-character-name": () => t("A one-character name. Not looked up."),
  "surname-only": () => t("A surname with 氏. Not looked up."),
  "record-undated": () => t("The record has no date, so the name was not looked up."),
  "unique": () => t("Only one place of this name existed in TGAZ in that year."),
  "same-place-duplicate": () => t("TGAZ has more than one entry, but they are the same place."),
  "highest-level": () => t("The name was found only after adding a suffix (府, 州, 縣, 衛, 布政使司). The highest-level unit was taken."),
  "not-in-tgaz": () => t("TGAZ has no place of this name for that year."),
};
const CONF = { strong: () => t("strong"), medium: () => t("medium"), weak: () => t("weak") };
const PROC = {}, pageCache = new Map(), proc = async () => PROC[LANG] || (PROC[LANG] = await fetch(`data/process.${LANG}.json`).then(r => r.json()));
let R = [], META = {}, byId = new Map(), byJuan = new Map(), months = [], ents = [new Map(), new Map()];

const dateLabel = r => {
  if (!r.e) return t("undated");
  let s = r.e + (r.y === 1 ? "元" : cn(r.y)) + "年";
  if (r.m) s += (r.l ? "閏" : "") + (r.m === 1 ? "正" : cn(r.m)) + "月";
  if (r.g) s += r.g;
  return s;
};
const mkey = r => [r.e, r.y, r.m, r.l].join("-");

function index() {
  const seen = new Map();
  R.forEach((r, x) => {
    r.x = x; byId.set(r.i, r);
    if (!byJuan.has(r.j)) byJuan.set(r.j, []);
    byJuan.get(r.j).push(r);
    if (r.e && r.m && !seen.has(mkey(r))) { seen.set(mkey(r), 1); months.push({ k: mkey(r), e: r.e, y: r.y, m: r.m, l: r.l }); }
    r.n.forEach(n => {
      if (!n[4]) return;
      const M = ents[n[0]]; let e = M.get(n[4]);
      if (!e) M.set(n[4], e = { id: n[4], name: n[5], recs: [], conf: {} });
      e.recs.push(x); e.conf[n[3]] = (e.conf[n[3]] || 0) + 1;
    });
  });
}

function textHTML(r) {
  const t = r.t, own = new Array(t.length).fill(-1);
  r.n.map((n, k) => [k, n[1]]).filter(a => a[1]).sort((a, b) => b[1].length - a[1].length).forEach(([k, s]) => {
    for (let p = t.indexOf(s); p >= 0; p = t.indexOf(s, p + s.length))
      if (own.slice(p, p + s.length).every(v => v < 0)) own.fill(k, p, p + s.length);
  });
  let h = "", i = 0;
  while (i < t.length) {
    let j = i; while (j < t.length && own[j] === own[i]) j++;
    const seg = esc(t.slice(i, j)), k = own[i];
    if (k < 0) h += seg; else { const n = r.n[k]; h += `<span class="ent ${n[0] ? "l" : "p"} ${n[4] ? n[3] : "none"}" data-r="${r.x}" data-n="${k}">${seg}</span>`; }
    i = j;
  }
  return h;
}
const dayNo = r => r.d ? t("day {0}", r.d) : "";
const recHTML = r => `<div class="rec" id="r${r.i}"><div class="txt" lang="zh-Hant">${r.k ? esc(r.k) : ""}${textHTML(r)}</div>
<div class="meta"><a href="#/rec/${r.i}">${r.i}</a><span>卷${r.j}</span><a href="#/page/${esc(r.q)}">${t("1966 ed. p. {0}", esc(r.p))}</a><span>${esc(dateLabel(r))}${r.d ? " (" + dayNo(r) + ")" : ""}${r.w ? " · " + r.w : ""}</span>${r.s === "restored" ? `<span>${t("date divider restored")}</span>` : ""}${r.f ? `<span>${esc(r.f)}</span>` : ""}</div></div>`;
const legend = () => `<div class="legend"><span><span class="ent p strong">${t("person")}</span></span><span><span class="ent l strong">${t("place")}</span></span><span>${t("solid = strong link")}</span><span>${t("dashed = medium")}</span><span>${t("dotted = weak")}</span><span><span class="ent none">${t("grey dots")}</span> ${t("= found, no id")}</span><span>${t("Click a name for details.")}</span></div>`;
function listHTML(rs) {
  let h = "", last = null;
  rs.forEach(r => {
    const d = dateLabel(r) + "|" + r.w;
    if (d !== last) { h += `<div class="day">${esc(dateLabel(r))} <span class="mute">${r.d ? dayNo(r) + " · " : ""}${r.w || ""}</span></div>`; last = d; }
    h += recHTML(r);
  });
  return h;
}

const V = {
  home() {
    const rows = new Map();
    months.forEach(m => { const k = m.e + (m.y === 1 ? "元" : cn(m.y)) + "年"; if (!rows.has(k)) rows.set(k, []); rows.get(k).push(m); });
    let g = ""; rows.forEach((ms, k) => { g += `<div class="yrow"><span>${k}</span>${ms.map(m => `<a class="${m.l ? "leap" : ""}" href="#/month/${m.k}">${m.l ? "閏" : ""}${m.m === 1 ? "正" : cn(m.m)}</a>`).join("")}</div>`; });
    const js = [...byJuan.keys()].map(j => `<a href="#/juan/${j}">${j}</a>`).join("");
    const f = num;
    main.innerHTML = `<h1 lang="zh-Hant">明孝宗實錄</h1>
<p>${t("The Veritable Records of the Hongzhi reign (1487–1505) as a table: one row per record, each with its date, and with the persons and places it names linked to CBDB and TGAZ.")} <a href="#/process">${t("How it was made, step by step")}</a>${t(".")}</p>
<div class="stats"><div class="stat"><b>${f(META.records)}</b>${t("records")}</div><div class="stat"><b>${META.juan}</b>卷</div><div class="stat"><b>${f(META.chars)}</b>${t("characters")}</div>
<div class="stat"><b>${f(ents[0].size)}</b>${t("persons linked")}</div><div class="stat"><b>${f(ents[1].size)}</b>${t("places linked")}</div></div>
<h2>${t("By month")}</h2><div class="years">${g}</div><p class="mute small">${t("Dashed box = intercalary month (閏月).")}</p>
<h2>${t("By 卷")}</h2><div class="juans">${js}</div>`;
  },
  juan(j) {
    j = +j; const rs = byJuan.get(j); if (!rs) return V.missing();
    const pg = `<div class="pager"><span>${byJuan.has(j - 1) ? `<a href="#/juan/${j - 1}">← 卷${j - 1}</a>` : ""}</span><span>${byJuan.has(j + 1) ? `<a href="#/juan/${j + 1}">卷${j + 1} →</a>` : ""}</span></div>`;
    main.innerHTML = `<h1>卷${j}</h1><p class="mute">${t("{0} records", rs.length)}</p>${legend()}${pg}${listHTML(rs)}${pg}`;
  },
  month(k) {
    const rs = R.filter(r => mkey(r) === k); if (!rs.length) return V.missing();
    const x = months.findIndex(m => m.k === k), a = months[x - 1], b = months[x + 1], lab = m => m.e + (m.y === 1 ? "元" : cn(m.y)) + "年" + (m.l ? "閏" : "") + (m.m === 1 ? "正" : cn(m.m)) + "月";
    const pg = `<div class="pager"><span>${a ? `<a href="#/month/${a.k}">← ${lab(a)}</a>` : ""}</span><span>${b ? `<a href="#/month/${b.k}">${lab(b)} →</a>` : ""}</span></div>`;
    main.innerHTML = `<h1>${lab(months[x])}</h1><p class="mute">${t("{0} records", rs.length)}</p>${legend()}${pg}${listHTML(rs)}${pg}`;
  },
  rec(id) {
    const r = byId.get(id); if (!r) return V.missing();
    V.juan(r.j); const el = document.getElementById("r" + id);
    if (el) { el.scrollIntoView({ block: "center" }); el.style.outline = "2px solid var(--acc)"; }
    return true;
  },
  entlist(ty) {
    const all = [...ents[ty].values()].sort((a, b) => b.recs.length - a.recs.length), what = ty ? "place" : "person";
    main.innerHTML = `<h1>${ty ? t("Places") : t("Persons")}</h1><p class="mute">${ty ? t("{0} places with a TGAZ id, by number of records.", num(all.length)) : t("{0} persons with a CBDB id, by number of records.", num(all.length))} ${t("Names that could not be linked are not listed here; search the text for them.")}</p>
<input class="filter" id="flt" placeholder="${t("filter by name")}"><table><thead><tr><th>${t("name")}</th><th>id</th><th class="n">${t("records")}</th></tr></thead><tbody id="tb"></tbody></table><p class="mute small" id="more"></p>`;
    const draw = q => {
      const hit = q ? all.filter(e => e.name.includes(q)) : all;
      $("#tb").innerHTML = hit.slice(0, 300).map(e => `<tr><td><a href="#/${what}/${e.id}">${esc(e.name)}</a></td><td class="mute">${esc(e.id)}</td><td class="n">${e.recs.length}</td></tr>`).join("");
      $("#more").textContent = hit.length > 300 ? t("Showing 300 of {0}. Type a name to narrow the list.", num(hit.length)) : "";
    };
    $("#flt").addEventListener("input", e => draw(e.target.value.trim())); draw("");
  },
  ent(ty, id) {
    const e = ents[ty].get(id); if (!e) return V.missing();
    const url = ty ? "https://tgaz.fudan.edu.cn/tgaz/placename/" + id : "https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=" + id;
    const conf = ["strong", "medium", "weak"].filter(c => e.conf[c]).map(c => `${e.conf[c]} ${CONF[c]()}`).join(", ");
    let shown = 100;
    const draw = () => {
      main.innerHTML = `<h1 lang="zh-Hant">${esc(e.name)}</h1><p><a href="${url}" target="_blank" rel="noopener">${ty ? "TGAZ" : "CBDB"} ${esc(id)} ↗</a> · ${t("{0} records", e.recs.length)} · ${t("links: {0}", conf)}</p>
<p class="mute small">${t("These links were made by rules and are not reviewed. A weak link may be another person or place of the same name.")}</p>${legend()}${listHTML(e.recs.slice(0, shown).map(x => R[x]))}
${e.recs.length > shown ? `<p><button id="morebtn" class="filter">${t("Show 100 more ({0} left)", e.recs.length - shown)}</button></p>` : ""}`;
      const b = $("#morebtn"); if (b) b.onclick = () => { const y = scrollY; shown += 100; draw(); scrollTo(0, y); };
    };
    draw();
  },
  search(q) {
    q = decodeURIComponent(q); $("#q").value = q;
    const hits = q ? R.filter(r => r.t.includes(q)) : [];
    const snip = r => { const p = r.t.indexOf(q), a = Math.max(0, p - 30), b = Math.min(r.t.length, p + q.length + 50); return (a ? "…" : "") + esc(r.t.slice(a, p)) + "<mark>" + esc(q) + "</mark>" + esc(r.t.slice(p + q.length, b)) + (b < r.t.length ? "…" : ""); };
    main.innerHTML = `<h1>${t("Search: {0}", esc(q))}</h1><p class="mute">${t("{0} records contain this string", num(hits.length))}${hits.length > 300 ? t("; the first 300 are shown") : ""}${t(". The search matches the exact characters, and the text has OCR errors.")}</p>` +
      hits.slice(0, 300).map(r => `<div class="rec"><div class="txt" lang="zh-Hant">${snip(r)}</div><div class="meta"><a href="#/rec/${r.i}">${r.i}</a><span>卷${r.j}</span><span>${esc(dateLabel(r))}${r.w ? " · " + r.w : ""}</span></div></div>`).join("");
  },
  about() {
    main.innerHTML = `<h1>${t("About this site")}</h1>
<p>${t("This is a working draft from a project that turns the 明實錄 into a research database, with generative AI doing the reading and a historian setting the rules and checking the results.")}</p>
<p>${t("Every step, with its rules, numbers, code and mistakes, is under <a href='#/process'>How it was made</a>. The files are under <a href='#/downloads'>Downloads</a>.")}</p><h2>${t("The source")}</h2><p>${t("The text was read by machine (OCR) from the 1966 Academia Sinica photographic reprint of the 紅格鈔本 of the 明孝宗實錄. Page numbers on this site are the printed page numbers of that edition. The text has not been proofread: expect wrong characters.")}</p>
<h2>${t("How the table was made")}</h2><p>${t("Page images were read by an OCR model. Rules cut the text into 卷, months and records at the marks ○ and △. Each record's day (干支) was turned into a Gregorian date with a calendar table and checked against the first day (朔) of every month. Cases the rules could not decide went to a historian on a review page.")}</p>
<h2>${t("Persons and places")}</h2><p>${t("A language model (Codex) listed the persons and places named in each record. Every string it returned was checked to be in the record, character for character. Scripts then looked each name up in the China Biographical Database (CBDB) and in the China Historical GIS place-name database (TGAZ), and chose among people of the same name by date and by offices named in the record. Offices themselves are not extracted.")}</p>
<p>${t("Of {0} person strings, {1} have a CBDB id. Of {2} place strings, {3} have a TGAZ id.", num(META.person_linked + META.person_unlinked), num(META.person_linked), num(META.place_linked + META.place_unlinked), num(META.place_linked))} <b>${t("These links have not been reviewed by a person.")}</b> ${t("Each link carries a confidence (strong, medium, weak) and the rule that made it; click a name to see them. Names with no id are still marked, with the reason.")}</p>
<h2>${t("Known limits")}</h2><ul><li>${t("OCR errors change names (for example 揚士奇 for 楊士奇), so some people are not found.")}</li><li>${t("Eunuchs, minor officers, foreigners and many princes are not in CBDB.")}</li><li>${t("TGAZ lacks many Ming frontier, military and regional names (遼東, 宣府, 直隸), and some ordinary places for these years.")}</li><li>${t("What the language model missed has not been measured.")}</li></ul>
<h2>${t("Languages")}</h2><p>${t("The notes were written in English. The Chinese and Japanese versions are machine translations and have not been checked by a person; where they differ, the English is the record. The text of the 實錄 itself is not translated.")}</p>
<p class="mute small">${t("Built {0}. Data: CBDB (Harvard University, Academia Sinica, Peking University); CHGIS/TGAZ (Harvard University, Fudan University).", esc(META.built))}</p>`;
  },
  async process() {
    const P = await proc();
    main.innerHTML = `<h1>${t("How it was made")}</h1>
<p>${t("One 實錄 taken the whole way from the printed page to a database, with every step kept: what was done, the rule, the numbers, the code, and what went wrong. A model reads; rules and the calendar check; the historian decides what the rules cannot.")}</p>
<figure><img src="figures/fig1_pipeline.svg" alt="${t("The pipeline in nine steps")}"><figcaption>${t("Steps 00 to 08, the check on each, and where the historian decides. Step 09 (persons and places) came after this figure was drawn.")}${LANG === "en" ? "" : " " + t("The figures are in English.")}</figcaption></figure>
<p>${t("<b>Time:</b> six calendar days; about 46.5 hours of machine time, of which the OCR is 43.1 hours; and a few hours of attention from the historian.")} <a href="#/time">${t("The count, step by step")}</a>${t(".")}</p>
<h2>${t("The steps")}</h2><div class="steps">${P.steps.map(s => `<a class="stepcard" href="#/step/${s.id}"><b>${s.id}</b><span>${esc(s.title)}</span></a>`).join("")}
<a class="stepcard" href="#/compare"><b>test</b><span>${t("Two readers compared: Codex and Qwen")}</span></a><a class="stepcard" href="#/time"><b>time</b><span>${t("Time used, step by step")}</span></a><a class="stepcard" href="#/journal"><b>log</b><span>${t("The journal, day by day")}</span></a><a class="stepcard" href="#/downloads"><b>files</b><span>${t("Downloads")}</span></a></div>
<h2>${t("The map of the work")}</h2><div class="md">${P.readme}</div>`;
  },
  async step(id) {
    const P = await proc(), x = P.steps.findIndex(s => s.id === id); if (x < 0) return V.missing();
    const S = await fetch(`data/steps/${LANG}/${id}.json`).then(r => r.json()), a = P.steps[x - 1], b = P.steps[x + 1];
    const pg = `<div class="pager"><span>${a ? `<a href="#/step/${a.id}">← ${a.id} ${esc(a.title)}</a>` : `<a href="#/process">← ${t("overview")}</a>`}</span><span>${b ? `<a href="#/step/${b.id}">${b.id} ${esc(b.title)} →</a>` : `<a href="#/journal">${t("the journal")} →</a>`}</span></div>`;
    main.innerHTML = `<p class="mute small"><a href="#/process">${t("How it was made")}</a> › ${t("step {0}", id)}</p>${pg}<div class="steppage">${S.html}</div>${pg}`;
  },
  async compare() {
    const C = await fetch(`data/compare.${LANG}.json`).then(r => r.json());
    const who = x => x ? "Qwen" : "Codex";
    const callrow = c => `<tr><td>${who(c[0])}</td><td>${esc(c[1])}</td><td class="n">${c[2]}</td><td class="n">${c[3]}</td><td class="n">${c[4]}</td><td class="n">${c[5]}</td><td><code>${esc(c[6])}</code></td></tr>`;
    main.innerHTML = `<p class="mute small"><a href="#/process">${t("How it was made")}</a> › <a href="#/step/09">${t("step {0}", "09")}</a> › ${t("experiment")}</p><div class="md">${C.html}</div>
<h2>${t("Every call")}</h2><p class="mute small">${t("Seconds are for one batch of 25 records. Codex ran three batches at once, so its clock time is shorter than the sum. Codex's tokens were counted for the run as a whole, not per batch. The last column is the start of the prompt's fingerprint: the same in both runs.")}</p>
<table class="sample"><thead><tr><th>${t("reader")}</th><th>${t("batch")}</th><th class="n">${t("records")}</th><th class="n">${t("seconds")}</th><th class="n">${t("tokens in")}</th><th class="n">${t("tokens out")}</th><th>${t("prompt")}</th></tr></thead><tbody>${C.calls.map(callrow).join("")}</tbody></table>
<h2>${t("Every difference")}</h2><p>${t("Each row is a string that one reader returned for a record and the other did not. Nobody has judged which reader is right.")} ${C.link}</p>
<p><select id="cw"><option value="">${t("both readers")}</option><option value="0">${t("only Codex")}</option><option value="1">${t("only Qwen")}</option></select>
<select id="ct"><option value="">${t("persons and places")}</option><option value="0">${t("persons")}</option><option value="1">${t("places")}</option></select>
<input id="cq" placeholder="${t("filter by text, record or rule")}" size="28"> <span id="cn" class="mute small"></span></p>
<table class="sample"><thead><tr><th>${t("only in")}</th><th>${t("type")}</th><th>${t("record")}</th><th>${t("string")}</th><th>${t("kind")}</th><th>${t("what the linking rules did")}</th><th>${t("linked to")}</th></tr></thead><tbody id="cb"></tbody></table>
<h2>${t("Code")}</h2>${C.code}`;
    const draw = () => {
      const w = cw.value, ty = ct.value, q = cq.value.trim();
      const rows = C.rows.filter(r => (w === "" || +r[0] === +w) && (ty === "" || +r[1] === +ty) && (!q || (r[2] + " " + r[3] + " " + r[5] + " " + r[6]).includes(q)));
      cn.textContent = t("{0} of {1}", rows.length, C.rows.length);
      cb.innerHTML = rows.map(r => `<tr><td>${who(r[0])}</td><td>${r[1] ? t("place") : t("person")}</td><td><a href="#/rec/${encodeURIComponent(r[2])}">${esc(r[2])}</a></td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[5])}</td><td>${esc(r[6])}</td></tr>`).join("");
    };
    const cw = document.getElementById("cw"), ct = document.getElementById("ct"), cq = document.getElementById("cq"), cn = document.getElementById("cn"), cb = document.getElementById("cb");
    cw.onchange = ct.onchange = draw; cq.oninput = draw; draw();
  },
  async time() {
    const P = await proc();
    main.innerHTML = `<p class="mute small"><a href="#/process">${t("How it was made")}</a> › ${t("time")}</p><div class="md">${P.time}</div>`;
  },
  async journal() {
    const P = await proc();
    main.innerHTML = `<p class="mute small"><a href="#/process">${t("How it was made")}</a> › ${t("journal")}</p><div class="md">${P.journal}</div>`;
  },
  async downloads() {
    const P = await proc();
    main.innerHTML = `<h1>${t("Downloads")}</h1><p>${t("The table and the working files of the steps. The text is machine-read and not proofread; the links are not reviewed.")}</p>
<table><thead><tr><th>${t("file")}</th><th>${t("what")}</th><th>${t("step")}</th><th class="n">${t("size")}</th></tr></thead><tbody>${P.downloads.map(d => `<tr><td><a href="${esc(d.file)}" download>${esc(d.name)}</a></td><td>${esc(d.what)}</td><td><a href="#/step/${d.step}">${d.step}</a></td><td class="n">${esc(d.size)}</td></tr>`).join("")}</tbody></table>`;
  },
  async page(seq) {
    const n = parseInt(String(seq).slice(4), 10); if (isNaN(n) || n < 0 || n >= META.pages) return V.missing();
    const k = Math.floor(n / 100), key = String(k).padStart(2, "0");
    if (!pageCache.has(key)) pageCache.set(key, await fetch(`data/pages/${key}.json`).then(r => r.json()));
    const p = pageCache.get(key).find(x => x.q === seq); if (!p) return V.missing();
    const sq = i => "seq-" + String(i).padStart(4, "0"), recs = R.filter(r => r.q === seq);
    const pg = `<div class="pager"><span>${n > 0 ? `<a href="#/page/${sq(n - 1)}">← ${sq(n - 1)}</a>` : ""}</span><span><form id="goform">${t("go to scan page")} <input id="go" size="5" value="${n}"></form></span><span>${n < META.pages - 1 ? `<a href="#/page/${sq(n + 1)}">${sq(n + 1)} →</a>` : ""}</span></div>`;
    const cols = p.t ? p.t.split("\n").map(l => `<div>${esc(l)}</div>`).join("") : "";
    main.innerHTML = `<h1>${t("Page {0}", esc(seq))}</h1>
<p class="mute">${t("Scan page {0} of {1}.", n, META.pages)} ${t("Margin labels of the 1966 edition, as read: {0}.", p.mg && p.mg.length ? p.mg.map(esc).join(" · ") : t("none"))} ${t("Status: {0}", esc(p.st))}${p.no ? " (" + esc(p.no) + ")" : ""}${p.sp ? " · " + t("full stops: {0}", esc(p.sp)) : ""}${t(".")} ${t("Model: {0}, {1} s.", esc(p.fr), esc(p.sec))}</p>${pg}
<h2>${t("The text after cleaning (step 03)")}</h2><p class="mute small">${t("Set as on the page: columns run top to bottom, right to left. A blank is a space the copyist left.")}</p>
${cols ? `<div class="vpage" lang="zh-Hant">${cols}</div>` : `<p class="mute">${t("No text on this page.")}</p>`}
<h2>${t("Records that begin on this page")}</h2>${recs.length ? recs.map(r => `<p><a href="#/rec/${r.i}">${r.i}</a> ${esc(dateLabel(r))} <span class="mute" lang="zh-Hant">${esc(r.t.slice(0, 40))}${r.t.length > 40 ? "…" : ""}</span></p>`).join("") : `<p class="mute">${t("None.")}</p>`}
<h2>${t("The model's raw answer (step 02)")}</h2><details><summary>${t("Show the raw answer")}</summary><pre>${esc(p.raw)}</pre></details>${pg}`;
    $("#goform").addEventListener("submit", ev => { ev.preventDefault(); const v = parseInt($("#go").value, 10); if (!isNaN(v)) location.hash = "#/page/" + sq(v); });
  },
  missing() { main.innerHTML = `<h1>${t("Not found")}</h1><p><a href="#/">${t("Back to the start")}</a></p>`; },
};

function route() {
  panel.hidden = true;
  let [, a, b] = location.hash.split("/"), keep = false;
  try { if (b && a !== "search") b = decodeURIComponent(b); } catch (e) {}
  if (!a) V.home(); else if (a === "juan") V.juan(b); else if (a === "month") V.month(b); else if (a === "rec") keep = V.rec(b);
  else if (a === "persons") V.entlist(0); else if (a === "places") V.entlist(1);
  else if (a === "person") V.ent(0, b); else if (a === "place") V.ent(1, b);
  else if (a === "search") V.search(b || ""); else if (a === "about") V.about();
  else if (a === "process") V.process(); else if (a === "step") V.step(b); else if (a === "journal") V.journal(); else if (a === "time") V.time(); else if (a === "compare") V.compare();
  else if (a === "downloads") V.downloads(); else if (a === "page") V.page(b); else V.missing();
  if (!keep) scrollTo(0, 0);
}
document.addEventListener("click", ev => {
  const s = ev.target.closest(".ent[data-r]");
  if (!s) { if (!ev.target.closest("#panel")) panel.hidden = true; return; }
  const n = R[+s.dataset.r].n[+s.dataset.n], ty = n[0], what = ty ? "place" : "person", e = n[4] && ents[ty].get(n[4]), mk = n[2].replace("+朱", "");
  panel.innerHTML = `<button class="x" aria-label="close">×</button><h3 lang="zh-Hant">${esc(n[1])}</h3>
<p><span class="tag">${ty ? t("place") : t("person")}</span> ${n[4] ? `<span class="tag">${t("{0} link", CONF[n[3]] ? CONF[n[3]]() : esc(n[3]))}</span>` : `<span class="tag">${t("no id")}</span>`}</p>
${n[6] ? `<p>${t("Full name as read by the model: {0}", esc(n[6]))}</p>` : ""}
${n[4] ? `<p><b>${esc(n[5])}</b> · ${ty ? "TGAZ" : "CBDB"} ${esc(n[4])} <a target="_blank" rel="noopener" href="${ty ? "https://tgaz.fudan.edu.cn/tgaz/placename/" + esc(n[4]) : "https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=" + esc(n[4])}">${t("open")} ↗</a></p>` : ""}
<p class="small">${esc(METHOD[mk] ? METHOD[mk]() : n[2])}${n[2].endsWith("+朱") ? " " + t("Looked up with the surname 朱 added, as for an imperial clansman.") : ""} <span class="mute">(${esc(n[2])})</span></p>
<p>${e ? `<a href="#/${what}/${esc(n[4])}">${ty ? t("All {0} records linked to this place", e.recs.length) : t("All {0} records linked to this person", e.recs.length)}</a> · ` : ""}<a href="#/search/${encodeURIComponent(n[1])}">${t("Search the text for {0}", esc(n[1]))}</a></p>`;
  panel.hidden = false; panel.querySelector(".x").onclick = () => panel.hidden = true;
});
$("#searchform").addEventListener("submit", ev => { ev.preventDefault(); const q = $("#q").value.trim(); if (q) location.hash = "#/search/" + encodeURIComponent(q); });
document.addEventListener("click", ev => {
  const b = ev.target.closest("#langs button"); if (!b || b.dataset.lang === LANG) return;
  LANG = b.dataset.lang; store.set(LANG); chrome();
  if (location.search) history.replaceState(null, "", location.pathname + location.hash);   // a ?lang= in the address no longer applies
  const y = scrollY; Promise.resolve(route()).then(() => scrollTo(0, y));
});
Promise.all([fetch("data/records.json").then(r => r.json()), fetch("data/meta.json").then(r => r.json()), fetch("data/ui.json").then(r => r.json())])
  .then(([a, b, c]) => { R = a; META = b; UI = c; chrome(); index(); addEventListener("hashchange", route); route(); })
  .catch(e => { main.innerHTML = `<p>${t("The records could not be loaded: {0}", esc(e.message))}</p>`; });
