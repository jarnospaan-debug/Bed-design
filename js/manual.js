// Montagehandleiding in IKEA-stijl: lijntekeningen gerenderd uit het bedmodel.
import * as THREE from 'three';
import { buildSteps } from './bed.js';
import { HARDWARE } from './costs.js';

const VIEWS = {
  iso: [1, 0.85, 1.25],
  head: [0.9, 0.8, 1.3],
  foot: [0.9, 0.8, 1.3],
  back: [0.75, 0.7, -1.3],
  thumb: [1, 0.9, 1.1],
};

class LineRenderer {
  constructor(w, h) {
    this.renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(1);
    this.renderer.setClearColor(0xffffff, 1);
    this.setSize(w, h);
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 100000);
  }
  setSize(w, h) { this.w = w; this.h = h; this.renderer.setSize(w, h, false); }

  boxGroup(min, size, fill, offset = [0, 0, 0]) {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(...size);
    const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: fill, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
    const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0x111111 }));
    g.add(mesh, edges);
    g.position.set(min[0] + size[0] / 2 + offset[0], min[1] + size[1] / 2 + offset[1], min[2] + size[2] / 2 + offset[2]);
    return g;
  }

  dashed(a, b, dash = 30) {
    const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(...a), new THREE.Vector3(...b)]);
    const line = new THREE.Line(geo, new THREE.LineDashedMaterial({ color: 0x111111, dashSize: dash, gapSize: dash * 0.7 }));
    line.computeLineDistances();
    return line;
  }

  screw(s, scale) {
    const g = new THREE.Group();
    const d = new THREE.Vector3(...s.d).normalize();
    const p = new THREE.Vector3(...s.p);
    const gap = 60 * scale, len = s.len, r = s.dia * 0.9;
    const tip = p.clone().addScaledVector(d, -gap);
    const tail = tip.clone().addScaledVector(d, -len);
    const body = new THREE.CylinderGeometry(r, r * 0.35, len, 10);
    const head = new THREE.CylinderGeometry(r * 2, r * 2, r * 0.9, 14);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
    for (const [geo, pos] of [[body, tip.clone().add(tail).multiplyScalar(0.5)], [head, tail]]) {
      const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xdddddd, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }));
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 40), new THREE.LineBasicMaterial({ color: 0x111111 }));
      for (const o of [m, e]) { o.quaternion.copy(q); o.position.copy(pos); g.add(o); }
    }
    g.add(this.dashed(tip.toArray(), p.toArray(), 12));
    return g;
  }

  render(scene, viewDir, margin = 0.06) {
    const box = new THREE.Box3().setFromObject(scene);
    const c = box.getCenter(new THREE.Vector3());
    const dir = new THREE.Vector3(...viewDir).normalize();
    const cam = this.camera;
    cam.position.copy(c).addScaledVector(dir, 20000);
    cam.up.set(0, 1, 0);
    cam.lookAt(c);
    cam.updateMatrixWorld(true);
    const inv = cam.matrixWorldInverse;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (let i = 0; i < 8; i++) {
      const v = new THREE.Vector3(i & 1 ? box.max.x : box.min.x, i & 2 ? box.max.y : box.min.y, i & 4 ? box.max.z : box.min.z).applyMatrix4(inv);
      x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
    }
    let w = x1 - x0, h = y1 - y0;
    const aspect = this.w / this.h;
    if (w / h > aspect) h = w / aspect; else w = h * aspect;
    w *= 1 + margin * 2; h *= 1 + margin * 2;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    Object.assign(cam, { left: cx - w / 2, right: cx + w / 2, top: cy + h / 2, bottom: cy - h / 2, near: 1, far: 60000 });
    cam.updateProjectionMatrix();
    this.renderer.render(scene, cam);
    return this.renderer.domElement.toDataURL('image/png');
  }
}

let shared = null;
const lr = (w, h) => { if (!shared) shared = new LineRenderer(w, h); else shared.setSize(w, h); return shared; };

