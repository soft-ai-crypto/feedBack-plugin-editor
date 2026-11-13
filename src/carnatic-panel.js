/* Carnatic notation panel — shown only on a Carnatic Mandolin track.
 * Markup lives in screen.html; Apply replaces that track's notes via
 * the ordinary DeleteNotesCmd + AddNoteCmd history path.
 */

import { buildRaga, GAMAKAS, JATIS, TALAS, janyaOptions, melakartaOptions, ragaKey, talaBeats, talaGrouping } from './carnatic.js';
import { eventsToEditorNotes, parseNotation } from './carnatic-notation.js';
import { AddNoteCmd, DeleteNotesCmd } from './commands.js';
import { host } from './host.js';
import { _isCarnaticMandolinArr } from './instrument.js';
import { notes } from './notes.js';
import { S } from './state.js';
import { getTabBPM } from './sync-tempo.js';
import { _marksSanitizePure } from './tempo-marks.js';
import { MIN_MEASURE, TempoGridCmd, _tempoAppendBarlinePure, _tempoRebarEveryNPure, _tempoRemapMarksByTime } from './tempo.js';
import { _editorEscHtml, setStatus } from './ui.js';

class CompositeCmd {
    constructor(cmds) { this.cmds = cmds; }
    exec() { for (const c of this.cmds) c.exec(); }
    rollback() { for (let i = this.cmds.length - 1; i >= 0; i--) this.cmds[i].rollback(); }
}

function $panel() { return document.getElementById('editor-carnatic-panel'); }

function _ragaOptionsHtml(options) {
    return options.map((o) => {
        const aka = (o.aka || []).join('|');
        return `<option value="${_editorEscHtml(o.value)}" data-name="${_editorEscHtml(o.name)}" data-aka="${_editorEscHtml(aka)}">${_editorEscHtml(o.label)}</option>`;
    }).join('');
}

// Type-to-search on the native select: "maya" jumps to Mayamalavagowla.
// Matches the visible name, then extra search text, then the full label
// (so a number still works). Accents and case are ignored.
function _bindRagaTypeahead(sel) {
    if (sel.dataset.ragaTypeahead) return;
    sel.dataset.ragaTypeahead = '1';
    let query = '';
    let timer = 0;
    const arm = () => {
        clearTimeout(timer);
        timer = setTimeout(() => { query = ''; }, 1000);
    };
    const jump = () => {
        const q = ragaKey(query);
        if (!q) return;
        const opts = sel.options;
        let best = -1;
        let bestRank = 99;
        for (let i = 0; i < opts.length; i++) {
            const opt = opts[i];
            const name = ragaKey(opt.dataset.name || '');
            const aka = (opt.dataset.aka || '').split('|').map(ragaKey).filter(Boolean);
            const label = ragaKey(opt.textContent);
            let rank = 99;
            if (name.startsWith(q)) rank = 0;
            else if (aka.some((a) => a.startsWith(q))) rank = 1;
            else if (label.startsWith(q)) rank = 2;
            else if (name.includes(q) || aka.some((a) => a.includes(q))) rank = 3;
            if (rank < bestRank) {
                bestRank = rank;
                best = i;
                if (rank === 0) break;
            }
        }
        if (best >= 0) sel.selectedIndex = best;
    };
    sel.addEventListener('keydown', (e) => {
        if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
        if (e.key === 'Backspace') {
            query = query.slice(0, -1);
            e.preventDefault();
            arm();
            jump();
            return;
        }
        if (e.key.length !== 1) return;
        query += e.key;
        e.preventDefault();
        arm();
        jump();
    });
}

function fillRagas() {
    const sel = document.getElementById('editor-carnatic-raga');
    if (!sel) return;
    const melakarta = melakartaOptions();
    sel.innerHTML =
        `<optgroup label="Melakarta">${_ragaOptionsHtml(melakarta)}</optgroup>`
        + `<optgroup label="Janya">${_ragaOptionsHtml(janyaOptions())}</optgroup>`;
    if (melakarta[0]) sel.value = melakarta[0].value;
    _bindRagaTypeahead(sel);
}

