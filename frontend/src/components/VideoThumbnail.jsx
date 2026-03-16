import React, { useRef, useEffect, useState } from 'react';

/**
 * VideoThumbnail — extracts a frame from a video stream URL and shows it
 * as a canvas thumbnail. Falls back to a placeholder icon.
 */
export default function VideoThumbnail({ src, className }) {
  const canvasRef = useRef(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!src) return;
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.preload = 'metadata';

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(3, video.duration * 0.2);
    };

    video.onseeked = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width  = video.videoWidth  || 320;
      canvas.height = video.videoHeight || 180;
      canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
      setLoaded(true);
      video.src = '';
    };

    video.onerror = () => {};
    video.src = src;
    return () => { video.src = ''; };
  }, [src]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          display: loaded ? 'block' : 'none',
          width: '100%', height: '100%',
          objectFit: 'cover',
        }}
      />
      {!loaded && (
        <span style={{ fontSize: 32, color: '#c4b5fd', opacity: 0.7 }}>▶</span>
      )}
    </>
  );
}
