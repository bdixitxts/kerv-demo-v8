import React, { useState, useEffect, useRef, useCallback } from 'react';
import styles from './ObjectPanel.module.css';

/**
 * ObjectPanel v5
 *
 * Two-view right-side panel:
 *
 * VIEW 1 — "Objects" tab (selection list)
 *   Shows every unique detected object with its crop image, label, category,
 *   confidence and a checkbox. User selects which objects to "stack".
 *   A "Stack Selected" CTA at the bottom confirms the selection.
 *
 * VIEW 2 — "Stack" tab (KERV-style product cards)
 *   Only the user-selected objects appear here as stacked product cards,
 *   each with hero image, product name/brand/price and a clickable "Shop →" CTA.
 *   Cards animate in from the right, active card (synced with video playhead)
 *   is highlighted. Clicking a card seeks the video.
 */
export default function ObjectPanel({
  detections,          // all detections from metadata
  productMatches,      // { detId → product }
  activeDotId,         // currently active detection (synced with video)
  onCardClick,         // (det) → seek video + highlight dot
  onStackChange,       // (stackedItems[]) → called when user confirms stack
  externalStacked,     // optional controlled stacked list from parent
}) {
  const [view, setView]               = useState('objects');   // 'objects' | 'stack'
  const [selected, setSelected]       = useState(new Set());   // selected det IDs
  const [stacked, setStacked]         = useState([]);          // confirmed stack list
  const stackRef                      = useRef(null);

  // Deduplicate detections by label — one row per unique object type
  const uniqueByLabel = useCallback(() => {
    const seen = new Set();
    return detections.filter(d => {
      if (seen.has(d.label)) return false;
      seen.add(d.label);
      return true;
    });
  }, [detections]);

  const rows = uniqueByLabel();

  // Sync from external stacked list if parent provides it
  React.useEffect(() => {
    if (externalStacked && externalStacked.length !== stacked.length) {
      setStacked(externalStacked);
    }
  }, [externalStacked]);

  // Scroll active card into view in stack
  useEffect(() => {
    if (!activeDotId || !stackRef.current) return;
    const el = stackRef.current.querySelector(`[data-id="${activeDotId}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [activeDotId]);

  const toggleSelect = (id) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selected.size === rows.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(rows.map(d => d.id)));
    }
  };

  const confirmStack = () => {
    const items = rows.filter(d => selected.has(d.id));
    setStacked(items);
    onStackChange?.(items);   // lift stacked state to PlayerPage
    setView('stack');
  };

  const allSelected = rows.length > 0 && selected.size === rows.length;
  const noneSelected = selected.size === 0;

  return (
    <div className={styles.panel}>

      {/* ── Panel header with tab switcher ── */}
      <div className={styles.header}>
        <button
          className={`${styles.tabBtn} ${view === 'objects' ? styles.tabActive : ''}`}
          onClick={() => setView('objects')}
        >
          <span className={styles.tabIcon}>◈</span>
          Objects
          <span className={styles.tabBadge}>{rows.length}</span>
        </button>
        <button
          className={`${styles.tabBtn} ${view === 'stack' ? styles.tabActive : ''}`}
          onClick={() => setView('stack')}
        >
          <span className={styles.tabIcon}>▦</span>
          Stack
          {stacked.length > 0 && (
            <span className={`${styles.tabBadge} ${styles.tabBadgePurple}`}>{stacked.length}</span>
          )}
        </button>
      </div>

      {/* ── VIEW 1: Object selection list ── */}
      {view === 'objects' && (
        <div className={styles.objectView}>

          {/* Toolbar */}
          <div className={styles.listToolbar}>
            <button className={styles.selectAllBtn} onClick={toggleAll}>
              <span className={`${styles.checkbox} ${allSelected ? styles.checkboxOn : ''}`}>
                {allSelected ? '✓' : ''}
              </span>
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
            {!noneSelected && (
              <span className={styles.selCount}>{selected.size} selected</span>
            )}
          </div>

          {/* List */}
          <div className={styles.list}>
            {rows.length === 0 ? (
              <div className={styles.emptyState}>
                <span className={styles.emptyIcon}>◈</span>
                <span className={styles.emptyText}>No objects detected</span>
                <span className={styles.emptySub}>Play the video to detect objects</span>
              </div>
            ) : rows.map((det, i) => {
              const isChecked = selected.has(det.id);
              const catColor  = det.categoryColor || '#7c3aed';
              const product   = productMatches[det.id];

              return (
                <div
                  key={det.id}
                  className={`${styles.row} ${isChecked ? styles.rowChecked : ''}`}
                  onClick={() => toggleSelect(det.id)}
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  {/* Checkbox */}
                  <span className={`${styles.checkbox} ${isChecked ? styles.checkboxOn : ''}`}
                    style={isChecked ? { '--cc': catColor } : {}}>
                    {isChecked ? '✓' : ''}
                  </span>

                  {/* Crop thumbnail */}
                  <div className={styles.rowThumb}>
                    {det.cropImage
                      ? <img src={det.cropImage} alt={det.label} className={styles.rowThumbImg} />
                      : <div className={styles.rowThumbFallback} style={{ background: `${catColor}20` }}>
                          <span>{det.categoryIcon || '◈'}</span>
                        </div>
                    }
                  </div>

                  {/* Info */}
                  <div className={styles.rowInfo}>
                    <div className={styles.rowLabel}>{det.label}</div>
                    <div className={styles.rowMeta}>
                      <span className={styles.rowCat} style={{ color: catColor }}>
                        {det.categoryIcon} {det.categoryLabel || det.category}
                      </span>
                      {product && (
                        <span className={styles.rowProduct}>{product.name}</span>
                      )}
                    </div>
                    <div className={styles.rowConf}>
                      <div className={styles.confBar}>
                        <div className={styles.confFill}
                          style={{ width: `${Math.round(det.confidence * 100)}%`, background: catColor }} />
                      </div>
                      <span className={styles.confValue}>{Math.round(det.confidence * 100)}%</span>
                    </div>
                  </div>

                  {/* Price */}
                  {product && (
                    <div className={styles.rowPrice}>{product.price}</div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Stack CTA */}
          {!noneSelected && (
            <div className={styles.stackCta}>
              <button className={styles.stackBtn} onClick={confirmStack}>
                Stack {selected.size} object{selected.size !== 1 ? 's' : ''} →
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── VIEW 2: Stacked product cards (KERV-style) ── */}
      {view === 'stack' && (
        <div className={styles.stackView}>
          {stacked.length === 0 ? (
            <div className={styles.emptyState}>
              <span className={styles.emptyIcon}>▦</span>
              <span className={styles.emptyText}>No objects stacked</span>
              <span className={styles.emptySub}>
                Select objects from the list, then click "Stack" —<br/>
                they'll appear as cards on the video itself.
              </span>
              <button className={styles.goSelectBtn} onClick={() => setView('objects')}>
                ← Select objects
              </button>
            </div>
          ) : (
            <>
              <div className={styles.stackHeader}>
                <span className={styles.stackTitle}>{stacked.length} object{stacked.length !== 1 ? 's' : ''} stacked</span>
                <button className={styles.editBtn} onClick={() => setView('objects')}>Edit</button>
              </div>

              <div className={styles.stackList} ref={stackRef}>
                {stacked.map((det, i) => {
                  const product   = productMatches[det.id];
                  const isActive  = activeDotId === det.id;
                  const catColor  = det.categoryColor || '#7c3aed';

                  return (
                    <div
                      key={det.id}
                      data-id={det.id}
                      className={`${styles.card} ${isActive ? styles.cardActive : ''}`}
                      onClick={() => onCardClick?.(det)}
                      style={{ animationDelay: `${i * 60}ms` }}
                    >
                      {/* Active left accent */}
                      <div className={styles.cardAccent} style={{ background: catColor }} />

                      {/* Hero image */}
                      <div className={styles.cardHero}>
                        {det.cropImage
                          ? <img src={det.cropImage} alt={det.label} className={styles.cardHeroImg} />
                          : <div className={styles.cardHeroFallback} style={{ background: `${catColor}15` }}>
                              <span style={{ fontSize: 30 }}>{det.categoryIcon || '◈'}</span>
                            </div>
                        }
                        {/* Live pulse when active */}
                        {isActive && <div className={styles.cardLivePulse} style={{ '--pc': catColor }} />}

                        {/* Category over image */}
                        <div className={styles.cardCat} style={{ '--cc': catColor }}>
                          {det.categoryIcon} {det.categoryLabel || det.category}
                        </div>
                      </div>

                      {/* Card body */}
                      <div className={styles.cardBody}>
                        <div className={styles.cardObjectLabel}>{det.label}</div>
                        {product ? (
                          <>
                            <div className={styles.cardName}>{product.name}</div>
                            <div className={styles.cardBrand}>{product.brand}</div>
                          </>
                        ) : (
                          <div className={styles.cardName} style={{ color: '#9b8ec4' }}>No product match</div>
                        )}

                        <div className={styles.cardFooter}>
                          <span className={styles.cardPrice}>{product?.price || '—'}</span>
                          {product?.url ? (
                            <a
                              href={product.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={styles.shopBtn}
                              style={{ '--cc': catColor }}
                              onClick={e => e.stopPropagation()}
                            >
                              Shop Now →
                            </a>
                          ) : (
                            <span className={styles.noProduct}>Not in catalogue</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
