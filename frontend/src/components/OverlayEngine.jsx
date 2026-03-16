import React, { useState, useEffect } from 'react';
import styles from './OverlayEngine.module.css';

/**
 * OverlayEngine v5
 * Pure pulse-dot overlay — no chips, no cards, no images on the video.
 * Each active detection shows a single pulsing dot at its bbox centre.
 * Clicking a dot fires onDotClick(detection).
 */
export default function OverlayEngine({ activeDetections, onDotClick, activeDotId }) {
  const [hoveredId, setHoveredId] = useState(null);

  useEffect(() => {
    setHoveredId(null);
  }, [activeDetections.map(d => d.id).join(',')]);

  if (!activeDetections.length) return null;

  return (
    <div className={styles.root}>
      {activeDetections.map((det, i) => {
        const [bx, by, bw, bh] = det.bbox_pct || [50, 50, 10, 10];
        const cx = bx + bw / 2;
        const cy = by + bh / 2;
        const isActive  = activeDotId === det.id;
        const isHovered = hoveredId   === det.id;
        const color = det.categoryColor || '#7c3aed';

        return (
          <button
            key={det.id}
            className={`${styles.dot} ${isActive ? styles.dotActive : ''} ${isHovered ? styles.dotHovered : ''}`}
            style={{
              left: `${cx}%`,
              top:  `${cy}%`,
              '--dc': color,
              animationDelay: `${i * 100}ms`,
            }}
            onMouseEnter={() => setHoveredId(det.id)}
            onMouseLeave={() => setHoveredId(null)}
            onClick={() => onDotClick?.(det)}
            title={det.label}
          >
            {/* Three concentric rings — pulse outward */}
            <span className={styles.ring3} />
            <span className={styles.ring2} />
            <span className={styles.ring1} />
            {/* Core */}
            <span className={styles.core} />

            {/* Hover label — tiny pill, no card */}
            {isHovered && (
              <span className={styles.hoverLabel} style={{ '--dc': color }}>
                {det.categoryIcon} {det.label}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
