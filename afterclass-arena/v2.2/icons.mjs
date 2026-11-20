const paths = {
  gamepad: '<path d="M7 6h10c2.7 0 3.9 2.7 4.6 8.3.4 3-1 4.7-3.2 3.5L15 15H9l-3.4 2.8c-2 1.3-3.6-.5-3.2-3.5C3.1 8.7 4.3 6 7 6Z"/><path d="M7.5 9v4m-2-2h4"/><circle cx="16" cy="10" r=".7"/><circle cx="18.5" cy="12.5" r=".7"/>',
  full:'<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>',
  sound:'<path d="M3 9h4l5-4v14l-5-4H3zM16 8c2 2 2 6 0 8m3-11c4 4 4 10 0 14"/>',
  mute:'<path d="M3 9h4l5-4v14l-5-4H3zM16 9l5 6m0-6-5 6"/>',
  menu:'<path d="M4 6h16M4 12h16M4 18h16"/>', close:'<path d="m5 5 14 14m0-14L5 19"/>',
  pin:'<path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z"/><circle cx="12" cy="10" r="2.2"/>',
  dummy:'<path d="M10 3h4v15h-4zM10 9 5 6m9 3 5-3m-9 7-5-2m7 7v3m-6 0h12"/>',
  robot:'<rect x="3.5" y="7" width="17" height="13" rx="3"/><path d="M12 7V3m-5 13h10"/><circle cx="8.5" cy="12" r="1"/><circle cx="15.5" cy="12" r="1"/>',
  duo:'<circle cx="9" cy="8" r="3"/><path d="M3 20v-2a6 6 0 0 1 12 0v2m0-15a3 3 0 0 1 0 6m3 2c2 .7 3 2.2 3 5v2"/>',
  wifi:'<path d="M2 8a17 17 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r="1"/>',
  trail:'<path d="m3 18 7-11 5 8 2-3 5 6z"/>',
  hoop:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3v18M5 6q10 6 14 12M19 6q-9 4-14 12"/>',
  bounce:'<path d="M2 18q3-14 8-4t8-8m-4 0h5v5"/>',
  book:'<path d="M4 3h13a2 2 0 0 1 2 2v15H6a2 2 0 0 1-2-2zM7 16h12M8 8h7m-7 3h5"/>',
  message:'<path d="M3 4h18v13H9l-6 4zM7 9h2m2 0h2m2 0h2"/>',
  shield:'<path d="m12 2 8 3v6c0 5-4 8-8 11-4-3-8-6-8-11V5z"/><path d="m8 12 3 3 5-6"/>',
  trap:'<path d="M4 17h16l-3-6H7l-3 6Zm8-7V6m-4 3L6 6m10 3 2-3M2 20h20"/>',
  bolt:'<path d="m14 2-9 12h6l-1 8 9-13h-6l1-7Z"/>',
  arrow:'<path d="M3 12h17m-6-6 6 6-6 6"/>', play:'<path d="M6 4v16l14-8z" fill="currentColor" stroke="none"/>'
};
export function icon(name) {
  return '<svg class="ico" viewBox="0 0 24 24" aria-hidden="true">'+(paths[name]||'')+'</svg>';
}
