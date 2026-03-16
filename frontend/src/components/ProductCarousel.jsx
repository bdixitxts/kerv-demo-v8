import React, { useRef } from 'react';
import ProductCard from './ProductCard';
import styles from './ProductCarousel.module.css';

export default function ProductCarousel({ detections, activeDetections, onSeekTo }) {
  const scrollRef = useRef(null);
  const activeIds = new Set(activeDetections.map(d => d.id));

  const scrollLeft = () => {
    scrollRef.current?.scrollBy({ left: -240, behavior: 'smooth' });
  };
  const scrollRight = () => {
    scrollRef.current?.scrollBy({ left: 240, behavior: 'smooth' });
  };

  if (!detections.length) return null;

  return (
    <div className={styles.carouselWrapper}>
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <span className={styles.headerLabel}>Detected Products</span>
          <span className={styles.badge}>{detections.length}</span>
        </div>
        <div className={styles.navBtns}>
          <button className={styles.navBtn} onClick={scrollLeft} aria-label="Scroll left">
            <ChevronLeft />
          </button>
          <button className={styles.navBtn} onClick={scrollRight} aria-label="Scroll right">
            <ChevronRight />
          </button>
        </div>
      </div>

      <div className={styles.scrollTrack} ref={scrollRef}>
        <div className={styles.scrollInner}>
          {detections.map((det) => (
            <ProductCard
              key={det.id}
              detection={det}
              isActive={activeIds.has(det.id)}
              onClick={(d) => onSeekTo?.(d.time)}
            />
          ))}
        </div>
      </div>

      <div className={styles.fadeLeft} />
      <div className={styles.fadeRight} />
    </div>
  );
}

const ChevronLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);
const ChevronRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);
