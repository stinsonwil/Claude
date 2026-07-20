import React, { useEffect, useState } from 'react';
import { api, fmtTime } from '../lib/api.js';
import { useApp } from '../App.jsx';

const CATEGORIES = ['preference', 'writing_style', 'project', 'company', 'instruction', 'general'];

export default function Memories() {
  const { user, refreshUser, toast } = useApp();
  const [memories, setMemories] = useState([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({ category: 'preference', project: '', content: '' });
  const [editing, setEditing] = useState(null);

  const load = async (query = q) => setMemories(await api(`/memories?q=${encodeURIComponent(query)}`));
  useEffect(() => { load(''); }, []);

  const add = async () => {
    try {
      await api('/memories', { method: 'POST', body: { ...form, project: form.project || null } });
      setForm({ ...form, content: '' });
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const saveEdit = async () => {
    try {
      await api(`/memories/${editing.id}`, { method: 'PATCH', body: { content: editing.content, category: editing.category, project: editing.project || null } });
      setEditing(null); load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const toggleGlobal = async () => {
    await api('/auth/me', { method: 'PATCH', body: { memory_enabled: !user.memory_enabled } });
    refreshUser();
  };

  return (
    <div>
      <div className="row mb">
        <h2 className="grow" style={{ fontSize: '1.2rem' }}>Memory</h2>
        <button className="btn" onClick={toggleGlobal}>
          {user.memory_enabled ? '🟢 Memory on — click to disable' : '⚪ Memory off — click to enable'}
        </button>
      </div>
      <p className="muted small mb">
        Yoshi uses these memories to improve future work. They are private to your account, editable, and deletable.
        {!user.memory_enabled && ' Memory is currently disabled: nothing here influences responses.'}
      </p>

      <div className="card mb">
        <strong>Add a memory</strong>
        <div className="row mt" style={{ alignItems: 'flex-start' }}>
          <select style={{ width: 170 }} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <input type="text" style={{ width: 160 }} placeholder="Project (optional)" value={form.project} onChange={(e) => setForm({ ...form, project: e.target.value })} />
          <input type="text" className="grow" placeholder="e.g. Reports should always be one page and formal in tone"
            value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })}
            onKeyDown={(e) => e.key === 'Enter' && add()} />
          <button className="btn primary" onClick={add} disabled={!form.content.trim()}>Save</button>
        </div>
        <p className="muted small mt">Yoshi never auto-stores sensitive information — only what you explicitly save or ask it to remember.</p>
      </div>

      <div className="row mb">
        <input type="text" placeholder="Search memories…" value={q}
          onChange={(e) => { setQ(e.target.value); load(e.target.value); }} />
      </div>

      {memories.length === 0 ? (
        <div className="empty"><div className="big">🧠</div>No memories yet.</div>
      ) : (
        <div className="grid">
          {memories.map((m) => (
            <div className="card" key={m.id}>
              {editing?.id === m.id ? (
                <>
                  <div className="row mb">
                    <select style={{ width: 160 }} value={editing.category} onChange={(e) => setEditing({ ...editing, category: e.target.value })}>
                      {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                    </select>
                    <input type="text" style={{ width: 150 }} placeholder="Project" value={editing.project || ''} onChange={(e) => setEditing({ ...editing, project: e.target.value })} />
                  </div>
                  <textarea value={editing.content} onChange={(e) => setEditing({ ...editing, content: e.target.value })} />
                  <div className="row mt" style={{ justifyContent: 'flex-end' }}>
                    <button className="btn sm ghost" onClick={() => setEditing(null)}>Cancel</button>
                    <button className="btn sm primary" onClick={saveEdit}>Save</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="row">
                    <span className="badge">{m.category}</span>
                    {m.project && <span className="badge">📂 {m.project}</span>}
                    {!m.enabled && <span className="badge paused">disabled</span>}
                    <span className="muted small grow" style={{ textAlign: 'right' }}>{fmtTime(m.updated_at)}</span>
                  </div>
                  <p className="mt">{m.content}</p>
                  <div className="row mt">
                    <button className="btn sm ghost" onClick={() => setEditing({ ...m })}>Edit</button>
                    <button className="btn sm ghost" onClick={async () => { await api(`/memories/${m.id}`, { method: 'PATCH', body: { enabled: !m.enabled } }); load(); }}>
                      {m.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button className="btn sm ghost" style={{ color: 'var(--red)' }}
                      onClick={async () => { await api(`/memories/${m.id}`, { method: 'DELETE' }); load(); }}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
