const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { authMiddleware } = require('../middleware/auth');
const { createVideo, updateVideo, getVideoById, getVideosByUser, deleteVideo, getAllVideos } = require('../store/videos');
const { updateUser, findById } = require('../store/users');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '../data/uploads');
const METADATA_DIR = path.join(__dirname, '../data/metadata');
const AI_SCRIPT = path.join(__dirname, '../../ai-pipeline/detect.py');

[UPLOADS_DIR, METADATA_DIR].forEach(d => fs.mkdirSync(d, { recursive: true }));

// Multer — accept video files up to 500MB
const storage = multer.diskStorage({
  destination: UPLOADS_DIR,
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.mp4', '.webm', '.mov', '.avi', '.mkv'];
    if (allowed.includes(path.extname(file.originalname).toLowerCase())) cb(null, true);
    else cb(new Error('Only video files are allowed'));
  },
});

// ─── SSE client registry ─────────────────────────────────────────────────────
// videoId → Array<{ res, userId }>
const sseClients = {};

// Persist last event per videoId so late-connecting clients catch up immediately
const lastEvent = {};

function sendSSE(videoId, data) {
  lastEvent[videoId] = data;   // store for late joiners
  const clients = sseClients[videoId] || [];
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  clients.forEach(({ res }) => { try { res.write(msg); } catch {} });
}

// ─── Auth helper that accepts token from query param OR Authorization header ─
// Needed because EventSource (SSE) cannot set custom headers in browsers.
function flexibleAuth(req, res, next) {
  const jwt = require('jsonwebtoken');
  const { JWT_SECRET } = require('../middleware/auth');

  // Try Authorization header first
  const header = req.headers.authorization;
  if (header && header.startsWith('Bearer ')) {
    try {
      req.user = jwt.verify(header.slice(7), JWT_SECRET);
      return next();
    } catch {}
  }

  // Fall back to ?token= query param (used by EventSource)
  const queryToken = req.query.token;
  if (queryToken) {
    try {
      req.user = jwt.verify(queryToken, JWT_SECRET);
      return next();
    } catch {}
  }

  res.status(401).json({ error: 'Unauthorized' });
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /videos
router.get('/', authMiddleware, (req, res) => {
  const isAdmin = req.user.role === 'admin';
  const videos = isAdmin ? getAllVideos() : getVideosByUser(req.user.id);
  res.json({ videos });
});

// POST /videos/upload
router.post('/upload', authMiddleware, upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No video file provided' });

  const video = createVideo({
    filename: req.file.filename,
    originalName: req.file.originalname,
    uploadedBy: req.user.id,
    size: req.file.size,
  });

  // Respond immediately so the frontend can subscribe to SSE before processing starts
  res.status(201).json({ video });

  // FIX: Small delay so the frontend has time to open the SSE connection
  // before any events are fired (avoids race condition)
  setTimeout(() => {
    const procMode = req.body?.mode || 'balanced';
    processVideo(video.id, req.file.path, req.user.id, procMode);
  }, 1500);
});

// GET /videos/:id
router.get('/:id', authMiddleware, (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (!canAccess(video, req.user)) return res.status(403).json({ error: 'Access denied' });
  res.json({ video });
});

// GET /videos/:id/metadata
router.get('/:id/metadata', authMiddleware, (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (!canAccess(video, req.user)) return res.status(403).json({ error: 'Access denied' });

  if (video.status !== 'done' || !video.metadataFile) {
    return res.status(404).json({ error: 'Detection not complete', status: video.status });
  }
  try {
    const data = JSON.parse(fs.readFileSync(video.metadataFile, 'utf8'));
    res.json(data);
  } catch {
    res.status(500).json({ error: 'Failed to read metadata' });
  }
});

// GET /videos/:id/stream — range-request video streaming
router.get('/:id/stream', flexibleAuth, (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (!canAccess(video, req.user)) return res.status(403).json({ error: 'Access denied' });

  const filePath = path.join(UPLOADS_DIR, video.filename);
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  const stat = fs.statSync(filePath);
  const fileSize = stat.size;
  const range = req.headers.range;

  if (range) {
    const [startStr, endStr] = range.replace(/bytes=/, '').split('-');
    const start = parseInt(startStr, 10);
    const end = endStr ? parseInt(endStr, 10) : fileSize - 1;
    const chunkSize = end - start + 1;
    res.writeHead(206, {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunkSize,
      'Content-Type': 'video/mp4',
    });
    fs.createReadStream(filePath, { start, end }).pipe(res);
  } else {
    res.writeHead(200, {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
    });
    fs.createReadStream(filePath).pipe(res);
  }
});

