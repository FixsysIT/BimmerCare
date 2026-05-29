/* Stroke line-icons (lucide-derived) + BMW roundel brand mark.
   Single source so sidebar + mobile nav stay in sync. */

const base = {
  width: 22,
  height: 22,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

export const Gauge = (p) => (
  <svg {...base} {...p}><path d="M12 14l4-4" /><path d="M3.34 19a10 10 0 1 1 17.32 0" /></svg>
);

export const Wrench = (p) => (
  <svg {...base} {...p}><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" /></svg>
);

export const Wallet = (p) => (
  <svg {...base} {...p}><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4" /><path d="M3 5v14a2 2 0 0 0 2 2h16v-5" /><path d="M18 12a2 2 0 0 0 0 4h4v-4Z" /></svg>
);

export const Package = (p) => (
  <svg {...base} {...p}><path d="m7.5 4.27 9 5.15" /><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" /><path d="m3.3 7 8.7 5 8.7-5" /><path d="M12 22V12" /></svg>
);

export const Cog = (p) => (
  <svg {...base} {...p}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
);

export const Globe = (p) => (
  <svg {...base} width={18} height={18} {...p}><circle cx="12" cy="12" r="10" /><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" /><path d="M2 12h20" /></svg>
);

/* BMW-style roundel, recolored to app blue */
export const Roundel = ({ size = 36, ...p }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" {...p}>
    <circle cx="24" cy="24" r="23" fill="#0E1320" stroke="rgba(255,255,255,0.18)" strokeWidth="1.5" />
    <circle cx="24" cy="24" r="18.5" fill="#0B0F19" />
    <path d="M24 24 L24 5.5 A18.5 18.5 0 0 0 5.5 24 Z" fill="#E6ECF5" />
    <path d="M24 24 L24 5.5 A18.5 18.5 0 0 1 42.5 24 Z" fill="#1E7AD4" />
    <path d="M24 24 L42.5 24 A18.5 18.5 0 0 1 24 42.5 Z" fill="#E6ECF5" />
    <path d="M24 24 L5.5 24 A18.5 18.5 0 0 0 24 42.5 Z" fill="#1E7AD4" />
    <circle cx="24" cy="24" r="18.5" fill="none" stroke="rgba(0,0,0,0.35)" strokeWidth="1" />
  </svg>
);
