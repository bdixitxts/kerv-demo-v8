import VideoThumbnail from '../components/VideoThumbnail';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './DashboardPage.module.css';

export default function DashboardPage({ onOpenVideo }) {
  const { user, authFetch, logout, API } = useAuth();
  const [videos, setVideos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [processingMap, setProcessingMap] = useState({});
  const [adminTab, setAdminTab] = useState('videos');
  const [users, setUsers] = useState([]);
  const [stats, setStats] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [procMode, setProcMode] = useState('balanced'); // fast | balanced | quality
  const fileRef = useRef();
  const sseRefs = useRef({});

  const fetchVideos = useCallback(async () => {
    try {
      const r = await authFetch('/videos');
      const data = await r.json();
      setVideos(data.videos || []);
    } catch (e) {
      console.error('fetchVideos failed', e);
    }
    setLoading(false);
  }, [authFetch]);

  const fetchAdminData = useCallback(async () => {
    if (user?.role !== 'admin') return;
    try {
      const [uRes, sRes] = await Promise.all([
        authFetch('/admin/users'),
        authFetch('/admin/stats'),
      ]);
      setUsers((await uRes.json()).users || []);
      setStats(await sRes.json());
    } catch {}
  }, [authFetch, user]);

  useEffect(() => {
    fetchVideos();
    fetchAdminData();
  }, []);

  // FIX: subscribe to SSE for videos still in 'processing' state when page loads
  useEffect(() => {
    const processing = videos.filter(v => v.status === 'processing');
    processing.forEach(v => {
      if (sseRefs.current[v.id]) return;
      subscribeSSE(v.id);
    });
  }, [videos]);

  function subscribeSSE(videoId) {
    const token = localStorage.getItem('kerv_token');
    // FIX: pass token as query param because EventSource can't set headers
    const url = `${API}/videos/${videoId}/progress?token=${token}`;
    const es = new EventSource(url);
    sseRefs.current[videoId] = es;

    es.onopen = () => console.log(`[SSE] Connected for ${videoId}`);

    es.onmessage = (e) => {
      let msg;
      try { msg = JSON.parse(e.data); } catch { return; }

      if (msg.type === 'progress') {
        setProcessingMap(m => ({ ...m, [videoId]: { progress: msg.progress, status: 'processing' } }));
      }
      if (msg.type === 'done') {
        setProcessingMap(m => ({ ...m, [videoId]: { progress: 100, status: 'done' } }));
        es.close();
        delete sseRefs.current[videoId];
        // Refresh video list after a short delay to get updated record
        setTimeout(fetchVideos, 500);
      }
      if (msg.type === 'error') {
        setProcessingMap(m => ({ ...m, [videoId]: { progress: 0, status: 'error', message: msg.message } }));
        es.close();
        delete sseRefs.current[videoId];
        setTimeout(fetchVideos, 500);
      }
      // FIX: handle 'status' replay event from server for late-joining clients
      if (msg.type === 'status' && msg.video) {
        const v = msg.video;
        if (v.status === 'done') {
          setProcessingMap(m => ({ ...m, [videoId]: { progress: 100, status: 'done' } }));
          es.close();
          delete sseRefs.current[videoId];
          setTimeout(fetchVideos, 500);
        } else if (v.status === 'processing') {
          setProcessingMap(m => ({ ...m, [videoId]: { progress: v.progress || 0, status: 'processing' } }));
        }
      }
    };

    es.onerror = (err) => {
      console.warn(`[SSE] Error for ${videoId}`, err);
      // Don't close — browser will auto-reconnect EventSource
    };
  }

  // Cleanup SSE connections on unmount
  useEffect(() => {
    return () => Object.values(sseRefs.current).forEach(es => { try { es.close(); } catch {} });
  }, []);

  async function handleUpload(file) {
    if (!file) return;
    setUploading(true);
    setUploadProgress(0);
    const formData = new FormData();
    formData.append('video', file);
    formData.append('mode', procMode);

    try {
      const token = localStorage.getItem('kerv_token');
      const video = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API}/videos/upload`);
        xhr.setRequestHeader('Authorization', `Bearer ${token}`);
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
          if (xhr.status === 201) resolve(JSON.parse(xhr.responseText).video);
          else reject(new Error(JSON.parse(xhr.responseText).error || 'Upload failed'));
        };
        xhr.onerror = () => reject(new Error('Network error during upload'));
        xhr.send(formData);
      });

      // Add to local state immediately
      setVideos(v => [video, ...v]);
      setProcessingMap(m => ({ ...m, [video.id]: { progress: 0, status: 'processing' } }));

      // FIX: subscribe to SSE *after* upload response, before the server starts processing
      // (server waits 1.5s before firing processVideo to guarantee this connection wins the race)
      subscribeSSE(video.id);

    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleDelete(videoId) {
    if (!confirm('Delete this video and its detections?')) return;
    try {
      await authFetch(`/videos/${videoId}`, { method: 'DELETE' });
      setVideos(v => v.filter(x => x.id !== videoId));
      const es = sseRefs.current[videoId];
      if (es) { es.close(); delete sseRefs.current[videoId]; }
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  }

  async function handleDeleteUser(userId) {
    if (!confirm('Delete this user?')) return;
    await authFetch(`/admin/users/${userId}`, { method: 'DELETE' });
    setUsers(u => u.filter(x => x.id !== userId));
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleUpload(file);
  }

  const statusColor = { uploaded: '#94a3b8', processing: '#f59e0b', done: '#10b981', error: '#ef4444' };
  const statusLabel = { uploaded: 'Queued', processing: 'Processing…', done: 'Ready', error: 'Error' };

  return (
    <div className={styles.page}>
      <aside className={styles.sidebar}>
        <div className={styles.sidebarTop}>
          <div className={styles.sidebarLogo}>
            <span className={styles.logoMark}>◈</span>
            <span className={styles.logoText}>KERV</span>
          </div>
          <nav className={styles.nav}>
            <button className={`${styles.navItem} ${adminTab === 'videos' ? styles.navActive : ''}`} onClick={() => setAdminTab('videos')}>
              <VideoIcon /> My Videos
            </button>
            {user?.role === 'admin' && (
              <>
                <button className={`${styles.navItem} ${adminTab === 'users' ? styles.navActive : ''}`} onClick={() => { setAdminTab('users'); fetchAdminData(); }}>
                  <UsersIcon /> Users
                </button>
                <button className={`${styles.navItem} ${adminTab === 'stats' ? styles.navActive : ''}`} onClick={() => { setAdminTab('stats'); fetchAdminData(); }}>
                  <StatsIcon /> Stats
                </button>
              </>
            )}
          </nav>
        </div>
        <div className={styles.sidebarBottom}>
          <div className={styles.userChip}>
            <div className={styles.userAvatar}>{user?.name?.[0]?.toUpperCase()}</div>
            <div className={styles.userInfo}>
              <div className={styles.userName}>{user?.name}</div>
              <div className={styles.userRole}>{user?.role}</div>
            </div>
          </div>
          <button className={styles.logoutBtn} onClick={logout}>Sign out</button>
        </div>
      </aside>

      <main className={styles.main}>
        {adminTab === 'videos' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.sectionTitle}>Video Library</h1>
              <button className={styles.uploadTrigger} onClick={() => fileRef.current?.click()}>
                + Upload Video
              </button>
              <input ref={fileRef} type="file" accept="video/*" style={{ display: 'none' }}
                onChange={e => { if (e.target.files[0]) handleUpload(e.target.files[0]); }} />
            </div>

            {/* ── Processing speed selector ── */}
            <div className={styles.modeSelector}>
              {[
                { id: 'fast',     label: '⚡ Fast',     sub: 'nano model · every 15th frame' },
                { id: 'balanced', label: '◈ Balanced',  sub: 'nano model · every 8th frame' },
                { id: 'quality',  label: '◆ Quality',   sub: 'medium model · every 5th frame' },
              ].map(m => (
                <button
                  key={m.id}
                  className={`${styles.modeBtn} ${procMode === m.id ? styles.modeBtnActive : ''}`}
                  onClick={() => setProcMode(m.id)}
                >
                  <span className={styles.modeBtnLabel}>{m.label}</span>
                  <span className={styles.modeBtnSub}>{m.sub}</span>
                </button>
              ))}
            </div>

            <div
              className={`${styles.dropZone} ${dragOver ? styles.dragOver : ''}`}
              onDragOver={e => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => !uploading && fileRef.current?.click()}
            >
              {uploading ? (
                <div className={styles.uploadProgress}>
                  <div className={styles.uploadProgressLabel}>Uploading… {uploadProgress}%</div>
                  <div className={styles.progressTrack}>
                    <div className={styles.progressFill} style={{ width: `${uploadProgress}%` }} />
                  </div>
                </div>
              ) : (
                <>
                  <span className={styles.dropIcon}>⬆</span>
                  <span className={styles.dropText}>Drop a video here or click to upload</span>
                  <span className={styles.dropSub}>MP4, WebM, MOV, AVI up to 500MB</span>
                </>
              )}
            </div>

            {loading ? (
              <div className={styles.loadingRow}><div className={styles.spinner} /> Loading videos…</div>
            ) : videos.length === 0 ? (
              <div className={styles.empty}>No videos yet — upload one above to get started</div>
            ) : (
              <div className={styles.videoGrid}>
                {videos.map(video => {
                  const procState = processingMap[video.id];
                  const effectiveStatus = procState?.status || video.status;
                  const progress = procState?.progress ?? video.progress ?? 0;
                  const isReady = effectiveStatus === 'done';
                  const isProcessing = effectiveStatus === 'processing';
                  const isError = effectiveStatus === 'error';

                  return (
                    <div key={video.id} className={`${styles.videoCard} ${isReady ? styles.videoCardReady : ''}`}>
                      <div className={styles.thumb}>
                        <VideoThumbnail
                          src={isReady ? `${API}/videos/${video.id}/stream?token=${localStorage.getItem('kerv_token')}` : null}
                          className={styles.thumbCanvas}
                        />
                        <div className={styles.statusBadge} style={{ '--sc': statusColor[effectiveStatus] }}>
                          <span className={styles.statusDot} />
                          {statusLabel[effectiveStatus] || effectiveStatus}
                        </div>
                      </div>
                      <div className={styles.videoInfo}>
                        <div className={styles.videoName} title={video.originalName}>{video.originalName}</div>
                        <div className={styles.videoMeta}>
                          {formatBytes(video.size)}
                          {video.detectionCount > 0 && ` · ${video.detectionCount} objects`}
                          {video.duration && ` · ${formatDuration(video.duration)}`}
                        </div>

                        {isProcessing && (
                          <div className={styles.processingBar}>
                            <div className={styles.processingFill} style={{ width: `${progress}%` }} />
                            <span className={styles.processingPct}>{progress}%</span>
                          </div>
                        )}

                        {isError && (
                          <div className={styles.errorMsg}>
                            ⚠ Detection failed
                            <button className={styles.retryBtn} onClick={() => fetchVideos()}>Refresh</button>
                          </div>
                        )}

                        <div className={styles.videoActions}>
                          {isReady && (
                            <button className={styles.openBtn} onClick={() => onOpenVideo(video)}>
                              Open Player →
                            </button>
                          )}
                          <button className={styles.deleteBtn} onClick={() => handleDelete(video.id)} title="Delete">✕</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {adminTab === 'users' && user?.role === 'admin' && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}>
              <h1 className={styles.sectionTitle}>User Management</h1>
              <span className={styles.countBadge}>{users.length} users</span>
            </div>
            <div className={styles.table}>
              <div className={styles.tableHead}>
                <span>Name</span><span>Email</span><span>Role</span>
                <span>Videos</span><span>Joined</span><span></span>
              </div>
              {users.map(u => (
                <div key={u.id} className={styles.tableRow}>
                  <span className={styles.userName2}>{u.name}</span>
                  <span className={styles.tableEmail}>{u.email}</span>
                  <span><span className={`${styles.rolePill} ${u.role === 'admin' ? styles.roleAdmin : styles.roleViewer}`}>{u.role}</span></span>
                  <span className={styles.tableNum}>{u.videosProcessed || 0}</span>
                  <span className={styles.tableDate}>{new Date(u.createdAt).toLocaleDateString()}</span>
                  <span>{u.id !== user.id && <button className={styles.deleteBtn} onClick={() => handleDeleteUser(u.id)}>✕</button>}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {adminTab === 'stats' && user?.role === 'admin' && stats && (
          <div className={styles.section}>
            <div className={styles.sectionHeader}><h1 className={styles.sectionTitle}>Platform Stats</h1></div>
            <div className={styles.statsGrid}>
              {[
                { label: 'Total Users', value: stats.totalUsers, color: '#7c3aed' },
                { label: 'Total Videos', value: stats.totalVideos, color: '#a855f7' },
                { label: 'Processed', value: stats.processedVideos, color: '#10b981' },
                { label: 'Processing', value: stats.processingVideos, color: '#f59e0b' },
              ].map(s => (
                <div key={s.label} className={styles.statCard} style={{ '--sc': s.color }}>
                  <div className={styles.statValue}>{s.value}</div>
                  <div className={styles.statLabel}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function formatBytes(b) {
  if (!b) return '';
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
function formatDuration(s) {
  const m = Math.floor(s / 60), sec = Math.floor(s % 60);
  return `${m}:${String(sec).padStart(2, '0')}`;
}

const VideoIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>;
const UsersIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>;
const StatsIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zM9 17H7v-7h2v7zm4 0h-2V7h2v10zm4 0h-2v-4h2v4z"/></svg>;