function fillTalas() {
    const sel = document.getElementById('editor-carnatic-tala');
    if (!sel) return;
    const adi = TALAS.find((t) => t.n === 'Adi');
    const rest = TALAS.filter((t) => t.n !== 'Adi');
    const ordered = adi ? [adi, ...rest] : TALAS;
    sel.innerHTML = ordered.map((t) =>
        `<option value="${_editorEscHtml(t.n)}">${_editorEscHtml(t.n)}</option>`).join('');
    sel.value = 'Adi';
}

function fillJatis() {
    const sel = document.getElementById('editor-carnatic-jati');
    if (!sel) return;
    sel.innerHTML = JATIS.map((j) => {
        const label = `${j.n.charAt(0).toUpperCase()}${j.n.slice(1)} (${j.beats})`;
        return `<option value="${j.beats}">${_editorEscHtml(label)}</option>`;
    }).join('');
    sel.value = '4';
}

function _syncAdiJatiLock() {
    const talaEl = document.getElementById('editor-carnatic-tala');
    const jatiEl = document.getElementById('editor-carnatic-jati');
    if (!talaEl || !jatiEl) return;
    const locked = talaEl.value === 'Adi';
    if (locked) jatiEl.value = '4';
    jatiEl.disabled = locked;
}

function _updateTalaSummary() {
    const line = document.getElementById('editor-carnatic-tala-summary');
    if (!line) return;
    const talaName = (document.getElementById('editor-carnatic-tala') || {}).value;
    const tala = TALAS.find((t) => t.n === talaName) || TALAS.find((t) => t.n === 'Adi');
    const jati = Number((document.getElementById('editor-carnatic-jati') || {}).value) || 4;
    if (!tala) return;
    const grouping = talaGrouping(tala, jati);
    line.textContent = `${talaBeats(tala, jati)} beats: ${grouping.join('+')}`;
}

function showWarnings(list) {
    const ul = document.getElementById('editor-carnatic-warnings');
    if (!ul) return;
    ul.innerHTML = (list || []).map((w) => `<li>${_editorEscHtml(w)}</li>`).join('');
}

const CARNATIC_DEFAULT_RAGA = 'm:1';
const CARNATIC_DEFAULT_BPM = 90;
const CARNATIC_DEFAULT_GATI = 4;
const CARNATIC_DEFAULT_KALA = 1;
const CARNATIC_DEFAULT_TALA = 'Adi';
const CARNATIC_DEFAULT_JATI = 4;
const CARNATIC_GATI = new Set([3, 4, 5, 7, 9]);
const CARNATIC_KALA = new Set([1, 2, 4]);
const CARNATIC_TALA_NAMES = new Set(TALAS.map((t) => t.n));
const CARNATIC_JATI = new Set(JATIS.map((j) => j.beats));
const CARNATIC_NOTATION_MAX = 100000;
const CARNATIC_RAGA_RE = /^[mj]:\d{1,6}$/;
const CARNATIC_GRID_MAX_BARS = 200;

/** Append whole copies of the last complete bar until the last beat covers endTime. */
function _carnaticExtendGridTo(beats, endTime) {
    if (!Array.isArray(beats) || beats.length < 2 || !Number.isFinite(endTime)) return null;
    const lastBeat = beats[beats.length - 1];
    if (!lastBeat || !Number.isFinite(lastBeat.time) || endTime <= lastBeat.time) return null;
    const downbeats = [];
    for (let i = 0; i < beats.length; i++) {
        if (beats[i] && beats[i].measure > 0) downbeats.push(i);
    }
    if (downbeats.length < 2) return null;
    const lastDb = downbeats[downbeats.length - 1];
    const prevDb = downbeats[downbeats.length - 2];
    const tLastDb = Number(beats[lastDb].time);
    const tPrevDb = Number(beats[prevDb].time);
    const barDur = tLastDb - tPrevDb;
    if (!Number.isFinite(barDur) || !(barDur > 0)) return null;
    let working = beats;
    for (let n = 1; n <= CARNATIC_GRID_MAX_BARS; n++) {
        const lastT = working[working.length - 1] && working[working.length - 1].time;
        if (Number.isFinite(lastT) && lastT >= endTime) break;
        const appended = _tempoAppendBarlinePure(working, tLastDb + n * barDur, MIN_MEASURE);
        if (!appended || !appended.beats) break;
        working = appended.beats;
    }
    return working === beats ? null : working;
}

