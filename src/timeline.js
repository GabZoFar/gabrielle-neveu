// Scrubbable history: a fixed playhead over a strip of days (or months).
// Versions, posts and edits from #history-data show up as bars.

const SPACING = { days: 12, months: 40 };
const DAY = 86_400_000;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

const parse = (iso) => new Date(`${iso}T00:00:00Z`);
const iso = (d) => d.toISOString().slice(0, 10);
const monthKey = (iso) => iso.slice(0, 7);
const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

function todayIso() {
  const now = new Date();
  return iso(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

// One unit per day or per month, from a week before the first event to today.
function buildUnits(history, zoom) {
  const today = parse(todayIso());
  const start = new Date(parse(history[0].date).getTime() - 7 * DAY);
  const byKey = new Map();
  for (const day of history) {
    const key = zoom === 'days' ? day.date : monthKey(day.date);
    const unit = byKey.get(key) ?? { versions: [], posts: [], edits: [] };
    unit.versions.push(...day.versions);
    unit.posts.push(...day.posts);
    unit.edits.push(...day.edits);
    byKey.set(key, unit);
  }

  const units = [];
  if (zoom === 'days') {
    for (let t = start.getTime(); t <= today.getTime(); t += DAY) {
      const date = iso(new Date(t));
      units.push({ key: date, date: new Date(t), ...(byKey.get(date) ?? { versions: [], posts: [], edits: [] }) });
    }
  } else {
    const d = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), 1));
    while (d <= today) {
      const key = monthKey(iso(d));
      units.push({ key, date: new Date(d), ...(byKey.get(key) ?? { versions: [], posts: [], edits: [] }) });
      d.setUTCMonth(d.getUTCMonth() + 1);
    }
  }
  return units;
}

