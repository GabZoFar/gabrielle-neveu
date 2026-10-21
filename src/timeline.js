// Scrubbable timeline: a fixed playhead over a strip of years (or quarters).
// Every project, site version and post is a candle; jobs are spans under the axis.
// Candles that point somewhere are links: hover for a preview, click to visit.

import { getPeek } from './peek.js';

const SPACING = { quarters: 56, years: 96 };
const PITCH = 13; // px between candles of the same quarter/year
const MINOR_TICKS = { quarters: 2, years: 3 }; // months, quarters
const SPAN_TOP = 140; // px from the top of the viewport to the first row of spans
const SPAN_ROW = 9;
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

const escape = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const quarterOf = (date) => `${date.slice(0, 4)}-Q${Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1}`;
const keyOf = (date, zoom) => (zoom === 'quarters' ? quarterOf(date) : date.slice(0, 4));
const shortDate = (date) => `${Number(date.slice(8, 10))} ${MONTHS[Number(date.slice(5, 7)) - 1]}`;

function todayIso() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())).toISOString().slice(0, 10);
}

// Every quarter (or year) from the first event or job to today, each with its candles.
function buildUnits(history, work, zoom) {
  const first = [history[0].date, ...work.map((w) => `${w.from}-01-01`)].sort()[0];
  const today = todayIso();
  const keys = [];
  let year = Number(first.slice(0, 4));
  let q = zoom === 'quarters' ? Number(quarterOf(first).slice(-1)) : 1;
  while (true) {
    const key = zoom === 'quarters' ? `${year}-Q${q}` : `${year}`;
    keys.push(key);
    if (key === keyOf(today, zoom)) break;
    if (zoom === 'quarters' && q < 4) q += 1;
    else [year, q] = [year + 1, 1];
  }

  const units = keys.map((key) => ({ key, projects: [], versions: [], posts: [], work: [] }));
  const byKey = new Map(units.map((u) => [u.key, u]));
  for (const day of history) {
    const unit = byKey.get(keyOf(day.date, zoom));
    if (!unit) continue;
    unit.projects.push(...day.projects);
    unit.versions.push(...day.versions);
    unit.posts.push(...day.posts.map((p) => ({ ...p, date: day.date })));
  }
  for (const u of units) {
    const year = u.key.slice(0, 4);
    u.work = work.filter((w) => w.from <= year && year <= w.to);
    u.candles = candles(u);
  }
  return units;
}

