// Routes the CR team uses. No sign-in needed.
const express = require('express');
const { pool } = require('../db');
const { PRODUCTS, validateRequest, isMonth, monthRange } = require('../validate');

const router = express.Router();

// Shared WHERE clause: open projects with a start date today or later.
// Demo-login projects are included and tagged "Demo" in the results.
const visible = 'p.is_closed = 0 AND s.start_date >= CURDATE()';

// Filter options, so CR only ever sees choices that have results.
// GET /api/options?product=on_the_map&country=India
router.get('/options', async (req, res, next) => {
  try {
    const product = PRODUCTS.includes(req.query.product) ? req.query.product : 'on_the_map';
    const country = typeof req.query.country === 'string' ? req.query.country.trim() : '';

    const [productRows] = await pool.query(
      `SELECT p.product, COUNT(DISTINCT p.id) AS count
         FROM projects p JOIN project_slots s ON s.project_id = p.id
        WHERE ${visible}
        GROUP BY p.product`
    );

    const [countryRows] = await pool.query(
      `SELECT p.country AS name, COUNT(DISTINCT p.id) AS count
         FROM projects p JOIN project_slots s ON s.project_id = p.id
        WHERE ${visible} AND p.product = ?
        GROUP BY p.country ORDER BY p.country`,
      [product]
    );

    const monthParams = [product];
    let countryClause = '';
    if (country) {
      countryClause = 'AND p.country = ?';
      monthParams.push(country);
    }
    const [monthRows] = await pool.query(
      `SELECT DATE_FORMAT(s.start_date, '%Y-%m') AS value, COUNT(DISTINCT p.id) AS count
         FROM projects p JOIN project_slots s ON s.project_id = p.id
        WHERE ${visible} AND p.product = ? ${countryClause}
        GROUP BY value ORDER BY value`,
      monthParams
    );

    // Fields (e.g. "Computer sciences") are offered for Skill Up only.
    let fieldRows = [];
    if (product === 'skill_up') {
      [fieldRows] = await pool.query(
        `SELECT f.field AS name, COUNT(DISTINCT p.id) AS count
           FROM projects p
           JOIN project_slots s ON s.project_id = p.id
           JOIN project_fields f ON f.project_id = p.id
          WHERE ${visible} AND p.product = ? ${countryClause}
          GROUP BY f.field ORDER BY f.field`,
        monthParams
      );
    }

    const products = Object.fromEntries(PRODUCTS.map((p) => [p, 0]));
    productRows.forEach((r) => { products[r.product] = Number(r.count); });

    res.json({
      products,
      countries: countryRows.map((r) => ({ name: r.name, count: Number(r.count) })),
      months: monthRows.map((r) => ({ value: r.value, count: Number(r.count) })),
      fields: fieldRows.map((r) => ({ name: r.name, count: Number(r.count) })),
    });
  } catch (err) {
    next(err);
  }
});

// Headline numbers for the CR page: live projects, countries, next start date.
// GET /api/summary
router.get('/summary', async (_req, res, next) => {
  try {
    const [[row]] = await pool.query(
      `SELECT COUNT(DISTINCT p.id) AS projects, MIN(s.start_date) AS next_start
         FROM projects p JOIN project_slots s ON s.project_id = p.id
        WHERE ${visible}`
    );
    const [countryRows] = await pool.query(
      `SELECT DISTINCT p.country FROM projects p JOIN project_slots s ON s.project_id = p.id
        WHERE ${visible} ORDER BY p.country`
    );
    res.json({
      projects: Number(row.projects),
      countries: countryRows.map((r) => r.country),
      next_start: row.next_start,
    });
  } catch (err) {
    next(err);
  }
});

// Search. GET /api/projects?product=skill_up&country=India&month=2027-07&field=Computer%20sciences
router.get('/projects', async (req, res, next) => {
  try {
    const { product, country, month, sdg, field } = req.query;
    if (!PRODUCTS.includes(product)) return res.status(400).json({ error: 'Pick a product.' });

    const where = [visible, 'p.product = ?'];
    const params = [product];
    if (country) { where.push('p.country = ?'); params.push(String(country)); }
    if (month) {
      if (!isMonth(month)) return res.status(400).json({ error: 'Month is not valid.' });
      const [from, to] = monthRange(month);
      where.push('s.start_date >= ? AND s.start_date < ?');
      params.push(from, to);
    }
    if (sdg) { where.push('p.sdg = ?'); params.push(Number(sdg)); }
    if (field) {
      where.push('EXISTS (SELECT 1 FROM project_fields f WHERE f.project_id = p.id AND f.field = ?)');
      params.push(String(field));
    }

    // One row per matching start date.
    const [rows] = await pool.query(
      `SELECT p.id, p.product, p.name, p.sdg, p.country, p.host_lc, p.city, p.duration_weeks,
              p.project_link, p.booklet_link, p.covered, p.language, p.notes, p.last_checked,
              p.demo_session IS NOT NULL AS is_demo, s.start_date
         FROM projects p JOIN project_slots s ON s.project_id = p.id
        WHERE ${where.join(' AND ')}
        ORDER BY s.start_date, p.name`,
      params
    );

    // Group into projects, keeping the matching dates in order.
    const byId = new Map();
    for (const row of rows) {
      if (!byId.has(row.id)) {
        const { start_date, ...project } = row;
        byId.set(row.id, { ...project, is_demo: Boolean(row.is_demo), matched_dates: [], all_dates: [], fields: [] });
      }
      byId.get(row.id).matched_dates.push(row.start_date);
    }

    // Also send every upcoming date, so the detail panel can show the full list.
    const ids = [...byId.keys()];
    if (ids.length) {
      const [slotRows] = await pool.query(
        `SELECT project_id, start_date FROM project_slots
          WHERE project_id IN (?) AND start_date >= CURDATE() ORDER BY start_date`,
        [ids]
      );
      slotRows.forEach((s) => byId.get(s.project_id).all_dates.push(s.start_date));
      const [fieldRows] = await pool.query(
        'SELECT project_id, field FROM project_fields WHERE project_id IN (?) ORDER BY field',
        [ids]
      );
      fieldRows.forEach((f) => byId.get(f.project_id).fields.push(f.field));
    }

    res.json({ projects: [...byId.values()] });
  } catch (err) {
    next(err);
  }
});

// CR asks IR to find a project when a search comes up empty.
router.post('/requests', async (req, res, next) => {
  try {
    const { errors, data } = validateRequest(req.body);
    if (Object.keys(errors).length) return res.status(400).json({ error: 'Check the highlighted fields.', fields: errors });
    await pool.query(
      `INSERT INTO project_requests (product, country, month, ep_count, requested_by, note, demo_session)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [data.product, data.country, data.month, data.ep_count, data.requested_by, data.note, req.demoSid]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// Who am I? Used by the pages to show the right controls.
router.get('/session', (req, res) => {
  res.json({ role: req.session?.role || null });
});

module.exports = router;
