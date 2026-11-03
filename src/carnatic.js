/* Carnatic theory data — swaras, 72 melakartas, janya ragas, talas,
 * 5-string mandolin layout. Pure data + functions. No DOM, no audio, no UI.
 *
 * Ported from reference/Carnatic_Swara_Player_1.html (swara maps, raga
 * definitions / buildRaga, STR + place, TALAS, unitSec). Just intonation,
 * lyrics, library, and stage drawing are left out.
 */

// ── Swaras (semitone from middle-octave Sa = 0) ─────────────────────
// R2 shares a pitch with G1, R3 with G2, D2 with N1, D3 with N2.
export const SW = {
    S: 0,
    R1: 1, R2: 2, R3: 3,
    G1: 2, G2: 3, G3: 4,
    M1: 5, M2: 6,
    P: 7,
    D1: 8, D2: 9, D3: 10,
    N1: 9, N2: 10, N3: 11,
};

export const SWARA_NAMES = {
    S: 'Shadjam',
    R1: 'Shuddha Rishabham',
    R2: 'Chatusruti Rishabham',
    R3: 'Shatsruti Rishabham',
    G1: 'Shuddha Gandharam',
    G2: 'Sadharana Gandharam',
    G3: 'Antara Gandharam',
    M1: 'Shuddha Madhyamam',
    M2: 'Prati Madhyamam',
    P: 'Panchamam',
    D1: 'Shuddha Dhaivatham',
    D2: 'Chatusruti Dhaivatham',
    D3: 'Shatsruti Dhaivatham',
    N1: 'Shuddha Nishadham',
    N2: 'Kaisiki Nishadham',
    N3: 'Kakali Nishadham',
};

// Colour by family letter (S R G M P D N).
export const SWARA_COLOURS = {
    S: '#e5a823',
    R: '#ef5b3b',
    G: '#e0509f',
    M: '#9a68f2',
    P: '#3d86f5',
    D: '#16b8a6',
    N: '#8cc63f',
};

export const SEMI_LABEL = [
    'S', 'R1', 'R2/G1', 'R3/G2', 'G3', 'M1', 'M2',
    'P', 'D1', 'D2/N1', 'D3/N2', 'N3',
];

export const SWARAS = Object.keys(SWARA_NAMES).map((lab) => ({
    lab,
    semi: SW[lab],
    name: SWARA_NAMES[lab],
    colour: SWARA_COLOURS[lab[0]],
}));

// ── 72 Melakarta (janaka) names, numbered 1–72 ──────────────────────
// Chakras of 6. 1–36 śuddha madhyama (M1); 37–72 prati madhyama (M2).
export const MELA = [
    // Indu
    'Kanakangi', 'Ratnangi', 'Ganamurti', 'Vanaspati', 'Manavati', 'Tanarupi',
    // Netra
    'Senavati', 'Hanumatodi', 'Dhenuka', 'Natakapriya', 'Kokilapriya', 'Rupavati',
    // Agni
    'Gayakapriya', 'Vakulabharanam', 'Mayamalavagowla', 'Chakravakam', 'Suryakantam', 'Hatakambari',
    // Veda
    'Jhankaradhvani', 'Natabhairavi', 'Keeravani', 'Kharaharapriya', 'Gaurimanohari', 'Varunapriya',
    // Bana
    'Mararanjani', 'Charukesi', 'Sarasangi', 'Harikambhoji', 'Dheerasankarabharanam', 'Naganandini',
    // Ritu
    'Yagapriya', 'Ragavardhini', 'Gangeyabhushani', 'Vagadheeswari', 'Shulini', 'Chalanata',
    // Rishi
    'Salagam', 'Jalarnavam', 'Jhalavarali', 'Navaneetam', 'Pavani', 'Raghupriya',
    // Vasu
    'Gavambodhi', 'Bhavapriya', 'Subhapantuvarali', 'Shadvidamargini', 'Suvarnangi', 'Divyamani',
    // Brahma
    'Dhavalambari', 'Namanarayani', 'Kamavardhini', 'Ramapriya', 'Gamanashrama', 'Viswambhari',
    // Disi
    'Shamalangi', 'Shanmukhapriya', 'Simhendramadhyamam', 'Hemavati', 'Dharmavati', 'Neetimati',
    // Rudra
    'Kantamani', 'Rishabhapriya', 'Latangi', 'Vachaspati', 'Mechakalyani', 'Chitrambari',
    // Aditya
    'Sucharitra', 'Jyotisvarupini', 'Dhatuvardhini', 'Nasikabhushani', 'Kosalam', 'Rasikapriya',
];

