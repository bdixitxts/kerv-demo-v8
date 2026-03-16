import { useState, useCallback, useRef } from 'react';

/**
 * useVideoTimeline v2
 *
 * Drives the shoppable-video overlay system.
 * On every timeupdate, determines which detections are currently
 * within their window [time → endTime] and returns them as activeDetections.
 *
 * Deduplication: only the highest-confidence detection per label
 * is active at any moment (prevents duplicate cards for the same object).
 *
 * @param {Array}  detections  - Full detection list from metadata
 * @param {number} lookahead   - Seconds ahead to pre-warm (default 0)
 */
export function useVideoTimeline(detections = [], lookahead = 0) {
  const [activeDetections, setActiveDetections] = useState([]);
  const lastTimeRef   = useRef(-1);
  const lastActiveRef = useRef('');   // serialised IDs to avoid redundant renders

  const updateTime = useCallback((currentTime) => {
    // Throttle: skip if time moved < 80ms (reduces render churn)
    if (Math.abs(currentTime - lastTimeRef.current) < 0.08) return;
    lastTimeRef.current = currentTime;

    const active = [];
    const seenLabels = new Map(); // label → best detection so far

    for (const det of detections) {
      const start = det.time;
      // endTime from detect.py, or fall back to time + duration field, or time + 3s
      const end = det.endTime ?? (det.time + (det.duration || 3));

      if (currentTime >= start && currentTime <= end + lookahead) {
        const existing = seenLabels.get(det.label);
        // Keep only the highest-confidence detection per label
        if (!existing || det.confidence > existing.confidence) {
          seenLabels.set(det.label, det);
        }
      }
    }

    const next = [...seenLabels.values()];

    // Only update state if the active set actually changed
    const nextIds = next.map(d => d.id).sort().join(',');
    if (nextIds !== lastActiveRef.current) {
      lastActiveRef.current = nextIds;
      setActiveDetections(next);
    }
  }, [detections, lookahead]);

  return { activeDetections, updateTime };
}
