// Routes the IR team uses. Everything except sign-in needs a session.
// Demo login can view everything, but only change projects/requests it added itself.
const express = require('express');
const { query, transaction } = require('../db');
const { validateProject } = require('../validate');
const { signIn, signOut, requireIR, passwordMatches } = require('../auth');

const router = express.Router();

const today = () => new Date().toISOString().slice(0, 10);

// Can this session change this row?
const canEdit = (session, row) =>
  session.role === 'ir' || (session.role === 'demo' && row.demo_session === session.sid);

/* ---------- Sign in ---------- */

router.post('/login', (req, res) => {
  if (!passwordMatches(req.body?.password)) {
    return res.status(401).json({ error: 'That password is not right. Ask your IR manager.' });
  }
  signIn(res, 'ir');
  res.json({ role: 'ir' });
});

router.post('/demo', (_req, res) => {
  signIn(res, 'demo');
  res.json({ role: 'demo' });
});

router.post('/logout', (_req, res) => {
  signOut(res);
  res.json({ ok: true });
});

router.use(requireIR);

/* ---------- Helpers ---------- */

async function loadProject(id) {
  const { rows: [project] } = await query('SELECT * FROM projects WHERE id = ?', [id]);
  if (!project) return null;
  const { rows: slots } = await query(
    'SELECT start_date FROM project_slots WHERE project_id = ? ORDER BY start_date',
    [id]
  );
  project.slots = slots.map((s) => s.start_date);
  const { rows: fields } = await query('SELECT field FROM project_fields WHERE project_id = ? ORDER BY field', [id]);
  project.fields = fields.map((f) => f.field);
  return project;
}

function toClient(project, session) {
  const { demo_session, ...rest } = project;
  return {
    ...rest,
    is_closed: Boolean(project.is_closed),
    is_demo: demo_session !== null,
    can_edit: canEdit(session, project),
  };
}

async function saveSlots(q, projectId, slots) {
  await q('DELETE FROM project_slots WHERE project_id = ?', [projectId]);
  if (slots.length) {
    await q('INSERT INTO project_slots (project_id, start_date) VALUES ?', [
      slots.map((d) => [projectId, d]),
    ]);
  }
}

async function saveFields(q, projectId, fields) {
  await q('DELETE FROM project_fields WHERE project_id = ?', [projectId]);
  if (fields.length) {
    await q('INSERT INTO project_fields (project_id, field) VALUES ?', [
      fields.map((f) => [projectId, f]),
    ]);
  }
}

// Loads the project and checks the session may change it.
async function editable(req, res) {
  const project = await loadProject(Number(req.params.id));
  if (!project) {
    res.status(404).json({ error: 'Project not found.' });
    return null;
  }
  if (!canEdit(req.session, project)) {
    res.status(403).json({ error: 'Demo login can only change projects it added.' });
    return null;
  }
  return project;
}

/* ---------- Dashboard numbers ---------- */

router.get('/stats', async (_req, res, next) => {
  try {
    const { rows: [row] } = await query(
      `SELECT
         (SELECT COUNT(*) FROM projects WHERE is_closed = 0) AS open_projects,
         (SELECT COUNT(DISTINCT p.id) FROM projects p JOIN project_slots s ON s.project_id = p.id
           WHERE p.is_closed = 0 AND s.start_date >= CURRENT_DATE
             AND s.start_date < CURRENT_DATE + 30) AS starting_soon,
         (SELECT COUNT(*) FROM project_requests WHERE status = 'open') AS open_requests,
         (SELECT COUNT(*) FROM projects WHERE is_closed = 0
           AND last_checked < CURRENT_DATE - 30) AS needs_check`
    );
    const { rows: byProduct } = await query(
      'SELECT product, COUNT(*) AS count FROM projects WHERE is_closed = 0 GROUP BY product'
    );
    res.json({
      open_projects: Number(row.open_projects),
      starting_soon: Number(row.starting_soon),
      open_requests: Number(row.open_requests),
      needs_check: Number(row.needs_check),
      by_product: Object.fromEntries(byProduct.map((r) => [r.product, Number(r.count)])),
    });
  } catch (err) {
    next(err);
  }
});

/* ---------- Projects ---------- */

router.get('/projects', async (req, res, next) => {
  try {
    const { rows: projects } = await query('SELECT * FROM projects ORDER BY is_closed, updated_at DESC');
    const { rows: slots } = await query('SELECT project_id, start_date FROM project_slots ORDER BY start_date');
    const byProject = new Map();
    slots.forEach((s) => {
      if (!byProject.has(s.project_id)) byProject.set(s.project_id, []);
      byProject.get(s.project_id).push(s.start_date);
    });
    const { rows: fieldRows } = await query('SELECT project_id, field FROM project_fields ORDER BY field');
    const fieldsOf = new Map();
    fieldRows.forEach((f) => {
      if (!fieldsOf.has(f.project_id)) fieldsOf.set(f.project_id, []);
      fieldsOf.get(f.project_id).push(f.field);
    });
    const now = today();
    res.json({
      projects: projects.map((p) => {
        const all = byProject.get(p.id) || [];
        return {
          ...toClient(p, req.session),
          slots: all,
          fields: fieldsOf.get(p.id) || [],
          next_start: all.find((d) => d >= now) || null,
        };
      }),
    });
  } catch (err) {
    next(err);
  }
});

