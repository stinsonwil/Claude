import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api, downloadUrl, fmtTime, fmtSize, STATUS_LABELS } from '../lib/api.js';
import { renderMarkdown } from '../lib/markdown.js';
import { useApp } from '../App.jsx';

const CAP_ICONS = {
  research: '🔎', browser: '🌐', file_analysis: '📄', create_document: '📝',
  setup_monitor: '📡', setup_schedule: '🗓️', save_memory: '🧠', approval: '✋',
  condition: '🔀', notify_user: '🔔', answer: '💬',
};

function StepEditor({ step, onSave, onClose }) {
  const [form, setForm] = useState({ title: step?.title || '', instructions: step?.instructions || '', capability: step?.capability || 'answer' });
  const isNew = !step;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{isNew ? 'Add step' : 'Edit step'}</h3>
        <label className="field"><span>Title</span>
          <input type="text" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </label>
        {isNew && (
          <label className="field"><span>Capability</span>
            <select value={form.capability} onChange={(e) => setForm({ ...form, capability: e.target.value })}>
              {Object.keys(CAP_ICONS).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </label>
        )}
        <label className="field"><span>Instructions</span>
          <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        </label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={() => onSave(form)} disabled={!form.title.trim()}>Save</button>
        </div>
      </div>
    </div>
  );
}

