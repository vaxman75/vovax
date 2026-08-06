import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import Tasks from './pages/Tasks.jsx';
import Board from './pages/Board.jsx';
import AceStep from './pages/AceStep.jsx';
import Higgsfield from './pages/Higgsfield.jsx';
import OpsBoard from './pages/OpsBoard.jsx';
import Gigs from './pages/Gigs.jsx';
import HeyGen from './pages/HeyGen.jsx';
import HeyGenBrowser from './pages/HeyGenBrowser.jsx';
import ElevenLabs from './pages/ElevenLabs.jsx';
import ElevenLabsBrowser from './pages/ElevenLabsBrowser.jsx';
import Publish from './pages/Publish.jsx';
import Studio from './pages/Studio.jsx';
import Brief from './pages/Brief.jsx';
import Admin from './pages/Admin.jsx';

const NAV = [
  { to: '/', label: 'משימות' },
  { to: '/board', label: 'הנהלה' },
  { to: '/gigs', label: 'הופעות' },
  { to: '/ops', label: 'תיאום' },
  { to: '/acestep', label: 'ACE-Step' },
  { to: '/higgsfield', label: 'Higgsfield' },
  { to: '/heygen', label: 'HeyGen' },
  { to: '/heygen-browser', label: 'HeyGen Assets' },
  { to: '/elevenlabs', label: 'ElevenLabs' },
  { to: '/elevenlabs-browser', label: 'EL Voices' },
  { to: '/publish', label: 'Publish' },
  { to: '/studio',  label: 'Studio' },
];

function AppShell() {
  const location = useLocation();

  // /admin and /brief render standalone — no nav, no shared layout
  if (location.pathname.startsWith('/admin')) {
    return (
      <Routes>
        <Route path="/admin" element={<Admin />} />
      </Routes>
    );
  }
  if (location.pathname.startsWith('/brief')) {
    return (
      <Routes>
        <Route path="/brief" element={<Brief />} />
      </Routes>
    );
  }

  return (
    <div dir="rtl" style={{ minHeight: '100vh', background: '#0A0A0C' }}>
      <nav
        style={{ borderBottom: '1px solid #232326', background: '#0D0D10', fontFamily: "'Space Grotesk', sans-serif" }}
        className="sticky top-0 z-10"
      >
        <div className="max-w-3xl mx-auto px-5 flex items-center h-12 gap-1">
          <span style={{ color: '#46C7FF', letterSpacing: '0.15em', fontSize: 13, fontWeight: 700, marginLeft: 'auto' }}>
            VOVAX
          </span>
          <div className="flex gap-1 mr-4 flex-wrap">
            {NAV.map((n) => (
              <NavLink
                key={n.to}
                to={n.to}
                end={n.to === '/'}
                style={({ isActive }) => ({
                  padding: '4px 10px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: isActive ? '#46C7FF' : '#8B8A85',
                  background: isActive ? '#131316' : 'transparent',
                  textDecoration: 'none',
                  whiteSpace: 'nowrap',
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
        <Route path="/gigs" element={<Gigs />} />
        <Route path="/ops" element={<OpsBoard />} />
        <Route path="/acestep" element={<AceStep />} />
        <Route path="/higgsfield" element={<Higgsfield />} />
        <Route path="/heygen" element={<HeyGen />} />
        <Route path="/heygen-browser" element={<HeyGenBrowser />} />
        <Route path="/elevenlabs" element={<ElevenLabs />} />
        <Route path="/elevenlabs-browser" element={<ElevenLabsBrowser />} />
        <Route path="/publish" element={<Publish />} />
        <Route path="/studio"  element={<Studio />} />
      </Routes>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppShell />
    </BrowserRouter>
  );
}
