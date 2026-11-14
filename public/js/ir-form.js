// IR add / edit project form.
(function () {
  const { api, esc, icon, PRODUCTS, SDGS, todayIso, toast } = window.OGV;
  const view = document.getElementById('view-form');

  // Common Global Volunteer destinations; existing countries are added too,
  // so IR keeps spelling consistent (CR filters by exact country name).
  const COUNTRIES = [
    'Argentina', 'Brazil', 'Cambodia', 'Colombia', 'Costa Rica', 'Egypt', 'Georgia', 'Ghana',
    'India', 'Indonesia', 'Kenya', 'Malaysia', 'Mexico', 'Morocco', 'Nepal', 'Peru',
    'Philippines', 'Poland', 'Portugal', 'Romania', 'Sri Lanka', 'Taiwan', 'Thailand',
    'Tunisia', 'Turkey', 'Uganda', 'Vietnam',
  ];

  let editingId = null;

  function slotRow(value = '') {
    return `
      <div class="slot-row">
        <label class="sr-only">Start date</label>
        <input class="input num" type="date" name="slot" value="${esc(value)}" min="${todayIso()}">
        <button type="button" class="icon-btn" data-remove-slot aria-label="Remove this start date">${icon('trash')}</button>
      </div>`;
  }

  function field(name, label, inputHtml, hint = '') {
    return `
      <div class="field">
        <label for="f-${name}">${label}${hint ? ` <span class="hint">${hint}</span>` : ''}</label>
        ${inputHtml}
        <span class="error" data-error="${name}"></span>
      </div>`;
  }

  function render(p, countries) {
    const isEdit = Boolean(p.id);
    const allCountries = [...new Set([...COUNTRIES, ...countries])].sort();
    const slots = p.slots?.length ? p.slots : [''];

    view.innerHTML = `
      <a class="btn btn-text" href="#projects" style="padding-left:0">${icon('back', 'icon icon-sm')} Project bank</a>
      <p class="eyebrow" style="margin-top:var(--s4)">IR team</p>
      <h1 class="headline">${isEdit ? 'Edit' : 'Add a'} <mark>project</mark></h1>

      <form class="form" id="project-form" novalidate>
        <section class="form-section">
          <h2>Product</h2>
          <div class="field">
            <span class="label" id="product-label">Product</span>
            <div class="segmented" role="radiogroup" aria-labelledby="product-label" id="f-product">
              ${Object.entries(PRODUCTS).map(([key, label]) => `
                <button type="button" role="radio" data-value="${key}" aria-checked="${p.product === key}">${esc(label)}</button>`).join('')}
            </div>
            <span class="error" data-error="product"></span>
          </div>
          ${field('name', 'Project name', `<input class="input" id="f-name" name="name" maxlength="160" value="${esc(p.name)}" required>`)}
          ${field('sdg', 'SDG', `
            <select class="select" id="f-sdg" name="sdg">
              <option value="">Not set</option>
              ${SDGS.map((s, i) => `<option value="${i + 1}"${Number(p.sdg) === i + 1 ? ' selected' : ''}>SDG ${i + 1} ${esc(s)}</option>`).join('')}
            </select>`)}
        </section>

        <section class="form-section">
          <h2>Where</h2>
          ${field('country', 'Country', `
            <input class="input" id="f-country" name="country" list="country-list" maxlength="80" value="${esc(p.country)}" required>
            <datalist id="country-list">${allCountries.map((c) => `<option value="${esc(c)}">`).join('')}</datalist>`)}
          <div class="grid-2">
            ${field('host_lc', 'Host LC', `<input class="input" id="f-host_lc" name="host_lc" maxlength="120" placeholder="AIESEC in Delhi" value="${esc(p.host_lc)}" required>`)}
            ${field('city', 'City', `<input class="input" id="f-city" name="city" maxlength="80" value="${esc(p.city)}">`, '(optional)')}
          </div>
        </section>

        <section class="form-section">
          <h2>When</h2>
          ${field('duration_weeks', 'Duration in weeks', `<input class="input num" id="f-duration_weeks" name="duration_weeks" type="number" min="1" max="52" value="${esc(p.duration_weeks)}" style="max-width:160px" required>`)}
          <div class="field">
            <span class="label">Start dates</span>
            <span class="hint">CR searches by the month a project starts. Add every start date this project has.</span>
            <div class="slot-list" id="slot-list">${slots.map(slotRow).join('')}</div>
            <span class="error" data-error="slots"></span>
            <div><button type="button" class="btn btn-ghost" id="add-slot">${icon('plus', 'icon icon-sm')} Add another start date</button></div>
          </div>
        </section>

        <section class="form-section">
          <h2>Links</h2>
          ${field('project_link', 'Project link', `<input class="input" id="f-project_link" name="project_link" type="url" maxlength="500" placeholder="https://aiesec.org/opportunity/..." value="${esc(p.project_link)}" required>`)}
          ${field('booklet_link', 'Booklet link', `<input class="input" id="f-booklet_link" name="booklet_link" type="url" maxlength="500" value="${esc(p.booklet_link)}">`, '(optional)')}
        </section>

        <section class="form-section">
          <h2>Details</h2>
          ${field('covered', "What's covered", `<input class="input" id="f-covered" name="covered" maxlength="255" placeholder="Accommodation, 2 meals a day" value="${esc(p.covered)}">`, '(optional)')}
          ${field('language', 'Language', `<input class="input" id="f-language" name="language" maxlength="120" placeholder="English" value="${esc(p.language)}">`, '(optional)')}
          ${field('notes', 'Notes for CR', `<textarea class="input" id="f-notes" name="notes" maxlength="2000">${esc(p.notes)}</textarea>`, '(optional)')}
          ${field('added_by', 'Added by', `<input class="input" id="f-added_by" name="added_by" maxlength="80" value="${esc(p.added_by)}" style="max-width:340px">`, '(optional)')}
        </section>

        <div class="form-actions">
          <button class="btn btn-primary" type="submit">${isEdit ? 'Save changes' : 'Add project'}</button>
          <a class="btn btn-ghost" href="#projects">Cancel</a>
        </div>
      </form>`;

    bind();
  }

  function bind() {
    const form = document.getElementById('project-form');
    const slotList = document.getElementById('slot-list');

    document.getElementById('f-product').addEventListener('click', (e) => {
      const btn = e.target.closest('[data-value]');
      if (!btn) return;
      document.querySelectorAll('#f-product [data-value]').forEach((b) => b.setAttribute('aria-checked', String(b === btn)));
    });

    document.getElementById('add-slot').addEventListener('click', () => {
      slotList.insertAdjacentHTML('beforeend', slotRow());
      slotList.lastElementChild.querySelector('input').focus();
    });

    slotList.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-remove-slot]');
      if (!btn) return;
      if (slotList.children.length === 1) {
        slotList.querySelector('input').value = '';
        return;
      }
      btn.closest('.slot-row').remove();
    });

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      save(form);
    });
  }

  function readForm(form) {
    const val = (name) => form.elements[name].value;
    return {
      product: document.querySelector('#f-product [aria-checked="true"]')?.dataset.value || '',
      name: val('name'),
      sdg: val('sdg'),
      country: val('country'),
      host_lc: val('host_lc'),
      city: val('city'),
      duration_weeks: Number(val('duration_weeks')),
      slots: [...form.querySelectorAll('input[name="slot"]')].map((i) => i.value).filter(Boolean),
      project_link: val('project_link'),
      booklet_link: val('booklet_link'),
      covered: val('covered'),
      language: val('language'),
      notes: val('notes'),
      added_by: val('added_by'),
    };
  }

  function showErrors(form, fields) {
    form.querySelectorAll('[data-error]').forEach((s) => { s.textContent = ''; });
    form.querySelectorAll('[aria-invalid]').forEach((i) => i.removeAttribute('aria-invalid'));
    let first = null;
    Object.entries(fields).forEach(([name, msg]) => {
      const slot = form.querySelector(`[data-error="${name}"]`);
      if (slot) slot.textContent = msg;
      const input = name === 'slots' ? form.querySelector('input[name="slot"]') : document.getElementById(`f-${name}`);
      if (input) {
        input.setAttribute('aria-invalid', 'true');
        first = first || input;
      }
    });
    if (first) {
      first.scrollIntoView({ behavior: 'smooth', block: 'center' });
      first.focus({ preventScroll: true });
    }
  }

  async function save(form) {
    const btn = form.querySelector('button[type="submit"]');
    const label = btn.textContent;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" aria-hidden="true"></span> Saving';
    try {
      const body = readForm(form);
      if (editingId) await api(`/api/ir/projects/${editingId}`, { method: 'PUT', body });
      else await api('/api/ir/projects', { method: 'POST', body });
      toast(editingId ? 'Changes saved' : 'Project added. CR can find it now.');
      location.hash = 'projects';
    } catch (err) {
      if (err.status === 401) return window.IR.showLogin();
      showErrors(form, err.fields || {});
      toast(err.message, { error: true });
      btn.disabled = false;
      btn.textContent = label;
    }
  }

  async function show(id) {
    editingId = id || null;
    view.innerHTML = '<p class="table-empty"><span class="spinner" style="display:inline-block;width:18px;height:18px"></span></p>';
    try {
      const { projects } = await api('/api/ir/projects');
      const countries = projects.map((p) => p.country);
      if (!editingId) return render({ product: 'on_the_map' }, countries);

      const project = projects.find((p) => p.id === editingId);
      if (!project) {
        toast('That project no longer exists.', { error: true });
        location.hash = 'projects';
        return;
      }
      if (!project.can_edit) {
        toast('Demo access can only edit projects it added.', { error: true });
        location.hash = 'projects';
        return;
      }
      render(project, countries);
    } catch (err) {
      if (err.status === 401) return window.IR.showLogin();
      toast(err.message, { error: true });
    }
  }

  function hide() {
    view.innerHTML = '';
    editingId = null;
  }

  window.IRForm = { show, hide };
})();
