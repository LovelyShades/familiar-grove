// Small inline SVG icons used by the interface.

const svg = (body, viewBox = '0 0 24 24') =>
  `<svg viewBox="${viewBox}" aria-hidden="true" focusable="false">${body}</svg>`;

export const ICONS = {
  aether: svg(`
    <defs><linearGradient id="ag" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#d4f6ff"/><stop offset="0.5" stop-color="#6fd3ff"/><stop offset="1" stop-color="#6a5cff"/>
    </linearGradient></defs>
    <path d="M12 1 L20 9 L12 23 L4 9 Z" fill="url(#ag)" stroke="#2b2466" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 1 L15 9 L12 23 L9 9 Z" fill="#ffffff" opacity="0.35"/>
    <path d="M4 9 H20" stroke="#2b2466" stroke-width="0.8" opacity="0.6"/>`),
  touch: svg(`
    <circle cx="12" cy="12" r="10" fill="#2a2a7a"/>
    <circle cx="12" cy="12" r="6" fill="#6fd3ff" opacity="0.5"/>
    <path d="M12 4 L13.6 10.4 L20 12 L13.6 13.6 L12 20 L10.4 13.6 L4 12 L10.4 10.4 Z" fill="#e8fbff"/>`),
  spring: svg(`
    <path d="M12 2 C16 8 19 11 19 15 A7 7 0 0 1 5 15 C5 11 8 8 12 2 Z" fill="#6fd3ff" stroke="#1d4f7a" stroke-width="1.2"/>
    <path d="M9 14 A3 3 0 0 0 12 18" stroke="#ffffff" stroke-width="1.6" fill="none" stroke-linecap="round"/>`),
  canopy: svg(`
    <rect x="10.5" y="13" width="3" height="9" rx="1" fill="#8a5a36"/>
    <circle cx="12" cy="9" r="6" fill="#4fa85c"/><circle cx="7" cy="12" r="4" fill="#3f8f4f"/><circle cx="17" cy="12" r="4" fill="#3f8f4f"/>
    <circle cx="9" cy="7" r="1.2" fill="#ffe27a"/><circle cx="15" cy="9" r="1.2" fill="#ffe27a"/><circle cx="12" cy="12" r="1.2" fill="#f7a8cf"/>`),
  paw: svg(`
    <ellipse cx="12" cy="16" rx="5" ry="4.2" fill="#f7a8cf"/>
    <circle cx="6" cy="10" r="2.2" fill="#f7a8cf"/><circle cx="10" cy="6.5" r="2.2" fill="#f7a8cf"/>
    <circle cx="14" cy="6.5" r="2.2" fill="#f7a8cf"/><circle cx="18" cy="10" r="2.2" fill="#f7a8cf"/>`),
  star: svg(`
    <path d="M12 2 L14.6 9.2 L22 9.6 L16.2 14.2 L18.2 21.6 L12 17.4 L5.8 21.6 L7.8 14.2 L2 9.6 L9.4 9.2 Z" fill="#ffd36e" stroke="#8a5a12" stroke-width="1"/>`),
  grove: svg(`
    <rect x="10.5" y="12" width="3" height="10" rx="1" fill="#a8744a"/>
    <circle cx="12" cy="8.5" r="6.5" fill="#4fa85c"/><circle cx="6.5" cy="11" r="4" fill="#3f8f4f"/><circle cx="17.5" cy="11" r="4" fill="#3f8f4f"/>
    <path d="M10 12.5 a1.6 1.6 0 0 1 2 -1.4 a1.6 1.6 0 0 1 2 1.4 L12 15 Z" fill="#ffd36e"/>`),
  book: svg(`
    <path d="M3 5 C6 4 9 4 12 6 C15 4 18 4 21 5 V19 C18 18 15 18 12 20 C9 18 6 18 3 19 Z" fill="#c9a45c" stroke="#5a3d1a" stroke-width="1.2"/>
    <path d="M12 6 V20" stroke="#5a3d1a" stroke-width="1.2"/>
    <path d="M5.5 8 C7.5 7.5 9 7.7 10 8.4 M5.5 11 C7.5 10.5 9 10.7 10 11.4 M14 8.4 C15 7.7 16.5 7.5 18.5 8" stroke="#5a3d1a" stroke-width="0.9" fill="none"/>`),
  summon: svg(`
    <path d="M12 2 L17 10 L12 22 L7 10 Z" fill="#b48cff" stroke="#3a2466" stroke-width="1.2" stroke-linejoin="round"/>
    <path d="M12 2 L13.8 10 L12 22 L10.2 10 Z" fill="#ffffff" opacity="0.35"/>
    <circle cx="4" cy="6" r="1.2" fill="#ffe27a"/><circle cx="20" cy="8" r="1" fill="#ffe27a"/><circle cx="19" cy="18" r="1.2" fill="#ffe27a"/>`),
  gear: svg(`
    <path d="M10.3 2h3.4l.5 2.6 1.9.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.9 2.6.5v3.4l-2.6.5-.8 1.9 1.5 2.2-2.4 2.4-2.2-1.5-1.9.8-.5 2.6h-3.4l-.5-2.6-1.9-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.9L2 13.7v-3.4l2.6-.5.8-1.9-1.5-2.2 2.4-2.4 2.2 1.5 1.9-.8z" fill="#a9a2c4" stroke="#3a3550" stroke-width="1"/>
    <circle cx="12" cy="12" r="3.5" fill="#3a3550"/>`),
  moon: svg(`<path d="M15 3 A9 9 0 1 0 21 15 A7 7 0 0 1 15 3 Z" fill="#f4f1ff"/>`),
  sun: svg(`<circle cx="12" cy="12" r="5" fill="#ffd36e"/><g stroke="#ffd36e" stroke-width="2" stroke-linecap="round"><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3M4.6 4.6l2.1 2.1M17.3 17.3l2.1 2.1M4.6 19.4l2.1-2.1M17.3 6.7l2.1-2.1"/></g>`),
  close: svg(`<path d="M6 6 L18 18 M18 6 L6 18" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`),
  up: svg(`<path d="M12 4 L19 12 H14.5 V20 H9.5 V12 H5 Z" fill="currentColor"/>`),
};
