// Dotted-continent Earth, centred on the border between the dark area and the grey panel.
// Left half fades out before the headline; right half shows faintly behind the panel.
// Pins mark every country with live projects. Canvas + orthographic projection, no libraries.
(function () {
  const canvas = document.getElementById('globe');
  const panel = document.getElementById('panel');
  if (!canvas || !panel) return;
  const ctx = canvas.getContext('2d');

  // Approximate centre (lat, lon) of countries AIESEC Global Volunteer runs in.
  const CENTROIDS = {
    'Algeria': [28, 2], 'Argentina': [-34, -64], 'Armenia': [40.1, 45], 'Australia': [-25, 134],
    'Azerbaijan': [40.3, 47.6], 'Bahrain': [26, 50.5], 'Bangladesh': [24, 90], 'Belgium': [50.8, 4.5],
    'Benin': [9.3, 2.3], 'Bolivia': [-17, -65], 'Brazil': [-10, -55], 'Bulgaria': [42.7, 25.5],
    'Cambodia': [13, 105], 'Cameroon': [6, 12], 'Canada': [56, -106], 'Chile': [-30, -71],
    'China': [35, 103], 'Colombia': [4, -72], 'Costa Rica': [10, -84], "Cote d'Ivoire": [7.5, -5.5],
    'Croatia': [45.1, 15.2], 'Czech Republic': [49.8, 15.5], 'Dominican Republic': [19, -70.7],
    'Ecuador': [-1.8, -78], 'Egypt': [27, 30], 'El Salvador': [13.8, -88.9], 'Ethiopia': [9, 39],
    'France': [46, 2], 'Georgia': [42, 43.5], 'Germany': [51, 10], 'Ghana': [8, -1.2], 'Greece': [39, 22],
    'Guatemala': [15.5, -90.3], 'Honduras': [15, -86.5], 'Hong Kong': [22.3, 114.2], 'Hungary': [47, 19.5],
    'India': [22, 79], 'Indonesia': [-2, 118], 'Italy': [42.8, 12.8], 'Japan': [36, 138], 'Jordan': [31, 36.5],
    'Kazakhstan': [48, 67], 'Kenya': [0.5, 38], 'Kyrgyzstan': [41, 75], 'Laos': [18, 105],
    'Lebanon': [33.9, 35.9], 'Madagascar': [-19, 47], 'Malaysia': [4, 102], 'Maldives': [3.2, 73.2],
    'Mauritius': [-20.3, 57.6], 'Mexico': [23, -102], 'Mongolia': [46.8, 103], 'Morocco': [32, -6],
    'Mozambique': [-18, 35], 'Myanmar': [21.9, 95.9], 'Nepal': [28, 84], 'Netherlands': [52.2, 5.3],
    'New Zealand': [-41, 174], 'Nicaragua': [13, -85], 'Nigeria': [9, 8], 'Oman': [21, 57],
    'Pakistan': [30, 70], 'Panama': [9, -80], 'Paraguay': [-23, -58], 'Peru': [-10, -76],
    'Philippines': [13, 122], 'Poland': [52, 19], 'Portugal': [39.5, -8], 'Romania': [46, 25],
    'Russia': [60, 90], 'Rwanda': [-2, 30], 'Senegal': [14, -14], 'Serbia': [44, 21],
    'Singapore': [1.35, 103.8], 'South Africa': [-29, 24], 'South Korea': [36, 128], 'Spain': [40, -4],
    'Sri Lanka': [7.8, 80.7], 'Taiwan': [23.7, 121], 'Tanzania': [-6, 35], 'Thailand': [15, 101],
    'Togo': [8.6, 0.8], 'Tunisia': [34, 9], 'Turkey': [39, 35], 'Uganda': [1.3, 32.3], 'Ukraine': [49, 32],
    'United Arab Emirates': [24, 54], 'United States': [39, -98], 'Uruguay': [-33, -56],
    'Uzbekistan': [41, 64], 'Venezuela': [7, -66], 'Vietnam': [16, 107], 'Zimbabwe': [-19, 30],
  };
  const ALIASES = {
    'turkiye': 'Turkey', 'türkiye': 'Turkey', 'viet nam': 'Vietnam', 'usa': 'United States',
    'uae': 'United Arab Emirates', 'korea': 'South Korea', "côte d'ivoire": "Cote d'Ivoire",
    'ivory coast': "Cote d'Ivoire", 'czechia': 'Czech Republic',
  };
  function lookup(name) {
    const key = String(name).trim().toLowerCase();
    const found = Object.keys(CENTROIDS).find((c) => c.toLowerCase() === key) || ALIASES[key];
    return found && CENTROIDS[found] ? { name: found, pos: CENTROIDS[found] } : null;
  }

  /* ---------- Land dots from the world map (TopoJSON) ---------- */

  // Turns the TopoJSON 'land' object into polygons of [lon, lat] rings.
  function decodeLand(topo) {
    const [sx, sy] = topo.transform.scale;
    const [tx, ty] = topo.transform.translate;
    const arcs = topo.arcs.map((arc) => {
      let x = 0;
      let y = 0;
      return arc.map(([dx, dy]) => { x += dx; y += dy; return [x * sx + tx, y * sy + ty]; });
    });
    const arcPoints = (i) => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
    const ring = (ids) => ids.flatMap((id, k) => (k ? arcPoints(id).slice(1) : arcPoints(id)));
    const polygons = [];
    const land = topo.objects.land;
    const geoms = land.type === 'GeometryCollection' ? land.geometries : [land];
    geoms.forEach((g) => {
      if (g.type === 'Polygon') polygons.push(g.arcs.map(ring));
      if (g.type === 'MultiPolygon') g.arcs.forEach((p) => polygons.push(p.map(ring)));
    });
    return polygons.map((rings) => {
      const outer = rings[0];
      const lons = outer.map((p) => p[0]);
      const lats = outer.map((p) => p[1]);
      return { rings, box: [Math.min(...lons), Math.min(...lats), Math.max(...lons), Math.max(...lats)] };
    });
  }

  function inRing(lon, lat, ring) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i];
      const [xj, yj] = ring[j];
      if ((yi > lat) !== (yj > lat) && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }

  function onLand(lon, lat, polygons) {
    for (const p of polygons) {
      const [x0, y0, x1, y1] = p.box;
      if (lon < x0 || lon > x1 || lat < y0 || lat > y1) continue;
      let inside = false;
      for (const r of p.rings) if (inRing(lon, lat, r)) inside = !inside; // holes flip it back
      if (inside) return true;
    }
    return false;
  }

  // Evenly spaced dots on the land (Antarctica left out for a cleaner look).
  function buildDots(polygons) {
    const STEP = 1.6;
    const out = [];
    for (let lat = -56; lat <= 78; lat += STEP) {
      const lonStep = STEP / Math.max(Math.cos((lat * Math.PI) / 180), 0.2);
      for (let lon = -180; lon < 180; lon += lonStep) {
        if (onLand(lon, lat, polygons)) out.push(lat, lon);
      }
    }
    return Float32Array.from(out);
  }

  /* ---------- Drawing ---------- */

  const css = getComputedStyle(document.documentElement);
  const v = (name) => css.getPropertyValue(name).trim();
  const DARK = { dot: v('--text-3'), rim: v('--line'), pin: v('--accent'), label: v('--text-2') };
  const LIGHT = { dot: v('--paper-text-2'), rim: v('--paper-3'), pin: v('--paper-text'), label: v('--paper-text') };
  const FONT = `600 11px ${v('--font')}`;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = window.matchMedia('(min-width: 1101px)');
  const RAD = Math.PI / 180;
  const TILT = 14 * RAD;                  // centre the view on the tropics, where most projects are
  const SPIN = (2 * Math.PI) / 90000;     // one turn every 90 seconds

  let dots = new Float32Array(0);
  let pins = [];
  let rotation = -80 * RAD;               // start with South Asia in view
  let last = performance.now();
  let W = 0;
  let H = 0;
  let dpr = 1;
  const PANEL_ALPHA = 0.6;               // how strongly the globe shows behind the grey panel
  let panelAlpha = PANEL_ALPHA;
  let panelTarget = PANEL_ALPHA;
  let running = false;

  function geometry() {
    const border = panel.getBoundingClientRect().left;
    const R = H * 0.47;
    return { cx: border, cy: H / 2, R, border };
  }

  // lat/lon -> screen point and depth (z > 0 faces the viewer).
  function project(lat, lon, g) {
    const phi = lat * RAD;
    const lam = lon * RAD + rotation;
    const cp = Math.cos(phi);
    const x = cp * Math.sin(lam);
    const y = Math.sin(phi);
    const z = cp * Math.cos(lam);
    const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
    const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
    return { x: g.cx + x * g.R, y: g.cy - y2 * g.R, z: z2 };
  }

  // alpha: overall strength (1 on the dark side, fainter behind the grey panel).
  function drawGlobe(g, theme, now, alpha = 1, labels = true) {
    // Rim
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = theme.rim;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(g.cx, g.cy, g.R, 0, Math.PI * 2);
    ctx.stroke();

    // Land dots, smaller and fainter towards the edge for depth
    ctx.fillStyle = theme.dot;
    for (let i = 0; i < dots.length; i += 2) {
      const p = project(dots[i], dots[i + 1], g);
      if (p.z <= 0) continue;
      const s = 1 + p.z * 1.8;
      ctx.globalAlpha = alpha * (0.25 + p.z * 0.75);
      ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }

    // Pins
    ctx.font = FONT;
    pins.forEach((pin, i) => {
      const p = project(pin.pos[0], pin.pos[1], g);
      if (p.z <= 0.05) return;
      const fade = alpha * Math.min(1, p.z * 3);
      const phase = (now / 2400 + i * 0.37) % 1;
      ctx.globalAlpha = fade * (1 - phase);
      ctx.strokeStyle = theme.pin;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5 + phase * 18, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = fade;
      ctx.fillStyle = theme.pin;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fill();
      if (!labels) return;
      // Label towards the globe's centre so it stays on the globe.
      const right = p.x > g.cx;
      ctx.textAlign = right ? 'right' : 'left';
      ctx.fillStyle = theme.label;
      ctx.fillText(pin.name.toUpperCase(), p.x + (right ? -12 : 12), p.y + 4);
      ctx.fillStyle = theme.dot;
    });
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    if (!W) return;
    const g = geometry();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);

    // Dark side, fading out towards the headline
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, g.border, H);
    ctx.clip();
    drawGlobe(g, DARK, now);
    ctx.globalCompositeOperation = 'destination-in';
    const fade = ctx.createLinearGradient(g.cx - g.R, 0, g.cx - g.R * 0.2, 0);
    fade.addColorStop(0, 'rgba(0,0,0,0)');
    fade.addColorStop(1, 'rgba(0,0,0,1)');
    ctx.fillStyle = fade;
    ctx.fillRect(0, 0, g.border, H);
    ctx.restore();

    // Grey panel side, faint
    if (panelAlpha > 0.01) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(g.border, 0, W - g.border, H);
      ctx.clip();
      // No labels here: they would collide with the panel's numbers.
      drawGlobe(g, LIGHT, now, panelAlpha, false);
      ctx.restore();
    }
  }

  function frame(now) {
    if (!running) return;
    const dt = now - last;
    last = now;
    if (!reduced) rotation += dt * SPIN;
    panelAlpha += (panelTarget - panelAlpha) * Math.min(1, dt / 200);
    draw(now);
    requestAnimationFrame(frame);
  }

  function resize() {
    W = window.innerWidth;
    H = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    draw(performance.now());
  }

  function start() {
    if (running || !desktop.matches) return;
    running = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }
  function stop() { running = false; }

  window.addEventListener('resize', resize);
  desktop.addEventListener('change', () => (desktop.matches ? start() : stop()));

  // From search.js: live countries, and whether a project is open in the panel.
  window.addEventListener('ogv:summary', (e) => {
    pins = (e.detail.countries || []).map(lookup).filter(Boolean);
    canvas.setAttribute('aria-label', pins.length ? `Globe showing projects in ${pins.map((p) => p.name).join(', ')}` : 'Globe');
    draw(performance.now());
  });
  window.addEventListener('ogv:panel', (e) => { panelTarget = e.detail.open ? 0 : PANEL_ALPHA; });

  fetch('/data/land-110m.json')
    .then((r) => r.json())
    .then((topo) => {
      dots = buildDots(decodeLand(topo));
      draw(performance.now());
    })
    .catch(() => { /* globe still shows its rim and pins */ });

  resize();
  start();
})();
