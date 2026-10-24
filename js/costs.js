// Prijscatalogus, zaaglijst en kostprijsberekening.
// Prijzen zijn indicatief (bouwmarkt NL, najaar 2026) en niet live gecontroleerd.

export const STORES = [
  { id: 'gamma', name: 'GAMMA', url: q => `https://www.gamma.nl/assortiment/zoeken?text=${encodeURIComponent(q)}` },
  { id: 'karwei', name: 'KARWEI', url: q => `https://www.karwei.nl/assortiment/zoeken?text=${encodeURIComponent(q)}` },
  { id: 'hornbach', name: 'HORNBACH', url: q => `https://www.hornbach.nl/s/${encodeURIComponent(q)}` },
];

export const PROFILES = {
  v70x70: { name: 'Vuren geschaafd 70 × 70 mm', search: 'vuren geschaafd 70x70', stock: [{ len: 2400, price: 17.99 }, { len: 3000, price: 21.99 }] },
  v44x144: { name: 'Vuren geschaafd 44 × 144 mm', search: 'vuren geschaafd 44x144', stock: [{ len: 2400, price: 19.99 }, { len: 3000, price: 24.99 }, { len: 4200, price: 34.99 }] },
  v22x44: { name: 'Vuren geschaafd 22 × 44 mm', search: 'vuren geschaafd 22x44', stock: [{ len: 2400, price: 3.49 }, { len: 2700, price: 3.99 }] },
  v18x70: { name: 'Vuren geschaafd 18 × 70 mm', search: 'vuren geschaafd 18x70', stock: [{ len: 2400, price: 4.29 }, { len: 2700, price: 4.79 }, { len: 3000, price: 5.29 }] },
  v18x144: { name: 'Vuren geschaafd 18 × 144 mm', search: 'vuren geschaafd 18x144', stock: [{ len: 1800, price: 6.99 }, { len: 2400, price: 8.99 }] },
};

export const HARDWARE = {
  bedverbinder: { name: 'Bedverbinders (bedhaken)', pack: 2, unit: 'set van 2', price: 6.99, search: 'bedverbinder', cat: 'Bevestiging' },
  s6x120: { name: 'Constructieschroef 6 × 120 mm', pack: 50, unit: 'doos 50', price: 13.99, search: 'constructieschroef 6x120', cat: 'Bevestiging' },
  s5x50: { name: 'Spaanplaatschroef 5 × 50 mm', pack: 100, unit: 'doos 100', price: 7.99, search: 'spaanplaatschroef 5x50', cat: 'Bevestiging' },
  s4x40: { name: 'Spaanplaatschroef 4 × 40 mm', pack: 200, unit: 'doos 200', price: 7.49, search: 'spaanplaatschroef 4x40', cat: 'Bevestiging' },
  s4x30: { name: 'Spaanplaatschroef 4 × 30 mm', pack: 200, unit: 'doos 200', price: 6.49, search: 'spaanplaatschroef 4x30', cat: 'Bevestiging' },
  hoekijzer: { name: 'Hoekijzer verzinkt 50 × 50 mm', pack: 4, unit: '4 stuks', price: 3.99, search: 'hoekijzer 50x50', cat: 'Bevestiging' },
  gatplaat: { name: 'Gatplaat verzinkt 40 × 120 mm', pack: 4, unit: '4 stuks', price: 3.99, search: 'gatplaat 40x120', cat: 'Bevestiging' },
  lijm: { name: 'Houtlijm D3 watervast 250 g', pack: 1, unit: 'flacon', price: 7.99, search: 'houtlijm d3', cat: 'Afwerking' },
  schuur: { name: 'Schuurpapier set korrel 80/120/180', pack: 1, unit: 'set', price: 6.99, search: 'schuurpapier set', cat: 'Afwerking' },
  vilt: { name: 'Viltglijders rond 30 mm', pack: 16, unit: '16 stuks', price: 3.49, search: 'viltglijders 30mm', cat: 'Afwerking' },
  olie: { name: 'Hardwax-olie naturel 750 ml', pack: 1, unit: 'blik', price: 29.99, search: 'hardwax olie naturel', cat: 'Afwerking' },
  wit: { name: 'Meubelbeits wit 750 ml', pack: 1, unit: 'blik', price: 24.99, search: 'meubelbeits wit', cat: 'Afwerking' },
  zwart: { name: 'Meubelbeits zwart 750 ml', pack: 1, unit: 'blik', price: 24.99, search: 'meubelbeits zwart', cat: 'Afwerking' },
};

