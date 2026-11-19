'use strict';

/* Telegram Mini App */
const tg = window.Telegram && window.Telegram.WebApp ? window.Telegram.WebApp : null;
if (tg) { try { tg.ready(); tg.expand(); } catch (e) {} }
function haptic(kind) {
  if (!tg || !tg.HapticFeedback) return;
  try { if (kind === 'heavy') tg.HapticFeedback.impactOccurred('heavy'); else tg.HapticFeedback.impactOccurred('medium'); } catch (e) {}
}

/* ---------- Каталог подарков (названия как у Telegram Gifts) ---------- */
const GIFTS = [
  { id: 'plush_pepe',        name: 'Plush Pepe',       emoji: '🐸', value: 1500, rarity: 'legendary' },
  { id: 'diamond_ring',      name: 'Diamond Ring',     emoji: '💍', value: 900,  rarity: 'epic' },
  { id: 'eternal_rose',      name: 'Eternal Rose',     emoji: '🌹', value: 600,  rarity: 'epic' },
  { id: 'astronaut_shield',  name: 'Astronaut Shield', emoji: '🛡️', value: 450,  rarity: 'rare' },
  { id: 'vintage_cigar',     name: 'Vintage Cigar',    emoji: '🚬', value: 300,  rarity: 'rare' },
  { id: 'scared_cat',        name: 'Scared Cat',       emoji: '🐱', value: 200,  rarity: 'rare' },
  { id: 'precious_peach',    name: 'Precious Peach',   emoji: '🍑', value: 150,  rarity: 'uncommon' },
  { id: 'signet_ring',       name: 'Signet Ring',      emoji: '🪙', value: 100,  rarity: 'uncommon' },
  { id: 'heart_locket',      name: 'Heart Locket',     emoji: '🧸', value: 80,   rarity: 'uncommon' },
  { id: 'star_notepad',      name: 'Star Notepad',     emoji: '⭐', value: 50,   rarity: 'common' },
  { id: 'candy',             name: 'Candy',            emoji: '🍬', value: 25,   rarity: 'common' },
  { id: 'flower',            name: 'Flower',           emoji: '🌸', value: 15,   rarity: 'common' },
];
const GIFT_BY_ID = Object.fromEntries(GIFTS.map(g => [g.id, g]));
const RARITY = {
  legendary: { c: '#f9a825', n: 'Легендарный' },
  epic:      { c: '#8e5df2', n: 'Эпический' },
  rare:      { c: '#29a3dd', n: 'Редкий' },
  uncommon:  { c: '#43a047', n: 'Необычный' },
  common:    { c: '#90a4ae', n: 'Обычный' },
};

/* ---------- Кейсы ---------- */
const CASES = [
  { id: 'bronze', name: 'Бронзовое облако', emoji: '🥉', price: 50,
    drops: [['flower',28],['candy',24],['star_notepad',16],['heart_locket',11],['signet_ring',9],['precious_peach',7],['scared_cat',4],['vintage_cigar',1]] },
  { id: 'silver', name: 'Серебряное облако', emoji: '🥈', price: 200,
    drops: [['candy',4],['star_notepad',13],['heart_locket',20],['signet_ring',18],['precious_peach',16],['scared_cat',12],['vintage_cigar',9],['astronaut_shield',6],['eternal_rose',1.6],['diamond_ring',0.4]] },
  { id: 'gold', name: 'Золотое облако', emoji: '🥇', price: 1000,
    drops: [['heart_locket',9],['signet_ring',10],['precious_peach',14],['scared_cat',18],['vintage_cigar',19],['astronaut_shield',15],['eternal_rose',9],['diamond_ring',4.5],['plush_pepe',1.5]] },
];

/* ---------- Состояние ---------- */
const DEFAULT_STATE = { coins: 1000, inventory: [], lastBonus: 0, best: 0 };
let state = loadState();

function loadState() {
  try {
    const raw = localStorage.getItem('skyludka_v1');
    if (raw) {
      const s = JSON.parse(raw);
      return { coins: s.coins ?? 1000, inventory: s.inventory ?? [], lastBonus: s.lastBonus ?? 0, best: s.best ?? 0 };
    }
  } catch (e) {}
  return { coins: 1000, inventory: [], lastBonus: 0, best: 0 };
}
function save() { try { localStorage.setItem('skyludka_v1', JSON.stringify(state)); } catch (e) {} }

