import React, { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom';
import { api, getToken, clearToken, openEvents } from './lib/api.js';
import Login from './pages/Login.jsx';
import NewTask from './pages/NewTask.jsx';
import Tasks from './pages/Tasks.jsx';
import TaskDetail from './pages/TaskDetail.jsx';
import Files from './pages/Files.jsx';
import Schedules from './pages/Schedules.jsx';
import Monitors from './pages/Monitors.jsx';
import Memories from './pages/Memories.jsx';
import Workflows from './pages/Workflows.jsx';
import WorkflowEditor from './pages/WorkflowEditor.jsx';
import Activity from './pages/Activity.jsx';
import Settings from './pages/Settings.jsx';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

function Toasts({ toasts }) {
  return (
    <div className="toast-wrap">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind || ''}`}>{t.text}</div>
      ))}
    </div>
  );
}

function NotificationsDrawer({ open, onClose }) {
  const { notifications, markAllRead } = useApp();
  const navigate = useNavigate();
  if (!open) return null;
  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <div className="drawer">
        <header>
          <strong>Notifications</strong>
          <div className="row">
            <button className="btn sm ghost" onClick={markAllRead}>Mark all read</button>
            <button className="btn sm ghost" onClick={onClose}>✕</button>
          </div>
        </header>
        <div className="list">
          {notifications.length === 0 && <div className="empty">No notifications yet</div>}
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notif ${n.read ? '' : 'unread'}`}
              style={{ cursor: n.task_id ? 'pointer' : 'default' }}
              onClick={() => { if (n.task_id) { navigate(`/tasks/${n.task_id}`); onClose(); } }}
            >
              <div className="row"><strong className="grow">{n.title}</strong><span className="muted small">{new Date(n.created_at).toLocaleTimeString()}</span></div>
              {n.body && <div className="muted small mt" style={{ marginTop: 4 }}>{n.body}</div>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}

function Shell({ children }) {
  const { user, logout, notifications } = useApp();
  const [drawer, setDrawer] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="logo"><span className="egg">🦖</span> Yoshi</div>
        <nav className="nav">
          <NavLink to="/" end>✨ New task</NavLink>
          <NavLink to="/tasks">🗂️ Tasks</NavLink>
          <NavLink to="/files">📁 Files</NavLink>
          <NavLink to="/schedules">🗓️ Schedules</NavLink>
          <NavLink to="/monitors">📡 Monitors</NavLink>
          <NavLink to="/workflows">🧩 Workflows</NavLink>
          <NavLink to="/memories">🧠 Memory</NavLink>
          <NavLink to="/activity">📜 Activity</NavLink>
          <NavLink to="/settings">⚙️ Settings</NavLink>
        </nav>
        <div className="user-box">
          <span title={user?.email}>{user?.name}</span>
          <button className="btn sm ghost" onClick={logout}>Log out</button>
        </div>
      </aside>
      <div className="main">
        <div className="topbar">
          <h1>Your AI work agent</h1>
          <button className="bell" onClick={() => setDrawer(true)} title="Notifications">
            🔔{unread > 0 && <span className="dot">{unread}</span>}
          </button>
        </div>
        <div className="content">{children}</div>
      </div>
      <NotificationsDrawer open={drawer} onClose={() => setDrawer(false)} />
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [booted, setBooted] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [toasts, setToasts] = useState([]);
  const listeners = useRef(new Set());

  const toast = useCallback((text, kind) => {
    const id = Math.random();
    setToasts((t) => [...t, { id, text, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  }, []);

  const refreshUser = useCallback(async () => {
    if (!getToken()) { setUser(null); setBooted(true); return; }
    try {
      setUser(await api('/auth/me'));
      setNotifications(await api('/notifications'));
    } catch { setUser(null); }
    setBooted(true);
  }, []);

  useEffect(() => { refreshUser(); }, [refreshUser]);

  // One SSE connection for the whole app; pages subscribe via onEvent.
  useEffect(() => {
    if (!user) return undefined;
    const close = openEvents((type, data) => {
      if (type === 'notification') {
        setNotifications((prev) => [data, ...prev]);
        toast(data.title, data.kind === 'error' ? 'error' : 'info');
      }
      for (const fn of listeners.current) fn(type, data);
    });
    return close;
  }, [user, toast]);

  const ctx = useMemo(() => ({
    user,
    setUser,
    notifications,
    toast,
    logout: () => { clearToken(); setUser(null); },
    markAllRead: async () => {
      await api('/notifications/read-all', { method: 'POST' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: 1 })));
    },
    onEvent: (fn) => {
      listeners.current.add(fn);
      return () => listeners.current.delete(fn);
    },
    refreshUser,
  }), [user, notifications, toast, refreshUser]);

  if (!booted) return null;

  return (
    <AppCtx.Provider value={ctx}>
      <Toasts toasts={toasts} />
      {!user ? (
        <Routes>
          <Route path="*" element={<Login />} />
        </Routes>
      ) : (
        <Shell>
          <Routes>
            <Route path="/" element={<NewTask />} />
            <Route path="/login" element={<Navigate to="/" />} />
            <Route path="/tasks" element={<Tasks />} />
            <Route path="/tasks/:id" element={<TaskDetail />} />
            <Route path="/files" element={<Files />} />
            <Route path="/schedules" element={<Schedules />} />
            <Route path="/monitors" element={<Monitors />} />
            <Route path="/workflows" element={<Workflows />} />
            <Route path="/workflows/:id" element={<WorkflowEditor />} />
            <Route path="/memories" element={<Memories />} />
            <Route path="/activity" element={<Activity />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </Shell>
      )}
    </AppCtx.Provider>
  );
}
