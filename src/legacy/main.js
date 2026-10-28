import './style.css';
import { Game, fmt, fmtRate, fmtDuration } from './game.js';
import { Scene } from './scene.js';
import { ICONS } from './icons.js';
import { AUTOSAVE_MS, FAMILIARS, GROVE_UNLOCKS, GROVE_UPGRADES, RARITIES, SPEEDS, SPELL } from './data.js';

const $ = (id) => document.getElementById(id);
let iconId = 0;

function icon(name) {
  // gradients inside SVGs need unique ids when the same icon appears more than once
  const n = ++iconId;
  return (ICONS[name] || '').replace(/id="(\w+)"/g, `id="$1${n}"`).replace(/url\(#(\w+)\)/g, `url(#$1${n})`);
}

function fillIcons(root = document) {
  for (const el of root.querySelectorAll('[data-icon]')) el.innerHTML = icon(el.dataset.icon);
}

function setText(el, text) {
  if (el.textContent !== text) el.textContent = text;
}

const game = new Game();
const scene = new Scene($('stage'));
let familiarIcons = {};

// ---------------------------------------------------------------- theme

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  for (const b of document.querySelectorAll('[data-theme-btn]')) {
    b.classList.toggle('active', b.dataset.themeBtn === theme);
    b.setAttribute('aria-pressed', b.dataset.themeBtn === theme);
  }
  $('cycleIcon').innerHTML = icon(theme === 'dark' ? 'moon' : 'sun');
  scene.setTheme?.(theme);
}

// ---------------------------------------------------------------- floating numbers & toasts

function floatText(x, y, text, cls = '') {
  const box = $('floaters');
  if (box.childElementCount > 40) box.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `floater ${cls}`;
  el.textContent = text;
  el.style.left = `${x + (Math.random() - 0.5) * 30}px`;
  el.style.top = `${y}px`;
  el.addEventListener('animationend', () => el.remove());
  box.appendChild(el);
}

function toast(html, cls = '', ms = 3800) {
  const box = $('toasts');
  while (box.childElementCount >= 4) box.firstElementChild.remove();
  const el = document.createElement('div');
  el.className = `toast ${cls}`;
  el.innerHTML = html;
  box.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 400);
  }, ms);
}

// ---------------------------------------------------------------- clicking

function doClick(x, y) {
  const value = game.click();
  scene.clickBurst(x, y, game.state.spellLevel);
  floatText(x, y, `+${fmtRate(value)}`);
  $('stageHint').classList.add('hidden');
  updateUI();
}

scene.onTreeClick = doClick;

$('channelBtn').addEventListener('click', () => {
  const p = scene.heartScreenPos();
  doClick(p.x + (Math.random() - 0.5) * 60, p.y + (Math.random() - 0.5) * 40);
});

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModals();
  if (e.code === 'Space' && !openModal() && !(e.target instanceof HTMLButtonElement) && !(e.target instanceof HTMLInputElement)) {
    e.preventDefault();
    $('channelBtn').click();
  }
});

// ---------------------------------------------------------------- side panel

const ui = {};

function costButton(onBuy, label) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'buy-btn';
  btn.innerHTML = `<span class="buy-icon">${icon('aether')}</span><span class="buy-cost"></span><span class="buy-arrow">${icon('up')}</span>`;
  btn.setAttribute('aria-label', label);
  btn.addEventListener('click', onBuy);
  return btn;
}

function buildSpellCard() {
  const card = document.createElement('div');
  card.className = 'card spell-card';
  card.innerHTML = `
    <div class="card-icon big">${icon('touch')}</div>
    <div class="card-body">
      <div class="card-head"><span class="card-name">${SPELL.name}</span><span class="card-level"></span></div>
      <div class="card-desc">${SPELL.desc}</div>
      <div class="card-effect"></div>
    </div>`;
  const btn = costButton(() => {
    if (game.buySpell()) {
      pulse(card);
      updateUI();
    }
  }, `Upgrade ${SPELL.name}`);
  card.appendChild(btn);
  $('spellCard').appendChild(card);
  ui.spell = { card, btn, level: card.querySelector('.card-level'), effect: card.querySelector('.card-effect'), cost: btn.querySelector('.buy-cost') };
}

