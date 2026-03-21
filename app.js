console.log("Find the Chord: Logic Loaded");

const NOTE_OPTIONS = [
  "C",
  "C#",
  "Db",
  "D",
  "D#",
  "Eb",
  "E",
  "F",
  "F#",
  "Gb",
  "G",
  "G#",
  "Ab",
  "A",
  "A#",
  "Bb",
  "B",
];
const SCALE_LABELS = {
  major: "Major",
  minor: "Minor",
  mixolydian: "Mixolydian",
  dorian: "Dorian",
};

const DEGREE_ROMANS = ["I", "II", "III", "IV", "V", "VI", "VII"];

const MODE_TRIAD_QUALITIES = {
  major: ["maj", "min", "min", "maj", "maj", "min", "dim"],
  minor: ["min", "dim", "maj", "min", "min", "maj", "maj"],
  mixolydian: ["maj", "min", "dim", "maj", "min", "min", "maj"],
  dorian: ["min", "min", "maj", "maj", "min", "dim", "maj"],
};

/** @type {{ root: string; mode: keyof typeof MODE_TRIAD_QUALITIES }} */
/** @type {readonly string[]} */
const VOICING_MODES = ["spread", "close", "inv1", "inv2", "inv3", "drop2"];

const state = {
  root: "C",
  mode: "major",
  ext: "triad", // "triad" | "7" | "9"
  suggestTab: "diatonic", // "diatonic" | "smooth" | "spice"
  /** Playback voicing: spread, close, inv1–3, drop2 */
  voicing: "spread",
};

/** @type {{name: string; notes: string[]; roman: string; tag?: string; flavor?: string} | null} */
let currentChord = null;
/** @type {{ triads: any[]; smoothSubs: any[]; spice: any[] } | null} */
let lastSuggestions = null;
/** @type {Array<{label: string; name: string; roman: string}>} */
let history = [];
/** @type {Array<{name: string; roman: string; notes: string[]}>} */
let progression = [];
let progressionBpm = 90;
let progressionVoiceLeading = false;
let progressionLoop = false;
let progressionMetronome = false;
let progressionCursor = null; // null means append
/** @type {Array<Array<{name: string; roman: string; notes: string[]}>>} */
let undoStack = [];
/** @type {Array<Array<{name: string; roman: string; notes: string[]}>>} */
let redoStack = [];

let synth = null;
let audioReady = false;
let metroSynth = null;
let progressionIsPlaying = false;
let welcomeClosed = false;

const el = {
  rootSelect: document.getElementById("rootSelect"),
  scaleSelect: document.getElementById("scaleSelect"),
  scaleNotes: document.getElementById("scaleNotes"),
  statusLine: document.getElementById("statusLine"),
  diagBtn: document.getElementById("diagBtn"),
  howBtn: document.getElementById("howBtn"),
  howModal: document.getElementById("howModal"),
  howBackdrop: document.getElementById("howBackdrop"),
  welcomeModal: document.getElementById("welcomeModal"),
  welcomeEnableBtn: document.getElementById("welcomeEnableBtn"),
  welcomeLaterBtn: document.getElementById("welcomeLaterBtn"),
  hintPopup: document.getElementById("hintPopup"),
  hintBackdrop: document.getElementById("hintBackdrop"),
  hintCard: document.getElementById("hintCard"),
  hintArrow: document.getElementById("hintArrow"),
  howCloseBottomBtn: document.getElementById("howCloseBottomBtn"),
  suggestTitle: document.getElementById("suggestTitle"),
  suggestDesc: document.getElementById("suggestDesc"),
  tabDiatonic: document.getElementById("tabDiatonic"),
  tabSmooth: document.getElementById("tabSmooth"),
  tabSpice: document.getElementById("tabSpice"),
  suggestGrid: document.getElementById("suggestGrid"),
  currentChordName: document.getElementById("currentChordName"),
  currentRoman: document.getElementById("currentRoman"),
  currentChordPlayTile: document.getElementById("currentChordPlayTile"),
  currentNotes: document.getElementById("currentNotes"),
  addToProgBtn: document.getElementById("addToProgBtn"),
  progressionStrip: document.getElementById("progressionStrip"),
  bpmRange: document.getElementById("bpmRange"),
  bpmLabel: document.getElementById("bpmLabel"),
  vlToggle: document.getElementById("vlToggle"),
  copyProgBtn: document.getElementById("copyProgBtn"),
  loopToggle: document.getElementById("loopToggle"),
  metroToggle: document.getElementById("metroToggle"),
  undoProgBtn: document.getElementById("undoProgBtn"),
  redoProgBtn: document.getElementById("redoProgBtn"),
  playProgBtn: document.getElementById("playProgBtn"),
  clearProgBtn: document.getElementById("clearProgBtn"),
  historyStrip: document.getElementById("historyStrip"),
  clearHistoryBtn: document.getElementById("clearHistoryBtn"),
  audioBtn: document.getElementById("audioBtn"),
  colorTriad: document.getElementById("colorTriad"),
  color7: document.getElementById("color7"),
  color9: document.getElementById("color9"),
  piano: document.getElementById("piano"),
};

function setStatus(text) {
  if (!el.statusLine) return;
  el.statusLine.textContent = text || "";
}

function diagnosticsSnapshot() {
  const tonalOk = !!window.Tonal;
  const toneOk = !!window.Tone;
  const scaleName = `${state.root} ${state.mode}`;
  const scaleGetNotes = (() => {
    try {
      if (!tonalOk) return null;
      if (Tonal?.Scale?.get) return Tonal.Scale.get(scaleName)?.notes || null;
      if (Tonal?.Scale?.scale) return Tonal.Scale.scale(scaleName) || null;
      if (Tonal?.Scale?.notes) return Tonal.Scale.notes(scaleName) || null;
      return null;
    } catch (e) {
      return { error: e?.message || String(e) };
    }
  })();
  return {
    tonalOk,
    toneOk,
    tonalKeys: tonalOk ? Object.keys(window.Tonal).slice(0, 20) : [],
    scaleName,
    scaleApi: {
      hasGet: !!window.Tonal?.Scale?.get,
      hasScale: !!window.Tonal?.Scale?.scale,
      hasNotes: !!window.Tonal?.Scale?.notes,
    },
    rawScaleNotes: scaleGetNotes,
  };
}

