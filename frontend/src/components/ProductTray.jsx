import React, { useEffect, useRef } from 'react';
import styles from './ProductTray.module.css';

/**
 * ProductTray v4 — right-side stacked product panel.
 * Uses categoryIcon / categoryLabel / categoryColor from new YOLO12 output.
 */
export default function ProductTray({ detections, productMatches, activeDotId, onCardClick }) {
  const listRef = useRef(null);

  // Deduplicate: one card per unique matched product
  const seen = new Set();
  const items = detections.filter(d => {
    const product = productMatches[d.id];
    if (!product || seen.has(product.id)) return false;
    seen.add(product.id);
    return true;
  });

  useEffect(() => {
    if (!activeDotId || !listRef.current) return;
    const el = listRef.current.querySelector(`[data-id="${activeDotId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeDotId]);

  if (!items.length) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>◈</div>
        <div className={styles.emptyText}>No products detected yet</div>
        <div className={styles.emptySub}>Products appear as the video plays</div>
      </div>
    );
  }

  return (
    <div className={styles.tray} ref={listRef}>
      {items.map((det) => {
        const product  = productMatches[det.id];
        const isActive = activeDotId === det.id;
        const catColor = det.categoryColor || '#7c3aed';
        const catIcon  = det.categoryIcon  || '◈';
        const catLabel = det.categoryLabel || det.category;

        return (
          <div
            key={det.id}
            data-id={det.id}
            className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
            onClick={() => onCardClick?.(det)}
          >
            {/* Active left bar */}
            <div className={styles.activeBar} style={{ '--ac': catColor }} />

            {/* Hero crop image */}
            <div className={styles.heroWrap}>
              {det.cropImage
                ? <img src={det.cropImage} alt={det.label} className={styles.heroImg} />
                : <div className={styles.heroPlaceholder} style={{ background: `${catColor}18` }}>
                    <span style={{ fontSize: 26 }}>{catIcon}</span>
                  </div>
              }
              {/* Category pill over image */}
              <div className={styles.catPill} style={{ '--cc': catColor }}>
                <span>{catIcon}</span>
                <span>{catLabel}</span>
              </div>
              {/* Confidence badge */}
              <div className={styles.confBadge}>
                {Math.round(det.confidence * 100)}%
              </div>
            </div>

            {/* Body */}
            <div className={styles.body}>
              <div className={styles.detectedLabel}>{det.label}</div>
              {product && (
                <>
                  <div className={styles.productName}>{product.name}</div>
                  <div className={styles.productBrand}>{product.brand}</div>
                </>
              )}

              <div className={styles.footer}>
                <span className={styles.price}>{product?.price || '—'}</span>
                {product?.url && (
                  <a
                    href={product.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.ctaBtn}
                    style={{ '--cc': catColor }}
                    onClick={e => e.stopPropagation()}
                  >
                    Shop →
                  </a>
                )}
              </div>
            </div>

            {det.occurrences > 1 && (
              <div className={styles.occPill}>{det.occurrences}×</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