function buildFamiliarList() {
  ui.familiars = {};
  for (const def of FAMILIARS) {
    const row = document.createElement('div');
    row.className = 'card familiar-card';
    row.innerHTML = `
      <div class="card-icon"><img alt="" /></div>
      <div class="card-body">
        <div class="card-head"><span class="card-name"></span><span class="card-level"></span></div>
        <div class="card-effect"></div>
      </div>`;
    const btn = costButton(() => buyFamiliar(def), `Summon ${def.name}`);
    row.appendChild(btn);
    $('familiarList').appendChild(row);
    ui.familiars[def.id] = {
      row, btn,
      img: row.querySelector('img'),
      name: row.querySelector('.card-name'),
      owned: row.querySelector('.card-level'),
      effect: row.querySelector('.card-effect'),
      cost: btn.querySelector('.buy-cost'),
    };
  }
}

function buildUpgradeList() {
  ui.upgrades = {};
  for (const def of GROVE_UPGRADES) {
    const row = document.createElement('div');
    row.className = 'card upgrade-card';
    row.innerHTML = `
      <div class="card-icon">${icon(def.icon)}</div>
      <div class="card-body">
        <div class="card-head"><span class="card-name">${def.name}</span><span class="card-level"></span></div>
        <div class="card-desc">${def.desc}</div>
      </div>`;
    const btn = costButton(() => {
      if (game.buyUpgrade(def.id)) {
        pulse(row);
        updateUI();
      }
    }, `Buy ${def.name}`);
    row.appendChild(btn);
    $('upgradeList').appendChild(row);
    ui.upgrades[def.id] = { row, btn, level: row.querySelector('.card-level'), cost: btn.querySelector('.buy-cost') };
  }
}

function pulse(el) {
  el.classList.remove('pulse');
  void el.offsetWidth;
  el.classList.add('pulse');
}

function buyFamiliar(def) {
  const result = game.buyFamiliar(def.id);
  if (!result) return;
  scene.syncFamiliars(game.state, true);
  pulse(ui.familiars[def.id].row);
  const r = RARITIES[result.rarity];
  const img = familiarIcons[def.id] ? `<img src="${familiarIcons[def.id]}" alt="" />` : '';
  if (result.first) {
    toast(`${img}<div><b>New familiar discovered!</b><br>A ${def.name} joins your grove.</div>`, 'discover', 4500);
  }
  if (result.rarity >= 2) {
    toast(`${img}<div><b style="color:${r.color}">✦ ${r.name} Encounter!</b><br>A ${r.name.toLowerCase()} ${def.name} appeared (×${r.mult} Aether).</div>`, `rare r-${r.id}`, 5000);
  }
  updateOwnedRow();
  updateUI();
}

function updateOwnedRow() {
  const row = $('ownedRow');
  const owned = FAMILIARS.filter((f) => game.state.familiars[f.id].owned > 0);
  if (!owned.length) {
    row.innerHTML = '<div class="empty">No familiars yet. Summon one above!</div>';
    return;
  }
  row.innerHTML = owned.map((f) => {
    const st = game.state.familiars[f.id];
    const best = st.rarities.reduce((b, n, i) => (n > 0 ? i : b), 0);
    return `<div class="owned-chip" title="${f.name}" style="--rarity:${RARITIES[best].color}">
      <img src="${familiarIcons[f.id] || ''}" alt="${f.name}" />
      <span>×${fmt(st.owned)}</span>
    </div>`;
  }).join('');
}

/** A familiar is shown once you own one, own the previous one, or have earned close to its price. */
function familiarRevealed(index) {
  const def = FAMILIARS[index];
  const s = game.state;
  return index === 0 || s.familiars[def.id].owned > 0 || s.familiars[FAMILIARS[index - 1].id].owned > 0
    || s.totalEarned >= def.baseCost * 0.5;
}

// ---------------------------------------------------------------- per-tick update

