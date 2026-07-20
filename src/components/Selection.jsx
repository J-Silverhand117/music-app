import { useCallback, useState } from 'react';
import { usePlayer } from '../state/PlayerContext';
import { useMenu } from './Menu';
import { X } from './Icons';

// Multi-select for track lists: hold a track to start, tap others to add,
// then act on the whole selection at once.
export function useTrackSelection() {
  const [sel, setSel] = useState(null); // null = off, Set(ids) = on
  const start = useCallback(id => setSel(new Set(id ? [id] : [])), []);
  const toggle = useCallback(id => {
    setSel(s => {
      if (!s) return s;
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }, []);
  const clear = useCallback(() => setSel(null), []);
  return { sel, active: !!sel, start, toggle, clear, setSel };
}

export function SelectionBar({ sel, setSel, allIds, clear }) {
  const player = usePlayer();
  const { openPlaylistPicker } = useMenu();
  const ordered = allIds.filter(id => sel?.has(id)); // keep list order
  const allSelected = ordered.length === allIds.length;
  return (
    <div className="selbar">
      <span className="selcount ndot">{ordered.length} SELECTED</span>
      <button
        className={'selbtn ndot' + (allSelected ? ' lit' : '')}
        onClick={() => setSel(allSelected ? new Set() : new Set(allIds))}
      >
        ALL
      </button>
      <button
        className="selbtn ndot"
        disabled={!ordered.length}
        onClick={e => {
          openPlaylistPicker(e, ordered);
          clear();
        }}
      >
        + PLAYLIST
      </button>
      <button
        className="selbtn ndot"
        disabled={!ordered.length}
        onClick={() => {
          player.addToQueue(ordered);
          clear();
        }}
      >
        + QUEUE
      </button>
      <button className="iconbtn selx" aria-label="Cancel selection" onClick={clear}><X /></button>
    </div>
  );
}
