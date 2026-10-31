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
    themeBtn.setAttribute('aria-pressed', String(isDark()));
    var meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.content = isDark() ? '#141014' : '#FBF4F3';
  }
  if (themeBtn) {
    if (!root.getAttribute('data-theme')) root.setAttribute('data-theme', isDark() ? 'dark' : 'light');
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