function encodeStateToHash() {
  const obj = {
    v: 1,
    root: state.root,
    mode: state.mode,
    ext: state.ext,
    voc: state.voicing,
    tab: state.suggestTab,
    bpm: progressionBpm,
    vl: progressionVoiceLeading ? 1 : 0,
    loop: progressionLoop ? 1 : 0,
    metro: progressionMetronome ? 1 : 0,
    prog: (progression || []).map((p) => p.name),
  };
  const json = JSON.stringify(obj);
  // Base64url
  const b64 = btoa(unescape(encodeURIComponent(json)))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
  return `#s=${b64}`;
}

function decodeStateFromHash() {
  const h = location.hash || "";
  const m = h.match(/#s=([A-Za-z0-9\-_]+)/);
  if (!m) return null;
  try {
    const b64 = m[1].replaceAll("-", "+").replaceAll("_", "/");
    const pad = "=".repeat((4 - (b64.length % 4)) % 4);
    const json = decodeURIComponent(escape(atob(b64 + pad)));
    return JSON.parse(json);
  } catch {
    return null;
  }
}

let hashWriteTimer = null;
function persistToHash() {
  if (hashWriteTimer) window.clearTimeout(hashWriteTimer);
  hashWriteTimer = window.setTimeout(() => {
    const next = encodeStateToHash();
    if (location.hash !== next) history.replaceState(null, "", next);
  }, 50);
}

function chip(text, tone = "slate") {
  const map = {
    slate: "border-slate-800 bg-slate-950/50 text-slate-200",
    emerald: "border-emerald-400/20 bg-emerald-500/12 text-emerald-200",
    cyan: "border-cyan-400/20 bg-cyan-500/10 text-cyan-200",
  };
  const span = document.createElement("span");
  span.className =
    "inline-flex items-center rounded-xl border px-2.5 py-1 text-xs " + (map[tone] || map.slate);
  span.textContent = text;
  return span;
}

function normalizePc(note) {
  if (!note) return "";
  const pc = Tonal.Note.pitchClass(note) || "";
  const preferFlats = String(state.root || "").includes("b");
  // Tonal.Note.enharmonic(pc) toggles common #/b spellings (e.g. C# <-> Db)
  if (preferFlats && pc.includes("#")) return Tonal.Note.enharmonic(pc) || pc;
  if (!preferFlats && pc.includes("b")) return Tonal.Note.enharmonic(pc) || pc;
  return pc;
}

function chromaOf(note) {
  try {
    const c = Tonal.Note.chroma(note);
    return typeof c === "number" ? c : null;
  } catch {
    return null;
  }
}

function uniqBy(arr, keyFn) {
  const seen = new Set();
  const out = [];
  for (const item of arr) {
    const k = keyFn(item);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(item);
  }
  return out;
}

function safeClone(val) {
  try {
    return structuredClone(val);
  } catch {
    return JSON.parse(JSON.stringify(val));
  }
}

function sameSet(a, b) {
  if (a.length !== b.length) return false;
  const s = new Set(a);
  for (const x of b) if (!s.has(x)) return false;
  return true;
}

function setIntersectCount(a, b) {
  const s = new Set(a);
  let c = 0;
  for (const x of b) if (s.has(x)) c++;
  return c;
}

function romanForDegree(degreeIndex, quality) {
  let r = DEGREE_ROMANS[degreeIndex] || "?";
  if (quality === "min") r = r.toLowerCase();
  if (quality === "dim") r = r.toLowerCase() + "°";
  return r;
}

function triadSuffix(quality) {
  if (quality === "maj") return "";
  if (quality === "min") return "m";
  if (quality === "dim") return "dim";
  return "";
}

function qualityFromChordName(name, fallback = "maj") {
  if (!name) return fallback;
  const n = String(name);
  if (n.includes("dim") || n.includes("o")) return "dim";
  if (n.includes("m7b5")) return "dim";
  // crude but effective: if it has "m" after root (e.g. Cm7, F#m9)
  const m = n.match(/^[A-G](?:#|b)?m/);
  if (m) return "min";
  return "maj";
}

function chordNotesFromScaleDegree(scaleNotes, degreeIndex, ext) {
  const picks =
    ext === "9"
      ? [0, 2, 4, 6, 1]
      : ext === "7"
      ? [0, 2, 4, 6]
      : [0, 2, 4];
  return picks.map((o) => scaleNotes[(degreeIndex + o) % 7]).map(normalizePc).filter(Boolean);
}

function detectChordName(rootPc, notes) {
  try {
    const detected = Tonal.Chord.detect(notes) || [];
    const wantedPrefix = String(rootPc);
    const exact = detected.find((n) => n.startsWith(wantedPrefix));
    return exact || detected[0] || `${rootPc}`;
  } catch {
    return `${rootPc}`;
  }
}

function diatonicChords(root, mode, ext) {
  const scaleNotes = computeScaleNotes(root, mode);
  const qualities = MODE_TRIAD_QUALITIES[mode];
  const chords = [];
  for (let i = 0; i < 7; i++) {
    const notes = chordNotesFromScaleDegree(scaleNotes, i, ext);
    const rootPc = scaleNotes[i];
    const name =
      ext === "triad"
        ? `${rootPc}${triadSuffix(qualities[i])}`
        : detectChordName(rootPc, notes);
    const baseQuality = ext === "triad" ? qualities[i] : qualityFromChordName(name, qualities[i]);
    const romanBase = romanForDegree(i, baseQuality);
    const roman = ext === "triad" ? romanBase : `${romanBase}${ext === "7" ? "7" : "9"}`;
    chords.push({
      kind: "diatonic",
      degree: i,
      quality: baseQuality,
      roman,
      name,
      notes,
    });
  }
  return { scaleNotes, chords };
}

function computeScaleNotes(root, mode) {
  const scaleName = `${root} ${mode}`;
  let notes = [];
  try {
    if (Tonal?.Scale?.get) {
      notes = Tonal.Scale.get(scaleName)?.notes || [];
    } else if (Tonal?.Scale?.scale) {
      notes = Tonal.Scale.scale(scaleName) || [];
    } else if (Tonal?.Scale?.notes) {
      notes = Tonal.Scale.notes(scaleName) || [];
    }
  } catch {
    notes = [];
  }
  return (notes || []).map(normalizePc).filter(Boolean);
}

function diatonicTriads(root, mode) {
  // Backward compatibility: keep older callers working.
  const { scaleNotes, chords } = diatonicChords(root, mode, "triad");
  return { scaleNotes, triads: chords };
}

function buildSmoothSubs(triads) {
  // Smooth subs: any *other* diatonic triads that share 2+ notes with a given triad.
  // This captures relative major/minor and mediants naturally.
  const subs = [];
  for (const a of triads) {
    for (const b of triads) {
      if (a.name === b.name) continue;
      if (setIntersectCount(a.notes, b.notes) >= 2) subs.push(b);
    }
  }
  return uniqBy(subs, (x) => x.name);
}

function buildBorrowedChords(root, mode) {
  // Borrowed from parallel major/minor (match current chord type where possible)
  const parallelMode = mode === "minor" || mode === "dorian" ? "major" : "minor";
  const { chords: parallelChords } = diatonicChords(root, parallelMode, state.ext);
  const { chords: currentChords } = diatonicChords(root, mode, state.ext);
  const currentNames = new Set(currentChords.map((t) => t.name));

  const borrowed = parallelChords
    .filter((t) => !currentNames.has(t.name))
    .map((t) => ({
      kind: "borrowed",
      name: t.name,
      notes: t.notes,
      roman: t.roman,
      tag: `Borrowed (${SCALE_LABELS[parallelMode]})`,
    }));

  // Keep it tight (common borrowed moves tend to be a subset)
  return borrowed.slice(0, 6);
}

function buildSecondaryDominants(root, mode) {
  const { chords } = diatonicChords(root, mode, state.ext);
  // V of ii..vii (exclude I target)
  const out = [];
  for (let targetDegree = 1; targetDegree < 7; targetDegree++) {
    const target = chords[targetDegree];
    const domRoot = normalizePc(Tonal.Note.transpose(target.notes[0], "5P"));
    const name = `${domRoot}7`;
    const notes = (Tonal.Chord.get(name)?.notes || []).map(normalizePc);
    out.push({
      kind: "secdom",
      name,
      notes,
      roman: `V/${target.roman}`,
      tag: "Secondary Dominant",
    });
  }
  return out;
}

function buildTritoneSubs(secDoms) {
  return secDoms.map((sd) => {
    const ttRoot = normalizePc(Tonal.Note.transpose(sd.notes[0], "4A"));
    const name = `${ttRoot}7`;
    const notes = (Tonal.Chord.get(name)?.notes || []).map(normalizePc);
    return {
      kind: "tritone",
      name,
      notes,
      roman: `TT ${sd.roman}`,
      tag: "Tritone Sub",
    };
  });
}

function renderScaleNotes(scaleNotes) {
  el.scaleNotes.innerHTML = "";
  for (const n of scaleNotes) el.scaleNotes.appendChild(chip(n, "slate"));
}

function buttonForChord(ch, opts = {}) {
  const btn = document.createElement("button");
  const accent =
    opts.accent === "emerald"
      ? "border-emerald-400/20 bg-emerald-500/8 hover:bg-emerald-500/12"
      : opts.accent === "cyan"
      ? "border-cyan-400/20 bg-cyan-500/8 hover:bg-cyan-500/12"
      : "border-slate-800 bg-slate-950/35 hover:bg-slate-950/55";

  btn.className =
    "group w-full rounded-xl border px-3 py-2 text-left transition active:scale-[0.99] focus:outline-none focus:ring-2 focus:ring-emerald-500/20 " +
    accent;

  const top = document.createElement("div");
  top.className = "flex items-center justify-between gap-2";

  const name = document.createElement("div");
  name.className = "text-sm font-semibold tracking-tight text-slate-100";
  name.textContent = ch.name;

  const roman = document.createElement("div");
  roman.className =
    "text-[11px] font-medium text-slate-300/90 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-0.5";
  roman.textContent = ch.roman || "—";

  top.appendChild(name);
  top.appendChild(roman);

  const sub = document.createElement("div");
  sub.className = "mt-1 text-[11px] text-slate-400";
  const tag = ch.tag ? ch.tag : opts.tag ? opts.tag : "";
  sub.textContent = tag || ch.notes.join(" • ");

  btn.appendChild(top);
  btn.appendChild(sub);

  btn.addEventListener("click", () => {
    setCurrentChord({
      name: ch.name,
      notes: ch.notes,
      roman: ch.roman || "—",
      tag: ch.tag,
    });
    playCurrentChord();
  });

  return btn;
}

function tabMeta(tab) {
  if (tab === "smooth") {
    return {
      title: "Smooth Subs",
      desc: "Relative/mediant-style substitutes that share 2+ notes.",
      accent: "cyan",
    };
  }
  if (tab === "spice") {
    return {
      title: "Harmonic Spice",
      desc: "Secondary dominants, borrowed chords, and tritone substitutions.",
      accent: "slate",
    };
  }
  return {
    title: "Diatonic",
    desc: "The 7 primary chords of the scale.",
    accent: "emerald",
  };
}

function renderSuggestionTabs() {
  const t = state.suggestTab;
  const active = "bg-slate-900/60 text-slate-100";
  const inactive = "text-slate-300 hover:bg-slate-900/40";
  const btns = [
    [el.tabDiatonic, "diatonic"],
    [el.tabSmooth, "smooth"],
    [el.tabSpice, "spice"],
  ];
  for (const [btn, key] of btns) {
    if (!btn) continue;
    btn.className =
      "px-3 py-2 text-xs rounded-lg transition w-full text-center whitespace-nowrap " +
      (t === key ? active : inactive);
  }
}

function renderSuggestGrid() {
  if (!el.suggestGrid) return;
  el.suggestGrid.innerHTML = "";
  if (!lastSuggestions) return;

  const meta = tabMeta(state.suggestTab);
  if (el.suggestTitle) el.suggestTitle.textContent = meta.title;
  if (el.suggestDesc) el.suggestDesc.textContent = meta.desc;
  renderSuggestionTabs();

  const list =
    state.suggestTab === "smooth"
      ? lastSuggestions.smoothSubs
      : state.suggestTab === "spice"
      ? lastSuggestions.spice
      : lastSuggestions.triads;

  const accent =
    state.suggestTab === "smooth" ? "cyan" : state.suggestTab === "spice" ? "slate" : "emerald";
  for (const item of list) el.suggestGrid.appendChild(buttonForChord(item, { accent }));
}

function renderGrids({ triads, smoothSubs, spice }) {
  lastSuggestions = { triads, smoothSubs, spice };
  renderSuggestGrid();
}

function renderCurrent() {
  el.currentChordName.textContent = currentChord?.name || "—";
  el.currentRoman.textContent = currentChord?.roman || "—";
  el.currentNotes.innerHTML = "";
  if (currentChord?.notes?.length) {
    for (const n of currentChord.notes) el.currentNotes.appendChild(chip(n, "emerald"));
  }
  if (el.currentChordPlayTile) {
    const playable = !!(currentChord?.notes?.length);
    el.currentChordPlayTile.disabled = !playable;
    el.currentChordPlayTile.title = playable
      ? `Play: ${currentChord?.name || ""}`
      : "No chord to play yet";
  }
  renderPianoHighlights(currentChord?.notes || []);
}

function historyLabel(ch) {
  return `${ch.name} • ${ch.roman}`;
}

function pushHistory(ch) {
  const item = { label: historyLabel(ch), name: ch.name, roman: ch.roman };
  history = [item, ...history.filter((x) => x.label !== item.label)].slice(0, 5);
  renderHistory();
}

function renderProgression() {
  el.progressionStrip.innerHTML = "";
  if (!progression.length) {
    const empty = document.createElement("div");
    empty.className = "text-sm text-slate-500";
    empty.textContent = "Click Add to build a progression you control.";
    el.progressionStrip.appendChild(empty);
    return;
  }

  progression.forEach((p, idx) => {
    const wrap = document.createElement("div");
    wrap.className =
      "flex items-center gap-1.5 rounded-xl border border-slate-800 bg-slate-950/35 px-2 py-1.5 text-xs text-slate-200";
    if (idx === progressionCursor) {
      wrap.className += " ring-2 ring-cyan-500/25";
    }

    const main = document.createElement("button");
    main.className = "px-2 py-1 rounded-lg hover:bg-slate-950/60 transition";
    main.textContent = `${p.name} • ${p.roman}`;
    main.addEventListener("click", () => {
      setCurrentChord({ name: p.name, roman: p.roman, notes: p.notes });
      playCurrentChord();
      progressionCursor = idx;
      renderProgression();
    });

    const left = document.createElement("button");
    left.className =
      "w-7 h-7 grid place-items-center rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-950/70 transition";
    left.textContent = "←";
    left.title = "Move left";
    left.disabled = idx === 0;
    left.style.opacity = idx === 0 ? "0.4" : "1";
    left.addEventListener("click", (e) => {
      e.stopPropagation();
      if (idx === 0) return;
      commitProgressionChange((prev) => {
        const next = prev.slice();
        const tmp = next[idx - 1];
        next[idx - 1] = next[idx];
        next[idx] = tmp;
        progressionCursor = idx - 1;
        return next;
      });
    });

    const right = document.createElement("button");
    right.className =
      "w-7 h-7 grid place-items-center rounded-lg border border-slate-800 bg-slate-950/40 hover:bg-slate-950/70 transition";
    right.textContent = "→";
    right.title = "Move right";
    right.disabled = idx === progression.length - 1;
    right.style.opacity = idx === progression.length - 1 ? "0.4" : "1";
    right.addEventListener("click", (e) => {
      e.stopPropagation();
      if (idx === progression.length - 1) return;
      commitProgressionChange((prev) => {
        const next = prev.slice();
        const tmp = next[idx + 1];
        next[idx + 1] = next[idx];
        next[idx] = tmp;
        progressionCursor = idx + 1;
        return next;
      });
    });

    const del = document.createElement("button");
    del.className =
      "w-7 h-7 grid place-items-center rounded-lg border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/16 text-rose-100 transition";
    del.textContent = "×";
    del.title = "Remove";
    del.addEventListener("click", (e) => {
      e.stopPropagation();
      commitProgressionChange((prev) => {
        const next = prev.filter((_, i) => i !== idx);
        if (typeof progressionCursor === "number") {
          if (progressionCursor === idx) progressionCursor = null;
          else if (progressionCursor > idx) progressionCursor -= 1;
        }
        return next;
      });
    });

    wrap.appendChild(left);
    wrap.appendChild(main);
    wrap.appendChild(right);
    wrap.appendChild(del);
    el.progressionStrip.appendChild(wrap);
  });
}

function renderHistory() {
  if (el.historyStrip) el.historyStrip.innerHTML = "";
  const targets = [el.historyStrip].filter(Boolean);
  if (!history.length) {
    for (const target of targets) {
      const empty = document.createElement("div");
      empty.className = "text-sm text-slate-500";
      empty.textContent = "No chords yet — click any suggestion to start a progression.";
      target.appendChild(empty);
    }
    return;
  }
  for (const h of history) {
    for (const target of targets) {
      const b = document.createElement("button");
      b.className =
        "rounded-xl border border-slate-800 bg-slate-950/35 px-3 py-2 text-xs text-slate-200 hover:bg-slate-950/55 active:scale-[0.99] transition";
      b.textContent = h.label;
      b.addEventListener("click", () => {
        const notes =
          (Tonal.Chord.get(h.name)?.notes || []).map(normalizePc) ||
          (currentChord?.notes || []);
        setCurrentChord({ name: h.name, roman: h.roman, notes });
        playCurrentChord();
      });
      target.appendChild(b);
    }
  }
}

function setCurrentChord(ch) {
  currentChord = {
    name: ch.name,
    notes: (ch.notes || []).map(normalizePc),
    roman: ch.roman || "—",
    tag: ch.tag,
  };
  pushHistory(currentChord);
  renderCurrent();
  renderColorButtons();
}

function renderColorButtons() {
  const active = "bg-slate-900/60 text-slate-100";
  const inactive = "text-slate-300 hover:bg-slate-900/40";
  const ext = currentChord?.name?.includes("9") ? "9" : currentChord?.name?.includes("7") ? "7" : "triad";
  const map = [
    [el.colorTriad, "triad"],
    [el.color7, "7"],
    [el.color9, "9"],
  ];
  for (const [btn, key] of map) {
    if (!btn) continue;
    btn.className =
      "px-3 py-2 text-xs rounded-lg transition w-full text-center whitespace-nowrap " +
      (ext === key ? active : inactive);
  }
}

function renderVoicingButtons() {
  const active =
    "voicing-btn px-2 sm:px-2.5 py-2 text-xs rounded-lg transition text-center whitespace-nowrap flex-1 min-w-[4.5rem] sm:flex-initial sm:min-w-0 bg-slate-900/60 text-slate-100";
  const inactive =
    "voicing-btn px-2 sm:px-2.5 py-2 text-xs rounded-lg transition text-center whitespace-nowrap flex-1 min-w-[4.5rem] sm:flex-initial sm:min-w-0 text-slate-300 hover:bg-slate-900/40";
  document.querySelectorAll(".voicing-btn[data-voicing]").forEach((btn) => {
    const m = btn.getAttribute("data-voicing");
    btn.className = m === state.voicing ? active : inactive;
  });
}

function chordVariantName(baseName, target) {
  const info = Tonal.Chord.get(baseName);
  const root = info?.tonic || info?.root || Tonal.Note.pitchClass(baseName) || "";
  const detected = baseName;
  const q = qualityFromChordName(detected, "maj");
  if (!root) return baseName;
  if (target === "triad") {
    return `${normalizePc(root)}${triadSuffix(q)}`;
  }
  if (target === "7") {
    if (q === "maj") return `${normalizePc(root)}maj7`;
    if (q === "min") return `${normalizePc(root)}m7`;
    if (q === "dim") return `${normalizePc(root)}m7b5`;
    return `${normalizePc(root)}7`;
  }
  if (target === "9") {
    if (q === "maj") return `${normalizePc(root)}maj9`;
    if (q === "min") return `${normalizePc(root)}m9`;
    if (q === "dim") return `${normalizePc(root)}m9b5`;
    return `${normalizePc(root)}9`;
  }
  return baseName;
}

function setCurrentChordVariant(target) {
  if (!currentChord?.name) return;
  state.ext = target;
  const name = chordVariantName(currentChord.name, target);
  const notes = (Tonal.Chord.get(name)?.notes || []).map(normalizePc);
  setCurrentChord({ name, roman: currentChord.roman, notes, tag: currentChord.tag });
  playCurrentChord();
  recomputeAndRender();
  persistToHash();
}

function addCurrentToProgression() {
  if (!currentChord?.name) return;
  commitProgressionChange((prev) => {
    const item = { name: currentChord.name, roman: currentChord.roman || "—", notes: currentChord.notes || [] };
    if (typeof progressionCursor === "number" && progressionCursor >= 0 && progressionCursor <= prev.length) {
      return [...prev.slice(0, progressionCursor + 1), item, ...prev.slice(progressionCursor + 1)];
    }
    return [...prev, item];
  });
}

function commitProgressionChange(nextOrFn) {
  undoStack.push(safeClone(progression));
  redoStack = [];
  progression = typeof nextOrFn === "function" ? nextOrFn(progression) : nextOrFn;
  renderProgression();
  syncUndoRedoButtons();
  persistToHash();
}

function syncUndoRedoButtons() {
  if (el.undoProgBtn) el.undoProgBtn.disabled = undoStack.length === 0;
  if (el.redoProgBtn) el.redoProgBtn.disabled = redoStack.length === 0;
  if (el.undoProgBtn) el.undoProgBtn.style.opacity = undoStack.length === 0 ? "0.5" : "1";
  if (el.redoProgBtn) el.redoProgBtn.style.opacity = redoStack.length === 0 ? "0.5" : "1";
}

function ensureAudio() {
  if (audioReady) return true;
  return false;
}

async function initAudio() {
  if (audioReady) return;

  // iOS Safari: resume() must run synchronously in the user gesture. Do not await
  // before creating synths or we leave the gesture and audio can stay blocked on some devices.
  const startPromise = Tone.start();

  // Create synths in the same synchronous turn as the click so the context is used in the gesture.
  synth = new Tone.PolySynth(Tone.FMSynth, {
    maxPolyphony: 8,
    volume: -10,
    options: {
      harmonicity: 2.0,
      modulationIndex: 10,
      oscillator: { type: "sine" },
      modulation: { type: "sine" },
      envelope: { attack: 0.02, decay: 0.25, sustain: 0.35, release: 1.25 },
      modulationEnvelope: { attack: 0.01, decay: 0.2, sustain: 0.2, release: 0.9 },
    },
  }).toDestination();

  metroSynth = new Tone.MembraneSynth({
    volume: -16,
    envelope: { attack: 0.001, decay: 0.15, sustain: 0, release: 0.01 },
  }).toDestination();

  await startPromise;

  audioReady = true;
  el.audioBtn.textContent = "Audio Enabled";
  el.audioBtn.className =
    "rounded-xl bg-emerald-500/12 border border-emerald-400/20 px-3 py-2 text-sm text-emerald-200 hover:bg-emerald-500/16 active:scale-[0.99] transition";
}

/** Root-position close stack: each tone above the previous in register. */
function closeVoicingStack(pitchClasses) {
  const arr = (pitchClasses || []).map(normalizePc).filter(Boolean);
  if (!arr.length) return [];
  let lastMidi = -Infinity;
  const out = [];
  let octave = 3;
  for (const pc of arr) {
    let o = octave;
    let note = `${pc}${o}`;
    let m = Tone.Frequency(note).toMidi();
    while (m <= lastMidi && o < 7) {
      o += 1;
      note = `${pc}${o}`;
      m = Tone.Frequency(note).toMidi();
    }
    out.push(note);
    lastMidi = m;
  }
  return out;
}

function rotatePcsLeft(pitchClasses, steps) {
  const a = (pitchClasses || []).map(normalizePc).filter(Boolean);
  if (!a.length) return [];
  const L = a.length;
  const n = ((steps % L) + L) % L;
  const out = [];
  for (let i = 0; i < L; i++) out.push(a[(i + n) % L]);
  return out;
}

function drop2Voicing(pitchClasses) {
  const clean = (pitchClasses || []).map(normalizePc).filter(Boolean);
  const close = closeVoicingStack(clean);
  if (close.length < 3) return close;
  try {
    if (close.length === 3) {
      const lowered = Tonal.Note.transpose(close[1], "-8P");
      return [close[0], lowered, close[2]].sort(
        (x, y) => Tone.Frequency(x).toMidi() - Tone.Frequency(y).toMidi()
      );
    }
    const i = close.length - 2;
    const lowered = Tonal.Note.transpose(close[i], "-8P");
    const replaced = [...close];
    replaced[i] = lowered;
    return replaced.sort((x, y) => Tone.Frequency(x).toMidi() - Tone.Frequency(y).toMidi());
  } catch {
    return spreadVoicing(clean);
  }
}

function voicingForPlayback(pitchClasses, mode) {
  const clean = (pitchClasses || []).map(normalizePc).filter(Boolean);
  if (!clean.length) return [];
  switch (mode) {
    case "spread":
      return spreadVoicing(clean);
    case "close":
      return closeVoicingStack(clean);
    case "inv1":
      return closeVoicingStack(rotatePcsLeft(clean, 1));
    case "inv2":
      return closeVoicingStack(rotatePcsLeft(clean, 2));
    case "inv3":
      return closeVoicingStack(rotatePcsLeft(clean, 3));
    case "drop2":
      return drop2Voicing(clean);
    default:
      return spreadVoicing(clean);
  }
}

function spreadVoicing(pitchClasses) {
  const pcs = (pitchClasses || []).map(normalizePc);
  if (!pcs.length) return [];

  // Root low, other tones higher; keep ascending for lush voicing.
  const root = pcs[0];
  const others = pcs.slice(1);

  const voiced = [];
  const rootNote = `${root}3`;
  voiced.push(rootNote);

  let lastMidi = Tone.Frequency(rootNote).toMidi();
  let octave = 4;
  for (const pc of others) {
    let note = `${pc}${octave}`;
    let midi = Tone.Frequency(note).toMidi();
    while (midi <= lastMidi) {
      octave += 1;
      note = `${pc}${octave}`;
      midi = Tone.Frequency(note).toMidi();
      if (octave > 6) break;
    }
    voiced.push(note);
    lastMidi = midi;
    octave = Math.max(4, Math.min(5, octave)); // keep it from climbing too fast
  }
  return voiced;
}

function voiceLedVoicing(pitchClasses, prevVoiced) {
  const pcs = (pitchClasses || []).map(normalizePc).filter(Boolean);
  if (!pcs.length) return [];

  const root = pcs[0];
  const others = pcs.slice(1);

  const bass = `${root}3`;
  const bassMidi = Tone.Frequency(bass).toMidi();

  const prevUpper = Array.isArray(prevVoiced) ? prevVoiced.slice(1) : [];
  const prevMidis = prevUpper.map((n) => Tone.Frequency(n).toMidi());

  /** Choose a note name for a pitch class near target midi. */
  function chooseNear(pc, targetMidi, minMidi) {
    // Candidate octaves in a musical range for upper voices
    const candidates = [];
    for (let oct = 4; oct <= 6; oct++) {
      const n = `${pc}${oct}`;
      candidates.push({ n, m: Tone.Frequency(n).toMidi() });
    }
    candidates.sort((a, b) => Math.abs(a.m - targetMidi) - Math.abs(b.m - targetMidi));
    const pick = candidates.find((c) => c.m > minMidi) || candidates[candidates.length - 1];
    return pick.n;
  }

  const voiced = [bass];
  let lastMidi = bassMidi;

  for (let i = 0; i < others.length; i++) {
    const pc = others[i];
    const target = typeof prevMidis[i] === "number" ? prevMidis[i] : 72; // default around C5
    const chosen = chooseNear(pc, target, lastMidi + 1);
    voiced.push(chosen);
    lastMidi = Tone.Frequency(chosen).toMidi();
  }

  return voiced;
}

function playCurrentChord() {
  if (!currentChord?.notes?.length) return;
  if (!ensureAudio()) return;
  const voiced = voicingForPlayback(currentChord.notes, state.voicing);
  const now = Tone.now();
  synth.triggerAttackRelease(voiced, 1.6, now, 0.9);
}

function playProgression() {
  if (!progression.length) return;
  if (!ensureAudio()) return;
  const beat = 60 / Math.max(40, Math.min(240, progressionBpm || 90));
  const step = beat * 2; // half-note feel
  const dur = Math.max(0.55, step * 0.75);

  // Cancel any previously scheduled events (so repeated presses don't stack)
  try {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
  } catch {}

  let prev = null;
  const items = progression.slice();
  const loopLen = items.length * step;

  Tone.Transport.bpm.value = progressionBpm || 90;
  Tone.Transport.loop = !!progressionLoop;
  Tone.Transport.loopStart = 0;
  Tone.Transport.loopEnd = loopLen;

  items.forEach((p, i) => {
    const t = i * step;
    Tone.Transport.schedule((time) => {
      const voiced = progressionVoiceLeading
        ? voiceLedVoicing(p.notes || [], prev)
        : voicingForPlayback(p.notes || [], state.voicing);
      if (!voiced.length) return;
      synth.triggerAttackRelease(voiced, dur, time, 0.85);
      prev = voiced;
    }, t);

    if (progressionMetronome && metroSynth) {
      // Tick on each beat; higher pitch on downbeat of the chord
      Tone.Transport.schedule((time) => {
        const isDown = i === 0;
        metroSynth.triggerAttackRelease(isDown ? "C5" : "C4", "32n", time, 0.55);
      }, t);
    }
  });

  if (!progressionLoop) {
    // Auto-stop at the end so the button reverts to Play.
    Tone.Transport.scheduleOnce(() => {
      stopProgression();
    }, loopLen);
  }

  Tone.Transport.start("+0.05");
  progressionIsPlaying = true;
  if (el.playProgBtn) el.playProgBtn.textContent = "Stop";
}

function stopProgression() {
  try {
    Tone.Transport.stop();
    Tone.Transport.cancel(0);
  } catch {}
  progressionIsPlaying = false;
  if (el.playProgBtn) el.playProgBtn.textContent = "Play";
}

function buildPiano() {
  el.piano.innerHTML = "";

  const whiteOrder = ["C", "D", "E", "F", "G", "A", "B"];
  const blacksAfter = { C: "C#", D: "D#", F: "F#", G: "G#", A: "A#" };

  const whiteRow = document.createElement("div");
  whiteRow.className = "piano-white-row";

  // 2 octaves: C3..B4 (14 whites)
  const whiteKeys = [];
  for (let octave = 3; octave <= 4; octave++) {
    for (const n of whiteOrder) {
      const pc = normalizePc(n);
      whiteKeys.push({ pc, octave, label: `${n}${octave}` });
    }
  }

  whiteKeys.forEach((k) => {
    const key = document.createElement("div");
    key.className = "piano-key piano-white";
    key.dataset.pc = k.pc;
    key.dataset.chroma = String(chromaOf(k.pc) ?? "");
    key.title = k.label;
    const lab = document.createElement("div");
    lab.className = "piano-label";
    lab.textContent = k.label;
    key.appendChild(lab);
    whiteRow.appendChild(key);
  });

  el.piano.appendChild(whiteRow);

  // Add black keys positioned over the grid.
  // Each white key cell width includes gap; we position by percentage.
  // For each octave, black keys sit after specific white degrees.
  const totalWhites = 14;
  const gapPx = 6;

  function whiteIndexFor(octave, noteLetter) {
    const base = octave === 3 ? 0 : 7;
    return base + whiteOrder.indexOf(noteLetter);
  }

  for (let octave = 3; octave <= 4; octave++) {
    for (const [after, black] of Object.entries(blacksAfter)) {
      const i = whiteIndexFor(octave, after);
      if (i < 0) continue;
      const blackKey = document.createElement("div");
      blackKey.className = "piano-key piano-black";
      blackKey.dataset.pc = normalizePc(black);
      blackKey.dataset.chroma = String(chromaOf(blackKey.dataset.pc) ?? "");
      blackKey.title = `${black}${octave}`;

      // Position: start at left of its white cell, then shift right.
      // Use CSS calc with percentage plus px for gaps.
      const leftPercent = (i / totalWhites) * 100;
      blackKey.style.left = `calc(${leftPercent}% + ${gapPx * i}px + 65%)`;
      el.piano.appendChild(blackKey);
    }
  }
}

function renderPianoHighlights(pitchClasses) {
  const chromas = new Set(
    (pitchClasses || [])
      .map((n) => chromaOf(n))
      .filter((c) => typeof c === "number")
      .map((c) => String(c))
  );
  const keys = el.piano.querySelectorAll("[data-chroma]");
  for (const k of keys) {
    const on = chromas.has(String(k.dataset.chroma || ""));
    k.classList.toggle("is-on", on);
  }
}

function recomputeAndRender() {
  const { scaleNotes, chords } = diatonicChords(state.root, state.mode, state.ext);
  setStatus(
    `Key: ${state.root} ${state.mode} • chordType=${state.ext} • scaleNotes=${scaleNotes?.length || 0} • diatonic=${chords?.length || 0}`
  );

  if (!scaleNotes?.length || !chords?.length) {
    throw new Error(`No scale/chords returned for "${state.root} ${state.mode}".`);
  }

  renderScaleNotes(scaleNotes);

  const smoothSubs = buildSmoothSubs(chords);

  const secDoms = buildSecondaryDominants(state.root, state.mode);
  const tritones = buildTritoneSubs(secDoms);
  const borrowed = buildBorrowedChords(state.root, state.mode);

  const spice = uniqBy([...secDoms, ...borrowed, ...tritones], (x) => `${x.kind}:${x.name}:${x.roman}`);
  renderGrids({ triads: chords, smoothSubs, spice });

  // Default chord if none selected
  if (!currentChord) setCurrentChord(chords[0]);
}

function initSelectors() {
  el.rootSelect.innerHTML = "";
  for (const n of NOTE_OPTIONS) {
    const opt = document.createElement("option");
    opt.value = n;
    opt.textContent = n;
    el.rootSelect.appendChild(opt);
  }
  el.rootSelect.value = state.root;
  el.scaleSelect.value = state.mode;

  el.rootSelect.addEventListener("change", () => {
    state.root = el.rootSelect.value;
    currentChord = null;
    recomputeAndRender();
    persistToHash();
  });
  el.scaleSelect.addEventListener("change", () => {
    state.mode = el.scaleSelect.value;
    currentChord = null;
    recomputeAndRender();
    persistToHash();
  });
}

el.clearHistoryBtn.addEventListener("click", () => {
  history = [];
  renderHistory();
});

function openHow() {
  if (!el.howModal) return;
  closeHint();
  el.howModal.classList.remove("hidden");
  el.howModal.setAttribute("aria-hidden", "false");
}

function closeHow() {
  if (!el.howModal) return;
  el.howModal.classList.add("hidden");
  el.howModal.setAttribute("aria-hidden", "true");
}

function closeWelcome() {
  if (!el.welcomeModal) return;
  el.welcomeModal.classList.add("hidden");
  el.welcomeModal.setAttribute("aria-hidden", "true");
  welcomeClosed = true;
  // Show hint pointing to How It Works after a short delay
  setTimeout(openHint, 350);
}

function openHint() {
  if (!el.hintPopup || !el.hintCard || !el.howBtn || !el.hintArrow) return;
  const btn = el.howBtn.getBoundingClientRect();
  const card = el.hintCard;
  const arrow = el.hintArrow;
  const cardWidth = 220;
  const gap = 8;
  const arrowHalf = 8; // arrow total width 16px (border-l-8 + border-r-8)
  // Center card under button, clamped to viewport
  let left = btn.left + (btn.width / 2) - (cardWidth / 2);
  left = Math.max(12, Math.min(left, window.innerWidth - cardWidth - 12));
  const cardLeft = left;
  el.hintPopup.classList.remove("hidden");
  el.hintPopup.setAttribute("aria-hidden", "false");
  card.style.left = `${cardLeft}px`;
  card.style.top = `${btn.bottom + gap}px`;
  card.style.width = `${cardWidth}px`;
  // Point arrow at button center (for both large and small screens)
  const btnCenterX = btn.left + btn.width / 2;
  const arrowLeft = btnCenterX - cardLeft - arrowHalf;
  arrow.style.left = `${Math.round(arrowLeft)}px`;
}

function closeHint() {
  if (!el.hintPopup) return;
  el.hintPopup.classList.add("hidden");
  el.hintPopup.setAttribute("aria-hidden", "true");
}

el.howBtn?.addEventListener("click", () => openHow());
el.howCloseBottomBtn?.addEventListener("click", () => closeHow());
el.howBackdrop?.addEventListener("click", () => closeHow());
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    closeHow();
    closeHint();
  }
});
el.hintBackdrop?.addEventListener("click", () => closeHint());

