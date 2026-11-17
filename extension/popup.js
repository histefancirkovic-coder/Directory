/* Directory — Add work (Chrome extension popup) */
'use strict';

const GROUPS = [
  { key: 'type',       label: 'Type',       opts: ['Feature launch', 'Promo', 'Demo', 'Explainer', 'Case study', 'Social'] },
  { key: 'discipline', label: 'Discipline', opts: ['Logo animation', 'Web motion', '3D', '2D', 'Editing', 'Storytelling'] },
  { key: 'industry',   label: 'Industry',   opts: ['Finance', 'Tech', 'AI', 'SaaS'] },
  { key: 'tool',       label: 'Tool',       opts: ['After Effects', 'Lottie', 'Cavalry', 'Spline', 'Cinema 4D'] }
];
const AUTO_THUMB = { YouTube: 1, Vimeo: 1 };

const $ = id => document.getElementById(id);
const state = {
  token: '', repo: 'histefancirkovic-coder/Directory',
  tab: null, page: {}, source: 'Website',
  works: [], sha: null,
  sel: Object.fromEntries(GROUPS.map(g => [g.key, new Set()])),
  thumbMode: 'none', thumbBlob: null, thumbPreview: null,
  existing: null
};

/* ---------------- utils ---------------- */
function detectSource(url) {
  let h = '';
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
const ytId = u => (u.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/) || [])[1] || null;
function normUrl(u) {
  const y = ytId(u); if (y) return 'yt:' + y;
  try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname).replace(/\/$/, '').toLowerCase(); } catch (e) { return u; }
}
const slug = s => s.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'work';
function b64encodeUtf8(str) { const bytes = new TextEncoder().encode(str); let bin = ''; bytes.forEach(b => bin += String.fromCharCode(b)); return btoa(bin); }
function b64decodeUtf8(b64) { const bin = atob(b64.replace(/\n/g, '')); return new TextDecoder().decode(Uint8Array.from(bin, c => c.charCodeAt(0))); }
function setMsg(el, text, kind) { el.textContent = text; el.className = 'msg' + (kind ? ' ' + kind : ''); }