function updateUI() {
  const s = game.state;
  const speed = s.settings.timeSpeed;

  setText($('aetherCount'), fmt(s.aether));
  setText($('perClick'), `+${fmtRate(game.clickPower())}`);
  setText($('perSec'), `+${fmtRate(game.perSecond())}`);
  const badge = $('speedBadge');
  badge.hidden = speed === 1;
  setText(badge, `${speed}× time`);

  const lp = game.levelProgress();
  setText($('groveLevel'), String(lp.level));
  setText($('levelProgress'), `${fmt(lp.current)} / ${fmt(lp.needed)}`);
  $('levelBar').style.width = `${Math.min(100, (lp.current / lp.needed) * 100)}%`;

  const minutes = s.gameMinutes;
  const day = Math.floor(minutes / 1440) + 1;
  const m = Math.floor(minutes % 1440);
  const h24 = Math.floor(m / 60);
  const h12 = h24 % 12 || 12;
  setText($('cycleTime'), `Day ${day} · ${h12}:${String(m % 60).padStart(2, '0')} ${h24 < 12 ? 'AM' : 'PM'}`);

  // spell
  const sc = game.spellCost();
  setText(ui.spell.level, `Lv. ${s.spellLevel}`);
  setText(ui.spell.cost, fmt(sc));
  setText(ui.spell.effect, `+${fmtRate(game.clickPower())} Aether / click`);
  ui.spell.btn.disabled = !game.canAfford(sc);

  // familiars
  let teaserShown = false;
  FAMILIARS.forEach((def, i) => {
    const f = ui.familiars[def.id];
    const revealed = familiarRevealed(i);
    const visible = revealed || !teaserShown;
    if (!revealed) teaserShown = true;
    f.row.hidden = !visible;
    if (!visible) return;
    f.row.classList.toggle('locked', !revealed);
    const owned = s.familiars[def.id].owned;
    const cost = game.familiarCost(def.id);
    setText(f.name, revealed ? def.name : '???');
    setText(f.owned, owned ? `×${fmt(owned)}` : '');
    const each = def.baseRate * game.passiveMultiplier() * speed;
    setText(f.effect, revealed
      ? (owned ? `+${fmtRate(game.familiarRate(def.id) * speed)} / sec total` : `+${fmtRate(each)} / sec each`)
      : 'An unknown creature stirs…');
    setText(f.cost, fmt(cost));
    f.btn.disabled = !game.canAfford(cost);
    if (familiarIcons[def.id] && f.img.getAttribute('src') !== familiarIcons[def.id]) f.img.src = familiarIcons[def.id];
  });

  // grove upgrades
  for (const def of GROVE_UPGRADES) {
    const u = ui.upgrades[def.id];
    const maxed = game.upgradeMaxed(def.id);
    const cost = game.upgradeCost(def.id);
    setText(u.level, `Lv. ${s.upgrades[def.id]}`);
    setText(u.cost, maxed ? 'MAX' : fmt(cost));
    u.btn.disabled = maxed || !game.canAfford(cost);
  }

  if (!$('optionsModal').hidden) updateStats();
}

// ---------------------------------------------------------------- modals & navigation

function openModal() {
  return document.querySelector('.modal:not([hidden])');
}

function setNav(name) {
  for (const b of document.querySelectorAll('.nav-btn')) b.classList.toggle('active', b.dataset.nav === name);
}

function showModal(id) {
  closeModals();
  $(id).hidden = false;
  $(id).querySelector('.modal-close').focus();
}

function closeModals() {
  for (const m of document.querySelectorAll('.modal')) m.hidden = true;
  cancelReset();
  setNav('grove');
}

for (const m of document.querySelectorAll('.modal')) {
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-close]')) closeModals();
  });
}

for (const b of document.querySelectorAll('.nav-btn')) {
  b.addEventListener('click', () => {
    const nav = b.dataset.nav;
    if (nav === 'grove') {
      closeModals();
    } else if (nav === 'options') {
      showModal('optionsModal');
      updateStats();
    } else if (nav === 'bestiary') {
      renderBestiary();
      showModal('bestiaryModal');
    } else if (nav === 'summon') {
      closeModals();
      $('familiarsTitle').scrollIntoView({ behavior: 'smooth', block: 'start' });
      pulse($('familiarList'));
    }
    setNav(nav);
  });
}

function renderBestiary() {
  $('bestiaryGrid').innerHTML = FAMILIARS.map((def) => {
    const st = game.state.familiars[def.id];
    const known = st.owned > 0;
    const chips = RARITIES.map((r, i) => (st.rarities[i]
      ? `<span class="chip" style="--rarity:${r.color}">${r.name} ×${fmt(st.rarities[i])}</span>` : '')).join('');
    return `<div class="beast ${known ? '' : 'unknown'}">
      <div class="beast-art"><img src="${familiarIcons[def.id] || ''}" alt="" /></div>
      <div class="beast-name">${known ? def.name : '???'}</div>
      <div class="beast-lore">${known ? def.lore : 'Summon this familiar to learn its secrets.'}</div>
      ${known ? `<div class="beast-stats">Owned ×${fmt(st.owned)} · +${fmtRate(game.familiarRate(def.id) * game.state.settings.timeSpeed)}/sec</div><div class="chips">${chips}</div>` : ''}
    </div>`;
  }).join('');
}

