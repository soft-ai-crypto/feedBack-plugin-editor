/* Plain-text Carnatic notation importer.
 * Turns a .txt (headers + [SWARA] lines) into the token string parseNotation
 * already understands. Does not call or change parseNotation.
 */

import {
    JANYA, TALAS, janyaOptions, melakartaOptions, ragaKey, talaBeats,
} from './carnatic.js';

function _akaNames(aka) {
    if (!aka) return [];
    const raw = Array.isArray(aka) ? aka : String(aka).split('|');
    return raw.map((s) => String(s).trim()).filter(Boolean);
}

const SWARA_LETTER = /[SRGMPDNsrgmpdn]/;
const OCTAVE_MARK = /[\u0307\u0323]/;
const VALID_GATI = new Set(['3', '4', '5', '7', '9']);
const MARKER_RE = /^\[\s*(SWARA|SAHITYA)\s*\d*\s*\]\s*$/i;
const HEADER_RE = /^\[([^:\]]+):\s*(.*)\]\s*$/;

function findRagaSelectValue(name) {
    const key = ragaKey(name);
    if (!key) return null;
    const ji = JANYA.findIndex((j) => (
        ragaKey(j.name) === key
        || _akaNames(j.aka).some((a) => ragaKey(a) === key)
    ));
    if (ji >= 0) return janyaOptions()[ji].value;
    const mela = melakartaOptions().find((o) => (
        ragaKey(o.name) === key
        || (o.aka || []).some((a) => ragaKey(a) === key)
    ));
    return mela ? mela.value : null;
}

function findTalaName(raw) {
    const name = String(raw || '').split(' (')[0].trim();
    if (!name) return null;
    const hit = TALAS.find((t) => t.n.toLowerCase() === name.toLowerCase());
    return hit ? hit.n : null;
}

function cycleBeats(settings) {
    const tala = TALAS.find((t) => t.n === (settings && settings.tala));
    if (!tala) return null;
    const n = talaBeats(tala, Number((settings && settings.jati) || '4'));
    return typeof n === 'number' && n > 0 ? n : null;
}

function crossesBeat(startHalf, endHalf) {
    if (endHalf <= startHalf) return false;
    return Math.floor(startHalf / 8) !== Math.floor((endHalf - 1) / 8);
}

function barAt(bars, half) {
    const here = bars.filter((b) => b.half === half);
    if (!here.length) return null;
    return here.some((b) => b.mark === '||') ? '||' : '|';
}

function formatBeat(beat) {
    if (!beat.length) return '';
    if (beat.every((u) => u.kind === 'hold')) return ',';
    const doubled = beat.some((u) => u.h === 1);
    if (!doubled) return beat.map((u) => u.text).join('');
    let out = '';
    for (const u of beat) {
        if (u.h === 1) out += u.text;
        else if (u.kind === 'hold') out += ',,';
        else out += u.text + ',';
    }
    return out;
}

function formatSwaraLine(units, bars, trailingDouble) {
    const tokens = [];
    const startBar = barAt(bars, 0);
    if (startBar && units.length === 0) {
        return trailingDouble ? '||' : '|';
    }
    if (startBar && units.length) tokens.push('|');

    let i = 0;
    let half = 0;
    const total = units.reduce((a, u) => a + u.h, 0);
    while (i < units.length) {
        const beat = [];
        let acc = 0;
        while (i < units.length && acc + units[i].h <= 8) {
            beat.push(units[i]);
            acc += units[i].h;
            i++;
        }
        if (!beat.length) {
            beat.push(units[i]);
            acc += units[i].h;
            i++;
        }
        tokens.push(formatBeat(beat));
        half += acc;
        const mark = barAt(bars, half);
        if (mark) {
            const atEnd = i >= units.length && half === total;
            tokens.push(atEnd && mark === '||' ? '||' : '|');
        }
    }
    if (trailingDouble && tokens[tokens.length - 1] !== '||') {
        if (tokens[tokens.length - 1] === '|') tokens[tokens.length - 1] = '||';
        else tokens.push('||');
    }
    return tokens.join(' ');
}