// Melakarta R/G and D/N pairs (semitones). Index cycles in groups of 6.
const RG = [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]];
const DN = [[8, 9], [8, 10], [8, 11], [9, 10], [9, 11], [10, 11]];

// Variant number for a letter from its semitone (R1, G3, M2, …).
const VARIANT_BASE = { R: 0, G: 1, M: 4, D: 7, N: 8 };

/** Pitch-class map for melakarta `n` (1–72): { S, R, G, M, P, D, N }. */
export function melaMap(n) {
    const c = Math.floor((n - 1) / 6);
    const p = (n - 1) % 6;
    const [r, g] = RG[c % 6];
    const [d, nn] = DN[p];
    return { S: 0, R: r, G: g, M: n <= 36 ? 5 : 6, P: 7, D: d, N: nn };
}

// ── Janya ragas ─────────────────────────────────────────────────────
// parent = janaka (melakarta) number. aro / ava are swara sequences.
// Spaces optional; S' is the upper Sa. Edit this list freely.
export const JANYA = [
    // Famous pentatonic / sampurna janyas (kept first, as in the reference)
    { name: 'Mohanam', parent: 28, aro: "S R2 G3 P D2 S'", ava: "S' D2 P G3 R2 S" },
    { name: 'Hamsadhwani', parent: 29, aro: "S R2 G3 P N3 S'", ava: "S' N3 P G3 R2 S" },
    { name: 'Madhyamavati', parent: 22, aro: "S R2 M1 P N2 S'", ava: "S' N2 P M1 R2 S" },
    { name: 'Abhogi', parent: 22, aro: "S R2 G2 M1 D2 S'", ava: "S' D2 M1 G2 R2 S" },
    { name: 'Bilahari', parent: 29, aro: "S R2 G3 P D2 S'", ava: "S' N3 D2 P M1 G3 R2 S" },
    { name: 'Ritigowla (vakra)', parent: 22, aro: "S G2 R2 G2 M1 N2 S'", ava: "S' N2 M1 G2 M1 G2 R2 S" },
    { name: 'Kambhoji (bhashanga)', parent: 28, aro: "S R2 G3 M1 P D2 N3 D2 S'", ava: "S' N2 D2 P M1 G3 R2 S" },

    // Janyas of 2 Ratnangi
    { name: 'Revati', parent: 2, aro: "SR1M1PN2S'", ava: "S'N2PM1R1S" },

    // Janyas of 8 Hanumatodi
    { name: 'Dhanyasi', parent: 8, aro: "SG2M1PN2S'", ava: "S'N2D1PM1G2R1S" },
    { name: 'Bhoopalam', parent: 8, aro: "SR1G2PD1S'", ava: "S'D1PG2R1S" },
    { name: 'Shuddha Seemantini', parent: 8, aro: "SR1G2M1PD1S'", ava: "S'D1PM1G2R1S" },

    // Janyas of 9 Dhenuka
    { name: 'Udayaravichandrika', parent: 9, aro: "SG2M1PN3S'", ava: "S'N3PM1G2S" },

    // Janyas of 14 Vakulabharanam
    { name: 'Vasantabhairavi', parent: 14, aro: "SR1G3M1D1N2S'", ava: "S'N2D1M1PM1G3R1S" },

    // Janyas of 15 Mayamalavagowla
    { name: 'Bowli', parent: 15, aro: "SR1G3PD1S'", ava: "S'N3D1PG3R1S" },
    { name: 'Malahari', parent: 15, aro: "SR1M1PD1S'", ava: "S'D1PM1G3R1S" },
    { name: 'Saveri', parent: 15, aro: "SR1M1PD1S'", ava: "S'N3D1PM1G3R1S" },
    { name: 'Gowla', parent: 15, aro: "SR1M1PN3S'", ava: "S'N3PM1R1G3M1R1S" },
    { name: 'Lalita', parent: 15, aro: "SR1G3M1D1N3S'", ava: "S'N3D1M1G3R1S" },
    { name: 'Revagupti', parent: 15, aro: "SR1G3PD1S'", ava: "S'D1PG3R1S" },
    { name: 'Nadanamakriya', parent: 15, aro: 'SR1G3M1PD1N3', ava: 'N3D1PM1G3R1S' },

    // Janyas of 16 Chakravakam
    { name: 'Valaji', parent: 16, aro: "SG3PD2N2S'", ava: "S'N2D2PG3S" },

    // Janyas of 17 Suryakantam
    { name: 'Bhairavam', parent: 17, aro: "SR1G3M1PD2N3S'", ava: "S'D2PM1G3R1S" },
    { name: 'Vasantha', parent: 17, aro: "SM1G3M1D2N3S'", ava: "S'N3D2M1G3R2S" },

    // Janyas of 20 Natabhairavi
    { name: 'Anandabhairavi', parent: 20, aro: "SG2R2G2M1PD2PS'", ava: "S'N2D2PM1G2R2S" },
    { name: 'Bhairavi', parent: 20, aro: "SG2R2G2M1PD2N2S'", ava: "S'N2D1PM1G2R2S" },
    { name: 'Hindolam', parent: 20, aro: "SG2M1D1N2S'", ava: "S'N2D1M1G2S" },
    { name: 'Jaunpuri', parent: 20, aro: "SR2M1PD1N2S'", ava: "S'N2D1PM1G2R2S" },
    { name: 'Devakriya', parent: 20, aro: "SR2M1PN2S'", ava: "S'N2D1N2PM1G2R2S" },

    // Janyas of 21 Keeravani
    { name: 'Chandrakauns', parent: 21, aro: "SG2M1D1N3S'", ava: "S'N3D1M1G2S" },
    { name: 'Kalyanavasantham', parent: 21, aro: "SG2M1D1N3S'", ava: "S'N3D1PM1G2R2S" },

    // Janyas of 22 Kharaharapriya
    { name: 'Shuddha Dhanyasi', parent: 22, aro: "SG2M1PN2S'", ava: "S'N2PM1G2S" },
    { name: 'Manohari', parent: 22, aro: "SG2R2G2M1PD2S'", ava: "S'D2PM1G2R2S" },
    { name: 'Shivaranjani', parent: 22, aro: "SR2G2PD2S'", ava: "S'D2PG2R2S" },
    { name: 'Abheri', parent: 22, aro: "SG2M1PN2S'", ava: "S'N2D2PM1G2R2S" },
    { name: 'Sriranjani', parent: 22, aro: "SR2G2M1D2N2S'", ava: "S'N2D2M1G2R2S" },
    { name: 'Brindavana Saranga', parent: 22, aro: "SR2M1PN3S'", ava: "S'N2PM1R2G2R2S" },
    { name: 'Kapi', parent: 22, aro: "SR2M1PN3S'", ava: "S'N2D2N2PM1G2R2S" },
    { name: 'Devamanohari', parent: 22, aro: "SR2M1PD2N2S'", ava: "S'N2D2N2PM1R2S" },
    { name: 'Shree', parent: 22, aro: "SR2M1PN2S'", ava: "S'N2PD2N2PM1R2G2R2S" },
    { name: 'Bageshri', parent: 22, aro: "SG2M1D2N2S'", ava: "S'N2D2M1PD2G2M1R2S" },
    { name: 'Mukhari', parent: 22, aro: "SR2M1PN2D2S'", ava: "S'N2D1PM1G2R2S" },
    { name: 'Kanada', parent: 22, aro: "SR2PG2M1D2N2S'", ava: "S'N2PM1G2M1R2S" },

    // Janyas of 27 Sarasangi
    { name: 'Kamala Manohari', parent: 27, aro: "SG3M1PN3S'", ava: "S'N3D1PM1G3S" },

    // Janyas of 28 Harikambhoji
    { name: 'Khamas', parent: 28, aro: "SM1G3M1PD2N2S'", ava: "S'N2D2PM1G3R2S" },
    { name: 'Desh', parent: 28, aro: "SR2M1PN3S'", ava: "S'N2D2PM1G3R2S" },
    { name: 'Bahudari', parent: 28, aro: "SG3M1PD2N2S'", ava: "S'N2PM1G3S" },
    { name: 'Yadukula Kambhoji', parent: 28, aro: "SR2M1PD2S'", ava: "S'N2D2PM1G3R2S" },
    { name: 'Narayanagowla', parent: 28, aro: "SR2M1PN2D2N2S'", ava: "S'N2D2PM1G3R2G3S" },
    { name: 'Surutti', parent: 28, aro: "SR2M1PN2D2N2S'", ava: "S'N2D2PM1G3PM1R2S" },
    { name: 'Kedaragowla', parent: 28, aro: "SR2M1PN2S'", ava: "S'N2D2PM1G3R2S" },
    { name: 'Karnataka Behag', parent: 28, aro: "SR2G3M1PD2N2S'", ava: "S'N2D2N2PD2M1G3R2S" },
    { name: 'Sahana', parent: 28, aro: "SR2G3M1PM1D2N2S'", ava: "S'N2S'D2N2D2PM1G3M1R2G3R2S" },
    { name: 'Kuntalavarali', parent: 28, aro: "SM1PD2N2D2S'", ava: "S'N2D2PM1S" },

    // Janyas of 29 Dheerasankarabharanam
    { name: 'Arabhi', parent: 29, aro: "SR2M1PD2S'", ava: "S'N3D2PM1G3R2S" },
    { name: 'Atana', parent: 29, aro: "SR2M1PN2S'", ava: "S'N2D2PM1G2M1R2S" },
    { name: 'Begada', parent: 29, aro: "SG3R2G3M1PD2PS'", ava: "S'N3D2PM1G3R2S" },
    { name: 'Kedaram', parent: 29, aro: "SM1G3M1PN3S'", ava: "S'N3PM1G3R2S" },
    { name: 'Devagandhari', parent: 29, aro: "SR2M1PD2S'", ava: "S'N3D2PM1G3R2S" },
    { name: 'Suddha Saveri', parent: 29, aro: "SR2M1PD2S'", ava: "S'D2PM1R2S" },
    { name: 'Kathanakuthuhalam', parent: 29, aro: "SR2M1D2N3G3PS'", ava: "S'N3D2PM1G3R2S" },
    { name: 'Neelambari', parent: 29, aro: "SR2G3M1PD2PN3S'", ava: "S'N3PM1G3R2G3S" },
    { name: 'Janaranjani', parent: 29, aro: "SR2G3M1PD2PN3S'", ava: "S'D2PM1R2S" },

    // Janyas of 36 Chalanata
    { name: 'Nattai', parent: 36, aro: "SR3G3M1PN3S'", ava: "S'N3PM1G3R3S" },
    { name: 'Gambheeranattai', parent: 36, aro: "SG3M1PN3S'", ava: "S'N3PM1G3S" },

    // Janyas of 45 Subhapantuvarali
    { name: 'Multani', parent: 45, aro: "SG2M2PN3S'", ava: "S'N3D1PM2G2R1S" },

    // Janyas of 53 Gamanashrama
    { name: 'Poorvikalyani', parent: 53, aro: "SR1G3M2PD2PS'", ava: "S'N3D2PM2G3R1S" },
    { name: 'Sohini', parent: 53, aro: "SG3M2D2N3S'", ava: "S'N3D2M2G3R1S" },
    { name: 'Hamsanandi', parent: 53, aro: "SR1G3M2D2N3S'", ava: "S'N3D2M2G3R1S" },

    // Janyas of 59 Dharmavati
    { name: 'Madhuvanti', parent: 59, aro: "SG2M2PN3S'", ava: "S'N3D2PM2G2R2S" },

    // Janyas of 60 Neetimati
    { name: 'Hamsanadam', parent: 60, aro: "SR2M2PD3N3S'", ava: "S'N3D3PM2R2S" },

    // Janyas of 65 Mechakalyani
    { name: 'Bhoopali', parent: 65, aro: "SR2G3PD2S'", ava: "S'D2PG3R2S" },
    { name: 'Hindol', parent: 65, aro: "SG3M2D2N3S'", ava: "S'N3D2M2G3S" },
    { name: 'Yamuna Kalyani', parent: 65, aro: "SR2G3M2PD2N3S'", ava: "S'N3D2PM2G3M1G3R2S" },
    { name: 'Hamsakalyani', parent: 65, aro: "SR2G3PN3S'", ava: "S'N3D2PM2G3R2S" },

    // Janyas of 66 Chitrambari
    { name: 'Amritavarshini', parent: 66, aro: "SG3M2PN3S'", ava: "S'N3PM2G3S" },
];

