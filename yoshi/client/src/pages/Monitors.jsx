import React, { useEffect, useState } from 'react';
import { api, fmtTime, downloadUrl } from '../lib/api.js';
import { useApp } from '../App.jsx';

const KINDS = ['content', 'price', 'availability', 'keyword', 'uptime'];

function MonitorModal({ monitor, onClose, onSaved }) {
  const { toast } = useApp();
  const [form, setForm] = useState({
    name: monitor?.name || '', url: monitor?.url || '', kind: monitor?.kind || 'content',
    keywords: monitor?.keywords || '', interval_minutes: monitor?.interval_minutes || 60,
  });
  const save = async () => {
    try {
      if (monitor) await api(`/monitors/${monitor.id}`, { method: 'PATCH', body: form });
      else await api('/monitors', { method: 'POST', body: form });
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{monitor ? 'Edit monitor' : 'New monitor'}</h3>
        <label className="field"><span>Name</span>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        <label className="field"><span>URL to watch</span>
          <input type="url" placeholder="https://…" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} /></label>
        <label className="field"><span>What to watch for</span>
          <select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })}>
            <option value="content">Content changes (posts, announcements, anything meaningful)</option>
            <option value="price">Price changes</option>
            <option value="availability">Stock / availability</option>
            <option value="keyword">Specific keywords</option>
            <option value="uptime">Website downtime</option>
          </select></label>
        {form.kind === 'keyword' && (
          <label className="field"><span>Keywords (comma separated)</span>
            <input type="text" value={form.keywords} onChange={(e) => setForm({ ...form, keywords: e.target.value })} /></label>
        )}
        <label className="field"><span>Check every (minutes, min 5)</span>
          <input type="number" min={5} value={form.interval_minutes} onChange={(e) => setForm({ ...form, interval_minutes: Number(e.target.value) })} /></label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!form.url}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function Monitors() {
  const [monitors, setMonitors] = useState([]);
  const [modal, setModal] = useState(null);
  const [events, setEvents] = useState(null);
  const { toast } = useApp();

  const load = async () => setMonitors(await api('/monitors'));
  useEffect(() => { load(); }, []);

  const check = (m) => async () => {
    toast(`Checking ${m.name}…`);
    try { await api(`/monitors/${m.id}/check`, { method: 'POST' }); load(); }
    catch (err) { toast(err.message, 'error'); }
  };
  const toggle = (m) => async () => { await api(`/monitors/${m.id}`, { method: 'PATCH', body: { enabled: !m.enabled } }); load(); };
  const del = (m) => async () => {
    if (!confirm(`Delete monitor "${m.name}"?`)) return;
    await api(`/monitors/${m.id}`, { method: 'DELETE' }); load();
  };
  const showEvents = (m) => async () => setEvents({ monitor: m, rows: await api(`/monitors/${m.id}/events`) });

  return (
    <div>
      <div className="row mb">
        <h2 className="grow" style={{ fontSize: '1.2rem' }}>Website monitors</h2>
        <button className="btn primary" onClick={() => setModal('new')}>+ New monitor</button>
      </div>
      <p className="muted small mb">Yoshi checks these pages on schedule, saves evidence snapshots, and notifies you when something meaningful changes.</p>
      {monitors.length === 0 ? (
        <div className="empty"><div className="big">📡</div>No monitors yet.</div>
      ) : (
        <table className="table">
          <thead><tr><th>Monitor</th><th>Type</th><th>Interval</th><th>Last check</th><th>Status</th><th /></tr></thead>
          <tbody>
            {monitors.map((m) => (
              <tr key={m.id}>
                <td style={{ fontWeight: 500 }}>{m.name}<div className="muted small">{m.url}</div></td>
                <td><span className="badge">{m.kind}</span></td>
                <td className="muted small">{m.interval_minutes} min</td>
                <td className="muted small">{fmtTime(m.last_checked_at)}</td>
                <td><span className={`badge ${m.enabled ? (String(m.last_status).startsWith('down') ? 'down' : 'completed') : 'paused'}`}>
                  {m.enabled ? (m.last_status || 'waiting') : 'paused'}</span></td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn sm ghost" onClick={check(m)}>Check now</button>
                    <button className="btn sm ghost" onClick={showEvents(m)}>Changes</button>
                    <button className="btn sm ghost" onClick={() => setModal(m)}>Edit</button>
                    <button className="btn sm ghost" onClick={toggle(m)}>{m.enabled ? 'Pause' : 'Resume'}</button>
                    <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={del(m)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modal && <MonitorModal monitor={modal === 'new' ? null : modal} onClose={() => setModal(null)} onSaved={() => { setModal(null); load(); }} />}
      {events && (
        <div className="modal-backdrop" onClick={() => setEvents(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>Detected changes — {events.monitor.name}</h3>
            {events.rows.length === 0 && <p className="muted">No changes detected yet.</p>}
            {events.rows.map((e) => (
              <div key={e.id} className="card mb">
                <div className="muted small">{fmtTime(e.created_at)}</div>
                <p className="mt" style={{ marginTop: 6 }}>{e.summary}</p>
                {e.snapshot_file_id && <a className="small" href={downloadUrl(e.snapshot_file_id)}>Download evidence snapshot</a>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
