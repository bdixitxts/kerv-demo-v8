import React, { useRef, useEffect, useState, useCallback } from 'react';
import styles from './VideoPlayer.module.css';

const DEMO_VIDEO_URL = 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4';

export default function VideoPlayer({ videoUrl, onTimeUpdate, onDurationChange, onLoad, videoRef: externalRef }) {
  const internalRef = useRef(null);
  const videoRef = externalRef || internalRef;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [isMuted, setIsMuted] = useState(true);
  const [isLoaded, setIsLoaded] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const progressRef = useRef(null);

  const src = videoUrl || DEMO_VIDEO_URL;

  // Reset when src changes
  useEffect(() => { setIsLoaded(false); setCurrentTime(0); setIsPlaying(false); }, [src]);

  const handleTimeUpdate = useCallback(() => {
    const t = videoRef.current?.currentTime || 0;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  }, [onTimeUpdate]);

  const handleLoadedMetadata = useCallback(() => {
    const d = videoRef.current?.duration || 0;
    setDuration(d);
    setIsLoaded(true);
    onDurationChange?.(d);
    onLoad?.();
  }, [onDurationChange, onLoad]);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play();
      setIsPlaying(true);
    } else {
      v.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleProgressClick = useCallback((e) => {
    const rect = progressRef.current?.getBoundingClientRect();
    if (!rect || !duration) return;
    const pct = (e.clientX - rect.left) / rect.width;
    const t = Math.max(0, Math.min(1, pct)) * duration;
    videoRef.current.currentTime = t;
    setCurrentTime(t);
    onTimeUpdate?.(t);
  }, [duration, onTimeUpdate]);

  const handleVolumeChange = useCallback((e) => {
    const v = parseFloat(e.target.value);
    setVolume(v);
    if (videoRef.current) {
      videoRef.current.volume = v;
      videoRef.current.muted = v === 0;
    }
    setIsMuted(v === 0);
  }, []);

  const toggleMute = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    const next = !isMuted;
    v.muted = next;
    setIsMuted(next);
  }, [isMuted]);

  const cyclePlaybackRate = useCallback(() => {
    const rates = [0.5, 1, 1.5, 2];
    const idx = rates.indexOf(playbackRate);
    const next = rates[(idx + 1) % rates.length];
    setPlaybackRate(next);
    if (videoRef.current) videoRef.current.playbackRate = next;
  }, [playbackRate]);

  const skipSeconds = useCallback((sec) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.max(0, Math.min(duration, v.currentTime + sec));
  }, [duration]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onEnded = () => setIsPlaying(false);
    v.addEventListener('ended', onEnded);
    return () => v.removeEventListener('ended', onEnded);
  }, []);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const progressPct = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className={styles.playerWrapper}>
      <video
        ref={videoRef}
        className={styles.video}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        muted={isMuted}
        playsInline
        preload="metadata"
        crossOrigin="anonymous"
      />

      {/* Controls overlay */}
      <div className={styles.controls}>
        {/* Progress bar */}
        <div
          ref={progressRef}
          className={styles.progressBar}
          onClick={handleProgressClick}
          role="slider"
          aria-label="Video progress"
        >
          <div className={styles.progressTrack}>
            <div className={styles.progressFill} style={{ width: `${progressPct}%` }} />
            <div className={styles.progressThumb} style={{ left: `${progressPct}%` }} />
          </div>
        </div>

        {/* Bottom controls row */}
        <div className={styles.controlsRow}>
          <div className={styles.leftControls}>
            <button className={styles.btn} onClick={() => skipSeconds(-10)} title="Back 10s">
              <SkipBack10Icon />
            </button>
            <button className={styles.btnPrimary} onClick={togglePlay} title="Play/Pause">
              {isPlaying ? <PauseIcon /> : <PlayIcon />}
            </button>
            <button className={styles.btn} onClick={() => skipSeconds(10)} title="Forward 10s">
              <SkipFwd10Icon />
            </button>

            <div className={styles.volumeGroup}>
              <button className={styles.btn} onClick={toggleMute} title="Mute">
                {isMuted ? <MutedIcon /> : <VolumeIcon />}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className={styles.volumeSlider}
              />
            </div>

            <span className={styles.timeDisplay}>
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className={styles.rightControls}>
            <button
              className={styles.rateBtn}
              onClick={cyclePlaybackRate}
              title="Playback speed"
            >
              {playbackRate}×
            </button>
          </div>
        </div>
      </div>

      {!isLoaded && (
        <div className={styles.loadingOverlay}>
          <div className={styles.spinner} />
          <span>Loading stream…</span>
        </div>
      )}
    </div>
  );
}

// SVG Icons
const PlayIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5,3 19,12 5,21" />
  </svg>
);
const PauseIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);
const SkipBack10Icon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V2L7 7l5 5V9c3.31 0 6 2.69 6 6s-2.69 6-6 6-6-2.69-6-6H4c0 4.42 3.58 8 8 8s8-3.58 8-8-3.58-8-8-8z"/>
    <text x="8" y="16" fontSize="6" fontFamily="sans-serif">10</text>
  </svg>
);
const SkipFwd10Icon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 5V2l5 5-5 5V9c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6h2c0 4.42-3.58 8-8 8s-8-3.58-8-8 3.58-8 8-8z"/>
    <text x="8" y="16" fontSize="6" fontFamily="sans-serif">10</text>
  </svg>
);
const VolumeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/>
  </svg>
);
const MutedIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
  </svg>
);
