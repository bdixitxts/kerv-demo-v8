import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import styles from './LoginPage.module.css';

export default function LoginPage() {
  const { login, register } = useAuth();
  const [tab, setTab] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const update = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (tab === 'login') {
        await login(form.email, form.password);
      } else {
        if (!form.name.trim()) { setError('Name is required'); setLoading(false); return; }
        await register(form.name, form.email, form.password);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function fillDemo(email, password) {
    setForm(f => ({ ...f, email, password }));
    setTab('login');
  }

  return (
    <div className={styles.page}>
      {/* Background effects */}
      <div className={styles.bgGlow1} />
      <div className={styles.bgGlow2} />
      <div className={styles.grid} />

      <div className={styles.container}>
        {/* Logo */}
        <div className={styles.logo}>
          <span className={styles.logoMark}>◈</span>
          <div>
            <div className={styles.logoText}>KERV</div>
            <div className={styles.logoSub}>Interactive Video Intelligence</div>
          </div>
        </div>

        {/* Card */}
        <div className={styles.card}>
          {/* Tabs */}
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`}
              onClick={() => { setTab('login'); setError(''); }}
            >Sign In</button>
            <button
              className={`${styles.tab} ${tab === 'register' ? styles.tabActive : ''}`}
              onClick={() => { setTab('register'); setError(''); }}
            >Create Account</button>
          </div>

          <form className={styles.form} onSubmit={handleSubmit}>
            {tab === 'register' && (
              <div className={styles.field}>
                <label className={styles.label}>Full Name</label>
                <input
                  className={styles.input}
                  type="text"
                  name="name"
                  placeholder="Jane Smith"
                  value={form.name}
                  onChange={update}
                  autoComplete="name"
                />
              </div>
            )}
            <div className={styles.field}>
              <label className={styles.label}>Email</label>
              <input
                className={styles.input}
                type="email"
                name="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={update}
                autoComplete="email"
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Password</label>
              <input
                className={styles.input}
                type="password"
                name="password"
                placeholder={tab === 'register' ? 'At least 6 characters' : '••••••••'}
                value={form.password}
                onChange={update}
                autoComplete={tab === 'login' ? 'current-password' : 'new-password'}
              />
            </div>

            {error && <div className={styles.error}>{error}</div>}

            <button className={styles.submitBtn} type="submit" disabled={loading}>
              {loading
                ? <span className={styles.spinner} />
                : tab === 'login' ? 'Sign In →' : 'Create Account →'
              }
            </button>
          </form>

          {/* Demo credentials */}
          {tab === 'login' && (
            <div className={styles.demoSection}>
              <div className={styles.demoLabel}>Quick access</div>
              <div className={styles.demoBtns}>
                <button
                  className={styles.demoBtn}
                  onClick={() => fillDemo('admin@kerv.demo', 'admin123')}
                >
                  <span className={styles.demoRole}>Admin</span>
                  <span className={styles.demoEmail}>admin@kerv.demo</span>
                </button>
                <button
                  className={styles.demoBtn}
                  onClick={() => fillDemo('viewer@kerv.demo', 'viewer123')}
                >
                  <span className={styles.demoRole}>Viewer</span>
                  <span className={styles.demoEmail}>viewer@kerv.demo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        <p className={styles.footer}>
          YOLOv8 · OpenCV · React · Node.js
        </p>
      </div>
    </div>
  );
}
