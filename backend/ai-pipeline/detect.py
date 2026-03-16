#!/usr/bin/env python3
"""
KERV v4.1 — Fast AI Object Detection Pipeline
Optimisations applied:
  • Frame SEEKING (cap.set POS_FRAMES) instead of reading every frame
  • Batch inference — process BATCH_SIZE frames per YOLO call
  • Model warm-up before the video loop
  • Per-label best-frame tracking without storing all frame copies
  • INTER_AREA resampling (faster than LANCZOS for downscaling)
  • SSE progress throttled to 2% increments
  • Three speed modes: fast / balanced / quality

Model fallback chain: yolo12n → yolo11n → yolov8n (fast)
                      yolo12m → yolo11m → yolov8m (balanced/quality)

Usage:
  python detect.py --video video.mp4 --output out.json [--mode fast|balanced|quality]
  python detect.py --video video.mp4 --output out.json --progress-mode
"""

import argparse, json, os, sys, time, base64
from pathlib import Path

try:
    import cv2
    import numpy as np
except ImportError as e:
    print(json.dumps({"type": "error", "message": f"Missing dep: {e}. Run: pip install opencv-python numpy"}))
    sys.exit(1)

try:
    from ultralytics import YOLO
    import ultralytics
    _ult_ver = tuple(int(x) for x in ultralytics.__version__.split(".")[:3])
except ImportError:
    print(json.dumps({"type": "error", "message": "Ultralytics not found. Run: pip install ultralytics>=8.3.86"}))
    sys.exit(1)

# ── Speed modes ───────────────────────────────────────────────────────────────
MODES = {
    #          model_pref   every_n  conf   batch  merge_win
    "fast":    ("yolo12n.pt",  15,   0.42,   4,    1.0),
    "balanced":("yolo12n.pt",   8,   0.38,   4,    0.8),  # default
    "quality": ("yolo12m.pt",   5,   0.35,   2,    0.8),
}

# ── Model fallback chains ─────────────────────────────────────────────────────
MODEL_REQS = {
    "yolo12x.pt":(8,3,86), "yolo12l.pt":(8,3,86), "yolo12m.pt":(8,3,86),
    "yolo12s.pt":(8,3,86), "yolo12n.pt":(8,3,86),
    "yolo11x.pt":(8,3,0),  "yolo11l.pt":(8,3,0),  "yolo11m.pt":(8,3,0),
    "yolo11s.pt":(8,3,0),  "yolo11n.pt":(8,3,0),
    "yolov10m.pt":(8,2,0), "yolov9c.pt":(8,1,0),
    "yolov8m.pt":(8,0,0),  "yolov8n.pt":(8,0,0),
}

NANO_CHAIN   = ["yolo12n.pt","yolo11n.pt","yolov8n.pt"]
MEDIUM_CHAIN = ["yolo12m.pt","yolo11m.pt","yolov10m.pt","yolov9c.pt","yolov8m.pt"]

def resolve_model(requested: str) -> tuple:
    chain = MEDIUM_CHAIN if requested in MEDIUM_CHAIN or "m.pt" in requested else NANO_CHAIN
    candidates = [requested] + [m for m in chain if m != requested]
    for m in candidates:
        if _ult_ver >= MODEL_REQS.get(m, (8,0,0)):
            return m
    return "yolov8n.pt"