export default function TaskDetail() {
  const { id } = useParams();
  const [task, setTask] = useState(null);
  const [message, setMessage] = useState('');
  const [editing, setEditing] = useState(null); // null | 'new' | step object
  const [busy, setBusy] = useState(false);
  const { onEvent, toast } = useApp();
  const bottomRef = useRef();

  const load = useCallback(async () => {
    try { setTask(await api(`/tasks/${id}`)); } catch (err) { toast(err.message, 'error'); }
  }, [id, toast]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => onEvent((type, data) => {
    if ((data.taskId || data.id) === id) load();
  }), [onEvent, id, load]);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [task?.messages?.length]);

  if (!task) return <div className="empty">Loading…</div>;

  const act = (action) => async () => {
    setBusy(true);
    try { setTask(await api(`/tasks/${id}/${action}`, { method: 'POST' })); }
    catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const send = async () => {
    if (!message.trim()) return;
    setBusy(true);
    try {
      setTask(await api(`/tasks/${id}/messages`, { method: 'POST', body: { content: message.trim() } }));
      setMessage('');
    } catch (err) { toast(err.message, 'error'); }
    finally { setBusy(false); }
  };

  const resolveApproval = (approvalId, decision) => async () => {
    try {
      await api(`/approvals/${approvalId}`, { method: 'POST', body: { decision } });
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const editPlan = async (patch) => {
    try { setTask(await api(`/tasks/${id}/plan`, { method: 'POST', body: patch })); }
    catch (err) { toast(err.message, 'error'); }
  };

  const move = (stepIdx, dir) => {
    const ids = task.steps.map((s) => s.id);
    const i = stepIdx, j = stepIdx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    editPlan({ reorder: ids });
  };

  const pendingApprovals = task.approvals.filter((a) => a.status === 'pending');
  const active = ['planning', 'queued', 'running'].includes(task.status);
  const editable = ['paused', 'awaiting_input', 'awaiting_approval', 'failed', 'queued'].includes(task.status);

  return (
    <div>
      <div className="row mb" style={{ flexWrap: 'wrap' }}>
        <h2 className="grow" style={{ fontSize: '1.25rem' }}>{task.title}</h2>
        <span className={`badge ${task.status}`}>{STATUS_LABELS[task.status] || task.status}</span>
        {active && <button className="btn sm" disabled={busy} onClick={act('pause')}>⏸ Pause</button>}
        {['paused', 'awaiting_approval'].includes(task.status) && <button className="btn sm" disabled={busy} onClick={act('resume')}>▶ Resume</button>}
        {task.status === 'failed' && <button className="btn sm" disabled={busy} onClick={act('retry')}>↻ Retry</button>}
        {!['completed', 'cancelled'].includes(task.status) && <button className="btn sm danger" disabled={busy} onClick={act('cancel')}>✕ Cancel</button>}
      </div>

      <div className="row mb">
        <div className="progress grow"><div style={{ width: `${Math.round(task.progress * 100)}%` }} /></div>
        <span className="muted small">{Math.round(task.progress * 100)}%</span>
      </div>

      {pendingApprovals.map((a) => (
        <div className="approval-banner mb" key={a.id}>
          <strong>✋ Approval needed</strong>
          <p className="small mt" style={{ marginTop: 6 }}>{a.description}</p>
          <div className="row mt">
            <button className="btn primary sm" onClick={resolveApproval(a.id, 'approve')}>Approve</button>
            <button className="btn danger sm" onClick={resolveApproval(a.id, 'reject')}>Reject</button>
          </div>
        </div>
      ))}

      <div className="task-layout">
        <div>
          <div className="thread card" style={{ display: 'flex' }}>
            {task.messages.map((m) => (
              m.role === 'agent'
                ? <div key={m.id} className="msg agent" dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                : <div key={m.id} className="msg user">{m.content}</div>
            ))}
            {active && <div className="msg agent muted">Working… watch the plan on the right for live progress.</div>}
            <div ref={bottomRef} />
          </div>
          <div className="row mt">
            <input
              type="text" className="grow" placeholder={task.status === 'awaiting_input' ? 'Answer Yoshi’s questions…' : 'Send a follow-up or new instructions…'}
              value={message} onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
            />
            <button className="btn primary" onClick={send} disabled={busy || !message.trim()}>Send</button>
          </div>
        </div>

        <div className="grid">
          <div className="card">
            <div className="row mb">
              <strong className="grow">Plan</strong>
              {editable && <button className="btn sm ghost" onClick={() => setEditing('new')}>+ Add step</button>}
            </div>
            {task.steps.length === 0 && <div className="muted small">Yoshi is building the plan…</div>}
            <div className="steps">
              {task.steps.map((s, i) => (
                <div className={`step ${s.status}`} key={s.id}>
                  <div className="head">
                    <span className="num">{s.status === 'completed' ? '✓' : s.status === 'failed' ? '✕' : i + 1}</span>
                    <span title={s.instructions}>{CAP_ICONS[s.capability] || '⚙️'} {s.title}</span>
                    <span className={`badge ${s.status}`} style={{ marginLeft: 'auto' }}>{STATUS_LABELS[s.status] || s.status}</span>
                  </div>
                  {s.error && <div className="small mt" style={{ color: 'var(--red)' }}>{s.error}</div>}
                  {editable && ['pending', 'failed'].includes(s.status) && (
                    <div className="row mt">
                      <button className="btn sm ghost" onClick={() => setEditing(s)}>Edit</button>
                      <button className="btn sm ghost" onClick={() => move(i, -1)}>↑</button>
                      <button className="btn sm ghost" onClick={() => move(i, 1)}>↓</button>
                      <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={() => editPlan({ remove: [s.id] })}>Remove</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
            {editable && <p className="muted small mt">The task is {STATUS_LABELS[task.status]?.toLowerCase()} — you can edit the plan, then resume.</p>}
          </div>

          {task.files.length > 0 && (
            <div className="card">
              <strong>Files</strong>
              <div className="mt">
                {task.files.map((f) => (
                  <div className="row" key={f.id} style={{ padding: '5px 0' }}>
                    <a href={downloadUrl(f.id)} className="grow">📄 {f.name}</a>
                    <span className="muted small">{fmtSize(f.size)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="card">
            <strong>Activity</strong>
            <div className="event-log mt">
              {task.events.map((e) => (
                <div key={e.id}><span className="muted">{new Date(e.created_at).toLocaleTimeString()}</span> — {e.message}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {editing && (
        <StepEditor
          step={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSave={async (form) => {
            if (editing === 'new') await editPlan({ add: [{ title: form.title, capability: form.capability, instructions: form.instructions }] });
            else await editPlan({ update: [{ id: editing.id, title: form.title, instructions: form.instructions }] });
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