function _r6(t) { return Math.round(t * 1000000) / 1000000; }

/** Close or fill the last bar so it is a whole bar of `n` beats (times of existing beats stay). */
function _carnaticEnsureWholeLastBar(beats, n, bpm) {
    if (!Array.isArray(beats) || beats.length < 1 || !(n >= 1)) return beats;
    const db = [];
    for (let i = 0; i < beats.length; i++) {
        if (beats[i] && beats[i].measure > 0) db.push(i);
    }
    if (!db.length) return beats;
    const lastDb = db[db.length - 1];
    if (lastDb === beats.length - 1 && db.length >= 2) {
        const prev = db[db.length - 2];
        const have = lastDb - prev;
        if (have === n) return beats;
        if (have > n) return beats;
        const t0 = Number(beats[prev].time);
        const t1 = Number(beats[lastDb].time);
        if (!Number.isFinite(t0) || !Number.isFinite(t1) || !(t1 > t0)) return beats;
        const mid = beats.slice(prev + 1, lastDb).map((b) => ({ ...b }));
        for (let k = 1; k < n; k++) {
            const t = _r6(t0 + (t1 - t0) * k / n);
            if (mid.some((b) => Math.abs(b.time - t) < MIN_MEASURE)) continue;
            if (Math.abs(t - t0) < MIN_MEASURE || Math.abs(t - t1) < MIN_MEASURE) continue;
            mid.push({ time: t, measure: -1 });
        }
        mid.sort((a, b) => a.time - b.time);
        const filled = beats.slice(0, prev + 1).map((b) => ({ ...b }))
            .concat(mid, beats.slice(lastDb).map((b) => ({ ...b })));
        return _tempoRebarEveryNPure(filled, n) || filled;
    }
    const have = beats.length - lastDb;
    if (have > n) return beats;
    let barDur;
    if (db.length >= 2) {
        barDur = Number(beats[lastDb].time) - Number(beats[db[db.length - 2]].time);
    } else if (beats.length >= 2) {
        barDur = (Number(beats[beats.length - 1].time) - Number(beats[0].time)) / (beats.length - 1) * n;
    } else {
        const b = Number(bpm);
        barDur = n * 60 / (Number.isFinite(b) && b > 0 ? b : 90);
    }
    if (!Number.isFinite(barDur) || !(barDur > 0)) return beats;
    let tClose = Number(beats[lastDb].time) + barDur;
    const lastT = Number(beats[beats.length - 1].time);
    const missing = n - have;
    if (!(tClose > lastT + MIN_MEASURE)) {
        const beatDur = barDur / n;
        tClose = lastT + (missing + 1) * Math.max(beatDur, MIN_MEASURE);
    }
    const out = beats.map((b) => ({ ...b }));
    for (let k = 1; k <= missing; k++) {
        out.push({ time: _r6(lastT + (tClose - lastT) * k / (missing + 1)), measure: -1 });
    }
    const lastDen = beats[lastDb] && beats[lastDb].den;
    out.push({ time: _r6(tClose), measure: 1, den: lastDen !== undefined ? lastDen : 4 });
    return _tempoRebarEveryNPure(out, n) || out;
}

function _carnaticTalaMeterMarks(newBeats, n, grouping) {
    if (!Array.isArray(newBeats) || !(n >= 1)) return [];
    const db = [];
    for (let i = 0; i < newBeats.length; i++) {
        if (newBeats[i] && newBeats[i].measure > 0) db.push(i);
    }
    const raw = [];
    for (let k = 0; k + 1 < db.length; k++) {
        raw.push({
            measure: newBeats[db[k]].measure,
            kind: 'meter',
            num: n,
            den: 4,
            grouping,
        });
    }
    return _marksSanitizePure(raw);
}

const CARNATIC_GAMAKA_CODES = new Set(GAMAKAS.map((g) => g.code));
const CARNATIC_GAMAKA_MAX = 2000;