/* ---------- Утилиты ---------- */
const $ = id => document.getElementById(id);
function fmt(n) { return Math.round(n).toLocaleString('ru-RU'); }
function updateBalance() { $('balance').textContent = '💰 ' + fmt(state.coins); }

let toastTimer = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function showModal(title, bodyHtml) {
  $('modal-title').textContent = title;
  $('modal-body').innerHTML = bodyHtml;
  $('modal').classList.remove('hidden');
}
$('modal-close').addEventListener('click', () => $('modal').classList.add('hidden'));

function addCoins(n) { state.coins += n; save(); updateBalance(); }

/* ---------- Вкладки ---------- */
document.querySelectorAll('.tab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
    if (btn.dataset.tab === 'inv') renderInventory();
    if (btn.dataset.tab === 'top') renderTop();
    if (btn.dataset.tab === 'upgrade') renderUpgrader();
  });
});

/* ---------- Ежедневный бонус ---------- */
$('btn-bonus').addEventListener('click', () => {
  const now = Date.now();
  if (now - state.lastBonus < 86400000) {
    const h = Math.ceil((86400000 - (now - state.lastBonus)) / 3600000);
    toast('Бонус уже получен, снова через ' + h + ' ч');
    return;
  }
  state.lastBonus = now;
  addCoins(250);
  haptic();
  toast('🎁 +250 монет! Возвращайся завтра');
});

/* ============================ КРАШ ============================ */
const cc = $('crash-canvas'), ctx = cc.getContext('2d');
let crash = null, crashRaf = null;
let pts = [];

function rollCrashPoint() {
  const r = Math.random();
  return Math.max(1.01, Math.floor((0.97 / (1 - r)) * 100) / 100);
}

function drawCrash(m) {
  const w = cc.width, h = cc.height;
  ctx.clearRect(0, 0, w, h);
  pts.push(m);
  if (pts.length > 220) pts.shift();
  const maxM = Math.max(2, ...pts);
  ctx.beginPath();
  ctx.moveTo(0, h - 14);
  pts.forEach((v, i) => {
    const x = (i / (220 - 1)) * (w - 20);
    const y = h - 14 - ((v - 1) / (maxM - 1)) * (h - 40);
    ctx.lineTo(x, y);
  });
  const boom = crash && crash.dead;
  ctx.strokeStyle = boom ? '#e53935' : '#2f9e6e';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.lineTo((Math.min(pts.length, 220) / 220) * (w - 20), h - 14);
  ctx.lineTo(0, h - 14);
  ctx.closePath();
  ctx.fillStyle = boom ? 'rgba(229,57,53,.12)' : 'rgba(47,158,110,.12)';
  ctx.fill();
}

function crashLoop() {
  if (!crash || crash.dead) return;
  const t = (performance.now() - crash.t0) / 1000;
  crash.m = Math.pow(Math.E, 0.14 * t);
  if (crash.m >= crash.crashAt) { bustCrash(); return; }
  $('crash-mult').textContent = 'x' + crash.m.toFixed(2);
  drawCrash(crash.m);
  crashRaf = requestAnimationFrame(crashLoop);
}

function startCrash() {
  if (crash && !crash.dead) return;
  const bet = Math.floor(+$('crash-bet').value || 0);
  if (bet < 1) return toast('Минимальная ставка — 1 монета');
  if (state.coins < bet) return toast('Недостаточно монет 💰');
  state.coins -= bet; save(); updateBalance();
  crash = { bet, m: 1, crashAt: rollCrashPoint(), dead: false, t0: performance.now() };
  pts = [1];
  $('btn-crash-start').disabled = true;
  $('btn-crash-cash').disabled = false;
  $('crash-hint').textContent = 'Забирай, пока не грохнулось!';
  crashLoop();
}

function endCrashUI() {
  $('btn-crash-start').disabled = false;
  $('btn-crash-cash').disabled = true;
  crash.dead = true;
  cancelAnimationFrame(crashRaf);
}

function bustCrash() {
  endCrashUI();
  drawCrash(crash.crashAt);
  const el = $('crash-mult');
  el.textContent = '💥 x' + crash.crashAt.toFixed(2);
  el.className = 'crash-mult boom';
  haptic('heavy');
  $('crash-hint').textContent = 'Краш на x' + crash.crashAt.toFixed(2) + '. Ставка сгорела.';
  setTimeout(() => { el.className = 'crash-mult'; el.textContent = 'x1.00'; }, 1800);
}

