import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useApp } from '../App.jsx';

const SUGGESTIONS = [
  'Research the top 5 CRM tools for small teams and build a PDF comparison report',
  'Monitor the price of the MacBook Air on bestbuy.com and alert me when it drops',
  'Every Monday at 9am, research what happened in AI last week and email-style summarize it',
  'Analyze the attached contract and list risky clauses with action items',
  'Compare pricing pages of Notion, Asana and Linear and make a spreadsheet',
  'Remember that I prefer formal writing and one-page summaries',
];

export default function NewTask() {
  const [goal, setGoal] = useState('');
  const [busy, setBusy] = useState(false);
  const [attached, setAttached] = useState([]);
  const fileRef = useRef();
  const navigate = useNavigate();
  const { toast } = useApp();

  const upload = async (fileList) => {
    const fd = new FormData();
    for (const f of fileList) fd.append('files', f);
    try {
      const files = await api('/files', { method: 'POST', formData: fd });
      setAttached((prev) => [...prev, ...files]);
    } catch (err) {
      toast(err.message, 'error');
    }
  };

  const start = async () => {
    if (!goal.trim() || busy) return;
    setBusy(true);
    try {
      const task = await api('/tasks', {
        method: 'POST',
        body: { goal: goal.trim(), file_ids: attached.map((f) => f.id) },
      });
      navigate(`/tasks/${task.id}`);
    } catch (err) {
      toast(err.message, 'error');
      setBusy(false);
    }
  };

  return (
    <div className="hero-input">
      <h2>What should Yoshi do for you?</h2>
      <p>One agent for research, browsing, files, documents, monitoring, scheduling and workflows. Just describe the goal.</p>
      <div className="goal-box">
        <textarea
          autoFocus
          placeholder="e.g. Research the European e-bike market, compare the top competitors, and produce an investor-ready PDF report…"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) start(); }}
        />
        {attached.length > 0 && (
          <div className="attach-list">
            {attached.map((f) => (
              <span className="chip" key={f.id}>📎 {f.name}
                <button onClick={() => setAttached((prev) => prev.filter((x) => x.id !== f.id))}>✕</button>
              </span>
            ))}
          </div>
        )}
        <div className="goal-actions">
          <div>
            <input type="file" multiple hidden ref={fileRef} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
            <button className="btn ghost" onClick={() => fileRef.current.click()}>📎 Attach files</button>
          </div>
          <button className="btn primary" onClick={start} disabled={busy || !goal.trim()}>
            {busy ? 'Starting…' : 'Start task ⌘⏎'}
          </button>
        </div>
      </div>
      <div className="suggestions">
        {SUGGESTIONS.map((s) => (
          <button key={s} onClick={() => setGoal(s)}>{s.length > 64 ? `${s.slice(0, 64)}…` : s}</button>
        ))}
      </div>
    </div>
  );
}