el.addToProgBtn?.addEventListener("click", () => addCurrentToProgression());

function setSuggestTab(tab) {
  state.suggestTab = tab;
  renderSuggestGrid();
  persistToHash();
}

el.tabDiatonic?.addEventListener("click", () => setSuggestTab("diatonic"));
el.tabSmooth?.addEventListener("click", () => setSuggestTab("smooth"));
el.tabSpice?.addEventListener("click", () => setSuggestTab("spice"));

el.clearProgBtn?.addEventListener("click", () => {
  stopProgression();
  commitProgressionChange([]);
});

el.playProgBtn?.addEventListener("click", () => {
  if (progressionIsPlaying) stopProgression();
  else playProgression();
});

el.undoProgBtn?.addEventListener("click", () => {
  if (!undoStack.length) return;
  redoStack.push(safeClone(progression));
  progression = undoStack.pop();
  progressionCursor = null;
  renderProgression();
  syncUndoRedoButtons();
  persistToHash();
});

el.redoProgBtn?.addEventListener("click", () => {
  if (!redoStack.length) return;
  undoStack.push(safeClone(progression));
  progression = redoStack.pop();
  progressionCursor = null;
  renderProgression();
  syncUndoRedoButtons();
  persistToHash();
});

function progressionText() {
  if (!progression.length) return "";
  return progression.map((p) => p.name).join(" \u2192 ");
}

