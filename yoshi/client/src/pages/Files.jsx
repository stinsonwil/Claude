import React, { useEffect, useRef, useState } from 'react';
import { api, downloadUrl, fmtSize, fmtTime } from '../lib/api.js';
import { useApp } from '../App.jsx';

export default function Files() {
  const [files, setFiles] = useState([]);
  const fileRef = useRef();
  const { toast } = useApp();

  const load = async () => setFiles(await api('/files'));
  useEffect(() => { load(); }, []);

  const upload = async (list) => {
    const fd = new FormData();
    for (const f of list) fd.append('files', f);
    try { await api('/files', { method: 'POST', formData: fd }); load(); }
    catch (err) { toast(err.message, 'error'); }
  };

  const rename = async (f) => {
    const name = prompt('New name', f.name);
    if (!name || name === f.name) return;
    try { await api(`/files/${f.id}`, { method: 'PATCH', body: { name } }); load(); }
    catch (err) { toast(err.message, 'error'); }
  };

  const run = (path, method = 'POST') => async () => {
    try { await api(path, { method }); load(); }
    catch (err) { toast(err.message, 'error'); }
  };

  return (
    <div>
      <div className="row mb">
        <h2 className="grow" style={{ fontSize: '1.2rem' }}>Files</h2>
        <input type="file" hidden multiple ref={fileRef} onChange={(e) => { upload(e.target.files); e.target.value = ''; }} />
        <button className="btn primary" onClick={() => fileRef.current.click()}>⬆ Upload</button>
      </div>
      {files.length === 0 ? (
        <div className="empty"><div className="big">📁</div>Nothing here yet. Upload files for analysis, or let Yoshi generate documents.</div>
      ) : (
        <table className="table">
          <thead><tr><th>Name</th><th>Kind</th><th>Size</th><th>Created</th><th /></tr></thead>
          <tbody>
            {files.map((f) => (
              <tr key={f.id}>
                <td><a href={downloadUrl(f.id)}>📄 {f.name}</a></td>
                <td><span className="badge">{f.kind}</span></td>
                <td className="muted small">{fmtSize(f.size)}</td>
                <td className="muted small">{fmtTime(f.created_at)}</td>
                <td>
                  <div className="row" style={{ justifyContent: 'flex-end' }}>
                    <a className="btn sm ghost" href={downloadUrl(f.id)}>Download</a>
                    <button className="btn sm ghost" onClick={() => rename(f)}>Rename</button>
                    <button className="btn sm ghost" onClick={run(`/files/${f.id}/duplicate`)}>Duplicate</button>
                    <button className="btn sm ghost" style={{ color: 'var(--red)' }} onClick={run(`/files/${f.id}`, 'DELETE')}>Delete</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
