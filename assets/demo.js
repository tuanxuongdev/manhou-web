/* Manhou website: the hero's live app demo (sections/herodemo.mjs). Tools switch like the app, the photo follows real
   renders, the video editor plays its timeline, and a short auto-tour shows it all until the visitor touches it.
   No tour, no playback and no sweeps with reduced motion; paused off screen and in a background tab. No tracking. */
(function () {
  'use strict';
  var root = document.querySelector('[data-demo]');
  if (!root) return;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var hero = root.closest('.hero-visual') || document;
  var $ = function (s, el) { return (el || root).querySelector(s); };
  var $$ = function (s, el) { return Array.prototype.slice.call((el || root).querySelectorAll(s)); };
  var toasts = {}; try { toasts = JSON.parse(root.getAttribute('data-toasts')); } catch (e) { /* keep the static toast */ }
  var toastEl = hero.querySelector('[data-toast]'), modes = hero.querySelector('.dm-modes');
  var photo = $('.dm-photo'), video = $('.dm-video'), canvas = $('.dm-canvas'), cmp = $('.dm-cmp'), range = cmp.querySelector('input');
  var edit = $('.dm-edit'), adj = $('.dm-adj'), mk = $('.dm-mk'), crop = $('.dm-crop'), ring = $('.dm-ring'), finger = $('.dm-finger');
  var barIn = $('.dm-photo .dm-bar-in');
  var adjusts = {}, ADJ = { brightness: [25, 'brightness(1.13)'], contrast: [30, 'contrast(1.2)'], temperature: [35, 'sepia(.22) saturate(1.12) hue-rotate(-6deg)'], saturation: [30, 'saturate(1.35)'], highlights: [-30, 'brightness(.94) contrast(1.06)'] };

  /* Nothing beyond the first screen loads with the page: the small pictures (tiles, makeup base, video frames) come on
     the first tool change, the tour or a touch; a tool's full-size variants when that tool opens. */
  var hydrated = false, warmed = {};
  function hydrate() {
    if (hydrated) return; hydrated = true;
    $$('img[data-src]').forEach(function (i) { if (i.getAttribute('data-srcset')) { i.sizes = i.getAttribute('sizes') || ''; i.srcset = i.getAttribute('data-srcset'); } i.onload = function () { i.classList.add('ld'); }; i.src = i.getAttribute('data-src'); });
    $$('[data-bg]').forEach(function (b) { b.style.backgroundImage = 'url("' + b.getAttribute('data-bg') + '")'; });
  }
  function warm(sel) {
    if (warmed[sel]) return; warmed[sel] = true; hydrate();
    $$(sel).forEach(function (b) { var i = new Image(); i.sizes = $('.dm-lk').sizes; i.srcset = b.getAttribute('data-srcset') || ''; i.src = b.getAttribute('data-src'); });
  }
  var idle = function (f) { if (window.requestIdleCallback) requestIdleCallback(f, { timeout: 3000 }); else setTimeout(f, 1500); };

  /* Chip rows: the selected pill slides to the picked chip (src/ui/Chip.tsx ChipRow), the row scrolls it into view. */
  function reveal(row, el, smooth) {
    if (!row || !el) return;
    var l = el.offsetLeft, w = el.offsetWidth, s = row.scrollLeft, vw = row.clientWidth, pad = 24;
    var to = l < s + pad ? l - pad : l + w > s + vw - pad ? l + w - vw + pad : null;
    if (to !== null) row.scrollTo({ left: Math.max(0, to), behavior: smooth && !reduce ? 'smooth' : 'auto' });
  }
  function place(row, smooth) {
    var ind = row.querySelector('.dm-ind'); if (!ind) return;
    var sel = row.querySelector('.dm-c.on, .dm-c[aria-pressed=true]');
    if (!smooth) ind.style.transition = 'none';
    if (sel) { ind.style.setProperty('--ix', sel.offsetLeft + 'px'); ind.style.setProperty('--iw', sel.offsetWidth + 'px'); }
    ind.classList.toggle('on', !!sel);
    if (!smooth) { void ind.offsetWidth; ind.style.transition = ''; }
    row.classList.add('live');
  }
  function pick(btn, attr) {
    var row = btn.closest('[data-row]') || btn.parentNode;
    $$('[' + attr + ']', row).forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    place(row, true); reveal(row, btn, true);
  }

  /* Sliders (src/ui/ValueSlider): the thumb glides, the number counts. `on` lights Reset (value moved). */
  function slide(sl, v, on) {
    if (!sl) return;
    var min = +sl.getAttribute('data-min'), max = +sl.getAttribute('data-max'), unit = sl.getAttribute('data-unit') || '', bi = sl.classList.contains('bi');
    var from = +sl.getAttribute('data-val') || 0, out = sl.querySelector('[data-v]'), lab = sl.querySelector('.dm-sl-l');
    sl.setAttribute('data-val', v); sl.style.setProperty('--p', ((v - min) / (max - min)) * 100);
    if (lab) lab.classList.toggle('on', !!on);
    var fmt = function (x) { x = Math.round(x); return (bi && x > 0 ? '+' : '') + x + unit; };
    if (reduce) { out.textContent = fmt(v); return; }
    var t0 = performance.now();
    (function step(t) { var k = Math.min(1, (t - t0) / 900); k = 1 - Math.pow(1 - k, 3); out.textContent = fmt(from + (v - from) * k); if (k < 1) requestAnimationFrame(step); })(t0);
  }
  var panel = function (id) { return $('.dm-p[data-p="' + id + '"]'); };

  /* Two stacked pictures cross-fade once the new one has loaded (same as the page's look switcher). */
  function swap(holder, src, srcset) {
    var a = holder.querySelector('.sw-a'), b = holder.querySelector('.sw-b'), front = holder.classList.contains('flip') ? b : a, back = front === a ? b : a;
    if (!a.getAttribute('src')) { hydrate(); }
    back.onload = function () { back.onload = null; holder.classList.toggle('flip', back === b); };
    back.sizes = a.sizes || ''; back.srcset = srcset || ''; back.src = src;
    if (back.complete && back.naturalWidth) back.onload();
  }
  function ripple() { if (reduce) return; ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go'); }

  /* The toast beside the phone says what the current tool does. */
  function toast(key, name, colour, iconFrom) {
    var t = toasts[key]; if (!t || !toastEl) return;
    var b = toastEl.querySelector('b'), s = toastEl.querySelector('small'), sw = toastEl.querySelector('.sw');
    toastEl.classList.add('swap');
    setTimeout(function () {
      b.textContent = t[0].replace('{name}', name || ''); s.textContent = t[1];
      sw.style.background = colour || 'linear-gradient(135deg,#F7B9D6,#F2A0C5)';
      var svg = iconFrom && iconFrom.querySelector('svg'); sw.textContent = ''; if (svg && !colour) sw.appendChild(svg.cloneNode(true));
      toastEl.classList.remove('swap');
    }, reduce ? 0 : 220);
  }

  /* Before / after split (Beauty): the divider sweeps like a thumb dragging it. */
  function setPos(p) { cmp.style.setProperty('--pos', p + '%'); range.value = String(Math.round(p)); }
  var sweepT = [];
  function sweep() {
    if (reduce) return;
    sweepT.forEach(clearTimeout); cmp.classList.add('hint');
    [[60, 22], [1150, 78], [2300, 50]].forEach(function (s) { sweepT.push(setTimeout(function () { setPos(s[1]); }, s[0])); });
    sweepT.push(setTimeout(function () { cmp.classList.remove('hint'); }, 3400));
  }
  range.addEventListener('input', function () { sweepT.forEach(clearTimeout); cmp.classList.remove('hint'); });

  /* Crop frame for a ratio (width / height; 0 = the whole photo). */
  function cropTo(r, id) {
    var W = canvas.clientWidth, H = canvas.clientHeight, w = W, h = H;
    if (id === 'free') { w = W * 0.84; h = H * 0.8; } else if (!r) { w = W * 0.94; h = H * 0.95; } else if (r) { if (W / H > r) { h = H * 0.9; w = h * r; } else { w = W * 0.9; h = w / r; } }
    var x = (W - w) / 2, y = (H - h) / 2, cs = crop.style;
    cs.setProperty('--cx', x + 'px'); cs.setProperty('--cy', y + 'px'); cs.setProperty('--cw', w / W); cs.setProperty('--ch', h / H);
    cs.setProperty('--x1', x + 1 + 'px'); cs.setProperty('--y1', y + 1 + 'px'); cs.setProperty('--x2', x + w - 1 + 'px'); cs.setProperty('--y2', y + h - 1 + 'px');
  }
  var RATIO = { free: 0, original: 0, '1:1': 1, '3:4': 3 / 4, '4:5': 4 / 5, '9:16': 9 / 16, '16:9': 16 / 9 };

  /* Tools. */
  var tool = root.getAttribute('data-tool');
  function setTool(id) {
    if (id === tool) return;
    tool = id; root.setAttribute('data-tool', id); hydrate();
    if (id === 'filters') warm('.dm-tile'); else if (id === 'makeup') warm('.dm-swb');
    var btn = null;
    $$('.dm-tool[data-tool]').forEach(function (b) { var on = b.getAttribute('data-tool') === id; b.setAttribute('aria-pressed', String(on)); if (on) btn = b; });
    reveal(barIn, btn, true);
    var p = panel(id);
    $$('[data-row]', p).forEach(function (r) { if (r.classList.contains('dm-cr')) place(r, false); });
    if (id === 'beauty') { setPos(50); sweep(); slide($('.dm-sl', p), 45, true); toast('beauty', '', '', btn); }
    else if (id === 'filters') { var t = $('.dm-tile[aria-pressed=true]'); toast('filters', t ? t.getAttribute('data-name') : '', t ? t.style.getPropertyValue('--strip') : '', btn); }
    else if (id === 'crop') { var c = $('[data-ratio][aria-pressed=true]'); cropTo(c ? RATIO[c.getAttribute('data-ratio')] : 0, c ? c.getAttribute('data-ratio') : 'original'); toast('crop', '', '', btn); }
    else if (id === 'makeup') { var l = $('.dm-swb[aria-pressed=true]'); if (l) toast('makeup', l.getAttribute('data-name'), l.style.getPropertyValue('--c')); else pickLip($('.dm-swb[data-lip="2"]')); }
    else toast(id, '', '', btn);
  }
  function pickLook(btn) {
    warm('.dm-tile'); pick(btn, 'data-look');
    var name = btn.getAttribute('data-name'), int = +btn.getAttribute('data-int');
    swap(edit, btn.getAttribute('data-src'), btn.getAttribute('data-srcset'));
    if (adj.getAttribute('src')) { adj.srcset = btn.getAttribute('data-srcset'); adj.src = btn.getAttribute('data-src'); }
    root.querySelector('[data-lkn]').textContent = name;
    root.querySelector('.dm-lkb').lastChild.textContent = ' · ' + int;
    slide($('.dm-sl', panel('filters')), int, false);
    toast('filters', name, btn.style.getPropertyValue('--strip')); ripple();
  }
  function pickAdjust(btn) {
    pick(btn, 'data-adj');
    var id = btn.getAttribute('data-adj'), a = ADJ[id]; adjusts[id] = a[1];
    if (!adj.getAttribute('src')) { var f = edit.classList.contains('flip') ? edit.querySelector('.sw-b') : edit.querySelector('.sw-a'); adj.sizes = f.sizes; adj.srcset = f.srcset; adj.src = f.currentSrc || f.src; }
    adj.style.filter = Object.keys(adjusts).map(function (k) { return adjusts[k]; }).join(' ');
    adj.style.opacity = '1';
    var v = btn.querySelector('small'); if (!v) { v = document.createElement('small'); btn.appendChild(v); } v.textContent = (a[0] > 0 ? '+' : '') + a[0];
    place(btn.parentNode, true);
    slide($('.dm-sl', panel('adjust')), a[0], true);
  }
  function pickRatio(btn) { pick(btn, 'data-ratio'); var id = btn.getAttribute('data-ratio'); cropTo(RATIO[id], id); }
  function pickLip(btn) {
    warm('.dm-swb'); $$('.dm-swb').forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
    swap(mk, btn.getAttribute('data-src'), btn.getAttribute('data-srcset'));
    slide($('.dm-sl', panel('makeup')), 60, true);
    toast('makeup', btn.getAttribute('data-name'), btn.style.getPropertyValue('--c'));
  }
  function pickShape(btn) { pick(btn, 'data-shape'); slide($('.dm-sl', panel('reshape')), 30, true); ripple(); }

  /* Ảnh | Video. */
  var mode = 'photo', modeInd = modes && modes.querySelector('.dm-modes-ind');
  function placeMode(smooth) {
    if (!modes) return;
    var on = modes.querySelector('[aria-pressed=true]');
    if (!smooth) modeInd.style.transition = 'none';
    modeInd.style.setProperty('--ix', on.offsetLeft + 'px'); modeInd.style.setProperty('--iw', on.offsetWidth + 'px');
    if (!smooth) { void modeInd.offsetWidth; modeInd.style.transition = ''; }
  }
  function setMode(m) {
    if (m === mode) return;
    mode = m; root.setAttribute('data-mode', m); hydrate();
    if (modes) { $$('[data-mode]', modes).forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-mode') === m)); }); placeMode(true); }
    var v = m === 'video';
    [[photo, v], [video, !v]].forEach(function (x) { x[0].setAttribute('aria-hidden', String(x[1])); if (x[1]) x[0].setAttribute('inert', ''); else x[0].removeAttribute('inert'); });
    if (v) { toast('video', '', '', modes && modes.querySelector('[data-mode=video]')); play(); } else { stopVideo(); toast(tool === 'filters' ? 'filters' : tool, tool === 'filters' ? $('.dm-tile[aria-pressed=true]').getAttribute('data-name') : '', '', $('.dm-tool[aria-pressed=true]')); }
  }

  /* Video editor: the playhead runs along the timeline, the preview follows the clip under it. */
  var total = +root.getAttribute('data-total'), clips = $$('.dm-clip'), frames = $$('.dm-vf'), head = $('.dm-head'), tc = $('[data-tc]'), badge = $('[data-badge]');
  var vt = 0, last = 0, raf = 0, cur = -1, sec = -1;
  var mmss = function (s) { s = Math.floor(s); return Math.floor(s / 60) + ':' + (s % 60 < 10 ? '0' : '') + (s % 60); };
  function renderVideo() {
    head.style.transform = 'translateX(' + (vt / total) * 100 + '%)';
    var i = 0; while (i < clips.length - 1 && vt >= +clips[i + 1].getAttribute('data-at')) i++;
    if (i !== cur) {
      if (cur >= 0) { frames[cur].classList.remove('on'); clips[cur].classList.remove('on'); }
      cur = i; var f = frames[i]; f.classList.remove('kb'); void f.offsetWidth; if (!reduce) f.classList.add('kb'); f.classList.add('on'); clips[i].classList.add('on');
      badge.textContent = clips[i].getAttribute('aria-label');
    }
    var s = Math.floor(vt); if (s !== sec) { sec = s; tc.textContent = mmss(vt) + ' / ' + mmss(total); }
  }
  function frame(ts) { if (last) vt = (vt + (ts - last) / 1000) % total; last = ts; renderVideo(); raf = requestAnimationFrame(frame); }
  function play() { if (reduce || raf || mode !== 'video' || !shown || document.hidden) { renderVideo(); return; } last = 0; raf = requestAnimationFrame(frame); }
  function stopVideo() { if (raf) cancelAnimationFrame(raf); raf = 0; }
  clips.forEach(function (c) { c.addEventListener('click', function () { vt = +c.getAttribute('data-at') + 0.01; renderVideo(); }); });
  renderVideo();

  /* Taps. */
  root.addEventListener('click', function (e) {
    var b = e.target.closest('button'); if (!b || !root.contains(b)) return;
    if (b.hasAttribute('data-tool')) setTool(b.getAttribute('data-tool'));
    else if (b.hasAttribute('data-look')) pickLook(b);
    else if (b.hasAttribute('data-adj')) pickAdjust(b);
    else if (b.hasAttribute('data-ratio')) pickRatio(b);
    else if (b.hasAttribute('data-lip')) pickLip(b);
    else if (b.hasAttribute('data-shape')) pickShape(b);
  });
  if (modes) { modes.addEventListener('click', function (e) { var b = e.target.closest('[data-mode]'); if (b) setMode(b.getAttribute('data-mode')); }); }
  addEventListener('resize', function () { $$('.dm-cr.live').forEach(function (r) { place(r, false); }); placeMode(false); if (tool === 'crop') { var c = $('[data-ratio][aria-pressed=true]'); cropTo(c ? RATIO[c.getAttribute('data-ratio')] : 0, c ? c.getAttribute('data-ratio') : 'original'); } });

  /* Auto-tour: while on screen and untouched, a finger walks through the tools (~3.5 s each) and the video editor.
     Any touch, click, key or focus inside stops it for good. Never with reduced motion. */
  var shown = false, touched = false, stopped = reduce, timer = 0, rem = 4200, qi = 0, round = 0;
  function local(el) {
    var x = el.offsetWidth / 2, y = el.offsetHeight / 2, n = el;
    while (n && n !== root) {
      x += n.offsetLeft; y += n.offsetTop;
      var p = n.offsetParent;
      for (var a = n.parentNode; a && a !== p && a !== root; a = a.parentNode) { x -= a.scrollLeft || 0; y -= a.scrollTop || 0; }
      if (p && p !== root) { x -= p.scrollLeft || 0; y -= p.scrollTop || 0; }
      n = p;
    }
    return [x, y];
  }
  function point(el) { var xy = local(el); finger.style.setProperty('--fx', xy[0] + 'px'); finger.style.setProperty('--fy', xy[1] + 'px'); finger.classList.add('on'); }
  function press(el, act) { finger.classList.remove('tap'); void finger.offsetWidth; finger.classList.add('tap'); el.classList.add('pressed'); setTimeout(function () { el.classList.remove('pressed'); }, 160); act(); }
  /** A tap: the finger glides to the target (650 ms), presses, then the screen has `after` ms. */
  function tap(get, act, after) { var el; return [function () { el = get(); if (el) point(el); return el ? 650 : 0; }, function () { if (el) press(el, function () { act(el); }); return after; }]; }
  var toolBtn = function (id) { return function () { return $('.dm-tool[data-tool="' + id + '"]'); }; };
  var LOOKS = ['golden-hour', 'peach-milk', 'mint-air'];
  var steps = [].concat(
    tap(toolBtn('filters'), function () { setTool('filters'); }, 700),
    tap(function () { return $('[data-look="' + LOOKS[round % LOOKS.length] + '"]'); }, pickLook, 1900),
    tap(toolBtn('adjust'), function () { setTool('adjust'); }, 600),
    tap(function () { return $('[data-adj=brightness]'); }, pickAdjust, 1300),
    tap(function () { return $('[data-adj=temperature]'); }, pickAdjust, 1400),
    tap(toolBtn('crop'), function () { setTool('crop'); }, 600),
    tap(function () { return $('[data-ratio="4:5"]'); }, pickRatio, 1200),
    tap(function () { return $('[data-ratio="1:1"]'); }, pickRatio, 1300),
    tap(toolBtn('makeup'), function () { setTool('makeup'); }, 700),
    tap(function () { return $('[data-lip="' + (round % 2 ? 2 : 3) + '"]'); }, pickLip, 1500),
    tap(function () { return $('[data-lip="' + (round % 2 ? 4 : 1) + '"]'); }, pickLip, 1500),
    tap(toolBtn('reshape'), function () { setTool('reshape'); }, 700),
    tap(function () { return $('[data-shape=slim]'); }, pickShape, 2000),
    [function () { finger.classList.remove('on'); setMode('video'); return 6500; }, function () { setMode('photo'); return 300; }],
    tap(toolBtn('beauty'), function () { setTool('beauty'); }, 3600),
    [function () { round++; finger.classList.remove('on'); resetEdits(); return 400; }]
  );
  function resetEdits() {
    adjusts = {}; adj.style.opacity = '0';
    $$('[data-adj] small').forEach(function (s) { s.remove(); });
    $$('[data-adj],[data-shape]').forEach(function (b) { b.setAttribute('aria-pressed', 'false'); });
    $$('.dm-cr.live').forEach(function (r) { place(r, false); });
    $$('[data-ratio]').forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-ratio') === 'original')); });
    ['adjust', 'reshape'].forEach(function (id) { slide($('.dm-sl', panel(id)), 0, false); });
  }
  function active() { return shown && !stopped && !document.hidden; }
  function tick() {
    if (!active()) return;
    rem -= 100; if (rem > 0) return;
    var s = steps[qi]; qi = (qi + 1) % steps.length; rem = s() || 0;
  }
  function stopTour() { touched = true; if (stopped) return; stopped = true; clearInterval(timer); finger.classList.remove('on'); hydrate(); }
  if (!reduce) {
    ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, stopTour, { passive: true }); if (modes) modes.addEventListener(ev, stopTour, { passive: true }); });
    root.addEventListener('focusin', function (e) { if (e.target.matches(':focus-visible')) stopTour(); });
    if (modes) modes.addEventListener('focusin', stopTour);
    timer = setInterval(tick, 100);
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (en) {
      shown = en[0].isIntersecting;
      if (shown && mode === 'video') play(); else if (!shown) stopVideo();
    }, { threshold: 0.35 }).observe(root);
  } else shown = true;
  document.addEventListener('visibilitychange', function () { if (document.hidden) stopVideo(); else if (mode === 'video') play(); });
  /* First screen: the divider sweeps once, as if dragged. */
  /* After load, when the browser is idle: place the sliding pills (they read layout), then sweep once if on screen. */
  function ready() { idle(function () { $$('.dm-cr[data-row]').forEach(function (r) { place(r, false); }); if (modes) { placeMode(false); modes.classList.add('live'); } setTimeout(function () { if (shown && tool === 'beauty' && !touched) sweep(); }, 600); }); }
  if (document.readyState === 'complete') ready(); else addEventListener('load', ready);
})();
