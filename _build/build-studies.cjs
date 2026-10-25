#!/usr/bin/env node
/*
 * build-studies.cjs — turns your studies/*.md files into a ready-to-host site.
 *
 * HOW TO RUN (nothing to install — the Markdown renderer is included):
 *     node _build/build-studies.cjs
 *
 * WHAT IT DOES:
 *   1. Reads studies/_index.json            (the order of the studies)
 *   2. Reads each studies/<slug>.md         (your actual writing)
 *   3. dist/index.html                      home page with the study cards baked in
 *   4. dist/studies/<slug>/index.html       one real page per study — a clean,
 *                                            shareable link with no "#" in the URL
 *   5. copies study.html + the .md files    fallback for old bookmarked links
 *
 * You never edit HTML — edit the .md files, then run this (or let GitHub run it
 * for you automatically on every push — see .github/workflows/deploy.yml).
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Markdown renderer, vendored (marked v12, UMD build — works with require()).
const markedModule = require('./marked.min.js');
const marked = markedModule.marked || markedModule;
if (typeof marked.parse !== 'function') {
  console.error('ERROR: _build/marked.min.js did not load correctly.');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const DIST = path.join(ROOT, 'dist');
const STUDIES_DIR = path.join(ROOT, 'studies');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

function pad(n) { return (n < 10 ? '0' : '') + n; }

// Same minimal "---" front-matter parser the site's JavaScript uses.
function splitFrontMatter(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!match) { return { meta: {}, body: text }; }
  const meta = {};
  match[1].split(/\r?\n/).forEach(function (line) {
    const pos = line.indexOf(':');
    if (pos > 0) {
      const key = line.slice(0, pos).trim().toLowerCase();
      const value = line.slice(pos + 1).trim().replace(/^["']|["']$/g, '');
      meta[key] = value;
    }
  });
  return { meta: meta, body: text.slice(match[0].length).replace(/^\s+/, '') };
}

function isPublished(meta) {
  return String(meta.status || '').toLowerCase() === 'published';
}

// ---------------------------------------------------------------------------
// Home-page study card (same markup the fallback loader builds in index.html)
// ---------------------------------------------------------------------------

function cardHTML(study, index) {
  const num = study.meta.number || pad(index + 1);
  const published = isPublished(study.meta);
  return [
    '          <a class="study-card" href="studies/' + study.slug + '/">',
    '            <span class="study-num">' + esc(num) + '</span>',
    '            <span class="study-main">',
    '              <span class="study-name">' + esc(study.meta.name || study.slug) + '</span>',
    '              <span class="study-tag">' + esc(study.meta.tag || '') + '</span>',
    '            </span>',
    '            <span class="study-status' + (published ? ' published' : '') + '">' +
      (published ? 'PUBLISHED' : 'DRAFT') + '</span>',
    '            <span class="study-arrow" aria-hidden="true">→</span>',
    '          </a>'
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Study page template (looks identical to study.html, but fully pre-rendered:
// the content is real HTML — no JavaScript needed to read the study)
// ---------------------------------------------------------------------------

function studyPageHTML(study) {
  const name = study.meta.name || study.slug;
  const kicker = study.meta.kicker || 'Channel Study';
  const metaLine = study.meta.meta || '';
  const bodyHTML = marked.parse(study.body);
  const title = esc(name) + ' — Channel Study | Shlok Mane';
  const description = esc(
    'A hand-written study of ' + name +
    ' — branding, programming and on-screen presentation. Written by Shlok Mane.'
  );
  const favicon =
    "data:image/svg+xml,%3Csvg%20xmlns=%27http://www.w3.org/2000/svg%27%20viewBox=%270%200%2064%2064%27%3E%3Crect%20width=%2764%27%20height=%2764%27%20rx=%2714%27%20fill=%27%23111%27/%3E%3Ctext%20x=%2732%27%20y=%2732%27%20dy=%27.35em%27%20text-anchor=%27middle%27%20font-family=%27Courier%20New,%20monospace%27%20font-size=%2730%27%20font-weight=%27700%27%20fill=%27%23fff%27%3ESM%3C/text%3E%3C/svg%3E";

  return '<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'  <meta charset="UTF-8" />\n' +
'  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n' +
'  <title>' + title + '</title>\n' +
'\n' +
'  <!-- Generated automatically by _build/build-studies.cjs from studies/' + study.slug + '.md —\n' +
'       edit that .md file, not this page. -->\n' +
'\n' +
'  <meta name="description" content="' + description + '" />\n' +
'  <meta name="author" content="Shlok Mane" />\n' +
'  <meta name="theme-color" content="#ffffff" />\n' +
'  <meta name="color-scheme" content="light" />\n' +
'  <meta property="og:title" content="' + esc('Channel Study — ' + name) + '" />\n' +
'  <meta property="og:description" content="' + description + '" />\n' +
'  <meta property="og:type" content="article" />\n' +
'  <meta name="twitter:card" content="summary" />\n' +
'\n' +
'  <link rel="icon" href="' + favicon + '" />\n' +
'\n' +
'  <style>\n' +
'    * { margin: 0; padding: 0; box-sizing: border-box; }\n' +
'\n' +
'    body {\n' +
'      background: #ffffff;\n' +
'      padding: 30px 20px 40px;\n' +
'      display: flex;\n' +
'      justify-content: center;\n' +
'      font-family: \'Courier New\', Courier, monospace;\n' +
'      color: #111111;\n' +
'    }\n' +
'\n' +
'    .container {\n' +
'      max-width: 760px;\n' +
'      width: 100%;\n' +
'      background: #ffffff;\n' +
'      padding-bottom: 40px;\n' +
'    }\n' +
'\n' +
'    /* -------- TOP NAVIGATION -------- */\n' +
'    .top-nav {\n' +
'      display: flex;\n' +
'      justify-content: space-between;\n' +
'      align-items: center;\n' +
'      gap: 12px;\n' +
'      font-size: 12px;\n' +
'      letter-spacing: 1px;\n' +
'      text-transform: uppercase;\n' +
'      color: #666;\n' +
'      padding-bottom: 14px;\n' +
'      border-bottom: 1px solid #ddd;\n' +
'      margin-bottom: 44px;\n' +
'    }\n' +
'\n' +
'    .top-nav a {\n' +
'      color: #111;\n' +
'      text-decoration: none;\n' +
'      border-bottom: 1px dotted #999;\n' +
'      transition: border-color 0.2s;\n' +
'    }\n' +
'\n' +
'    .top-nav a:hover { border-bottom: 1px solid #111; }\n' +
'\n' +
'    /* -------- STUDY HEADER -------- */\n' +
'    .study-header {\n' +
'      margin-bottom: 40px;\n' +
'      border-bottom: 1.5px solid #ccc;\n' +
'      padding-bottom: 24px;\n' +
'    }\n' +
'\n' +
'    .study-kicker {\n' +
'      font-size: 12px;\n' +
'      font-weight: 700;\n' +
'      letter-spacing: 2px;\n' +
'      color: #005f5f;\n' +
'      text-transform: uppercase;\n' +
'      margin-bottom: 12px;\n' +
'    }\n' +
'\n' +
'    .study-title {\n' +
'      font-size: 34px;\n' +
'      font-weight: 700;\n' +
'      letter-spacing: -1px;\n' +
'      line-height: 1.15;\n' +
'      text-transform: uppercase;\n' +
'      color: #000;\n' +
'      margin-bottom: 14px;\n' +
'    }\n' +
'\n' +
'    .study-meta {\n' +
'      font-size: 13px;\n' +
'      color: #666;\n' +
'      line-height: 1.7;\n' +
'    }\n' +
'\n' +
'    /* -------- STUDY CONTENT (rendered from the .md file) -------- */\n' +
'    .study-body h2 {\n' +
'      font-size: 12px;\n' +
'      font-weight: 700;\n' +
'      letter-spacing: 1px;\n' +
'      text-transform: uppercase;\n' +
'      color: #555;\n' +
'      border-bottom: 1.5px solid #ccc;\n' +
'      padding-bottom: 8px;\n' +
'      margin: 38px 0 16px;\n' +
'    }\n' +
'\n' +
'    .study-body h2:first-child { margin-top: 0; }\n' +
'\n' +
'    .study-body h3 {\n' +
'      font-size: 15px;\n' +
'      font-weight: 700;\n' +
'      margin: 26px 0 10px;\n' +
'    }\n' +
'\n' +
'    .study-body p {\n' +
'      font-size: 15px;\n' +
'      line-height: 1.75;\n' +
'      color: #1a1a1a;\n' +
'      margin: 0 0 14px;\n' +
'    }\n' +
'\n' +
'    .study-body ul,\n' +
'    .study-body ol {\n' +
'      font-size: 15px;\n' +
'      line-height: 1.75;\n' +
'      color: #1a1a1a;\n' +
'      margin: 0 0 14px;\n' +
'      padding-left: 24px;\n' +
'    }\n' +
'\n' +
'    .study-body li { margin-bottom: 6px; }\n' +
'    .study-body strong { font-weight: 700; }\n' +
'\n' +
'    .study-body a {\n' +
'      color: #111;\n' +
'      border-bottom: 1px dotted #999;\n' +
'      text-decoration: none;\n' +
'    }\n' +
'\n' +
'    .study-body a:hover { border-bottom-style: solid; }\n' +
'\n' +
'    /* Writing prompts look like quiet dashed notes */\n' +
'    .study-body blockquote {\n' +
'      border-left: 3px solid #ccc;\n' +
'      background: #fafafa;\n' +
'      border-radius: 0 8px 8px 0;\n' +
'      padding: 12px 16px;\n' +
'      margin: 0 0 16px;\n' +
'      font-size: 13px;\n' +
'      font-style: italic;\n' +
'      color: #666;\n' +
'      line-height: 1.7;\n' +
'    }\n' +
'\n' +
'    .study-body blockquote p {\n' +
'      margin: 0;\n' +
'      font-size: 13px;\n' +
'      color: #666;\n' +
'    }\n' +
'\n' +
'    .study-body hr {\n' +
'      border: none;\n' +
'      border-top: 1px solid #ddd;\n' +
'      margin: 26px 0;\n' +
'    }\n' +
'\n' +
'    .study-body img {\n' +
'      max-width: 100%;\n' +
'      height: auto;\n' +
'      border-radius: 8px;\n' +
'    }\n' +
'\n' +
'    .study-body code {\n' +
'      font-family: \'Courier New\', Courier, monospace;\n' +
'      background: #f3f3f3;\n' +
'      border-radius: 4px;\n' +
'      padding: 1px 5px;\n' +
'      font-size: 13px;\n' +
'    }\n' +
'\n' +
'    .study-body pre {\n' +
'      background: #f7f7f7;\n' +
'      border: 1px solid #eee;\n' +
'      border-radius: 8px;\n' +
'      padding: 14px 16px;\n' +
'      overflow-x: auto;\n' +
'      margin: 0 0 14px;\n' +
'      font-size: 13px;\n' +
'      line-height: 1.6;\n' +
'    }\n' +
'\n' +
'    .study-body pre code {\n' +
'      background: none;\n' +
'      padding: 0;\n' +
'    }\n' +
'\n' +
'    /* -------- SHARE + BACK TO HOME -------- */\n' +
'    .study-actions {\n' +
'      margin-top: 52px;\n' +
'      border-top: 1.5px solid #aaa;\n' +
'      padding-top: 28px;\n' +
'      text-align: center;\n' +
'    }\n' +
'\n' +
'    .share-btn {\n' +
'      font-family: \'Courier New\', Courier, monospace;\n' +
'      font-size: 12px;\n' +
'      font-weight: 700;\n' +
'      letter-spacing: 1.5px;\n' +
'      text-transform: uppercase;\n' +
'      background: #111;\n' +
'      color: #fff;\n' +
'      border: 1px solid #111;\n' +
'      border-radius: 8px;\n' +
'      padding: 14px 26px;\n' +
'      cursor: pointer;\n' +
'      transition: background 0.2s ease, transform 0.2s ease;\n' +
'    }\n' +
'\n' +
'    .share-btn:hover {\n' +
'      background: #000;\n' +
'      transform: translateY(-1px);\n' +
'    }\n' +
'\n' +
'    .share-btn.copied {\n' +
'      background: #005f5f;\n' +
'      border-color: #005f5f;\n' +
'    }\n' +
'\n' +
'    .share-hint {\n' +
'      font-size: 12px;\n' +
'      color: #666;\n' +
'      margin-top: 14px;\n' +
'      letter-spacing: 0.4px;\n' +
'      line-height: 1.6;\n' +
'    }\n' +
'\n' +
'    .back-home {\n' +
'      display: block;\n' +
'      margin-top: 40px;\n' +
'      border-top: 1px solid #ddd;\n' +
'      padding-top: 30px;\n' +
'      text-align: center;\n' +
'      text-decoration: none;\n' +
'    }\n' +
'\n' +
'    .back-home-line {\n' +
'      display: block;\n' +
'      font-size: 26px;\n' +
'      font-weight: 700;\n' +
'      letter-spacing: 3px;\n' +
'      text-transform: uppercase;\n' +
'      color: #000;\n' +
'      line-height: 1.25;\n' +
'      transition: color 0.2s ease;\n' +
'    }\n' +
'\n' +
'    .back-home:hover .back-home-line { color: #005f5f; }\n' +
'\n' +
'    .footer-line {\n' +
'      display: block;\n' +
'      font-size: 11px;\n' +
'      letter-spacing: 1.5px;\n' +
'      color: #666;\n' +
'      margin-top: 12px;\n' +
'      text-transform: uppercase;\n' +
'    }\n' +
'\n' +
'    /* -------- RESPONSIVE -------- */\n' +
'    @media (max-width: 600px) {\n' +
'      .study-title { font-size: 28px; }\n' +
'      .back-home-line { font-size: 22px; letter-spacing: 2px; }\n' +
'    }\n' +
'\n' +
'    /* -------- ACCESSIBILITY -------- */\n' +
'    a:focus-visible,\n' +
'    .share-btn:focus-visible {\n' +
'      outline: 2px solid #111;\n' +
'      outline-offset: 3px;\n' +
'    }\n' +
'\n' +
'    @media (prefers-reduced-motion: reduce) {\n' +
'      .top-nav a,\n' +
'      .share-btn,\n' +
'      .back-home-line { transition: none; }\n' +
'      .share-btn:hover { transform: none; }\n' +
'    }\n' +
'  </style>\n' +
'</head>\n' +
'<body>\n' +
'  <div class="container">\n' +
'\n' +
'    <!-- ====== TOP NAV ====== -->\n' +
'    <nav class="top-nav" aria-label="Breadcrumb">\n' +
'      <a href="../../index.html#studies">← All studies</a>\n' +
'      <span>Shlok Mane</span>\n' +
'    </nav>\n' +
'\n' +
'    <!-- ====== STUDY HEADER ====== -->\n' +
'    <header class="study-header">\n' +
'      <div class="study-kicker">' + esc(kicker) + '</div>\n' +
'      <h1 class="study-title">' + esc(name) + '</h1>\n' +
'      <div class="study-meta">' + esc(metaLine) + '</div>\n' +
'    </header>\n' +
'\n' +
'    <!-- ====== STUDY CONTENT (rendered from the Markdown file) ====== -->\n' +
'    <main>\n' +
'      <article class="study-body">\n' +
bodyHTML +
'\n' +
'      </article>\n' +
'    </main>\n' +
'\n' +
'    <!-- ====== SHARE THIS STUDY ====== -->\n' +
'    <section class="study-actions" aria-label="Share this study">\n' +
'      <button class="share-btn" id="shareBtn" type="button">Copy link to this study</button>\n' +
'      <div class="share-hint" id="shareHint">This study has its own link — share it anywhere and it opens exactly this study.</div>\n' +
'    </section>\n' +
'\n' +
'    <!-- ====== BACK TO HOME ====== -->\n' +
'    <a class="back-home" href="../../index.html">\n' +
'      <span class="back-home-line">Back to Home</span>\n' +
'      <span class="footer-line">All studies · Portfolio of Shlok Mane</span>\n' +
'    </a>\n' +
'\n' +
'  </div>\n' +
'\n' +
'  <script>\n' +
'    // ===== Copy-link button (shares this study\'s own URL) =====\n' +
'    (function () {\n' +
'      \'use strict\';\n' +
'      var btn = document.getElementById(\'shareBtn\');\n' +
'      var hint = document.getElementById(\'shareHint\');\n' +
'      if (!btn) { return; }\n' +
'\n' +
'      var defaultHint = hint ? hint.textContent : \'\';\n' +
'      var idleLabel = btn.textContent;\n' +
'\n' +
'      function showCopied() {\n' +
'        btn.textContent = \'Link copied ✓\';\n' +
'        btn.classList.add(\'copied\');\n' +
'        if (hint) { hint.textContent = \'Paste it anywhere — WhatsApp, LinkedIn, email — it opens this exact study.\'; }\n' +
'        window.setTimeout(function () {\n' +
'          btn.textContent = idleLabel;\n' +
'          btn.classList.remove(\'copied\');\n' +
'          if (hint) { hint.textContent = defaultHint; }\n' +
'        }, 2400);\n' +
'      }\n' +
'\n' +
'      function showFailed() {\n' +
'        if (hint) { hint.textContent = \'Auto-copy was blocked — copy the link from the address bar instead.\'; }\n' +
'        window.setTimeout(function () {\n' +
'          if (hint) { hint.textContent = defaultHint; }\n' +
'        }, 3600);\n' +
'      }\n' +
'\n' +
'      // Fallback for browsers where the async Clipboard API is unavailable or blocked\n' +
'      function legacyCopy() {\n' +
'        var input = document.createElement(\'input\');\n' +
'        input.value = window.location.href;\n' +
'        input.setAttribute(\'readonly\', \'\');\n' +
'        input.style.position = \'fixed\';\n' +
'        input.style.opacity = \'0\';\n' +
'        document.body.appendChild(input);\n' +
'        input.select();\n' +
'        var ok = false;\n' +
'        try { ok = document.execCommand(\'copy\'); } catch (err) { ok = false; }\n' +
'        document.body.removeChild(input);\n' +
'        return ok;\n' +
'      }\n' +
'\n' +
'      btn.addEventListener(\'click\', function () {\n' +
'        if (btn.classList.contains(\'copied\')) { return; }\n' +
'        if (navigator.clipboard && navigator.clipboard.writeText) {\n' +
'          navigator.clipboard.writeText(window.location.href).then(showCopied, function () {\n' +
'            if (legacyCopy()) { showCopied(); } else { showFailed(); }\n' +
'          });\n' +
'        } else if (legacyCopy()) {\n' +
'          showCopied();\n' +
'        } else {\n' +
'          showFailed();\n' +
'        }\n' +
'      });\n' +
'    })();\n' +
'  </script>\n' +
'</body>\n' +
'</html>\n';
}

