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
   * Optional: [data-step] prev / next, data-auto="ms"
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
    /* Swipe on the stage. */
    var sx = null;
    stage.addEventListener('pointerdown', function (e) { if (!e.target.closest('button,input')) sx = e.clientX; });
    stage.addEventListener('pointerup', function (e) { if (sx === null) return; var dx = e.clientX - sx; sx = null; if (Math.abs(dx) > 40 && root.querySelector('[data-step]')) { step(dx < 0 ? 1 : -1); stop(); } });
    /* Slow auto-advance while on screen; preload the other variants once the section is near. */
    var every = +root.getAttribute('data-auto') || 0, timer = null, paused = false, seen = false;
    function stop() { if (timer) { clearInterval(timer); timer = null; } every = 0; }
    /* With tabs (Son | Tóc), the tour moves to the next tab after the last choice of the current one. Tabs are switched
       directly, not clicked, so the tab code's scrollIntoView never moves the page under the reader. */
    function autoStep() {
      var tabs = Array.prototype.slice.call(root.querySelectorAll('[role=tab]')), v = visibleBtns();
      if (tabs.length > 1 && v.length && current() === v.length - 1) {
        var on = tabs.filter(function (t) { return t.getAttribute('aria-selected') === 'true'; })[0] || tabs[0];
        var nx = tabs[(tabs.indexOf(on) + 1) % tabs.length];
        tabs.forEach(function (t) {
          var sel = t === nx; t.setAttribute('aria-selected', String(sel)); t.tabIndex = sel ? 0 : -1;
          var panel = document.getElementById(t.getAttribute('aria-controls')); if (panel) panel.hidden = !sel;
        });
        var w = visibleBtns(); if (w.length) show(w[1] || w[0]); /* skip the "original" chip */
        return;
      }
      step(1);
    }
    function play() { if (!every || reduce || timer || paused) return; timer = setInterval(autoStep, every); }
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

  /*
   * Video timeline (#video [data-video]): the editor plays its 15 s timeline. One requestAnimationFrame loop turns the
   * elapsed time into the whole picture: playhead and preview progress move by transform only, the preview shows the
   * frame under the playhead and runs the named transition on each cut (fade / slide / zoom; the loop fades back to
   * clip 1 exactly at the end, so it wraps with no pause), the caption shows while the playhead is over the text track.
   * Starts on the first frame after the stage scrolls into view (no timer, no waiting on a load event); the frames are
   * fetched and decoded (img.decode()) while the section is still well below the viewport. Pauses off-screen and in a
   * hidden tab and resumes where it was. Reduced motion: no auto-play and plain fades (the play button still plays).
   */
  Array.prototype.forEach.call(document.querySelectorAll('[data-video]'), function (st) {
    var T = +st.getAttribute('data-total') || 15;
    var kinds = (st.getAttribute('data-trans') || '').split(' ');
    var text = (st.getAttribute('data-text') || '0 0').split(' ').map(Number);
    var frames = Array.prototype.slice.call(st.querySelectorAll('.vd-f'));
    var clips = Array.prototype.slice.call(st.querySelectorAll('.vd-clip'));
    var body = st.querySelector('.vd-body'), head = st.querySelector('.vd-head'), bar = st.querySelector('.vd-prog i');
    var btn = st.querySelector('.vd-play'), nameEl = st.querySelector('[data-name]'), nowEl = st.querySelector('[data-now]'), live = st.querySelector('[data-live]');
    if (!frames.length || frames.length !== clips.length || !body || !head) return;
    var starts = clips.map(function (c) { return +c.getAttribute('data-at'); });
    var D = 0.6; // seconds per transition, centred on each cut
    var t = reduce ? 2 : 0, wide = body.getBoundingClientRect().width, active = 0, sec = -1, capOn = null;
    var inView = false, wanted = !reduce, raf = 0, last = 0, warmed = false;
    var cache = frames.map(function () { return { o: '', tf: '', z: '' }; });
    st.classList.add('vd-live');

    function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
    function clipAt(s) { for (var i = starts.length - 1; i > 0; i--) if (s >= starts[i]) return i; return 0; }
    function put(i, o, tf, z) {
      var c = cache[i], s = frames[i].style;
      if (c.o !== o) s.opacity = c.o = o;
      if (c.tf !== tf) s.transform = c.tf = tf;
      if (c.z !== z) s.zIndex = c.z = z;
    }
    function setActive(i, user) {
      active = i;
      clips.forEach(function (c, k) { c.setAttribute('aria-pressed', String(k === i)); });
      var n = clips[i].getAttribute('data-name') || '';
      if (nameEl) {
        nameEl.textContent = n;
        if (!reduce && nameEl.animate) nameEl.animate([{ opacity: 0, transform: 'translateY(4px)' }, { opacity: 1, transform: 'none' }], { duration: 320, easing: 'cubic-bezier(.2,.7,.2,1)' });
      }
      if (user && live) live.textContent = n;
    }
    function draw() {
      var cur = clipAt(t), from = -1, to = -1, e = 0, kind = 'fade', i;
      for (i = 1; i < starts.length; i++) if (Math.abs(t - starts[i]) < D / 2) { from = i - 1; to = i; e = ease((t - starts[i] + D / 2) / D); kind = kinds[i - 1] || 'fade'; }
      if (t > T - D) { from = frames.length - 1; to = 0; e = ease((t - T + D) / D); kind = 'fade'; }
      if (reduce) kind = 'fade';
      for (i = 0; i < frames.length; i++) {
        if (i === to) put(i, kind === 'slide' ? '1' : e.toFixed(3), kind === 'slide' ? 'translate3d(' + ((1 - e) * 100).toFixed(2) + '%,0,0)' : kind === 'zoom' ? 'scale(' + (1.18 - 0.18 * e).toFixed(4) + ')' : 'none', '2');
        else if (i === from) put(i, '1', kind === 'slide' ? 'translate3d(' + (-30 * e).toFixed(2) + '%,0,0)' : kind === 'zoom' ? 'scale(' + (1 + 0.08 * e).toFixed(4) + ')' : 'none', '1');
        else put(i, to < 0 && i === cur ? '1' : '0', 'none', '0');
      }
      // The playhead dips out over the last / first quarter second, so the wrap reads as a loop, not a jump.
      head.style.transform = 'translate3d(' + ((t / T) * wide).toFixed(2) + 'px,0,0)';
      head.style.opacity = (t > T - 0.25 ? (T - t) / 0.25 : t < 0.25 ? t / 0.25 : 1).toFixed(3);
      if (bar) bar.style.transform = 'scaleX(' + (t / T).toFixed(4) + ')';
      if (cur !== active) setActive(cur, false);
      var s = Math.floor(t);
      if (s !== sec && nowEl) { sec = s; nowEl.textContent = '00:' + (s < 10 ? '0' : '') + s; }
      var on = t >= text[0] && t < text[1];
      if (on !== capOn) { capOn = on; st.classList.toggle('cap-on', on); }
    }
    function running() { return wanted && inView && !document.hidden; }
    function tick(now) {
      raf = 0;
      if (!running()) return;
      t += last ? Math.min(0.1, (now - last) / 1000) : 0; // a long gap (background, jank) never jumps ahead
      last = now;
      if (t >= T) t -= T;
      draw();
      raf = requestAnimationFrame(tick);
    }
    function sync() {
      if (btn) btn.setAttribute('aria-pressed', String(wanted));
      if (running()) { if (!raf) { last = 0; raf = requestAnimationFrame(tick); } }
      else if (raf) { cancelAnimationFrame(raf); raf = 0; }
    }
    function warm() {
      if (warmed) return; warmed = true;
      frames.forEach(function (img) { img.loading = 'eager'; if (img.decode) img.decode().catch(function () {}); });
    }
    function seek(i) { t = starts[i] + D / 2; draw(); setActive(i, true); }

    if (btn) btn.addEventListener('click', function () { wanted = !wanted; sync(); });
    clips.forEach(function (c, i) {
      c.addEventListener('click', function () { seek(i); });
      c.addEventListener('keydown', function (e) {
        var k = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
        if (!k) return; e.preventDefault();
        var n = (i + k + clips.length) % clips.length; clips[n].focus(); seek(n);
      });
    });
    document.addEventListener('visibilitychange', sync);
    if ('ResizeObserver' in window) new ResizeObserver(function (en) { wide = en[0].contentRect.width; draw(); }).observe(body);
    else window.addEventListener('resize', function () { wide = body.getBoundingClientRect().width; draw(); });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (en) { if (en[0].isIntersecting) warm(); }, { rootMargin: '1000px 0px' }).observe(st.closest('section') || st);
      // Plays the moment the stage enters the viewport; stops once it has left it.
      new IntersectionObserver(function (en) { inView = en[0].isIntersecting; if (inView) warm(); sync(); }).observe(st);
    } else { inView = true; warm(); }
    draw(); sync();
  });

  /* Sideways rows ([data-fade], the lipstick / hair swatches on phones): fade the edge that has more to scroll to. */
  Array.prototype.forEach.call(document.querySelectorAll('[data-fade]'), function (row) {
    function edges() {
      var max = row.scrollWidth - row.clientWidth;
      row.toggleAttribute('data-l', max > 1 && row.scrollLeft > 2);
      row.toggleAttribute('data-r', max > 1 && row.scrollLeft < max - 2);
    }
    row.addEventListener('scroll', edges, { passive: true });
    if ('ResizeObserver' in window) new ResizeObserver(edges).observe(row); else window.addEventListener('resize', edges);
    edges();
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

  /* Header pop-overs (language menu, mobile menu): one open at a time; Escape closes and returns focus to the
     button, a click outside closes. Without JS they are plain <details> and still work. */
  var pops = document.querySelectorAll('.nav details');
  Array.prototype.forEach.call(pops, function (d) {
    d.addEventListener('toggle', function () {
      if (d.open) Array.prototype.forEach.call(pops, function (o) { if (o !== d) o.open = false; });
    });
  });
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape') return;
    Array.prototype.forEach.call(pops, function (d) {
      if (!d.open) return;
      d.open = false;
      var s = d.querySelector('summary'); if (s && d.contains(document.activeElement)) s.focus();
    });
  });
  document.addEventListener('click', function (e) {
    Array.prototype.forEach.call(pops, function (d) { if (d.open && !d.contains(e.target)) d.open = false; });
  });

  /* ===================== Glass header + section rail (src/nav.css) =====================
     Header: condenses once the hero has scrolled away (class toggle; CSS animates only transform / opacity).
     Phones: the menu button opens the glass sheet (#nav-sheet): page scroll locked, Escape / outside tap close it,
     Tab stays inside, focus returns to the button. Rail (home, wide screens): shown between the hero and the footer,
     scroll-spy marks the current section (aria-current), a click scrolls smoothly unless motion is reduced. */
  (function () {
    var nav = document.querySelector('[data-nav]');
    if (!nav) return;
    var toggle = nav.querySelector('.nav-toggle'), sheet = document.getElementById('nav-sheet');
    var heroEl = document.querySelector('.hero'), footEl = document.querySelector('.foot');
    var rail = document.querySelector('[data-srail]');
    var wide = window.matchMedia ? matchMedia('(min-width: 1060px)') : { matches: true };
    var open = false, condensed = false, railOn = false, ticking = false;

    function paint() {
      nav.classList.toggle('is-open', open);
      nav.classList.toggle('is-condensed', condensed && !open);
      if (rail) rail.classList.toggle('on', railOn);
    }
    /* Observers, not scroll reads: nothing here forces a layout while the page loads. */
    var pastHero = false, overFoot = false;
    function railState() { railOn = pastHero && !overFoot; paint(); }
    var last = function (en) { return en[en.length - 1].isIntersecting; };
    if (heroEl && 'IntersectionObserver' in window) {
      /* Condensed once the hero's bottom passes under the pill. */
      new IntersectionObserver(function (en) { condensed = !last(en); paint(); }, { rootMargin: '-96px 0px 0px 0px' }).observe(heroEl);
      /* Rail: once the hero has left the top half of the screen, until the footer reaches the bottom quarter. */
      new IntersectionObserver(function (en) { pastHero = !last(en); railState(); }, { rootMargin: '0px 0px -50% 0px' }).observe(heroEl);
      if (footEl) new IntersectionObserver(function (en) { overFoot = last(en); railState(); }, { rootMargin: '0px 0px -25% 0px' }).observe(footEl);
    } else {
      var onScroll = function () {
        if (ticking) return; ticking = true;
        requestAnimationFrame(function () { ticking = false; condensed = (window.scrollY || window.pageYOffset) > 40; paint(); });
      };
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    }

    /* Phone menu. */
    function focusables() {
      return [toggle].concat(Array.prototype.slice.call(sheet.querySelectorAll('a[href], button, summary, select, input'))).filter(function (el) {
        return el && el.offsetParent !== null; // a closed language menu's links are not rendered
      });
    }
    function setOpen(v, keepFocus) {
      if (!toggle || !sheet || v === open) return;
      open = v;
      toggle.setAttribute('aria-expanded', String(v));
      toggle.setAttribute('aria-label', toggle.getAttribute(v ? 'data-close' : 'data-open'));
      root.classList.toggle('nav-lock', v);
      paint();
      if (v) { var first = sheet.querySelector('a[href]'); if (first) first.focus({ preventScroll: true }); }
      else if (!keepFocus && sheet.contains(document.activeElement)) toggle.focus({ preventScroll: true });
    }
    if (toggle && sheet) {
      toggle.addEventListener('click', function () { setOpen(!open); });
      nav.querySelector('.nav-scrim').addEventListener('click', function () { setOpen(false); });
      document.addEventListener('click', function (e) { if (open && !nav.querySelector('.nav-pill').contains(e.target)) setOpen(false); });
      Array.prototype.forEach.call(sheet.querySelectorAll('.nav-links a'), function (a) {
        a.addEventListener('click', function () { setOpen(false, true); });
      });
      /* Capture phase: an open language menu inside the sheet closes first (its own handler), the sheet on the next Escape. */
      document.addEventListener('keydown', function (e) {
        if (!open) return;
        if (e.key === 'Escape') {
          if (nav.querySelector('details[open]')) return;
          e.preventDefault(); setOpen(false); toggle.focus({ preventScroll: true });
        } else if (e.key === 'Tab') {
          var f = focusables(); if (!f.length) return;
          var i = f.indexOf(document.activeElement);
          if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); }
          else if (!e.shiftKey && (i === -1 || i === f.length - 1)) { e.preventDefault(); f[0].focus(); }
        }
      }, true);
      var onWide = function () { if (wide.matches) setOpen(false, true); };
      if (wide.addEventListener) wide.addEventListener('change', onWide); else if (wide.addListener) wide.addListener(onWide);
    }

    /* Section rail. */
    if (!rail) return;
    var links = Array.prototype.slice.call(rail.querySelectorAll('a[href^="#"]'));
    var items = links.map(function (a) {
      var target = document.getElementById(decodeURIComponent(a.getAttribute('href').slice(1)));
      if (!target) { a.parentNode.hidden = true; return null; }
      return { a: a, target: target, spy: target.matches('section, article') ? target : (target.closest('section, article') || target) };
    }).filter(Boolean);
    /* A section that holds another tracked block (features → makeup) is tracked by its own first block instead. */
    items.forEach(function (it) {
      var inner = items.some(function (o) { return o !== it && it.spy.contains(o.spy); });
      if (inner) it.spy = it.spy.querySelector('article') || it.spy;
    });
    var current = null;
    function mark(it) {
      if (it === current) return;
      if (current) current.a.removeAttribute('aria-current');
      current = it; if (it) it.a.setAttribute('aria-current', 'true');
    }
    if ('IntersectionObserver' in window) {
      var seen = new Set();
      var spyIO = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) { var it = items.filter(function (x) { return x.spy === en.target; })[0]; if (!it) return; if (en.isIntersecting) seen.add(it); else seen.delete(it); });
        var best = null; items.forEach(function (it) { if (seen.has(it)) best = it; });
        if (best) mark(best);
      }, { rootMargin: '-40% 0px -55% 0px' });
      items.forEach(function (it) { spyIO.observe(it.spy); });
    }
    /* Sections below the fold use content-visibility:auto (estimated heights), so the first jump can land short:
       once the scroll settles, measure again and correct (at most twice). */
    var settle = null;
    function go(it, behavior, round) {
      var gap = function () { return it.spy.getBoundingClientRect().top - nav.offsetHeight; };
      window.scrollTo({ top: Math.max(0, gap() + (window.scrollY || window.pageYOffset)), behavior: behavior });
      clearTimeout(settle);
      var done = function () {
        window.removeEventListener('scrollend', done); clearTimeout(settle);
        if (round < 2 && Math.abs(gap()) > 4 && (window.innerHeight + (window.scrollY || window.pageYOffset)) < document.documentElement.scrollHeight - 2) go(it, 'auto', round + 1);
      };
      if ('onscrollend' in window && behavior === 'smooth') window.addEventListener('scrollend', done);
      settle = setTimeout(done, behavior === 'smooth' ? 1200 : 80);
    }
    items.forEach(function (it) {
      it.a.addEventListener('click', function (e) {
        e.preventDefault();
        go(it, reduce ? 'auto' : 'smooth', 0);
        try { history.replaceState(null, '', it.a.getAttribute('href')); } catch (err) { /* file:// */ }
        if (!it.target.hasAttribute('tabindex') && !/^(A|BUTTON|INPUT|SELECT|TEXTAREA)$/.test(it.target.tagName)) it.target.setAttribute('tabindex', '-1');
        it.target.focus({ preventScroll: true });
        mark(it);
      });
    });
  })();
  /* =================== end glass header + section rail =================== */
})();

