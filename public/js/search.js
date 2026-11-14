// CR search page.
(function () {
  const { api, esc, icon, hydrateIcons, PRODUCTS, fmtDate, fmtDay, fmtMonth, weeks, renderDetail, epMessage, copyText, toast } = window.OGV;

  const $ = (id) => document.getElementById(id);
  const el = {
    products: $('products'),
    country: $('country'),
    month: $('month'),
    field: $('study-field'),
    fieldWrap: $('field-wrap'),
    filters: document.querySelector('.filters'),
    summary: $('summary'),
    results: $('results'),
    panel: $('panel'),
    body: $('panel-body'),
    close: $('panel-close'),
    foot: $('panel-foot'),
    epList: $('ep-list'),
    epItems: $('ep-items'),
    epCount: $('ep-count'),
    send: $('send-btn'),
    sendIcon: $('send-icon'),
    backdrop: $('backdrop'),
    listBar: $('list-bar'),
    listBarText: $('list-bar-text'),
  };
  const panelEmpty = el.body.innerHTML;
  const isPhone = () => window.matchMedia('(max-width: 1100px)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let summary = null;

  /* ---------- Live numbers in the empty panel ---------- */

  function countUp(node, target, ms = 1100) {
    if (reducedMotion || target === 0) { node.textContent = target; return; }
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min((now - start) / ms, 1);
      node.textContent = Math.round(target * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  function fillStats(animate) {
    const box = el.panel.querySelector('#live-stats');
    if (!box || !summary) return;
    const projects = box.querySelector('[data-count="projects"]');
    const countries = box.querySelector('[data-count="countries"]');
    const next = box.querySelector('[data-count="next"]');
    if (animate) {
      countUp(projects, summary.projects);
      countUp(countries, summary.countries.length);
    } else {
      projects.textContent = summary.projects;
      countries.textContent = summary.countries.length;
    }
    next.innerHTML = summary.next_start
      ? `${esc(fmtDay(summary.next_start))}<small>${esc(summary.next_start.slice(0, 4))}</small>`
      : 'None yet';
    if (animate && !reducedMotion) next.classList.add('pop');
  }

  async function loadSummary() {
    try {
      summary = await api('/api/summary');
      fillStats(true);
      window.dispatchEvent(new CustomEvent('ogv:summary', { detail: summary }));
    } catch {
      // Numbers are a nice extra; search still works without them.
    }
  }

  const state = {
    product: 'on_the_map',
    country: '',
    month: '',
    field: '',              // Skill Up only, e.g. "Computer sciences"
    options: { products: {}, countries: [], months: [], fields: [] },
    projects: [],
    selectedId: null,
    current: null,          // project open in the panel
    picked: [],             // [{ project, date }] added with +, cleared on refresh
  };
  const isPicked = (id) => state.picked.some((it) => it.project.id === id);
  let searchSeq = 0;

  /* ---------- Filters ---------- */

  function renderProducts() {
    el.products.innerHTML = Object.entries(PRODUCTS).map(([key, label]) => `
      <button type="button" role="radio" data-product="${key}" aria-checked="${state.product === key}">
        ${esc(label)} <span class="count num">${state.options.products[key] ?? 0}</span>
      </button>`).join('');
  }

  function fillSelect(select, anyLabel, items, current) {
    select.innerHTML = `<option value="">${esc(anyLabel)}</option>` +
      items.map((i) => `<option value="${esc(i.value)}"${i.value === current ? ' selected' : ''}>${esc(i.label)}</option>`).join('');
  }

  function renderFilters() {
    const { countries, months } = state.options;
    if (state.country && !countries.some((c) => c.name === state.country)) state.country = '';
    if (state.month && !months.some((m) => m.value === state.month)) state.month = '';

    fillSelect(el.country, 'Any country', countries.map((c) => ({ value: c.name, label: `${c.name} (${c.count})` })), state.country);
    fillSelect(el.month, 'Any month', months.map((m) => ({ value: m.value, label: `${fmtMonth(m.value)} (${m.count})` })), state.month);
    el.country.disabled = countries.length === 0;
    el.month.disabled = months.length === 0;

    // Field filter: Skill Up only.
    const fields = state.options.fields || [];
    const showField = state.product === 'skill_up' && fields.length > 0;
    if (state.field && !fields.some((f) => f.name === state.field)) state.field = '';
    el.fieldWrap.hidden = !showField;
    el.filters.classList.toggle('has-field', showField);
    fillSelect(el.field, 'Any field', fields.map((f) => ({ value: f.name, label: `${f.name} (${f.count})` })), state.field);
  }

  async function loadOptions() {
    const params = new URLSearchParams({ product: state.product });
    if (state.country) params.set('country', state.country);
    state.options = await api(`/api/options?${params}`);
    renderProducts();
    renderFilters();
  }

  /* ---------- Results ---------- */

  function showLoading() {
    el.summary.textContent = 'Searching';
    el.results.innerHTML = `<div class="cards" aria-hidden="true">${'<div class="skeleton"></div>'.repeat(3)}</div>`;
  }

  function describeSearch() {
    const bits = [PRODUCTS[state.product]];
    if (state.country) bits.push(`in ${state.country}`);
    if (state.month) bits.push(`starting ${fmtMonth(state.month)}`);
    if (state.field) bits.push(`for ${state.field}`);
    return bits.join(' ');
  }

  function cardHtml(p) {
    const first = p.matched_dates[0];
    const more = p.matched_dates.length - 1;
    const top = [esc(p.country), p.sdg ? `SDG ${p.sdg}` : ''].filter(Boolean).join(' · ');
    return `
      <div class="card-wrap">
        <button type="button" class="card" data-id="${p.id}" aria-pressed="${state.selectedId === p.id}">
          <span class="card-top"><span>${top}${p.is_demo ? ' <span class="tag">Demo</span>' : ''}</span></span>
          <span>
            <span class="card-title">${esc(p.name)}</span>
            <span class="card-sub">${esc(p.host_lc)}</span>
          </span>
          <span class="card-foot">
            <span class="card-date num"><small>Starts</small>${esc(fmtDate(first))}</span>
            <span class="card-weeks num">${esc(weeks(p.duration_weeks))}${more > 0 ? ` · +${more} date${more > 1 ? 's' : ''}` : ''}</span>
          </span>
        </button>
        ${addButtonHtml(p)}
      </div>`;
  }

  function addButtonHtml(p) {
    const added = isPicked(p.id);
    return `<button type="button" class="card-add" data-add="${p.id}" aria-pressed="${added}"
      aria-label="${added ? 'Remove' : 'Add'} ${esc(p.name)} ${added ? 'from' : 'to'} your EP list" title="${added ? 'Remove from list' : 'Add to list'}">
      ${icon(added ? 'check' : 'plus')}</button>`;
  }

  function renderResults() {
    const list = state.projects;
    if (list.length === 0) return renderEmpty();
    el.summary.textContent = `${list.length} ${list.length === 1 ? 'project' : 'projects'}: ${describeSearch()}`;
    el.results.innerHTML = `<div class="cards">${list.map(cardHtml).join('')}</div>`;
  }

  function renderEmpty() {
    el.summary.textContent = `0 projects: ${describeSearch()}`;
    const otherMonths = state.month ? state.options.months.filter((m) => m.value !== state.month) : [];
    const where = state.country ? ` in ${esc(state.country)}` : '';
    const when = state.month ? ` starting ${esc(fmtMonth(state.month))}` : '';

    el.results.innerHTML = `
      <div class="empty">
        <h3>No match yet</h3>
        <p>No ${esc(PRODUCTS[state.product])} projects${where}${when}${state.field ? ` for ${esc(state.field)}` : ''}.</p>
        ${otherMonths.length ? `
          <p>Projects${where} start in these months instead:</p>
          <div class="suggest">${otherMonths.slice(0, 6).map((m) => `
            <button type="button" class="chip" data-month="${m.value}">${esc(fmtMonth(m.value))} <span class="count num">${m.count}</span></button>`).join('')}
          </div>` : ''}

        <form class="request-form" id="request-form" novalidate>
          <div>
            <h3 style="font-size:var(--fs-lg)">Ask IR to find one</h3>
            <p>IR sees this on their dashboard: ${esc(describeSearch())}.</p>
          </div>
          <div class="row">
            <div class="field">
              <label for="req-count">EPs waiting</label>
              <input class="input num" id="req-count" name="ep_count" type="number" min="1" max="99" value="1" required>
            </div>
            <div class="field">
              <label for="req-name">Your name</label>
              <input class="input" id="req-name" name="requested_by" autocomplete="name" required>
              <span class="error" data-error="requested_by"></span>
            </div>
          </div>
          <div class="field">
            <label for="req-note">Note for IR <span class="hint">(optional)</span></label>
            <input class="input" id="req-note" name="note" maxlength="500" placeholder="e.g. EP can only go after 15 July">
          </div>
          <div><button class="btn btn-primary" type="submit">Send request to IR</button></div>
        </form>
      </div>`;
  }

  async function runSearch() {
    const seq = ++searchSeq;
    showLoading();
    const params = new URLSearchParams({ product: state.product });
    if (state.country) params.set('country', state.country);
    if (state.month) params.set('month', state.month);
    if (state.product === 'skill_up' && state.field) params.set('field', state.field);
    try {
      const { projects } = await api(`/api/projects?${params}`);
      if (seq !== searchSeq) return; // a newer search started
      state.projects = projects;
      if (!projects.some((p) => p.id === state.selectedId)) closePanel(true);
      renderResults();
    } catch (err) {
      if (seq !== searchSeq) return;
      el.summary.textContent = '';
      el.results.innerHTML = `<div class="empty"><h3>Search failed</h3><p>${esc(err.message)}</p><div class="suggest"><button type="button" class="chip" data-action="retry">Try again</button></div></div>`;
    }
  }

  async function refresh({ reloadOptions = true } = {}) {
    try {
      if (reloadOptions) await loadOptions();
    } catch (err) {
      toast(err.message, { error: true });
    }
    await runSearch();
  }

  /* ---------- Panel: details, EP list, Send to EP ---------- */

  function showSheet() {
    el.panel.classList.add('open');
    el.backdrop.classList.add('show');
    updateChrome();
  }

  function openPanel(project) {
    state.selectedId = project.id;
    state.current = project;
    el.body.innerHTML = renderDetail(project, { matched: project.matched_dates });
    el.results.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-pressed', String(Number(c.dataset.id) === project.id)));
    showSheet();
    renderFoot();
    if (isPhone()) el.close.focus();
  }

  function closePanel(silent = false) {
    state.selectedId = null;
    state.current = null;
    el.panel.classList.remove('open');
    el.backdrop.classList.remove('show');
    if (!silent) el.results.querySelectorAll('.card').forEach((c) => c.setAttribute('aria-pressed', 'false'));
    updateChrome();
    // Wait for the phone sheet to slide away before swapping the content.
    setTimeout(() => {
      if (state.selectedId !== null) return;
      el.body.innerHTML = panelEmpty;
      fillStats(false);
      renderFoot();
    }, silent ? 0 : 320);
  }

  // Close button, and the phone bar that opens the list.
  function updateChrome() {
    const open = el.panel.classList.contains('open');
    el.close.hidden = isPhone() ? !open : state.current === null;
    el.listBar.hidden = !(isPhone() && state.picked.length && !open);
    el.listBarText.textContent = `${state.picked.length} added for your EP`;
  }

  function sendLabel() {
    return state.picked.length > 1 ? `Send ${state.picked.length} to EP` : 'Send to EP';
  }

  function renderFoot() {
    const n = state.picked.length;
    el.epList.hidden = n === 0;
    el.epCount.textContent = `(${n})`;
    el.epItems.innerHTML = state.picked.map(({ project: p, date }) => `
      <li class="ep-item">
        <span class="ep-item-text">
          <span class="ep-item-name">${esc(p.name)}</span>
          <span class="ep-item-meta num">${esc(p.country)} · ${esc(fmtDay(date))}</span>
        </span>
        <button type="button" class="ep-remove" data-remove="${p.id}" aria-label="Remove ${esc(p.name)}">${icon('close', 'icon icon-sm')}</button>
      </li>`).join('');

    // Send copies the list if there is one, otherwise the open project.
    el.foot.hidden = n === 0 && state.current === null;
    if (!el.send.classList.contains('sent')) {
      el.send.querySelector('.cta-label').textContent = sendLabel();
    }
    el.send.querySelector('.cta-meta').textContent =
      n === 0 && state.current ? fmtDay(state.current.matched_dates[0]) : '';
    updateChrome();
  }

  function togglePick(id) {
    if (isPicked(id)) {
      state.picked = state.picked.filter((it) => it.project.id !== id);
    } else {
      const project = state.projects.find((p) => p.id === id);
      if (!project) return;
      state.picked.push({ project, date: project.matched_dates[0] });
    }
    // Swap just this card's button so the pop animation plays.
    const btn = el.results.querySelector(`[data-add="${id}"]`);
    if (btn) {
      const project = state.projects.find((p) => p.id === id);
      btn.outerHTML = addButtonHtml(project);
      el.results.querySelector(`[data-add="${id}"]`).classList.add('pop');
    }
    renderFoot();
  }

  let sentTimer;
  async function send() {
    const items = state.picked.length
      ? state.picked
      : state.current ? [{ project: state.current, date: state.current.matched_dates[0] }] : [];
    if (!items.length) return;
    const ok = await copyText(epMessage(items));
    if (!ok) {
      toast('Could not copy. Check your browser allows clipboard access.', { error: true });
      return;
    }
    // Sent animation: fill sweeps in, circle slides right, plane flies off, check draws in.
    const btn = el.send;
    const pad = parseFloat(getComputedStyle(btn).paddingLeft);
    btn.style.setProperty('--travel', `${btn.clientWidth - el.sendIcon.offsetWidth - pad * 2}px`);
    btn.classList.remove('sent');
    void btn.offsetWidth; // restart on repeat clicks
    btn.classList.add('sent');
    btn.querySelector('.cta-label').textContent = 'Copied to clipboard';
    clearTimeout(sentTimer);
    sentTimer = setTimeout(() => {
      btn.classList.remove('sent');
      btn.querySelector('.cta-label').textContent = sendLabel();
    }, 2600);
  }

  /* ---------- Events ---------- */

  el.products.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-product]');
    if (!btn || btn.dataset.product === state.product) return;
    state.product = btn.dataset.product;
    state.country = '';
    state.month = '';
    state.field = '';
    refresh();
  });

  el.field.addEventListener('change', () => {
    state.field = el.field.value;
    refresh({ reloadOptions: false });
  });

  el.country.addEventListener('change', () => {
    state.country = el.country.value;
    refresh();
  });

  el.month.addEventListener('change', () => {
    state.month = el.month.value;
    refresh({ reloadOptions: false });
  });

  el.results.addEventListener('click', (e) => {
    const add = e.target.closest('[data-add]');
    if (add) {
      togglePick(Number(add.dataset.add));
      return;
    }
    const card = e.target.closest('.card');
    if (card) {
      const project = state.projects.find((p) => p.id === Number(card.dataset.id));
      if (project) openPanel(project);
      return;
    }
    const chip = e.target.closest('[data-month]');
    if (chip) {
      state.month = chip.dataset.month;
      el.month.value = state.month;
      refresh({ reloadOptions: false });
      return;
    }
    if (e.target.closest('[data-action="retry"]')) refresh();
  });

  el.results.addEventListener('submit', async (e) => {
    if (e.target.id !== 'request-form') return;
    e.preventDefault();
    const form = e.target;
    const btn = form.querySelector('button[type="submit"]');
    form.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Sending';
    try {
      await api('/api/requests', {
        method: 'POST',
        body: {
          product: state.product,
          country: state.country || null,
          month: state.month || null,
          ep_count: Number(form.ep_count.value),
          requested_by: form.requested_by.value,
          note: form.note.value,
        },
      });
      form.outerHTML = `<p class="request-sent">${icon('check')} Request sent. IR will see it on their dashboard.</p>`;
    } catch (err) {
      Object.entries(err.fields || {}).forEach(([field, msg]) => {
        const slot = form.querySelector(`[data-error="${field}"]`);
        if (slot) slot.textContent = msg;
        form.querySelector(`[name="${field}"]`)?.setAttribute('aria-invalid', 'true');
      });
      if (!Object.keys(err.fields || {}).length) toast(err.message, { error: true });
      btn.disabled = false;
      btn.textContent = 'Send request to IR';
    }
  });

  el.close.addEventListener('click', () => closePanel());
  el.epItems.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-remove]');
    if (btn) togglePick(Number(btn.dataset.remove));
  });
  el.send.addEventListener('click', send);
  el.listBar.addEventListener('click', showSheet);
  el.backdrop.addEventListener('click', () => closePanel());
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && el.panel.classList.contains('open')) closePanel();
  });
  window.matchMedia('(max-width: 1100px)').addEventListener('change', updateChrome);

  el.sendIcon.innerHTML = icon('send', 'icon cta-send') + icon('check', 'icon cta-check');
  hydrateIcons();
  refresh();
  loadSummary();
})();
