import React, { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';

export default function Settings() {
  const { user, refreshUser, toast } = useApp();
  const [form, setForm] = useState({ name: user.name, timezone: user.timezone });
  const [status, setStatus] = useState(null);

  useEffect(() => { api('/status').then(setStatus); }, []);

  const save = async () => {
    try {
      await api('/auth/me', { method: 'PATCH', body: form });
      refreshUser();
      toast('Settings saved');
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div style={{ maxWidth: 620 }}>
      <h2 className="mb" style={{ fontSize: '1.2rem' }}>Settings</h2>
      <div className="card mb">
        <strong>Profile</strong>
        <label className="field mt"><span>Name</span>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field"><span>Timezone (used for schedules)</span>
          <input type="text" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} /></label>
        <label className="field"><span>Email</span>
          <input type="email" value={user.email} disabled /></label>
        <button className="btn primary" onClick={save}>Save</button>
      </div>
      <div className="card mb">
        <strong>Memory</strong>
        <p className="muted small mt">Control whether Yoshi uses saved memories, and manage them, on the Memory page.</p>
      </div>
      {status && (
        <div className="card">
          <strong>System</strong>
          <p className="small mt">
            AI engine: {status.ai_configured
              ? <span style={{ color: 'var(--accent)' }}>configured ✓</span>
              : <span style={{ color: 'var(--amber)' }}>not configured — an administrator must set ANTHROPIC_API_KEY on the server. Tasks that need AI will fail with a clear error until then.</span>}
          </p>
        </div>
      )}
    </div>
  );
}
