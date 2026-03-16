import React, { useMemo } from 'react';
import styles from './AnalyticsPage.module.css';

const CAT_COLORS = {
  // New YOLO12 taxonomy categories
  people:        '#7c3aed',
  fashion:       '#ec4899',
  technology:    '#3b82f6',
  transport:     '#6366f1',
  accessories:   '#f59e0b',
  home:          '#10b981',
  appliances:    '#06b6d4',
  kitchen:       '#f97316',
  food:          '#84cc16',
  sports:        '#ef4444',
  travel:        '#8b5cf6',
  animals:       '#a3e635',
  media:         '#64748b',
  personal_care: '#d946ef',
  tools:         '#78716c',
  infrastructure:'#94a3b8',
  general:       '#94a3b8',
  // Legacy v3 categories (backwards compat)
  electronics:   '#3b82f6',
  furniture:     '#10b981',
  fitness:       '#ef4444',
  vehicles:      '#6366f1',
  apparel:       '#ec4899',
  decor:         '#d946ef',
};

export default function AnalyticsPage({ video, metadata, compliance, onBack }) {
  const detections = metadata?.detections || [];

  const stats = useMemo(() => {
    const catMap = {};
    let totalConf = 0;
    for (const d of detections) {
      if (!catMap[d.category]) catMap[d.category] = { count: 0, labels: new Set(), totalConf: 0 };
      catMap[d.category].count++;
      catMap[d.category].labels.add(d.label);
      catMap[d.category].totalConf += d.confidence;
      totalConf += d.confidence;
    }
    const categories = Object.entries(catMap)
      .map(([cat, data]) => ({
        category: cat,
        count: data.count,
        labels: [...data.labels],
        avgConf: data.totalConf / data.count,
        pct: detections.length > 0 ? data.count / detections.length * 100 : 0,
      }))
      .sort((a, b) => b.count - a.count);

    const labelMap = {};
    for (const d of detections) {
      if (!labelMap[d.label]) labelMap[d.label] = { count: 0, totalConf: 0, category: d.category, times: [], bbox_pct: d.bbox_pct };
      labelMap[d.label].count++;
      labelMap[d.label].totalConf += d.confidence;
      labelMap[d.label].times.push(d.time);
    }
    const labels = Object.entries(labelMap)
      .map(([label, data]) => ({
        label,
        count: data.count,
        avgConf: data.totalConf / data.count,
        category: data.category,
        firstSeen: Math.min(...data.times),
        lastSeen: Math.max(...data.times),
        occurrences: data.count,
        bbox_pct: data.bbox_pct,
      }))
      .sort((a, b) => b.count - a.count);

    return {
      categories,
      labels,
      totalObjects: detections.length,
      uniqueLabels: labels.length,
      avgConf: detections.length > 0 ? totalConf / detections.length : 0,
      duration: metadata?.videoDuration || 0,
      fps: metadata?.videoFps || 0,
    };
  }, [detections, metadata]);

  const fmt = (s) => {
    if (!s && s !== 0) return '—';
    const m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={onBack}>
          ← Back to Player
        </button>
        <div className={styles.headerCenter}>
          <h1 className={styles.pageTitle}>Object-Level Analytics</h1>
          <span className={styles.videoName}>{video?.originalName}</span>
        </div>
        <div className={styles.headerBadge}>KERV Intelligence</div>
      </header>

      <div className={styles.content}>
        {/* KPI row */}
        <div className={styles.kpiRow}>
          <KpiCard icon="◆" label="Total Detections" value={stats.totalObjects} color="#7c3aed" />
          <KpiCard icon="◈" label="Unique Objects"   value={stats.uniqueLabels}  color="#3b82f6" />
          <KpiCard icon="◉" label="Categories"       value={stats.categories.length} color="#f59e0b" />
          <KpiCard icon="⚡" label="Avg Confidence"   value={`${Math.round(stats.avgConf * 100)}%`} color="#10b981" />
          <KpiCard icon="◎" label="Video Duration"   value={fmt(stats.duration)} color="#a855f7" />
          <KpiCard icon="▶" label="Safety Score"
            value={compliance?.safetyScore ? `${compliance.safetyScore}/100` : '—'}
            color={compliance?.verdict === 'SAFE' ? '#10b981' : '#f59e0b'}
          />
        </div>

        <div className={styles.gridTwo}>
          {/* Category breakdown */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Category Breakdown</h2>
              <span className={styles.cardSub}>{stats.categories.length} categories found</span>
            </div>
            <div className={styles.catList}>
              {stats.categories.map(cat => (
                <div key={cat.category} className={styles.catRow}>
                  <div className={styles.catLeft}>
                    <span className={styles.catDot} style={{ background: CAT_COLORS[cat.category] || '#94a3b8' }} />
                    <span className={styles.catName}>{cat.category}</span>
                  </div>
                  <div className={styles.catBar}>
                    <div
                      className={styles.catFill}
                      style={{ width: `${cat.pct}%`, background: CAT_COLORS[cat.category] || '#94a3b8' }}
                    />
                  </div>
                  <div className={styles.catRight}>
                    <span className={styles.catCount}>{cat.count}</span>
                    <span className={styles.catConf}>{Math.round(cat.avgConf * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Compliance summary */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>Brand Safety Analysis</h2>
              <span className={styles.cardSub}>IAB + GARM standards</span>
            </div>
            {compliance ? (
              <div className={styles.complianceBlock}>
                {/* Big verdict */}
                <div className={styles.verdictBig}
                  style={{ '--vc': compliance.verdict === 'SAFE' ? '#10b981' : compliance.verdict === 'REVIEW' ? '#f59e0b' : '#ef4444' }}>
                  <div className={styles.verdictBigLabel}>{compliance.verdict}</div>
                  <div className={styles.verdictBigScore}>{compliance.safetyScore}</div>
                  <div className={styles.verdictBigScoreLabel}>Safety Score</div>
                </div>

                <div className={styles.compStats}>
                  <CompStat label="Total Objects Checked" value={compliance.totalDetections} />
                  <CompStat label="Flagged Objects"        value={compliance.flaggedObjects}  color={compliance.flaggedObjects > 0 ? '#f59e0b' : '#10b981'} />
                  <CompStat label="High Risk Objects"      value={compliance.highRiskObjects} color={compliance.highRiskObjects > 0 ? '#ef4444' : '#10b981'} />
                </div>

                {compliance.iabCategories.length > 0 && (
                  <div className={styles.compCats}>
                    <div className={styles.compCatTitle}>IAB Content Categories</div>
                    <div className={styles.tagWrap}>
                      {compliance.iabCategories.map(c => (
                        <span key={c} className={styles.tagChip}>{c}</span>
                      ))}
                    </div>
                  </div>
                )}

                {compliance.garmFlags.length > 0 && (
                  <div className={styles.compCats}>
                    <div className={styles.compCatTitle}>GARM Brand Safety Flags</div>
                    <div className={styles.tagWrap}>
                      {compliance.garmFlags.map(f => (
                        <span key={f} className={`${styles.tagChip} ${styles.tagRed}`}>{f}</span>
                      ))}
                    </div>
                  </div>
                )}

                <div className={styles.compRec}>{compliance.recommendation}</div>
              </div>
            ) : (
              <div className={styles.noData}>No compliance data available</div>
            )}
          </div>
        </div>

        {/* Object-level table */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Object-Level Performance</h2>
            <span className={styles.cardSub}>{stats.labels.length} unique object types detected across the video</span>
          </div>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Object</th>
                  <th>Category</th>
                  <th>Detections</th>
                  <th>Avg Confidence</th>
                  <th>First Seen</th>
                  <th>Last Seen</th>
                  <th>Position (bbox)</th>
                  <th>Brand Safety</th>
                </tr>
              </thead>
              <tbody>
                {stats.labels.map((item) => {
                  const compObj = compliance?.perObject?.find(o => o.label === item.label);
                  const risk = compObj?.risk || 'NONE';
                  const color = CAT_COLORS[item.category] || '#94a3b8';
                  return (
                    <tr key={item.label} className={styles.tableRow}>
                      <td>
                        <div className={styles.labelCell}>
                          <span className={styles.labelDot} style={{ background: color }} />
                          <span className={styles.labelName}>{item.label}</span>
                        </div>
                      </td>
                      <td>
                        <span className={styles.catPill} style={{ background: `${color}18`, color }}>
                          {item.category}
                        </span>
                      </td>
                      <td>
                        <div className={styles.countCell}>
                          <div className={styles.countBar}>
                            <div className={styles.countFill}
                              style={{ width: `${Math.min(100, item.occurrences * 12)}%`, background: color }} />
                          </div>
                          <span>{item.occurrences}</span>
                        </div>
                      </td>
                      <td>
                        <ConfCell conf={item.avgConf} />
                      </td>
                      <td className={styles.timeCell}>{fmt(item.firstSeen)}</td>
                      <td className={styles.timeCell}>{fmt(item.lastSeen)}</td>
                      <td className={styles.bboxCell}>
                        {item.bbox_pct
                          ? `${item.bbox_pct[0].toFixed(1)}%, ${item.bbox_pct[1].toFixed(1)}%`
                          : '—'}
                      </td>
                      <td>
                        <span className={styles.riskBadge} data-risk={risk}>{risk}</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Detection timeline */}
        <div className={styles.card}>
          <div className={styles.cardHeader}>
            <h2 className={styles.cardTitle}>Detection Timeline</h2>
            <span className={styles.cardSub}>When each object type appears in the video</span>
          </div>
          <div className={styles.timeline}>
            {stats.labels.slice(0, 12).map((item) => {
              const color = CAT_COLORS[item.category] || '#94a3b8';
              const startPct = stats.duration > 0 ? (item.firstSeen / stats.duration) * 100 : 0;
              const endPct   = stats.duration > 0 ? (item.lastSeen  / stats.duration) * 100 : 100;
              return (
                <div key={item.label} className={styles.timelineRow}>
                  <div className={styles.timelineLabel}>{item.label}</div>
                  <div className={styles.timelineTrack}>
                    <div
                      className={styles.timelineBar}
                      style={{ left: `${startPct}%`, width: `${Math.max(endPct - startPct, 1)}%`, background: color }}
                      title={`${fmt(item.firstSeen)} → ${fmt(item.lastSeen)}`}
                    />
                  </div>
                  <div className={styles.timelineTimes}>{fmt(item.firstSeen)}</div>
                </div>
              );
            })}
            {/* Time axis */}
            <div className={styles.timeAxis}>
              <span>0:00</span>
              <span>{fmt(stats.duration / 4)}</span>
              <span>{fmt(stats.duration / 2)}</span>
              <span>{fmt(stats.duration * 3 / 4)}</span>
              <span>{fmt(stats.duration)}</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function KpiCard({ icon, label, value, color }) {
  return (
    <div className={styles.kpiCard} style={{ '--kc': color }}>
      <div className={styles.kpiIcon}>{icon}</div>
      <div className={styles.kpiValue}>{value}</div>
      <div className={styles.kpiLabel}>{label}</div>
    </div>
  );
}

function CompStat({ label, value, color }) {
  return (
    <div className={styles.compStatRow}>
      <span className={styles.compStatLabel}>{label}</span>
      <span className={styles.compStatValue} style={{ color: color || '#18103a' }}>{value}</span>
    </div>
  );
}

function ConfCell({ conf }) {
  const pct = Math.round(conf * 100);
  const color = pct >= 80 ? '#10b981' : pct >= 60 ? '#f59e0b' : '#ef4444';
  return (
    <div className={styles.confCell}>
      <div className={styles.confCellBar}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 2 }} />
      </div>
      <span style={{ color, fontFamily: 'JetBrains Mono, monospace', fontSize: 11 }}>{pct}%</span>
    </div>
  );
}
