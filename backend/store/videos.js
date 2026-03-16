const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const VIDEOS_FILE = path.join(__dirname, '../data/videos.json');

function readVideos() {
  if (!fs.existsSync(VIDEOS_FILE)) {
    fs.writeFileSync(VIDEOS_FILE, '[]');
    return [];
  }
  return JSON.parse(fs.readFileSync(VIDEOS_FILE, 'utf8'));
}

function writeVideos(videos) {
  fs.writeFileSync(VIDEOS_FILE, JSON.stringify(videos, null, 2));
}

function getAllVideos() {
  return readVideos();
}

function getVideosByUser(userId) {
  return readVideos().filter(v => v.uploadedBy === userId);
}

function getVideoById(id) {
  return readVideos().find(v => v.id === id);
}

function createVideo({ filename, originalName, uploadedBy, size }) {
  const videos = readVideos();
  const video = {
    id: uuidv4(),
    filename,
    originalName,
    uploadedBy,
    size,
    status: 'uploaded',   // uploaded | processing | done | error
    progress: 0,
    detectionCount: 0,
    uploadedAt: new Date().toISOString(),
    processedAt: null,
    metadataFile: null,
    duration: null,
    error: null,
  };
  videos.push(video);
  writeVideos(videos);
  return video;
}

function updateVideo(id, updates) {
  const videos = readVideos();
  const idx = videos.findIndex(v => v.id === id);
  if (idx === -1) return null;
  videos[idx] = { ...videos[idx], ...updates };
  writeVideos(videos);
  return videos[idx];
}

function deleteVideo(id) {
  const videos = readVideos().filter(v => v.id !== id);
  writeVideos(videos);
}

module.exports = { getAllVideos, getVideosByUser, getVideoById, createVideo, updateVideo, deleteVideo };
