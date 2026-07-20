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

export default function TrackRow({ track, num, showArtist, onPlay, items }) {
  const { openMenu } = useMenu();
  const { currentTrack, playing } = usePlayer();
  const active = currentTrack?.id === track.id;
  return (
    <div
      className={'trackrow' + (active ? ' active' : '')}
      onClick={onPlay}
      onContextMenu={e => openMenu(e, items)}
    >
      <span className="tnum ndot">{active ? <Eq on={playing} /> : num || '·'}</span>
      <div className="tmeta">
        <div className="ttitle">{track.title}</div>
        {showArtist && <div className="tsub">{track.artist}</div>}
      </div>
      <span className="tdur ndot">{fmtTime(track.duration)}</span>
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
    </div>
  );
}