# ── Category taxonomy ─────────────────────────────────────────────────────────
CATEGORY_MAP = {
    "person":"people","tie":"fashion","backpack":"accessories","umbrella":"accessories",
    "handbag":"accessories","clock":"accessories","suitcase":"travel","airplane":"transport",
    "bicycle":"transport","car":"transport","motorcycle":"transport","bus":"transport",
    "train":"transport","truck":"transport","boat":"transport","laptop":"technology",
    "mouse":"technology","keyboard":"technology","cell phone":"technology","tv":"technology",
    "remote":"technology","monitor":"technology","chair":"home","couch":"home","bed":"home",
    "dining table":"home","toilet":"home","bench":"home","vase":"home","potted plant":"home",
    "refrigerator":"appliances","microwave":"appliances","oven":"appliances",
    "toaster":"appliances","sink":"appliances","bottle":"kitchen","wine glass":"kitchen",
    "cup":"kitchen","fork":"kitchen","knife":"kitchen","spoon":"kitchen","bowl":"kitchen",
    "banana":"food","apple":"food","sandwich":"food","orange":"food","broccoli":"food",
    "carrot":"food","hot dog":"food","pizza":"food","donut":"food","cake":"food",
    "sports ball":"sports","baseball bat":"sports","baseball glove":"sports",
    "skateboard":"sports","surfboard":"sports","tennis racket":"sports",
    "snowboard":"sports","skis":"sports","kite":"sports","frisbee":"sports",
    "bird":"animals","cat":"animals","dog":"animals","horse":"animals","sheep":"animals",
    "cow":"animals","elephant":"animals","bear":"animals","zebra":"animals","giraffe":"animals",
    "book":"media","toothbrush":"personal_care","hair drier":"personal_care",
    "scissors":"tools","traffic light":"infrastructure","fire hydrant":"infrastructure",
    "stop sign":"infrastructure","parking meter":"infrastructure",
}

CATEGORY_META = {
    "people":        {"icon":"👤","color":"#7c3aed","label":"People"},
    "fashion":       {"icon":"👔","color":"#ec4899","label":"Fashion"},
    "technology":    {"icon":"💻","color":"#3b82f6","label":"Technology"},
    "transport":     {"icon":"🚗","color":"#6366f1","label":"Transport"},
    "accessories":   {"icon":"👜","color":"#f59e0b","label":"Accessories"},
    "home":          {"icon":"🛋","color":"#10b981","label":"Home & Living"},
    "appliances":    {"icon":"🔌","color":"#06b6d4","label":"Appliances"},
    "kitchen":       {"icon":"🍽","color":"#f97316","label":"Kitchen"},
    "food":          {"icon":"🍕","color":"#84cc16","label":"Food & Drink"},
    "sports":        {"icon":"⚽","color":"#ef4444","label":"Sports & Fitness"},
    "travel":        {"icon":"✈","color":"#8b5cf6","label":"Travel"},
    "animals":       {"icon":"🐾","color":"#a3e635","label":"Animals"},
    "media":         {"icon":"📚","color":"#64748b","label":"Media"},
    "personal_care": {"icon":"🪥","color":"#d946ef","label":"Personal Care"},
    "tools":         {"icon":"✂","color":"#78716c","label":"Tools"},
    "infrastructure":{"icon":"🚦","color":"#94a3b8","label":"Infrastructure"},
    "general":       {"icon":"📦","color":"#94a3b8","label":"General"},
}

def emit(obj):
    print(json.dumps(obj), flush=True)

def get_category(label):
    return CATEGORY_MAP.get(label.lower(), "general")

def crop_to_b64(frame, x1, y1, x2, y2, pad=14, max_size=200):
    """Crop + encode to base64 JPEG. Uses INTER_AREA — fastest for downscaling."""
    h, w = frame.shape[:2]
    x1c, y1c = max(0, int(x1)-pad), max(0, int(y1)-pad)
    x2c, y2c = min(w, int(x2)+pad), min(h, int(y2)+pad)
    crop = frame[y1c:y2c, x1c:x2c]
    if crop.size == 0:
        return None
    ch, cw = crop.shape[:2]
    if max(ch, cw) > max_size:
        scale = max_size / max(ch, cw)
        # INTER_AREA is fastest and best quality for shrinking
        crop = cv2.resize(crop, (max(1,int(cw*scale)), max(1,int(ch*scale))),
                          interpolation=cv2.INTER_AREA)
    _, buf = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 80])
    return "data:image/jpeg;base64," + base64.b64encode(buf).decode()

