import { useEffect, useState } from 'react';
import { useLibrary } from '../state/LibraryContext';
import { usePlayer } from '../state/PlayerContext';
import { useMenu } from './Menu';
import { getAudio } from '../lib/db';
import { mimeFor } from '../lib/media';
import { fmtTime } from '../lib/format';
import { ChevronLeft, Dots, Play } from './Icons';

export default function VideosView({ onOpen }) {
  const { videos, thumbUrls } = useLibrary();
  const { openMenu } = useMenu();
  const { deleteVideos } = useLibrary();

  if (!videos.length) {
    return (
      <div className="empty">
        <div className="empty-title ndot">NO VIDEOS<span className="reddot">.</span></div>
        <div className="empty-sub">
          Import .mp4 / .webm / .mov files with the same Import button or drag &amp; drop —
          they show up here and play fully offline.
        </div>
      </div>
    );
  }

  return (
    <div className="vgrid">
      {videos.map(v => {
        const items = [
          { label: 'Play', action: () => onOpen(v.id) },
          {
            label: 'Delete from library',
            danger: true,
            action: () => {
              if (window.confirm(`Delete "${v.title}" from your library?`)) deleteVideos([v.id]);
            }
          }
        ];
        return (
          <div key={v.id} className="vcard" onClick={() => onOpen(v.id)} onContextMenu={e => openMenu(e, items)}>
            <div className="vthumb">
              {thumbUrls[v.id]
                ? <img src={thumbUrls[v.id]} alt={v.title} loading="lazy" draggable="false" />
                : <div className="vthumb-ph"><Play /></div>}
              {v.duration > 0 && <span className="vdur ndot">{fmtTime(v.duration)}</span>}
              <button
                className="cardmenu"
                aria-label="Video menu"
                onClick={e => { e.stopPropagation(); openMenu(e, items); }}
              >
                <Dots />
              </button>
            </div>
            <div className="card-name">{v.title}</div>
            <div className="card-sub">
              {v.width && v.height ? `${v.width}×${v.height}` : v.fileName}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function VideoPage({ id, onBack }) {
  const { videos, thumbUrls, deleteVideos } = useLibrary();
  const player = usePlayer();
  const { openMenu } = useMenu();
  const [url, setUrl] = useState(null);
  const video = videos.find(v => v.id === id);

  useEffect(() => {
    if (!video) onBack();
  }, [video, onBack]);

  useEffect(() => {
    let u;
    let cancelled = false;
    (async () => {
      let blob = await getAudio(id);
      if (!blob || cancelled) return;
      if (!blob.type) blob = new Blob([blob], { type: mimeFor(video?.fileName || '', 'video/mp4') });
      u = URL.createObjectURL(blob);
      if (!cancelled) setUrl(u);
    })();
    return () => {
      cancelled = true;
      if (u) URL.revokeObjectURL(u);
    };
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!video) return null;

  const items = [
    {
      label: 'Delete from library',
      danger: true,
      action: () => {
        if (window.confirm(`Delete "${video.title}" from your library?`)) deleteVideos([video.id]);
      }
    }
  ];

  return (
    <div className="vpage">
      <button className="back-btn ndot" onClick={onBack}>
        <ChevronLeft /> BACK
      </button>
      <div className="vplayer-wrap">
        <video
          className="vplayer"
          controls
          autoPlay
          playsInline
          src={url || undefined}
          poster={thumbUrls[video.id] || undefined}
          onPlay={() => player.playing && player.toggle()} // pause music when a video starts
        />
      </div>
      <div className="vpage-info">
        <div className="vpage-title">{video.title}</div>
        <div className="vpage-sub ndot">
          {video.width && video.height ? `${video.width}×${video.height} · ` : ''}
          {video.duration > 0 ? fmtTime(video.duration) : ''}
        </div>
        <button className="iconbtn" aria-label="Video menu" onClick={e => openMenu(e, items)}>
          <Dots />
        </button>
      </div>
    </div>
  );
}
