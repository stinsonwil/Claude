import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime } from '../lib/api.js';
import { useApp } from '../App.jsx';

export default function Activity() {
  const [events, setEvents] = useState([]);
  const { onEvent } = useApp();

  const load = async () => setEvents(await api('/activity'));
  useEffect(() => { load(); }, []);
  useEffect(() => onEvent((type) => { if (type === 'task.event') load(); }), [onEvent]);

  return (
    <div>
      <h2 className="mb" style={{ fontSize: '1.2rem' }}>Activity history</h2>
      {events.length === 0 ? (
        <div className="empty"><div className="big">📜</div>No activity yet.</div>
      ) : (
        <table className="table">
          <thead><tr><th>When</th><th>Task</th><th>Event</th></tr></thead>
          <tbody>
            {events.map((e) => (
              <tr key={e.id}>
                <td className="muted small" style={{ whiteSpace: 'nowrap' }}>{fmtTime(e.created_at)}</td>
                <td><Link to={`/tasks/${e.task_id}`}>{e.task_title}</Link></td>
                <td className="small">{e.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