function cashCrash() {
  if (!crash || crash.dead) return;
  endCrashUI();
  const win = Math.floor(crash.bet * crash.m);
  addCoins(win);
  if (crash.m > state.best) { state.best = crash.m; save(); $('crash-best').textContent = 'x' + crash.m.toFixed(2); }
  const el = $('crash-mult');
  el.className = 'crash-mult win';
  haptic();
  showModal('☁️ Забрал!', '<div class="reward-emoji">✨</div><div class="reward-name">+' + fmt(win) + ' монет (x' + crash.m.toFixed(2) + ')</div>');
  setTimeout(() => { el.className = 'crash-mult'; el.textContent = 'x1.00'; }, 1800);
}

$('btn-crash-start').addEventListener('click', startCrash);
$('btn-crash-cash').addEventListener('click', cashCrash);
$('crash-best').textContent = state.best ? 'x' + state.best.toFixed(2) : '—';

/* ============================ МИНЫ ============================ */
let mines = null;

function minesMult(total, bombs, picks) {
  let m = 1;
  for (let i = 0; i < picks; i++) m *= (total - i) / (total - bombs - i);
  return Math.floor(m * 0.99 * 100) / 100;
}

function startMines() {
  if (mines && mines.active) return;
  const bet = Math.floor(+$('mines-bet').value || 0);
  const bombs = +$('mines-count').value;
  if (bet < 1) return toast('Минимальная ставка — 1 монета');
  if (state.coins < bet) return toast('Недостаточно монет 💰');
  state.coins -= bet; save(); updateBalance();
  const cells = Array.from({ length: 25 }, (_, i) => i);
  const bombsSet = new Set();
  while (bombsSet.size < bombs) bombsSet.add(Math.floor(Math.random() * 25));
  mines = { bet, bombs: bombsSet, opened: new Set(), active: true, picks: 0 };
  renderMinesGrid();
  $('btn-mines-start').disabled = true;
  $('btn-mines-cash').disabled = true;
  $('mines-hint').textContent = 'Кэф: x1.00';
}

function renderMinesGrid() {
  const g = $('mines-grid');
  g.innerHTML = '';
  for (let i = 0; i < 25; i++) {
    const b = document.createElement('button');
    b.addEventListener('click', () => pickCell(i, b));
    g.appendChild(b);
  }
}

function pickCell(i, btn) {
  if (!mines || !mines.active || mines.opened.has(i)) return;
  mines.opened.add(i);
  btn.disabled = true;
  if (mines.bombs.has(i)) {
    btn.textContent = '💥';
    btn.classList.add('boom');
    mines.active = false;
    $('btn-mines-start').disabled = false;
    $('mines-hint').textContent = 'Мина! Ставка сгорела 💸';
    revealAllMines();
    haptic('heavy');
    return;
  }
  btn.textContent = '💎';
  btn.classList.add('gem');
  mines.picks++;
  haptic();
  const m = minesMult(25, mines.bombs.size, mines.picks);
  mines.mult = m;
  $('mines-hint').textContent = 'Кэф: x' + m.toFixed(2) + ' · Забрать: ' + fmt(mines.bet * m) + ' 💰';
  $('btn-mines-cash').disabled = false;
  if (mines.picks === 25 - mines.bombs.size) cashMines();
}

function revealAllMines() {
  const g = $('mines-grid').children;
  for (let i = 0; i < 25; i++) {
    if (mines.bombs.has(i)) { g[i].textContent = '💣'; g[i].classList.add('boom'); g[i].disabled = true; }
    else if (!mines.opened.has(i)) g[i].disabled = true;
  }
}

function cashMines() {
  if (!mines || !mines.active) return;
  mines.active = false;
  addCoins(Math.floor(mines.bet * mines.mult));
  $('btn-mines-start').disabled = false;
  $('btn-mines-cash').disabled = true;
  revealAllMines();
  haptic();
  showModal('💎 Успех!', '<div class="reward-emoji">💎</div><div class="reward-name">+' + fmt(mines.bet * mines.mult) + ' монет (x' + mines.mult.toFixed(2) + ')</div>');
}

$('btn-mines-start').addEventListener('click', startMines);
$('btn-mines-cash').addEventListener('click', cashMines);

