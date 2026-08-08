// icons.js — inline SVG icon set.
//
// Emoji render as a different artwork on every platform (Apple, Google, Microsoft
// and Samsung all ship their own), sit on an inconsistent baseline and cannot take
// the page's colour. These are drawn on one 24-unit grid with a single stroke weight,
// inherit currentColor, and stay crisp at any size or pixel density.

const BASE = 'xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" '
  + 'stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" '
  + 'aria-hidden="true" focusable="false"';

const SOLID = 'fill="currentColor" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"';

const ICONS = {
  // Stations. `expand` and `contract` are deliberate mirrors: the ladder grows a
  // sentence forward from a fixed start, the backward build grows it from the tail.
  rewind: `<path ${SOLID} d="M11 6.9 3.9 11.6a.5.5 0 0 0 0 .8L11 17.1V6.9Z"/>`
        + `<path ${SOLID} d="M20.4 6.9 13.3 11.6a.5.5 0 0 0 0 .8l7.1 4.7V6.9Z"/>`,
  expand:   '<path d="M4 5v14"/><path d="M7.5 8h4"/><path d="M7.5 12h7.5"/><path d="M7.5 16h11"/>',
  contract: '<path d="M20 5v14"/><path d="M16.5 8h-4"/><path d="M16.5 12h-7.5"/><path d="M16.5 16h-11"/>',
  frame:    '<rect x="3" y="6" width="18" height="12" rx="3"/><path d="M7 12h3.5"/><path d="M13.5 12h3.5"/>',
  fork:     '<path d="M3 12h5"/><path d="M8 12c5.5 0 5-5.5 10-5.5"/><path d="M8 12c5.5 0 5 5.5 10 5.5"/>'
          + '<path d="m15.6 4.2 2.9 2.3-2.9 2.3"/><path d="m15.6 15.2 2.9 2.3-2.9 2.3"/>',
  mic:      '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/>'
          + '<path d="M12 18v3"/><path d="M8.5 21h7"/>',

  // Interface
  sliders:  '<path d="M4 7h9"/><path d="M17 7h3"/><circle cx="15" cy="7" r="2"/>'
          + '<path d="M4 12h3"/><path d="M11 12h9"/><circle cx="9" cy="12" r="2"/>'
          + '<path d="M4 17h7"/><path d="M15 17h5"/><circle cx="13" cy="17" r="2"/>',
  left:     '<path d="M19 12H5"/><path d="m11 6-6 6 6 6"/>',
  right:    '<path d="M5 12h14"/><path d="m13 6 6 6-6 6"/>',
  archive:  '<rect x="3" y="4" width="18" height="4.5" rx="1.5"/>'
          + '<path d="M5 8.5V19a1.5 1.5 0 0 0 1.5 1.5h11A1.5 1.5 0 0 0 19 19V8.5"/><path d="M10 12.5h4"/>',
  repeat:   '<path d="M3.5 11a8.5 8.5 0 0 1 14.2-6.3L20.5 7"/><path d="M20.5 3v4.5H16"/>'
          + '<path d="M20.5 13a8.5 8.5 0 0 1-14.2 6.3L3.5 17"/><path d="M3.5 21v-4.5H8"/>',
  download: '<path d="M12 3.5v11"/><path d="m7.5 10.5 4.5 4.5 4.5-4.5"/><path d="M4 20h16"/>',
  upload:   '<path d="M12 20.5v-11"/><path d="m7.5 13.5 4.5-4.5 4.5 4.5"/><path d="M4 4h16"/>',
  play:     `<path ${SOLID} d="M8.4 5.8v12.4a.6.6 0 0 0 .92.51l9.7-6.2a.6.6 0 0 0 0-1.02l-9.7-6.2a.6.6 0 0 0-.92.51Z"/>`,
  stop:     `<rect x="6.5" y="6.5" width="11" height="11" rx="2.5" ${SOLID}/>`,
  check:    '<path d="m4.5 12.4 5 5 10-10.4"/>',
  eye:      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z"/>'
          + '<circle cx="12" cy="12" r="3"/>',
  shuffle:  '<path d="M3 7h3.2a4 4 0 0 1 3.3 1.75l4.6 6.5A4 4 0 0 0 17.4 17H21"/>'
          + '<path d="M3 17h3.2a4 4 0 0 0 3.3-1.75l4.6-6.5A4 4 0 0 1 17.4 7H21"/>'
          + '<path d="m18.2 4.2 2.8 2.8-2.8 2.8"/><path d="m18.2 14.2 2.8 2.8-2.8 2.8"/>',
};

export function icoHTML(name, size = 20) {
  return `<svg ${BASE} width="${size}" height="${size}">${ICONS[name] || ""}</svg>`;
}

/** Returns a span wrapper so icons drop straight into the h() helper. */
export function ico(name, size = 20, cls = "") {
  const span = document.createElement("span");
  span.className = cls ? `ico ${cls}` : "ico";
  span.style.width = `${size}px`;
  span.style.height = `${size}px`;
  span.innerHTML = icoHTML(name, size);
  return span;
}

export const ICON_NAMES = Object.keys(ICONS);
