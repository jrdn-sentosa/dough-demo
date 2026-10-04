import { useRef, useState } from 'react';
import { reachedWatchThreshold } from '../domain/lessons';

interface VideoPlayerProps {
  title: string;
  videoUrl: string;
  captionsUrl: string;
  /** Seconds to jump to once the video is ready, e.g. from a quiz link. */
  startAt?: number;
  /** Called once, when playback reaches 90% or the video ends. */
  onWatched: () => void;
  posterTitle: string;
  posterNote: string;
}

/**
 * Native video with captions. `playsInline` keeps iPhone from forcing full screen.
 * If the file is missing (no fake videos in the repo) or can't play, a
 * "Video coming soon" poster shows instead. The lesson summary and the
 * "Mark as watched" button live on the lesson screen, so they work either way.
 */
export function VideoPlayer({ title, videoUrl, captionsUrl, startAt = 0, onWatched, posterTitle, posterNote }: VideoPlayerProps) {
  const [failed, setFailed] = useState(false);
  const reported = useRef(false);

  function report() {
    if (reported.current) return;
    reported.current = true;
    onWatched();
  }

  if (failed) {
    return (
      <div className="video-poster" role="group" aria-label={title}>
        <p className="video-poster__title">{posterTitle}</p>
        <p className="video-poster__note">{posterNote}</p>
      </div>
    );
  }

  return (
    <video
      className="video"
      controls
      playsInline
      preload="metadata"
      src={videoUrl}
      aria-label={title}
      onError={() => setFailed(true)}
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        if (startAt > 0 && Number.isFinite(v.duration)) v.currentTime = Math.min(startAt, v.duration);
      }}
      onTimeUpdate={(e) => {
        const v = e.currentTarget;
        if (reachedWatchThreshold(v.currentTime, v.duration)) report();
      }}
      onEnded={report}
    >
      <track kind="captions" src={captionsUrl} srcLang="en" label="English" default />
    </video>
  );
}
