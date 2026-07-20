import { useRef } from 'react';
import { usePlayer } from '../state/PlayerContext';
import { useMenu } from './Menu';
import { fmtTime } from '../lib/format';
import { Dots } from './Icons';

function Eq({ on }) {
  return (
    <span className={'eq' + (on ? ' on' : '')}>
      <i /><i /><i />
    </span>
  );
}

// Hold a row (~0.45s, touch or mouse) to enter selection mode; in selection
// mode taps toggle the checkmark instead of playing.
export default function TrackRow({
  track, num, showArtist, onPlay, items,
  selectMode, selected, onSelectToggle, onLongPress
}) {
  const { openMenu } = useMenu();
  const { currentTrack, playing } = usePlayer();
  const active = currentTrack?.id === track.id;
  const lpRef = useRef(null);
  const ptRef = useRef('mouse');

  const lpStart = e => {
    ptRef.current = e.pointerType || 'mouse';
    if (!onLongPress || selectMode) return;
    const sx = e.clientX, sy = e.clientY;
    lpRef.current = {
      sx, sy,
      timer: setTimeout(() => {
        lpRef.current = { fired: true };
        onLongPress();
      }, 450)
    };
  };
  const lpMove = e => {
    const d = lpRef.current;
    if (d?.timer && (Math.abs(e.clientX - d.sx) > 10 || Math.abs(e.clientY - d.sy) > 10)) {
      clearTimeout(d.timer);
      lpRef.current = null;
    }
  };
  const lpEnd = () => {
    const d = lpRef.current;
    if (d?.timer) clearTimeout(d.timer);
    if (d?.fired) setTimeout(() => { lpRef.current = null; }, 250); // swallow the click
    else lpRef.current = null;
  };

  const onClick = () => {
    if (lpRef.current?.fired) return;
    if (selectMode) onSelectToggle?.();
    else onPlay();
  };
  const onCtx = e => {
    e.preventDefault();
    if (selectMode) return;
    // touch long-press is handled by the timer; only real right-clicks get the menu
    if (ptRef.current === 'touch') return;
    openMenu(e, items);
  };

  return (
    <div
      className={'trackrow' + (active ? ' active' : '') + (selected ? ' selected' : '')}
      onClick={onClick}
      onContextMenu={onCtx}
      onPointerDown={lpStart}
      onPointerMove={lpMove}
      onPointerUp={lpEnd}
      onPointerCancel={lpEnd}
      onPointerLeave={lpEnd}
    >
      <span className="tnum ndot">
        {selectMode
          ? <span className={'selchk' + (selected ? ' on' : '')} />
          : active ? <Eq on={playing} /> : num || '·'}
      </span>
      <div className="tmeta">
        <div className="ttitle">{track.title}</div>
        {showArtist && <div className="tsub">{track.artist}</div>}
      </div>
      <span className="tdur ndot">{fmtTime(track.duration)}</span>
      {!selectMode && (
        <button
          className="iconbtn tmenu"
          aria-label="Track menu"
          onClick={e => {
            e.stopPropagation();
            openMenu(e, items);
          }}
        >
          <Dots />
        </button>
      )}
    </div>
  );
}
