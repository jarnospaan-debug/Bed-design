import { buildBed, DEFAULT_BED, MATTRESS_WIDTHS } from './bed.js';
import { computeCosts, STORES, euro } from './costs.js';
import { DEFAULT_ROOM, WALLS, checkPlacement } from './room.js';

const $ = id => document.getElementById(id);
const clone = o => JSON.parse(JSON.stringify(o));
const store = {
  get(k, d) { try { const v = localStorage.getItem('roanbed.' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('roanbed.' + k, JSON.stringify(v)); } catch { /* geen opslag beschikbaar */ } },
};

const state = {
  bedCfg: { ...DEFAULT_BED, ...store.get('bed', {}) },
  room: { ...clone(DEFAULT_ROOM), ...store.get('room', {}) },
  view: { walls: true, furniture: true, mattress: true },
  cart: store.get('cart', {}),        // per regel-id: { price, qty, bought, include }
  storeId: store.get('store', 'gamma'),
};
let bed, costs, placement, viewer = null, manualDirty = true;

// ---------- Viewer laden (WebGL kan ontbreken) ----------
async function initViewer() {
  try {
    const { Viewer } = await import('./viewer.js');
    viewer = new Viewer($('viewer'));
    viewer.onMeasure = d => { $('measureOut').textContent = d == null ? 'Klik het tweede punt.' : `Afstand: ${(d / 10).toFixed(1)} cm`; };
    const dark = matchMedia('(prefers-color-scheme: dark)');
    const setDark = () => viewer.setDark(document.documentElement.dataset.theme ? document.documentElement.dataset.theme === 'dark' : dark.matches);
    dark.addEventListener('change', setDark);
    new MutationObserver(setDark).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    setDark();
    refresh3D();
    viewer.view('room');
  } catch (e) {
    console.error(e);
    $('glErr').hidden = false;
  }
}
const refresh3D = () => viewer?.update(state.room, bed, state.view);

// ---------- Berekening ----------
function recompute() {
  bed = buildBed(state.bedCfg);
  costs = computeCosts(bed);
  placement = checkPlacement(state.room, bed, state.room.bed);
  manualDirty = true;
  store.set('bed', state.bedCfg);
  store.set('room', state.room);
  renderOntwerpInfo();
  renderCosts();
  renderCart();
  refresh3D();
  if (currentTab === 'handleiding') renderManualNow();
}

function cartLines() {
  return [...costs.lines, ...costs.optional].map(l => {
    const o = state.cart[l.id] || {};
    const price = o.price ?? l.price, qty = o.qty ?? l.qty;
    const include = l.optional ? !!o.include : o.include !== false;
    return { ...l, price, qty, include, bought: !!o.bought, total: price * qty };
  });
}
const totals = lines => {
  const t = { all: 0 };
  for (const l of lines) if (l.include) { t.all += l.total; t[l.cat] = (t[l.cat] || 0) + l.total; }
  return t;
};

// ---------- Ruimte ----------
const cm = mm => Math.round(mm / 10);
function bindNum(id, get, set) {
  const el = $(id);
  el.value = cm(get());
  el.onchange = () => { const v = parseFloat(el.value); if (!isNaN(v)) { set(Math.round(v * 10)); recompute(); } };
}
function wallOptions(sel, value) {
  sel.innerHTML = Object.entries(WALLS).map(([k, w]) => `<option value="${k}">${w.label}</option>`).join('');
  sel.value = value;
}

function renderRoomForm() {
  const r = state.room;
  bindNum('roomW', () => r.w, v => (r.w = v));
  bindNum('roomL', () => r.l, v => (r.l = v));
  bindNum('roomH', () => r.h, v => (r.h = v));
  wallOptions($('doorWall'), r.door.wall);
  $('doorWall').onchange = e => { r.door.wall = e.target.value; recompute(); };
  bindNum('doorOff', () => r.door.offset, v => (r.door.offset = v));
  bindNum('doorW', () => r.door.width, v => (r.door.width = v));

  $('windows').innerHTML = r.windows.map((w, i) => `
    <div><div class="subhead">${w.name}</div>
    <label style="margin-bottom:6px">Wand<select data-win="${i}" data-k="wall"></select></label>
    <div class="row3">
      <label>Vanaf hoek<input type="number" data-win="${i}" data-k="offset" value="${cm(w.offset)}"><span class="u">cm</span></label>
      <label>Breedte<input type="number" data-win="${i}" data-k="width" value="${cm(w.width)}"><span class="u">cm</span></label>
      <label>Vensterbank<input type="number" data-win="${i}" data-k="sill" value="${cm(w.sill)}"><span class="u">cm</span></label>
    </div></div>`).join('');
  $('windows').querySelectorAll('select').forEach(s => wallOptions(s, r.windows[s.dataset.win].wall));
  $('windows').querySelectorAll('[data-win]').forEach(el => el.addEventListener('change', () => {
    const w = r.windows[el.dataset.win];
    w[el.dataset.k] = el.tagName === 'SELECT' ? el.value : Math.round(parseFloat(el.value) * 10) || 0;
    recompute();
  }));

  $('furniture').innerHTML = r.furniture.map((f, i) => `
    <div><div class="subhead">${f.name}</div><div class="row4" style="grid-template-columns:repeat(5,minmax(0,1fr))">
      ${[['x', 'x'], ['z', 'z'], ['w', 'breed'], ['d', 'diep'], ['clear', 'vrij']].map(([k, l]) => `<label>${l}<input type="number" data-f="${i}" data-k="${k}" value="${cm(f[k])}"></label>`).join('')}
    </div></div>`).join('');
  $('furniture').querySelectorAll('[data-f]').forEach(el => el.addEventListener('change', () => {
    r.furniture[el.dataset.f][el.dataset.k] = Math.round(parseFloat(el.value) * 10) || 0;
    recompute();
  }));
}

function bindScan() {
  $('scanFile').addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f || !viewer) return;
    $('scanInfo').textContent = 'Scan laden…';
    try {
      const s = await viewer.loadScan(f);
      $('scanControls').hidden = false;
      $('scanInfo').textContent = `${f.name}: ${cm(s.w)} × ${cm(s.l)} × ${cm(s.h)} cm`;
      $('showFurn').checked = state.view.furniture = false;
      refresh3D();
    } catch (err) {
      $('scanInfo').textContent = 'Deze scan kan niet worden gelezen. Exporteer opnieuw als GLB of OBJ.';
      $('scanControls').hidden = false;
    }
  });
  const upd = () => {
    viewer?.setScanOpts({ unit: +$('scanUnit').value, rot: +$('scanRot').value || 0, x: (+$('scanX').value || 0) * 10, z: (+$('scanZ').value || 0) * 10 });
    const s = viewer?.scanSize();
    if (s) $('scanInfo').textContent = `Scan: ${cm(s.w)} × ${cm(s.l)} × ${cm(s.h)} cm`;
  };
  ['scanUnit', 'scanRot', 'scanX', 'scanZ'].forEach(id => $(id).addEventListener('input', upd));
  $('scanApply').onclick = () => {
    const s = viewer?.scanSize();
    if (!s) return;
    Object.assign(state.room, { w: s.w, l: s.l, h: s.h });
    renderRoomForm();
    recompute();
  };
  $('scanClear').onclick = () => { viewer?.clearScan(); $('scanControls').hidden = true; $('scanFile').value = ''; };
  $('showWalls').onchange = e => { state.view.walls = e.target.checked; refresh3D(); };
  $('showFurn').onchange = e => { state.view.furniture = e.target.checked; refresh3D(); };
  $('measureBtn').onclick = e => {
    if (!viewer) return;
    viewer.measuring = !viewer.measuring;
    e.target.setAttribute('aria-pressed', viewer.measuring);
    e.target.textContent = viewer.measuring ? 'Meetlint uit' : 'Meetlint aan';
    if (!viewer.measuring) { viewer.clearMeasure(); $('measureOut').textContent = 'Klik twee punten in de 3D-weergave.'; }
  };
}