/* ---------------- GitHub ---------------- */
async function gh(path, opts = {}) {
  const res = await fetch('https://api.github.com/repos/' + state.repo + '/' + path, {
    ...opts,
    headers: { Authorization: 'Bearer ' + state.token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', ...(opts.headers || {}) }
  });
  if (!res.ok && !(opts.allow404 && res.status === 404)) {
    let detail = ''; try { detail = (await res.json()).message; } catch (e) {}
    throw new Error(res.status + (detail ? ' — ' + detail : ''));
  }
  return res.status === 404 ? null : res.json();
}
async function loadWorks() {
  const f = await gh('contents/works.json?ref=main');
  state.sha = f.sha;
  state.works = JSON.parse(b64decodeUtf8(f.content));
}
async function putFile(path, base64, message, sha) {
  return gh('contents/' + path, { method: 'PUT', body: JSON.stringify({ message, content: base64, branch: 'main', ...(sha ? { sha } : {}) }) });
}

/* ---------------- page scrape (runs inside the tab) ---------------- */
function scrape() {
  const meta = (sel) => { const el = document.querySelector(sel); return el ? (el.getAttribute('content') || '').trim() : ''; };
  const txt = (sel) => { const el = document.querySelector(sel); return el ? el.textContent.trim() : ''; };
  const host = location.hostname.replace(/^www\./, '');
  const out = {
    url: location.href,
    title: meta('meta[property="og:title"]') || document.title,
    image: meta('meta[property="og:image"]') || meta('meta[name="twitter:image"]'),
    site: meta('meta[property="og:site_name"]'),
    description: meta('meta[property="og:description"]') || meta('meta[name="description"]'),
    date: meta('meta[itemprop="uploadDate"]') || meta('meta[itemprop="datePublished"]') || meta('meta[property="article:published_time"]'),
    channel: '', duration: ''
  };
  if (/youtube\.com$/.test(host)) {
    out.title = txt('h1.ytd-watch-metadata yt-formatted-string') || out.title.replace(/ - YouTube$/, '');
    out.channel = txt('ytd-watch-metadata #owner #channel-name a') || txt('#owner #channel-name a') || meta('span[itemprop="author"] link[itemprop="name"]');
    const v = document.querySelector('video');
    if (v && isFinite(v.duration) && v.duration > 0) {
      const s = Math.round(v.duration), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
      out.duration = (h ? h + ':' + String(m).padStart(2, '0') : m) + ':' + String(sec).padStart(2, '0');
    }
    out.description = '';
  } else if (/^(x|twitter)\.com$/.test(host)) {
    const m = out.title.match(/^(.*?) on (X|Twitter)/); if (m) out.channel = m[1];
    out.title = (out.description || '').split('\n')[0].slice(0, 90) || out.title;
  } else if (/vimeo\.com$/.test(host)) {
    out.channel = txt('[data-testid="clip-owner-name"]') || '';
  }
  out.title = (out.title || '').trim();
  return out;
}

/* ---------------- thumbnail ---------------- */
async function toJpeg(blob) {
  const bmp = await createImageBitmap(blob);
  const w = Math.min(1280, bmp.width), h = Math.round(bmp.height * w / bmp.width);
  const c = new OffscreenCanvas(w, h); c.getContext('2d').drawImage(bmp, 0, 0, w, h);
  return c.convertToBlob({ type: 'image/jpeg', quality: 0.85 });
}
function showThumb(src) {
  $('thumbImg').hidden = !src; $('thumbEmpty').hidden = !!src;
  if (src) $('thumbImg').src = src;
}
function markThumbBtn(mode) {
  ['useOg', 'shot', 'noThumb'].forEach(id => $(id).classList.remove('on'));
  if (mode === 'og') $('useOg').classList.add('on');
  if (mode === 'shot') $('shot').classList.add('on');
  if (mode === 'none') $('noThumb').classList.add('on');
}
async function setThumb(mode, blob) {
  state.thumbMode = mode; state.thumbBlob = null; markThumbBtn(mode);
  const hint = $('thumbHint');
  if (mode === 'auto') {
    const id = ytId(state.page.url);
    showThumb(id ? 'https://i.ytimg.com/vi/' + id + '/hqdefault.jpg' : null);
    hint.textContent = state.source + ' thumbnail is pulled automatically.';
    if (state.source === 'Vimeo') {
      try { const j = await (await fetch('https://vimeo.com/api/oembed.json?url=' + encodeURIComponent(state.page.url))).json(); showThumb(j.thumbnail_url); } catch (e) {}
    }
    return;
  }
  hint.textContent = '';
  if (mode === 'none') { showThumb(null); return; }
  try {
    if (mode === 'og') {
      if (!state.page.image) { hint.textContent = 'This page has no image. Try Screenshot.'; showThumb(null); return; }
      blob = await (await fetch(state.page.image)).blob();
    }
    state.thumbBlob = await toJpeg(blob);
    showThumb(URL.createObjectURL(state.thumbBlob));
  } catch (e) {
    hint.textContent = 'Couldn’t load that image (' + e.message + ').'; showThumb(null); state.thumbMode = 'none';
  }
}

/* ---------------- tags ---------------- */
function renderGroups() {
  const wrap = $('groups'); wrap.innerHTML = '';
  GROUPS.forEach(g => {
    const values = [...g.opts];
    state.works.forEach(w => (w[g.key] || []).forEach(v => { if (!values.includes(v)) values.push(v); }));
    state.sel[g.key].forEach(v => { if (!values.includes(v)) values.push(v); });
    const div = document.createElement('div'); div.className = 'group';
    div.innerHTML = '<div class="group-h">' + g.label + '</div><div class="tags"></div>';
    const tags = div.querySelector('.tags');
    values.forEach(v => {
      const b = document.createElement('button'); b.type = 'button';
      b.className = 'tag' + (state.sel[g.key].has(v) ? ' on' : ''); b.textContent = v;
      b.onclick = () => { state.sel[g.key].has(v) ? state.sel[g.key].delete(v) : state.sel[g.key].add(v); b.classList.toggle('on'); };
      tags.appendChild(b);
    });
    const add = document.createElement('input'); add.className = 'tag-add'; add.placeholder = '+ new';
    add.onkeydown = e => {
      if (e.key === 'Enter' && add.value.trim()) { e.preventDefault(); state.sel[g.key].add(add.value.trim()); renderGroups(); }
    };
    tags.appendChild(add);
    wrap.appendChild(div);
  });
}

/* ---------------- boot ---------------- */
async function init() {
  const s = await chrome.storage.local.get(['token', 'repo']);
  state.token = s.token || ''; state.repo = s.repo || state.repo;
  $('token').value = state.token; $('repo').value = state.repo;
  if (!state.token) { $('loading').hidden = true; $('settings').hidden = false; return; }

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  state.tab = tab;
  try {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: scrape });
    state.page = res.result || {};
  } catch (e) {
    state.page = { url: tab.url, title: tab.title };
  }
  state.page.url = state.page.url || tab.url;
  state.source = detectSource(state.page.url);

  try { await loadWorks(); }
  catch (e) { $('loading').innerHTML = '<p class="hint">Couldn’t reach GitHub: ' + e.message + '. Check the token in settings.</p>'; $('settings').hidden = false; return; }

  // prefill
  const p = state.page;
  $('url').value = p.url; $('title').value = p.title || '';
  $('client').value = p.channel || p.site || '';
  $('year').value = (p.date && p.date.slice(0, 4)) || new Date().getFullYear();
  $('duration').value = p.duration || '';
  $('desc').value = '';
  $('srcBadge').textContent = state.source;

  // existing entry?
  const key = normUrl(p.url);
  state.existing = state.works.find(w => normUrl(w.url) === key) || null;
  if (state.existing) {
    const w = state.existing;
    $('dup').hidden = false; $('save').textContent = 'Update entry';
    $('title').value = w.title || ''; $('client').value = w.client || ''; $('year').value = w.year || '';
    $('duration').value = w.duration || ''; $('desc').value = w.description || '';
    GROUPS.forEach(g => (w[g.key] || []).forEach(v => state.sel[g.key].add(v)));
  } else if (state.source === 'Website') {
    state.sel.type.add('Case study');
  }

  renderGroups();
  $('loading').hidden = true; $('form').hidden = false;

  if (AUTO_THUMB[state.source]) setThumb('auto');
  else if (state.existing && state.existing.thumbnail) { state.thumbMode = 'keep'; showThumb(/^https?:/.test(state.existing.thumbnail) ? state.existing.thumbnail : 'https://raw.githubusercontent.com/' + state.repo + '/main/' + state.existing.thumbnail); $('thumbHint').textContent = 'Keeping the current thumbnail.'; }
  else if (p.image) setThumb('og');
  else setThumb('none');
}

