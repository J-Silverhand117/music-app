import { useEffect, useRef, useState } from 'react';
import { LibraryProvider, useLibrary } from './state/LibraryContext';
import { PlayerProvider } from './state/PlayerContext';
import { MenuProvider, useMenu } from './components/Menu';
import { fromFileList, fromDataTransferItems } from './lib/scan';
import AlbumGrid from './components/AlbumGrid';
import AlbumView from './components/AlbumView';
import ArtistsView from './components/ArtistsView';
import ArtistView from './components/ArtistView';
import PlaylistsView, { PlaylistView } from './components/PlaylistsView';
import VideosView, { VideoPage } from './components/VideosView';
import MiniPlayer from './components/MiniPlayer';
import NowPlaying from './components/NowPlaying';
import { usePlayer } from './state/PlayerContext';
import { Import } from './components/Icons';

const TABS = [
  ['albums', 'ALBUMS'],
  ['artists', 'ARTISTS'],
  ['playlists', 'PLAYLISTS'],
  ['videos', 'VIDEOS']
];

const IMPORT_ACCEPT =
  '.flac,.mp3,.m4a,.aac,.ogg,.opus,.wav,.mp4,.m4v,.webm,.mov,audio/*,video/*';

function Logo() {
  return (
    <div className="logo ndot">
      SOUND<span className="reddot">.</span>
    </div>
  );
}

function ImportToast() {
  const { importing } = useLibrary();
  if (!importing) return null;
  const { done, total, current, errors, finished, added } = importing;
  const pct = total ? (done / total) * 100 : 0;
  return (
    <div className="toast">
      <div className="toast-line ndot">
        <span>{finished ? 'IMPORT DONE' : 'IMPORTING'}</span>
        <span>{finished ? `${added ?? 0} ADDED` : `${done + 1}/${total}`}</span>
      </div>
      {!finished && <div className="toast-file">{current}</div>}
      <div className="toast-bar"><div style={{ width: pct + '%' }} /></div>
      {finished && errors.length > 0 && (
        <div className="toast-err">
          {errors.slice(0, 3).map((e, i) => <div key={i}>{e}</div>)}
          {errors.length > 3 && <div>… {errors.length - 3} more skipped</div>}
        </div>
      )}
    </div>
  );
}

function EmptyLibrary({ onImportFiles, onImportFolder }) {
  return (
    <div className="empty">
      <div className="empty-title ndot">EMPTY<span className="reddot">.</span></div>
      <div className="empty-sub">
        Import your music once (FLAC, MP3, M4A, OGG, WAV…) — it's stored inside the app (IndexedDB)
        and plays fully offline from then on.
      </div>
      <div className="empty-actions">
        <button className="btn-red ndot" onClick={onImportFiles}><Import /> IMPORT FILES</button>
        <button className="btn-ghost ndot" onClick={onImportFolder}><Import /> IMPORT FOLDER</button>
      </div>
      <div className="empty-sub dim">
        Folder import keeps your Artist / Album / Singles &amp; EPs structure — just pick the top folder and
        everything inside is scanned. You can also drag &amp; drop folders anywhere in this window.
      </div>
    </div>
  );
}

