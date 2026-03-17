import React, { useRef, useEffect } from 'react';
import styles from './LiveDetectionPanel.module.css';

// Same exclusion list as VideoCardStack — living things never shown as shoppable
const NON_SHOPPABLE = new Set([
  'people', 'animals', 'infrastructure', 'general',
  'person', 'bird', 'cat', 'dog', 'horse', 'sheep',
  'cow', 'elephant', 'bear', 'zebra', 'giraffe',
]);
const isShoppable = d => !NON_SHOPPABLE.has(d.category) && !NON_SHOPPABLE.has(d.label?.toLowerCase());


/**
 * LiveDetectionPanel — right-side panel for the shoppable video player.
 *
 * Two sections:
 *   TOP   — "Live Now" — cards currently active on the video (auto-updates)
 *   BOTTOM — "All Objects" — full timeline list of every detection, sorted by
 *            first appearance. Clicking any row seeks the video to that time.
 *
 * No manual selection, no checkboxes. Fully driven by timeline.
 */
export default function LiveDetectionPanel({
  allDetections,      // full list from metadata
  activeDetections,   // currently active (from useVideoTimeline)
  productMatches,     // { detId → product }
  currentTime,        // current video playback time
  duration,           // total video duration
  onSeek,             // (time) → seek video
}) {
  const liveRef = useRef(null);
  const liveActive = activeDetections.filter(isShoppable);

  // Auto-scroll live section when new cards appear
  useEffect(() => {
    if (liveRef.current && activeDetections.length > 0) {
      liveRef.current.scrollTop = 0;
    }
  }, [activeDetections.map(d => d.id).join(',')]);

  // Deduplicate allDetections by label for the timeline list
  const seen = new Set();
  const timelineRows = allDetections.filter(d => {
    if (seen.has(d.label)) return false;
    seen.add(d.label);
    return true;
  });

  const fmt = (s) => {
    if (!s && s !== 0) return '0:00';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className={styles.panel}>

      {/* ── LIVE NOW section ── */}
      <div className={styles.liveSection}>
        <div className={styles.sectionHead}>
          <span className={styles.liveDot} />
          <span className={styles.sectionTitle}>Live Now</span>
          {liveActive.length > 0 && (
            <span className={styles.liveCount}>{liveActive.length}</span>
          )}
        </div>

        <div className={styles.liveList} ref={liveRef}>
          {liveActive.length === 0 ? (
            <div className={styles.liveEmpty}>
              <span>No shoppable objects at {fmt(currentTime)}</span>
            </div>
          ) : liveActive.map(det => {
            const product  = productMatches?.[det.id];
            const catColor = det.categoryColor || '#7c3aed';
            const url = product?.url
              || `https://www.google.com/search?q=${encodeURIComponent((product?.name || det.label) + ' buy')}`;

            return (
              <a
                key={det.id}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.liveCard}
                style={{ '--cc': catColor }}
              >
                {/* Image */}
                <div className={styles.liveCardImg}>
                  {det.cropImage
                    ? <img src={det.cropImage} alt={det.label} className={styles.liveCardImgEl} />
                    : <div className={styles.liveCardImgFallback} style={{ background: `${catColor}14` }}>
                        <span style={{ fontSize: 26 }}>{det.categoryIcon || '◈'}</span>
                        <span style={{ fontSize: 9, color: catColor, fontWeight: 700, textTransform: 'capitalize', marginTop: 2 }}>{det.label}</span>
                      </div>
                  }
                  {/* Live pulse dot */}
                  <span className={styles.livePulseDot} style={{ background: catColor }} />
                </div>

                {/* Text */}
                <div className={styles.liveCardBody}>
                  <div className={styles.liveCardCat} style={{ color: catColor }}>
                    {det.categoryIcon} {det.categoryLabel || det.category}
                  </div>
                  <div className={styles.liveCardName}>
                    {product?.name || det.label}
                  </div>
                  {product?.brand && (
                    <div className={styles.liveCardBrand}>{product.brand}</div>
                  )}
                  {product?.price && (
                    <div className={styles.liveCardPrice}>{product.price}</div>
                  )}
                  <span className={styles.liveCardShop}>Shop Now →</span>
                </div>
              </a>
            );
          })}
        </div>
      </div>

      {/* ── DIVIDER ── */}
      <div className={styles.divider} />

      {/* ── ALL OBJECTS timeline list ── */}
      <div className={styles.timelineSection}>
        <div className={styles.sectionHead}>
          <span className={styles.sectionTitle}>All Detected Objects</span>
          <span className={styles.allCount}>{timelineRows.length}</span>
        </div>

        <div className={styles.timelineList}>
          {timelineRows.length === 0 ? (
            <div className={styles.timelineEmpty}>No detections in this video</div>
          ) : timelineRows.map((det, i) => {
            const product  = productMatches?.[det.id];
            const catColor = det.categoryColor || '#7c3aed';
            const isActive = activeDetections.some(a => a.label === det.label);
            const shoppable = isShoppable(det);
            const timePct  = duration > 0 ? (det.time / duration) * 100 : 0;

            return (
              <button
                key={det.id}
                className={`${styles.timelineRow} ${isActive ? styles.timelineRowActive : ''}`}
                onClick={() => onSeek?.(det.time)}
                style={{ '--cc': catColor, animationDelay: `${i * 25}ms`, opacity: shoppable ? 1 : 0.5 }}
                title={shoppable ? 'Click to seek' : `${det.categoryLabel || det.category} — not shoppable`}
              >
                {/* Tiny thumbnail */}
                <div className={styles.tlThumb}>
                  {det.cropImage
                    ? <img src={det.cropImage} alt={det.label} className={styles.tlThumbImg} />
                    : <div className={styles.tlThumbFallback} style={{ background: `${catColor}14`, flexDirection: 'column', gap: 1 }}>
                        <span style={{ fontSize: 14 }}>{det.categoryIcon || '◈'}</span>
                        <span style={{ fontSize: 7, color: catColor, fontWeight: 700, textTransform: 'capitalize' }}>{det.label}</span>
                      </div>
                  }
                </div>

                {/* Info */}
                <div className={styles.tlInfo}>
                  <div className={styles.tlLabel}>{det.label}</div>
                  {product && (
                    <div className={styles.tlProduct}>{product.name}</div>
                  )}
                  {/* Mini timeline bar */}
                  <div className={styles.tlBar}>
                    <div className={styles.tlBarFill}
                      style={{ left: `${timePct}%`, background: catColor }} />
                  </div>
                </div>

                {/* Time + active badge */}
                <div className={styles.tlRight}>
                  <span className={styles.tlTime}>{fmt(det.time)}</span>
                  {isActive && shoppable && (
                    <span className={styles.tlActiveBadge}>Live</span>
                  )}
                  {!shoppable && (
                    <span className={styles.tlNonShoppable}>No shop</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