// ── Raga builders ───────────────────────────────────────────────────
export function mod12(x) {
    return ((x % 12) + 12) % 12;
}

function seq(str, map) {
    return str.match(/[SRGMPDN][123]?'?/g).map((t) => {
        const m = t.match(/^([SRGMPDN])([123])?(')?$/);
        const l = m[1];
        const s = m[2] && l !== 'S' && l !== 'P' ? SW[l + m[2]] : map[l];
        return {
            l,
            lab: m[2] ? l + m[2] : l,
            semi: s + (m[3] ? 12 : 0),
            anya: !!m[2] && s !== map[l],
        };
    });
}

function _edges(a) {
    return new Set(a.slice(1).map((x, q) => mod12(a[q].semi) + '>' + mod12(x.semi)));
}

function _finishRaga(name, n, m, aro, ava, isJanya) {
    const all = [...aro, ...ava];
    const aroSet = new Set(aro.map((x) => mod12(x.semi)));
    const avaSet = new Set(ava.map((x) => mod12(x.semi)));
    const up = aro.every((x, q) => !q || x.semi > aro[q - 1].semi);
    const dn = ava.every((x, q) => !q || x.semi < ava[q - 1].semi);
    const present = new Set(all.map((x) => x.l));
    const letters = 'SRGMPDN'.split('');
    return {
        name,
        n,
        m,
        aro,
        ava,
        aroSet,
        avaSet,
        vakra: !(up && dn),
        upE: _edges(aro),
        dnE: _edges(ava),
        varja: letters.filter((l) => !present.has(l) && isJanya),
        anya: [...new Set(all.filter((x) => x.anya).map((x) => x.lab))],
        scale: [...new Set([...aroSet, ...avaSet])].sort((a, b) => a - b),
    };
}

function _buildMela(n) {
    const name = MELA[n - 1];
    if (!name) return null;
    const m = melaMap(n);
    const o = "S R G M P D N S'".split(' ');
    const aro = o.map((t) => ({
        semi: m[t[0]] + (t[1] ? 12 : 0),
        lab: 'SP'.includes(t[0]) ? t[0] : t[0] + (m[t[0]] - VARIANT_BASE[t[0]]),
    }));
    return _finishRaga(name, n, m, aro, aro.slice().reverse(), false);
}

function _buildJanya(j) {
    if (!j) return null;
    const n = j.parent;
    const m = melaMap(n);
    return _finishRaga(j.name, n, m, seq(j.aro, m), seq(j.ava, m), true);
}

/**
 * Allowed notes (and arohana / avarohana) for a raga.
 *
 *   buildRaga('m:15')           // melakarta 15 Mayamalavagowla
 *   buildRaga(15)               // same
 *   buildRaga('j:0')            // janya by index in JANYA
 *   buildRaga('Mohanam')        // janya or mela by name
 *
 * Returns null if unknown. Read `.scale` for pitch classes 0–11 (Sa=0).
 */
export function buildRaga(v) {
    if (typeof v === 'number' && Number.isFinite(v)) return _buildMela(v);
    const s = String(v == null ? '' : v).trim();
    if (!s) return null;
    const melaKey = s.match(/^m:(\d+)$/i);
    if (melaKey) return _buildMela(+melaKey[1]);
    const janyaKey = s.match(/^j:(\d+)$/i);
    if (janyaKey) return _buildJanya(JANYA[+janyaKey[1]]);
    const lower = s.toLowerCase();
    const janya = JANYA.find((j) => j.name.toLowerCase() === lower);
    if (janya) return _buildJanya(janya);
    const mi = MELA.findIndex((n) => n.toLowerCase() === lower);
    if (mi >= 0) return _buildMela(mi + 1);
    return null;
}

// ── Tālas ───────────────────────────────────────────────────────────
// Angas: L = laghu (aksharas as listed), D = dhrutam (2), A = anudhrutam (1).
// The seven sūlādi tālas plus Adi, mostly chatusra jati as in the reference.
export const TALAS = [
    { n: 'Adi (chatusra triputa), 8 beats', a: [['L', 4], ['D', 2], ['D', 2]] },
    { n: 'Dhruva, 14 beats', a: [['L', 4], ['D', 2], ['L', 4], ['L', 4]] },
    { n: 'Matya, 10 beats', a: [['L', 4], ['D', 2], ['L', 4]] },
    { n: 'Rupaka, 6 beats', a: [['D', 2], ['L', 4]] },
    { n: 'Jhampa, 10 beats', a: [['L', 7], ['A', 1], ['D', 2]] },
    { n: 'Triputa, 7 beats (tisra)', a: [['L', 3], ['D', 2], ['D', 2]] },
    { n: 'Ata, 14 beats', a: [['L', 5], ['D', 2], ['L', 5], ['D', 2]] },
    { n: 'Eka, 4 beats', a: [['L', 4]] },
];

/** Seconds per beat unit: (60 / bpm) × (4 / gati) / kala. */
export function unitSec(bpm, gati, kala) {
    return (60 / bpm) * (4 / gati) / kala;
}

// ── String layout (Carnatic mandolin) ───────────────────────────────
// Five strings, lowest first. Semitones relative to middle-octave Sa.
// Open pitches with Sa = C#4 on string 2: C#3, G#3, C#4, G#4, C#5.
export const STR = [-12, -5, 0, 7, 12];
export const OPEN_NOTES = ['C#3', 'G#3', 'C#4', 'G#4', 'C#5'];
export const SA_STRING = 2; // open third string = middle Sa (C#4)
export const FRET_MAX = 15;

/**
 * Fret for `semi` (0 = middle Sa) on `string` (0 = lowest).
 * Clamped to 0–15. Returns null if the string index is out of range.
 */
export function place(semi, string) {
    const open = STR[string];
    if (open == null) return null;
    return Math.min(Math.max(0, semi - open), FRET_MAX);
}
