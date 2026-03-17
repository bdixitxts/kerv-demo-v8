/**
 * Products route — matches detected labels to a product catalogue.
 * In production this would query a real DB. Here we have a seeded
 * catalogue that can be extended. The /match endpoint accepts a label
 * and returns the best matching product with metadata for the right-side
 * product tray and "Shop" CTA.
 */
const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// ── Product catalogue (seed data — replace with DB calls) ──────────────────
const CATALOGUE = [
  // Electronics
  { id: 'p001', label: 'laptop',      category: 'electronics', name: 'MacBook Pro 14"',        brand: 'Apple',    price: '$1,999', url: 'https://apple.com/macbook-pro', tags: ['laptop','computer','notebook'] },
  { id: 'p002', label: 'cell phone',  category: 'electronics', name: 'iPhone 15 Pro',           brand: 'Apple',    price: '$999',   url: 'https://apple.com/iphone',       tags: ['phone','smartphone','mobile','cell phone'] },
  { id: 'p003', label: 'tv',          category: 'electronics', name: '55" OLED Smart TV',       brand: 'LG',       price: '$1,299', url: 'https://lg.com',                 tags: ['tv','television','monitor'] },
  { id: 'p004', label: 'keyboard',    category: 'electronics', name: 'MX Keys Mechanical',      brand: 'Logitech', price: '$129',   url: 'https://logitech.com',           tags: ['keyboard','typing'] },
  { id: 'p005', label: 'mouse',       category: 'electronics', name: 'MX Master 3S',            brand: 'Logitech', price: '$99',    url: 'https://logitech.com',           tags: ['mouse','cursor'] },
  // Accessories
  { id: 'p006', label: 'backpack',    category: 'accessories', name: 'Commuter Backpack 30L',   brand: 'Osprey',   price: '$149',   url: 'https://osprey.com',             tags: ['backpack','bag','pack'] },
  { id: 'p007', label: 'handbag',     category: 'accessories', name: 'City Tote Large',         brand: 'Everlane', price: '$98',    url: 'https://everlane.com',           tags: ['handbag','tote','bag','purse'] },
  { id: 'p008', label: 'umbrella',    category: 'accessories', name: 'Auto-Open Compact',       brand: 'Repel',    price: '$39',    url: 'https://amazon.com',             tags: ['umbrella','rain'] },
  { id: 'p009', label: 'clock',       category: 'accessories', name: 'Minimalist Wall Clock',   brand: 'LEFF',     price: '$89',    url: 'https://leff-amsterdam.com',     tags: ['clock','watch','time'] },
  // Furniture
  { id: 'p010', label: 'chair',       category: 'furniture',   name: 'Aeron Ergonomic Chair',   brand: 'Herman Miller', price: '$1,495', url: 'https://hermanmiller.com',  tags: ['chair','seat','office','ergonomic'] },
  { id: 'p011', label: 'couch',       category: 'furniture',   name: 'Haven Sectional Sofa',    brand: 'West Elm', price: '$2,899', url: 'https://westelm.com',            tags: ['couch','sofa','seat','furniture'] },
  { id: 'p012', label: 'bed',         category: 'furniture',   name: 'Platform Bed Frame',      brand: 'Floyd',    price: '$895',   url: 'https://floydhome.com',          tags: ['bed','frame','sleep'] },
  // Fitness
  { id: 'p013', label: 'sports ball', category: 'fitness',     name: 'Pro Training Football',   brand: 'Wilson',   price: '$59',    url: 'https://wilson.com',             tags: ['ball','sport','football','soccer'] },
  { id: 'p014', label: 'tennis racket',category:'fitness',     name: 'Blade 98 V9',             brand: 'Wilson',   price: '$229',   url: 'https://wilson.com',             tags: ['tennis','racket','sport'] },
  { id: 'p015', label: 'skateboard',  category: 'fitness',     name: 'Complete Street Deck',    brand: 'Element',  price: '$89',    url: 'https://elementbrand.com',       tags: ['skateboard','skate','board'] },
  // Kitchen
  { id: 'p016', label: 'cup',         category: 'kitchen',     name: 'Insulated Travel Mug',    brand: 'Yeti',     price: '$35',    url: 'https://yeti.com',               tags: ['cup','mug','drink','coffee'] },
  { id: 'p017', label: 'bottle',      category: 'kitchen',     name: 'Hydro Flask 32oz',        brand: 'Hydro Flask', price: '$45', url: 'https://hydroflask.com',         tags: ['bottle','water','flask'] },
  { id: 'p018', label: 'bowl',        category: 'kitchen',     name: 'Ceramic Prep Bowl Set',   brand: 'Our Place', price: '$55',  url: 'https://fromourplace.com',       tags: ['bowl','ceramic','kitchen'] },
  // Vehicles
  { id: 'p019', label: 'car',         category: 'vehicles',    name: 'Smart Dashcam 4K',        brand: 'Vantrue',  price: '$169',   url: 'https://vantrue.net',            tags: ['car','vehicle','auto','dashcam'] },
  { id: 'p020', label: 'bicycle',     category: 'vehicles',    name: 'Gravel Bike GX 105',      brand: 'Trek',     price: '$2,299', url: 'https://trekbikes.com',          tags: ['bicycle','bike','cycling'] },
  // People / apparel
  { id: 'p021', label: 'tie',         category: 'apparel',     name: 'Silk Herringbone Tie',    brand: 'Ties.com', price: '$65',    url: 'https://ties.com',               tags: ['tie','necktie','apparel','shirt'] },
  { id: 'p022', label: 'suitcase',    category: 'travel',      name: 'Carry-On Hardshell',      brand: 'Away',     price: '$295',   url: 'https://awaytravel.com',         tags: ['suitcase','luggage','travel','bag'] },
  // Generic fallbacks per category
  { id: 'p023', label: 'sports ball', category: 'sports',      name: 'Pro Training Ball',       brand: 'Wilson',       price: '$59',    url: 'https://wilson.com',          tags: ['ball','sport','football','soccer','sports ball','basketball'] },
  { id: 'p024', label: 'keyboard',    category: 'technology',  name: 'MX Keys Mechanical',      brand: 'Logitech',     price: '$129',   url: 'https://logitech.com',        tags: ['keyboard','typing','mechanical'] },
  { id: 'p025', label: 'suitcase',    category: 'travel',      name: 'Carry-On Hardshell',      brand: 'Away',         price: '$295',   url: 'https://awaytravel.com',      tags: ['suitcase','luggage','travel','bag','carry-on'] },
  { id: 'p026', label: 'bicycle',     category: 'transport',   name: 'Gravel Bike GX 105',      brand: 'Trek',         price: '$2,299', url: 'https://trekbikes.com',       tags: ['bicycle','bike','cycling','transport'] },
  { id: 'p027', label: 'handbag',     category: 'accessories', name: 'Structured Tote Bag',     brand: 'Coach',        price: '$295',   url: 'https://coach.com',           tags: ['handbag','tote','bag','purse','accessories'] },
  { id: 'p028', label: 'cell phone',  category: 'technology',  name: 'iPhone 15 Pro',           brand: 'Apple',        price: '$999',   url: 'https://apple.com/iphone',    tags: ['cell phone','phone','smartphone','mobile'] },
    { id: 'p099', label: 'general',     category: 'general',     name: 'View on Amazon',          brand: 'Amazon',   price: 'Shop',   url: 'https://amazon.com',             tags: [] },
];