function _sanitizeGamakas(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const g = item.g;
        if (typeof g !== 'string' || !CARNATIC_GAMAKA_CODES.has(g)) continue;
        const s = item.s;
        if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > 4) continue;
        const t = item.t;
        if (typeof t !== 'number' || !Number.isFinite(t)) continue;
        out.push({ t: Math.round(t * 1000) / 1000, s, g });
        if (out.length >= CARNATIC_GAMAKA_MAX) break;
    }
    return out;
}

const CARNATIC_SYLLABLE_MAX = 5000;
const CARNATIC_SYLLABLE_LEN = 40;

function _sanitizeSyllables(raw) {
    if (!Array.isArray(raw)) return [];
    const out = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        let w = item.w;
        if (typeof w !== 'string' || /[\s\0]/.test(w)) continue;
        w = w.slice(0, CARNATIC_SYLLABLE_LEN);
        if (!w) continue;
        const s = item.s;
        if (typeof s !== 'number' || !Number.isInteger(s) || s < 0 || s > 4) continue;
        const t = item.t;
        if (typeof t !== 'number' || !Number.isFinite(t)) continue;
        out.push({ t: Math.round(t * 1000) / 1000, s, w });
        if (out.length >= CARNATIC_SYLLABLE_MAX) break;
    }
    return out;
}

/** Sanitized panel snapshot, or null when everything is at the empty default. */
export function sanitizeEditorCarnatic(raw) {
    if (!raw || typeof raw !== 'object') return null;
    let notation = typeof raw.notation === 'string' ? raw.notation : '';
    notation = notation.replace(/\0/g, '');
    if (notation.length > CARNATIC_NOTATION_MAX) notation = notation.slice(0, CARNATIC_NOTATION_MAX);
    let lyrics = typeof raw.lyrics === 'string' ? raw.lyrics : '';
    lyrics = lyrics.replace(/\0/g, '');
    if (lyrics.length > CARNATIC_NOTATION_MAX) lyrics = lyrics.slice(0, CARNATIC_NOTATION_MAX);
    let raga = typeof raw.raga === 'string' ? raw.raga.trim() : '';
    if (!CARNATIC_RAGA_RE.test(raga)) raga = CARNATIC_DEFAULT_RAGA;
    let bpm = Number(raw.bpm);
    if (!Number.isFinite(bpm)) bpm = CARNATIC_DEFAULT_BPM;
    bpm = Math.round(bpm);
    if (bpm < 30 || bpm > 240) bpm = CARNATIC_DEFAULT_BPM;
    let gati = Number(raw.gati);
    if (!CARNATIC_GATI.has(gati)) gati = CARNATIC_DEFAULT_GATI;
    let kala = Number(raw.kala);
    if (!CARNATIC_KALA.has(kala)) kala = CARNATIC_DEFAULT_KALA;
    let tala = typeof raw.tala === 'string' ? raw.tala.trim() : '';
    if (!CARNATIC_TALA_NAMES.has(tala)) tala = CARNATIC_DEFAULT_TALA;
    let jati = Number(raw.jati);
    if (!CARNATIC_JATI.has(jati)) jati = CARNATIC_DEFAULT_JATI;
    if (tala === CARNATIC_DEFAULT_TALA) jati = CARNATIC_DEFAULT_JATI;
    const gamakas = _sanitizeGamakas(raw.gamakas);
    const syllables = _sanitizeSyllables(raw.syllables);
    if (!notation.trim()
            && !lyrics.trim()
            && raga === CARNATIC_DEFAULT_RAGA
            && bpm === CARNATIC_DEFAULT_BPM
            && gati === CARNATIC_DEFAULT_GATI
            && kala === CARNATIC_DEFAULT_KALA
            && tala === CARNATIC_DEFAULT_TALA
            && jati === CARNATIC_DEFAULT_JATI) {
        if (!gamakas.length && !syllables.length) return null;
        const leftover = {};
        if (gamakas.length) leftover.gamakas = gamakas;
        if (syllables.length) leftover.syllables = syllables;
        return leftover;
    }
    const out = { notation, raga, bpm, gati, kala };
    if (lyrics) out.lyrics = lyrics;
    if (tala !== CARNATIC_DEFAULT_TALA) out.tala = tala;
    if (jati !== CARNATIC_DEFAULT_JATI) out.jati = jati;
    if (gamakas.length) out.gamakas = gamakas;
    if (syllables.length) out.syllables = syllables;
    return out;
}

