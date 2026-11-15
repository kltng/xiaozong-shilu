"use strict";
const $ = s => document.querySelector(s), main = $("#main"), panel = $("#panel");
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const CN = ["", "一", "二", "三", "四", "五", "六", "七", "八", "九", "十"];
const cn = n => n <= 10 ? CN[n] : n < 20 ? "十" + CN[n - 10] : "二十" + CN[n - 20];
const METHOD = {
  "office-in-text-dated": "CBDB records an office for this person that is named in the record, with years that cover the date.",
  "office-in-text": "CBDB records an office for this person that is named in the record, but gives no years for it.",
  "office-elsewhere": "Several people share this name. Office evidence chose this one for the same name in other records of the reign.",
  "unique-fits-date": "Only one person of this name in CBDB was alive at the date.",
  "unique-undated": "Only one candidate was left, and CBDB gives no dates for this person.",
  "only-dated-candidate": "Several candidates were left; only this one has dates that fit.",
  "ambiguous": "Several people of this name fit, and nothing in the record decides. No id is given.",
  "no-candidate-fits": "CBDB has this name, but nobody of that name fits the date.",
  "not-in-cbdb": "This name is not in CBDB as written. It may be a misreading, a eunuch, a minor officer or a foreigner.",
  "title-only": "A title without a personal name. Not looked up.",
  "one-character-name": "A one-character name. Not looked up.",
  "surname-only": "A surname with 氏. Not looked up.",
  "record-undated": "The record has no date, so the name was not looked up.",
  "unique": "Only one place of this name existed in TGAZ in that year.",
  "same-place-duplicate": "TGAZ has more than one entry, but they are the same place.",
  "highest-level": "The name was found only after adding a suffix (府, 州, 縣, 衛, 布政使司). The highest-level unit was taken.",
  "not-in-tgaz": "TGAZ has no place of this name for that year.",
};
let PROC = null; const pageCache = new Map(), proc = async () => PROC || (PROC = await fetch("data/process.json").then(r => r.json()));
let R = [], META = {}, byId = new Map(), byJuan = new Map(), months = [], ents = [new Map(), new Map()];