/* ============================ КЕЙСЫ ============================ */
function renderCases() {
  const list = $('cases-list');
  list.innerHTML = '';
  CASES.forEach(c => {
    const card = document.createElement('div');
    card.className = 'case-card';
    card.innerHTML = '<div class="case-emoji">' + c.emoji + '</div>' +
      '<div class="case-info"><div class="case-name">' + c.name + '</div>' +
      '<div class="case-price">' + c.price + ' монет · ' + c.drops.length + ' предметов</div></div>';
    const btn = document.createElement('button');
    btn.className = 'btn gold';
    btn.textContent = 'Открыть';
    btn.addEventListener('click', () => openCase(c));
    card.appendChild(btn);
    list.appendChild(card);
  });
}

function weightedDrop(drops) {
  const total = drops.reduce((s, d) => s + d[1], 0);
  let r = Math.random() * total;
  for (const [id, w] of drops) { r -= w; if (r <= 0) return id; }
  return drops[0][0];
}

function openCase(c) {
  if (state.coins < c.price) return toast('Недостаточно монет 💰');
  state.coins -= c.price; save(); updateBalance();
  const winId = weightedDrop(c.drops);
  const strip = [];
  for (let i = 0; i < 48; i++) strip.push(weightedDrop(c.drops));
  strip[41] = winId;
  const cellsHtml = strip.map(id => {
    const g = GIFT_BY_ID[id];
    return '<div class="cell">' + g.emoji + '<span>' + g.name + '</span></div>';
  }).join('');
  showModal('📦 ' + c.name,
    '<div class="roulette"><div class="marker"></div><div class="strip" id="strip">' + cellsHtml + '</div></div>');
  const stripEl = $('strip');
  const CELL = 70; // 64 + gap 6
  requestAnimationFrame(() => {
    stripEl.style.transition = 'transform 3.2s cubic-bezier(.15,.85,.25,1)';
    stripEl.style.transform = 'translateX(-' + (41 * CELL + 6) + 'px)';
  });
  setTimeout(() => {
    state.inventory.push(winId);
    save();
    haptic('heavy');
    const g = GIFT_BY_ID[winId];
    showModal('🎉 Выпало!', '<div class="reward-emoji">' + g.emoji + '</div>' +
      '<div class="reward-name">' + g.name + '</div>' +
      '<span class="rarity" style="background:' + RARITY[g.rarity].c + '">' + RARITY[g.rarity].n + '</span>' +
      '<p class="stat">Цена: ' + g.value + ' монет · уже в инвентаре</p>');
  }, 3400);
}

/* ============================ АПГРЕЙДЕР ============================ */
function fillSelect(sel, items, filterMineId) {
  sel.innerHTML = '';
  items.forEach(id => {
    const g = GIFT_BY_ID[id];
    if (filterMineId && id === filterMineId) return;
    const o = document.createElement('option');
    o.value = id;
    o.textContent = g.emoji + ' ' + g.name + ' (' + g.value + ')';
    sel.appendChild(o);
  });
}

function renderUpgrader() {
  const uniq = [...new Set(state.inventory)];
  const mineSel = $('up-mine'), targetSel = $('up-target');
  const prevMine = mineSel.value;
  fillSelect(mineSel, uniq);
  if (prevMine && uniq.includes(prevMine)) mineSel.value = prevMine;
  fillSelect(targetSel, GIFTS.map(g => g.id));
  updateChance();
}

function updateChance() {
  const mineId = $('up-mine').value, targetId = $('up-target').value;
  const box = $('up-chance');
  if (!mineId || !targetId) { box.textContent = 'Шанс: —'; return; }
  const mv = GIFT_BY_ID[mineId].value, tv = GIFT_BY_ID[targetId].value;
  const chance = Math.min(0.9, (mv / tv) * 0.85);
  box.textContent = 'Шанс: ' + Math.round(chance * 100) + '%';
  box.style.color = chance > 0.5 ? '#2f9e6e' : chance > 0.25 ? '#ffb300' : '#e53935';
}

$('up-mine').addEventListener('change', updateChance);
$('up-target').addEventListener('change', updateChance);

