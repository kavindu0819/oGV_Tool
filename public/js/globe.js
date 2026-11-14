// Spinning wireframe globe with a pin for every country that has live projects.
// Drawn on a <canvas> with an orthographic projection; no libraries.
(function () {
  const canvas = document.getElementById('globe');
  if (!canvas) return;
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
  const lookup = (name) => {
    const key = String(name).trim();
    const found = Object.keys(CENTROIDS).find((c) => c.toLowerCase() === key.toLowerCase());
    const alias = ALIASES[key.toLowerCase()];
    return CENTROIDS[found || alias] ? { name: found || alias, pos: CENTROIDS[found || alias] } : null;
  };

  const css = getComputedStyle(document.documentElement);
  const color = (v) => css.getPropertyValue(v).trim();
  const C = { line: color('--line-strong'), faint: color('--line'), accent: color('--accent'), text: color('--text-2') };

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const TILT = (-18 * Math.PI) / 180;   // lean the north pole towards the viewer
  const SPIN = (2 * Math.PI) / 50000;   // one turn every 50 seconds
  const RAD = Math.PI / 180;

  let pins = [];
  let size = 0;
  let dpr = 1;
  let rotation = -80 * RAD;            // start with South Asia facing the viewer
  let last = performance.now();

  // lat/lon (degrees) -> screen x, y and depth z (z > 0 is the front).
  function project(lat, lon) {
    const phi = lat * RAD;
    const lam = lon * RAD + rotation;
    const x = Math.cos(phi) * Math.sin(lam);
    const y = Math.sin(phi);
    const z = Math.cos(phi) * Math.cos(lam);
    const y2 = y * Math.cos(TILT) - z * Math.sin(TILT);
    const z2 = y * Math.sin(TILT) + z * Math.cos(TILT);
    const r = size * 0.44;
    return { x: size / 2 + x * r, y: size / 2 - y2 * r, z: z2 };
  }

  // Draws a line of points, front segments solid, back segments faint.
  function polyline(points) {
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1];
      const b = points[i];
      const front = a.z > 0 && b.z > 0;
      ctx.strokeStyle = front ? C.line : C.faint;
      ctx.globalAlpha = front ? 0.9 : 0.35;
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function draw(now) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.lineWidth = 1;

    // Outline
    ctx.strokeStyle = C.line;
    ctx.beginPath();
    ctx.arc(size / 2, size / 2, size * 0.44, 0, Math.PI * 2);
    ctx.stroke();

    // Meridians every 20 degrees
    for (let lon = -180; lon < 180; lon += 20) {
      const pts = [];
      for (let lat = -90; lat <= 90; lat += 5) pts.push(project(lat, lon));
      polyline(pts);
    }
    // Parallels every 20 degrees
    for (let lat = -60; lat <= 60; lat += 20) {
      const pts = [];
      for (let lon = -180; lon <= 180; lon += 5) pts.push(project(lat, lon));
      polyline(pts);
    }

    // Pins, back to front so nearer ones sit on top
    const placed = pins.map((p, i) => ({ ...p, i, at: project(p.pos[0], p.pos[1]) }))
      .filter((p) => p.at.z > 0.05)
      .sort((a, b) => a.at.z - b.at.z);

    ctx.font = `600 11px ${color('--font')}`;
    for (const p of placed) {
      const fade = Math.min(1, p.at.z * 3);   // fade in near the edge
      const phase = ((now / 2400) + p.i * 0.37) % 1;

      ctx.globalAlpha = fade * (1 - phase);
      ctx.strokeStyle = C.accent;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(p.at.x, p.at.y, 4 + phase * 14, 0, Math.PI * 2);
      ctx.stroke();

      ctx.globalAlpha = fade;
      ctx.fillStyle = C.accent;
      ctx.beginPath();
      ctx.arc(p.at.x, p.at.y, 4, 0, Math.PI * 2);
      ctx.fill();

      // Label on the inner side so it never runs off the canvas.
      const right = p.at.x > size / 2;
      ctx.textAlign = right ? 'right' : 'left';
      ctx.fillStyle = C.text;
      ctx.fillText(p.name.toUpperCase(), p.at.x + (right ? -10 : 10), p.at.y + 4);
    }
    ctx.globalAlpha = 1;
  }

  function frame(now) {
    rotation += (now - last) * SPIN;
    last = now;
    draw(now);
    requestAnimationFrame(frame);
  }

  function resize() {
    const box = canvas.getBoundingClientRect();
    if (!box.width) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    size = box.width;
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);
    draw(performance.now());
  }

  new ResizeObserver(resize).observe(canvas);

  window.addEventListener('ogv:summary', (e) => {
    pins = (e.detail.countries || []).map(lookup).filter(Boolean);
    const label = pins.length ? `Globe showing projects in ${pins.map((p) => p.name).join(', ')}` : 'Globe';
    canvas.setAttribute('aria-label', label);
    draw(performance.now());
  });

  if (!reduced) requestAnimationFrame(frame);
})();