async function copyTextToClipboard(text) {
  if (!text) return false;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fallback below
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.position = "fixed";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

el.copyProgBtn?.addEventListener("click", async () => {
  const text = progressionText();
  const ok = await copyTextToClipboard(text);
  setStatus(ok ? `Copied progression: ${text}` : `Copy failed. Progression: ${text}`);
});

function syncProgressionControls() {
  if (el.bpmRange) el.bpmRange.value = String(progressionBpm);
  if (el.bpmLabel) el.bpmLabel.textContent = String(progressionBpm);
  if (el.vlToggle) el.vlToggle.checked = !!progressionVoiceLeading;
  if (el.loopToggle) el.loopToggle.checked = !!progressionLoop;
  if (el.metroToggle) el.metroToggle.checked = !!progressionMetronome;
  syncUndoRedoButtons();
}

el.bpmRange?.addEventListener("input", () => {
  progressionBpm = Number(el.bpmRange.value) || 90;
  if (el.bpmLabel) el.bpmLabel.textContent = String(progressionBpm);
  persistToHash();
});

el.vlToggle?.addEventListener("change", () => {
  progressionVoiceLeading = !!el.vlToggle.checked;
  persistToHash();
});

el.loopToggle?.addEventListener("change", () => {
  progressionLoop = !!el.loopToggle.checked;
  persistToHash();
});

el.metroToggle?.addEventListener("change", () => {
  progressionMetronome = !!el.metroToggle.checked;
  persistToHash();
});

el.diagBtn?.addEventListener("click", () => {
  const snap = diagnosticsSnapshot();
  const pretty = JSON.stringify(snap, null, 2);
  setStatus(`Diagnostics:\n${pretty}`);
});

el.colorTriad?.addEventListener("click", () => setCurrentChordVariant("triad"));
el.color7?.addEventListener("click", () => setCurrentChordVariant("7"));
el.color9?.addEventListener("click", () => setCurrentChordVariant("9"));
el.currentChordPlayTile?.addEventListener("click", () => playCurrentChord());

document.querySelectorAll(".voicing-btn[data-voicing]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const v = btn.getAttribute("data-voicing");
    if (v && VOICING_MODES.includes(v)) {
      state.voicing = v;
      renderVoicingButtons();
      persistToHash();
      playCurrentChord();
    }
  });
});

