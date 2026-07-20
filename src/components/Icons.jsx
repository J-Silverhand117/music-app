const S = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};
const Svg = ({ children, ...p }) => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" {...p}>{children}</svg>
);

export const Play = () => <Svg><path d="M8 5.4v13.2c0 .8.9 1.3 1.6.9l10.4-6.6c.6-.4.6-1.4 0-1.8L9.6 4.5c-.7-.4-1.6.1-1.6.9z" fill="currentColor"/></Svg>;
export const Pause = () => <Svg><rect x="6" y="5" width="4" height="14" rx="1.2" fill="currentColor"/><rect x="14" y="5" width="4" height="14" rx="1.2" fill="currentColor"/></Svg>;
export const Prev = () => <Svg><path d="M19 19.2V4.8c0-.7-.8-1.2-1.5-.8L7 10.9c-.6.4-.6 1.4 0 1.8l10.5 6.4c.7.4 1.5-.1 1.5-.9z" fill="currentColor"/><line x1="5" y1="5" x2="5" y2="19" {...S}/></Svg>;
export const Next = () => <Svg><path d="M5 4.8v14.4c0 .7.8 1.2 1.5.8L17 13.6c.6-.4.6-1.4 0-1.8L6.5 4c-.7-.4-1.5.1-1.5.8z" fill="currentColor"/><line x1="19" y1="5" x2="19" y2="19" {...S}/></Svg>;
export const Shuffle = () => <Svg {...S}><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></Svg>;
export const Repeat = ({ one }) => (
  <Svg {...S}>
    <polyline points="17 1 21 5 17 9"/>
    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
    <polyline points="7 23 3 19 7 15"/>
    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
    {one && <text x="12" y="15" textAnchor="middle" fontSize="8.5" fill="currentColor" stroke="none" fontFamily="inherit">1</text>}
  </Svg>
);
export const Dots = () => <Svg><circle cx="12" cy="5.5" r="1.7" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="currentColor"/><circle cx="12" cy="18.5" r="1.7" fill="currentColor"/></Svg>;
export const Plus = () => <Svg {...S}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></Svg>;
export const ChevronDown = () => <Svg {...S}><polyline points="6 9 12 15 18 9"/></Svg>;
export const ChevronUp = () => <Svg {...S}><polyline points="6 15 12 9 18 15"/></Svg>;
export const ChevronLeft = () => <Svg {...S}><polyline points="15 6 9 12 15 18"/></Svg>;
export const X = () => <Svg {...S}><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></Svg>;
export const Import = () => <Svg {...S}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></Svg>;
export const Volume = () => <Svg {...S}><path d="M11 5 6 9H2v6h4l5 4V5z" fill="currentColor" stroke="none"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9.4 9.4 0 0 1 0 13"/></Svg>;
export const QueueIcon = () => <Svg {...S}><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="12" y2="18"/><circle cx="18" cy="17.5" r="2.4"/><path d="M20.4 17.5V11"/></Svg>;
export const Note = () => <Svg {...S}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></Svg>;
