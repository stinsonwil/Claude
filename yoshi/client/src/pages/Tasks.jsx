import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime, STATUS_LABELS } from '../lib/api.js';
import { useApp } from '../App.jsx';

const FILTERS = ['all', 'running', 'awaiting_approval', 'awaiting_input', 'paused', 'completed', 'failed'];

export default function Tasks() {
  const [tasks, setTasks] = useState([]);
  const [filter, setFilter] = useState('all');
  const { onEvent } = useApp();

  const load = async () => setTasks(await api('/tasks'));
  useEffect(() => { load(); }, []);
  useEffect(() => onEvent((type) => { if (type === 'task.updated') load(); }), [onEvent]);

  const shown = filter === 'all' ? tasks : tasks.filter((t) => t.status === filter);

  return (
    <div>
      <div className="tabs">
        {FILTERS.map((f) => (
          <button key={f} className={filter === f ? 'active' : ''} onClick={() => setFilter(f)}>
            {f === 'all' ? 'All' : STATUS_LABELS[f]}
          </button>
        ))}
      </div>
      {shown.length === 0 ? (
        <div className="empty"><div className="big">🗂️</div>No tasks here yet. Start one from <Link to="/">New task</Link>.</div>
      ) : (
        <table className="table">
          <thead>
            <tr><th>Task</th><th>Status</th><th style={{ width: 180 }}>Progress</th><th>Source</th><th>Updated</th></tr>
          </thead>
          <tbody>
            {shown.map((t) => (
              <tr key={t.id}>
                <td><Link to={`/tasks/${t.id}`} style={{ color: 'var(--text)', fontWeight: 500 }}>{t.title}</Link></td>
                <td><span className={`badge ${t.status}`}>{STATUS_LABELS[t.status] || t.status}</span></td>
                <td>
                  <div className="progress"><div style={{ width: `${Math.round(t.progress * 100)}%` }} /></div>
                  <span className="muted small">{Math.round(t.progress * 100)}%</span>
                </td>
                <td className="muted small">{t.source}</td>
                <td className="muted small">{fmtTime(t.updated_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