function stepImage(bed, step) {
  const r = lr(1400, 1000);
  const scene = new THREE.Scene();
  const ids = [...new Set([...step.show, ...step.add])];
  const isNew = new Set(step.add);
  for (const id of ids) {
    const p = bed.byId[id];
    const off = step.offset?.[id] || [0, 0, 0];
    const fill = p.kind ? (p.kind === 'matras' ? 0xffffff : 0x9c9c9c) : isNew.has(id) ? 0xe4e4e4 : 0xffffff;
    scene.add(r.boxGroup(p.min, p.size, fill, off));
    if (isNew.has(id) && (off[0] || off[1] || off[2])) {
      const c = [p.min[0] + p.size[0] / 2, p.min[1] + p.size[1] / 2, p.min[2] + p.size[2] / 2];
      const corners = p.size[0] > 600 || p.size[2] > 600
        ? [[p.min[0] + 20, c[1], p.min[2] + 20], [p.min[0] + p.size[0] - 20, c[1], p.min[2] + p.size[2] - 20]]
        : [c];
      if (bed.slats.includes(id) && id !== bed.slats[0] && id !== bed.slats[bed.slats.length - 1]) continue;
      for (const a of corners) scene.add(r.dashed([a[0] + off[0], a[1] + off[1], a[2] + off[2]], a));
    }
  }
  const scale = Math.max(bed.W, bed.L) / 2000;
  for (const s of step.fasteners) scene.add(r.screw(s, scale));
  return r.render(scene, VIEWS[step.view] || VIEWS.iso);
}

function partThumb(bed, entry) {
  const r = lr(520, 300);
  const scene = new THREE.Scene();
  const p = bed.byId[entry.ids[0]];
  // Lang deel altijd liggend langs x tekenen
  const s = [...p.size].sort((a, b) => b - a);
  scene.add(r.boxGroup([0, 0, 0], [s[0], s[2], s[1]], 0xffffff));
  return r.render(scene, [0.35, 0.8, 1], 0.08);
}

function coverImage(bed) {
  const r = lr(1400, 1000);
  const scene = new THREE.Scene();
  for (const p of [...bed.parts]) scene.add(r.boxGroup(p.min, p.size, 0xffffff));
  const m = bed.byId.mattress;
  scene.add(r.boxGroup(m.min, m.size, 0xffffff));
  return r.render(scene, VIEWS.iso, 0.04);
}

