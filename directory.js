/*!
 * Stefan Ćirković — Directory widget
 * Renders a filterable grid of work into <div id="sc-directory"></div>.
 * Data: works.json (see README). Optional attributes on the container:
 *   data-src="https://…/works.json"   override data URL
 */
(function () {
  'use strict';

  var ROOT_ID = 'sc-directory';
  var REPO_RAW = 'https://raw.githubusercontent.com/histefancirkovic-coder/Directory/main/';

  // Filter groups. `opts` sets the preferred order; any extra values found in the data are appended automatically.
  var GROUPS = [
    { key: 'type',       label: 'Type',       opts: ['Feature launch', 'Promo', 'Demo', 'Explainer', 'Case study', 'Social'] },
    { key: 'discipline', label: 'Discipline', opts: ['Logo animation', 'Web motion', '3D', '2D', 'Editing', 'Storytelling'] },
    { key: 'industry',   label: 'Industry',   opts: ['Finance', 'Tech', 'AI', 'SaaS'] },
    { key: 'tool',       label: 'Tool',       opts: ['After Effects', 'Lottie', 'Cavalry', 'Spline', 'Cinema 4D'] },
    { key: 'source',     label: 'Source',     opts: ['YouTube', 'Vimeo', 'X', 'Pinterest', 'Instagram', 'LinkedIn', 'Framerate', 'Website'] },
    { key: 'year',       label: 'Year',       opts: [] }
  ];
  var TAG_KEYS = ['type', 'discipline', 'industry', 'tool'];

  /* ---------------- helpers ---------------- */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function arr(v) { return Array.isArray(v) ? v : (v ? String(v).split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []); }

  function detectSource(url) {
    var h = '';
    try { h = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return 'Website'; }
    if (/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return 'YouTube';
    if (/(^|\.)vimeo\.com$/.test(h)) return 'Vimeo';
    if (/^(x|twitter)\.com$/.test(h)) return 'X';
    if (/pinterest\./.test(h) || h === 'pin.it') return 'Pinterest';
    if (/instagram\.com$/.test(h)) return 'Instagram';
    if (/linkedin\.com$/.test(h)) return 'LinkedIn';
    if (/framerate/.test(h)) return 'Framerate';
    return 'Website';
  }
  function youtubeId(url) {
    var m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
    return m ? m[1] : null;
  }
  function vimeoId(url) { var m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/); return m ? m[1] : null; }
  function tweetId(url) { var m = url.match(/status\/(\d+)/); return m ? m[1] : null; }
  function pinId(url) { var m = url.match(/\/pin\/(\d+)/); return m ? m[1] : null; }
  function linkedinUrn(url) {
    var m = url.match(/urn:li:(activity|share|ugcPost):(\d+)/) || url.match(/(activity|share|ugcPost)[-:](\d{10,})/);
    return m ? 'urn:li:' + m[1] + ':' + m[2] : null;
  }
  function instaPath(url) { var m = url.match(/instagram\.com\/(p|reel|tv)\/([\w-]+)/); return m ? m[1] + '/' + m[2] : null; }

  function absUrl(p, base) {
    if (!p) return null;
    if (/^(https?:)?\/\//.test(p) || /^data:/.test(p)) return p;
    return base + p.replace(/^\.?\//, '');
  }

  /* generated fallback art (when no thumbnail exists) */
  var PALETTES = [['#0b0b0f', '#2d62ff', '#9db4ff'], ['#0e0d0c', '#ff5a1f', '#ffd2b8'], ['#0a0f0c', '#27c46b', '#c9f5d9'],
    ['#120a14', '#dd23bb', '#ffc4f1'], ['#10121a', '#7b61ff', '#d9d1ff'], ['#16110a', '#ffb000', '#fff0c2']];
  function hash(s) { var h = 0; for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
  function art(seed) {
    var n = hash(seed), p = PALETTES[n % PALETTES.length], m = (n >> 3) % 3, g = '';
    if (m === 0) g = '<defs><radialGradient id="g' + n + '" cx="35%" cy="30%"><stop offset="0" stop-color="' + p[2] + '"/><stop offset=".55" stop-color="' + p[1] + '"/><stop offset="1" stop-color="' + p[0] + '"/></radialGradient></defs><circle cx="160" cy="100" r="64" fill="url(#g' + n + ')"/>';
    else if (m === 1) { for (var x = 0; x < 16; x++) for (var y = 0; y < 10; y++) { var v = Math.sin(x * .6 + y * .5 + n) * .5 + .5; g += '<circle cx="' + (12 + x * 19.5) + '" cy="' + (12 + y * 19.5) + '" r="' + (1 + v * 4) + '" fill="' + (v > .6 ? p[1] : p[2]) + '" opacity="' + (.3 + v * .7) + '"/>'; } }
    else { for (var i = 7; i > 0; i--) g += '<circle cx="160" cy="100" r="' + i * 16 + '" fill="none" stroke="' + (i % 2 ? p[1] : p[2]) + '" stroke-width="' + (i === 1 ? 14 : 1.5) + '" opacity="' + (i === 1 ? 1 : .25 + i * .06) + '"/>'; }
    return '<svg class="scd-art" viewBox="0 0 320 200" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="320" height="200" fill="' + p[0] + '"/>' + g + '</svg>';
  }

  var ICON = {
    search: '<svg width="14" height="14" viewBox="0 0 16 16" fill="none"><circle cx="7" cy="7" r="5.25" stroke="currentColor" stroke-width="1.5"/><path d="M11 11l3.5 3.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    chev: '<svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    check: '<svg width="10" height="8" viewBox="0 0 10 8" fill="none"><path d="M1 4l2.8 2.8L9 1.2" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    x: '<svg width="8" height="8" viewBox="0 0 8 8"><path d="M1 1l6 6M7 1L1 7" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/></svg>',
    close: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M1 1l12 12M13 1L1 13" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    prev: '<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M7 1L1 7l6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    next: '<svg width="8" height="14" viewBox="0 0 8 14" fill="none"><path d="M1 1l6 6-6 6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    play: '<svg width="14" height="16" viewBox="0 0 14 16" fill="#0a0a0a"><path d="M13 6.3a2 2 0 010 3.4L3 15.5A2 2 0 010 13.8V2.2A2 2 0 013 .5l10 5.8z"/></svg>',
    arrow: '<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M3 11L11 3M5 3h6v6" stroke="#0a0a0a" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    out: '<svg width="12" height="12" viewBox="0 0 14 14" fill="none"><path d="M3 11L11 3M5 3h6v6" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>'
  };
  var PLAYABLE = { YouTube: 1, Vimeo: 1 };

  /* ---------------- boot ---------------- */
  var root = document.getElementById(ROOT_ID);
  if (!root) return;
  var script = document.currentScript;
  var dataUrl = root.getAttribute('data-src') || REPO_RAW + 'works.json';
  var assetBase = dataUrl.replace(/[^/]*$/, '');

  var DATA = [];
  var state = { q: '', sort: 'new', sel: {} };
  GROUPS.forEach(function (g) { state.sel[g.key] = {}; });
  var visible = [], lbIndex = -1;

  root.innerHTML =
    '<div class="scd-toolbar"><div class="scd-row">' +
      '<label class="scd-search">' + ICON.search + '<input type="search" placeholder="Search title, client, tag…" autocomplete="off" aria-label="Search"><kbd>/</kbd></label>' +
      '<span class="scd-dds" style="display:contents"></span>' +
      '<span class="scd-spacer"></span>' +
      '<select class="scd-sort" aria-label="Sort"><option value="new">Newest</option><option value="old">Oldest</option><option value="az">A–Z</option></select>' +
    '</div><div class="scd-active"></div></div>' +
    '<div class="scd-meta"><span>Showing <b class="scd-shown">0</b> of <span class="scd-total">0</span></span><span class="scd-logic">Within a group: any · Across groups: all</span></div>' +
    '<div class="scd-grid"><div class="scd-empty"><p>Loading…</p></div></div>';

  var $ = function (s) { return root.querySelector(s); };
  var grid = $('.scd-grid'), input = $('.scd-search input'), toolbar = $('.scd-toolbar');

  fetch(dataUrl, { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); })
    .then(function (json) { init(Array.isArray(json) ? json : (json.works || [])); })
    .catch(function () { grid.innerHTML = '<div class="scd-empty"><h3>Couldn’t load the directory.</h3><p>Please refresh in a moment.</p></div>'; });

  function init(list) {
    DATA = list.filter(function (d) { return d && d.url; }).map(function (d, i) {
      var o = {
        id: d.id || ('w' + i), i: i,
        title: d.title || 'Untitled', client: d.client || '', url: d.url,
        year: d.year ? String(d.year) : '', added: d.added || '',
        duration: d.duration || '', description: d.description || '',
        thumbnail: absUrl(d.thumbnail, assetBase)
      };
      o.source = d.source || detectSource(d.url);
      TAG_KEYS.forEach(function (k) { o[k] = arr(d[k]); });
      o.sourceArr = [o.source]; o.yearArr = o.year ? [o.year] : [];
      if (!o.thumbnail && o.source === 'YouTube' && youtubeId(o.url)) o.thumbnail = 'https://i.ytimg.com/vi/' + youtubeId(o.url) + '/maxresdefault.jpg';
      return o;
    });
    // option lists: preferred order + anything new in data; hide empty
    GROUPS.forEach(function (g) {
      var seen = {}; DATA.forEach(function (d) { vals(d, g.key).forEach(function (v) { seen[v] = 1; }); });
      var opts = g.opts.filter(function (v) { return seen[v]; });
      Object.keys(seen).forEach(function (v) { if (opts.indexOf(v) < 0) opts.push(v); });
      if (g.key === 'year') opts.sort(function (a, b) { return b - a; });
      g.list = opts;
    });
    buildDropdowns();
    $('.scd-total').textContent = DATA.length;
    render();
    // Vimeo thumbnails via oEmbed (CORS-enabled)
    DATA.forEach(function (d) {
      if (d.thumbnail || d.source !== 'Vimeo') return;
      fetch('https://vimeo.com/api/oembed.json?width=1280&url=' + encodeURIComponent(d.url))
        .then(function (r) { return r.json(); })
        .then(function (j) { if (j.thumbnail_url) { d.thumbnail = j.thumbnail_url; var el = grid.querySelector('[data-id="' + d.id + '"] .scd-thumb'); if (el) el.insertAdjacentHTML('afterbegin', img(d)); } })
        .catch(function () {});
    });
  }

  function vals(d, key) { return key === 'source' ? d.sourceArr : key === 'year' ? d.yearArr : d[key]; }

  function matches(d, skip) {
    var q = state.q.trim().toLowerCase();
    if (q) {
      var hay = [d.title, d.client, d.source, d.year, d.description].concat(d.type, d.discipline, d.industry, d.tool).join(' ').toLowerCase();
      if (!q.split(/\s+/).every(function (w) { return hay.indexOf(w) > -1; })) return false;
    }
    for (var i = 0; i < GROUPS.length; i++) {
      var g = GROUPS[i]; if (g.key === skip) continue;
      var s = state.sel[g.key], keys = Object.keys(s); if (!keys.length) continue;
      if (!vals(d, g.key).some(function (v) { return s[v]; })) return false;
    }
    return true;
  }

  /* ---------------- dropdowns ---------------- */
  function buildDropdowns() {
    var holder = $('.scd-dds'), html = '';
    GROUPS.forEach(function (g) {
      if (!g.list.length) return;
      html += '<div class="scd-dd" data-key="' + g.key + '"><button class="scd-dd-btn" type="button" aria-haspopup="true">' + g.label + '<span class="scd-n"></span>' + ICON.chev + '</button><div class="scd-pop" role="menu"></div></div>';
    });
    holder.innerHTML = html;
    holder.addEventListener('click', function (e) {
      var btn = e.target.closest('.scd-dd-btn'), opt = e.target.closest('.scd-opt');
      if (btn) {
        e.stopPropagation();
        var dd = btn.parentNode, was = dd.classList.contains('open');
        closeDropdowns(); if (!was) dd.classList.add('open');
      } else if (opt) {
        e.stopPropagation();
        toggle(opt.closest('.scd-dd').getAttribute('data-key'), opt.getAttribute('data-v'));
      }
    });
  }
  function closeDropdowns() { root.querySelectorAll('.scd-dd.open').forEach(function (x) { x.classList.remove('open'); }); }
  document.addEventListener('click', closeDropdowns);

  function toggle(key, v) { var s = state.sel[key]; if (s[v]) delete s[v]; else s[v] = 1; render(); }
  function clearAll() { GROUPS.forEach(function (g) { state.sel[g.key] = {}; }); state.q = ''; input.value = ''; render(); }

  /* ---------------- render ---------------- */
  function keyOfTag(v) { for (var i = 0; i < TAG_KEYS.length; i++) { var k = TAG_KEYS[i]; if (DATA.some(function (d) { return d[k].indexOf(v) > -1; })) return k; } return 'type'; }

  function img(d) {
    var fallback = d.source === 'YouTube' ? 'if(this.src.indexOf(\'maxresdefault\')>-1){this.src=this.src.replace(\'maxresdefault\',\'hqdefault\')}else{this.remove()}' : 'this.remove()';
    return '<img src="' + esc(d.thumbnail) + '" alt="" loading="lazy" onerror="' + fallback + '">';
  }

  function tagsHTML(d, max) {
    var all = [];
    TAG_KEYS.forEach(function (k) { d[k].forEach(function (v) { all.push([k, v]); }); });
    var extra = all.length > max ? all.length - max : 0;
    return all.slice(0, max).map(function (t) {
      return '<button type="button" class="scd-tag' + (state.sel[t[0]][t[1]] ? ' hit' : '') + '" data-k="' + t[0] + '" data-v="' + esc(t[1]) + '">' + esc(t[1]) + '</button>';
    }).join('') + (extra ? '<span class="scd-tag more">+' + extra + '</span>' : '');
  }

  function render() {
    root.querySelectorAll('.scd-dd').forEach(function (dd) {
      var key = dd.getAttribute('data-key'), g = GROUPS.filter(function (x) { return x.key === key; })[0], s = state.sel[key];
      var base = DATA.filter(function (d) { return matches(d, key); });
      dd.querySelector('.scd-pop').innerHTML = g.list.map(function (v) {
        var n = base.filter(function (d) { return vals(d, key).indexOf(v) > -1; }).length;
        return '<button type="button" class="scd-opt' + (s[v] ? ' on' : '') + (n ? '' : ' zero') + '" data-v="' + esc(v) + '" role="menuitemcheckbox" aria-checked="' + !!s[v] + '"><span class="scd-box">' + ICON.check + '</span>' + esc(v) + '<span class="scd-c">' + n + '</span></button>';
      }).join('');
      var count = Object.keys(s).length, b = dd.querySelector('.scd-dd-btn');
      b.classList.toggle('has', count > 0); b.querySelector('.scd-n').textContent = count;
    });

    var chips = '';
    GROUPS.forEach(function (g) { Object.keys(state.sel[g.key]).forEach(function (v) {
      chips += '<span class="scd-chip"><small>' + g.label + '</small>' + esc(v) + '<button type="button" data-k="' + g.key + '" data-v="' + esc(v) + '" aria-label="Remove ' + esc(v) + '">' + ICON.x + '</button></span>';
    }); });
    if (chips || state.q) chips += '<button type="button" class="scd-clear">Clear all</button>';
    $('.scd-active').innerHTML = chips;

    visible = DATA.filter(function (d) { return matches(d); });
    visible.sort(function (a, b) {
      if (state.sort === 'az') return a.title.localeCompare(b.title);
      var ka = (a.year || '0') + (a.added || ''), kb = (b.year || '0') + (b.added || '');
      var r = ka < kb ? -1 : ka > kb ? 1 : a.i - b.i;
      return state.sort === 'new' ? -r || a.i - b.i : r;
    });
    $('.scd-shown').textContent = visible.length;

    if (!DATA.length) { grid.innerHTML = '<div class="scd-empty"><h3>Nothing here yet.</h3><p>New work is on its way.</p></div>'; return; }
    if (!visible.length) { grid.innerHTML = '<div class="scd-empty"><h3>Nothing matches — yet.</h3><p>Try removing a filter or searching for something broader.</p><button type="button" class="scd-clear-all">Clear filters</button></div>'; return; }

    grid.innerHTML = visible.map(function (d, i) {
      return '<article class="scd-card" data-i="' + i + '" data-id="' + esc(d.id) + '" tabindex="0" style="animation-delay:' + Math.min(i, 12) * 35 + 'ms">' +
        '<div class="scd-thumb">' + (d.thumbnail ? img(d) : '') + art(d.id) +
          '<div class="scd-shade"></div>' + (d.duration ? '<span class="scd-dur">' + esc(d.duration) + '</span>' : '') +
          '<span class="scd-play">' + (PLAYABLE[d.source] ? ICON.play : ICON.arrow) + '</span></div>' +
        '<div><div class="scd-title">' + esc(d.title) + '</div>' + (d.client ? '<div class="scd-client">' + esc(d.client) + '</div>' : '') + '</div>' +
        '<div class="scd-tags">' + tagsHTML(d, 2) + '</div></article>';
    }).join('');
  }
  // keep the real image above the generated art
  var st = document.createElement('style');
  st.textContent = '#sc-directory .scd-thumb img{z-index:1}';
  document.head.appendChild(st);

  /* ---------------- events ---------------- */
  root.addEventListener('click', function (e) {
    var t = e.target;
    var tag = t.closest('.scd-tag[data-k]'); if (tag) { e.stopPropagation(); toggle(tag.getAttribute('data-k'), tag.getAttribute('data-v')); return; }
    var chipX = t.closest('.scd-chip button'); if (chipX) { toggle(chipX.getAttribute('data-k'), chipX.getAttribute('data-v')); return; }
    if (t.closest('.scd-clear') || t.closest('.scd-clear-all')) { clearAll(); return; }
    var card = t.closest('.scd-card'); if (card) openLB(+card.getAttribute('data-i'));
  });
  root.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('scd-card')) openLB(+e.target.getAttribute('data-i'));
  });
  input.addEventListener('input', function () { state.q = input.value; render(); });
  $('.scd-sort').addEventListener('change', function (e) { state.sort = e.target.value; render(); });

  // keep the sticky toolbar below the site's navbar when it is visible
  var nav = document.querySelector('.navbar.w-nav, .navbar');
  function syncTop() {
    if (!nav) return;
    var r = nav.getBoundingClientRect();
    toolbar.style.top = Math.max(0, Math.round(r.bottom)) + 'px';
  }
  window.addEventListener('scroll', function () { requestAnimationFrame(syncTop); }, { passive: true });
  setInterval(syncTop, 400);

  /* ---------------- lightbox ---------------- */
  var lb = document.createElement('div');
  lb.id = 'scd-lb'; lb.setAttribute('aria-hidden', 'true');
  lb.innerHTML = '<div class="scd-lb-bg" data-close></div>' +
    '<div class="scd-lb-wrap" style="position:relative;width:min(1080px,100%)">' +
      '<div class="scd-lb-panel" role="dialog" aria-modal="true"><div class="scd-lb-player"></div>' +
        '<div class="scd-lb-body"><div><h2></h2><div class="scd-lb-client"></div><p class="scd-lb-desc"></p></div><dl></dl></div></div>' +
      '<button type="button" class="scd-x" data-close aria-label="Close">' + ICON.close + '</button>' +
      '<button type="button" class="scd-nav prev" aria-label="Previous">' + ICON.prev + '</button>' +
      '<button type="button" class="scd-nav next" aria-label="Next">' + ICON.next + '</button>' +
    '</div>';
  document.body.appendChild(lb);
  var player = lb.querySelector('.scd-lb-player');

  function loadScript(src) {
    if (document.querySelector('script[src="' + src + '"]')) return Promise.resolve(true);
    return new Promise(function (res) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = function () { res(false); }; document.body.appendChild(s); });
  }

  function embed(d) {
    var id;
    player.className = 'scd-lb-player';
    if (d.source === 'YouTube' && (id = youtubeId(d.url)))
      return '<iframe src="https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0&modestbranding=1" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe>';
    if (d.source === 'Vimeo' && (id = vimeoId(d.url)))
      return '<iframe src="https://player.vimeo.com/video/' + id + '?autoplay=1&dnt=1" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen></iframe>';
    if (d.source === 'Pinterest' && (id = pinId(d.url))) {
      player.className = 'scd-lb-player social';
      return '<iframe src="https://assets.pinterest.com/ext/embed.html?id=' + id + '" scrolling="no"></iframe>';
    }
    if (d.source === 'LinkedIn' && (id = linkedinUrn(d.url))) {
      player.className = 'scd-lb-player social';
      return '<iframe src="https://www.linkedin.com/embed/feed/update/' + id + '" allowfullscreen></iframe>';
    }
    if (d.source === 'Instagram' && (id = instaPath(d.url))) {
      player.className = 'scd-lb-player social';
      return '<iframe src="https://www.instagram.com/' + id + '/embed" scrolling="no" allowtransparency="true"></iframe>';
    }
    if (d.source === 'X' && tweetId(d.url)) {
      player.className = 'scd-lb-player social';
      setTimeout(function () {
        loadScript('https://platform.twitter.com/widgets.js').then(function () {
          if (window.twttr && twttr.widgets) twttr.widgets.load(player);
        });
        var t = setInterval(function () { if (window.twttr && twttr.widgets) { clearInterval(t); twttr.widgets.load(player); } }, 300);
        setTimeout(function () { clearInterval(t); }, 6000);
      }, 0);
      return '<blockquote class="twitter-tweet" data-media-max-width="560" data-dnt="true"><a href="' + esc(d.url.replace('x.com', 'twitter.com')) + '"></a></blockquote>';
    }
    return (d.thumbnail ? '<img src="' + esc(d.thumbnail) + '" alt="">' : art(d.id));
  }

  function openLB(i) {
    lbIndex = i; var d = visible[i]; if (!d) return;
    player.innerHTML = embed(d);
    lb.querySelector('h2').textContent = d.title;
    lb.querySelector('.scd-lb-client').textContent = [d.client, d.year].filter(Boolean).join(' · ');
    var desc = lb.querySelector('.scd-lb-desc'); desc.textContent = d.description; desc.style.display = d.description ? '' : 'none';
    var row = function (label, a) { return a.length ? '<div><dt>' + label + '</dt><dd>' + a.map(function (v) { return '<span class="scd-tag">' + esc(v) + '</span>'; }).join('') + '</dd></div>' : ''; };
    var cta = d.source === 'Website' ? 'Open case study' : 'Open on ' + d.source;
    lb.querySelector('dl').innerHTML = row('Type', d.type) + row('Discipline', d.discipline) + row('Industry', d.industry) + row('Tools', d.tool) +
      '<a class="scd-btn" href="' + esc(d.url) + '" target="_blank" rel="noopener">' + cta + ' ' + ICON.out + '</a>';
    lb.classList.add('open'); lb.setAttribute('aria-hidden', 'false');
    document.documentElement.style.overflow = 'hidden';
  }
  function closeLB() {
    lb.classList.remove('open'); lb.setAttribute('aria-hidden', 'true');
    document.documentElement.style.overflow = '';
    setTimeout(function () { if (!lb.classList.contains('open')) player.innerHTML = ''; }, 350);
  }
  lb.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeLB();
    else if (e.target.closest('.scd-nav.prev')) openLB((lbIndex - 1 + visible.length) % visible.length);
    else if (e.target.closest('.scd-nav.next')) openLB((lbIndex + 1) % visible.length);
  });
  document.addEventListener('keydown', function (e) {
    if (lb.classList.contains('open')) {
      if (e.key === 'Escape') closeLB();
      if (e.key === 'ArrowRight') openLB((lbIndex + 1) % visible.length);
      if (e.key === 'ArrowLeft') openLB((lbIndex - 1 + visible.length) % visible.length);
      return;
    }
    var tag = (document.activeElement || {}).tagName;
    if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); input.focus(); }
    if (e.key === 'Escape') closeDropdowns();
  });
})();
