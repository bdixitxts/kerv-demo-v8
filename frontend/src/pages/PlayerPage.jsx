import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { fetchVideoMetadata } from '../services/metadataApi';
import { useVideoTimeline } from '../hooks/useVideoTimeline';
import VideoPlayer from '../components/VideoPlayer';
import VideoCardStack from '../components/VideoCardStack';
import LiveDetectionPanel from '../components/LiveDetectionPanel';
import styles from './PlayerPage.module.css';

/**
 * PlayerPage v6 — Automatic shoppable video
 *
 * No manual selection. The video timeline drives everything:
 *   • As the video plays, useVideoTimeline computes which detections
 *     are currently within their [time → endTime] window.
 *   • VideoCardStack renders those as cards on the LEFT edge of the video.
 *   • LiveDetectionPanel (right) shows a "Live Now" feed + full object list.
 *   • Clicking any card/row seeks the video and opens the product link.
 */
export default function PlayerPage({ video, onBack, onViewAnalytics }) {
  const { token, API, authFetch }           = useAuth();
  const [metadata, setMetadata]             = useState(null);
  const [productMatches, setProductMatches] = useState({});
  const [compliance, setCompliance]         = useState(null);
  const [loading, setLoading]               = useState(true);
  const [error, setError]                   = useState(null);
  const [currentTime, setCurrentTime]       = useState(0);
  const [duration, setDuration]             = useState(0);
  const videoRef = useRef(null);
  const retryRef = useRef(null);

  const streamUrl = video?.id
    ? `${API}/videos/${video.id}/stream?token=${token}`
    : null;

  // ── Load metadata + products + compliance in parallel ────────────────────
  const load = useCallback(async (attempt = 1) => {
    setLoading(true); setError(null);
    try {
      const meta = await fetchVideoMetadata(video.id);
      setMetadata(meta);

      const dets = meta.detections || [];
      if (dets.length > 0) {
        const [matchRes, compRes] = await Promise.all([
          authFetch('/products/match-batch', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              detections: dets.map(d => ({ id: d.id, label: d.label, category: d.category })),
            }),
          }),
          authFetch('/compliance/check', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              detections: dets.map(d => ({ id: d.id, label: d.label, category: d.category })),
            }),
          }),
        ]);
        const { matches } = await matchRes.json();
        setProductMatches(matches || {});
        setCompliance(await compRes.json());
      }
      setLoading(false);
    } catch (err) {
      if (attempt < 5 && err.message?.includes('not complete')) {
        retryRef.current = setTimeout(() => load(attempt + 1), 1500);
      } else {
        setError(err.message);
        setLoading(false);
      }
    }
  }, [video?.id]);

  useEffect(() => {
    if (!video?.id) return;
    load();
    return () => { if (retryRef.current) clearTimeout(retryRef.current); };
  }, [video?.id]);

  // ── Timeline hook — drives active detections from video time ─────────────
  const detections = metadata?.detections || [];
  const { activeDetections, updateTime } = useVideoTimeline(detections);

  const handleTimeUpdate = useCallback((t) => {
    setCurrentTime(t);
    updateTime(t);
  }, [updateTime]);

  // Seek video to a timestamp (used by panel rows and card clicks)
  const handleSeek = useCallback((time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      videoRef.current.play().catch(() => {});
    }
  }, []);

  const verdictColor = compliance?.verdict === 'SAFE' ? '#10b981'
    : compliance?.verdict === 'REVIEW' ? '#f59e0b' : '#ef4444';

  return (
    <div className={styles.page}>

      {/* ── Header ── */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
          Library
        </button>

        <div className={styles.headerCenter}>
          <span className={styles.videoTitle}>{video?.originalName}</span>
          {metadata && (
            <span className={styles.detBadge}>{detections.length} objects detected</span>
          )}
        </div>

        <div className={styles.headerRight}>
          {compliance && (
            <div className={styles.verdictChip} style={{ '--vc': verdictColor }}>
              <span className={styles.verdictDot} />
              {compliance.verdict}
              <span className={styles.verdictScore}>{compliance.safetyScore}</span>
            </div>
          )}
          {activeDetections.length > 0 && (
            <div className={styles.liveChip}>
              <span className={styles.liveDot} />
              {activeDetections.length} active
            </div>
          )}
          <button
            className={styles.analyticsBtn}
            onClick={() => onViewAnalytics?.(video, metadata, compliance)}
          >
            Analytics →
          </button>
        </div>
      </header>

      {/* ── Body ── */}
      <main className={styles.main}>
        {loading ? (
          <div className={styles.loading}>
            <div className={styles.spinner} />
            <span>Loading shoppable video…</span>
            <span className={styles.loadSub}>Matching objects to product catalogue</span>
          </div>
        ) : error ? (
          <div className={styles.errorState}>
            <span className={styles.errorIcon}>⚠</span>
            <span>{error}</span>
            <button className={styles.retryBtn} onClick={() => load()}>Retry</button>
          </div>
        ) : (
          <>
            {/* ── Left: video + auto overlay cards ── */}
            <div className={styles.videoWrap}>
              <div className={styles.videoStage}>
                <VideoPlayer
                  videoUrl={streamUrl}
                  videoRef={videoRef}
                  onTimeUpdate={handleTimeUpdate}
                  onDurationChange={setDuration}
                />

                {/*
                  VideoCardStack is positioned inside videoStage (position:relative).
                  Cards appear automatically on the LEFT edge of the video as the
                  timeline drives activeDetections in and out.
                */}
                <VideoCardStack
                  activeDetections={activeDetections}
                  productMatches={productMatches}
                  onCardClick={det => handleSeek(det.time)}
                />
              </div>

              {/* Meta strip */}
              <div className={styles.metaStrip}>
                <MetaChip icon="◎" label="Model"      value={metadata?.model?.split('.')[0] || '—'} />
                <MetaChip icon="⚡" label="FPS"        value={metadata?.videoFps?.toFixed(0) || '—'} />
                <MetaChip icon="◈" label="Resolution"  value={metadata?.videoSize ? `${metadata.videoSize[0]}×${metadata.videoSize[1]}` : '—'} />
                <MetaChip icon="◆" label="Objects"     value={detections.length} accent />
                <MetaChip icon="◉" label="Categories"  value={[...new Set(detections.map(d => d.category))].length} />
              </div>
            </div>

            {/* ── Right: Live detection panel ── */}
            <aside className={styles.panel}>
              <LiveDetectionPanel
                allDetections={detections}
                activeDetections={activeDetections}
                productMatches={productMatches}
                currentTime={currentTime}
                duration={duration || metadata?.videoDuration || 0}
                onSeek={handleSeek}
              />
            </aside>
          </>
        )}
      </main>
    </div>
  );
}

function MetaChip({ icon, label, value, accent }) {
  return (
    <div className={styles.metaChip}>
      <span className={styles.metaIcon}>{icon}</span>
      <div>
        <div className={styles.metaLabel}>{label}</div>
        <div className={`${styles.metaValue} ${accent ? styles.metaAccent : ''}`}>{value}</div>
      </div>
    </div>
  );
}
