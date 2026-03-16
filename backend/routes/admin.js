const express = require('express');
const { getAllUsers, deleteUser, updateUser, createUser, safeUser } = require('../store/users');
const { authMiddleware, adminOnly } = require('../middleware/auth');
const { getAllVideos } = require('../store/videos');

const router = express.Router();
router.use(authMiddleware, adminOnly);

// GET /admin/users
router.get('/users', (req, res) => {
  res.json({ users: getAllUsers() });
});

// POST /admin/users
router.post('/users', (req, res) => {
  const { email, password, name, role } = req.body;
  if (!email || !password || !name)
    return res.status(400).json({ error: 'name, email, password required' });
  try {
    const user = createUser({ email, password, name, role: role || 'viewer' });
    res.status(201).json({ user: safeUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// PATCH /admin/users/:id
router.patch('/users/:id', (req, res) => {
  try {
    const { password, ...updates } = req.body;
    if (password) {
      const bcrypt = require('bcryptjs');
      updates.password = bcrypt.hashSync(password, 10);
    }
    const user = updateUser(req.params.id, updates);
    res.json({ user: safeUser(user) });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /admin/users/:id
router.delete('/users/:id', (req, res) => {
  if (req.params.id === req.user.id)
    return res.status(400).json({ error: 'Cannot delete yourself' });
  deleteUser(req.params.id);
  res.json({ success: true });
});

// GET /admin/videos  (all videos across all users)
router.get('/videos', (req, res) => {
  res.json({ videos: getAllVideos() });
});

// GET /admin/stats
router.get('/stats', (req, res) => {
  const users = getAllUsers();
  const videos = getAllVideos();
  res.json({
    totalUsers: users.length,
    totalVideos: videos.length,
    processedVideos: videos.filter(v => v.status === 'done').length,
    processingVideos: videos.filter(v => v.status === 'processing').length,
  });
});

module.exports = router;
