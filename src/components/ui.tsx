import { type ReactNode, useEffect, useId, useRef, useState } from 'react';

export function Card({ title, actions, children, id, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; id?: string; className?: string }) {
  return (
    <section className={`card ${className ?? ''}`} id={id} aria-label={typeof title === 'string' ? title : undefined}>
      {(title || actions) && (
        <div className="card-head">
          {title && <h2>{title}</h2>}
          {actions && <div className="row">{actions}</div>}
        </div>
      )}
      {children}
    </section>
  );
}

const STATUS_LABEL: Record<string, string> = {
  measured: 'Measured', disaggregated: 'Disaggregated from measured', modelled: 'Modelled', estimated: 'Estimated', assumed: 'Demonstration assumption', imported: 'Imported', missing: 'Missing',
  not_applicable: 'Not applicable', not_assessed: 'Not assessed', included: 'Included', excluded: 'Excluded', secondary_report: 'Secondary report (unverified)', recalled_unverified: 'Recalled, unverified',
  demonstration: 'Demonstration', derived: 'Derived', physical_constant: 'Physical constant', user: 'User-entered', observed_current: 'Observed current price', observed_older: 'Older observed price',
  indexed_estimate: 'Indexed estimate', user_contract: 'User contract', in_force: 'In force', consultation: 'Consultation draft', draft: 'Draft', outdated: 'Outdated', commercial_claim: 'Commercial claim', regulation: 'Regulation',
};
export const statusLabel = (s: string) => STATUS_LABEL[s] ?? s.replace(/_/g, ' ');

export function Badge({ status, children, title }: { status: string; children?: ReactNode; title?: string }) {
  return <span className={`badge ${status}`} title={title}>{children ?? statusLabel(status)}</span>;
}

export function Notice({ kind = 'info', title, children }: { kind?: 'info' | 'warn' | 'error'; title?: ReactNode; children?: ReactNode }) {
  return (
    <div className={`notice ${kind}`} role={kind === 'error' ? 'alert' : 'note'}>
      {title && <strong>{title} </strong>}
      {children}
    </div>
  );
}

export function Tabs<T extends string>({ tabs, value, onChange, label }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void; label: string }) {
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const onKey = (e: React.KeyboardEvent, i: number) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const n = (i + (e.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length;
    onChange(tabs[n].id);
    refs.current[n]?.focus();
  };
  return (
    <div className="tabs" role="tablist" aria-label={label}>
      {tabs.map((t, i) => (
        <button key={t.id} ref={(el) => (refs.current[i] = el)} role="tab" aria-selected={value === t.id} tabIndex={value === t.id ? 0 : -1} onClick={() => onChange(t.id)} onKeyDown={(e) => onKey(e, i)} id={`tab-${t.id}`}>
          {t.label}
        </button>
      ))}
    </div>
  );
}

export function Drawer({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const headingId = useId();
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    ref.current?.querySelector<HTMLElement>('button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); prev?.focus(); };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <div className="drawer" role="dialog" aria-modal="true" aria-labelledby={headingId} ref={ref}>
        <header>
          <h2 id={headingId} style={{ margin: 0, flex: 1 }}>{title}</h2>
          <button className="btn small" onClick={onClose} aria-label="Close panel">Close</button>
        </header>
        <div className="content">{children}</div>
      </div>
    </>
  );
}

export function Modal({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    ref.current?.querySelector<HTMLElement>('input,button,select,textarea')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()} ref={ref}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

export function KPI({ label, value, sub, delta, onExplain, title }: { label: string; value: ReactNode; sub?: ReactNode; delta?: ReactNode; onExplain?: () => void; title?: string }) {
  return (
    <div className="kpi" title={title}>
      <div className="label">
        <span>{label}</span>
        {onExplain && <button className="icon-btn" onClick={onExplain} aria-label={`Explain ${label}`} title="Explain this result">ⓘ</button>}
      </div>
      <div className="value">{value}</div>
      {delta && <div className="sub">{delta}</div>}
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function PillGroup<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <div className="pill-group" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} aria-pressed={value === o.value} onClick={() => onChange(o.value)}>{o.label}</button>
      ))}
    </div>
  );
}

export function useLocalToggle(key: string, initial = false): [boolean, (v: boolean) => void] {
  const [v, setV] = useState<boolean>(() => {
    try { const s = localStorage.getItem(key); return s == null ? initial : s === '1'; } catch { return initial; }
  });
  const set = (x: boolean) => { setV(x); try { localStorage.setItem(key, x ? '1' : '0'); } catch { /* ignore */ } };
  return [v, set];
}

export function download(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 0);
}
