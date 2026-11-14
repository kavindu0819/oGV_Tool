// IR page: sign in, dashboard, routing. The add/edit form lives in ir-form.js.
(function () {
  const { api, esc, icon, hydrateIcons, PRODUCTS, fmtDate, fmtMonth, daysSince, toast } = window.OGV;

  const $ = (id) => document.getElementById(id);
  const el = {
    login: $('view-login'), app: $('app'), dashboard: $('view-dashboard'), form: $('view-form'),
    loginForm: $('login-form'), loginError: $('login-error'), demoBtn: $('demo-btn'), logoutBtn: $('logout-btn'),
    banner: $('demo-banner'), stats: $('stats'), filter: $('filter'),
    projectsTable: $('projects-table'), requestsTable: $('requests-table'),
    countProjects: $('count-projects'), countRequests: $('count-requests'), requestsDot: $('requests-dot'),
    panelProjects: $('panel-projects'), panelRequests: $('panel-requests'),
  };

  const state = { role: null, projects: [], requests: [], tab: 'projects' };
  const STALE_DAYS = 30;

  /* ---------- Sign in ---------- */

  async function checkSession() {
    const { role } = await api('/api/session');
    state.role = role;
    if (role) showApp(); else showLogin();
  }

  function showLogin() {
    el.app.hidden = true;
    el.login.hidden = false;
    $('password').focus();
  }

  function showApp() {
    el.login.hidden = true;
    el.app.hidden = false;
    el.banner.hidden = state.role !== 'demo';
    route();
  }

  el.loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = el.loginForm.querySelector('button');
    el.loginError.textContent = '';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Signing in';
    try {
      const { role } = await api('/api/ir/login', { method: 'POST', body: { password: el.loginForm.password.value } });
      state.role = role;
      el.loginForm.reset();
      showApp();
    } catch (err) {
      el.loginError.textContent = err.message;
      el.loginForm.password.setAttribute('aria-invalid', 'true');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Sign in';
    }
  });

  el.demoBtn.addEventListener('click', async () => {
    el.demoBtn.disabled = true;
    try {
      const { role } = await api('/api/ir/demo', { method: 'POST' });
      state.role = role;
      showApp();
    } catch (err) {
      toast(err.message, { error: true });
    } finally {
      el.demoBtn.disabled = false;
    }
  });

  el.logoutBtn.addEventListener('click', async () => {
    await api('/api/ir/logout', { method: 'POST' }).catch(() => {});
    state.role = null;
    location.hash = '';
    showLogin();
  });

  /* ---------- Routing: #projects, #requests, #new, #edit/12 ---------- */

  function route() {
    if (!state.role) return;
    const hash = location.hash.replace('#', '');
    const [view, id] = hash.split('/');
    const formReady = Boolean(window.IRForm);

    document.querySelectorAll('[data-nav]').forEach((a) => a.removeAttribute('aria-current'));

    if ((view === 'new' || view === 'edit') && formReady) {
      el.dashboard.hidden = true;
      el.form.hidden = false;
      document.querySelector('[data-nav="new"]').setAttribute('aria-current', view === 'new' ? 'page' : 'false');
      window.IRForm.show(view === 'edit' ? Number(id) : null);
      return;
    }

    window.IRForm?.hide();
    el.form.hidden = true;
    el.dashboard.hidden = false;
    setTab(view === 'requests' ? 'requests' : 'projects');
    document.querySelector(`[data-nav="${state.tab}"]`).setAttribute('aria-current', 'page');
    loadDashboard();
  }
  window.addEventListener('hashchange', route);

  /* ---------- Dashboard ---------- */

  function setTab(tab) {
    state.tab = tab;
    $('tab-projects').setAttribute('aria-selected', String(tab === 'projects'));
    $('tab-requests').setAttribute('aria-selected', String(tab === 'requests'));
    el.panelProjects.hidden = tab !== 'projects';
    el.panelRequests.hidden = tab !== 'requests';
  }

  document.querySelector('.tabs').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tab]');
    if (btn) location.hash = btn.dataset.tab;
  });

  async function loadDashboard() {
    if (!state.projects.length) el.projectsTable.innerHTML = `<p class="table-empty"><span class="spinner" style="display:inline-block;width:18px;height:18px"></span></p>`;
    try {
      const [stats, { projects }, { requests }] = await Promise.all([
        api('/api/ir/stats'), api('/api/ir/projects'), api('/api/ir/requests'),
      ]);
      state.projects = projects;
      state.requests = requests;
      renderStats(stats);
      renderProjects();
      renderRequests();
    } catch (err) {
      if (err.status === 401) return showLogin();
      toast(err.message, { error: true });
    }
  }

  function renderStats(s) {
    const tiles = [
      [s.open_projects, 'Open projects'],
      [s.starting_soon, 'Start in the next 30 days'],
      [s.open_requests, 'Open CR requests', s.open_requests > 0],
      [s.needs_check, `Not checked in ${STALE_DAYS}+ days`, s.needs_check > 0],
    ];
    el.stats.innerHTML = tiles.map(([value, label, warn]) => `
      <div class="stat${warn ? ' warn' : ''}"><div class="stat-value num">${value}</div><div class="stat-label">${esc(label)}</div></div>`).join('');
    el.requestsDot.hidden = !(s.open_requests > 0);
  }

  function lastCheckedHtml(p) {
    const days = daysSince(p.last_checked);
    const text = days <= 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days} days ago`;
    return `<span class="${days >= STALE_DAYS && !p.is_closed ? 'stale' : ''}">${text}</span>`;
  }

  function projectActions(p) {
    if (!p.can_edit) return `<span class="locked">${icon('lock', 'icon icon-sm')} View only</span>`;
    return `
      <a class="btn btn-text" href="#edit/${p.id}">Edit</a>
      ${p.is_closed ? '' : `<button class="btn btn-text" type="button" data-act="checked" data-id="${p.id}">Mark checked</button>`}
      <button class="btn btn-text" type="button" data-act="${p.is_closed ? 'reopen' : 'close'}" data-id="${p.id}">${p.is_closed ? 'Reopen' : 'Close'}</button>
      <button class="btn btn-text btn-danger" type="button" data-act="delete" data-id="${p.id}">Delete</button>`;
  }

  function renderProjects() {
    const q = el.filter.value.trim().toLowerCase();
    const list = state.projects.filter((p) =>
      !q || [p.name, p.country, p.host_lc, p.city].some((v) => (v || '').toLowerCase().includes(q)));
    el.countProjects.textContent = state.projects.filter((p) => !p.is_closed).length;

    if (!state.projects.length) {
      el.projectsTable.innerHTML = `<p class="table-empty">No projects yet. <a href="#new">Add the first one</a>.</p>`;
      return;
    }
    if (!list.length) {
      el.projectsTable.innerHTML = `<p class="table-empty">No projects match "${esc(el.filter.value)}".</p>`;
      return;
    }

    el.projectsTable.innerHTML = `
      <table class="table">
        <thead><tr><th>Project</th><th>Product</th><th>Country</th><th>Next start</th><th>Checked</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${list.map((p) => `
          <tr class="${p.is_closed ? 'closed' : ''}">
            <td><div class="name">${esc(p.name)}${p.is_demo ? ' <span class="tag">Demo</span>' : ''}${p.is_closed ? ' <span class="tag">Closed</span>' : ''}</div><div class="sub">${esc([p.host_lc, p.city].filter(Boolean).join(', '))}</div></td>
            <td>${esc(PRODUCTS[p.product])}</td>
            <td>${esc(p.country)}</td>
            <td class="num">${p.next_start ? esc(fmtDate(p.next_start)) : '<span class="stale">No upcoming date</span>'}</td>
            <td class="num">${lastCheckedHtml(p)}</td>
            <td><div class="row-actions">${projectActions(p)}</div></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  function renderRequests() {
    const open = state.requests.filter((r) => r.status === 'open').length;
    el.countRequests.textContent = open;

    if (!state.requests.length) {
      el.requestsTable.innerHTML = '<p class="table-empty">No requests from CR yet.</p>';
      return;
    }
    el.requestsTable.innerHTML = `
      <table class="table">
        <thead><tr><th>Looking for</th><th>EPs</th><th>From</th><th>Sent</th><th><span class="sr-only">Actions</span></th></tr></thead>
        <tbody>${state.requests.map((r) => `
          <tr class="${r.status === 'found' ? 'closed' : ''}">
            <td><div class="name">${esc(PRODUCTS[r.product])}${r.status === 'found' ? ' <span class="tag">Found</span>' : ''}${r.is_demo ? ' <span class="tag">Demo</span>' : ''}</div>
                <div class="sub">${esc(r.country || 'Any country')} · ${esc(r.month ? fmtMonth(r.month) : 'Any month')}</div></td>
            <td class="num">${r.ep_count}</td>
            <td><div>${esc(r.requested_by)}</div>${r.note ? `<div class="sub">${esc(r.note)}</div>` : ''}</td>
            <td class="num">${esc(fmtDate(String(r.created_at).slice(0, 10)))}</td>
            <td><div class="row-actions">${r.can_edit ? `
              <button class="btn btn-text" type="button" data-req="${r.status === 'open' ? 'found' : 'open'}" data-id="${r.id}">${r.status === 'open' ? 'Mark found' : 'Reopen'}</button>
              <button class="btn btn-text btn-danger" type="button" data-req="delete" data-id="${r.id}">Delete</button>`
              : `<span class="locked">${icon('lock', 'icon icon-sm')} View only</span>`}</div></td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  }

  el.filter.addEventListener('input', renderProjects);

  // Project row actions
  el.projectsTable.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const project = state.projects.find((p) => p.id === id);
    const act = btn.dataset.act;
    if (act === 'delete' && !confirm(`Delete "${project.name}"? This can't be undone.`)) return;

    btn.disabled = true;
    try {
      if (act === 'checked') await api(`/api/ir/projects/${id}/checked`, { method: 'POST' });
      if (act === 'close' || act === 'reopen') await api(`/api/ir/projects/${id}/closed`, { method: 'POST', body: { closed: act === 'close' } });
      if (act === 'delete') await api(`/api/ir/projects/${id}`, { method: 'DELETE' });
      toast({
        checked: 'Marked as checked today',
        close: 'Project closed. CR won’t see it.',
        reopen: 'Project reopened',
        delete: 'Project deleted',
      }[act]);
      loadDashboard();
    } catch (err) {
      btn.disabled = false;
      toast(err.message, { error: true });
    }
  });

  // Request row actions
  el.requestsTable.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-req]');
    if (!btn) return;
    const id = Number(btn.dataset.id);
    const act = btn.dataset.req;
    if (act === 'delete' && !confirm('Delete this request?')) return;
    btn.disabled = true;
    try {
      if (act === 'delete') await api(`/api/ir/requests/${id}`, { method: 'DELETE' });
      else await api(`/api/ir/requests/${id}/status`, { method: 'POST', body: { status: act } });
      toast(act === 'found' ? 'Request marked as found' : act === 'open' ? 'Request reopened' : 'Request deleted');
      loadDashboard();
    } catch (err) {
      btn.disabled = false;
      toast(err.message, { error: true });
    }
  });

  // Shared with ir-form.js
  window.IR = { getRole: () => state.role, showLogin, reloadDashboard: loadDashboard };

  hydrateIcons();
  checkSession().catch((err) => toast(err.message, { error: true }));
})();
