/* Carnatic swara notation parser — ported from
 * reference/Carnatic_Swara_Player_1.html (parseNotation).
 * Uses raga maps, STR, and place() from carnatic.js. No DOM.
 */

import {
    SW, STR, SEMI_LABEL, mod12, place, unitSec,
} from './carnatic.js';

const mod = mod12;
// Playable-fret window used by the reference parser for auto-string
// checks (not FRET_MAX — that only clamps the written fret).
const WIN = 12;

const MK = /\[\s*(SWARA|SAHITYA)\s*\d*\s*\]/gi;

function maskLyrics(t) {
    const ms = [...t.matchAll(MK)];
    if (!ms.length) return t;
    const sp = (s) => s.replace(/[^\n]/g, ' ');
    let o = '', last = 0, mode = 's';
    ms.forEach((m) => {
        const seg = t.slice(last, m.index);
        o += mode === 's' ? seg : sp(seg);
        o += sp(m[0]);
        last = m.index + m[0].length;
        mode = m[1].toUpperCase() === 'SWARA' ? 's' : 'y';
    });
    const tail = t.slice(last);
    return o + (mode === 's' ? tail : sp(tail));
}

/**
 * Parse swara notation into events + warnings.
 * @param {string} text
 * @param {object} raga  from buildRaga()
 * @param {boolean} [strict]  skip out-of-raga notes (panel passes false)
 * @returns {{ ev: object[], warn: string[] }}
 */