// ---------- Ontwerp ----------
function seg(id, value, onPick) {
  const el = $(id);
  el.querySelectorAll('button').forEach(b => {
    b.setAttribute('aria-pressed', b.dataset.v === String(value));
    b.onclick = () => { el.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', x === b)); onPick(b.dataset.v); };
  });
}

function renderOntwerpForm() {
  const c = state.bedCfg;
  $('sizeSeg').innerHTML = MATTRESS_WIDTHS.map(w => `<button type="button" data-v="${w}">${w / 10} × 200</button>`).join('');
  seg('sizeSeg', c.mattressW, v => { c.mattressW = +v; recompute(); });
  seg('slatSeg', c.slats, v => { c.slats = v; recompute(); });
  seg('finishSeg', c.finish, v => { c.finish = v; recompute(); });
  const rail = $('railTop'), head = $('headH');
  rail.value = c.railTop; head.value = c.headH;
  $('headboard').checked = c.headboard;
  const outs = () => {
    $('railOut').textContent = `${cm(c.railTop)} cm (matras boven ± ${cm(c.railTop - 40 + 200)} cm)`;
    $('headOut').textContent = `${cm(c.headH)} cm`;
    $('headWrap').hidden = !c.headboard;
  };
  outs();
  rail.oninput = () => { c.railTop = +rail.value; outs(); recompute(); };
  head.oninput = () => { c.headH = +head.value; outs(); recompute(); };
  $('headboard').onchange = e => { c.headboard = e.target.checked; outs(); recompute(); };
  const p = state.room.bed;
  bindNum('bedX', () => p.x, v => (p.x = v));
  bindNum('bedZ', () => p.z, v => (p.z = v));
  $('bedRot').value = p.rot;
  $('bedRot').onchange = e => { p.rot = +e.target.value; recompute(); };
  $('showMattress').onchange = e => { state.view.mattress = e.target.checked; refresh3D(); };
}

function renderOntwerpInfo() {
  $('checks').innerHTML = placement.checks.map(c => `<li class="${c.level}">${c.text}</li>`).join('');
  const worst = placement.checks.some(c => c.level === 'bad') ? 'bad' : placement.checks.some(c => c.level === 'warn') ? 'warn' : 'ok';
  const pill = $('sumFit');
  pill.className = 'pill ' + (worst === 'ok' ? '' : worst);
  pill.textContent = { ok: 'past', warn: 'krap', bad: 'botst' }[worst];
  const o = bed.outer;
  $('facts').innerHTML = `
    <dt>Buitenmaat</dt><dd>${cm(o.x1 - o.x0)} × ${cm(o.z1 - o.z0)} cm</dd>
    <dt>Hoogte matras</dt><dd>± ${cm(bed.slatTop + 200)} cm</dd>
    <dt>Houtdelen</dt><dd>${bed.parts.filter(p => !p.bought).length} stuks, ${costs.cuts} zaagsneden</dd>
    <dt>Gewicht</dt><dd>± ${Math.round(costs.weight)} kg</dd>
    <dt>Oppervlak</dt><dd>${costs.area.toFixed(1)} m² te oliën</dd>`;
  $('sumSize').textContent = `${bed.cfg.mattressW / 10} × ${bed.cfg.mattressL / 10} cm`;
}

// ---------- Kosten ----------
function renderCosts() {
  const lines = cartLines();
  const t = totals(lines);
  $('sumTotal').textContent = euro(t.all);
  $('costTiles').innerHTML = [['Totaal', t.all, 'main'], ['Hout', t.Hout || 0], ['Bevestiging', t.Bevestiging || 0], ['Afwerking', t.Afwerking || 0]]
    .map(([k, v, c]) => `<div class="tile ${c || ''}"><div class="k">${k}</div><div class="v">${euro(v)}</div></div>`).join('');

  let html = '<thead><tr><th>Artikel</th><th>Verpakking</th><th class="num">Aantal</th><th class="num">Prijs</th><th class="num">Subtotaal</th></tr></thead><tbody>';
  let cat = '';
  for (const l of lines) {
    if (l.cat !== cat) { cat = l.cat; html += `<tr class="cat"><td colspan="5">${cat}</td></tr>`; }
    html += `<tr class="${l.include ? '' : 'off'}"><td>${l.name}${l.need ? ` <span class="hint">(${l.need} nodig)</span>` : ''}</td><td>${l.unit}</td><td class="num">${l.qty}</td><td class="num">${euro(l.price)}</td><td class="num">${l.include ? euro(l.total) : 'niet mee'}</td></tr>`;
  }
  html += `</tbody><tfoot><tr><td colspan="4">Totaal</td><td class="num">${euro(t.all)}</td></tr></tfoot>`;
  $('costTable').innerHTML = html;

  $('cutlist').innerHTML = costs.profiles.map(pr => `
    <div class="cut-prof"><h3>${pr.name}</h3>
    ${pr.bins.map(b => `<div class="board"><span class="lbl">${b.stock.len / 10} cm</span><div class="bar">
      ${b.cuts.map(c => `<span class="seg-cut" style="width:${(c.len / b.stock.len) * 100}%"><b>${c.code}</b>${c.len}</span>`).join('')}
    </div></div>`).join('')}</div>`).join('');

  $('partTable').innerHTML = '<thead><tr><th>Code</th><th>Onderdeel</th><th>Profiel</th><th class="num">Lengte</th><th class="num">Aantal</th></tr></thead><tbody>' +
    bed.codes.map(c => `<tr><td><span class="code">${c.code}</span></td><td>${c.name}</td><td>${c.bought ? 'gekocht' : c.profile.replace('v', '').replace('x', ' × ') + ' mm'}</td><td class="num">${c.bought ? '' : c.len + ' mm'}</td><td class="num">${c.ids.length}</td></tr>`).join('') + '</tbody>';
}

// ---------- Winkelmandje ----------
function renderCart() {
  const st = STORES.find(s => s.id === state.storeId) || STORES[0];
  const lines = cartLines();
  const t = totals(lines);
  const open = lines.filter(l => l.include && !l.bought).length;
  $('cartBadge').textContent = open;
  let html = '<thead><tr><th>Mee</th><th>Gekocht</th><th>Artikel</th><th class="num">Aantal</th><th class="num">Prijs</th><th class="num">Subtotaal</th><th></th></tr></thead><tbody>';
  for (const l of lines) {
    html += `<tr class="${l.bought ? 'done' : ''} ${l.include ? '' : 'off'}" data-id="${l.id}">
      <td><input type="checkbox" data-k="include" ${l.include ? 'checked' : ''} aria-label="Meenemen"></td>
      <td><input type="checkbox" data-k="bought" ${l.bought ? 'checked' : ''} aria-label="Gekocht"></td>
      <td class="name">${l.name}<br><span class="hint">${l.unit}</span></td>
      <td class="num"><input type="number" min="0" step="1" data-k="qty" value="${l.qty}" aria-label="Aantal"></td>
      <td class="num"><input type="number" min="0" step="0.01" data-k="price" value="${l.price.toFixed(2)}" aria-label="Prijs"></td>
      <td class="num">${euro(l.total)}</td>
      <td><a href="${st.url(l.search)}" target="_blank" rel="noopener">Zoek bij ${st.name}</a></td></tr>`;
  }
  html += `</tbody><tfoot><tr><td colspan="5">Totaal (aangevinkt)</td><td class="num">${euro(t.all)}</td><td></td></tr></tfoot>`;
  $('cartTable').innerHTML = html;
}

function bindCart() {
  $('store').innerHTML = STORES.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
  $('store').value = state.storeId;
  $('store').onchange = e => { state.storeId = e.target.value; store.set('store', state.storeId); renderCart(); };
  $('cartTable').addEventListener('change', e => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr) return;
    const o = (state.cart[tr.dataset.id] ||= {});
    const k = e.target.dataset.k;
    o[k] = e.target.type === 'checkbox' ? e.target.checked : parseFloat(e.target.value) || 0;
    store.set('cart', state.cart);
    renderCosts();
    renderCart();
  });
  $('resetCart').onclick = () => {
    for (const o of Object.values(state.cart)) { delete o.price; delete o.qty; }
    store.set('cart', state.cart);
    renderCosts(); renderCart();
  };
  $('copyList').onclick = () => {
    const lines = cartLines().filter(l => l.include && !l.bought);
    const text = `Bed voor Roan, ${bed.cfg.mattressW / 10} × ${bed.cfg.mattressL / 10} cm\n\n` +
      lines.map(l => `[ ] ${l.qty} × ${l.name} (${l.unit}), ${euro(l.total)}`).join('\n') +
      `\n\nTotaal: ${euro(totals(lines).all)}\n\nZaaglijst:\n` +
      costs.profiles.map(pr => pr.name + '\n' + pr.bins.map(b => `  plank ${b.stock.len / 10} cm: ${b.cuts.map(c => c.len + ' mm').join(' + ')}`).join('\n')).join('\n');
    const msg = $('copyMsg'), fb = $('copyFallback');
    const fallback = () => { fb.hidden = false; fb.value = text; fb.select(); msg.textContent = 'Kopiëren lukt hier niet. Selecteer de tekst hieronder.'; };
    try {
      navigator.clipboard.writeText(text).then(() => { msg.textContent = 'Gekopieerd.'; fb.hidden = true; }, fallback);
    } catch { fallback(); }
  };
}

