const paths={
 book:'<path d="M12 6c-3-2-6-3-10-2v15c4-1 7 0 10 2 3-2 6-3 10-2V4c-4-1-7 0-10 2zm0 0v14"/>',
 weapon:'<path d="m4 18 4-4 2 2-4 4zm6-7 8-8h3v3l-8 8m-6-4 7 7"/>',
 arcade:'<path d="M5 2h15v10H9l-2 3h12l3 7H3l-1-5 4-8zm3 3-1 5h10V5zm1 12v2h3v-2zm7 0v2h2v-2z" fill="currentColor" stroke="none"/>',
 pad:'<path d="M7 6h10c2 0 3 2 4 7l1 4c0 3-3 3-5 1l-2-2H9l-2 2c-2 2-5 2-5-1l1-4c1-5 2-7 4-7Z"/><path d="M8 9v5m-2.5-2.5h5M16 10h.01m2 3h.01"/>',
 speaker:'<path d="M3 9h4l5-4v14l-5-4H3zm13-1a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
 mute:'<path d="M3 9h4l5-4v14l-5-4H3zm13 0 6 6m0-6-6 6"/>',
 crew:'<circle cx="9" cy="8" r="3"/><path d="M2 20v-3c0-5 14-5 14 0v3zM15 5c5-1 7 5 2 6m2 3c2 0 3 2 3 4v2h-3"/>',
 solo:'<circle cx="12" cy="7" r="3.5"/><path d="M5 21v-3c0-6 14-6 14 0v3z"/>',
 wifi:'<path d="M2 8a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0"/><circle cx="12" cy="20" r="1" fill="currentColor"/>',
 spark:'<path d="m13 2-9 12h7l-1 8 10-13h-7z"/>',
 go:'<path d="M4 12h15m-6-7 7 7-7 7"/>',
 skull:'<path d="M4 13V8l4-5h8l4 5v6l-4 2v4H8v-4zM8 9h2v3H8zm6 0h2v3h-2zm-3 6h2"/>',
 flag:'<path d="M4 21V3h15l-3 4 3 4H5"/>',
 check:'<path d="m4 12 5 5L20 6"/>'
};
export function icon(name){return '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">'+(paths[name]||'')+'</svg>';}