export function parseNotation(text, raga, strict) {
    const ev = [], warn = [], dflt = null;
    let beat = 0, last = null, prev = null, dir = 1, pt = null, fs = dflt, kk = 0;
    text = maskLyrics(text.normalize('NFD'))
        .replace(/(?<=[SRGMPDNsrgmpdn0-9.'^\u0323\u0307])p(?=[SRGMPDNsrgmpdn])/g, '%')
        .replace(/h/g, '&');
    const tokens = [...text.matchAll(/\|+|[^\s|]+/g)];
    for (const tm of tokens) {
        const tok = tm[0];
        if (/^\|+$/.test(tok)) { ev.push({ t: 'bar', u: 0, pos: tm.index }); continue; }
        if (/^[,;]+$/.test(tok)) {
            const x = [...tok].reduce((a, c) => a + (c === ';' ? 2 : 1), 0);
            if (last) { last.u += x; } else ev.push({ t: 'r', u: x });
            beat += 1;
            continue;
        }
        const sl = [];
        const re = /([SRGMPDNsrgmpdn])([123])?([.'^\u0323\u0307]*)(@[1-5])?|(,)|(;)|(-)|(&|%|\/|\\|~|\*)|@([0-5])|(\S)/g;
        let m;
        while ((m = re.exec(tok))) {
            if (m[1]) {
                const L = m[1].toUpperCase();
                const semi = m[2] && L !== 'S' && L !== 'P' ? SW[L + m[2]] : raga.m[L];
                const lab = m[2] && L !== 'S' && L !== 'P' ? L + m[2] : L;
                const oct = (m[1] !== L ? -1 : 0) + [...m[3]].reduce((a, c) => a + (c === '.' || c === '\u0323' ? -1 : 1), 0);
                sl.push({
                    k: 'n',
                    semi: semi + 12 * oct,
                    lab: L + (oct > 0 ? '\u0307' : oct < 0 ? '\u0323' : '') + lab.slice(1),
                    w: 1,
                    pos: tm.index + m.index,
                    len: m[0].length,
                    fs: m[4] ? +m[4][1] - 1 : fs,
                    tech: pt,
                });
                pt = null;
            } else if (m[5]) sl.push({ k: 'c', w: 1 });
            else if (m[6]) sl.push({ k: 'c', w: 2 });
            else if (m[7]) sl.push({ k: 'r', w: 1 });
            else if (m[8]) pt = { '&': 'h', '%': 'p', '/': 's', '\\': 'd', '~': 'o', '*': 'g' }[m[8]];
            else if (m[9] !== undefined) fs = m[9] === '0' ? dflt : +m[9] - 1;
            else warn.push(`Beat ${beat + 1}: unknown symbol “${m[10]}”`);
        }
        const tot = sl.reduce((a, s) => a + s.w, 0) || 1;
        let cur = null;
        for (const s of sl) {
            const u = s.w / tot;
            if (s.k === 'c') {
                if (cur) cur.u += u;
                else if (last) last.u += u;
                else ev.push({ t: 'r', u });
                continue;
            }
            if (s.k === 'r') {
                ev.push(cur = last = { t: 'r', u });
                cur = null;
                last = null;
                continue;
            }
            let ok = true, msg = '';
            const c = mod(s.semi);
            if (prev !== null) {
                const d = Math.sign(s.semi - prev) || dir;
                if (s.semi !== prev) { dir = d; }
                const set = s.semi === prev ? null : (d > 0 ? raga.aroSet : raga.avaSet);
                const nm = d > 0 ? 'ārohaṇa' : 'avarohaṇa';
                if (set && !set.has(c)) { ok = false; msg = `${s.lab} is not in the ${nm} of ${raga.name}`; }
                else if (set && raga.vakra) {
                    const sc = raga.scale, a = sc.indexOf(mod(prev)), b = sc.indexOf(c);
                    const E = d > 0 ? raga.upE : raga.dnE;
                    if (a >= 0 && b >= 0 && Math.abs(a - b) === 1 && !E.has(mod(prev) + '>' + c)) {
                        ok = false;
                        msg = `${SEMI_LABEL[mod(prev)]}→${s.lab} breaks the vakra path of ${raga.name}`;
                    }
                }
            } else if (!raga.aroSet.has(c) && !raga.avaSet.has(c)) {
                ok = false;
                msg = `${s.lab} is not in ${raga.name}`;
            }
            if (!ok) warn.push(`Beat ${beat + 1}: ${msg}${strict ? ' (skipped)' : ''}`);
            if (!ok && strict) {
                ev.push(cur = last = { t: 'r', u });
                cur = last;
                continue;
            }
            prev = s.semi;
            let sf = s.fs;
            if (sf != null && (s.semi - STR[sf] < 0 || s.semi - STR[sf] > WIN)) {
                warn.push(`Beat ${beat + 1}: ${s.lab} can’t be played on string ${sf + 1}; using auto`);
                sf = null;
            }
            ev.push(cur = last = {
                t: 'n', semi: s.semi, lab: s.lab, u, beat: beat + 1,
                k: kk++, pos: s.pos, len: s.len, tech: s.tech, str: sf,
            });
        }
        beat++;
    }
    return { ev, warn };
}

/** Auto string when no legal @ is given. */
export function autoString(semi) {
    const open = STR.indexOf(semi);
    if (open >= 0) return open;
    let best = null, bestFret = Infinity;
    for (let s = 0; s < STR.length; s++) {
        const fret = semi - STR[s];
        if (fret >= 0 && fret <= WIN && fret < bestFret) {
            bestFret = fret;
            best = s;
        }
    }
    if (best != null) return best;
    if (semi >= 0 && semi <= WIN) return 2;
    if (semi < 0) return semi >= -5 ? 1 : 0;
    return 4;
}

/**
 * Convert parser events to editor notes. Skips rests and bars.
 * `str` from the parser is already 0–4; do not subtract 1 again.
 */
export function eventsToEditorNotes(ev, bpm, gati, kala) {
    const sec = unitSec(bpm, gati, kala);
    const out = [];
    let t = 0;
    for (const e of ev || []) {
        if (e.t === 'n') {
            let string = e.str;
            if (string == null) {
                const prev = out.length ? out[out.length - 1] : null;
                const linked = e.tech === 'h' || e.tech === 'p' || e.tech === 's' || e.tech === 'd';
                const stay = linked && prev && (e.semi - STR[prev.string] >= 0)
                    && (e.semi - STR[prev.string] <= WIN);
                string = stay ? prev.string : autoString(e.semi);
            }
            const fret = place(e.semi, string);
            const techniques = {};
            if (e.tech === 'h') techniques.hammer_on = true;
            else if (e.tech === 'p') techniques.pull_off = true;
            else if (e.tech === 'o' || e.tech === 'g') techniques.vibrato = true;
            else if ((e.tech === 's' || e.tech === 'd') && out.length) {
                const prev = out[out.length - 1];
                if (!prev.techniques) prev.techniques = {};
                prev.techniques.slide_to = fret;
            }
            out.push({
                time: t,
                string,
                fret,
                sustain: e.u * sec,
                techniques,
            });
        }
        t += (Number(e.u) || 0) * sec;
    }
    return out;
}
