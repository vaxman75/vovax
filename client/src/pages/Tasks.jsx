import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';

const SECTIONS = [
  { key: 'active', label: 'פעיל' },
  { key: 'waiting', label: 'בהמתנה' },
  { key: 'someday', label: 'בהמשך' },
  { key: 'done', label: 'בוצע' },
];

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

const emptyState = () => ({ active: [], waiting: [], someday: [], done: [] });

export default function Tasks() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState(null);
  const [newTitle, setNewTitle] = useState('');
  const [newSection, setNewSection] = useState('active');

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => r.json())
      .then(setTasks)
      .catch(() => setTasks(emptyState()));
  }, []);

  const showError = useCallback((msg) => {
    setError(msg);
    setTimeout(() => setError(null), 3000);
  }, []);

  const addTask = async () => {
    const title = newTitle.trim();
    if (!title || !tasks) return;
    const id = uid();
    const optimistic = { id, title, added: Date.now() };
    setTasks((t) => ({ ...t, [newSection]: [...t[newSection], optimistic] }));
    setNewTitle('');
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, title, section: newSection }),
      });
    } catch {
      showError('השמירה נכשלה, נסה שוב');
    }
  };

  const moveTask = async (section, id, toSection) => {
    const item = tasks[section].find((t) => t.id === id);
    if (!item) return;
    setTasks((t) => ({
      ...t,
      [section]: t[section].filter((x) => x.id !== id),
      [toSection]: [...t[toSection], { ...item, completed: toSection === 'done' ? Date.now() : undefined }],
    }));
    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: toSection }),
      });
    } catch {
      showError('עדכון הסטטוס נכשל');
    }
  };

  const deleteTask = async (section, id) => {
    setTasks((t) => ({ ...t, [section]: t[section].filter((x) => x.id !== id) }));
    try {
      await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    } catch {
      showError('המחיקה נכשלה');
    }
  };

  if (tasks === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div style={{ color: '#8B8A85' }} className="text-sm">טוען...</div>
      </div>
    );
  }

  const today = new Date().toLocaleDateString('he-IL', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="max-w-xl mx-auto px-5 py-8">
      <div style={{ fontFamily: "'Space Grotesk', monospace", color: '#8B8A85', letterSpacing: '0.15em' }} className="text-xs uppercase mb-1">
        VOVAX · PERSONAL CORE
      </div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif" }} className="text-2xl font-bold mb-1">{today}</h1>
      <p style={{ color: '#8B8A85' }} className="text-sm mb-5">המרכז השקט מאחורי הרעש</p>

      <svg width="100%" height="28" viewBox="0 0 400 28" className="mb-6" preserveAspectRatio="none">
        <path d="M0 14 L40 14 L48 4 L56 24 L64 14 L100 14 L108 8 L116 20 L124 14 L400 14" fill="none" stroke="#46C7FF" strokeWidth="1.5" className="pulse-line" />
      </svg>

      <div className="flex gap-2 mb-8">
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') addTask(); }}
          placeholder="הוסף משימה..."
          style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
          className="flex-1 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-400"
        />
        <select
          value={newSection}
          onChange={(e) => setNewSection(e.target.value)}
          style={{ background: '#131316', border: '1px solid #232326', color: '#F2F1ED' }}
          className="rounded px-2 py-2 text-sm"
        >
          {SECTIONS.filter((s) => s.key !== 'done').map((s) => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>
        <button
          onClick={addTask}
          style={{ background: '#46C7FF', color: '#0A0A0C' }}
          className="rounded px-3 py-2 flex items-center justify-center shrink-0"
          aria-label="הוסף משימה"
        >
          <Plus size={18} />
        </button>
      </div>

      {error && <div style={{ color: '#FF5A64' }} className="text-sm mb-4">{error}</div>}

      <div className="space-y-8">
        {SECTIONS.map((section) => (
          <div key={section.key}>
            <div className="flex items-center justify-between mb-3">
              <h2
                style={{ fontFamily: "'Space Grotesk', sans-serif", color: section.key === 'done' ? '#8B8A85' : '#F2F1ED' }}
                className="text-sm font-semibold uppercase tracking-wide"
              >
                {section.label}
              </h2>
              <span style={{ color: '#8B8A85' }} className="text-xs">{tasks[section.key].length}</span>
            </div>

            {tasks[section.key].length === 0 ? (
              <p style={{ color: '#8B8A85' }} className="text-sm">אין כאן כלום עדיין</p>
            ) : (
              <ul className="space-y-2">
                {tasks[section.key].map((item) => (
                  <li
                    key={item.id}
                    style={{ background: '#131316', border: '1px solid #232326' }}
                    className="rounded px-3 py-2 flex items-center gap-3"
                  >
                    <button
                      onClick={() => moveTask(section.key, item.id, section.key === 'done' ? 'active' : 'done')}
                      style={{
                        border: `1.5px solid ${section.key === 'done' ? '#46C7FF' : '#8B8A85'}`,
                        background: section.key === 'done' ? '#46C7FF' : 'transparent',
                      }}
                      className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                      aria-label="סמן כהושלם"
                    >
                      {section.key === 'done' && <Check size={12} color="#0A0A0C" />}
                    </button>
                    <span
                      style={{ textDecoration: section.key === 'done' ? 'line-through' : 'none', color: section.key === 'done' ? '#8B8A85' : '#F2F1ED' }}
                      className="flex-1 text-sm"
                    >
                      {item.title}
                    </span>
                    <button onClick={() => deleteTask(section.key, item.id)} style={{ color: '#8B8A85' }} className="shrink-0" aria-label="מחק משימה">
                      <Trash2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