function _panelSnapshot() {
    return sanitizeEditorCarnatic({
        raga: (document.getElementById('editor-carnatic-raga') || {}).value,
        bpm: (document.getElementById('editor-carnatic-bpm') || {}).value,
        gati: (document.getElementById('editor-carnatic-gati') || {}).value,
        kala: (document.getElementById('editor-carnatic-kala') || {}).value,
        tala: (document.getElementById('editor-carnatic-tala') || {}).value,
        jati: (document.getElementById('editor-carnatic-jati') || {}).value,
        notation: (document.getElementById('editor-carnatic-notation') || {}).value,
        lyrics: (document.getElementById('editor-carnatic-lyrics') || {}).value,
    });
}

let _filling = false;
let _bpmDisplayWrapped = false;

/** Write the panel controls onto the current arrangement (or drop the key). */
export function flushCarnaticPanel() {
    if (_filling) return;
    const arr = S.arrangements && S.arrangements[S.currentArr];
    if (!arr || !_isCarnaticMandolinArr(arr)) return;
    const payload = _panelSnapshot();
    if (payload) arr.editor_carnatic = payload;
    else delete arr.editor_carnatic;
}

function songBpmRounded() {
    const bpm = getTabBPM();
    if (!Number.isFinite(bpm) || bpm <= 0) return 120;
    return Math.round(bpm);
}

function fillCarnaticBpmFromSong() {
    const bpmEl = document.getElementById('editor-carnatic-bpm');
    if (bpmEl) bpmEl.value = String(songBpmRounded());
}

function fillCarnaticPanel(arr) {
    const data = sanitizeEditorCarnatic(arr && arr.editor_carnatic) || {
        notation: '',
        raga: CARNATIC_DEFAULT_RAGA,
        bpm: CARNATIC_DEFAULT_BPM,
        gati: CARNATIC_DEFAULT_GATI,
        kala: CARNATIC_DEFAULT_KALA,
    };
    _filling = true;
    try {
        const ragaEl = document.getElementById('editor-carnatic-raga');
        if (ragaEl) {
            ragaEl.value = data.raga;
            if (ragaEl.value !== data.raga) ragaEl.value = CARNATIC_DEFAULT_RAGA;
        }
        fillCarnaticBpmFromSong();
        const talaEl = document.getElementById('editor-carnatic-tala');
        if (talaEl) {
            talaEl.value = data.tala || CARNATIC_DEFAULT_TALA;
            if (talaEl.value !== (data.tala || CARNATIC_DEFAULT_TALA)) talaEl.value = CARNATIC_DEFAULT_TALA;
        }
        const jatiEl = document.getElementById('editor-carnatic-jati');
        if (jatiEl) jatiEl.value = String(data.jati ?? CARNATIC_DEFAULT_JATI);
        const gatiEl = document.getElementById('editor-carnatic-gati');
        if (gatiEl) gatiEl.value = String(data.gati);
        const kalaEl = document.getElementById('editor-carnatic-kala');
        if (kalaEl) kalaEl.value = String(data.kala);
        const textEl = document.getElementById('editor-carnatic-notation');
        if (textEl) textEl.value = data.notation;
        const lyricsEl = document.getElementById('editor-carnatic-lyrics');
        if (lyricsEl) lyricsEl.value = data.lyrics || '';
        _syncAdiJatiLock();
        _updateTalaSummary();
    } finally {
        _filling = false;
    }
}