function parseSwaraLine(raw, lineNo, warnings, beatsPerCycle) {
    const text = String(raw ?? '').normalize('NFD');
    const units = [];
    const bars = [];
    let i = 0;
    let inBracket = false;
    let bracketStart = 0;
    let half = 0;
    let trailingDouble = false;

    const push = (kind, t, h) => {
        units.push({ kind, text: t, h });
        half += h;
        trailingDouble = false;
    };

    while (i < text.length) {
        const ch = text[i];
        if (/\s/.test(ch)) { i++; continue; }

        if (ch === '[') {
            if (inBracket) {
                warnings.push(`Line ${lineNo}: unknown character “[”`);
            } else {
                inBracket = true;
                bracketStart = half;
            }
            i++;
            continue;
        }
        if (ch === ']') {
            if (!inBracket) {
                warnings.push(`Line ${lineNo}: unknown character “]”`);
            } else {
                if (crossesBeat(bracketStart, half)) {
                    warnings.push(`Line ${lineNo}: bracket group crosses a beat boundary`);
                }
                inBracket = false;
            }
            i++;
            continue;
        }
        if (ch === '|') {
            let mark = '|';
            if (text[i + 1] === '|') { mark = '||'; i++; }
            bars.push({ half, mark });
            trailingDouble = mark === '||';
            if (half % 8 !== 0) {
                warnings.push(`Line ${lineNo}: bar mark is not on a beat boundary`);
            }
            i++;
            continue;
        }

        const h = inBracket ? 1 : 2;
        if (ch === ',') {
            push('hold', ',', h);
            i++;
            continue;
        }
        if (ch === ';') {
            push('hold', ',', h);
            push('hold', ',', h);
            i++;
            continue;
        }
        if (ch === '-') {
            push('rest', '-', h);
            i++;
            continue;
        }
        if (SWARA_LETTER.test(ch)) {
            let j = i + 1;
            if (text[j] === '1' || text[j] === '2' || text[j] === '3') j++;
            while (OCTAVE_MARK.test(text[j] || '')) j++;
            push('swara', text.slice(i, j), h);
            i = j;
            continue;
        }

        warnings.push(`Line ${lineNo}: unknown character “${ch}”`);
        i++;
    }
    if (inBracket && crossesBeat(bracketStart, half)) {
        warnings.push(`Line ${lineNo}: bracket group crosses a beat boundary`);
    }
    if (half % 8 !== 0) {
        warnings.push(`Line ${lineNo}: unit count is not a multiple of 4`);
    } else if (beatsPerCycle) {
        const B = half / 8;
        if (Number.isInteger(B) && half % (beatsPerCycle * 8) !== 0) {
            warnings.push(`Line ${lineNo}: has ${B} beats, not a whole number of tala cycles (${beatsPerCycle} beats per cycle)`);
        }
    }
    return formatSwaraLine(units, bars, trailingDouble);
}

/**
 * Parse a Carnatic .txt into editor notation + panel settings.
 * @param {string} text
 * @returns {{ notation: string, settings: object, warnings: string[] }}
 */
export function parseCarnaticTextFile(text) {
    const warnings = [];
    const settings = {};
    const swaraOut = [];
    const lines = String(text ?? '').replace(/^\uFEFF/, '').split(/\r?\n/);
    let mode = 'header';

    for (let n = 0; n < lines.length; n++) {
        const trimmed = lines[n].trim();
        if (!trimmed) continue;

        const marker = trimmed.match(MARKER_RE);
        if (marker) {
            mode = marker[1].toUpperCase() === 'SAHITYA' ? 'skip-sahitya' : 'swara';
            continue;
        }

        const header = trimmed.match(HEADER_RE);
        if (header) {
            mode = 'header';
            const key = header[1].trim().toUpperCase();
            const value = header[2].trim();
            if (key === 'RAGA') {
                const sel = findRagaSelectValue(value);
                if (sel) settings.raga = sel;
                else warnings.push(`Unknown raga “${value}”`);
            } else if (key === 'TALA') {
                const tala = findTalaName(value);
                if (tala) {
                    settings.tala = tala;
                    if (tala === 'Adi') settings.jati = '4';
                } else {
                    warnings.push(`Unknown tala “${value.split(' (')[0].trim()}”`);
                }
            } else if (key === 'NADAI') {
                if (VALID_GATI.has(value)) settings.gati = value;
                else warnings.push(`Unknown nadai “${value}”`);
            }
            continue;
        }

        if (mode === 'skip-sahitya') {
            mode = 'header';
            continue;
        }
        if (mode === 'swara') {
            swaraOut.push(parseSwaraLine(lines[n], n + 1, warnings, cycleBeats(settings)));
        }
    }

    return {
        notation: swaraOut.join('\n'),
        settings,
        warnings,
    };
}
