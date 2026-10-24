// Kamermodel en plaatsingscontroles. Eenheden: millimeter.
// Achterwand = z 0, voorwand = z l, linkerwand = x 0, rechterwand = x w.
// Startwaarden zijn geschat uit foto's van de kamer en moeten worden nagemeten.

export const DEFAULT_ROOM = {
  w: 2400, l: 3000, h: 2600,
  door: { wall: 'voor', offset: 1450, width: 830 },
  windows: [
    { name: 'Raam groene wand', wall: 'achter', offset: 850, width: 700, sill: 1000, height: 1450 },
    { name: 'Raam witte wand', wall: 'links', offset: 650, width: 800, sill: 1000, height: 1400 },
  ],
  furniture: [
    { name: 'Radiator', x: 900, z: 0, w: 600, d: 100, h: 750, clear: 0, face: 'z+' },
    { name: 'Bureau', x: 1850, z: 250, w: 550, d: 950, h: 750, clear: 600, face: 'x-' },
    { name: 'Kinderstoel', x: 1950, z: 1300, w: 450, d: 500, h: 800, clear: 0, face: 'x-' },
    { name: 'Kledingkast', x: 0, z: 2450, w: 800, d: 550, h: 2000, clear: 450, face: 'z-' },
  ],
  bed: { x: 0, z: 0, rot: 0 },
};

export const WALLS = {
  achter: { label: 'Achterwand (groen)', origin: [0, 0], u: [1, 0], n: [0, 1], len: r => r.w },
  voor: { label: 'Voorwand (deur)', origin: [0, 'l'], u: [1, 0], n: [0, -1], len: r => r.w },
  links: { label: 'Linkerwand (wit)', origin: [0, 0], u: [0, 1], n: [1, 0], len: r => r.l },
  rechts: { label: 'Rechterwand (behang)', origin: ['w', 0], u: [0, 1], n: [-1, 0], len: r => r.l },
};

export function wallFrame(room, wall) {
  const W = WALLS[wall];
  const o = W.origin.map(v => (v === 'l' ? room.l : v === 'w' ? room.w : v));
  return { o, u: W.u, n: W.n, len: W.len(room) };
}

// Voetafdruk van het bed in kamercoördinaten, gegeven bed.outer en plaatsing.
export function bedFootprint(bed, place) {
  const { x0, x1, z0, z1 } = bed.outer;
  const bw = x1 - x0, bl = z1 - z0;
  const swap = place.rot % 180 !== 0;
  return { x0: place.x, z0: place.z, x1: place.x + (swap ? bl : bw), z1: place.z + (swap ? bw : bl) };
}

// Rechthoek die vrij moet blijven voor een meubel (kastdeuren, bureaustoel).
export function clearRect(f) {
  if (!f.clear) return null;
  switch (f.face) {
    case 'z-': return { x0: f.x, x1: f.x + f.w, z0: f.z - f.clear, z1: f.z };
    case 'z+': return { x0: f.x, x1: f.x + f.w, z0: f.z + f.d, z1: f.z + f.d + f.clear };
    case 'x-': return { x0: f.x - f.clear, x1: f.x, z0: f.z, z1: f.z + f.d };
    case 'x+': return { x0: f.x + f.w, x1: f.x + f.w + f.clear, z0: f.z, z1: f.z + f.d };
  }
}

const overlap = (a, b) => Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0)) > 0;
const gapDepth = (a, b) => Math.min(Math.min(a.z1, b.z1) - Math.max(a.z0, b.z0), Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0));

export function checkPlacement(room, bed, place) {
  const fp = bedFootprint(bed, place);
  const out = [];
  if (fp.x0 < 0 || fp.z0 < 0 || fp.x1 > room.w || fp.z1 > room.l)
    out.push({ level: 'bad', text: `Het bed past niet in de kamer: buitenmaat ${((fp.x1 - fp.x0) / 10).toFixed(0)} × ${((fp.z1 - fp.z0) / 10).toFixed(0)} cm.` });

  for (const f of room.furniture) {
    const r = { x0: f.x, x1: f.x + f.w, z0: f.z, z1: f.z + f.d };
    if (overlap(fp, r)) out.push({ level: 'bad', text: `Het bed staat ${Math.round(gapDepth(fp, r) / 10)} cm in ${f.name.toLowerCase()}.` });
    const c = clearRect(f);
    if (c && overlap(fp, c)) out.push({ level: 'warn', text: `Te weinig vrije ruimte voor ${f.name.toLowerCase()} (${f.clear / 10} cm nodig, ${Math.max(0, Math.round((f.clear - gapDepth(fp, c)) / 10))} cm over).` });
  }

  // Draaicirkel deur: bemonster het bed op 50 mm
  const d = wallFrame(room, room.door.wall);
  const hinge = [d.o[0] + d.u[0] * room.door.offset, d.o[1] + d.u[1] * room.door.offset];
  let hit = false;
  for (let x = fp.x0; x <= fp.x1 && !hit; x += 50) for (let z = fp.z0; z <= fp.z1 && !hit; z += 50) {
    const vx = x - hinge[0], vz = z - hinge[1];
    if (vx * vx + vz * vz < room.door.width ** 2 && vx * d.u[0] + vz * d.u[1] >= 0 && vx * d.n[0] + vz * d.n[1] >= 0) hit = true;
  }
  if (hit) out.push({ level: 'bad', text: 'De deur kan niet helemaal open: het bed staat in de draaicirkel.' });

  const long = place.rot % 180 === 0 ? [fp.x0, room.w - fp.x1] : [fp.z0, room.l - fp.z1];
  if (Math.max(...long) < 600) out.push({ level: 'warn', text: 'Minder dan 60 cm loopruimte naast het bed.' });

  if (!out.length) out.push({ level: 'ok', text: 'Het bed past: geen botsingen met muren, deur of meubels.' });
  return { fp, checks: out };
}
