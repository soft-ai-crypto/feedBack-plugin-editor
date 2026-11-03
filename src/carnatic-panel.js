/* Carnatic notation panel — shown only on a Carnatic Mandolin track.
 * Markup lives in screen.html; Apply replaces that track's notes via
 * the ordinary DeleteNotesCmd + AddNoteCmd history path.
 */

import { buildRaga, janyaOptions, melakartaOptions, ragaKey } from './carnatic.js';
import { eventsToEditorNotes, parseNotation } from './carnatic-notation.js';
import { AddNoteCmd, DeleteNotesCmd } from './commands.js';
import { host } from './host.js';
import { _isCarnaticMandolinArr } from './instrument.js';
import { notes } from './notes.js';
import { S } from './state.js';
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

function showWarnings(list) {
    const ul = document.getElementById('editor-carnatic-warnings');
    if (!ul) return;
    ul.innerHTML = (list || []).map((w) => `<li>${_editorEscHtml(w)}</li>`).join('');
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
    const bpm = Math.max(1, Number((document.getElementById('editor-carnatic-bpm') || {}).value) || 90);
    const gati = Math.max(1, Number((document.getElementById('editor-carnatic-gati') || {}).value) || 4);
    const kala = Math.max(1, Number((document.getElementById('editor-carnatic-kala') || {}).value) || 1);
    const text = (document.getElementById('editor-carnatic-notation') || {}).value || '';
    const { ev, warn } = parseNotation(text, raga, false);
    const next = eventsToEditorNotes(ev, bpm, gati, kala);
    const nn = notes();
    const cmds = [];
    if (nn.length) cmds.push(new DeleteNotesCmd(nn.map((_, i) => i)));
    for (const n of next) cmds.push(new AddNoteCmd(n));
    if (cmds.length) S.history.exec(new CompositeCmd(cmds));
    showWarnings(warn);
    host.draw();
    host.updateStatus();
    setStatus(warn.length
        ? `Applied ${next.length} notes (${warn.length} warning${warn.length === 1 ? '' : 's'})`
        : `Applied ${next.length} notes`);
}

let _shown = null;

export function _carnaticPanelRefresh() {
    const panel = $panel();
    if (!panel) return;
    const arr = S.arrangements && S.arrangements[S.currentArr];
    const show = !!(arr && _isCarnaticMandolinArr(arr));
    if (_shown === show) return;
    _shown = show;
    panel.classList.toggle('hidden', !show);
}

export function initCarnaticPanel() {
    fillRagas();
    const btn = document.getElementById('editor-carnatic-apply');
    if (btn) btn.addEventListener('click', editorApplyCarnaticNotation);
    _shown = null;
    _carnaticPanelRefresh();
}
