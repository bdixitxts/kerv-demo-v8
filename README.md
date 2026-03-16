# ◈ KERV v2 — Interactive Video Intelligence Platform

Dynamic AI detection + user authentication + role-based dashboard.

---

## What's New in v2

| Feature | v1 | v2 |
|---|---|---|
| Detection data | Static JSON | Real YOLOv8 per uploaded video |
| Auth | None | JWT login/register, roles |
| Dashboard | None | Video library, upload, admin panel |
| Processing | Manual Python CLI | Auto-triggered on upload with live SSE progress |
| Video source | Public CDN URL | User's own uploaded files |
| Multi-user | No | Yes — each user sees their own videos |
| Admin panel | No | Yes — user management, stats |

---

## Quick Start

### Prerequisites
- Node.js 18+
- Python 3.9+ (optional — mock detections work without it)

### 1. Backend
```bash
cd backend
npm install
npm start
# → http://localhost:3001
# Auto-creates: data/users.json, data/videos.json
```

### 2. Frontend
```bash
cd frontend
npm install
npm run dev
# → http://localhost:5173
```

### 3. Open http://localhost:5173

**Default credentials (auto-created on first run):**

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@kerv.demo | admin123 |
| Viewer | viewer@kerv.demo | viewer123 |

---

## User Flow

```
1. Open app → Login page
2. Sign in (or register a new account)
3. Dashboard → Upload a video (drag & drop or click)
4. Live progress bar streams detection % via SSE
5. When done → "Open Player" button appears
6. Player → video plays with bounding box overlays
7. Hover detected objects → product cards
8. Carousel shows all objects → click to seek
9. Dashboard panel shows live analytics
```

---

## Python AI Setup (for real detections)

Without Python, the system auto-generates realistic mock detections so the UI is fully functional.

To enable real YOLOv8 detection:
```bash
cd ai-pipeline
python -m venv venv
source venv/bin/activate     # Windows: venv\Scripts\activate
pip install -r requirements.txt
# Models download automatically on first use (~6MB for yolov8n)
```

Once installed, the backend auto-detects Python availability and uses real YOLO on every upload.

---

## Architecture

```
browser
  │
  ├── LoginPage      (JWT auth, role-aware)
  ├── DashboardPage  (video library, upload, admin tabs)
  │     └── SSE listener (live processing progress)
  └── PlayerPage     (video + overlays + dashboard panel)
        └── useVideoTimeline (time → active detections)

backend (Express)
  ├── POST /auth/login|register
  ├── GET  /auth/me
  ├── POST /videos/upload          (multer, triggers Python)
  ├── GET  /videos/:id/stream      (range-request video streaming)
  ├── GET  /videos/:id/metadata    (detection JSON)
  ├── GET  /videos/:id/progress    (SSE — progress events)
  └── GET  /admin/users|stats      (admin only)

ai-pipeline (Python)
  └── detect.py --progress-mode   (emits JSON lines → Node → SSE → React)
```

---

## API Reference

| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | /auth/login | — | Login → JWT token |
| POST | /auth/register | — | Register → JWT token |
| GET | /auth/me | ✓ | Current user |
| GET | /videos | ✓ | List user's videos |
| POST | /videos/upload | ✓ | Upload + auto-process |
| GET | /videos/:id/stream | ✓ | Stream video file |
| GET | /videos/:id/metadata | ✓ | Detection results |
| GET | /videos/:id/progress | ✓ | SSE processing stream |
| DELETE | /videos/:id | ✓ | Delete video |
| GET | /admin/users | admin | All users |
| POST | /admin/users | admin | Create user |
| PATCH | /admin/users/:id | admin | Update user |
| DELETE | /admin/users/:id | admin | Delete user |
| GET | /admin/stats | admin | Platform stats |

---

## File Structure

```
kerv-v2/
├── frontend/src/
│   ├── context/AuthContext.jsx      ← JWT state, login/logout
│   ├── pages/
│   │   ├── LoginPage.jsx            ← Login + register + demo credentials
│   │   ├── DashboardPage.jsx        ← Video library, upload, admin tabs
│   │   └── PlayerPage.jsx           ← Video player with detection overlays
│   ├── components/                  ← VideoPlayer, OverlayEngine, etc (unchanged)
│   ├── hooks/useVideoTimeline.js    ← time → active detections
│   └── App.jsx                      ← Router: Login → Dashboard → Player
│
├── backend/
│   ├── server.js
│   ├── middleware/auth.js           ← JWT verify, adminOnly
│   ├── routes/auth.js               ← login, register, me
│   ├── routes/videos.js             ← upload, stream, SSE, metadata
│   ├── routes/admin.js              ← user CRUD, stats
│   ├── store/users.js               ← JSON-file user persistence
│   └── store/videos.js              ← JSON-file video record persistence
│
└── ai-pipeline/
    └── detect.py                    ← YOLOv8 + OpenCV, --progress-mode for SSE
```