// options
for (const b of document.querySelectorAll('[data-theme-btn]')) {
  b.addEventListener('click', () => {
    game.state.settings.theme = b.dataset.themeBtn;
    applyTheme(game.state.settings.theme);
    game.save();
  });
}

function syncSpeedSlider() {
  const speed = game.state.settings.timeSpeed;
  $('speedSlider').value = String(SPEEDS.indexOf(speed));
  setText($('speedLabel'), `${speed}×${speed === 1 ? ' (normal)' : speed > 1 ? ' (faster)' : ' (slower)'}`);
}

$('speedSlider').addEventListener('input', (e) => {
  game.state.settings.timeSpeed = SPEEDS[Number(e.target.value)];
  syncSpeedSlider();
  updateUI();
  game.save();
});

function updateStats() {
  const s = game.state;
  const familiars = FAMILIARS.reduce((n, f) => n + s.familiars[f.id].owned, 0);
  const html = `
    <div class="option-label">Grove Records</div>
    <div class="stat"><span>Lifetime Aether</span><b>${fmt(s.totalEarned)}</b></div>
    <div class="stat"><span>Heartwood clicks</span><b>${fmt(s.totalClicks)}</b></div>
    <div class="stat"><span>Familiars summoned</span><b>${fmt(familiars)}</b></div>
    <div class="stat"><span>Time in the grove</span><b>${fmtDuration(s.playSeconds)}</b></div>`;
  if ($('statsBox').innerHTML !== html) $('statsBox').innerHTML = html;
}

let resetTimer = null;
function cancelReset() {
  clearTimeout(resetTimer);
  $('resetBtn').classList.remove('confirm');
  $('resetBtn').textContent = 'Reset Everything';
}

$('resetBtn').addEventListener('click', () => {
  const btn = $('resetBtn');
  if (!btn.classList.contains('confirm')) {
    btn.classList.add('confirm');
    btn.textContent = 'Are you sure? Click again to reset';
    resetTimer = setTimeout(cancelReset, 4000);
    return;
  }
  game.reset();
});

game.on('reset', () => {
  closeModals();
  applyTheme(game.state.settings.theme);
  syncSpeedSlider();
  scene.setLevel(1, false);
  scene.syncFamiliars(game.state, false);
  $('stageHint').classList.remove('hidden');
  updateOwnedRow();
  updateUI();
  toast('<div><b>The grove returns to a single seed…</b><br>Your journey begins anew.</div>', 'discover');
});

game.on('levelup', (level, prev) => {
  scene.setLevel(level, true);
  const unlocks = GROVE_UNLOCKS.filter((u) => u.level > prev && u.level <= level);
  const text = unlocks.length ? unlocks.map((u) => u.text).join('<br>') : 'The Heartwood grows stronger.';
  toast(`<div><b>Grove Level ${level}!</b><br>${text}</div>`, 'levelup', 4500);
});

// ---------------------------------------------------------------- start

async function start() {
  fillIcons();
  const offline = game.load();
  applyTheme(game.state.settings.theme);
  syncSpeedSlider();
  buildSpellCard();
  buildFamiliarList();
  buildUpgradeList();
  updateUI();

  await scene.init();
  scene.setTheme(game.state.settings.theme, true);
  scene.setLevel(game.level, false);
  scene.syncFamiliars(game.state, false);
  familiarIcons = await scene.familiarIcons();
  updateOwnedRow();
  updateUI();
  if (game.state.totalClicks > 0) $('stageHint').classList.add('hidden');

  if (offline) {
    toast(`<div><b>Welcome back!</b><br>Your familiars gathered <b>${fmt(offline.gain)}</b> Aether while you were away (${fmtDuration(offline.seconds)}).</div>`, 'discover', 6000);
  }

  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 3600);
    last = now;
    game.tick(dt);
    updateUI();
  }, 100);

  setInterval(() => game.save(), AUTOSAVE_MS);
  window.addEventListener('beforeunload', () => game.save());
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) game.save();
  });
}

start();