// GET /videos/:id/progress — SSE stream for live detection progress
// FIX: uses flexibleAuth so EventSource can pass token via query string
router.get('/:id/progress', flexibleAuth, (req, res) => {
  const { id } = req.params;

  // Check access
  const video = getVideoById(id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (!canAccess(video, req.user)) return res.status(403).json({ error: 'Access denied' });

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.flushHeaders();

  // Register client
  if (!sseClients[id]) sseClients[id] = [];
  const client = { res, userId: req.user.id };
  sseClients[id].push(client);

  // FIX: Replay last known event immediately so clients that connect
  // after processing finishes still get the final state
  const last = lastEvent[id];
  if (last) {
    try { res.write(`data: ${JSON.stringify(last)}\n\n`); } catch {}
  } else {
    // Send current video status so client knows we're connected
    try { res.write(`data: ${JSON.stringify({ type: 'status', video })}\n\n`); } catch {}
  }

  // Keep-alive ping every 20s to prevent connection timeout
  const ping = setInterval(() => {
    try { res.write(': ping\n\n'); } catch { clearInterval(ping); }
  }, 20000);

  req.on('close', () => {
    clearInterval(ping);
    if (sseClients[id]) {
      sseClients[id] = sseClients[id].filter(c => c !== client);
    }
  });
});

// DELETE /videos/:id
router.delete('/:id', authMiddleware, (req, res) => {
  const video = getVideoById(req.params.id);
  if (!video) return res.status(404).json({ error: 'Video not found' });
  if (!canAccess(video, req.user)) return res.status(403).json({ error: 'Access denied' });

  [path.join(UPLOADS_DIR, video.filename), video.metadataFile]
    .filter(Boolean)
    .forEach(f => { try { fs.unlinkSync(f); } catch {} });

  deleteVideo(req.params.id);
  // Clean up SSE state
  delete sseClients[req.params.id];
  delete lastEvent[req.params.id];
  res.json({ success: true });
});

// ─── Access helper ────────────────────────────────────────────────────────────
function canAccess(video, user) {
  return user.role === 'admin' || video.uploadedBy === user.id;
}

// ─── Processing pipeline ──────────────────────────────────────────────────────
async function processVideo(videoId, filePath, userId, mode = 'balanced') {
  const metadataPath = path.join(METADATA_DIR, `${videoId}.json`);

  updateVideo(videoId, { status: 'processing', progress: 0 });
  sendSSE(videoId, { type: 'progress', progress: 0, status: 'processing' });

  // FIX: checkPython has a 10s timeout so it never hangs the pipeline
  const pythonAvailable = await checkPython();

  if (!pythonAvailable) {
    console.log(`[KERV] Python/YOLO unavailable — using mock detections for ${videoId}`);
    await generateMockDetections(videoId, filePath, metadataPath, userId);
    return;
  }

  const python = process.platform === 'win32' ? 'python' : 'python3';
  // mode passed as parameter from upload handler
  const args = [
    AI_SCRIPT,
    '--video', filePath,
    '--output', metadataPath,
    '--mode', mode,
    '--progress-mode',
  ];

  const proc = spawn(python, args);
  let stderr = '';

  proc.stdout.on('data', (chunk) => {
    const lines = chunk.toString().split('\n').filter(Boolean);
    for (const line of lines) {
      try {
        const msg = JSON.parse(line);
        if (msg.type === 'progress') {
          updateVideo(videoId, { progress: msg.progress });
          sendSSE(videoId, { type: 'progress', progress: msg.progress, frame: msg.frame, detections: msg.detections });
        }
      } catch {}
    }
  });

  proc.stderr.on('data', d => { stderr += d.toString(); });

  proc.on('close', (code) => {
    if (code === 0 && fs.existsSync(metadataPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
        const updated = updateVideo(videoId, {
          status: 'done',
          progress: 100,
          processedAt: new Date().toISOString(),
          metadataFile: metadataPath,
          detectionCount: meta.detections?.length || 0,
          duration: meta.videoDuration,
        });
        try {
          const u = findById(userId);
          updateUser(userId, { videosProcessed: (u?.videosProcessed || 0) + 1 });
        } catch {}
        sendSSE(videoId, { type: 'done', video: updated, detectionCount: updated.detectionCount });
      } catch (err) {
        finishWithError(videoId, err.message);
      }
    } else {
      finishWithError(videoId, stderr.slice(-500) || `Process exited with code ${code}`);
    }
  });

  proc.on('error', (err) => finishWithError(videoId, err.message));
}

function finishWithError(videoId, message) {
  const updated = updateVideo(videoId, { status: 'error', error: message });
  sendSSE(videoId, { type: 'error', message, video: updated });
  console.error(`[KERV] Detection error for ${videoId}:`, message);
}

// FIX: checkPython with 10s timeout
function checkPython() {
  return new Promise((resolve) => {
    const python = process.platform === 'win32' ? 'python' : 'python3';
    let resolved = false;
    const done = (val) => { if (!resolved) { resolved = true; resolve(val); } };

    const timer = setTimeout(() => done(false), 10000);
    try {
      const proc = spawn(python, ['-c', 'import ultralytics; import cv2; print("ok")']);
      let out = '';
      proc.stdout.on('data', d => out += d);
      proc.on('close', code => { clearTimeout(timer); done(code === 0 && out.includes('ok')); });
      proc.on('error', () => { clearTimeout(timer); done(false); });
    } catch {
      clearTimeout(timer);
      done(false);
    }
  });
}

// Mock detection generator — realistic simulation when Python not installed
async function generateMockDetections(videoId, filePath, metadataPath, userId) {
  const LABELS = [
    { label: 'person', cat: 'people' },
    { label: 'car', cat: 'vehicles' },
    { label: 'dog', cat: 'animals' },
    { label: 'chair', cat: 'furniture' },
    { label: 'bottle', cat: 'gear' },
    { label: 'laptop', cat: 'electronics' },
    { label: 'backpack', cat: 'accessories' },
    { label: 'cup', cat: 'kitchen' },
    { label: 'cell phone', cat: 'electronics' },
    { label: 'clock', cat: 'accessories' },
  ];

  const steps = 12;
  for (let i = 1; i <= steps; i++) {
    await sleep(350);
    const pct = Math.round((i / steps) * 100);
    updateVideo(videoId, { progress: pct });
    sendSSE(videoId, { type: 'progress', progress: pct, frame: i * 40, detections: i });
  }

  const duration = 30;
  const detections = [];
  for (let i = 0; i < 8; i++) {
    const t = parseFloat((Math.random() * (duration - 6) + 1).toFixed(2));
    const pick = LABELS[i % LABELS.length];
    detections.push({
      id: `det_${String(i + 1).padStart(4, '0')}`,
      time: t,
      endTime: parseFloat((t + 2 + Math.random() * 4).toFixed(2)),
      label: pick.label,
      confidence: parseFloat((0.6 + Math.random() * 0.38).toFixed(4)),
      bbox: [
        Math.floor(Math.random() * 400),
        Math.floor(Math.random() * 280),
        80 + Math.floor(Math.random() * 180),
        80 + Math.floor(Math.random() * 180),
      ],
      category: pick.cat,
      occurrences: 1 + Math.floor(Math.random() * 4),
    });
  }
  detections.sort((a, b) => a.time - b.time);

  const metadata = {
    videoId,
    videoDuration: duration,
    videoFps: 29.97,
    videoSize: [1280, 720],
    processedAt: new Date().toISOString(),
    model: 'mock-yolo12m (Python not installed)',
    detections,
  };

  fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2));

  const updated = updateVideo(videoId, {
    status: 'done',
    progress: 100,
    processedAt: new Date().toISOString(),
    metadataFile: metadataPath,
    detectionCount: detections.length,
    duration,
  });

  try {
    const u = findById(userId);
    updateUser(userId, { videosProcessed: (u?.videosProcessed || 0) + 1 });
  } catch {}

  sendSSE(videoId, { type: 'done', video: updated, detectionCount: detections.length });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

module.exports = router;
