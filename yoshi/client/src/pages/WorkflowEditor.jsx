import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { api, fmtTime, STATUS_LABELS } from '../lib/api.js';
import { useApp } from '../App.jsx';

const BLOCK_META = {
  research: { icon: '🔎', label: 'Deep Research' },
  browser: { icon: '🌐', label: 'Browser Automation' },
  file_analysis: { icon: '📄', label: 'File Analysis' },
  create_document: { icon: '📝', label: 'Document Creation' },
  setup_monitor: { icon: '📡', label: 'Website Monitoring' },
  setup_schedule: { icon: '🗓️', label: 'Scheduled Task' },
  save_memory: { icon: '🧠', label: 'Memory' },
  approval: { icon: '✋', label: 'User Approval' },
  condition: { icon: '🔀', label: 'Condition' },
  notify_user: { icon: '🔔', label: 'Notification' },
  answer: { icon: '💬', label: 'Reason / Write' },
};

let blockCounter = 0;
const newBlockId = () => `b${Date.now().toString(36)}${++blockCounter}`;

export default function WorkflowEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useApp();
  const [wf, setWf] = useState(null);
  const [blocks, setBlocks] = useState([]);
  const [selected, setSelected] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [runs, setRuns] = useState([]);
  const [tab, setTab] = useState('builder');
  const [scheduleModal, setScheduleModal] = useState(false);

  const load = async () => {
    const data = await api(`/workflows/${id}`);
    setWf(data);
    setBlocks(data.definition.blocks || []);
    setRuns(await api(`/workflows/${id}/runs`));
  };
  useEffect(() => { load(); }, [id]);

  if (!wf) return <div className="empty">Loading…</div>;

  const mutate = (fn) => { setBlocks((b) => { const next = fn(structuredClone(b)); return next; }); setDirty(true); };

  const addBlock = (type) => {
    const block = { id: newBlockId(), type, title: BLOCK_META[type].label, instructions: '', params: {}, depends_on: blocks.length ? [blocks[blocks.length - 1].id] : [] };
    mutate((b) => [...b, block]);
    setSelected(block.id);
  };

  const removeBlock = (bid) => mutate((b) =>
    b.filter((x) => x.id !== bid).map((x) => ({
      ...x,
      depends_on: (x.depends_on || []).filter((d) => d !== bid),
      only_if_block: x.only_if_block === bid ? undefined : x.only_if_block,
    })));

  const move = (i, dir) => mutate((b) => {
    const j = i + dir;
    if (j < 0 || j >= b.length) return b;
    [b[i], b[j]] = [b[j], b[i]];
    return b;
  });

  const save = async () => {
    try {
      await api(`/workflows/${id}`, { method: 'PATCH', body: { definition: { blocks } } });
      setDirty(false);
      toast('Workflow saved (new version created)');
      load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const run = async (test = false) => {
    try {
      if (dirty) await save();
      const { task_id } = await api(`/workflows/${id}/run`, { method: 'POST', body: { input: test ? 'This is a test run.' : '' } });
      navigate(`/tasks/${task_id}`);
    } catch (err) { toast(err.message, 'error'); }
  };

  const restore = async (version) => {
    await api(`/workflows/${id}/restore/${version}`, { method: 'POST' });
    toast(`Restored version ${version}`);
    load();
  };

  const sel = blocks.find((b) => b.id === selected);
  const condBlocks = blocks.filter((b) => b.type === 'condition');

  return (
    <div>
      <div className="row mb" style={{ flexWrap: 'wrap' }}>
        <h2 className="grow" style={{ fontSize: '1.2rem' }}>🧩 {wf.name} <span className="muted small">v{wf.version}</span></h2>
        <button className="btn sm" onClick={() => run(true)}>🧪 Test run</button>
        <button className="btn sm primary" onClick={() => run(false)}>▶ Run</button>
        <button className="btn sm" onClick={() => setScheduleModal(true)}>🗓️ Schedule</button>
        <button className="btn sm" disabled={!dirty} onClick={save}>{dirty ? '💾 Save changes' : 'Saved'}</button>
      </div>

      <div className="tabs">
        <button className={tab === 'builder' ? 'active' : ''} onClick={() => setTab('builder')}>Builder</button>
        <button className={tab === 'runs' ? 'active' : ''} onClick={() => setTab('runs')}>Runs ({runs.length})</button>
        <button className={tab === 'versions' ? 'active' : ''} onClick={() => setTab('versions')}>Versions</button>
      </div>

      {tab === 'builder' && (
        <div className="wf-layout">
          <div>
            <div className="card mb">
              <strong className="small muted">ADD BLOCK</strong>
              <div className="palette mt">
                {Object.entries(BLOCK_META).map(([type, meta]) => (
                  <button key={type} className="btn sm" onClick={() => addBlock(type)}>{meta.icon} {meta.label}</button>
                ))}
              </div>
            </div>
            <div className="wf-canvas">
              {blocks.length === 0 && <div className="empty"><div className="big">🧩</div>Add blocks above, or use natural-language generation from the workflows page.</div>}
              {blocks.map((b, i) => (
                <React.Fragment key={b.id}>
                  {i > 0 && <div className="wf-connector" />}
                  <div className={`wf-block ${selected === b.id ? 'selected' : ''}`} onClick={() => setSelected(b.id)} style={{ cursor: 'pointer' }}>
                    <div className="row">
                      <div className="grow">
                        <div className="type">{BLOCK_META[b.type]?.icon} {BLOCK_META[b.type]?.label || b.type}</div>
                        <strong>{b.title}</strong>
                        {b.only_if_block && <span className="badge" style={{ marginLeft: 8 }}>only if {blocks.find((x) => x.id === b.only_if_block)?.title || '?'}</span>}
                      </div>
                      <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); move(i, -1); }}>↑</button>
                      <button className="btn sm ghost" onClick={(e) => { e.stopPropagation(); move(i, 1); }}>↓</button>
                      <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={(e) => { e.stopPropagation(); removeBlock(b.id); }}>✕</button>
                    </div>
                    {b.instructions && <p className="muted small mt">{b.instructions.slice(0, 140)}</p>}
                  </div>
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="card">
            {!sel ? <p className="muted">Select a block to configure it.</p> : (
              <>
                <strong>{BLOCK_META[sel.type]?.icon} Configure block</strong>
                <label className="field mt"><span>Title</span>
                  <input type="text" value={sel.title} onChange={(e) => mutate((b) => b.map((x) => x.id === sel.id ? { ...x, title: e.target.value } : x))} />
                </label>
                <label className="field"><span>Instructions</span>
                  <textarea value={sel.instructions} onChange={(e) => mutate((b) => b.map((x) => x.id === sel.id ? { ...x, instructions: e.target.value } : x))} />
                </label>
                <label className="field"><span>Receives output from (dependencies)</span>
                  <select multiple value={sel.depends_on || []} style={{ height: 90 }}
                    onChange={(e) => {
                      const vals = [...e.target.selectedOptions].map((o) => o.value);
                      mutate((b) => b.map((x) => x.id === sel.id ? { ...x, depends_on: vals } : x));
                    }}>
                    {blocks.filter((x) => x.id !== sel.id).map((x) => <option key={x.id} value={x.id}>{x.title}</option>)}
                  </select>
                </label>
                {condBlocks.length > 0 && sel.type !== 'condition' && (
                  <label className="field"><span>Run only if condition passes</span>
                    <select value={sel.only_if_block || ''} onChange={(e) => mutate((b) => b.map((x) => x.id === sel.id ? { ...x, only_if_block: e.target.value || undefined } : x))}>
                      <option value="">— always run —</option>
                      {condBlocks.filter((c) => c.id !== sel.id).map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                    </select>
                  </label>
                )}
                {sel.type === 'create_document' && (
                  <label className="field"><span>Format</span>
                    <select value={sel.params?.format || 'pdf'} onChange={(e) => mutate((b) => b.map((x) => x.id === sel.id ? { ...x, params: { ...x.params, format: e.target.value } } : x))}>
                      {['pdf', 'docx', 'pptx', 'xlsx'].map((f) => <option key={f}>{f}</option>)}
                    </select>
                  </label>
                )}
                {sel.type === 'setup_monitor' && (
                  <label className="field"><span>URL</span>
                    <input type="url" value={sel.params?.url || ''} onChange={(e) => mutate((b) => b.map((x) => x.id === sel.id ? { ...x, params: { ...x.params, url: e.target.value } } : x))} />
                  </label>
                )}
                {sel.type === 'condition' && (
                  <label className="field"><span>Condition to evaluate</span>
                    <input type="text" placeholder="e.g. the research found a significant announcement" value={sel.params?.condition || ''}
                      onChange={(e) => mutate((b) => b.map((x) => x.id === sel.id ? { ...x, params: { ...x.params, condition: e.target.value } } : x))} />
                  </label>
                )}
                {sel.type === 'notify_user' && (
                  <label className="field"><span>Notification title</span>
                    <input type="text" value={sel.params?.title || ''} onChange={(e) => mutate((b) => b.map((x) => x.id === sel.id ? { ...x, params: { ...x.params, title: e.target.value } } : x))} />
                  </label>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {tab === 'runs' && (
        <table className="table">
          <thead><tr><th>Started</th><th>Version</th><th>Status</th><th /></tr></thead>
          <tbody>
            {runs.map((r) => (
              <tr key={r.id}>
                <td className="muted small">{fmtTime(r.started_at)}</td>
                <td className="muted small">v{r.version}</td>
                <td><span className={`badge ${r.task_status || r.status}`}>{STATUS_LABELS[r.task_status] || r.task_status || r.status}</span></td>
                <td>{r.task_id && <Link className="btn sm ghost" to={`/tasks/${r.task_id}`}>Open task</Link>}</td>
              </tr>
            ))}
            {runs.length === 0 && <tr><td colSpan={4} className="muted">No runs yet.</td></tr>}
          </tbody>
        </table>
      )}

      {tab === 'versions' && (
        <table className="table">
          <thead><tr><th>Version</th><th>Created</th><th /></tr></thead>
          <tbody>
            {wf.versions.map((v) => (
              <tr key={v.id}>
                <td>v{v.version} {v.version === wf.version && <span className="badge completed">current</span>}</td>
                <td className="muted small">{fmtTime(v.created_at)}</td>
                <td>{v.version !== wf.version && <button className="btn sm ghost" onClick={() => restore(v.version)}>Restore</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {scheduleModal && <ScheduleWorkflowModal wf={wf} onClose={() => setScheduleModal(false)} />}
    </div>
  );
}

function ScheduleWorkflowModal({ wf, onClose }) {
  const { toast } = useApp();
  const [cron, setCron] = useState('0 9 * * 1');
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const save = async () => {
    try {
      await api('/schedules', { method: 'POST', body: { name: `Workflow: ${wf.name}`, workflow_id: wf.id, cron, timezone: tz } });
      toast('Workflow scheduled');
      onClose();
    } catch (err) { toast(err.message, 'error'); }
  };
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>Schedule "{wf.name}"</h3>
        <label className="field"><span>Cron (min hour day month weekday)</span>
          <input type="text" value={cron} onChange={(e) => setCron(e.target.value)} /></label>
        <label className="field"><span>Timezone</span>
          <input type="text" value={tz} onChange={(e) => setTz(e.target.value)} /></label>
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn ghost" onClick={onClose}>Cancel</button>
          <button className="btn primary" onClick={save}>Create schedule</button>
        </div>
      </div>
    </div>
  );
}