router.get('/projects/:id', async (req, res, next) => {
  try {
    const project = await loadProject(Number(req.params.id));
    if (!project) return res.status(404).json({ error: 'Project not found.' });
    res.json({ project: toClient(project, req.session) });
  } catch (err) {
    next(err);
  }
});

router.post('/projects', async (req, res, next) => {
  const { errors, data } = validateProject(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });

  try {
    const id = await transaction(async (q) => {
      const { rows: [created] } = await q(
        `INSERT INTO projects
          (product, name, sdg, country, host_lc, city, duration_weeks, project_link, booklet_link,
           covered, language, notes, added_by, last_checked, demo_session)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         RETURNING id`,
        [data.product, data.name, data.sdg, data.country, data.host_lc, data.city, data.duration_weeks,
          data.project_link, data.booklet_link, data.covered, data.language, data.notes, data.added_by,
          today(), req.demoSid]
      );
      await saveSlots(q, created.id, data.slots);
      await saveFields(q, created.id, data.fields);
      return created.id;
    });
    const project = await loadProject(id);
    res.status(201).json({ project: toClient(project, req.session) });
  } catch (err) {
    next(err);
  }
});

router.put('/projects/:id', async (req, res, next) => {
  const { errors, data } = validateProject(req.body);
  if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });

  try {
    const existing = await editable(req, res);
    if (!existing) return;
    await transaction(async (q) => {
      await q(
        `UPDATE projects SET product = ?, name = ?, sdg = ?, country = ?, host_lc = ?, city = ?,
           duration_weeks = ?, project_link = ?, booklet_link = ?, covered = ?, language = ?,
           notes = ?, added_by = ?, last_checked = ?, updated_at = CURRENT_TIMESTAMP
         WHERE id = ?`,
        [data.product, data.name, data.sdg, data.country, data.host_lc, data.city, data.duration_weeks,
          data.project_link, data.booklet_link, data.covered, data.language, data.notes, data.added_by,
          today(), existing.id]
      );
      await saveSlots(q, existing.id, data.slots);
      await saveFields(q, existing.id, data.fields);
    });
    const project = await loadProject(existing.id);
    res.json({ project: toClient(project, req.session) });
  } catch (err) {
    next(err);
  }
});

// IR confirms the project is still open and correct.
router.post('/projects/:id/checked', async (req, res, next) => {
  try {
    const project = await editable(req, res);
    if (!project) return;
    await query('UPDATE projects SET last_checked = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [today(), project.id]);
    res.json({ ok: true, last_checked: today() });
  } catch (err) {
    next(err);
  }
});

// Close (hide from CR) or reopen a project.
router.post('/projects/:id/closed', async (req, res, next) => {
  try {
    const project = await editable(req, res);
    if (!project) return;
    const closed = Boolean(req.body?.closed);
    await query('UPDATE projects SET is_closed = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [closed ? 1 : 0, project.id]);
    res.json({ ok: true, is_closed: closed });
  } catch (err) {
    next(err);
  }
});

router.delete('/projects/:id', async (req, res, next) => {
  try {
    const project = await editable(req, res);
    if (!project) return;
    await query('DELETE FROM projects WHERE id = ?', [project.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

/* ---------- Requests from CR ---------- */

router.get('/requests', async (req, res, next) => {
  try {
    const { rows } = await query(
      "SELECT * FROM project_requests ORDER BY status = 'found', created_at DESC"
    );
    res.json({ requests: rows.map((r) => toClient(r, req.session)) });
  } catch (err) {
    next(err);
  }
});

router.post('/requests/:id/status', async (req, res, next) => {
  try {
    const { rows: [row] } = await query('SELECT * FROM project_requests WHERE id = ?', [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Request not found.' });
    if (!canEdit(req.session, row)) return res.status(403).json({ error: 'Demo login can only change requests it added.' });
    const status = req.body?.status === 'found' ? 'found' : 'open';
    await query('UPDATE project_requests SET status = ? WHERE id = ?', [status, row.id]);
    res.json({ ok: true, status });
  } catch (err) {
    next(err);
  }
});

router.delete('/requests/:id', async (req, res, next) => {
  try {
    const { rows: [row] } = await query('SELECT * FROM project_requests WHERE id = ?', [Number(req.params.id)]);
    if (!row) return res.status(404).json({ error: 'Request not found.' });
    if (!canEdit(req.session, row)) return res.status(403).json({ error: 'Demo login can only change requests it added.' });
    await query('DELETE FROM project_requests WHERE id = ?', [row.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