/* ---------------- actions ---------------- */
$('gear').onclick = () => { $('settings').hidden = !$('settings').hidden; };
$('saveSettings').onclick = async () => {
  const token = $('token').value.trim(), repo = $('repo').value.trim();
  await chrome.storage.local.set({ token, repo });
  state.token = token; state.repo = repo;
  setMsg($('settingsMsg'), 'Checking…');
  try { await gh(''); setMsg($('settingsMsg'), 'Connected ✓', 'ok'); setTimeout(() => location.reload(), 600); }
  catch (e) { setMsg($('settingsMsg'), 'GitHub said: ' + e.message, 'err'); }
};
$('useOg').onclick = () => setThumb('og');
$('noThumb').onclick = () => setThumb('none');
$('shot').onclick = async () => {
  try {
    const dataUrl = await chrome.tabs.captureVisibleTab(state.tab.windowId, { format: 'png' });
    setThumb('shot', await (await fetch(dataUrl)).blob());
  } catch (e) { $('thumbHint').textContent = 'Screenshot failed: ' + e.message; }
};
$('file').onchange = e => { const f = e.target.files[0]; if (f) setThumb('shot', f); };

$('save').onclick = async () => {
  const btn = $('save'), msg = $('msg');
  const title = $('title').value.trim(), url = $('url').value.trim();
  if (!title || !url) { setMsg(msg, 'Title and link are required.', 'err'); return; }
  btn.disabled = true; setMsg(msg, 'Saving…');
  try {
    await loadWorks(); // fresh copy + sha
    const key = normUrl(url);
    const idx = state.works.findIndex(w => normUrl(w.url) === key);
    const prev = idx > -1 ? state.works[idx] : null;

    let id = prev ? prev.id : slug(($('client').value || '') + ' ' + title);
    if (!prev) { let n = 2, base = id; while (state.works.some(w => w.id === id)) id = base + '-' + n++; }

    const item = {
      id, title, client: $('client').value.trim(), url,
      year: Number($('year').value) || new Date().getFullYear(),
      added: prev && prev.added ? prev.added : new Date().toISOString().slice(0, 10)
    };
    if ($('duration').value.trim()) item.duration = $('duration').value.trim();
    if ($('desc').value.trim()) item.description = $('desc').value.trim();
    GROUPS.forEach(g => { item[g.key] = [...state.sel[g.key]]; });

    if (state.thumbBlob) {
      setMsg(msg, 'Uploading thumbnail…');
      const path = 'thumbs/' + id + '.jpg';
      const buf = new Uint8Array(await state.thumbBlob.arrayBuffer()); let bin = '';
      for (let i = 0; i < buf.length; i += 8192) bin += String.fromCharCode.apply(null, buf.subarray(i, i + 8192));
      const existingFile = await gh('contents/' + path + '?ref=main', { allow404: true });
      await putFile(path, btoa(bin), 'Thumbnail: ' + title, existingFile && existingFile.sha);
      item.thumbnail = path;
    } else if (state.thumbMode === 'keep' && prev && prev.thumbnail) {
      item.thumbnail = prev.thumbnail;
    }

    if (prev) state.works[idx] = item; else state.works.push(item);
    setMsg(msg, 'Saving entry…');
    const body = JSON.stringify(state.works, null, 2) + '\n';
    try {
      await putFile('works.json', b64encodeUtf8(body), (prev ? 'Update: ' : 'Add: ') + title, state.sha);
    } catch (e) {
      if (!/^409/.test(e.message)) throw e;
      // someone else changed the file meanwhile — reload and retry once
      await loadWorks();
      const i2 = state.works.findIndex(w => normUrl(w.url) === key);
      if (i2 > -1) state.works[i2] = item; else state.works.push(item);
      await putFile('works.json', b64encodeUtf8(JSON.stringify(state.works, null, 2) + '\n'), (prev ? 'Update: ' : 'Add: ') + title, state.sha);
    }
    setMsg(msg, prev ? 'Updated ✓ Live in ~5 min.' : 'Added ✓ Live in ~5 min.', 'ok');
    btn.textContent = 'Saved';
  } catch (e) {
    setMsg(msg, 'Failed: ' + e.message, 'err'); btn.disabled = false;
  }
};

init();
