// Parametrisch bedmodel. Eenheden: millimeter.
// Assen: x = breedte (links → rechts), y = hoogte, z = lengte (hoofdeinde z = 0 → voeteneinde z = L).

export const MATTRESS_WIDTHS = [900, 1200, 1400];

export const DEFAULT_BED = {
  mattressW: 900,
  mattressL: 2000,
  railTop: 394,      // bovenkant zijbalk vanaf de vloer
  headboard: true,
  headH: 900,        // hoogte hoofdbordpoten
  slats: 'zelf',     // 'zelf' = latten zagen, 'rolbodem' = kant-en-klaar
  finish: 'olie',    // 'olie' | 'wit' | 'zwart'
};

const POST = 70, RAIL_T = 44, RAIL_H = 144;
const STRIP_T = 22, STRIP_H = 44;
const SLAT_T = 18, SLAT_W = 70;
const BOARD_T = 18, BOARD_H = 144;
const HOOK_T = 4;

export function buildBed(input = {}) {
  const c = { ...DEFAULT_BED, ...input };
  const W = c.mattressW + 10;           // vrije binnenmaat breedte
  const L = c.mattressL + 10;           // vrije binnenmaat lengte
  const railTop = c.railTop, railBot = railTop - RAIL_H;
  const slatTop = railTop - 40, slatBot = slatTop - SLAT_T;
  const headH = c.headboard ? c.headH : railTop;
  const hasMid = c.mattressW >= 1200;

  const parts = [];
  const add = (id, name, profile, min, size, extra = {}) =>
    parts.push({ id, name, profile, min, size, len: Math.max(...size), ...extra });

  // Poten (hoofd- en voeteinde)
  add('postHL', 'Poot hoofdeinde', 'v70x70', [-POST, 0, -POST], [POST, headH, POST]);
  add('postHR', 'Poot hoofdeinde', 'v70x70', [W, 0, -POST], [POST, headH, POST]);
  add('postFL', 'Poot voeteinde', 'v70x70', [-POST, 0, L], [POST, railTop, POST]);
  add('postFR', 'Poot voeteinde', 'v70x70', [W, 0, L], [POST, railTop, POST]);

  // Kopbalken: vast tussen de poten geschroefd
  add('railH', 'Kopbalk', 'v44x144', [0, railBot, -RAIL_T], [W, RAIL_H, RAIL_T]);
  add('railF', 'Kopbalk', 'v44x144', [0, railBot, L], [W, RAIL_H, RAIL_T]);

  // Zijbalken: met bedverbinders in de poten gehaakt (4 mm ruimte per kant voor de verbinder)
  add('sideL', 'Zijbalk', 'v44x144', [-RAIL_T, railBot, HOOK_T], [RAIL_T, RAIL_H, L - 2 * HOOK_T]);
  add('sideR', 'Zijbalk', 'v44x144', [W, railBot, HOOK_T], [RAIL_T, RAIL_H, L - 2 * HOOK_T]);

  // Draaglatten aan de binnenkant van de zijbalken
  add('stripL', 'Draaglat', 'v22x44', [0, slatBot - STRIP_H, HOOK_T], [STRIP_T, STRIP_H, L - 2 * HOOK_T]);
  add('stripR', 'Draaglat', 'v22x44', [W - STRIP_T, slatBot - STRIP_H, HOOK_T], [STRIP_T, STRIP_H, L - 2 * HOOK_T]);

  // Middenbalk met twee poten (vanaf 120 cm breed)
  const midH = slatBot - RAIL_H;
  if (hasMid) {
    add('mid', 'Middenbalk', 'v44x144', [W / 2 - RAIL_T / 2, midH, 0], [RAIL_T, RAIL_H, L]);
    for (const [i, f] of [[1, 1 / 3], [2, 2 / 3]])
      add('midLeg' + i, 'Middenpoot', 'v44x144', [W / 2 - RAIL_T / 2, 0, L * f - 72], [RAIL_T, midH, 144]);
  }

  // Hoofdbordplanken op de achterkant van de hoofdpoten
  const boards = [];
  if (c.headboard) {
    const gap = 20, avail = headH - 10 - railTop - 20;
    const n = Math.max(0, Math.floor((avail + gap) / (BOARD_H + gap)));
    for (let i = 0; i < n; i++) {
      const y = headH - 10 - BOARD_H - i * (BOARD_H + gap);
      add('board' + i, 'Hoofdbordplank', 'v18x144', [-POST, y, -POST - BOARD_T], [W + 2 * POST, BOARD_H, BOARD_T]);
      boards.push('board' + i);
    }
  }

  // Bedlatten
  const nSlats = Math.ceil((L - 40 - SLAT_W) / (SLAT_W + 60)) + 1;
  const slatGap = (L - 40 - nSlats * SLAT_W) / (nSlats - 1);
  const slats = [];
  for (let i = 0; i < nSlats; i++) {
    const z = 20 + i * (SLAT_W + slatGap);
    add('slat' + i, c.slats === 'rolbodem' ? 'Rolbodem' : 'Bedlat', c.slats === 'rolbodem' ? null : 'v18x70',
      [5, slatBot, z], [W - 10, SLAT_T, SLAT_W], { bought: c.slats === 'rolbodem' });
    slats.push('slat' + i);
  }

  // IJzerwaren met geometrie (voor 3D en handleiding)
  const hw = [];
  const addHw = (id, kind, min, size) => hw.push({ id, kind, min, size });
  const hy = railBot + 15, hh = RAIL_H - 30;
  addHw('hookHL', 'bedverbinder', [-RAIL_T, hy, 0], [RAIL_T, hh, HOOK_T]);
  addHw('hookHR', 'bedverbinder', [W, hy, 0], [RAIL_T, hh, HOOK_T]);
  addHw('hookFL', 'bedverbinder', [-RAIL_T, hy, L - HOOK_T], [RAIL_T, hh, HOOK_T]);
  addHw('hookFR', 'bedverbinder', [W, hy, L - HOOK_T], [RAIL_T, hh, HOOK_T]);
  if (hasMid) {
    const bx0 = W / 2 - RAIL_T / 2 - 40, bx1 = W / 2 + RAIL_T / 2;
    for (const [z, tag] of [[0, 'H'], [L - 3, 'F']]) {
      addHw('bracket' + tag + 'L', 'hoekijzer', [bx0, midH + 50, z], [40, 50, 3]);
      addHw('bracket' + tag + 'R', 'hoekijzer', [bx1, midH + 50, z], [40, 50, 3]);
    }
    for (const i of [1, 2]) {
      const z = L * (i / 3) - 60;
      addHw('plate' + i + 'L', 'gatplaat', [W / 2 - RAIL_T / 2 - 3, midH - 60, z], [3, 120, 40]);
      addHw('plate' + i + 'R', 'gatplaat', [W / 2 + RAIL_T / 2, midH - 60, z], [3, 120, 40]);
    }
  }

  // Codes A, B, C ... voor identieke houten delen
  const codes = new Map();
  for (const p of parts) {
    const key = p.bought ? 'bought' : `${p.profile}|${p.len}|${[...p.size].sort((a, b) => a - b).join('x')}`;
    if (!codes.has(key)) codes.set(key, { code: String.fromCharCode(65 + codes.size), name: p.name, profile: p.profile, size: p.size, len: p.len, bought: !!p.bought, ids: [] });
    const entry = codes.get(key);
    entry.ids.push(p.id);
    p.code = entry.code;
  }

  // Benodigde bevestigingsmiddelen (stuks)
  const strip = Math.ceil((L - 2 * HOOK_T) / 300) + 1;
  const need = {
    bedverbinder: 4,
    s6x120: 8,
    s4x40: 2 * strip,
    s5x50: boards.length * 4,
    s4x30: (c.slats === 'zelf' ? nSlats * 2 : 0) + (hasMid ? 4 * 4 + 4 * 6 : 0),
    hoekijzer: hasMid ? 4 : 0,
    gatplaat: hasMid ? 4 : 0,
    vilt: hasMid ? 6 : 4,
  };

  const outer = { x0: -POST, x1: W + POST, z0: -POST - (c.headboard ? BOARD_T : 0), z1: L + POST, h: headH };

  return {
    cfg: c, W, L, railTop, railBot, slatTop, slatBot, headH, hasMid,
    parts, hw, codes: [...codes.values()], need, slats, boards, slatGap, nSlats, strip, outer,
    byId: Object.fromEntries([...parts, ...hw, { id: 'mattress', kind: 'matras', min: [5, slatTop, 5], size: [W - 10, 200, L - 10] }].map(p => [p.id, p])),
  };
}