function editorApplyCarnaticNotation() {
    const arr = S.arrangements && S.arrangements[S.currentArr];
    if (!arr || !_isCarnaticMandolinArr(arr)) return;
    const ragaKey = (document.getElementById('editor-carnatic-raga') || {}).value;
    const raga = buildRaga(ragaKey);
    if (!raga) {
        showWarnings(['Unknown rāga']);
        return;
    }
    fillCarnaticBpmFromSong();
    const bpm = Math.max(1, getTabBPM() || 90);
    const gati = Math.max(1, Number((document.getElementById('editor-carnatic-gati') || {}).value) || 4);
    const kala = Math.max(1, Number((document.getElementById('editor-carnatic-kala') || {}).value) || 1);
    const talaName = (document.getElementById('editor-carnatic-tala') || {}).value;
    const tala = TALAS.find((t) => t.n === talaName) || TALAS.find((t) => t.n === 'Adi');
    const jati = Number((document.getElementById('editor-carnatic-jati') || {}).value) || 4;
    const text = (document.getElementById('editor-carnatic-notation') || {}).value || '';
    const { ev, warn } = parseNotation(text, raga, false);
    const beats = S.beats || [];
    const t0 = beats.length && Number.isFinite(beats[0].time) ? beats[0].time : 0;
    const next = eventsToEditorNotes(ev, bpm, gati, kala).map((n) => ({ ...n, time: n.time + t0 }));
    const lyricsText = ((document.getElementById('editor-carnatic-lyrics') || {}).value || '').trim();
    if (lyricsText) {
        const words = lyricsText.split(/\s+/);
        let lastLyric = '';
        for (let i = 0; i < next.length; i++) {
            if (i >= words.length) break;
            const w = words[i];
            if (w === '_') continue;
            if (w === '-') {
                if (!lastLyric) continue;
                const n = next[i];
                if (!n.techniques) n.techniques = {};
                n.techniques.lyric = lastLyric;
            } else {
                const n = next[i];
                if (!n.techniques) n.techniques = {};
                n.techniques.lyric = w;
                lastLyric = w;
            }
        }
    }
    let endTime = -Infinity;
    for (const n of next) {
        const t = Number(n.time);
        if (!Number.isFinite(t)) continue;
        const sus = Number(n.sustain);
        const end = t + (Number.isFinite(sus) ? sus : 0);
        if (end > endTime) endTime = end;
    }
    const nn = notes();
    const cmds = [];
    if (nn.length) cmds.push(new DeleteNotesCmd(nn.map((_, i) => i)));
    for (const n of next) cmds.push(new AddNoteCmd(n));
    const N = tala ? talaBeats(tala, jati) : 0;
    const grouping = tala ? talaGrouping(tala, jati) : null;
    let newBeats = N >= 1 ? _tempoRebarEveryNPure(beats, N) : null;
    if (newBeats) {
        newBeats = _carnaticEnsureWholeLastBar(newBeats, N, bpm) || newBeats;
        const extended = _carnaticExtendGridTo(newBeats, endTime);
        if (extended) newBeats = _carnaticEnsureWholeLastBar(extended, N, bpm) || extended;
        const gridCmd = new TempoGridCmd(beats, newBeats, 'carnatic-grid');
        const remap = _tempoRemapMarksByTime(beats, newBeats);
        const kept = (remap ? remap.after : (S.tempoMarks || [])).filter((m) => m.kind !== 'meter');
        const meters = _carnaticTalaMeterMarks(newBeats, N, grouping);
        const after = kept.concat(meters).sort((a, b) => (a.measure - b.measure) || (a.kind < b.kind ? -1 : 1));
        gridCmd.marks = { before: S.tempoMarks || [], after };
        cmds.push(gridCmd);
    }
    if (cmds.length) S.history.exec(new CompositeCmd(cmds));
    showWarnings(warn);
    host.draw();
    host.updateStatus();
    setStatus(warn.length
        ? `Applied ${next.length} notes (${warn.length} warning${warn.length === 1 ? '' : 's'})`
        : `Applied ${next.length} notes`);
}

let _filledFor = null;
let _expandHome = null;

function _carnaticFieldWrap(id) {
    const el = document.getElementById(id);
    if (!el) return null;
    return el.closest('label') || el;
}

function _carnaticFieldTextarea(wrap) {
    if (!wrap) return null;
    if (wrap.tagName === 'TEXTAREA') return wrap;
    return wrap.querySelector('textarea');
}

function _carnaticExpandSnapshot(wrap) {
    const ta = _carnaticFieldTextarea(wrap);
    return {
        wrap,
        parent: wrap.parentNode,
        next: wrap.nextSibling,
        rows: ta ? ta.rows : 0,
        fontSize: ta ? ta.style.fontSize : '',
        height: ta ? ta.style.height : '',
        flex: ta ? ta.style.flex : '',
        minHeight: ta ? ta.style.minHeight : '',
        wrapDisplay: wrap.style.display,
        wrapFlexDir: wrap.style.flexDirection,
        wrapHeight: wrap.style.height,
        wrapFlex: wrap.style.flex,
        wrapMinHeight: wrap.style.minHeight,
    };
}

