const PEOPLE = [
  { id: "aamina", name: "Aamina", signer: "Sarmad" },
  { id: "hafsa", name: "Hafsa", signer: "Taaha" },
];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const LOCAL_KEY = "shower-log";
const pad = n => String(n).padStart(2, "0");
const iso = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const todayIso = () => iso(new Date());

const state = {
  view: (() => { const t = new Date(); return { y: t.getFullYear(), m: t.getMonth() }; })(),
  entries: {},          // key `${date}_${person}` -> {showered, signedBy, signedAt}
  selected: { aamina: todayIso(), hafsa: todayIso() },
  pick: { aamina: null, hafsa: null },
  sig: { aamina: "", hafsa: "" },
  msg: { aamina: null, hafsa: null },
  store: null,
};

// --- storage: Firestore when configured, otherwise this browser's localStorage ---

function firestoreStore(config) {
  firebase.initializeApp(config);
  const col = firebase.firestore().collection("log");
  return {
    shared: true,
    subscribe(onData, onError) {
      col.onSnapshot(snap => {
        const entries = {};
        snap.forEach(d => { entries[d.id] = d.data(); });
        onData(entries);
      }, onError);
    },
    save(id, data) { return col.doc(id).set(data); },
  };
}

function localStore() {
  let onData = () => {};
  const read = () => { try { return JSON.parse(localStorage.getItem(LOCAL_KEY)) || {}; } catch { return {}; } };
  return {
    shared: false,
    subscribe(cb) { onData = cb; cb(read()); },
    async save(id, data) {
      const all = read();
      all[id] = data;
      localStorage.setItem(LOCAL_KEY, JSON.stringify(all));
      onData(all);
    },
  };
}

// --- rendering ---

function fmtDate(s) {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
}

function monthStats(pid) {
  const { y, m } = state.view;
  const days = new Date(y, m + 1, 0).getDate();
  const t = todayIso();
  let yes = 0, no = 0, elapsed = 0;
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    if (k > t) break;
    elapsed++;
    const e = state.entries[`${k}_${pid}`];
    if (e?.showered === true) yes++; else if (e?.showered === false) no++;
  }
  // streak: consecutive showered days ending today (or yesterday if today isn't logged yet)
  let streak = 0;
  const c = new Date();
  if (!state.entries[`${iso(c)}_${pid}`]) c.setDate(c.getDate() - 1);
  while (state.entries[`${iso(c)}_${pid}`]?.showered === true) { streak++; c.setDate(c.getDate() - 1); }
  return { yes, no, elapsed, streak };
}

function render() {
  const { y, m } = state.view;
  document.getElementById("monthName").textContent = `${MONTHS[m]} ${y}`;
  const now = new Date();
  document.getElementById("next").disabled = y > now.getFullYear() || (y === now.getFullYear() && m >= now.getMonth());
  document.getElementById("people").replaceChildren(...PEOPLE.map(renderPerson));
}

function el(tag, attrs = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") e.className = v;
    else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
    else if (v !== false && v != null) e.setAttribute(k, v);
  }
  for (const k of kids) if (k != null) e.append(k);
  return e;
}