// Projects and versions get a candle each (in date order); posts share one.
function candles(unit) {
  const dated = [
    ...unit.projects.map((p) => ({
      kind: 'project',
      date: p.date,
      h: 68,
      link: (p.url || p.preview) && { url: p.url ?? null, preview: p.preview, title: p.title },
    })),
    ...unit.versions.map((v) => ({
      kind: 'version',
      date: v.date,
      h: 56,
      link: {
        url: v.url,
        preview: v.preview,
        title: v.url === '/' ? `This site, v${v.id.slice(1)} · you are here` : `This site, v${v.id.slice(1)}`,
      },
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
  if (unit.posts.length) dated.push({ kind: 'post', h: 44 });
  return dated;
}

function unitLabel(unit, zoom) {
  if (unit.key === keyOf(todayIso(), zoom)) return zoom === 'quarters' ? 'this quarter' : 'this year';
  return zoom === 'quarters' ? unit.key.replace('-', ' ').replace(/(\d{4}) (Q\d)/, '$2 $1') : unit.key;
}

function axisLabel(unit, zoom) {
  if (zoom === 'years') return { text: unit.key, strong: true };
  const [year, q] = unit.key.split('-');
  return q === 'Q1' ? { text: year, strong: true } : { text: q };
}

function detail(unit, zoom) {
  const items = [];
  for (const w of unit.work) {
    const years = w.from === w.to ? w.from : `${w.from}–${w.to}`;
    items.push(`<li><i class="dot work"></i><span><strong>${escape(w.title)}</strong> <span class="muted">${escape(w.role)}</span></span>
      <span class="muted">${years}</span></li>`);
  }
  for (const p of unit.projects) {
    items.push(`<li><i class="dot project"></i><span><strong>${escape(p.title)}</strong> <span class="muted">${escape(p.note)}</span></span>
      <span class="muted">started ${shortDate(p.date)}</span></li>`);
  }
  for (const v of unit.versions) {
    const live = v.url === '/';
    items.push(`<li><i class="dot version"></i><span><strong>This site, v${escape(v.id.slice(1))}</strong> <span class="muted">${escape(v.title)}</span></span>
      <span class="muted">${live ? 'you are here' : shortDate(v.date)}</span></li>`);
  }
  for (const p of unit.posts) {
    items.push(`<li><i class="dot post"></i><span>Wrote <a href="${escape(p.url)}">${escape(p.title)}</a></span>
      <span class="muted">${shortDate(p.date)}</span></li>`);
  }
  if (!items.length) return `<p class="muted">Quiet ${zoom === 'quarters' ? 'quarter' : 'year'}.</p>`;
  return `<ul>${items.join('')}</ul>`;
}

const isHere = (link) => link.url === location.pathname;

function open(link) {
  if (!link.url) return;
  if (isHere(link)) scrollTo({ top: 0, behavior: 'smooth' });
  else if (link.url.startsWith('/')) location.href = link.url;
  else window.open(link.url, '_blank', 'noopener');
}

export function initTimeline(root) {
  const data = document.getElementById('history-data');
  const history = JSON.parse(data?.textContent || '[]');
  if (!history.length) return;
  const work = JSON.parse(document.getElementById('work-data')?.textContent || '[]');

  const section = root.closest('section');
  const viewport = root.querySelector('.timeline-viewport');
  const track = root.querySelector('.timeline-track');
  const label = root.querySelector('.timeline-label');
  const detailEl = root.querySelector('.timeline-detail');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const peek = getPeek();

  let zoom = 'years';
  let units = [];
  let index = 0;
  let offset = 0; // px the track is shifted left, index * spacing when settled

  const spacing = () => SPACING[zoom];
  const clampIndex = (i) => Math.max(0, Math.min(units.length - 1, i));
  const maxOffset = () => (units.length - 1) * spacing();
  const centre = () => viewport.clientWidth / 2;
  const candleOf = (el) => el?.closest?.('[data-candle], [data-span]');
  const linkOf = (el) => {
    if (el.dataset.span) {
      const w = work[Number(el.dataset.span)];
      return { url: w.url ?? null, preview: w.preview, title: w.title };
    }
    const [u, c] = el.dataset.candle.split(':').map(Number);
    return units[u].candles[c].link;
  };

  // x of a date on the track: unit i is centred on i * spacing.
  const xOf = (date) => {
    const i = units.findIndex((u) => u.key === keyOf(date, zoom));
    const year = Number(date.slice(0, 4));
    const start =
      zoom === 'years'
        ? Date.UTC(year, 0, 1)
        : Date.UTC(year, (Number(quarterOf(date).slice(-1)) - 1) * 3, 1);
    const end = zoom === 'years' ? Date.UTC(year + 1, 0, 1) : Date.UTC(year, (Number(quarterOf(date).slice(-1)) - 1) * 3 + 3, 1);
    const frac = (Date.parse(`${date}T00:00:00Z`) - start) / (end - start);
    return (i - 0.5 + frac) * spacing();
  };

  // Jobs as spans; overlapping ones go on separate rows.
  function spansHtml() {
    const rows = [];
    return work
      .map((w, k) => {
        const from = `${w.from}-01-01`;
        const to = [`${w.to}-12-31`, todayIso()].sort()[0];
        let row = rows.findIndex((end) => end < from);
        if (row === -1) row = rows.length;
        rows[row] = to;
        const left = xOf(from);
        const style = `left:${left}px;width:${Math.max(6, xOf(to) - left)}px;top:${SPAN_TOP + row * SPAN_ROW}px`;
        const label = `${w.title}, ${w.from}–${w.to}`;
        if (!w.url) return `<span class="span" style="${style}" data-span="${k}" aria-label="${escape(label)}"></span>`;
        return `<a class="span" style="${style}" href="${escape(w.url)}" target="_blank" rel="noopener" data-span="${k}" tabindex="-1" draggable="false" aria-label="${escape(label)}"></a>`;
      })
      .join('');
  }

  function render() {
    units = buildUnits(history, work, zoom);
    track.innerHTML = units
      .map((u, i) => {
        const axis = axisLabel(u, zoom);
        const candleHtml = u.candles
          .map((c, j) => {
            const x = (j - (u.candles.length - 1) / 2) * PITCH - 4;
            const style = `height:${c.h}px;left:${x}px`;
            if (!c.link) return `<span class="bar ${c.kind}" style="${style}"></span>`;
            // Preview only: hoverable, not clickable.
            if (!c.link.url) return `<span class="bar ${c.kind}" style="${style}" data-candle="${i}:${j}" aria-label="${escape(c.link.title)}"></span>`;
            const external = c.link.url.startsWith('/') ? '' : ' target="_blank" rel="noopener"';
            return `<a class="bar ${c.kind}" style="${style}" href="${escape(c.link.url)}"${external} data-candle="${i}:${j}" tabindex="-1" draggable="false" aria-label="${escape(c.link.title)}"></a>`;
          })
          .join('');
        const minor = i < units.length - 1 ? MINOR_TICKS[zoom] : 0;
        const minorHtml = Array.from(
          { length: minor },
          (_, k) => `<span class="tick minor" style="left:${((k + 1) * spacing()) / (minor + 1)}px"></span>`,
        ).join('');
        return `<div class="unit" data-index="${i}" style="left:${i * spacing()}px">
          ${candleHtml}<span class="tick"></span>${minorHtml}
          <span class="axis${axis.strong ? ' strong' : ''}">${axis.text}</span>
        </div>`;
      })
      .join('');
    track.insertAdjacentHTML('beforeend', spansHtml());
  }

  function paint(animate) {
    track.style.transition = animate && !reduceMotion ? 'transform 0.4s cubic-bezier(0.22, 1, 0.36, 1)' : 'none';
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

  const findIndex = (predicate, fallback = units.length - 1) => {
    const i = units.findIndex(predicate);
    return i === -1 ? fallback : i;
  };

  // Dragging, with a little momentum before snapping. Pointer capture only
  // starts once it's a real drag, so a plain click still reaches the candle link.
  let drag = null;
  let suppressClick = false;
  viewport.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    suppressClick = false;
    drag = { x: e.clientX, start: offset, t: e.timeStamp, v: 0, moved: false, id: e.pointerId };
  });
  viewport.addEventListener('pointermove', (e) => {
    const candle = candleOf(e.target);
    if (!drag && e.pointerType === 'mouse' && candle) {
      const link = linkOf(candle);
      const arrow = !link.url ? '' : isHere(link) ? ' ↑' : link.url.startsWith('/') ? ' →' : ' ↗';
      peek.show(link.preview, `${link.title}${arrow}`, e.clientX, e.clientY);
    }
    else peek.hide();
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (!drag.moved && Math.abs(dx) > 4) {
      drag.moved = true;
      viewport.setPointerCapture(drag.id);
      viewport.classList.add('dragging');
    }
    if (!drag.moved) return;
    const next = Math.max(0, Math.min(maxOffset(), drag.start - dx));
    drag.v = (next - offset) / Math.max(1, e.timeStamp - drag.t);
    drag.t = e.timeStamp;
    offset = next;
    paint(false);
  });
  viewport.addEventListener('pointerleave', () => peek.hide());

  const endDrag = (e) => {
    if (!drag) return;
    const { moved, v } = drag;
    drag = null;
    viewport.classList.remove('dragging');
    if (moved) {
      suppressClick = true;
      return goTo(Math.round((offset + v * 220) / spacing()));
    }
    const unit = e.target.closest?.('.unit');
    if (!unit) return;
    const i = Number(unit.dataset.index);
    // On touch there's no hover: the first tap selects, the next one opens.
    if (candleOf(e.target) && (e.pointerType === 'mouse' || i === index)) return;
    suppressClick = true;
    goTo(i);
  };
  viewport.addEventListener('pointerup', endDrag);
  viewport.addEventListener('pointercancel', endDrag);
  viewport.addEventListener(
    'click',
    (e) => {
      const candle = candleOf(e.target);
      if (!suppressClick && candle && isHere(linkOf(candle))) {
        e.preventDefault();
        open(linkOf(candle));
        return;
      }
      if (!suppressClick) return;
      suppressClick = false;
      e.preventDefault();
    },
    true,
  );

  // Horizontal trackpad swipes scrub; vertical scrolling is left to the page.
  let wheelTimer;
  viewport.addEventListener(
    'wheel',
    (e) => {
      if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
      e.preventDefault();
      peek.hide();
      offset = Math.max(0, Math.min(maxOffset(), offset + e.deltaX));
      paint(false);
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => goTo(Math.round(offset / spacing())), 120);
    },
    { passive: false },
  );

  viewport.addEventListener('keydown', (e) => {
    const step = { ArrowLeft: -1, ArrowRight: 1 }[e.key];
    const link = units[index].candles.find((c) => c.link)?.link;
    if (step) goTo(index + step);
    else if (e.key === 'Home') goTo(0);
    else if (e.key === 'End') goTo(units.length - 1);
    else if (e.key === 'Enter' && link) open(link);
    else return;
    e.preventDefault();
  });

  root.querySelectorAll('[data-jump]').forEach((btn) =>
    btn.addEventListener('click', () => {
      const jump = btn.dataset.jump;
      if (jump === 'today') return goTo(units.length - 1);
      if (jump === 'first') return goTo(findIndex((u) => u.projects.length));
      const target = new Date();
      target.setFullYear(target.getFullYear() - 1);
      goTo(findIndex((u) => u.key === keyOf(target.toISOString().slice(0, 10), zoom), 0));
    }),
  );

  section.querySelectorAll('[data-zoom]').forEach((btn) =>
    btn.addEventListener('click', () => {
      if (btn.dataset.zoom === zoom) return;
      const year = units[index].key.slice(0, 4);
      zoom = btn.dataset.zoom;
      section.querySelectorAll('[data-zoom]').forEach((b) => b.setAttribute('aria-pressed', b === btn));
      render();
      // Years → quarters lands on that year's last quarter (or today's).
      goTo(zoom === 'years' ? findIndex((u) => u.key === year) : findIndex((u) => u.key === `${year}-Q4`), false);
    }),
  );

  new ResizeObserver(() => paint(false)).observe(viewport);

  render();
  goTo(units.length - 1, false);
}