function _carnaticExpandEnlarge(wrap) {
    wrap.style.display = 'flex';
    wrap.style.flexDirection = 'column';
    wrap.style.height = '100%';
    wrap.style.flex = '1';
    wrap.style.minHeight = '0';
    const ta = _carnaticFieldTextarea(wrap);
    if (!ta) return;
    ta.rows = 18;
    ta.style.fontSize = '14px';
    ta.style.flex = '1';
    ta.style.minHeight = '0';
    ta.style.height = '100%';
}

function _carnaticExpandRestoreOne(h) {
    const ta = _carnaticFieldTextarea(h.wrap);
    if (ta) {
        ta.rows = h.rows;
        ta.style.fontSize = h.fontSize;
        ta.style.height = h.height;
        ta.style.flex = h.flex;
        ta.style.minHeight = h.minHeight;
    }
    h.wrap.style.display = h.wrapDisplay;
    h.wrap.style.flexDirection = h.wrapFlexDir;
    h.wrap.style.height = h.wrapHeight;
    h.wrap.style.flex = h.wrapFlex;
    h.wrap.style.minHeight = h.wrapMinHeight;
    if (h.parent) h.parent.insertBefore(h.wrap, h.next);
}

function editorCloseCarnaticExpand() {
    const modal = document.getElementById('editor-carnatic-expand-modal');
    if (_expandHome) {
        // Lyrics first: notation's saved nextSibling is the lyrics label.
        for (let i = _expandHome.length - 1; i >= 0; i--) {
            _carnaticExpandRestoreOne(_expandHome[i]);
        }
        _expandHome = null;
    }
    const ae = document.activeElement;
    if (modal && ae && modal.contains(ae) && typeof ae.blur === 'function') ae.blur();
    if (modal) modal.classList.add('hidden');
}

function editorOpenCarnaticExpand() {
    if (_expandHome) return;
    const modal = document.getElementById('editor-carnatic-expand-modal');
    const left = document.getElementById('editor-carnatic-expand-left');
    const right = document.getElementById('editor-carnatic-expand-right');
    const notationWrap = _carnaticFieldWrap('editor-carnatic-notation');
    const lyricsWrap = _carnaticFieldWrap('editor-carnatic-lyrics');
    if (!modal || !left || !right || !notationWrap || !lyricsWrap) return;
    _expandHome = [
        _carnaticExpandSnapshot(notationWrap),
        _carnaticExpandSnapshot(lyricsWrap),
    ];
    left.appendChild(notationWrap);
    right.appendChild(lyricsWrap);
    _carnaticExpandEnlarge(notationWrap);
    _carnaticExpandEnlarge(lyricsWrap);
    modal.classList.remove('hidden');
    const notation = document.getElementById('editor-carnatic-notation');
    if (notation) {
        notation.focus();
        if (document.activeElement !== notation) {
            requestAnimationFrame(() => notation.focus());
        }
    }
}

export function _carnaticPanelRefresh() {
    const panel = $panel();
    if (!panel) return;
    const arr = S.arrangements && S.arrangements[S.currentArr];
    const show = !!(arr && _isCarnaticMandolinArr(arr));
    if (!show) editorCloseCarnaticExpand();
    panel.classList.toggle('hidden', !show);
    // Fill on song open AND arrangement switch even when the panel stays
    // visible (two Carnatic Mandolin tracks). Do not refill every draw tick.
    const token = `${S.sessionId || ''}\0${S.currentArr}\0${show ? 1 : 0}`;
    if (_filledFor === token) return;
    _filledFor = token;
    if (show) fillCarnaticPanel(arr);
}

