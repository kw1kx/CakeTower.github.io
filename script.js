(() => {
  'use strict';

  // ---------- настройки ----------
  const W = 360, H = 640;          // логический размер поля
  const LH = 30;                   // высота одного коржа
  const BASE_Y = H - 96;           // верх тарелки
  const START_W = 190, MAX_W = 190;
  const PERFECT = 5;               // допуск «идеально», px
  const SPONGE = ['#e88da6', '#8a5a44', '#f0c879', '#8fcfa8', '#a88fe0'];
  const CREAM = '#fff5e8';
  // функция Supabase, которая отправляет очки в Telegram (setGameScore)
  const SCORE_URL = 'https://zcxqkiptapiuouuhmqej.supabase.co/functions/v1/score';

  const cv = document.getElementById('game');
  const ctx = cv.getContext('2d');
  const stage = document.getElementById('stage');
  const scoreEl = document.getElementById('score');
  const overlay = document.getElementById('overlay');
  const titleEl = document.getElementById('title');
  const subEl = document.getElementById('sub');
  const bestEl = document.getElementById('best');
  const btn = document.getElementById('btn');

  let best = 0;
  try { best = +localStorage.getItem('cakeBest') || 0; } catch (e) {}

  let layers, cur, falling, cam, score, combo, state, flash, last = 0;

  // ---------- размер ----------
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    const s = Math.min(innerWidth / W, innerHeight / H);
    stage.style.width = W * s + 'px';
    stage.style.height = H * s + 'px';
    scoreEl.style.fontSize = 56 * s + 'px';
    cv.style.width = W * s + 'px';
    cv.style.height = H * s + 'px';
    cv.width = Math.round(W * s * dpr);
    cv.height = Math.round(H * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
  }
  addEventListener('resize', resize);

  // ---------- игра ----------
  const yOf = i => BASE_Y - (i + 1) * LH + cam;

  function reset() {
    layers = [{ x: (W - START_W) / 2, w: START_W, c: 0 }];
    falling = []; cam = 0; score = 0; combo = 0; flash = 0;
    scoreEl.textContent = '0';
    spawn();
  }

  function spawn() {
    const p = layers[layers.length - 1];
    const fromLeft = layers.length % 2 === 1;
    cur = {
      w: p.w,
      x: fromLeft ? 0 : W - p.w,
      dir: fromLeft ? 1 : -1,
      c: layers.length % SPONGE.length
    };
  }

  function piece(x, y, w, c, dir) {
    falling.push({ x, y, w, c, vx: dir * 40, vy: 0, a: 0, vr: dir * 1.2 });
  }

  function drop() {
    const p = layers[layers.length - 1];
    const y = yOf(layers.length);
    const l = Math.max(cur.x, p.x);
    const r = Math.min(cur.x + cur.w, p.x + p.w);
    const ow = r - l;

    if (ow <= 0) {                       // промах — весь корж падает
      piece(cur.x, y, cur.w, cur.c, cur.x < p.x ? -1 : 1);
      cur = null;
      return end();
    }

    let nx = l, nw = ow;
    if (Math.abs(cur.x - p.x) <= PERFECT) {   // идеально
      nx = p.x; nw = p.w;
      combo++; score += 2; flash = 1;
      if (combo >= 3) {                       // серия возвращает ширину
        const g = Math.min(8, MAX_W - nw);
        nx -= g / 2; nw += g;
      }
      if (navigator.vibrate) navigator.vibrate(12);
    } else {                                  // отрезаем свесившееся
      combo = 0; score += 1;
      if (cur.x < p.x) piece(cur.x, y, p.x - cur.x, cur.c, -1);
      else piece(p.x + p.w, y, cur.x + cur.w - (p.x + p.w), cur.c, 1);
    }
    nx = Math.max(0, Math.min(nx, W - nw));
    layers.push({ x: nx, w: nw, c: cur.c });
    scoreEl.textContent = score;
    spawn();
  }

  function end() {
    state = 'over';
    const isBest = score > best;
    if (isBest) {
      best = score;
      try { localStorage.setItem('cakeBest', best); } catch (e) {}
    }
    titleEl.textContent = 'Башня рухнула';
    subEl.textContent = 'Очки: ' + score;
    bestEl.textContent = isBest ? 'Новый рекорд!' : 'Рекорд: ' + best;
    btn.textContent = 'Ещё раз';
    setTimeout(() => overlay.classList.remove('hidden'), 700);
    submitScore(score);
  }

  // Отправка очков в Telegram через функцию Supabase.
  // Бот при нажатии «Играть» добавляет в URL игры параметры:
  // u — id игрока, i — inline-сообщение (или c + m — чат и сообщение),
  // s — подпись, которая защищает от подделки очков.
  function submitScore(sc) {
    const q = new URLSearchParams(location.search);
    if (!SCORE_URL || !q.get('s') || sc <= 0) return; // открыто не из Telegram
    fetch(SCORE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        u: q.get('u'),
        i: q.get('i'),
        c: q.get('c'),
        m: q.get('m'),
        s: q.get('s'),
        score: sc
      })
    }).catch(() => {});
  }

  function start() {
    reset();
    state = 'play';
    overlay.classList.add('hidden');
  }

  // ---------- обновление ----------
  function update(dt) {
    const target = Math.max(0, (layers.length + 1) * LH - 344);
    cam += (target - cam) * Math.min(1, dt * 6);

    if (cur && state !== 'over') {
      const sp = 140 + Math.min(layers.length * 5, 200);
      cur.x += cur.dir * sp * dt;
      if (cur.x < 0) { cur.x = 0; cur.dir = 1; }
      if (cur.x + cur.w > W) { cur.x = W - cur.w; cur.dir = -1; }
    }
    for (const f of falling) {
      f.vy += 1400 * dt; f.y += f.vy * dt; f.x += f.vx * dt; f.a += f.vr * dt;
    }
    falling = falling.filter(f => f.y < H + 80);
    flash = Math.max(0, flash - dt * 1.6);
  }

  // ---------- рисование ----------
  function rr(x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cake(x, y, w, c) {
    ctx.save();
    rr(x, y, w, LH - 3, 7);
    ctx.clip();
    ctx.fillStyle = SPONGE[c];
    ctx.fillRect(x, y, w, LH);
    ctx.fillStyle = 'rgba(255,255,255,.2)';
    ctx.fillRect(x, y + LH - 12, w, 3);
    ctx.fillStyle = CREAM;
    ctx.fillRect(x, y, w, 8);
    for (let dx = x + 6; dx < x + w; dx += 16) {
      ctx.beginPath(); ctx.arc(dx, y + 8, 5, 0, Math.PI); ctx.fill();
    }
    ctx.restore();
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);

    // стол и тарелка
    const py = BASE_Y + cam;
    ctx.fillStyle = '#c98f5e';
    ctx.fillRect(0, py + 14, W, H);
    ctx.fillStyle = '#fff';
    rr(W / 2 - 125, py, 250, 14, 7); ctx.fill();
    ctx.fillStyle = 'rgba(122,46,74,.12)';
    ctx.fillRect(W / 2 - 125, py + 10, 250, 4);

    for (let i = 0; i < layers.length; i++) {
      const y = yOf(i);
      if (y > H || y < -LH) continue;
      const l = layers[i];
      cake(l.x, y, l.w, l.c);
    }
    if (cur && state !== 'over') cake(cur.x, yOf(layers.length), cur.w, cur.c);

    for (const f of falling) {
      ctx.save();
      ctx.translate(f.x + f.w / 2, f.y + LH / 2);
      ctx.rotate(f.a);
      cake(-f.w / 2, -LH / 2, f.w, f.c);
      ctx.restore();
    }

    if (flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(1, flash * 1.5);
      ctx.fillStyle = '#c2456b';
      ctx.font = '700 28px Fredoka, system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(combo > 1 ? 'Идеально! ×' + combo : 'Идеально!', W / 2, 120 - (1 - flash) * 24);
      ctx.restore();
    }
  }

  function frame(t) {
    const dt = Math.min(0.033, (t - last) / 1000 || 0);
    last = t;
    update(dt);
    draw();
    requestAnimationFrame(frame);
  }

  // ---------- ввод ----------
  stage.addEventListener('pointerdown', e => {
    if (state === 'play' && cur && e.target !== btn) drop();
  });
  addEventListener('keydown', e => {
    if (e.code === 'Space' && state === 'play' && cur) { e.preventDefault(); drop(); }
  });
  btn.addEventListener('click', start);

  resize();
  reset();
  state = 'ready';
  bestEl.textContent = best ? 'Рекорд: ' + best : '';
  requestAnimationFrame(frame);
})();