def process_video(video_path, output_path, every_n, conf, model_name,
                  merge_window, batch_size, progress_mode):

    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        emit({"type":"error","message":f"Cannot open: {video_path}"}); sys.exit(1)

    fps          = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    width        = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height       = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    duration     = total_frames / fps

    resolved = resolve_model(model_name)
    if resolved != model_name and not progress_mode:
        print(f"  ⚠ {model_name} needs newer ultralytics — using {resolved}", file=sys.stderr)

    try:
        model = YOLO(resolved)
    except Exception as e:
        print(f"  ⚠ Cannot load {resolved}: {e} — falling back to yolov8n", file=sys.stderr)
        model = YOLO("yolov8n.pt"); resolved = "yolov8n.pt (fallback)"

    # ── Warm up: one blank inference to initialise model weights ──────────────
    try:
        blank = np.zeros((height or 480, width or 640, 3), dtype=np.uint8)
        model(blank, conf=conf, verbose=False)
    except Exception:
        pass

    # ── Build the list of frame positions to sample ────────────────────────────
    # We SEEK directly — never decode frames we don't need
    sample_positions = list(range(0, total_frames, every_n))
    total_samples    = len(sample_positions)

    # ── Per-label best-detection tracker (avoids storing all frame copies) ─────
    # best_by_label[label] = { conf, time, bbox, bbox_pct, frame_ref_pos }
    # We only keep the BEST frame reference per label, not every occurrence
    raw = []       # lightweight records (no frame data)
    best_frames = {}  # label → (conf, frame_img, x1,y1,x2,y2)

    last_pct_sent = -1
    processed     = 0

    # Process in batches for better CPU utilisation
    i = 0
    while i < len(sample_positions):
        batch_pos  = sample_positions[i : i + batch_size]
        batch_imgs = []
        batch_meta = []   # (frame_num, timestamp)

        for fpos in batch_pos:
            cap.set(cv2.CAP_PROP_POS_FRAMES, fpos)  # ← SEEK, not sequential read
            ret, frame = cap.read()
            if not ret:
                continue
            batch_imgs.append(frame)
            batch_meta.append((fpos, fpos / fps))

        if not batch_imgs:
            i += batch_size
            continue

        # ── Batch inference ───────────────────────────────────────────────────
        batch_results = model(batch_imgs, conf=conf, verbose=False, stream=False)

        for (frame_num, timestamp), result, frame in zip(batch_meta, batch_results, batch_imgs):
            for box in result.boxes:
                cls_id     = int(box.cls[0])
                label      = model.names[cls_id]
                confidence = float(box.conf[0])
                x1,y1,x2,y2 = box.xyxy[0].tolist()

                bbox_pct = [
                    round(x1/width*100, 3), round(y1/height*100, 3),
                    round((x2-x1)/width*100, 3), round((y2-y1)/height*100, 3),
                ]
                raw.append({
                    "time":       round(timestamp, 3),
                    "label":      label,
                    "confidence": round(confidence, 4),
                    "bbox":       [int(x1),int(y1),int(x2-x1),int(y2-y1)],
                    "bbox_pct":   bbox_pct,
                    "category":   get_category(label),
                    "frame":      frame_num,
                })

                # Track only best frame per label (no frame.copy() on every hit)
                prev = best_frames.get(label)
                if prev is None or confidence > prev[0]:
                    best_frames[label] = (confidence, frame.copy(), x1, y1, x2, y2)

        processed += len(batch_imgs)
        i         += batch_size

        # Throttled SSE progress — only emit when pct changes by ≥2
        pct = min(99, int(processed / total_samples * 100))
        if progress_mode and pct >= last_pct_sent + 2:
            emit({"type":"progress","progress":pct,"detections":len(raw)})
            last_pct_sent = pct

    cap.release()

    # ── Merge + attach crop images ────────────────────────────────────────────
    detections = merge_detections(raw, merge_window, best_frames)

    metadata = {
        "videoId":       Path(video_path).stem,
        "videoDuration": round(duration, 2),
        "videoFps":      round(fps, 2),
        "videoSize":     [width, height],
        "processedAt":   time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        "model":         resolved,
        "ultralytics":   ".".join(map(str, _ult_ver)),
        "settings":      {"everyNFrames":every_n,"confidenceThreshold":conf,
                          "mergeWindow":merge_window,"batchSize":batch_size},
        "detections":    detections,
        "categoryMeta":  CATEGORY_META,
    }

    os.makedirs(os.path.dirname(os.path.abspath(output_path)), exist_ok=True)
    with open(output_path, "w") as f:
        json.dump(metadata, f, indent=2)

    if progress_mode:
        emit({"type":"progress","progress":100,"detections":len(detections)})

    return metadata


