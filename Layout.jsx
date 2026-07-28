import React, { useState } from 'react';
import { Outlet, NavLink, useLocation } from 'react-router-dom';
import {
  DollarSign,
  FolderKanban,
  LayoutDashboard,
  Menu,
  Settings,
  X,
} from 'lucide-react';
import NotificationBell from './NotificationBell.jsx';
import { C } from './theme.js';

const NAV = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/obras', icon: FolderKanban, label: 'Obras & Gantt' },
  { to: '/financeiro', icon: DollarSign, label: 'Financeiro' },
];

const ADMIN_NAV = {
  to: '/administracao',
  icon: Settings,
  label: 'Administração',
};

export default function Layout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  const navStyle = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 14px',
    borderRadius: 7,
    textDecoration: 'none',
    fontSize: 13,
    fontWeight: active ? 700 : 500,
    color: active ? C.white : C.gray,
    background: active ? C.card : 'transparent',
    transition: 'all 0.15s',
  });

  function isActive(to) {
    return to === '/'
      ? location.pathname === '/'
      : location.pathname.startsWith(to);
  }

  function NavigationItems({ closeMenu }) {
    return (
      <>
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            style={navStyle(isActive(to))}
            onClick={closeMenu}
          >
            <Icon size={16} /> {label}
          </NavLink>
        ))}
      </>
    );
  }

  function AdministrationLink({ closeMenu }) {
    const Icon = ADMIN_NAV.icon;

    return (
      <NavLink
        to={ADMIN_NAV.to}
        style={navStyle(isActive(ADMIN_NAV.to))}
        onClick={closeMenu}
      >
        <Icon size={16} /> {ADMIN_NAV.label}
      </NavLink>
    );
  }

  function Sidebar() {
    return (
      <nav
        style={{
          width: 220,
          background: C.panel,
          borderRight: `1px solid ${C.border}`,
          padding: '20px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 4,
          height: '100vh',
          flexShrink: 0,
          overflowY: 'auto',
          position: 'sticky',
          top: 0,
        }}
      >
        <div
          style={{
            padding: '0 6px 20px',
            borderBottom: `1px solid ${C.card}`,
            marginBottom: 8,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: 8,
          }}
        >
          <div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: C.white,
                letterSpacing: '-0.02em',
              }}
            >
              Igor Santana
            </div>
            <div style={{ fontSize: 11, color: C.gray, marginTop: 2 }}>
              Gestor de Obras
            </div>
          </div>

          <NotificationBell />
        </div>

        <NavigationItems />

        <div style={{ flex: 1 }} />

        <div
          style={{
            borderTop: `1px solid ${C.card}`,
            paddingTop: 8,
            marginTop: 10,
          }}
        >
          <AdministrationLink />
        </div>
      </nav>
    );
  }

  return (
    <>
      <style>{`
        html, body, #root { height: 100%; margin: 0; padding: 0; }
        .app-shell { display: flex; height: 100vh; background: ${C.bg}; overflow: hidden; }
        .sidebar-desktop { display: none; }
        .topbar { position: fixed; top: 0; left: 0; right: 0; z-index: 50;
                  background: ${C.panel}; border-bottom: 1px solid ${C.border};
                  padding: 8px 12px; display: flex; align-items: center; justify-content: space-between; }
        .main-scroll { flex: 1; overflow-y: auto; overflow-x: hidden; padding-top: 48px; }
        @media (min-width: 768px) {
          .sidebar-desktop { display: flex !important; }
          .topbar { display: none !important; }
          .main-scroll { padding-top: 0 !important; }
        }
      `}</style>

      <div className="app-shell">
        <div className="sidebar-desktop">
          <Sidebar />
        </div>

        <div className="topbar">
          <div>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.white }}>
              Igor Santana
            </span>
            <span style={{ fontSize: 11, color: C.gray, marginLeft: 8 }}>
              Gestor de Obras
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NotificationBell />
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              style={{
                background: 'none',
                border: 'none',
                color: C.gray,
                cursor: 'pointer',
                padding: 4,
              }}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {open && (
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 40 }}
            onClick={() => setOpen(false)}
          >
            <div
              style={{
                position: 'absolute',
                top: 48,
                left: 0,
                bottom: 0,
                width: 220,
                background: C.panel,
                borderRight: `1px solid ${C.border}`,
                padding: 12,
                display: 'flex',
                flexDirection: 'column',
                gap: 4,
              }}
              onClick={(event) => event.stopPropagation()}
            >
              <NavigationItems closeMenu={() => setOpen(false)} />
              <div style={{ flex: 1 }} />
              <AdministrationLink closeMenu={() => setOpen(false)} />
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
