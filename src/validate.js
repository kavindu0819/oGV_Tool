// Input validation shared by the API routes.

const PRODUCTS = ['on_the_map', 'global_classroom', 'skill_up'];

const isDate = (v) => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
};

const isMonth = (v) => typeof v === 'string' && /^\d{4}-(0[1-9]|1[0-2])$/.test(v);

const isUrl = (v) => {
  try {
    const u = new URL(v);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
};

const text = (v, max) => {
  if (v === undefined || v === null) return '';
  return String(v).trim().slice(0, max);
};

// Returns { errors, data }. errors is { field: message }.
function validateProject(body = {}) {
  const errors = {};
  const data = {
    product: text(body.product, 30),
    name: text(body.name, 160),
    sdg: body.sdg === '' || body.sdg === null || body.sdg === undefined ? null : Number(body.sdg),
    country: text(body.country, 80),
    host_lc: text(body.host_lc, 120),
    city: text(body.city, 80) || null,
    duration_weeks: Number(body.duration_weeks),
    project_link: text(body.project_link, 500),
    booklet_link: text(body.booklet_link, 500) || null,
    covered: text(body.covered, 255) || null,
    language: text(body.language, 120) || null,
    notes: text(body.notes, 2000) || null,
    added_by: text(body.added_by, 80) || null,
  };

  if (!PRODUCTS.includes(data.product)) errors.product = 'Pick a product.';
  if (!data.name) errors.name = 'Add the project name.';
  if (data.sdg !== null && !(Number.isInteger(data.sdg) && data.sdg >= 1 && data.sdg <= 17)) {
    errors.sdg = 'SDG must be 1 to 17.';
  }
  if (!data.country) errors.country = 'Add the country.';
  if (!data.host_lc) errors.host_lc = 'Add the host LC, e.g. AIESEC in Delhi.';
  if (!(Number.isInteger(data.duration_weeks) && data.duration_weeks >= 1 && data.duration_weeks <= 52)) {
    errors.duration_weeks = 'Duration must be 1 to 52 weeks.';
  }
  if (!isUrl(data.project_link)) errors.project_link = 'Paste the full project link (starts with https://).';
  if (data.booklet_link && !isUrl(data.booklet_link)) errors.booklet_link = 'Paste the full booklet link.';

  const rawSlots = Array.isArray(body.slots) ? body.slots : [];
  const slots = [...new Set(rawSlots.map((s) => text(s, 10)).filter(Boolean))].sort();
  if (slots.length === 0) errors.slots = 'Add at least one start date.';
  else if (slots.length > 24) errors.slots = 'Up to 24 start dates per project.';
  else if (!slots.every(isDate)) errors.slots = 'One of the start dates is not a valid date.';
  data.slots = slots;

  return { errors, data };
}

function validateRequest(body = {}) {
  const errors = {};
  const data = {
    product: text(body.product, 30),
    country: text(body.country, 80) || null,
    month: text(body.month, 7) || null,
    ep_count: Number(body.ep_count || 1),
    requested_by: text(body.requested_by, 80),
    note: text(body.note, 500) || null,
  };
  if (!PRODUCTS.includes(data.product)) errors.product = 'Pick a product.';
  if (data.month && !isMonth(data.month)) errors.month = 'Month is not valid.';
  if (!(Number.isInteger(data.ep_count) && data.ep_count >= 1 && data.ep_count <= 99)) {
    errors.ep_count = 'Number of EPs must be 1 to 99.';
  }
  if (!data.requested_by) errors.requested_by = 'Add your name so IR can follow up.';
  return { errors, data };
}

// '2027-07' -> ['2027-07-01', '2027-08-01']
function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`;
  return [`${month}-01`, `${next}-01`];
}

module.exports = { PRODUCTS, validateProject, validateRequest, isMonth, monthRange };
