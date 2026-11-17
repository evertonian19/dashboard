// 아이콘 모음

const ICONS = {
  home:     '<path d="M4 11l8-7 8 7v8a1 1 0 01-1 1h-4v-6h-6v6H5a1 1 0 01-1-1z"/>',
  grid:     '<rect x="4" y="4" width="7" height="7" rx="2"/><rect x="13" y="4" width="7" height="7" rx="2"/><rect x="4" y="13" width="7" height="7" rx="2"/><rect x="13" y="13" width="7" height="7" rx="2"/>',
  chart:    '<path d="M5 20V10M12 20V4M19 20v-7"/>',
  folder:   '<path d="M3 7a2 2 0 012-2h4l2 2.5h8a2 2 0 012 2V17a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  gear:     '<circle cx="12" cy="12" r="3"/><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8"/>',
  plus:     '<path d="M12 5v14M5 12h14"/>',
  upload:   '<path d="M12 16V5M7 9.5L12 4.5l5 5"/><path d="M5 19h14"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5"/><path d="M5 19h14"/>',
  trash:    '<path d="M5 7h14M10 7V4.5h4V7M7 7l1 12.5h8L17 7"/>',
  note:     '<path d="M5 4h14a1 1 0 011 1v10l-5 5H5a1 1 0 01-1-1V5a1 1 0 011-1z"/><path d="M15 20v-5h5M8 9h8M8 13h5"/>',
  chat:     '<path d="M4 6a2 2 0 012-2h12a2 2 0 012 2v9a2 2 0 01-2 2h-7l-4.5 3.5V17H6a2 2 0 01-2-2z"/>',
  back:     '<path d="M14 7l-5 5 5 5"/>',
  mail:     '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M4 7.5l8 6 8-6"/>',
  refresh:  '<path d="M19.5 12a7.5 7.5 0 11-2.3-5.4"/><path d="M19.5 4.5v4h-4"/>',
  close:    '<path d="M6 6l12 12M18 6L6 18"/>',
  check:    '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8.5 12.2l2.5 2.5 4.5-5"/>',
  pin:      '<path d="M9 4h6l-1 6 3 3H7l3-3z"/><path d="M12 13v7"/>',
  edit:     '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  link:     '<path d="M10 14a4 4 0 005.7 0l3-3a4 4 0 00-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 00-5.7 0l-3 3a4 4 0 005.7 5.7l1-1"/>',
  image:    '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
  clip:     '<path d="M19 11.5l-7.2 7.2a4.2 4.2 0 01-6-6L13 5.5a2.8 2.8 0 014 4l-7 7a1.4 1.4 0 01-2-2l6.3-6.3"/>',
  eye:      '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="2.8"/>',
  bell:     '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20.5h4"/>',
  restore:  '<path d="M4.5 12a7.5 7.5 0 102.3-5.4"/><path d="M4.5 4.5v4h4"/>',
  pdf:      '<path d="M6 3.5h8l4 4V20a.5.5 0 01-.5.5h-11A.5.5 0 016 20z"/><path d="M14 3.5v4h4M9 13h6M9 16.5h4"/>',
  up:       '<path d="M6 14l6-6 6 6"/>',
  down:     '<path d="M6 10l6 6 6-6"/>',
  sort:     '<path d="M7 5v14M4 16l3 3 3-3M17 19V5M14 8l3-3 3 3"/>',
  disk:     '<ellipse cx="12" cy="6.5" rx="7.5" ry="3"/><path d="M4.5 6.5v11c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3v-11"/><path d="M4.5 12c0 1.7 3.4 3 7.5 3s7.5-1.3 7.5-3"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;

export { icon };
