// Shared by the CR and IR pages: icons, API calls, formatting, toast, detail panel.
(function () {
  /* ---------- Icons: one hand-drawn set, 24px grid, 1.75 stroke ---------- */
  const ICONS = {
    search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>',
    briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M3 13h18"/>',
    grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    inbox: '<path d="M4 13l2.5-7h11L20 13v6H4z"/><path d="M4 13h4.5l1 2h5l1-2H20"/>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
    calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    send: '<path d="M21 3L10 14M21 3l-6.5 18-4.5-7-7-4.5z"/>',
    copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
    external: '<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    file: '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7"/>',
    alert: '<circle cx="12" cy="12" r="8.5"/><path d="M12 8v4.5M12 16h.01"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    back: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  };

  const sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  sprite.setAttribute('aria-hidden', 'true');
  sprite.style.display = 'none';
  sprite.innerHTML = Object.entries(ICONS)
    .map(([name, paths]) => `<symbol id="i-${name}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${paths}</symbol>`)
    .join('');
  document.body.prepend(sprite);

  const icon = (name, cls = 'icon') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${name}"/></svg>`;

  // Fill any <i data-icon="name"></i> placeholders in static HTML.
  function hydrateIcons(root = document) {
    root.querySelectorAll('i[data-icon]').forEach((el) => {
      el.outerHTML = icon(el.dataset.icon, el.dataset.size === 'sm' ? 'icon icon-sm' : 'icon');
    });
  }

  /* ---------- Data ---------- */
  const PRODUCTS = {
    on_the_map: 'On The Map',
    global_classroom: 'Global Classroom',
    skill_up: 'Skill Up!',
  };

  const SDGS = [
    'No Poverty', 'Zero Hunger', 'Good Health and Well-being', 'Quality Education',
    'Gender Equality', 'Clean Water and Sanitation', 'Affordable and Clean Energy',
    'Decent Work and Economic Growth', 'Industry, Innovation and Infrastructure',
    'Reduced Inequalities', 'Sustainable Cities and Communities',
    'Responsible Consumption and Production', 'Climate Action', 'Life Below Water',
    'Life on Land', 'Peace, Justice and Strong Institutions', 'Partnerships for the Goals',
  ];
  const sdgName = (n) => (n ? `SDG ${n} ${SDGS[n - 1]}` : '');

  /* ---------- API ---------- */
  async function api(path, { method = 'GET', body } = {}) {
    const res = await fetch(path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
    });
    let data = {};
    try { data = await res.json(); } catch { /* empty body */ }
    if (!res.ok) {
      const err = new Error(data.error || 'Could not reach the server. Check your connection.');
      err.status = res.status;
      err.fields = data.fields || {};
      throw err;
    }
    return data;
  }

  /* ---------- Formatting ---------- */
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

  const parts = (iso) => iso.split('-').map(Number);
  const fmtDate = (iso) => { const [y, m, d] = parts(iso); return `${d} ${MONTHS[m - 1]} ${y}`; };
  const fmtDay = (iso) => { const [, m, d] = parts(iso); return `${d} ${MONTHS[m - 1]}`; };
  const fmtMonth = (ym) => { const [y, m] = parts(ym); return `${MONTHS_LONG[m - 1]} ${y}`; };
  const todayIso = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const daysSince = (iso) => {
    const [y, m, d] = parts(iso);
    const then = Date.UTC(y, m - 1, d);
    const [ty, tm, td] = parts(todayIso());
    return Math.round((Date.UTC(ty, tm - 1, td) - then) / 86400000);
  };
  const weeks = (n) => `${n} ${n === 1 ? 'week' : 'weeks'}`;

  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  /* ---------- Toast ---------- */
  let toastEl;
  let toastTimer;
  function toast(message, { error = false } = {}) {
    if (!toastEl) {
      toastEl = document.createElement('div');
      toastEl.className = 'toast';
      toastEl.setAttribute('role', 'status');
      toastEl.setAttribute('aria-live', 'polite');
      document.body.append(toastEl);
    }
    toastEl.classList.toggle('error', error);
    toastEl.innerHTML = `${icon(error ? 'alert' : 'check')}<span>${esc(message)}</span>`;
    requestAnimationFrame(() => toastEl.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  /* ---------- Project text for EPs ---------- */
  function epMessage(p, date) {
    const lines = [
      `Hi! Here's a project I think you'll like:`,
      ``,
      `${p.name}`,
      `${PRODUCTS[p.product]} in ${p.city ? `${p.city}, ` : ''}${p.country}`,
      `Host: ${p.host_lc}`,
      `Starts: ${fmtDate(date)} (${weeks(p.duration_weeks)})`,
    ];
    if (p.sdg) lines.push(`Cause: ${sdgName(p.sdg)}`);
    if (p.covered) lines.push(`Covered: ${p.covered}`);
    lines.push(``, `Project: ${p.project_link}`);
    if (p.booklet_link) lines.push(`Booklet: ${p.booklet_link}`);
    return lines.join('\n');
  }

  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      const area = document.createElement('textarea');
      area.value = text;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.append(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    }
  }

  /* ---------- Detail panel (CR results and IR form preview) ---------- */
  // p: project with all_dates (or slots); matched: dates that matched the search.
  function renderDetail(p, { matched = [], preview = false } = {}) {
    const dates = (p.all_dates || p.slots || []).filter(Boolean);
    const first = matched[0] || dates[0];
    const where = [p.host_lc, p.city, p.country].filter(Boolean).join(', ');
    const facts = [
      ['Duration', p.duration_weeks ? weeks(p.duration_weeks) : ''],
      ['Cause', sdgName(p.sdg)],
      ["What's covered", p.covered],
      ['Language', p.language],
      ['Checked by IR', p.last_checked ? fmtDate(p.last_checked) : ''],
    ].filter(([, v]) => v);

    return `
      <article class="detail">
        <div>
          <p class="detail-kicker">${esc(PRODUCTS[p.product] || 'Product')}${p.is_demo ? ' · <span class="tag">Demo</span>' : ''}</p>
          <h2 class="detail-title" id="detail-title">${esc(p.name || 'Project name')}${p.duration_weeks ? ` <small class="num">(${esc(weeks(p.duration_weeks))})</small>` : ''}</h2>
          <p class="detail-where">${esc(where || 'Host LC, city, country')}</p>
        </div>

        <div>
          <p class="detail-kicker" style="margin:0">Start dates</p>
          ${dates.length
            ? `<ul class="dates num">${dates.map((d) => `<li class="${matched.includes(d) ? 'match' : ''}">${esc(fmtDate(d))}</li>`).join('')}</ul>`
            : '<p class="detail-notes">No start dates yet.</p>'}
        </div>

        ${facts.length ? `<dl class="facts">${facts.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
        ${p.notes ? `<p class="detail-notes">${esc(p.notes)}</p>` : ''}

        <div class="detail-links">
          ${p.project_link ? `<a href="${esc(p.project_link)}" target="_blank" rel="noopener">Project page ${icon('external', 'icon icon-sm')}</a>` : ''}
          ${p.booklet_link ? `<a href="${esc(p.booklet_link)}" target="_blank" rel="noopener">Booklet ${icon('file', 'icon icon-sm')}</a>` : ''}
        </div>

        ${preview || !first ? '' : `
        <div class="cta-wrap">
          <a class="cta" data-action="whatsapp" href="https://wa.me/?text=${encodeURIComponent(epMessage(p, first))}" target="_blank" rel="noopener">
            <span class="cta-icon">${icon('send')}</span>
            <span class="cta-label">Send to EP</span>
            <span class="cta-meta num">${esc(fmtDay(first))}</span>
          </a>
          <button type="button" class="copy-btn" data-action="copy">${icon('copy')}<span>Copy details</span></button>
        </div>`}
      </article>`;
  }

  // Wires the copy button inside a rendered detail.
  function bindDetail(container, p, matched = []) {
    const btn = container.querySelector('[data-action="copy"]');
    if (!btn) return;
    btn.addEventListener('click', async () => {
      const dates = p.all_dates || p.slots || [];
      const ok = await copyText(epMessage(p, matched[0] || dates[0]));
      if (ok) {
        btn.classList.add('done');
        btn.innerHTML = `${icon('check')}<span>Copied</span>`;
        setTimeout(() => {
          btn.classList.remove('done');
          btn.innerHTML = `${icon('copy')}<span>Copy details</span>`;
        }, 1800);
      } else {
        toast('Could not copy. Select the text and copy it yourself.', { error: true });
      }
    });
  }

  window.OGV = {
    icon, hydrateIcons, PRODUCTS, SDGS, sdgName, api, esc, toast,
    fmtDate, fmtDay, fmtMonth, todayIso, daysSince, weeks, epMessage, copyText,
    renderDetail, bindDetail,
  };
})();