async function handleEnableAudio() {
  try {
    await initAudio();
  } catch (e) {
    console.error(e);
    el.audioBtn.textContent = "Audio blocked (tap again)";
  }
}
// Click and pointerdown so iOS gets unlock in the same gesture as the tap (click can fire late)
el.audioBtn.addEventListener("click", handleEnableAudio);
el.audioBtn.addEventListener("pointerdown", handleEnableAudio);

// Welcome popup: Enable Audio enables and closes; Maybe Later just closes
async function welcomeEnableAndClose() {
  await handleEnableAudio();
  closeWelcome();
}
el.welcomeEnableBtn?.addEventListener("click", welcomeEnableAndClose);
el.welcomeEnableBtn?.addEventListener("pointerdown", welcomeEnableAndClose);
el.welcomeLaterBtn?.addEventListener("click", () => closeWelcome());
el.welcomeLaterBtn?.addEventListener("pointerdown", () => closeWelcome());

// Unlock audio on first tap elsewhere only after welcome was dismissed (so welcome = first action)
document.addEventListener("pointerdown", async () => {
  if (!audioReady && welcomeClosed) {
    try {
      await initAudio();
    } catch {
      // ignore; user can click Enable Audio
    }
  }
}, { once: true });

// Boot
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve(src);
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