const dateLabel = r => {
  if (!r.e) return "undated";
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
const recHTML = r => `<div class="rec" id="r${r.i}"><div class="txt">${r.k ? esc(r.k) : ""}${textHTML(r)}</div>
<div class="meta"><a href="#/rec/${r.i}">${r.i}</a><span>卷${r.j}</span><a href="#/page/${esc(r.q)}">1966 ed. p. ${esc(r.p)}</a><span>${esc(dateLabel(r))}${r.d ? " (day " + r.d + ")" : ""}${r.w ? " · " + r.w : ""}</span>${r.s === "restored" ? "<span>date divider restored</span>" : ""}${r.f ? `<span>${esc(r.f)}</span>` : ""}</div></div>`;
const LEGEND = `<div class="legend"><span><span class="ent p strong">person</span></span><span><span class="ent l strong">place</span></span><span>solid = strong link</span><span>dashed = medium</span><span>dotted = weak</span><span><span class="ent none">grey dots</span> = found, no id</span><span>Click a name for details.</span></div>`;
function listHTML(rs) {
  let h = "", last = null;
  rs.forEach(r => {
    const d = dateLabel(r) + "|" + r.w;
    if (d !== last) { h += `<div class="day">${esc(dateLabel(r))} <span class="mute">${r.d ? "day " + r.d + " · " : ""}${r.w || ""}</span></div>`; last = d; }
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
    const f = n => Number(n || 0).toLocaleString();
    main.innerHTML = `<h1>明孝宗實錄</h1>
<p>The Veritable Records of the Hongzhi reign (1487–1505) as a table: one row per record, each with its date, and with the persons and places it names linked to CBDB and TGAZ. <a href="#/process">How it was made, step by step</a>.</p>
<div class="stats"><div class="stat"><b>${f(META.records)}</b>records</div><div class="stat"><b>${META.juan}</b>卷</div><div class="stat"><b>${f(META.chars)}</b>characters</div>
<div class="stat"><b>${f(ents[0].size)}</b>persons linked</div><div class="stat"><b>${f(ents[1].size)}</b>places linked</div></div>
<h2>By month</h2><div class="years">${g}</div><p class="mute small">Dashed box = intercalary month (閏月).</p>
<h2>By 卷</h2><div class="juans">${js}</div>`;
  },
  juan(j) {
    j = +j; const rs = byJuan.get(j); if (!rs) return V.missing();
    const pg = `<div class="pager"><span>${byJuan.has(j - 1) ? `<a href="#/juan/${j - 1}">← 卷${j - 1}</a>` : ""}</span><span>${byJuan.has(j + 1) ? `<a href="#/juan/${j + 1}">卷${j + 1} →</a>` : ""}</span></div>`;
    main.innerHTML = `<h1>卷${j}</h1><p class="mute">${rs.length} records</p>${LEGEND}${pg}${listHTML(rs)}${pg}`;
  },
  month(k) {
    const rs = R.filter(r => mkey(r) === k); if (!rs.length) return V.missing();
    const x = months.findIndex(m => m.k === k), a = months[x - 1], b = months[x + 1], lab = m => m.e + (m.y === 1 ? "元" : cn(m.y)) + "年" + (m.l ? "閏" : "") + (m.m === 1 ? "正" : cn(m.m)) + "月";
    const pg = `<div class="pager"><span>${a ? `<a href="#/month/${a.k}">← ${lab(a)}</a>` : ""}</span><span>${b ? `<a href="#/month/${b.k}">${lab(b)} →</a>` : ""}</span></div>`;
    main.innerHTML = `<h1>${lab(months[x])}</h1><p class="mute">${rs.length} records</p>${LEGEND}${pg}${listHTML(rs)}${pg}`;
  },
  rec(id) {
    const r = byId.get(id); if (!r) return V.missing();
    V.juan(r.j); const el = document.getElementById("r" + id);
    if (el) { el.scrollIntoView({ block: "center" }); el.style.outline = "2px solid var(--acc)"; }
    return true;
  },
  entlist(t) {
    const all = [...ents[t].values()].sort((a, b) => b.recs.length - a.recs.length), what = t ? "place" : "person";
    main.innerHTML = `<h1>${t ? "Places" : "Persons"}</h1><p class="mute">${all.length.toLocaleString()} ${what}s with a ${t ? "TGAZ" : "CBDB"} id, by number of records. Names that could not be linked are not listed here; search the text for them.</p>
<input class="filter" id="flt" placeholder="filter by name"><table><thead><tr><th>name</th><th>id</th><th class="n">records</th></tr></thead><tbody id="tb"></tbody></table><p class="mute small" id="more"></p>`;
    const draw = q => {
      const hit = q ? all.filter(e => e.name.includes(q)) : all;
      $("#tb").innerHTML = hit.slice(0, 300).map(e => `<tr><td><a href="#/${what}/${e.id}">${esc(e.name)}</a></td><td class="mute">${esc(e.id)}</td><td class="n">${e.recs.length}</td></tr>`).join("");
      $("#more").textContent = hit.length > 300 ? `Showing 300 of ${hit.length.toLocaleString()}. Type a name to narrow the list.` : "";
    };
    $("#flt").addEventListener("input", e => draw(e.target.value.trim())); draw("");
  },
  ent(t, id) {
    const e = ents[t].get(id); if (!e) return V.missing();
    const url = t ? "https://tgaz.fudan.edu.cn/tgaz/placename/" + id : "https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=" + id;
    const conf = ["strong", "medium", "weak"].filter(c => e.conf[c]).map(c => `${e.conf[c]} ${c}`).join(", ");
    let shown = 100;
    const draw = () => {
      main.innerHTML = `<h1>${esc(e.name)}</h1><p><a href="${url}" target="_blank" rel="noopener">${t ? "TGAZ" : "CBDB"} ${esc(id)} ↗</a> · ${e.recs.length} records · links: ${conf}</p>
<p class="mute small">These links were made by rules and are not reviewed. A weak link may be another person or place of the same name.</p>${LEGEND}${listHTML(e.recs.slice(0, shown).map(x => R[x]))}
${e.recs.length > shown ? `<p><button id="morebtn" class="filter">Show 100 more (${e.recs.length - shown} left)</button></p>` : ""}`;
      const b = $("#morebtn"); if (b) b.onclick = () => { const y = scrollY; shown += 100; draw(); scrollTo(0, y); };
    };
    draw();
  },
  search(q) {
    q = decodeURIComponent(q); $("#q").value = q;
    const hits = q ? R.filter(r => r.t.includes(q)) : [];
    const snip = r => { const p = r.t.indexOf(q), a = Math.max(0, p - 30), b = Math.min(r.t.length, p + q.length + 50); return (a ? "…" : "") + esc(r.t.slice(a, p)) + "<mark>" + esc(q) + "</mark>" + esc(r.t.slice(p + q.length, b)) + (b < r.t.length ? "…" : ""); };
    main.innerHTML = `<h1>Search: ${esc(q)}</h1><p class="mute">${hits.length.toLocaleString()} records contain this string${hits.length > 300 ? "; the first 300 are shown" : ""}. The search matches the exact characters, and the text has OCR errors.</p>` +
      hits.slice(0, 300).map(r => `<div class="rec"><div class="txt">${snip(r)}</div><div class="meta"><a href="#/rec/${r.i}">${r.i}</a><span>卷${r.j}</span><span>${esc(dateLabel(r))}${r.w ? " · " + r.w : ""}</span></div></div>`).join("");
  },
  about() {
    main.innerHTML = `<h1>About this site</h1>
<p>This is a working draft from a project that turns the 明實錄 into a research database, with generative AI doing the reading and a historian setting the rules and checking the results.</p>
<p>Every step, with its rules, numbers, code and mistakes, is under <a href="#/process">How it was made</a>. The files are under <a href="#/downloads">Downloads</a>.</p><h2>The source</h2><p>The text was read by machine (OCR) from the 1966 Academia Sinica photographic reprint of the 紅格鈔本 of the 明孝宗實錄. Page numbers on this site are the printed page numbers of that edition. The text has not been proofread: expect wrong characters.</p>
<h2>How the table was made</h2><p>Page images were read by an OCR model. Rules cut the text into 卷, months and records at the marks ○ and △. Each record's day (干支) was turned into a Gregorian date with a calendar table and checked against the first day (朔) of every month. Cases the rules could not decide went to a historian on a review page.</p>
<h2>Persons and places</h2><p>A language model (Codex) listed the persons and places named in each record. Every string it returned was checked to be in the record, character for character. Scripts then looked each name up in the China Biographical Database (CBDB) and in the China Historical GIS place-name database (TGAZ), and chose among people of the same name by date and by offices named in the record. Offices themselves are not extracted.</p>
<p>Of ${Number(META.person_linked + META.person_unlinked).toLocaleString()} person strings, ${Number(META.person_linked).toLocaleString()} have a CBDB id. Of ${Number(META.place_linked + META.place_unlinked).toLocaleString()} place strings, ${Number(META.place_linked).toLocaleString()} have a TGAZ id. <b>These links have not been reviewed by a person.</b> Each link carries a confidence (strong, medium, weak) and the rule that made it; click a name to see them. Names with no id are still marked, with the reason.</p>
<h2>Known limits</h2><ul><li>OCR errors change names (for example 揚士奇 for 楊士奇), so some people are not found.</li><li>Eunuchs, minor officers, foreigners and many princes are not in CBDB.</li><li>TGAZ lacks many Ming frontier, military and regional names (遼東, 宣府, 直隸), and some ordinary places for these years.</li><li>What the language model missed has not been measured.</li></ul>
<p class="mute small">Built ${esc(META.built)}. Data: CBDB (Harvard University, Academia Sinica, Peking University); CHGIS/TGAZ (Harvard University, Fudan University).</p>`;
  },
  async process() {
    const P = await proc();
    main.innerHTML = `<h1>How it was made</h1>
<p>One 實錄 taken the whole way from the printed page to a database, with every step kept: what was done, the rule, the numbers, the code, and what went wrong. A model reads; rules and the calendar check; the historian decides what the rules cannot.</p>
<figure><img src="figures/fig1_pipeline.svg" alt="The pipeline in nine steps"><figcaption>Steps 00 to 08, the check on each, and where the historian decides. Step 09 (persons and places) came after this figure was drawn.</figcaption></figure>
<p><b>Time:</b> six calendar days; about 46.5 hours of machine time, of which the OCR is 43.1 hours; and a few hours of attention from the historian. <a href="#/time">The count, step by step</a>.</p>
<h2>The steps</h2><div class="steps">${P.steps.map(s => `<a class="stepcard" href="#/step/${s.id}"><b>${s.id}</b><span>${esc(s.title)}</span></a>`).join("")}
<a class="stepcard" href="#/compare"><b>test</b><span>Two readers compared: Codex and Qwen</span></a><a class="stepcard" href="#/time"><b>time</b><span>Time used, step by step</span></a><a class="stepcard" href="#/journal"><b>log</b><span>The journal, day by day</span></a><a class="stepcard" href="#/downloads"><b>files</b><span>Downloads</span></a></div>
<h2>The map of the work</h2><div class="md">${P.readme}</div>`;
  },
  async step(id) {
    const P = await proc(), x = P.steps.findIndex(s => s.id === id); if (x < 0) return V.missing();
    const S = await fetch(`data/steps/${id}.json`).then(r => r.json()), a = P.steps[x - 1], b = P.steps[x + 1];
    const pg = `<div class="pager"><span>${a ? `<a href="#/step/${a.id}">← ${a.id} ${esc(a.title)}</a>` : `<a href="#/process">← overview</a>`}</span><span>${b ? `<a href="#/step/${b.id}">${b.id} ${esc(b.title)} →</a>` : `<a href="#/journal">the journal →</a>`}</span></div>`;
    main.innerHTML = `<p class="mute small"><a href="#/process">How it was made</a> › step ${id}</p>${pg}<div class="steppage">${S.html}</div>${pg}`;
  },
  async compare() {
    const C = await fetch("data/compare.json").then(r => r.json());
    const who = x => x ? "Qwen" : "Codex";
    const callrow = c => `<tr><td>${who(c[0])}</td><td>${esc(c[1])}</td><td class="n">${c[2]}</td><td class="n">${c[3]}</td><td class="n">${c[4]}</td><td class="n">${c[5]}</td><td><code>${esc(c[6])}</code></td></tr>`;
    main.innerHTML = `<p class="mute small"><a href="#/process">How it was made</a> › <a href="#/step/09">step 09</a> › experiment</p><div class="md">${C.html}</div>
<h2>Every call</h2><p class="mute small">Seconds are for one batch of 25 records. Codex ran three batches at once, so its clock time is shorter than the sum. Codex's tokens were counted for the run as a whole, not per batch. The last column is the start of the prompt's fingerprint: the same in both runs.</p>
<table class="sample"><thead><tr><th>reader</th><th>batch</th><th class="n">records</th><th class="n">seconds</th><th class="n">tokens in</th><th class="n">tokens out</th><th>prompt</th></tr></thead><tbody>${C.calls.map(callrow).join("")}</tbody></table>
<h2>Every difference</h2><p>Each row is a string that one reader returned for a record and the other did not. Nobody has judged which reader is right. ${C.link}</p>
<p><select id="cw"><option value="">both readers</option><option value="0">only Codex</option><option value="1">only Qwen</option></select>
<select id="ct"><option value="">persons and places</option><option value="0">persons</option><option value="1">places</option></select>
<input id="cq" placeholder="filter by text, record or rule" size="28"> <span id="cn" class="mute small"></span></p>
<table class="sample"><thead><tr><th>only in</th><th>type</th><th>record</th><th>string</th><th>kind</th><th>what the linking rules did</th><th>linked to</th></tr></thead><tbody id="cb"></tbody></table>
<h2>Code</h2>${C.code}`;
    const draw = () => {
      const w = cw.value, t = ct.value, q = cq.value.trim();
      const rows = C.rows.filter(r => (w === "" || +r[0] === +w) && (t === "" || +r[1] === +t) && (!q || (r[2] + " " + r[3] + " " + r[5] + " " + r[6]).includes(q)));
      cn.textContent = rows.length + " of " + C.rows.length;
      cb.innerHTML = rows.map(r => `<tr><td>${who(r[0])}</td><td>${r[1] ? "place" : "person"}</td><td><a href="#/rec/${encodeURIComponent(r[2])}">${esc(r[2])}</a></td><td>${esc(r[3])}</td><td>${esc(r[4])}</td><td>${esc(r[5])}</td><td>${esc(r[6])}</td></tr>`).join("");
    };
    const cw = document.getElementById("cw"), ct = document.getElementById("ct"), cq = document.getElementById("cq"), cn = document.getElementById("cn"), cb = document.getElementById("cb");
    cw.onchange = ct.onchange = draw; cq.oninput = draw; draw();
  },
  async time() {
    const P = await proc();
    main.innerHTML = `<p class="mute small"><a href="#/process">How it was made</a> › time</p><div class="md">${P.time}</div>`;
  },
  async journal() {
    const P = await proc();
    main.innerHTML = `<p class="mute small"><a href="#/process">How it was made</a> › journal</p><div class="md">${P.journal}</div>`;
  },
  async downloads() {
    const P = await proc();
    main.innerHTML = `<h1>Downloads</h1><p>The table and the working files of the steps. The text is machine-read and not proofread; the links are not reviewed.</p>
<table><thead><tr><th>file</th><th>what</th><th>step</th><th class="n">size</th></tr></thead><tbody>${P.downloads.map(d => `<tr><td><a href="${esc(d.file)}" download>${esc(d.name)}</a></td><td>${esc(d.what)}</td><td><a href="#/step/${d.step}">${d.step}</a></td><td class="n">${esc(d.size)}</td></tr>`).join("")}</tbody></table>`;
  },
  async page(seq) {
    const n = parseInt(String(seq).slice(4), 10); if (isNaN(n) || n < 0 || n >= META.pages) return V.missing();
    const k = Math.floor(n / 100), key = String(k).padStart(2, "0");
    if (!pageCache.has(key)) pageCache.set(key, await fetch(`data/pages/${key}.json`).then(r => r.json()));
    const p = pageCache.get(key).find(x => x.q === seq); if (!p) return V.missing();
    const sq = i => "seq-" + String(i).padStart(4, "0"), recs = R.filter(r => r.q === seq);
    const pg = `<div class="pager"><span>${n > 0 ? `<a href="#/page/${sq(n - 1)}">← ${sq(n - 1)}</a>` : ""}</span><span><form id="goform">go to scan page <input id="go" size="5" value="${n}"></form></span><span>${n < META.pages - 1 ? `<a href="#/page/${sq(n + 1)}">${sq(n + 1)} →</a>` : ""}</span></div>`;
    const cols = p.t ? p.t.split("\n").map(l => `<div>${esc(l)}</div>`).join("") : "";
    main.innerHTML = `<h1>Page ${esc(seq)}</h1>
<p class="mute">Scan page ${n} of ${META.pages}. Margin labels of the 1966 edition, as read: ${p.mg && p.mg.length ? p.mg.map(esc).join(" · ") : "none"}. Status: ${esc(p.st)}${p.no ? " (" + esc(p.no) + ")" : ""}${p.sp ? " · full stops: " + esc(p.sp) : ""}. Model: ${esc(p.fr)}, ${esc(p.sec)} s.</p>${pg}
<h2>The text after cleaning (step 03)</h2><p class="mute small">Set as on the page: columns run top to bottom, right to left. A blank is a space the copyist left.</p>
${cols ? `<div class="vpage">${cols}</div>` : `<p class="mute">No text on this page.</p>`}
<h2>Records that begin on this page</h2>${recs.length ? recs.map(r => `<p><a href="#/rec/${r.i}">${r.i}</a> ${esc(dateLabel(r))} <span class="mute">${esc(r.t.slice(0, 40))}${r.t.length > 40 ? "…" : ""}</span></p>`).join("") : `<p class="mute">None.</p>`}
<h2>The model's raw answer (step 02)</h2><details><summary>Show the raw answer</summary><pre>${esc(p.raw)}</pre></details>${pg}`;
    $("#goform").addEventListener("submit", ev => { ev.preventDefault(); const v = parseInt($("#go").value, 10); if (!isNaN(v)) location.hash = "#/page/" + sq(v); });
  },
  missing() { main.innerHTML = `<h1>Not found</h1><p><a href="#/">Back to the start</a></p>`; },
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
  const n = R[+s.dataset.r].n[+s.dataset.n], t = n[0], what = t ? "place" : "person", e = n[4] && ents[t].get(n[4]);
  panel.innerHTML = `<button class="x" aria-label="close">×</button><h3>${esc(n[1])}</h3>
<p><span class="tag">${what}</span> ${n[4] ? `<span class="tag">${esc(n[3])} link</span>` : `<span class="tag">no id</span>`}</p>
${n[6] ? `<p>Full name as read by the model: ${esc(n[6])}</p>` : ""}
${n[4] ? `<p><b>${esc(n[5])}</b> · ${t ? "TGAZ" : "CBDB"} ${esc(n[4])} <a target="_blank" rel="noopener" href="${t ? "https://tgaz.fudan.edu.cn/tgaz/placename/" + esc(n[4]) : "https://cbdb.fas.harvard.edu/cbdbapi/person.php?id=" + esc(n[4])}">open ↗</a></p>` : ""}
<p class="small">${esc(METHOD[n[2].replace("+朱", "")] || n[2])}${n[2].endsWith("+朱") ? " Looked up with the surname 朱 added, as for an imperial clansman." : ""}</p>
<p>${e ? `<a href="#/${what}/${esc(n[4])}">All ${e.recs.length} records linked to this ${what}</a> · ` : ""}<a href="#/search/${encodeURIComponent(n[1])}">Search the text for ${esc(n[1])}</a></p>`;
  panel.hidden = false; panel.querySelector(".x").onclick = () => panel.hidden = true;
});
$("#searchform").addEventListener("submit", ev => { ev.preventDefault(); const q = $("#q").value.trim(); if (q) location.hash = "#/search/" + encodeURIComponent(q); });
Promise.all([fetch("data/records.json").then(r => r.json()), fetch("data/meta.json").then(r => r.json())])
  .then(([a, b]) => { R = a; META = b; index(); addEventListener("hashchange", route); route(); })
  .catch(e => { main.innerHTML = `<p>The records could not be loaded: ${esc(e.message)}</p>`; });