// >>> collage deck (sections/cards.mjs, cards.css): tap, Enter or Space brings the next template to the front; the card
// that leaves stays on top for a moment while it slides back, so the swap reads as dealing a card. Without JS the deck
// is a labelled picture (figure role=img); with JS the figure keeps its label and the deck becomes a button inside it.
(function () {
  var deck = document.querySelector('[data-deck]');
  if (!deck) return;
  var cards = Array.prototype.slice.call(deck.querySelectorAll('.mc-t'));
  var n = cards.length;
  if (n < 2) return;
  var fig = deck.closest('figure');
  var card = deck.closest('.mc');
  var live = card && card.querySelector('[data-deck-live]');
  var timer = 0;
  if (fig) fig.removeAttribute('role');
  deck.setAttribute('role', 'button');
  deck.setAttribute('tabindex', '0');
  deck.setAttribute('aria-label', deck.getAttribute('data-next'));
  function next() {
    var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    var leaving = null;
    cards.forEach(function (c) {
      c.classList.remove('is-leaving');
      var s = +c.getAttribute('data-s');
      if (s === 0) leaving = c;
      c.setAttribute('data-s', String((s + n - 1) % n));
    });
    if (leaving && !reduce) {
      leaving.classList.add('is-leaving');
      clearTimeout(timer);
      timer = setTimeout(function () { leaving.classList.remove('is-leaving'); }, 300);
    }
    var top = deck.querySelector('.mc-t[data-s="0"]');
    if (live && top) live.textContent = deck.getAttribute('data-now') + ' ' + top.getAttribute('data-name');
  }
  deck.addEventListener('click', next);
  deck.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); next(); }
  });
})();
// <<< collage deck