const ROLBODEM = { 900: 29.99, 1200: 39.99, 1400: 44.99 };
const MATRAS = { 900: 249, 1200: 299, 1400: 349 };
export const KERF = 4;   // zaagsnede in mm
const DENSITY = 450;     // vuren, kg/m³

// Verdeel stukken over handelslengtes: first-fit decreasing per basislengte,
// daarna elke plank terugbrengen naar de goedkoopste lengte waar de stukken in passen.
export function packProfile(pieces, stock) {
  const sorted = [...pieces].sort((a, b) => b.len - a.len);
  let best = null;
  for (const base of stock) {
    if (sorted[0].len > base.len) continue;
    const bins = [];
    for (const p of sorted) {
      let bin = bins.find(b => b.used + (b.cuts.length ? KERF : 0) + p.len <= base.len);
      if (!bin) { bin = { cuts: [], used: 0 }; bins.push(bin); }
      bin.used += (bin.cuts.length ? KERF : 0) + p.len;
      bin.cuts.push(p);
    }
    let cost = 0;
    for (const b of bins) {
      b.stock = stock.filter(s => s.len >= b.used).sort((x, y) => x.price - y.price)[0];
      b.waste = b.stock.len - b.used;
      cost += b.stock.price;
    }
    if (!best || cost < best.cost) best = { bins, cost };
  }
  return best;
}

export function computeCosts(bed) {
  const wood = bed.parts.filter(p => !p.bought);
  const byProfile = {};
  for (const p of wood) (byProfile[p.profile] ||= []).push({ len: p.len, code: p.code, id: p.id });
  const profiles = Object.entries(byProfile).map(([key, pieces]) => {
    const packed = packProfile(pieces, PROFILES[key].stock);
    return { key, ...PROFILES[key], pieces, ...packed };
  });

  let area = 0, volume = 0;
  for (const p of wood) {
    const [a, b, c] = p.size.map(v => v / 1000);
    area += 2 * (a * b + b * c + a * c);
    volume += a * b * c;
  }

  const lines = [];
  for (const pr of profiles) {
    const counts = {};
    for (const b of pr.bins) counts[b.stock.len] = (counts[b.stock.len] || 0) + 1;
    for (const [len, qty] of Object.entries(counts)) {
      const st = pr.stock.find(s => s.len === +len);
      lines.push({ id: `${pr.key}-${len}`, cat: 'Hout', name: `${pr.name}, ${len / 10} cm`, unit: 'plank', qty, price: st.price, search: pr.search });
    }
  }
  const n = bed.need;
  const hwLine = (key, need) => {
    if (!need) return;
    const h = HARDWARE[key];
    lines.push({ id: key, cat: h.cat, name: h.name, unit: h.unit, qty: Math.ceil(need / h.pack), need, price: h.price, search: h.search });
  };
  hwLine('bedverbinder', n.bedverbinder);
  hwLine('s6x120', n.s6x120);
  hwLine('s5x50', n.s5x50);
  hwLine('s4x40', n.s4x40);
  hwLine('s4x30', n.s4x30);
  hwLine('hoekijzer', n.hoekijzer);
  hwLine('gatplaat', n.gatplaat);
  if (bed.cfg.slats === 'rolbodem')
    lines.push({ id: 'rolbodem', cat: 'Hout', name: `Rolbodem ${bed.cfg.mattressW / 10} × ${bed.cfg.mattressL / 10} cm`, unit: 'stuk', qty: 1, price: ROLBODEM[bed.cfg.mattressW], search: `rolbodem ${bed.cfg.mattressW / 10}x200` });
  hwLine('lijm', 1);
  hwLine('schuur', 1);
  hwLine(bed.cfg.finish, 1);
  hwLine('vilt', n.vilt);

  const cuts = profiles.reduce((s, pr) => s + pr.bins.reduce((t, b) => t + b.cuts.length - (b.waste === 0 && b.cuts.length === 1 ? 1 : 0), 0), 0);
  const optional = [
    { id: 'zaag', cat: 'Optioneel', name: 'Zaagservice in de winkel (± € 0,50 per snede)', unit: 'snede', qty: cuts, price: 0.5, search: 'zaagservice', optional: true },
    { id: 'matras', cat: 'Optioneel', name: `Matras ${bed.cfg.mattressW / 10} × ${bed.cfg.mattressL / 10} cm, pocketvering`, unit: 'stuk', qty: 1, price: MATRAS[bed.cfg.mattressW], search: `matras ${bed.cfg.mattressW / 10}x200 pocketvering`, optional: true },
  ];

  return { profiles, lines, optional, area, volume, weight: volume * DENSITY, cuts };
}

export const euro = v => '€ ' + v.toLocaleString('nl-NL', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
