import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, fmtTime, STATUS_LABELS } from '../lib/api.js';
import { useApp } from '../App.jsx';

const CRON_PRESETS = [
  { label: 'Every day at 9:00', cron: '0 9 * * *' },
  { label: 'Every Monday at 9:00', cron: '0 9 * * 1' },
  { label: 'First of the month at 8:00', cron: '0 8 1 * *' },
  { label: 'Every hour', cron: '0 * * * *' },
];

function ScheduleModal({ schedule, onClose, onSaved }) {
  const { toast } = useApp();
  const [form, setForm] = useState({
    name: schedule?.name || '',
    goal: schedule?.goal || '',
    mode: schedule?.run_once_at ? 'once' : 'recurring',
    cron: schedule?.cron || '0 9 * * *',
    run_once_at: schedule?.run_once_at ? schedule.run_once_at.slice(0, 16) : '',
    timezone: schedule?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone,
  });
  const save = async () => {
    const body = {
      name: form.name, goal: form.goal, timezone: form.timezone,
      cron: form.mode === 'recurring' ? form.cron : null,
      run_once_at: form.mode === 'once' ? new Date(form.run_once_at).toISOString() : null,
    };
    try {
      if (schedule) await api(`/schedules/${schedule.id}`, { method: 'PATCH', body });
      else await api('/schedules', { method: 'POST', body });
      onSaved();
    } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{schedule ? 'Edit schedule' : 'New schedule'}</h3>
        <label className="field"><span>Name</span>
          <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </label>
        <label className="field"><span>What should Yoshi do on each run?</span>
          <textarea value={form.goal} onChange={(e) => setForm({ ...form, goal: e.target.value })}
            placeholder="e.g. Research this week's fintech funding rounds and produce a summary report" />
        </label>
        <label className="field"><span>Type</span>
          <select value={form.mode} onChange={(e) => setForm({ ...form, mode: e.target.value })}>
            <option value="recurring">Recurring (cron)</option>
            <option value="once">One time</option>
          </select>
        </label>
        {form.mode === 'recurring' ? (
          <>
            <label className="field"><span>Cron expression (min hour day month weekday)</span>
              <input type="text" value={form.cron} onChange={(e) => setForm({ ...form, cron: e.target.value })} />
            </label>
            <div className="row mb" style={{ flexWrap: 'wrap' }}>
              {CRON_PRESETS.map((p) => (
                <button key={p.cron} className="btn sm ghost" onClick={() => setForm({ ...form, cron: p.cron })}>{p.label}</button>
              ))}
            </div>
          </>
        ) : (
          <label className="field"><span>Run at</span>
            <input type="datetime-local" value={form.run_once_at} onChange={(e) => setForm({ ...form, run_once_at: e.target.value })} />
          </label>
        )}
        <label className="field"><span>Timezone</span>
          <input type="text" value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })} />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save} disabled={!form.goal.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function Schedules() {
  const [schedules, setSchedules] = useState([]);
  const [modal, setModal] = useState(null); // null | 'new' | schedule
  const [history, setHistory] = useState(null); // {schedule, runs}
  const { toast } = useApp();

  const load = async () => setSchedules(await api('/schedules'));
  useEffect(() => { load(); }, []);

  const toggle = (s) => async () => {
    try { await api(`/schedules/${s.id}`, { method: 'PATCH', body: { enabled: !s.enabled } }); load(); }
    catch (err) { toast(err.message, 'error'); }
  };
  const del = (s) => async () => {
    if (!confirm(`Delete schedule "${s.name}"?`)) return;
    await api(`/schedules/${s.id}`, { method: 'DELETE' }); load();
  };
  const runNow = (s) => async () => {
    try { const { task_id } = await api(`/schedules/${s.id}/run`, { method: 'POST' }); toast('Run started'); load(); }
    catch (err) { toast(err.message, 'error'); }
  };
  const showHistory = (s) => async () => {
    setHistory({ schedule: s, runs: await api(`/schedules/${s.id}/history`) });
  };

  return (
    <div>
      <div className="row mb">
        <h2 className="grow" style={{ fontSize: '1.2rem' }}>Scheduled tasks</h2>
        <button className="btn primary" onClick={() => setModal('new')}>+ New schedule</button>
      </div>
      <p className="muted small mb">Schedules run on the server — they execute even when you're offline or logged out.</p>
      {schedules.length === 0 ? (
        <div className="empty"><div className="big">🗓️</div>No schedules yet.</div>
      ) : (
        <table className="table">
          <thead><tr><th>Name</th><th>When</th><th>Next run</th><th>Last run</th><th>Status</th><th /></tr></thead>
          <tbody>
            {schedules.map((s) => (
              <tr key={s.id}>
                <td style={{ fontWeight: 500 }}>{s.name}<div className="muted small">{s.goal?.slice(0, 80)}</div></td>
                <td className="muted small">{s.cron ? `${s.cron} (${s.timezone})` : `once at ${fmtTime(s.run_once_at)}`}</td>
                <td className="muted small">{fmtTime(s.next_run_at)}</td>
                <td className="muted small">{fmtTime(s.last_run_at)}</td>
                <td><span className={`badge ${s.enabled ? 'completed' : 'paused'}`}>{s.enabled ? 'active' : 'paused'}</span></td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                    <button className="btn sm ghost" onClick={runNow(s)}>Run now</button>
                    <button className="btn sm ghost" onClick={toggle(s)}>{s.enabled ? 'Pause' : 'Resume'}</button>
                    <button className="btn sm ghost" onClick={() => setModal(s)}>Edit</button>
                    <button className="btn sm ghost" onClick={showHistory(s)}>History</button>
                    <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={del(s)}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {modal && (
        <ScheduleModal
          schedule={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); load(); }}
        />
      )}
      {history && (
        <div className="modal-backdrop" onClick={() => setHistory(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <h3>History — {history.schedule.name}</h3>
            {history.runs.length === 0 && <p className="muted">No runs yet.</p>}
            {history.runs.map((r) => (
              <div className="row" key={r.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                <span className="grow small">{fmtTime(r.started_at)}</span>
                <span className={`badge ${r.task_status || ''}`}>{STATUS_LABELS[r.task_status] || r.task_status || r.status}</span>
                {r.task_id && <Link className="btn sm ghost" to={`/tasks/${r.task_id}`}>Open task</Link>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
