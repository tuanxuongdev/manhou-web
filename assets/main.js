/* Manhou website: theme toggle, before/after sliders, tabs, tool rail, sticky download bar, reveals. No tracking. */
(function () {
  'use strict';
  var root = document.documentElement;
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* Theme: the inline head script already applied a saved choice; this button flips and saves it. */
  var themeBtn = document.querySelector('.theme-btn');
  function isDark() {
    var t = root.getAttribute('data-theme');
    return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  }
  function syncThemeBtn() {
    if (!themeBtn) return;
    themeBtn.setAttribute('aria-pressed', String(isDark())); // theme-color stays plum: the header is plum in both themes
  }
  if (themeBtn) {
    syncThemeBtn();
    themeBtn.addEventListener('click', function () {
      var next = isDark() ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('theme', next); } catch (e) { /* private mode: not saved */ }
      syncThemeBtn();
    });
  }

  /* Before / after: pointer drag anywhere (vertical page scroll still works), keyboard through the range input. */
  function initCompare(el) {
    var range = el.querySelector('input[type=range]');
    function set(p) {
      p = Math.max(0, Math.min(100, p));
      el.style.setProperty('--pos', p + '%');
      if (range) { range.value = String(Math.round(p)); range.setAttribute('aria-valuetext', Math.round(p) + '%'); }
    }
    var dragging = false, startX = 0, startY = 0, decided = false;
    function pct(e) { var r = el.getBoundingClientRect(); return ((e.clientX - r.left) / r.width) * 100; }
    el.addEventListener('pointerdown', function (e) {
      if (e.target === range && e.pointerType !== 'mouse') return;
      dragging = true; decided = e.pointerType === 'mouse'; startX = e.clientX; startY = e.clientY;
      el.classList.remove('hint');
      if (decided) { set(pct(e)); el.setPointerCapture(e.pointerId); }
    });
    el.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      if (!decided) {
        var dx = Math.abs(e.clientX - startX), dy = Math.abs(e.clientY - startY);
        if (dx < 6 && dy < 6) return;
        if (dy > dx) { dragging = false; return; }
        decided = true; el.setPointerCapture(e.pointerId);
      }
      set(pct(e));
    });
    function end(e) {
      if (dragging && !decided && e.type === 'pointerup') set(pct(e));
      dragging = false;
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    if (range) range.addEventListener('input', function () { el.classList.remove('hint'); set(+range.value); });
    set(range ? +range.value : 50);
    return set;
  }
  var hero = null;
  Array.prototype.forEach.call(document.querySelectorAll('.cmp'), function (el) {
    var set = initCompare(el);
    if (el.hasAttribute('data-hint')) hero = { el: el, set: set };
  });
  /* One orchestrated moment: the hero slider sweeps once to show it can be dragged. */
  if (hero && !reduce) {
    setTimeout(function () {
      hero.el.classList.add('hint'); hero.set(22);
      setTimeout(function () { hero.set(62); setTimeout(function () { hero.el.classList.remove('hint'); }, 950); }, 950);
    }, 900);
  }

  /* Tabs (WAI-ARIA tabs pattern, arrow keys move between tabs). */
  Array.prototype.forEach.call(document.querySelectorAll('[role=tablist]'), function (list) {
    var tabs = Array.prototype.slice.call(list.querySelectorAll('[role=tab]'));
    function select(tab, focus) {
      tabs.forEach(function (t) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        var panel = document.getElementById(t.getAttribute('aria-controls'));
        if (panel) panel.hidden = !on;
      });
      if (focus) tab.focus();
      tab.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
    }
    tabs.forEach(function (t, i) {
      t.addEventListener('click', function () { select(t, false); });
      t.addEventListener('keydown', function (e) {
        var n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? tabs.length - 1 : null;
        if (n === null) return;
        e.preventDefault();
        select(tabs[(n + tabs.length) % tabs.length], true);
      });
    });
  });

  /* Tool rail: previous / next buttons on wide screens (touch users swipe). */
  Array.prototype.forEach.call(document.querySelectorAll('.rail-wrap'), function (wrap) {
    var rail = wrap.querySelector('.rail');
    Array.prototype.forEach.call(wrap.querySelectorAll('[data-dir]'), function (b) {
      b.addEventListener('click', function () {
        var item = rail.querySelector('li');
        var step = item ? item.getBoundingClientRect().width + 16 : 300;
        rail.scrollBy({ left: step * +b.getAttribute('data-dir'), behavior: reduce ? 'auto' : 'smooth' });
      });
    });
  });

  /*
   * Swap stages (looks switcher, lipstick / hair, background colours): buttons with data-src / data-srcset swap a
   * pre-rendered variant into the hidden one of two stacked images (.sw-a / .sw-b), which cross-fade once it has
   * loaded. Buttons are real toggles (aria-pressed), arrow keys move inside a group, a live region names the choice.
   * Optional: [data-step] prev / next, [data-hold] shows the [data-original] variant while pressed, data-auto="ms"
   * advances slowly while visible (never with reduced motion; paused on hover, focus or touch), swipe on the stage.
   */
  Array.prototype.forEach.call(document.querySelectorAll('[data-swap]'), function (root) {
    var imgs = root.querySelectorAll('img.sw-a, img.sw-b');
    if (imgs.length < 2) return;
    var a = imgs[0], b = imgs[1], holder = a.parentNode, front = a;
    var stage = root.classList.contains('stage') ? root : root.querySelector('.stage') || holder;
    var live = root.querySelector('[data-live]'), nameEl = root.querySelector('[data-name]:not(button)'), groupEl = root.querySelector('[data-group]:not(button)');
    var btns = Array.prototype.slice.call(root.querySelectorAll('button[data-src]'));
    function groupOf(btn) { return btn.closest('[role=group]') || root; }
    function visibleBtns() { return btns.filter(function (x) { return !x.closest('[hidden]'); }); }
    function show(btn, quiet) {
      var back = front === a ? b : a;
      back.onload = function () { holder.classList.toggle('flip', back === b); stage.classList.toggle('flip', back === b); front = back; };
      back.srcset = btn.getAttribute('data-srcset') || ''; back.src = btn.getAttribute('data-src');
      if (back.complete && back.naturalWidth) back.onload();
      if (!quiet) {
        Array.prototype.forEach.call(groupOf(btn).querySelectorAll('button[data-src]'), function (x) { x.setAttribute('aria-pressed', String(x === btn)); });
        var n = btn.getAttribute('data-name') || '', g = btn.getAttribute('data-group') || '';
        if (nameEl) nameEl.textContent = n; if (groupEl) groupEl.textContent = g;
        if (live) live.textContent = g ? n + ' · ' + g : n;
      }
    }
    function current() { var v = visibleBtns(); for (var i = 0; i < v.length; i++) if (v[i].getAttribute('aria-pressed') === 'true') return i; return 0; }
    function step(d) { var v = visibleBtns(); if (!v.length) return; show(v[(current() + d + v.length) % v.length]); }
    btns.forEach(function (btn) {
      btn.addEventListener('click', function () { show(btn); stop(); });
      btn.addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!k) return; e.preventDefault();
        var g = Array.prototype.slice.call(groupOf(btn).querySelectorAll('button[data-src]'));
        var nx = g[(g.indexOf(btn) + k + g.length) % g.length]; nx.focus(); show(nx); stop();
      });
    });
    /* Tabs inside a stage (Son | Tóc): show the pressed choice of the newly visible group. */
    Array.prototype.forEach.call(root.querySelectorAll('[role=tab]'), function (tab) {
      tab.addEventListener('click', function () { setTimeout(function () { var v = visibleBtns(); var p = v.filter(function (x) { return x.getAttribute('aria-pressed') === 'true'; })[0] || v[0]; if (p) show(p); }, 0); });
    });
    Array.prototype.forEach.call(root.querySelectorAll('[data-step]'), function (s) { s.addEventListener('click', function () { step(+s.getAttribute('data-step')); stop(); }); });
    var hold = root.querySelector('[data-hold]'), orig = root.querySelector('button[data-original]');
    if (hold && orig) {
      var keep = null;
      var down = function (e) { if (e.type === 'keydown' && e.key !== ' ' && e.key !== 'Enter') return; e.preventDefault(); if (keep) return; keep = btns.filter(function (x) { return x.getAttribute('aria-pressed') === 'true'; })[0]; show(orig, true); stop(); };
      var up = function () { if (keep) { show(keep, true); keep = null; } };
      hold.addEventListener('pointerdown', down); hold.addEventListener('keydown', down);
      ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach(function (ev) { hold.addEventListener(ev, up); });
    }
    /* Swipe on the stage. */
    var sx = null;
    stage.addEventListener('pointerdown', function (e) { if (!e.target.closest('button,input')) sx = e.clientX; });
    stage.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40 && root.querySelector('[data-step]')) { step(dx < 0 ? 1 : -1); stop(); } });
    /* Slow auto-advance while on screen; preload the other variants once the section is near. */
    var every = +root.getAttribute('data-auto') || 0, timer = null, paused = false, seen = false;
    function stop() { if (timer) { clearInterval(timer); timer = null; } every = 0; }
    function play() { if (!every || reduce || timer || paused) return; timer = setInterval(function () { step(1); }, every); }
    function pause() { if (timer) { clearInterval(timer); timer = null; } }
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (ev) { root.addEventListener(ev, function () { paused = true; pause(); }, { passive: true }); });
    ['pointerleave', 'focusout'].forEach(function (ev) { root.addEventListener(ev, function () { paused = false; if (seen) play(); }); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) {
        en.forEach(function (x) {
          seen = x.isIntersecting;
          if (seen) { btns.forEach(function (btn) { var i = new Image(); i.srcset = btn.getAttribute('data-srcset') || ''; i.sizes = a.sizes; i.src = btn.getAttribute('data-src'); }); play(); } else pause();
        });
      }, { rootMargin: '200px 0px' }).observe(root);
    }
  });

  /* Sticky download bar: shows once the hero buttons scroll away, hides again over the closing call to action. */
  var dock = document.querySelector('.dock');
  if (dock && 'IntersectionObserver' in window) {
    var watched = document.querySelectorAll('[data-dock-hide]');
    var visible = new Set();
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) visible.add(en.target); else visible.delete(en.target); });
      var on = visible.size === 0 && window.scrollY > 200;
      dock.classList.toggle('on', on);
      dock.setAttribute('aria-hidden', String(!on));
      Array.prototype.forEach.call(dock.querySelectorAll('a'), function (a) { a.tabIndex = on ? 0 : -1; });
    });
    Array.prototype.forEach.call(watched, function (w) { io.observe(w); });
  }

  /* Reveal key visuals once. */
  if (!reduce && 'IntersectionObserver' in window) {
    var rio = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('in'); rio.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    Array.prototype.forEach.call(document.querySelectorAll('.rv'), function (el) { rio.observe(el); });
  } else {
    Array.prototype.forEach.call(document.querySelectorAll('.rv'), function (el) { el.classList.add('in'); });
  }

  /* Close the mobile menu after choosing a link. */
  Array.prototype.forEach.call(document.querySelectorAll('.menu a'), function (a) {
    a.addEventListener('click', function () { var d = a.closest('details'); if (d) d.open = false; });
  });
})();
