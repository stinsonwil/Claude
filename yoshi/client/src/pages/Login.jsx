import React, { useState } from 'react';
import { api, setToken } from '../lib/api.js';
import { useApp } from '../App.jsx';

export default function Login() {
  const { setUser, refreshUser } = useApp();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ email: '', name: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try {
      const path = mode === 'login' ? '/auth/login' : '/auth/register';
      const { token, user } = await api(path, { method: 'POST', body: form });
      setToken(token);
      setUser(user);
      refreshUser();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="auth-hero">
          <div className="egg">🦖</div>
          <h1>Yoshi</h1>
          <p>Your AI work agent. Describe the goal — Yoshi researches, browses, builds documents, monitors, schedules, and delivers.</p>
        </div>
        <div className="card">
          {error && <div className="error-box">{error}</div>}
          <form onSubmit={submit}>
            {mode === 'register' && (
              <label className="field"><span>Name</span>
                <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              </label>
            )}
            <label className="field"><span>Email</span>
              <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
            </label>
            <label className="field"><span>Password</span>
              <input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={8} />
            </label>
            <button className="btn primary" style={{ width: '100%' }} disabled={busy}>
              {busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
            </button>
          </form>
          <p className="muted small mt" style={{ textAlign: 'center' }}>
            {mode === 'login' ? (
              <>New to Yoshi? <a href="#" onClick={(e) => { e.preventDefault(); setMode('register'); setError(''); }}>Create an account</a></>
            ) : (
              <>Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setMode('login'); setError(''); }}>Log in</a></>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}