// Montagestappen voor de handleiding. Elke stap toont een set delen; 'add' zijn de nieuwe delen,
// met een verschuiving (explosie) en schroeven als { p: gat, d: richting, len, dia }.
export function buildSteps(bed) {
  const { W, L, railBot, railTop, slatBot, headH, hasMid } = bed;
  const head = ['postHL', 'postHR', 'railH'];
  const foot = ['postFL', 'postFR', 'railF'];
  const sides = ['sideL', 'sideR', 'stripL', 'stripR'];
  const hooks = ['hookHL', 'hookHR', 'hookFL', 'hookFR'];
  const mid = hasMid ? ['mid', 'midLeg1', 'midLeg2', 'bracketHL', 'bracketHR', 'bracketFL', 'bracketFR', 'plate1L', 'plate1R', 'plate2L', 'plate2R'] : [];
  const steps = [];
  const screws = (pts, d, len, dia) => pts.map(p => ({ p, d, len, dia }));

  // 1. Draaglatten op zijbalken
  const sz = [];
  for (let i = 0; i < bed.strip; i++) sz.push(40 + i * ((L - 88) / (bed.strip - 1)));
  steps.push({
    show: ['sideL', 'sideR', 'stripL', 'stripR'], add: ['stripL', 'stripR'],
    offset: { stripL: [180, 0, 0], stripR: [-180, 0, 0] },
    fasteners: [
      ...screws(sz.map(z => [22, slatBot - 22, z]), [-1, 0, 0], 40, 4),
      ...screws(sz.map(z => [W - 22, slatBot - 22, z]), [1, 0, 0], 40, 4),
    ],
    hw: [['s4x40', bed.need.s4x40], ['lijm', 1]],
    caption: 'Lijm en schroef de draaglatten tegen de binnenkant van de zijbalken. Onderkant bedlat = bovenkant draaglat.',
  });

  // 2. Hoofdeinde
  const jointY = [railBot + 40, railTop - 40];
  steps.push({
    show: head, add: ['railH'], offset: { railH: [0, 260, 0] },
    fasteners: [
      ...screws(jointY.map(y => [-70, y, -22]), [1, 0, 0], 120, 6),
      ...screws(jointY.map(y => [W + 70, y, -22]), [-1, 0, 0], 120, 6),
    ],
    hw: [['s6x120', 4], ['lijm', 1]], view: 'head',
    caption: 'Voorboren met 4 mm, dan de kopbalk met lijm en 2 constructieschroeven per kant vastzetten. Controleer haaks.',
  });

  // 3. Hoofdbord
  if (bed.boards.length) {
    const f = [];
    for (const id of bed.boards) {
      const b = bed.byId[id];
      for (const x of [-35, W + 35]) for (const dy of [40, 104]) f.push({ p: [x, b.min[1] + dy, -70], d: [0, 0, 1], len: 50, dia: 5 });
    }
    steps.push({
      show: [...head, ...bed.boards], add: bed.boards,
      offset: Object.fromEntries(bed.boards.map(id => [id, [0, 0, -260]])),
      fasteners: f.map(s => ({ ...s, p: [s.p[0], s.p[1], s.p[2] - 18] })),
      hw: [['s5x50', bed.need.s5x50]], view: 'back',
      caption: 'Plaats de planken met 20 mm tussenruimte (gebruik een latje als mal). Per kant 2 schroeven per plank.',
    });
  }

  // 4. Voeteinde
  steps.push({
    show: foot, add: ['railF'], offset: { railF: [0, 260, 0] },
    fasteners: [
      ...screws(jointY.map(y => [-70, y, L + 22]), [1, 0, 0], 120, 6),
      ...screws(jointY.map(y => [W + 70, y, L + 22]), [-1, 0, 0], 120, 6),
    ],
    hw: [['s6x120', 4], ['lijm', 1]], view: 'foot',
    caption: 'Zelfde als het hoofdeinde.',
  });

  // 5. Bedverbinders
  steps.push({
    show: [...head, ...bed.boards, ...foot, ...hooks], add: hooks,
    offset: { hookHL: [-160, 0, 0], hookHR: [160, 0, 0], hookFL: [-160, 0, 0], hookFR: [160, 0, 0] },
    fasteners: [], hw: [['bedverbinder', 4]],
    caption: 'Schroef de haakdelen op de poten en de tegenstukken op de uiteinden van de zijbalken. Alle 4 op dezelfde hoogte.',
  });

  // 6. Zijbalken inhaken
  steps.push({
    show: [...head, ...bed.boards, ...foot, ...hooks, ...sides], add: sides,
    offset: Object.fromEntries(sides.map(id => [id, [0, 300, 0]])),
    fasteners: [], hw: [], persons: 2,
    caption: 'Met z’n tweeën: haak de zijbalken van bovenaf in de bedverbinders en tik ze met de hand stevig omlaag.',
  });

  // 7. Middenbalk
  if (hasMid) {
    const midBase = bed.byId.mid.min[1];
    steps.push({
      show: [...head, ...bed.boards, ...foot, ...sides, ...mid], add: mid,
      offset: { mid: [0, 300, 0], midLeg1: [0, 300, 0], midLeg2: [0, 300, 0] },
      fasteners: [], hw: [['hoekijzer', 4], ['gatplaat', 4], ['s4x30', 40]],
      caption: `Schroef de middenpoten met gatplaten onder de middenbalk. Zet de balk met hoekijzers tegen de kopbalken, bovenkant op ${slatBot} mm.`,
      note: midBase,
    });
  }

  // 8. Bedlatten
  const base = [...head, ...bed.boards, ...foot, ...sides, ...mid];
  const slatsLift = Object.fromEntries(bed.slats.map(id => [id, [0, 220, 0]]));
  const slatScrews = bed.cfg.slats === 'zelf'
    ? bed.slats.slice(0, 3).flatMap(id => { const s = bed.byId[id]; const z = s.min[2] + 35; return [{ p: [11, slatBot + 18 + 220, z], d: [0, -1, 0], len: 30, dia: 4 }, { p: [W - 11, slatBot + 18 + 220, z], d: [0, -1, 0], len: 30, dia: 4 }]; })
    : [];
  steps.push({
    show: [...base, ...bed.slats], add: bed.slats, offset: slatsLift,
    fasteners: slatScrews.map(s => ({ ...s, p: [s.p[0], s.p[1] - 220, s.p[2]] })),
    hw: bed.cfg.slats === 'zelf' ? [['s4x30', bed.nSlats * 2]] : [['rolbodem', 1]],
    caption: bed.cfg.slats === 'zelf'
      ? `${bed.nSlats} latten, tussenruimte ${Math.round(bed.slatGap)} mm. Zaag een blokje van ${Math.round(bed.slatGap)} mm als afstandhouder. Eén schroef per kant.`
      : 'Rol de rolbodem uit over de draaglatten.',
  });

  // 9. Klaar
  steps.push({
    show: [...base, ...bed.slats], add: ['mattress'], offset: { mattress: [0, 300, 0] },
    fasteners: [], hw: [['vilt', bed.need.vilt]], final: true,
    caption: 'Viltjes onder de poten, matras erop. Draai na 2 weken alle schroeven nog eens na.',
  });
  return steps;
}
