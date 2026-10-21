// A small screenshot card that follows the mouse.
export function createPeek() {
  const peek = document.createElement('div');
  peek.className = 'peek';
  peek.setAttribute('aria-hidden', 'true');
  peek.innerHTML = '<img alt="" /><span></span>';
  document.body.append(peek);
  const img = peek.querySelector('img');
  const caption = peek.querySelector('span');

  return {
    show(src, text, x, y) {
      if (img.getAttribute('src') !== src) img.src = src;
      caption.textContent = text;
      const w = peek.offsetWidth || 240;
      const h = peek.offsetHeight || 170;
      const left = x + 18 + w > innerWidth - 8 ? x - 18 - w : x + 18;
      const top = Math.min(y + 18, innerHeight - h - 8);
      peek.style.transform = `translate(${left}px, ${top}px)`;
      peek.classList.add('visible');
    },
    hide() {
      peek.classList.remove('visible');
    },
  };
}

let shared;
const getPeek = () => (shared ??= createPeek());

// Any element with data-preview="/img.jpg" (and optional data-preview-caption).
export function initPreviews(root = document) {
  for (const el of root.querySelectorAll('[data-preview]')) {
    if (el.dataset.previewBound) continue;
    el.dataset.previewBound = 'true';
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      getPeek().show(el.dataset.preview, el.dataset.previewCaption ?? '', e.clientX, e.clientY);
    });
    el.addEventListener('pointerleave', () => getPeek().hide());
  }
}

export { getPeek };