$('btn-upgrade').addEventListener('click', () => {
  const mineId = $('up-mine').value, targetId = $('up-target').value;
  if (!mineId) return toast('Нечего апгрейдить — открой кейс!');
  if (!targetId) return;
  const mv = GIFT_BY_ID[mineId].value, tv = GIFT_BY_ID[targetId].value;
  if (tv <= mv) return toast('Выбери подарок дороже своего');
  const chance = Math.min(0.9, (mv / tv) * 0.85);
  const idx = state.inventory.indexOf(mineId);
  state.inventory.splice(idx, 1);
  const ok = Math.random() < chance;
  if (ok) state.inventory.push(targetId);
  save(); renderUpgrader(); haptic(ok ? 'heavy' : undefined);
  const g = GIFT_BY_ID[ok ? targetId : mineId];
  showModal(ok ? '⚡ Апгрейд удался!' : '💔 Не повезло',
    '<div class="reward-emoji">' + (ok ? g.emoji : '💨') + '</div>' +
    '<div class="reward-name">' + (ok ? g.name + ' — твой!' : 'Подарок сгорел') + '</div>' +
    '<p class="stat">Шанс был ' + Math.round(chance * 100) + '%</p>');
});

/* ============================ ИНВЕНТАРЬ ============================ */
function renderInventory() {
  const grid = $('inv-grid');
  grid.innerHTML = '';
  const counts = {};
  state.inventory.forEach(id => counts[id] = (counts[id] || 0) + 1);
  const ids = Object.keys(counts);
  let total = 0;
  if (!ids.length) grid.innerHTML = '<p class="stat">Пока пусто — открой кейс 📦</p>';
  ids.forEach(id => {
    const g = GIFT_BY_ID[id], n = counts[id];
    total += g.value * n;
    const card = document.createElement('div');
    card.className = 'inv-card';
    card.innerHTML = '<div class="inv-emoji">' + g.emoji + '</div>' +
      '<div class="inv-name">' + g.name + (n > 1 ? ' ×' + n : '') + '</div>' +
      '<span class="rarity" style="background:' + RARITY[g.rarity].c + '">' + RARITY[g.rarity].n + '</span>' +
      '<div class="inv-value">' + g.value + ' × ' + n + ' = ' + (g.value * n) + ' 💰</div>';
    const b = document.createElement('button');
    b.className = 'inv-sell';
    b.textContent = 'Продать всё';
    b.addEventListener('click', () => {
      addCoins(g.value * n);
      state.inventory = state.inventory.filter(x => x !== id);
      save(); renderInventory(); haptic();
      toast('Продано на ' + fmt(g.value * n) + ' 💰');
    });
    card.appendChild(b);
    grid.appendChild(card);
  });
  $('inv-total').textContent = ids.length ? ('Всего предметов: ' + state.inventory.length + ' · стоимость: ' + fmt(total) + ' 💰') : '';
}

/* ============================ ТОП ============================ */
const BOTS = [
  { name: 'CloudKing', coins: 8400, inv: ['plush_pepe'] },
  { name: 'Skylord_77', coins: 5300, inv: ['diamond_ring', 'eternal_rose'] },
  { name: 'Angelina', coins: 4100, inv: ['astronaut_shield'] },
  { name: 'MrRainbow', coins: 2900, inv: ['vintage_cigar'] },
  { name: 'Pepelac', coins: 2400, inv: ['scared_cat', 'precious_peach'] },
  { name: 'Nebula', coins: 1800, inv: [] },
  { name: 'FrostByte', coins: 1300, inv: ['star_notepad'] },
];

function renderTop() {
  const invVal = state.inventory.reduce((s, id) => s + GIFT_BY_ID[id].value, 0);
  const rows = BOTS.map(b => ({
    name: b.name,
    worth: b.coins + b.inv.reduce((s, id) => s + GIFT_BY_ID[id].value, 0),
    me: false,
  }));
  rows.push({ name: tg && tg.initDataUnsafe && tg.initDataUnsafe.user ? tg.initDataUnsafe.user.first_name : 'Ты', worth: state.coins + invVal, me: true });
  rows.sort((a, b) => b.worth - a.worth);
  const ol = $('top-list');
  ol.innerHTML = '';
  rows.slice(0, 10).forEach((r, i) => {
    const li = document.createElement('li');
    if (r.me) li.className = 'me';
    li.innerHTML = '<span>' + (i + 1) + '. ' + (r.me ? '☁️ ' : '') + r.name + '</span><span>' + fmt(r.worth) + '</span>';
    ol.appendChild(li);
  });
}

/* ---------- Старт ---------- */
renderCases();
renderInventory();
renderUpgrader();
updateBalance();
