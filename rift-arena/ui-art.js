const portraits={garen:'knight',ashe:'ranger',lux:'mage',yi:'swordsman'};
export function portrait(id,large=false){
  const key=Object.hasOwn(portraits,id)?portraits[id]:'knight';
  return `<img class="portrait-svg portrait-art${large?' large':''}" src="./assets/portraits/${key}-v1.jpg" alt="" decoding="async" draggable="false">`;
}
const paths={q:'<path d="M15 49 42 12l7 2-9 17-20 23Z" fill="currentColor"/><path d="m10 39 17 13m-12-8L8 53" fill="none" stroke="currentColor" stroke-width="4"/>',w:'<path d="m32 8 20 9-3 23-17 15-17-15-3-23Z" fill="none" stroke="currentColor" stroke-width="4"/><path d="m22 31 8 8 15-17" fill="none" stroke="currentColor" stroke-width="4"/>',e:'<path d="M47 18a22 22 0 1 0 4 24M47 18l-13 2m13-2-1-13" fill="none" stroke="currentColor" stroke-width="4"/><path d="m32 21 5 10 10 2-10 5-5 10-4-10-10-5 10-2Z" fill="currentColor"/>',r:'<path d="m32 6 7 24 16 5-16 7-7 16-7-16-16-7 16-5Z" fill="currentColor"/><path d="m11 12 9 7m33-7-9 7" fill="none" stroke="currentColor" stroke-width="3"/>',sword:'<path d="m18 43 22-29 10-5-1 12-23 28Zm-7-6 20 16M21 45l-9 12" fill="none" stroke="currentColor" stroke-width="4"/>',staff:'<path d="m40 23-19 35M42 7l9 12-9 13-10-13Z" fill="none" stroke="currentColor" stroke-width="4"/>',heart:'<path d="M32 53 11 31C-1 13 21 3 32 20 43 3 65 13 53 31Z" fill="currentColor"/>',boot:'<path d="m23 9 19 2-6 26 16 10v9H13V39l8-6Z" fill="none" stroke="currentColor" stroke-width="4"/>'};
export function skillIcon(id,slot) {
  let p=paths[slot]||paths.q;
  if(id==='ashe'&&['w','r'].includes(slot))p='<path d="M9 49 49 9M27 9h22v22M9 29l14 12M6 38l14 13" fill="none" stroke="currentColor" stroke-width="4"/>';
  if(id==='lux'&&slot==='r')p='<path d="M7 49 51 9M11 57 57 11" fill="none" stroke="currentColor" stroke-width="5"/><path d="m20 13 5 12 12 5-12 5-5 12-5-12-12-5 12-5Z" fill="currentColor"/>';
  if(id==='yi'&&slot==='w')p='<path d="M32 11v42M11 32h42" stroke="currentColor" stroke-width="10"/><circle cx="32" cy="32" r="25" fill="none" stroke="currentColor" stroke-width="2"/>';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">${p}</svg>`;
}
export function itemIcon(item) { const s=item.stats||{};const key=s.ap?'staff':s.armor?'w':s.hp?'heart':s.speed?'boot':'sword';return `<svg viewBox="0 0 64 64" aria-hidden="true">${paths[key]}</svg>`; }
