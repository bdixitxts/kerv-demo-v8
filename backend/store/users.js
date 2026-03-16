const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

const USERS_FILE = path.join(__dirname, '../data/users.json');

function readUsers() {
  if (!fs.existsSync(USERS_FILE)) {
    // Seed with default admin + viewer
    const users = [
      {
        id: uuidv4(),
        email: 'admin@kerv.demo',
        password: bcrypt.hashSync('admin123', 10),
        name: 'Admin User',
        role: 'admin',
        createdAt: new Date().toISOString(),
        videosProcessed: 0,
      },
      {
        id: uuidv4(),
        email: 'viewer@kerv.demo',
        password: bcrypt.hashSync('viewer123', 10),
        name: 'Demo Viewer',
        role: 'viewer',
        createdAt: new Date().toISOString(),
        videosProcessed: 0,
      },
    ];
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
    return users;
  }
  return JSON.parse(fs.readFileSync(USERS_FILE, 'utf8'));
}

function writeUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2));
}

function findByEmail(email) {
  return readUsers().find(u => u.email.toLowerCase() === email.toLowerCase());
}

function findById(id) {
  return readUsers().find(u => u.id === id);
}

function createUser({ email, password, name, role = 'viewer' }) {
  const users = readUsers();
  if (users.find(u => u.email.toLowerCase() === email.toLowerCase())) {
    throw new Error('Email already registered');
  }
  const user = {
    id: uuidv4(),
    email,
    password: bcrypt.hashSync(password, 10),
    name,
    role,
    createdAt: new Date().toISOString(),
    videosProcessed: 0,
  };
  users.push(user);
  writeUsers(users);
  return user;
}

function updateUser(id, updates) {
  const users = readUsers();
  const idx = users.findIndex(u => u.id === id);
  if (idx === -1) throw new Error('User not found');
  users[idx] = { ...users[idx], ...updates };
  writeUsers(users);
  return users[idx];
}

function deleteUser(id) {
  const users = readUsers();
  const filtered = users.filter(u => u.id !== id);
  writeUsers(filtered);
}

function getAllUsers() {
  return readUsers().map(({ password, ...u }) => u);
}

function safeUser(u) {
  const { password, ...safe } = u;
  return safe;
}

module.exports = { findByEmail, findById, createUser, updateUser, deleteUser, getAllUsers, safeUser, readUsers };
