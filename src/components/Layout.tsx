import { useEffect, useState, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useStore } from '../state/store';

const PROPS = [
  { to: '/city-hotel', label: 'City hotel — Paris' },
  { to: '/island-resort', label: 'Island resort — Belle-Île' },
  { to: '/independent-bnb', label: 'Independent B&B — Dordogne' },
];
const TOOLS = [
  { to: '/compare', label: 'Compare scenarios' },
  { to: '/scenarios', label: 'Scenarios & decisions' },
  { to: '/data-library', label: 'Data library' },
  { to: '/methodology', label: 'Methodology' },
  { to: '/settings', label: 'Settings & data' },
];

export function Layout({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  const dismissed = useStore((s) => s.onboardingDismissed);
  const dismiss = useStore((s) => s.dismissOnboarding);
  useEffect(() => setOpen(false), [loc.pathname]);
  const nav = (
    <nav aria-label="Main navigation" className="nav">
      <div className="nav-group">
        <div className="nav-label">Hotel simulators</div>
        {PROPS.map((p) => <NavLink key={p.to} to={p.to}>{p.label}</NavLink>)}
      </div>
      <div className="nav-group">
        <div className="nav-label">Analysis & data</div>
        {TOOLS.map((p) => <NavLink key={p.to} to={p.to}>{p.label}</NavLink>)}
      </div>
      <div className="nav-group muted" style={{ fontSize: '.74rem', margin: '18px 8px 0' }}>
        Local-only app: data is stored in this browser. No server, no live data feeds.
      </div>
    </nav>
  );
  return (
    <div className="app">
      <a href="#main" className="skip-link">Skip to content</a>
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Sidebar">
        <NavLink to="/city-hotel" className="brand"><span className="brand-mark" aria-hidden="true">HC</span>Hotel Carbon Lab</NavLink>
        {nav}
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} aria-hidden="true" />}
      <div style={{ minWidth: 0 }}>
        <div className="topbar">
          <button className="btn menu-btn" onClick={() => setOpen(!open)} aria-expanded={open} aria-label="Open navigation menu">☰ Menu</button>
          <strong>Hotel Carbon Lab</strong>
        </div>
        <main id="main" className="main" tabIndex={-1}>
          {!dismissed && (
            <div className="notice info no-print" style={{ marginBottom: 12 }} role="note">
              <div className="row">
                <span style={{ flex: 1, minWidth: 200 }}><strong>Demonstration property.</strong> Results depend on editable assumptions and available reference data. The three hotels are fictional; many reference values are demonstration placeholders (see Data library).</span>
                <button className="btn small" onClick={dismiss}>Got it</button>
              </div>
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}
