import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, FolderKanban, DollarSign, Menu, X } from 'lucide-react';
import { C } from './theme.js';

const NAV = [
  { to: '/',           icon: LayoutDashboard, label: 'Dashboard'    },
  { to: '/obras',      icon: FolderKanban,    label: 'Obras & Gantt'},
  { to: '/financeiro', icon: DollarSign,      label: 'Financeiro'   },
];

export default function Layout() {
  const [open, setOpen] = useState(false);
  const loc = useLocation();

  const navStyle = (active) => ({
    display: 'flex', alignItems: 'center', gap: 10, padding: '9px 14px',
    borderRadius: 7, textDecoration: 'none', fontSize: 13, fontWeight: active ? 700 : 500,
    color: active ? C.white : C.gray,
    background: active ? C.card : 'transparent',
    transition: 'all 0.15s',
  });

  const Sidebar = () => (
    <nav style={{ width: 220, background: C.panel, borderRight: `1px solid ${C.border}`,
                  padding: '20px 12px', display: 'flex', flexDirection: 'column', gap: 4,
                  height: '100vh', flexShrink: 0, overflowY: 'auto', position: 'sticky', top: 0 }}>
      <div style={{ padding: '0 6px 20px', borderBottom: `1px solid ${C.card}`, marginBottom: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: C.white, letterSpacing: '-0.02em' }}>Igor Santana</div>
        <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>Gestor de Obras</div>
      </div>
      {NAV.map(({ to, icon: Icon, label }) => {
        const active = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to);
        return (
          <NavLink key={to} to={to} style={navStyle(active)}>
            <Icon size={16} /> {label}
          </NavLink>
        );
      })}
    </nav>
  );

  return (
    <>
      <style>{`
        html, body, #root { height: 100%; margin: 0; padding: 0; }
        .app-shell { display: flex; height: 100vh; background: ${C.bg}; overflow: hidden; }
        .sidebar-desktop { display: none; }
        .topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 50;
                  background: ${C.panel}; border-bottom: 1px solid ${C.border};
                  padding: 10px 16px; display: flex; align-items: center; justify-content: space-between; }
        .main-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding-top: 48px; }
        @media (min-width: 768px) {
          .sidebar-desktop { display: flex !important; }
          .topbar { display: none !important; }
          .main-scroll { padding-top: 0 !important; }
        }
      `}</style>

      <div className="app-shell">
        <div className="sidebar-desktop"><Sidebar /></div>

        <div className="topbar">
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>Igor Santana</span>
            <span style={{ fontSize: 11, color: C.gray, marginLeft: 8 }}>Gestor de Obras</span>
          </div>
          <button onClick={() => setOpen(!open)}
            style={{ background: 'none', border: 'none', color: C.gray, cursor: 'pointer', padding: 4 }}>
            {open ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>

        {open && (
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)}>
            <div style={{ position: 'absolute', top: 48, left: 0, bottom: 0, width: 220,
                          background: C.panel, borderRight: `1px solid ${C.border}`,
                          padding: '12px', display: 'flex', flexDirection: 'column', gap: 4 }}
                 onClick={e => e.stopPropagation()}>
              {NAV.map(({ to, icon: Icon, label }) => {
                const active = to === '/' ? loc.pathname === '/' : loc.pathname.startsWith(to);
                return (
                  <NavLink key={to} to={to} style={navStyle(active)} onClick={() => setOpen(false)}>
                    <Icon size={16} /> {label}
                  </NavLink>
                );
              })}
            </div>
          </div>
        )}

        <div className="main-scroll">
          <Outlet />
        </div>
      </div>
    </>
  );
}