// --- SVG-pictogrammen ----------------------------------------------------
const svg = (body, vb = '0 0 120 120') => `<svg viewBox="${vb}" class="pict" fill="none" stroke="#111" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
const person = x => `<circle cx="${x}" cy="22" r="10"/><path d="M${x - 16} 104 L${x - 12} 60 Q${x} 38 ${x + 12} 60 L${x + 16} 104"/>`;
export const PICTS = {
  twee: svg(person(38) + person(82)),
  een: svg(person(60) + '<path d="M20 20 L100 100"/>'),
  boor: svg('<rect x="22" y="34" width="58" height="26" rx="6"/><path d="M80 47 H104 M50 60 L44 100 H64 L66 60"/><path d="M104 47 l8 0"/>'),
  zaag: svg('<path d="M14 46 L102 30 L106 54 L20 74 Z"/><path d="M20 74 l4 6 4-7 4 6 4-7 4 6 4-7 4 6 4-7 4 6 4-7 4 6 4-7 4 6 4-7 4 6 4-7"/><rect x="2" y="40" width="18" height="38" rx="5"/>'),
  haak: svg('<path d="M20 20 V100 H100 V84 H36 V20 Z"/><path d="M28 34 h8 M28 48 h8 M28 62 h8 M50 92 v8 M64 92 v8 M78 92 v8"/>'),
  meter: svg('<rect x="16" y="30" width="60" height="60" rx="10"/><circle cx="46" cy="60" r="10"/><path d="M76 74 H110 V86 H76"/><path d="M86 74 v5 M96 74 v5 M106 74 v5"/>'),
  potlood: svg('<path d="M24 96 L34 70 L88 16 L104 32 L50 86 Z M24 96 L34 70 L50 86 Z M80 24 L96 40"/>'),
  klem: svg('<path d="M30 14 V106 M30 18 H92 V40 M30 102 H70 M70 102 V58 M60 58 H80 M86 40 H98 V56 H86 Z"/>'),
  schuur: svg('<rect x="20" y="52" width="80" height="26" rx="4"/><path d="M28 52 Q60 22 92 52"/><path d="M20 86 h80" stroke-dasharray="4 5"/>'),
  kwast: svg('<rect x="50" y="10" width="20" height="44" rx="8"/><rect x="42" y="54" width="36" height="12"/><path d="M42 66 L38 106 H82 L78 66"/><path d="M50 106 v-14 M60 106 v-18 M70 106 v-14"/>'),
  ok: svg('<circle cx="60" cy="60" r="44"/><path d="M38 62 L54 78 L84 44"/>'),
  nee: svg('<circle cx="60" cy="60" r="44"/><path d="M30 30 L90 90"/>'),
  vloer: svg('<path d="M10 92 H110"/><path d="M20 92 l10 10 M40 92 l10 10 M60 92 l10 10 M80 92 l10 10"/><rect x="34" y="50" width="52" height="42"/><path d="M44 50 V40 H76 V50"/>'),
};

function screwSvg(len, dia) {
  // 1:1 op papier: 1 mm = 1 eenheid
  const w = len + 8, h = Math.max(dia * 2.4, 12);
  const y = h / 2, r = dia / 2;
  let threads = '';
  for (let x = 10; x < len - 2; x += 2.5) threads += `M${x} ${y - r} l1.2 ${dia}`;
  return `<svg class="screw" viewBox="0 0 ${w} ${h}" style="width:${w}mm;height:${h}mm" fill="none" stroke="#111" stroke-width="0.4">
    <rect x="0.5" y="${y - dia}" width="2.5" height="${dia * 2}" fill="#fff"/>
    <path d="M3 ${y - r} H${len - 3} L${len + 2} ${y} L${len - 3} ${y + r} H3 Z" fill="#fff"/>
    <path d="${threads}"/></svg>`;
}

const HW_ICON = {
  s6x120: () => screwSvg(120, 6), s5x50: () => screwSvg(50, 5), s4x40: () => screwSvg(40, 4), s4x30: () => screwSvg(30, 4),
  bedverbinder: () => svg('<rect x="20" y="16" width="30" height="88"/><rect x="58" y="16" width="30" height="88"/><path d="M50 40 h8 M50 70 h8"/><circle cx="35" cy="30" r="4"/><circle cx="35" cy="90" r="4"/><circle cx="73" cy="30" r="4"/><circle cx="73" cy="90" r="4"/>'),
  hoekijzer: () => svg('<path d="M24 20 V96 H100 V80 H40 V20 Z"/><circle cx="32" cy="40" r="4"/><circle cx="32" cy="64" r="4"/><circle cx="60" cy="88" r="4"/><circle cx="84" cy="88" r="4"/>'),
  gatplaat: () => svg('<rect x="40" y="8" width="40" height="104"/><circle cx="52" cy="22" r="4"/><circle cx="68" cy="22" r="4"/><circle cx="52" cy="44" r="4"/><circle cx="68" cy="44" r="4"/><circle cx="52" cy="76" r="4"/><circle cx="68" cy="76" r="4"/><circle cx="52" cy="98" r="4"/><circle cx="68" cy="98" r="4"/>'),
  lijm: () => svg('<path d="M44 30 H76 V104 H44 Z M52 30 L58 8 H62 L68 30"/><path d="M50 60 H70"/>'),
  vilt: () => svg('<ellipse cx="60" cy="56" rx="38" ry="14"/><path d="M22 56 V68 Q60 92 98 68 V56"/>'),
  rolbodem: () => svg('<path d="M10 70 H90"/><circle cx="96" cy="64" r="14"/><path d="M14 64 h70 M14 76 h70"/>'),
};
const HW_LABEL = { s6x120: '6 × 120', s5x50: '5 × 50', s4x40: '4 × 40', s4x30: '4 × 30', bedverbinder: 'bedverbinder', hoekijzer: 'hoekijzer', gatplaat: 'gatplaat', lijm: 'houtlijm', vilt: 'vilt', rolbodem: 'rolbodem' };
const HW_ORDER = ['bedverbinder', 's6x120', 's5x50', 's4x40', 's4x30', 'hoekijzer', 'gatplaat', 'vilt'];

// --- Pagina's ------------------------------------------------------------
export function renderManual(el, bed) {
  const steps = buildSteps(bed);
  const size = `${bed.cfg.mattressW / 10} × ${bed.cfg.mattressL / 10}`;
  const pages = [];
  const page = (body, cls = '') => pages.push(`<section class="mpage ${cls}">${body}<footer class="mfoot"><span>ROAN · bed ${size}</span><span>${pages.length + 1}</span></footer></section>`);

  page(`<div class="mcover"><div class="mbrand">ROAN</div><div class="msub">Bed ${size} cm · zelfbouw</div>
    <img src="${coverImage(bed)}" alt="Lijntekening van het complete bed"/>
    <div class="mtag">${bed.outer.x1 - bed.outer.x0} × ${bed.outer.z1 - bed.outer.z0} × ${bed.headH} mm</div></div>`, 'cover');

  page(`<div class="mgrid4">
      <div class="mtile">${PICTS.twee}${PICTS.ok}</div>
      <div class="mtile">${PICTS.een}${PICTS.nee}</div>
      <div class="mtile">${PICTS.vloer}${PICTS.ok}</div>
      <div class="mtile">${PICTS.schuur}${PICTS.kwast}</div>
    </div>
    <ol class="mtips"><li>Doe stap 6 met z’n tweeën.</li><li>Werk op een kleed of karton, niet op de kale vloer.</li>
    <li>Schuur alle delen (80 → 120 → 180) en olie of beits ze vóór de montage. Laat 24 uur drogen.</li>
    <li>Boor altijd voor: 3 mm voor 4 mm schroeven, 4 mm voor 5 en 6 mm schroeven.</li></ol>`);

  page(`<h2 class="mh">Gereedschap</h2><div class="mtools">
    ${['boor', 'zaag', 'haak', 'meter', 'potlood', 'klem', 'schuur', 'kwast'].map(k => `<div>${PICTS[k]}</div>`).join('')}</div>
    <p class="msmall">Accuboormachine met houtboren 3/4 mm en verzinkboor · zaag (of laat zagen in de winkel) · winkelhaak · rolmaat · potlood · 2 lijmklemmen · schuurblok · kwast of doek</p>`);

  page(`<h2 class="mh">Onderdelen</h2><div class="mparts">
    ${bed.codes.map(c => `<div class="mpart"><div class="mcode">${c.code}</div><img src="${partThumb(bed, c)}" alt=""/>
      <div class="mqty">${c.bought ? '1×' : c.ids.length + '×'}</div>
      <div class="mdim">${c.bought ? 'rolbodem' : [...c.size].sort((a, b) => b - a).join(' × ') + ' mm'}</div></div>`).join('')}</div>`);

  page(`<h2 class="mh">Bevestigingsmateriaal</h2><p class="msmall">Schroeven op ware grootte (1:1) als je deze pagina op A4 afdrukt.</p><div class="mhw">
    ${HW_ORDER.filter(k => bed.need[k]).map(k => `<div class="mhwi"><div class="mhwic">${HW_ICON[k]()}</div><div class="mqty">${bed.need[k]}×</div><div class="mdim">${HW_LABEL[k]}</div></div>`).join('')}</div>`);

  steps.forEach((s, i) => {
    const parts = [...new Set(s.add.filter(id => bed.byId[id] && !bed.byId[id].kind).map(id => bed.byId[id].code))]
      .map(code => `<div class="mcall"><b>${s.add.filter(id => bed.byId[id]?.code === code).length}×</b><span class="mcode sm">${code}</span></div>`).join('');
    const hw = s.hw.map(([k, n]) => `<div class="mcall"><b>${n}×</b><span class="mhwsm">${HW_ICON[k] ? HW_ICON[k]() : ''}</span><span class="mdim">${HW_LABEL[k] || HARDWARE[k]?.name || k}</span></div>`).join('');
    page(`<div class="mstephead"><div class="mstepnr">${i + 1}</div><div class="mcallbox">${parts}${hw}${s.persons === 2 ? `<div class="mcall persons">${PICTS.twee}</div>` : ''}</div></div>
      <img class="mstep" src="${stepImage(bed, s)}" alt="Stap ${i + 1}"/>
      <p class="mcap">${s.caption}</p>`);
  });

  el.innerHTML = pages.join('');
  return pages.length;
}