function unitLabel(unit, zoom) {
  const d = unit.date;
  const thisYear = new Date().getFullYear();
  if (zoom === 'months') {
    if (unit.key === monthKey(todayIso())) return 'this month';
    return `${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
  }
  const diff = Math.round((parse(todayIso()) - d) / DAY);
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  const year = d.getUTCFullYear() === thisYear ? '' : ` ${d.getUTCFullYear()}`;
  return `${WEEKDAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}${year}`;
}

function axisLabel(unit, zoom) {
  const d = unit.date;
  if (zoom === 'months') {
    return d.getUTCMonth() === 0 ? { text: d.getUTCFullYear(), strong: true } : { text: MONTHS[d.getUTCMonth()] };
  }
  if (d.getUTCDate() === 1) return { text: MONTHS[d.getUTCMonth()], strong: true };
  if (d.getUTCDay() === 1) return { text: d.getUTCDate() };
  return null;
}

function bars(unit) {
  const out = [];
  if (unit.versions.length) out.push({ kind: 'version', h: 56 });
  if (unit.posts.length) out.push({ kind: 'post', h: 40 });
  if (unit.edits.length) out.push({ kind: 'edit', h: Math.min(12 + unit.edits.length * 4, 34) });
  return out;
}

function detail(unit, zoom) {
  const items = [];
  for (const v of unit.versions) {
    const live = v.url === '/';
    items.push(`<li><i class="dot version"></i><span><strong>Version ${escape(v.id.slice(1))}</strong> · ${escape(v.title)}</span>
      ${live ? '<span class="muted">you are here</span>' : `<a href="${escape(v.url)}">visit ↗</a>`}</li>`);
  }
  for (const p of unit.posts) {
    items.push(`<li><i class="dot post"></i><span>Wrote <a href="${escape(p.url)}">${escape(p.title)}</a></span></li>`);
  }
  if (unit.edits.length) {
    const shown = unit.edits.slice(0, 3).map(escape).join(' · ');
    const more = unit.edits.length > 3 ? ` <span class="muted">+${unit.edits.length - 3} more</span>` : '';
    const count = `${unit.edits.length} edit${unit.edits.length > 1 ? 's' : ''}`;
    items.push(`<li><i class="dot edit"></i><span><strong>${count}</strong> <span class="muted">${shown}${more}</span></span></li>`);
  }
  if (!items.length) return `<p class="muted">Nothing changed that ${zoom === 'days' ? 'day' : 'month'}.</p>`;
  return `<ul>${items.join('')}</ul>`;
}

export function initTimeline(root) {
  const data = document.getElementById('history-data');
  const history = JSON.parse(data?.textContent || '[]');
  if (!history.length) return;

  const section = root.closest('section');
  const viewport = root.querySelector('.timeline-viewport');
  const track = root.querySelector('.timeline-track');
  const label = root.querySelector('.timeline-label');
  const detailEl = root.querySelector('.timeline-detail');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let zoom = 'days';
  let units = [];
  let index = 0;
  let offset = 0; // px the track is shifted left, index * spacing when settled

  const spacing = () => SPACING[zoom];
  const clampIndex = (i) => Math.max(0, Math.min(units.length - 1, i));
  const centre = () => viewport.clientWidth / 2;

  function render() {
    units = buildUnits(history, zoom);
    track.innerHTML = units
      .map((u, i) => {
        const axis = axisLabel(u, zoom);
        const b = bars(u);
        const barHtml = b
          .map((bar, j) => {
            const x = (j - (b.length - 1) / 2) * 6;
            return `<span class="bar ${bar.kind}" style="height:${bar.h}px;transform:translateX(${x}px)"></span>`;
          })
          .join('');
        return `<div class="unit${b.length ? ' has-events' : ''}" data-index="${i}" style="left:${i * spacing()}px">
          ${barHtml}<span class="tick"></span>
          ${axis ? `<span class="axis${axis.strong ? ' strong' : ''}">${axis.text}</span>` : ''}
        </div>`;
      })
      .join('');
  }

  function paint(animate) {
    track.style.transition = animate && !reduceMotion ? 'transform 0.35s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
    track.style.transform = `translateX(${centre() - offset}px)`;
    const nearest = clampIndex(Math.round(offset / spacing()));
    if (nearest !== index || !label.textContent) {
      index = nearest;
      const unit = units[index];
      label.textContent = unitLabel(unit, zoom);
      viewport.setAttribute('aria-valuetext', label.textContent);
      detailEl.innerHTML = detail(unit, zoom);
      track.querySelector('.unit.active')?.classList.remove('active');
      track.querySelector(`[data-index="${index}"]`)?.classList.add('active');
    }
  }

  function goTo(i, animate = true) {
    index = -1;
    offset = clampIndex(i) * spacing();
    paint(animate);
  }

  function findIndex(predicate) {
    const i = units.findIndex(predicate);
    return i === -1 ? units.length - 1 : i;
  }

  // Dragging, with a little momentum before snapping.
  let drag = null;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    drag = { x: e.clientX, start: offset, t: e.timeStamp, v: 0, moved: false };
    viewport.setPointerCapture(e.pointerId);
  });
  viewport.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) > 3) drag.moved = true;
    const next = drag.start - dx;
    const dt = Math.max(1, e.timeStamp - drag.t);
    drag.v = (next - offset) / dt;
    drag.t = e.timeStamp;
    offset = Math.max(0, Math.min((units.length - 1) * spacing(), next));
    paint(false);
  });
  const endDrag = (e) => {
    if (!drag) return;
    const { moved, v } = drag;
    drag = null;
    if (!moved) {
      const unit = e.target.closest?.('.unit');
      if (unit) return goTo(Number(unit.dataset.index));
    }
    goTo(Math.round((offset + v * 180) / spacing()));
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);

  // Horizontal trackpad swipes scrub; vertical scrolling is left to the page.
  let wheelTimer;
  viewport.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      offset = Math.max(0, Math.min((units.length - 1) * spacing(), offset + e.deltaX));
      paint(false);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => goTo(Math.round(offset / spacing())), 120);
    },
    { passive: false },
  );

  viewport.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, PageUp: -7, PageDown: 7 }[e.key];
    if (step) goTo(index + step);
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(units.length - 1);
    else return;
    e.preventDefault();
  });

  root.querySelectorAll('[data-jump]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const jump = btn.dataset.jump;
      if (jump === 'today') return goTo(units.length - 1);
      if (jump === 'first') return goTo(findIndex((u) => u.versions.length));
      const target = new Date();
      target.setFullYear(target.getFullYear() - 1);
      const key = zoom === 'days' ? iso(target) : monthKey(iso(target));
      goTo(Math.max(0, findIndex((u) => u.key >= key)));
    }),
  );

  section.querySelectorAll('[data-zoom]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.zoom === zoom) return;
      const key = units[index].key;
      zoom = btn.dataset.zoom;
      section.querySelectorAll('[data-zoom]').forEach((b) => b.setAttribute('aria-pressed', b === btn));
      render();
      goTo(findIndex((u) => u.key === (zoom === 'days' ? `${key}-01` : monthKey(key))), false);
    }),
  );

  new ResizeObserver(() => paint(false)).observe(viewport);

  render();
  goTo(units.length - 1, false);
}
