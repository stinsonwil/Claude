import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, fmtTime } from '../lib/api.js';
import { useApp } from '../App.jsx';

export default function Workflows() {
  const [workflows, setWorkflows] = useState([]);
  const [modal, setModal] = useState(false);
  const [name, setName] = useState('');
  const [describe, setDescribe] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { toast } = useApp();

  const load = async () => setWorkflows(await api('/workflows'));
  useEffect(() => { load(); }, []);

  const createBlank = async () => {
    try {
      const wf = await api('/workflows', { method: 'POST', body: { name: name || 'Untitled workflow', definition: { blocks: [] } } });
      navigate(`/workflows/${wf.id}`);
    } catch (err) { toast(err.message, 'error'); }
  };

  const generate = async () => {
    setBusy(true);
    try {
      const gen = await api('/workflows/generate', { method: 'POST', body: { description: describe } });
      const wf = await api('/workflows', { method: 'POST', body: gen });
      navigate(`/workflows/${wf.id}`);
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const dup = (w) => async () => { await api(`/workflows/${w.id}/duplicate`, { method: 'POST' }); load(); };
  const del = (w) => async () => {
    if (!confirm(`Delete workflow "${w.name}"?`)) return;
    await api(`/workflows/${w.id}`, { method: 'DELETE' }); load();
  };
  const run = (w) => async () => {
    try {
      const { task_id } = await api(`/workflows/${w.id}/run`, { method: 'POST', body: {} });
      navigate(`/tasks/${task_id}`);
    } catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="row mb">
        <h2 className="grow" style={{ fontSize: '1.2rem' }}>Workflows</h2>
        <button className="btn primary" onClick={() => setModal(true)}>+ New workflow</button>
      </div>
      <p className="muted small mb">Reusable multi-step automations built from Yoshi's capabilities. Runs execute through the same task engine as everything else.</p>
      {workflows.length === 0 ? (
        <div className="empty"><div className="big">🧩</div>No workflows yet.</div>
      ) : (
        <table className="table">
          <thead><tr><th>Workflow</th><th>Version</th><th>Updated</th><th /></tr></thead>
          <tbody>
            {workflows.map((w) => (
              <tr key={w.id}>
                <td><Link to={`/workflows/${w.id}`} style={{ color: 'var(--text)', fontWeight: 500 }}>{w.name}</Link>
                  <div className="muted small">{w.description?.slice(0, 90)}</div></td>
                <td className="muted small">v{w.version}</td>
                <td className="muted small">{fmtTime(w.updated_at)}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn sm primary" onClick={run(w)}>▶ Run</button>
                    <Link className="btn sm ghost" to={`/workflows/${w.id}`}>Edit</Link>
                    <button className="btn sm ghost" onClick={dup(w)}>Duplicate</button>
                    <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={del(w)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>New workflow</h3>
            <label className="field"><span>Describe it in plain language and Yoshi will build it</span>
              <textarea value={describe} onChange={(e) => setDescribe(e.target.value)}
                placeholder="e.g. Every run: research my competitor's latest announcements, and if there's anything significant, create a one-page PDF brief and notify me" />
            </label>
            <button className="btn primary" style={{ width: '100%' }} disabled={busy || !describe.trim()} onClick={generate}>
              {busy ? 'Generating…' : '✨ Generate workflow'}
            </button>
            <hr style={{ margin: '18px 0', borderColor: 'var(--border)' }} />
            <label className="field"><span>…or start from scratch</span>
              <input type="text" placeholder="Workflow name" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
            <button className="btn" style={{ width: '100%' }} onClick={createBlank}>Create blank workflow</button>
          </div>
        </div>
      )}
    </div>
  );
}