async function ensureTonal() {
  window.Tonal = window.Tonal || window.tonal; // some builds expose `tonal`
  if (window.Tonal) return { ok: true, loadedFrom: "already-present" };

  const candidates = [
    // jsDelivr official browser bundle
    "https://cdn.jsdelivr.net/npm/tonal/browser/tonal.min.js",
    // unpkg mirror (same package path)
    "https://unpkg.com/tonal/browser/tonal.min.js",
  ];

  const errors = [];
  for (const src of candidates) {
    try {
      await loadScript(src);
      window.Tonal = window.Tonal || window.tonal;
      if (window.Tonal) return { ok: true, loadedFrom: src };
    } catch (e) {
      errors.push(e?.message || String(e));
    }
  }
  return { ok: false, errors };
}

function showLibError(details) {
  const box = document.getElementById("libError");
  if (!box) return;
  box.classList.remove("hidden");
  if (details) {
    const d = document.createElement("div");
    d.className = "mt-2 text-xs text-rose-100/80";
    d.textContent = details;
    box.appendChild(d);
  }
}

(async () => {
  // Restore state from shareable URL hash (best-effort).
  const saved = decodeStateFromHash();
  if (saved?.root) state.root = saved.root;
  if (saved?.mode) state.mode = saved.mode;
  if (saved?.ext) state.ext = saved.ext;
  if (saved?.voc && VOICING_MODES.includes(saved.voc)) state.voicing = saved.voc;
  if (saved?.tab) state.suggestTab = saved.tab;
  if (typeof saved?.bpm === "number") progressionBpm = saved.bpm;
  if (typeof saved?.vl === "number") progressionVoiceLeading = !!saved.vl;
  if (typeof saved?.loop === "number") progressionLoop = !!saved.loop;
  if (typeof saved?.metro === "number") progressionMetronome = !!saved.metro;

  initSelectors(); // should always populate the dropdown, even if libs fail
  syncProgressionControls();
  renderHistory();
  renderProgression();
  renderVoicingButtons();
  buildPiano(); // visual-only; no libs required

  const tonal = await ensureTonal();
  setStatus(
    `Booted • Tonal=${!!window.Tonal} (from=${tonal.ok ? tonal.loadedFrom : "failed"}) • Tone=${!!window.Tone}`
  );

  if (!tonal.ok || !window.Tonal || !Tonal.Scale) {
    showLibError(
      tonal.ok
        ? `Tonal loaded but Scale API missing. Tonal keys: ${Object.keys(window.Tonal).slice(0, 20).join(", ")}`
        : `Tonal failed to load. ${tonal.errors?.[0] || ""}`
    );
    return;
  }

  try {
    recomputeAndRender();
    if (Array.isArray(saved?.prog) && saved.prog.length) {
      progression = saved.prog
        .map((name) => {
          const notes = (Tonal.Chord.get(name)?.notes || []).map(normalizePc);
          return { name, roman: "—", notes };
        })
        .filter((p) => p.name && p.notes?.length);
      undoStack = [];
      redoStack = [];
      progressionCursor = null;
      renderProgression();
      syncUndoRedoButtons();
    }
  } catch (e) {
    console.error(e);
    showLibError(`Chord engine crashed: ${e?.message || String(e)}`);
  }

  if (!window.Tone) {
    // Audio is optional; keep UI working.
    el.audioBtn.textContent = "Audio unavailable (Tone.js blocked)";
  }
})();

