import Cover from './Cover';

export default function Vinyl({ cover, playing, title }) {
  return (
    <div className={'vinyl' + (playing ? ' playing' : '')}>
      <div className="disc">
        <div className="sheen" />
        <div className="label">
          <Cover url={cover} title={title} />
        </div>
        <div className="spindle" />
      </div>
      <svg className="tonearm" viewBox="0 0 120 190" aria-hidden="true">
        <rect x="86" y="2" width="12" height="18" rx="3" fill="#242424" stroke="#333" strokeWidth="1" />
        <circle cx="92" cy="30" r="14" fill="#141414" stroke="#2f2f2f" strokeWidth="2" />
        <circle cx="92" cy="30" r="4.5" fill="#3a3a3a" />
        <path d="M92 30 L92 100 L76 148" stroke="#c9c9c9" strokeWidth="4.5" fill="none" strokeLinecap="round" />
        <g transform="rotate(19 76 148)">
          <rect x="69.5" y="144" width="13" height="28" rx="3.5" fill="#1c1c1c" stroke="#383838" strokeWidth="1" />
          <rect x="73.5" y="168" width="5" height="5.5" rx="1" fill="#D71921" />
        </g>
      </svg>
    </div>
  );
}