// ---------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------

function main() {
  // 1. Read the manifest (order of studies)
  let slugs;
  try {
    const manifest = JSON.parse(fs.readFileSync(path.join(STUDIES_DIR, '_index.json'), 'utf8'));
    slugs = Array.isArray(manifest.studies) ? manifest.studies : null;
  } catch (err) {
    slugs = null;
  }
  if (!slugs || !slugs.length) {
    console.error('ERROR: studies/_index.json is missing or has no "studies" list.');
    process.exit(1);
  }

  // 2. Parse every study
  const studies = [];
  slugs.forEach(function (slug) {
    const clean = String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '');
    if (!clean || clean !== String(slug).toLowerCase()) {
      console.warn('  skipping "' + slug + '" — use lowercase letters, numbers and dashes only');
      return;
    }
    const file = path.join(STUDIES_DIR, clean + '.md');
    if (!fs.existsSync(file)) {
      console.warn('  skipping "' + clean + '" — studies/' + clean + '.md not found');
      return;
    }
    const parts = splitFrontMatter(fs.readFileSync(file, 'utf8'));
    studies.push({ slug: clean, meta: parts.meta, body: parts.body });
  });

  if (!studies.length) {
    console.error('ERROR: no studies could be read from the studies/ folder.');
    process.exit(1);
  }

  // Helpful nudge: .md files that exist but are not listed in _index.json
  const listed = new Set(studies.map(function (s) { return s.slug; }));
  fs.readdirSync(STUDIES_DIR).forEach(function (f) {
    if (f.endsWith('.md') && f !== '_template.md' && !listed.has(f.replace(/\.md$/, ''))) {
      console.warn('  note: studies/' + f + ' exists but is not listed in studies/_index.json — it will not appear on the site');
    }
  });

  // 3. Fresh dist/ folder
  fs.rmSync(DIST, { recursive: true, force: true });
  fs.mkdirSync(path.join(DIST, 'studies'), { recursive: true });

  // 4. Home page with the cards baked in
  const indexHTML = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const marker = /(<!--\s*studies-cards:start\s*-->)[\s\S]*?(<!--\s*studies-cards:end\s*-->)/;
  if (!marker.test(indexHTML)) {
    console.error('ERROR: index.html is missing the <!--studies-cards:start/end--> markers.');
    process.exit(1);
  }
  const cards = studies.map(cardHTML).join('\n');
  const bakedIndex = indexHTML.replace(
    marker,
    '$1\n' + cards + '\n          $2'
  );
  fs.writeFileSync(path.join(DIST, 'index.html'), bakedIndex);

  // 5. One clean-URL page per study
  studies.forEach(function (study) {
    const dir = path.join(DIST, 'studies', study.slug);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'index.html'), studyPageHTML(study));
  });

  // 6. Copy the fallback reader + the .md files (old links keep working)
  fs.copyFileSync(path.join(ROOT, 'study.html'), path.join(DIST, 'study.html'));
  fs.readdirSync(STUDIES_DIR).forEach(function (f) {
    if (f.endsWith('.md') || f.endsWith('.json')) {
      fs.copyFileSync(path.join(STUDIES_DIR, f), path.join(DIST, 'studies', f));
    }
  });

  // 7. Summary
  console.log('Built ' + studies.length + ' stud' + (studies.length === 1 ? 'y' : 'ies') + ' → dist/');
  studies.forEach(function (study) {
    const state = isPublished(study.meta) ? 'published' : 'draft';
    console.log('  dist/studies/' + study.slug + '/index.html   [' + state + ']  ' + (study.meta.name || study.slug));
  });
  console.log('  dist/index.html                    (cards baked in)');
  console.log('Done. Host the dist/ folder — every study now has a clean link with no "#".');
}

main();