function Shell() {
  const { importFiles, ready, tracks, albums } = useLibrary();
  const player = usePlayer();
  const { openMenu } = useMenu();
  const [tab, setTab] = useState('albums');
  // navigation stack of detail pages, e.g. [{type:'artist',name}, {type:'album',key}]
  // so back from an album opened inside an artist returns to that artist
  const [stack, setStack] = useState([]);
  const [npOpen, setNpOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef(null);
  const folderInput = useRef(null);
  const uiRef = useRef({});
  uiRef.current = { stack, npOpen };

  // Android/desktop back button closes overlays instead of leaving the app
  useEffect(() => {
    const onPop = () => {
      const { stack, npOpen } = uiRef.current;
      if (npOpen) setNpOpen(false);
      else if (stack.length) setStack(s => s.slice(0, -1));
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const openDetail = d => {
    history.pushState({ ov: 1 }, '');
    setStack(s => [...s, d]);
  };
  const openNp = () => {
    if (!uiRef.current.npOpen) history.pushState({ np: 1 }, '');
    setNpOpen(true);
  };
  const closeTop = () => history.back();

  // drag & drop import (desktop) — recurses into dropped folders so a whole
  // Artist/Album/... tree can be dragged in at once, not just loose files
  useEffect(() => {
    let depth = 0;
    const hasFiles = e => [...(e.dataTransfer?.types || [])].includes('Files');
    const enter = e => { if (hasFiles(e)) { e.preventDefault(); depth++; setDragging(true); } };
    const over = e => { if (hasFiles(e)) e.preventDefault(); };
    const leave = () => { depth = Math.max(0, depth - 1); if (!depth) setDragging(false); };
    const drop = async e => {
      e.preventDefault();
      depth = 0;
      setDragging(false);
      if (e.dataTransfer?.items?.length) {
        const entries = await fromDataTransferItems(e.dataTransfer.items);
        if (entries) return importFiles(entries);
      }
      if (e.dataTransfer?.files?.length) importFiles(fromFileList(e.dataTransfer.files));
    };
    window.addEventListener('dragenter', enter);
    window.addEventListener('dragover', over);
    window.addEventListener('dragleave', leave);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragenter', enter);
      window.removeEventListener('dragover', over);
      window.removeEventListener('dragleave', leave);
      window.removeEventListener('drop', drop);
    };
  }, [importFiles]);

  // handy for debugging/testing from the console
  useEffect(() => {
    window.__importFiles = importFiles;
    return () => { delete window.__importFiles; };
  }, [importFiles]);

  // OS "open with" (installed desktop PWA, File Handling API): import the
  // launched files, then start playing / open the first one
  useEffect(() => {
    if (!ready) return;
    const handle = async files => {
      const res = await importFiles(files);
      if (res?.audioIds?.length) player.playTracks(res.audioIds);
      else if (res?.videoIds?.length) {
        setTab('videos');
        history.pushState({ ov: 1 }, '');
        setStack([{ type: 'video', id: res.videoIds[0] }]);
      }
    };
    window.__launchImport = handle;
    if (window.__pendingLaunch?.length) {
      const pending = window.__pendingLaunch;
      window.__pendingLaunch = null;
      handle(pending);
    }
    return () => { delete window.__launchImport; };
  }, [ready, importFiles, player]);

  const triggerImportFiles = () => fileInput.current?.click();
  const triggerImportFolder = () => folderInput.current?.click();
  const openImportMenu = e =>
    openMenu(e, [
      { label: 'Import files', action: triggerImportFiles },
      { label: 'Import folder', action: triggerImportFolder }
    ]);
  const pickTab = t => {
    setTab(t);
    if (uiRef.current.stack.length) setStack([]);
  };

  const top = stack[stack.length - 1];
  const openAlbum = k => openDetail({ type: 'album', key: k });
  let content = null;
  if (!ready) content = null;
  else if (top?.type === 'album') content = <AlbumView albumKey={top.key} onBack={closeTop} />;
  else if (top?.type === 'playlist') content = <PlaylistView id={top.id} onBack={closeTop} />;
  else if (top?.type === 'artist')
    content = <ArtistView name={top.name} onBack={closeTop} onOpenAlbum={openAlbum} />;
  else if (top?.type === 'video')
    content = <VideoPage id={top.id} onBack={closeTop} />;
  else if (tab === 'videos')
    content = <VideosView onOpen={id => openDetail({ type: 'video', id })} />;
  else if (tab === 'albums')
    content = tracks.length
      ? <AlbumGrid albums={albums} onOpen={openAlbum} />
      : <EmptyLibrary onImportFiles={triggerImportFiles} onImportFolder={triggerImportFolder} />;
  else if (tab === 'artists')
    content = tracks.length
      ? <ArtistsView onOpenArtist={name => openDetail({ type: 'artist', name })} />
      : <EmptyLibrary onImportFiles={triggerImportFiles} onImportFolder={triggerImportFolder} />;
  else content = <PlaylistsView onOpen={id => openDetail({ type: 'playlist', id })} />;

  return (
    <div className="app">
      <aside className="sidebar">
        <Logo />
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={'side-tab ndot' + (tab === id && !stack.length ? ' on' : '')}
            onClick={() => pickTab(id)}
          >
            {tab === id && !stack.length ? <span className="reddot">● </span> : ''}{label}
          </button>
        ))}
        <button className="import-btn ndot" onClick={openImportMenu}>
          <Import /> IMPORT
        </button>
      </aside>

      <div className="content">
        <div className="topbar">
          <Logo />
          <button className="iconbtn" aria-label="Import FLAC files or folder" onClick={openImportMenu}>
            <Import />
          </button>
        </div>
        <main className="main">{content}</main>
      </div>

      <nav className="bottomnav">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            className={'bn-tab ndot' + (tab === id && !stack.length ? ' on' : '')}
            onClick={() => pickTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      <MiniPlayer onExpand={openNp} />
      <NowPlaying open={npOpen} onClose={closeTop} />

      {dragging && (
        <div className="dropzone">
          <div className="ndot">DROP MUSIC / VIDEO FILES OR FOLDERS</div>
        </div>
      )}
      <ImportToast />

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={IMPORT_ACCEPT}
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files?.length) importFiles(fromFileList(e.target.files));
          e.target.value = '';
        }}
      />
      <input
        ref={folderInput}
        type="file"
        webkitdirectory=""
        directory=""
        multiple
        style={{ display: 'none' }}
        onChange={e => {
          if (e.target.files?.length) importFiles(fromFileList(e.target.files));
          e.target.value = '';
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <LibraryProvider>
      <PlayerProvider>
        <MenuProvider>
          <Shell />
        </MenuProvider>
      </PlayerProvider>
    </LibraryProvider>
  );
}
