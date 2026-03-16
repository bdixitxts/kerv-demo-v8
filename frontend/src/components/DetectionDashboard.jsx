import React, { useMemo } from 'react';
import styles from './DetectionDashboard.module.css';

const CATEGORY_COLORS = {
  people: '#7c3aed', fashion: '#ec4899', technology: '#3b82f6',
  transport: '#6366f1', accessories: '#f59e0b', home: '#10b981',
  appliances: '#06b6d4', kitchen: '#f97316', food: '#84cc16',
  sports: '#ef4444', travel: '#8b5cf6', animals: '#a3e635',
  media: '#64748b', personal_care: '#d946ef', tools: '#78716c',
  infrastructure: '#94a3b8', general: '#94a3b8',
  // Legacy
  electronics: '#3b82f6', furniture: '#10b981', fitness: '#ef4444',
  vehicles: '#6366f1', apparel: '#ec4899',
};

export default function DetectionDashboard({ detections, activeDetections, currentTime, duration }) {
  const stats = useMemo(() => {
    const categories = {};
    for (const d of detections) {
      categories[d.category] = (categories[d.category] || 0) + 1;
    }
    const topCat = Object.entries(categories).sort((a, b) => b[1] - a[1]);
    const avgConf = detections.length
      ? detections.reduce((s, d) => s + d.confidence, 0) / detections.length
      : 0;
    return { categories: topCat, avgConf, total: detections.length };
  }, [detections]);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  // Timeline segments
  const segments = useMemo(() => {
    return detections.map(d => ({
      ...d,
      leftPct: duration > 0 ? (d.time / duration) * 100 : 0,
      widthPct: duration > 0 ? ((d.endTime - d.time) / duration) * 100 : 0,
    }));
  }, [detections, duration]);

  const activeIds = new Set(activeDetections.map(d => d.id));

  return (
    <div className={styles.dashboard}>
      {/* Header */}
      <div className={styles.dashHeader}>
        <span className={styles.dashTitle}>Detection Intelligence</span>
        <div className={styles.statusPill}>
          <span className={styles.statusDot} />
          <span>LIVE</span>
        </div>
      </div>

      {/* KPI row */}
      <div className={styles.kpiRow}>
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{stats.total}</span>
          <span className={styles.kpiLabel}>Total Detections</span>
        </div>
        <div className={styles.kpiDivider} />
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{activeDetections.length}</span>
          <span className={styles.kpiLabel}>Active Now</span>
        </div>
        <div className={styles.kpiDivider} />
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{Math.round(stats.avgConf * 100)}%</span>
          <span className={styles.kpiLabel}>Avg Confidence</span>
        </div>
        <div className={styles.kpiDivider} />
        <div className={styles.kpi}>
          <span className={styles.kpiValue}>{stats.categories.length}</span>
          <span className={styles.kpiLabel}>Categories</span>
        </div>
      </div>

      {/* Detection timeline */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Object Timeline</div>
        <div className={styles.timeline}>
          {segments.map(seg => (
            <div
              key={seg.id}
              className={`${styles.timelineSegment} ${activeIds.has(seg.id) ? styles.segActive : ''}`}
              style={{
                left: `${seg.leftPct}%`,
                width: `${Math.max(seg.widthPct, 0.8)}%`,
                '--seg-color': CATEGORY_COLORS[seg.category] || '#94a3b8',
              }}
              title={`${seg.label} — ${seg.time.toFixed(1)}s to ${seg.endTime?.toFixed(1)}s`}
            />
          ))}
          <div className={styles.timelinePlayhead} style={{ left: `${progress}%` }} />
        </div>
        <div className={styles.timelineLabels}>
          <span>0:00</span>
          <span>{formatTime(duration / 2)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Category breakdown */}
      <div className={styles.section}>
        <div className={styles.sectionLabel}>Category Breakdown</div>
        <div className={styles.catList}>
          {stats.categories.map(([cat, count]) => {
            const color = CATEGORY_COLORS[cat] || '#94a3b8';
            const pct = stats.total > 0 ? (count / stats.total) * 100 : 0;
            return (
              <div key={cat} className={styles.catRow}>
                <span className={styles.catDot} style={{ background: color }} />
                <span className={styles.catName}>{cat}</span>
                <div className={styles.catBar}>
                  <div
                    className={styles.catBarFill}
                    style={{ width: `${pct}%`, background: color }}
                  />
                </div>
                <span className={styles.catCount}>{count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Active detections list */}
      {activeDetections.length > 0 && (
        <div className={styles.section}>
          <div className={styles.sectionLabel}>
            Active Detections
            <span className={styles.activeBadge}>{activeDetections.length}</span>
          </div>
          <div className={styles.activeList}>
            {activeDetections.map(d => (
              <div key={d.id} className={styles.activeItem}>
                <span
                  className={styles.activeColor}
                  style={{ background: CATEGORY_COLORS[d.category] || '#94a3b8' }}
                />
                <span className={styles.activeName}>
                  {d.productInfo?.name || d.label}
                </span>
                <span className={styles.activeConf}>
                  {Math.round(d.confidence * 100)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(s) {
  if (!s || isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
}