// ---------- Handleiding ----------
let manualMod = null;
async function renderManualNow() {
  if (!manualDirty) return;
  manualDirty = false;
  try {
    manualMod ||= await import('./manual.js');
    manualMod.renderManual($('manual'), bed);
  } catch (e) {
    console.error(e);
    $('manual').innerHTML = '<p class="hint">De handleiding kan niet worden getekend in deze browser (WebGL ontbreekt).</p>';
  }
}
window.addEventListener('beforeprint', () => renderManualNow());

// ---------- Tabs ----------
const TABS = ['ruimte', 'ontwerp', 'kosten', 'handleiding', 'mandje'];
let currentTab = 'ontwerp';
function showTab(tab) {
  if (!TABS.includes(tab)) tab = 'ontwerp';
  currentTab = tab;
  document.querySelectorAll('.tabs a').forEach(a => a.setAttribute('aria-selected', a.dataset.tab === tab));
  const inWork = tab === 'ruimte' || tab === 'ontwerp';
  $('work').hidden = !inWork;
  document.querySelectorAll('[data-pane]').forEach(p => (p.hidden = p.dataset.pane !== tab));
  document.querySelectorAll('[data-doc]').forEach(d => (d.hidden = d.dataset.doc !== tab));
  if (inWork) requestAnimationFrame(() => viewer?.resize());
  if (tab === 'handleiding') renderManualNow();
  store.set('tab', tab);
}
document.querySelectorAll('.tabs a').forEach(a => a.addEventListener('click', e => { e.preventDefault(); history.replaceState(null, '', '#' + a.dataset.tab); showTab(a.dataset.tab); }));
window.addEventListener('hashchange', () => showTab(location.hash.slice(1)));
document.querySelectorAll('[data-view]').forEach(b => (b.onclick = () => viewer?.view(b.dataset.view)));

// ---------- Start ----------
bed = buildBed(state.bedCfg);
costs = computeCosts(bed);
placement = checkPlacement(state.room, bed, state.room.bed);
renderRoomForm();
renderOntwerpForm();
bindScan();
bindCart();
recompute();
showTab(location.hash.slice(1) || store.get('tab', 'ontwerp'));
initViewer();