def merge_detections(raw, window, best_frames):
    if not raw:
        return []

    by_label = {}
    for d in raw:
        by_label.setdefault(d["label"], []).append(d)

    merged = []
    det_id = 1

    for label, dets in by_label.items():
        dets.sort(key=lambda x: x["time"])
        groups, current = [], [dets[0]]
        for det in dets[1:]:
            if det["time"] - current[-1]["time"] <= window:
                current.append(det)
            else:
                groups.append(current); current = [det]
        groups.append(current)

        cat  = dets[0]["category"]
        meta = CATEGORY_META.get(cat, CATEGORY_META["general"])

        # Generate ONE crop from the best-confidence frame for this label
        crop_b64 = None
        bf = best_frames.get(label)
        if bf:
            _, frame_img, x1, y1, x2, y2 = bf
            crop_b64 = crop_to_b64(frame_img, x1, y1, x2, y2)

        for group in groups:
            best = max(group, key=lambda x: x["confidence"])
            merged.append({
                "id":            f"det_{det_id:04d}",
                "time":          round(group[0]["time"], 3),
                "endTime":       round(group[-1]["time"] + window, 3),
                "label":         label,
                "confidence":    round(best["confidence"], 4),
                "bbox":          best["bbox"],
                "bbox_pct":      best["bbox_pct"],
                "category":      cat,
                "categoryIcon":  meta["icon"],
                "categoryColor": meta["color"],
                "categoryLabel": meta["label"],
                "occurrences":   len(group),
                "cropImage":     crop_b64,   # one crop per unique label
            })
            det_id += 1

    merged.sort(key=lambda x: x["time"])
    return merged


def main():
    parser = argparse.ArgumentParser(description="KERV v4.1 — Fast YOLO Video Detection")
    parser.add_argument("--video",          required=True)
    parser.add_argument("--output",         default="../backend/data/metadata.json")
    parser.add_argument("--mode",           default="balanced",
                        choices=["fast","balanced","quality"],
                        help="fast=yolo12n/every15 | balanced=yolo12n/every8 | quality=yolo12m/every5")
    # Manual overrides (override mode defaults)
    parser.add_argument("--every-n",        type=int,   default=None)
    parser.add_argument("--confidence",     type=float, default=None)
    parser.add_argument("--model",          default=None)
    parser.add_argument("--merge-window",   type=float, default=None)
    parser.add_argument("--batch-size",     type=int,   default=None)
    parser.add_argument("--progress-mode",  action="store_true")
    args = parser.parse_args()

    if not os.path.exists(args.video):
        emit({"type":"error","message":f"Video not found: {args.video}"}); sys.exit(1)

    # Load mode defaults then apply any manual overrides
    model_def, every_n_def, conf_def, batch_def, merge_def = MODES[args.mode]

    model_name   = args.model        or model_def
    every_n      = args.every_n      or every_n_def
    conf         = args.confidence   or conf_def
    batch_size   = args.batch_size   or batch_def
    merge_window = args.merge_window or merge_def

    if not args.progress_mode:
        print(f"  Mode: {args.mode} | Model: {model_name} | every_n={every_n} "
              f"| conf={conf} | batch={batch_size}", file=sys.stderr)

    process_video(
        video_path   = args.video,
        output_path  = args.output,
        every_n      = every_n,
        conf         = conf,
        model_name   = model_name,
        merge_window = merge_window,
        batch_size   = batch_size,
        progress_mode= args.progress_mode,
    )

if __name__ == "__main__":
    main()
