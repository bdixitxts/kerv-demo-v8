/**
 * Compliance route — IAB/IAM content safety validation.
 *
 * IAB Tech Lab Content Taxonomy v3 + Brand Safety categories.
 * Each detected object label is checked against:
 *   1. IAB Content Categories (sensitive segments)
 *   2. GARM Brand Safety Floor
 *   3. Custom blocklist
 *
 * In production, connect to: DoubleVerify, IAS, Oracle MOAT,
 * or the IAB Tech Lab API directly.
 * This implementation uses rule-based classification matching
 * the IAB Content Taxonomy v3 sensitivity tiers.
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// ── IAB Brand Safety Categories (GARM Framework) ──────────────────────────
// Source: https://www.iab.com/guidelines/brand-safety-floor-suitability-framework/
const GARM_CATEGORIES = {
  // Floor categories (always brand-unsafe)
  FLOOR: [
    { id: 'GARM-01', name: 'Adult & Explicit Sexual Content', labels: ['nudity', 'adult'], risk: 'HIGH' },
    { id: 'GARM-02', name: 'Arms & Ammunition', labels: ['gun', 'rifle', 'weapon', 'knife', 'sword'], risk: 'HIGH' },
    { id: 'GARM-03', name: 'Crime & Harmful Acts', labels: ['handcuffs', 'crime'], risk: 'HIGH' },
    { id: 'GARM-04', name: 'Death, Injury or Military Conflict', labels: ['blood', 'injury'], risk: 'HIGH' },
    { id: 'GARM-05', name: 'Online Piracy', labels: [], risk: 'HIGH' },
    { id: 'GARM-06', name: 'Hate Speech & Acts of Aggression', labels: [], risk: 'HIGH' },
    { id: 'GARM-07', name: 'Obscenity & Profanity', labels: [], risk: 'HIGH' },
    { id: 'GARM-08', name: 'Illegal Drugs / Tobacco / eCigarettes / Vaping / Alcohol', labels: ['wine glass', 'bottle', 'beer', 'cigarette'], risk: 'MEDIUM' },
    { id: 'GARM-09', name: 'Spam or Harmful Content', labels: [], risk: 'HIGH' },
    { id: 'GARM-10', name: 'Terrorism', labels: [], risk: 'HIGH' },
  ],
  // Suitability tiers
  SUITABILITY: [
    { id: 'SUIT-01', name: 'Debated Sensitive Social Issues', labels: [], risk: 'LOW' },
    { id: 'SUIT-02', name: 'Sensitive Advertising Categories', labels: ['medicine', 'pill'], risk: 'LOW' },
  ],
};

// ── IAB Content Taxonomy v3 sensitive segments ────────────────────────────
const IAB_SENSITIVE = [
  { code: 'IAB25',  name: 'Non-Standard Content',     labels: ['adult_content'], risk: 'HIGH' },
  { code: 'IAB26',  name: 'Illegal Content',           labels: ['weapon'],        risk: 'HIGH' },
  { code: 'IAB11',  name: 'Law, Govt & Politics',      labels: [],                risk: 'LOW' },
  { code: 'IAB14',  name: 'Personal Finance',          labels: [],                risk: 'LOW' },
  { code: 'IAB7',   name: 'Health & Fitness',          labels: ['person'],        risk: 'NONE' },
  { code: 'IAB17',  name: 'Sports',                    labels: ['sports ball', 'tennis racket', 'skateboard', 'surfboard'], risk: 'NONE' },
  { code: 'IAB19',  name: 'Technology & Computing',    labels: ['laptop', 'cell phone', 'keyboard', 'mouse', 'tv'],         risk: 'NONE' },
  { code: 'IAB9',   name: 'Hobbies & Interests',       labels: ['book', 'bicycle'],risk: 'NONE' },
  { code: 'IAB20',  name: 'Travel',                    labels: ['suitcase', 'airplane'], risk: 'NONE' },
  { code: 'IAB13',  name: 'Personal Finance',          labels: [],                risk: 'NONE' },
];

// Safe labels (whitelist for common objects)
const SAFE_LABELS = new Set([
  'person','chair','couch','bed','dining table','laptop','keyboard','mouse',
  'cell phone','tv','remote','book','clock','vase','backpack','umbrella',
  'handbag','suitcase','sports ball','baseball bat','skateboard','surfboard',
  'tennis racket','bottle','cup','bowl','spoon','fork','knife','pizza','cake',
  'sandwich','bicycle','car','truck','bus','train','airplane','boat',
  'cat','dog','bird','horse','sheep','cow','elephant','bear','zebra','giraffe',
  'potted plant','traffic light','fire hydrant','stop sign','bench',
]);

function checkLabel(label) {
  const lc = label.toLowerCase();
  const flags = [];

  // Check GARM floor categories
  for (const cat of GARM_CATEGORIES.FLOOR) {
    if (cat.labels.some(l => lc.includes(l) || l.includes(lc))) {
      flags.push({
        standard: 'GARM',
        code: cat.id,
        name: cat.name,
        risk: cat.risk,
        type: 'floor',
      });
    }
  }

  // Check GARM suitability
  for (const cat of GARM_CATEGORIES.SUITABILITY) {
    if (cat.labels.some(l => lc.includes(l))) {
      flags.push({ standard: 'GARM', code: cat.id, name: cat.name, risk: cat.risk, type: 'suitability' });
    }
  }

  // Check IAB sensitive
  for (const seg of IAB_SENSITIVE) {
    if (seg.labels.some(l => lc.includes(l) || l.includes(lc))) {
      flags.push({ standard: 'IAB', code: seg.code, name: seg.name, risk: seg.risk, type: 'taxonomy' });
    }
  }

  const isSafe = SAFE_LABELS.has(lc);
  const maxRisk = flags.reduce((max, f) => {
    const order = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
    return order[f.risk] > order[max] ? f.risk : max;
  }, 'NONE');

  return { label, safe: isSafe && maxRisk !== 'HIGH', risk: maxRisk, flags };
}

function scoreVideo(detections) {
  const results = detections.map(d => checkLabel(d.label));
  const flagged  = results.filter(r => r.risk !== 'NONE');
  const highRisk = results.filter(r => r.risk === 'HIGH');
  const total    = results.length || 1;

  const safetyScore = Math.max(0, 100 - (highRisk.length * 30) - (flagged.length * 5));
  const verdict = highRisk.length > 0 ? 'UNSAFE'
    : flagged.length > 2             ? 'REVIEW'
    : 'SAFE';

  // Aggregate IAB categories detected
  const iabCats = [...new Set(
    results.flatMap(r => r.flags.filter(f => f.standard === 'IAB').map(f => f.name))
  )];

  // Aggregate GARM flags
  const garmFlags = [...new Set(
    results.flatMap(r => r.flags.filter(f => f.standard === 'GARM').map(f => f.name))
  )];

  return {
    verdict,
    safetyScore: Math.round(safetyScore),
    totalDetections: total,
    flaggedObjects: flagged.length,
    highRiskObjects: highRisk.length,
    iabCategories: iabCats,
    garmFlags,
    perObject: results,
    checkedAt: new Date().toISOString(),
    standards: ['IAB Content Taxonomy v3', 'GARM Brand Safety Framework'],
    recommendation: verdict === 'SAFE'
      ? 'Content is suitable for all brand advertising.'
      : verdict === 'REVIEW'
      ? 'Content should be reviewed before running sensitive brand campaigns.'
      : 'Content contains elements that violate brand safety floors. Not suitable for advertising.',
  };
}

// POST /compliance/check
// body: { detections: [{id, label, category}] }
router.post('/check', authMiddleware, (req, res) => {
  const { detections = [] } = req.body;
  if (!detections.length) return res.status(400).json({ error: 'detections array required' });
  const report = scoreVideo(detections);
  res.json(report);
});

// GET /compliance/standards — return the standards used
router.get('/standards', authMiddleware, (req, res) => {
  res.json({
    standards: [
      {
        name: 'IAB Content Taxonomy v3',
        description: 'Industry standard for categorising digital content. Identifies sensitive segments including adult content, politics, and illegal activity.',
        url: 'https://iabtechlab.com/standards/content-taxonomy/',
        categories: IAB_SENSITIVE.map(s => ({ code: s.code, name: s.name })),
      },
      {
        name: 'GARM Brand Safety Framework',
        description: 'Global Alliance for Responsible Media framework defining brand safety floors and suitability tiers for advertising.',
        url: 'https://wfanet.org/l/library/brand-safety-floor-suitability-framework',
        categories: [...GARM_CATEGORIES.FLOOR, ...GARM_CATEGORIES.SUITABILITY].map(c => ({ code: c.id, name: c.name, risk: c.risk })),
      },
    ],
  });
});

module.exports = router;
