import React from 'react';
import styles from './ProductCard.module.css';

const CATEGORY_COLORS = {
  footwear: '#00e5ff',
  accessories: '#a78bfa',
  apparel: '#fb7185',
  gear: '#34d399',
  electronics: '#fbbf24',
  fitness: '#f97316',
  general: '#94a3b8',
};

export default function ProductCard({ detection, isActive, onClick }) {
  const color = CATEGORY_COLORS[detection.category] || CATEGORY_COLORS.general;
  const info = detection.productInfo;

  return (
    <div
      className={`${styles.card} ${isActive ? styles.active : ''}`}
      style={{ '--card-color': color }}
      onClick={() => onClick?.(detection)}
      role="button"
      tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick?.(detection)}
    >
      <div className={styles.colorBar} />

      <div className={styles.iconArea}>
        <span className={styles.icon}>{getCategoryEmoji(detection.category)}</span>
        {isActive && <span className={styles.activePulse} />}
      </div>

      <div className={styles.content}>
        <div className={styles.category}>{detection.category}</div>
        <div className={styles.name}>{info?.name || detection.label}</div>
        {info?.brand && <div className={styles.brand}>{info.brand}</div>}
      </div>

      <div className={styles.meta}>
        {info?.price && <div className={styles.price}>{info.price}</div>}
        <div className={styles.conf} title="AI Confidence">
          {Math.round(detection.confidence * 100)}%
        </div>
      </div>

      <div className={styles.timeRange}>
        <span className={styles.timeDot} />
        <span>{detection.time.toFixed(1)}s</span>
      </div>
    </div>
  );
}

function getCategoryEmoji(cat) {
  const map = {
    footwear: '👟', accessories: '🎒', apparel: '🧥',
    gear: '💧', electronics: '⌚', fitness: '🧘',
    people: '👤', general: '📦',
  };
  return map[cat] || '📦';
}