function renderPerson(p) {
  const st = monthStats(p.id);
  const sel = state.selected[p.id];
  const existing = state.entries[`${sel}_${p.id}`];
  const pick = state.pick[p.id] ?? (existing ? (existing.showered ? "yes" : "no") : null);
  const isToday = sel === todayIso();

  const head = el("div", { class: "phead" },
    el("h3", {}, p.name),
    el("div", { class: "verifier" }, "Verified by ", el("b", {}, p.signer)));

  const stats = el("div", { class: "stats" },
    el("div", { class: "stat" }, el("div", { class: "n" }, `${st.yes}/${st.elapsed}`), el("div", { class: "l" }, "days showered")),
    el("div", { class: "stat" }, el("div", { class: "n" }, String(st.no)), el("div", { class: "l" }, "days skipped")),
    el("div", { class: "stat" }, el("div", { class: "n" }, String(st.streak)), el("div", { class: "l" }, "day streak")));

  // vote form
  const q = el("p", { class: "q" },
    el("span", { class: "d" }, isToday ? "Today, " + fmtDate(sel).split(", ").slice(1).join(", ") : fmtDate(sel)),
    `Did ${p.name} shower${isToday ? " today" : ""}?`);
  const mkChoice = (v, label) => el("button", {
    class: "choice", "data-v": v, "aria-pressed": String(pick === v),
    onclick: () => { state.pick[p.id] = v; state.msg[p.id] = null; render(); },
  }, label);
  const sigId = `sig-${p.id}`;
  const sigInput = el("input", {
    class: "sigin", id: sigId, type: "text", autocomplete: "off", spellcheck: "false",
    placeholder: p.signer, value: state.sig[p.id],
  });
  const submit = el("button", { class: "submit", disabled: !pick || null }, existing ? "Update vote" : "Sign and record");
  sigInput.addEventListener("input", () => { state.sig[p.id] = sigInput.value; });
  sigInput.addEventListener("keydown", e => { if (e.key === "Enter") submit.click(); });
  submit.addEventListener("click", () => save(p, sel, pick));

  const msg = state.msg[p.id];
  const record = existing
    ? el("p", { class: "record" }, "On file: ",
        el("b", {}, existing.showered ? "Showered" : "Did not shower"),
        ", signed ", el("span", { class: "sig" }, existing.signedBy),
        existing.signedAt ? ` at ${new Date(existing.signedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "")
    : el("p", { class: "record" }, "No vote recorded for this day yet.");

  const vote = el("div", { class: "vote" },
    q,
    el("div", { class: "choices" }, mkChoice("yes", "Yes, showered"), mkChoice("no", "No")),
    el("div", { class: "sigrow" }, el("label", { for: sigId }, `Signature (${p.signer} must sign)`), sigInput),
    submit,
    el("p", { class: "msg" + (msg?.err ? " err" : "") }, msg?.text ?? ""),
    record);

  // calendar
  const { y, m } = state.view;
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const t = todayIso();
  const tiles = [];
  for (let i = 0; i < first; i++) tiles.push(el("span", { class: "tile pad", "aria-hidden": "true" }));
  for (let d = 1; d <= days; d++) {
    const k = `${y}-${pad(m + 1)}-${pad(d)}`;
    const e = state.entries[`${k}_${p.id}`];
    const future = k > t;
    const cls = ["tile",
      e ? (e.showered ? "yes" : "no") : "",
      future ? "future" : "", k === t ? "today" : "", k === sel ? "sel" : ""].join(" ");
    const label = `${MONTHS[m]} ${d}: ${e ? (e.showered ? "showered" : "did not shower") : future ? "upcoming" : "no vote"}`;
    tiles.push(el("button", {
      class: cls, "aria-label": label, title: label, disabled: future || null,
      onclick: () => { state.selected[p.id] = k; state.pick[p.id] = null; state.msg[p.id] = null; render(); },
    }, String(d)));
  }
  const cal = el("div", { class: "cal" },
    el("div", { class: "dow" }, ...["S","M","T","W","T","F","S"].map(x => el("span", {}, x))),
    el("div", { class: "grid" }, ...tiles),
    el("div", { class: "legend" },
      el("span", {}, el("i", { style: "background:var(--water)" }), "Showered"),
      el("span", {}, el("i", { style: "background:var(--mud)" }), "Skipped"),
      el("span", {}, el("i", { style: "background:var(--empty)" }), "No vote")));

  return el("section", { class: "person", "aria-label": p.name }, head, stats, vote, cal);
}

async function save(p, date, pick) {
  const typed = state.sig[p.id].trim();
  if (!pick) return;
  if (typed.toLowerCase() !== p.signer.toLowerCase()) {
    state.msg[p.id] = { err: true, text: typed ? `Only ${p.signer} can sign for ${p.name}. "${typed}" doesn't count.` : `${p.signer} needs to sign before this vote counts.` };
    return render();
  }
  try {
    await state.store.save(`${date}_${p.id}`, {
      date, person: p.id, showered: pick === "yes", signedBy: p.signer, signedAt: new Date().toISOString(),
    });
    state.pick[p.id] = null;
    state.sig[p.id] = "";
    state.msg[p.id] = { text: `Recorded. ${p.signer} signed for ${fmtDate(date)}.` };
  } catch (e) {
    state.msg[p.id] = { err: true, text: "The vote didn't save. Check your connection and try again." };
  }
  render();
}

document.getElementById("prev").onclick = () => { const v = state.view; v.m--; if (v.m < 0) { v.m = 11; v.y--; } render(); };
document.getElementById("next").onclick = () => { const v = state.view; v.m++; if (v.m > 11) { v.m = 0; v.y++; } render(); };
document.getElementById("todayBtn").onclick = () => {
  const t = new Date(); state.view = { y: t.getFullYear(), m: t.getMonth() };
  state.selected = { aamina: todayIso(), hafsa: todayIso() }; state.pick = { aamina: null, hafsa: null }; render();
};

render();

(() => {
  const status = document.getElementById("status");
  const notice = document.getElementById("notice");
  const config = window.FIREBASE_CONFIG;
  if (config && window.firebase) {
    state.store = firestoreStore(config);
  } else {
    state.store = localStore();
    notice.textContent = "Local mode: votes save only in this browser. Add your Firebase config to firebase-config.js so everyone shares one tracker.";
    notice.hidden = false;
  }
  state.store.subscribe(entries => {
    state.entries = entries;
    const n = Object.keys(entries).length;
    status.textContent = `${n} vote${n === 1 ? "" : "s"} on file`;
    render();
  }, () => { status.textContent = "Lost connection. Reload to retry."; });
})();
