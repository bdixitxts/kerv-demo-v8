import React, { useState, useEffect, useRef } from 'react';
import styles from './VideoCardStack.module.css';

/**
 * VideoCardStack v3
 *
 * Matches the KERV demo exactly (screenshots provided):
 *
 * LAYOUT:
 *   • Stack positioned with ~12px margin from left edge of video
 *   • Each card is a white rounded square thumbnail (~110×110px)
 *   • Cards stacked vertically with 8px gap
 *
 * COLLAPSED:
 *   • White square, fully rounded corners, drop shadow
 *   • Product crop image fills the square
 *   • Small × dismiss button top-right
 *   • No text on the collapsed card at all
 *
 * HOVER (not click):
 *   • White info popup appears to the RIGHT of the thumbnail
 *   • Contains: product image (left column) + name/description/Shop Now (right)
 *   • Expands with smooth fade+slide animation
 *   • Collapses automatically when mouse leaves the entire entry
 *   • The whole popup is a clickable link to the product page
 *
 * FILTERING:
 *   • 'people' and 'animals' categories are NEVER shown as overlay cards
 *   • Only shoppable product categories appear
 *
 * Props:
 *   activeDetections  — from useVideoTimeline (already time-filtered)
 *   productMatches    — { detId → product }
 *   onCardClick       — (det) → optional seek callback
 */

// Categories that should NEVER show as shoppable overlay cards
const NON_SHOPPABLE = new Set([
  'people', 'animals', 'infrastructure', 'general',
  // raw YOLO labels that map to non-shoppable
  'person', 'bird', 'cat', 'dog', 'horse', 'sheep',
  'cow', 'elephant', 'bear', 'zebra', 'giraffe',
]);

function isShoppable(det) {
  return !NON_SHOPPABLE.has(det.category) && !NON_SHOPPABLE.has(det.label?.toLowerCase());
}

export default function VideoCardStack({ activeDetections = [], productMatches = {}, onCardClick }) {
  const [hoveredId, setHoveredId]       = useState(null);
  const [dismissedIds, setDismissedIds] = useState(new Set());
  const prevIdsRef = useRef(new Set());

  // When detections leave the window → un-dismiss so they can reappear
  useEffect(() => {
    const incoming = new Set(activeDetections.map(d => d.id));
    const outgoing = new Set([...prevIdsRef.current].filter(id => !incoming.has(id)));
    if (outgoing.size > 0) {
      setDismissedIds(prev => {
        const next = new Set(prev);
        outgoing.forEach(id => next.delete(id));
        return next;
      });
      setHoveredId(prev => outgoing.has(prev) ? null : prev);
    }
    prevIdsRef.current = incoming;
  }, [activeDetections]);

  // Only show shoppable, non-dismissed cards
  const visible = activeDetections.filter(d => isShoppable(d) && !dismissedIds.has(d.id));
  if (!visible.length) return null;

  const dismiss = (id, e) => {
    e.stopPropagation();
    e.preventDefault();
    setDismissedIds(prev => new Set([...prev, id]));
    if (hoveredId === id) setHoveredId(null);
  };

  return (
    <div className={styles.stack}>
      {visible.map((det, i) => {
        const product   = productMatches?.[det.id];
        const isHovered = hoveredId === det.id;
        const url = product?.url
          || `https://www.google.com/search?q=${encodeURIComponent((product?.name || det.label) + ' buy')}`;

        return (
          <div
            key={det.id}
            className={styles.entry}
            style={{ '--i': i }}
            onMouseEnter={() => setHoveredId(det.id)}
            onMouseLeave={() => setHoveredId(null)}
          >
            {/* ── Collapsed card (always visible) ── */}
            <div className={styles.card}>
              {det.cropImage
                ? <img src={det.cropImage} alt={det.label} className={styles.cardImg} draggable={false} />
                : <div className={styles.cardFallback}>
                    <span className={styles.cardIcon}>{det.categoryIcon || '◈'}</span>
                    <span className={styles.cardFallbackLabel}>{det.label}</span>
                  </div>
              }

              {/* × dismiss */}
              <button
                className={styles.dismissBtn}
                onMouseDown={e => dismiss(det.id, e)}
                aria-label="Dismiss"
              >×</button>
            </div>

            {/* ── Hover popup — expands RIGHT of the card ── */}
            {isHovered && (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.popup}
                onClick={() => onCardClick?.(det)}
              >
                {/* Left column: product image */}
                <div className={styles.popupImg}>
                  {det.cropImage
                    ? <img src={det.cropImage} alt={det.label} className={styles.popupImgEl} draggable={false} />
                    : <div className={styles.popupImgFallback} style={{ background: `${det.categoryColor || '#7c3aed'}12` }}>
                        <span style={{ fontSize: 28 }}>{det.categoryIcon || '◈'}</span>
                      </div>
                  }
                </div>

                {/* Right column: text */}
                <div className={styles.popupBody}>
                  <div className={styles.popupName}>
                    {product?.name || det.label}
                  </div>
                  {product?.brand && (
                    <div className={styles.popupDesc}>{product.brand}</div>
                  )}
                  {product?.price && (
                    <div className={styles.popupPrice}>{product.price}</div>
                  )}
                  <span className={styles.shopNow}>Shop Now</span>
                </div>
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