function _bindPanelPersist() {
    const ids = [
        'editor-carnatic-raga',
        'editor-carnatic-bpm',
        'editor-carnatic-gati',
        'editor-carnatic-kala',
        'editor-carnatic-tala',
        'editor-carnatic-jati',
        'editor-carnatic-notation',
        'editor-carnatic-lyrics',
    ];
    for (const id of ids) {
        const el = document.getElementById(id);
        if (!el || el.dataset.carnaticPersist) continue;
        el.dataset.carnaticPersist = '1';
        el.addEventListener('input', flushCarnaticPanel);
        el.addEventListener('change', flushCarnaticPanel);
    }
    const talaEl = document.getElementById('editor-carnatic-tala');
    if (talaEl && !talaEl.dataset.carnaticTalaUi) {
        talaEl.dataset.carnaticTalaUi = '1';
        talaEl.addEventListener('change', () => {
            _syncAdiJatiLock();
            _updateTalaSummary();
        });
    }
    const jatiEl = document.getElementById('editor-carnatic-jati');
    if (jatiEl && !jatiEl.dataset.carnaticJatiUi) {
        jatiEl.dataset.carnaticJatiUi = '1';
        jatiEl.addEventListener('change', _updateTalaSummary);
    }
}

export function initCarnaticPanel() {
    fillRagas();
    fillTalas();
    fillJatis();
    _syncAdiJatiLock();
    _updateTalaSummary();
    const btn = document.getElementById('editor-carnatic-apply');
    if (btn) btn.addEventListener('click', editorApplyCarnaticNotation);
    const collapseBtn = document.getElementById('editor-carnatic-collapse');
    if (collapseBtn && !collapseBtn.dataset.carnaticCollapseUi) {
        collapseBtn.dataset.carnaticCollapseUi = '1';
        collapseBtn.addEventListener('click', () => {
            const panel = $panel();
            if (!panel) return;
            const collapsed = collapseBtn.dataset.carnaticCollapsed === '1';
            const kids = panel.children;
            if (!collapsed) {
                for (let i = 1; i < kids.length; i++) {
                    const el = kids[i];
                    if (el.classList.contains('hidden')) {
                        el.dataset.carnaticCollapseWasHidden = '1';
                    } else {
                        el.classList.add('hidden');
                    }
                }
                collapseBtn.dataset.carnaticCollapsed = '1';
                collapseBtn.textContent = '▸';
                collapseBtn.title = 'Expand panel';
            } else {
                for (let i = 1; i < kids.length; i++) {
                    const el = kids[i];
                    if (el.dataset.carnaticCollapseWasHidden === '1') {
                        delete el.dataset.carnaticCollapseWasHidden;
                    } else {
                        el.classList.remove('hidden');
                    }
                }
                collapseBtn.dataset.carnaticCollapsed = '0';
                collapseBtn.textContent = '▾';
                collapseBtn.title = 'Collapse panel';
            }
        });
    }
    const expandBtn = document.getElementById('editor-carnatic-expand');
    if (expandBtn && !expandBtn.dataset.carnaticExpandUi) {
        expandBtn.dataset.carnaticExpandUi = '1';
        expandBtn.addEventListener('click', editorOpenCarnaticExpand);
    }
    const expandApply = document.getElementById('editor-carnatic-expand-apply');
    if (expandApply && !expandApply.dataset.carnaticExpandUi) {
        expandApply.dataset.carnaticExpandUi = '1';
        expandApply.addEventListener('click', editorApplyCarnaticNotation);
    }
    const expandClose = document.getElementById('editor-carnatic-expand-close');
    if (expandClose && !expandClose.dataset.carnaticExpandUi) {
        expandClose.dataset.carnaticExpandUi = '1';
        expandClose.addEventListener('click', editorCloseCarnaticExpand);
    }
    const expandModal = document.getElementById('editor-carnatic-expand-modal');
    if (expandModal && !expandModal.dataset.carnaticExpandKb) {
        expandModal.dataset.carnaticExpandKb = '1';
        expandModal.tabIndex = -1;
        expandModal.addEventListener('keydown', (e) => {
            e.stopPropagation();
            if (e.key === 'Escape') {
                e.preventDefault();
                editorCloseCarnaticExpand();
            }
        });
    }
    _bindPanelPersist();
    if (!_bpmDisplayWrapped) {
        const prev = host.updateBPMDisplay;
        host.updateBPMDisplay = (...a) => {
            const r = typeof prev === 'function' ? prev(...a) : undefined;
            fillCarnaticBpmFromSong();
            return r;
        };
        _bpmDisplayWrapped = true;
    }
    _filledFor = null;
    _carnaticPanelRefresh();
}
