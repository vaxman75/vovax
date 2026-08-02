import React from 'react';
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom';
import Tasks from './pages/Tasks.jsx';
import Board from './pages/Board.jsx';
import AceStep from './pages/AceStep.jsx';

const NAV = [
  { to: '/', label: 'משימות' },
  { to: '/board', label: 'ישיבת הנהלה' },
  { to: '/acestep', label: 'ACE-Step' },
];

export default function App() {
  return (
    <BrowserRouter>
      <div dir="rtl" style={{ minHeight: '100vh', background: '#0A0A0C' }}>
        <nav
          style={{
            borderBottom: '1px solid #232326',
            background: '#0D0D10',
            fontFamily: "'Space Grotesk', sans-serif",
          }}
          className="sticky top-0 z-10"
        >
          <div className="max-w-xl mx-auto px-5 flex items-center gap-1 h-12">
            <span
              style={{ color: '#46C7FF', letterSpacing: '0.15em', fontSize: 13, fontWeight: 700 }}
              className="ml-auto"
            >
              VOVAX
            </span>
            <div className="flex gap-1 mr-4">
              {NAV.map((n) => (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.to === '/'}
                  style={({ isActive }) => ({
                    padding: '4px 10px',
                    borderRadius: 6,
                    fontSize: 13,
                    color: isActive ? '#46C7FF' : '#8B8A85',
                    background: isActive ? '#131316' : 'transparent',
                    textDecoration: 'none',
                  })}
                >
                  {n.label}
                </NavLink>
              ))}
            </div>
          </div>
        </nav>

        <Routes>
          <Route path="/" element={<Tasks />} />
          <Route path="/board" element={<Board />} />
          <Route path="/acestep" element={<AceStep />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