function matchProduct(label) {
  const lc = label.toLowerCase();
  // 1. Exact label match
  let hit = CATALOGUE.find(p => p.label === lc);
  if (hit) return hit;
  // 2. Tag match (tags array)
  hit = CATALOGUE.find(p => p.tags.includes(lc));
  if (hit) return hit;
  // 3. Substring match
  hit = CATALOGUE.find(p => lc.includes(p.label) || p.label.includes(lc));
  if (hit) return hit;
  // 4. Multi-word fuzzy: split label words and find any tag containing them
  const words = lc.split(/\s+/);
  hit = CATALOGUE.find(p => words.some(w => w.length > 3 && p.tags.some(t => t.includes(w))));
  if (hit) return hit;
  return null;
}

// GET /products — list catalogue
router.get('/', authMiddleware, (req, res) => {
  res.json({ products: CATALOGUE });
});

// POST /products/match — match a detected label to a product
// body: { label: string, category?: string }
router.post('/match', authMiddleware, (req, res) => {
  const { label, category } = req.body;
  if (!label) return res.status(400).json({ error: 'label required' });

  let product = matchProduct(label);
  if (!product && category) {
    product = CATALOGUE.find(p => p.category === category);
  }
  if (!product) product = CATALOGUE.find(p => p.id === 'p099');

  res.json({ product, matched: !!product });
});

// POST /products/match-batch — match multiple detections at once
// body: { detections: [{id, label, category}] }
router.post('/match-batch', authMiddleware, (req, res) => {
  const { detections = [] } = req.body;
  const results = {};
  const seen = new Set(); // deduplicate — same product shown only once per label

  for (const det of detections) {
    const product = matchProduct(det.label)
      || (det.category ? CATALOGUE.find(p => p.category === det.category) : null)
      || CATALOGUE.find(p => p.id === 'p099');

    // Only include each product once
    if (product && !seen.has(product.id)) {
      seen.add(product.id);
      results[det.id] = product;
    }
  }

  res.json({ matches: results });
});

module.exports = router;
