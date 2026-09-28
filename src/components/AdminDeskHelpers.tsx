import type { ReactNode } from "react";

export function PageHeading({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div>
      <p className="text-[10px] font-bold tracking-[0.18em] text-amber-800 uppercase">RockBrief operations</p>
      <h2 className="font-display mt-1 text-2xl font-semibold sm:text-3xl">{title}</h2>
      <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>
    </div>
  );
}

export function Panel({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3">
        <h3 className="font-semibold">{title}</h3>
        {subtitle ? <p className="text-xs text-neutral-500">{subtitle}</p> : null}
      </div>
      {children}
    </section>
  );
}

export function MetricGrid({ overview }: { overview: Record<string, number> }) {
  const entries = Object.entries(overview || {}).slice(0, 12);
  if (!entries.length) return <p className="text-sm text-neutral-500">No metrics yet.</p>;
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {entries.map(([k, v]) => (
        <div key={k} className="rounded-xl border border-neutral-200 bg-white p-4">
          <p className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">{k.replace(/_/g, " ")}</p>
          <p className="mt-1 text-2xl font-semibold">{Number(v || 0).toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
}

export function EngagementPanel({ data }: { data: Record<string, number> }) {
  return (
    <Panel title="Engagement" subtitle="Reads, returns and recommendation performance">
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {Object.entries(data || {}).map(([k, v]) => (
          <div key={k} className="rounded-lg bg-neutral-50 p-3">
            <p className="text-[10px] font-bold uppercase text-neutral-500">{k.replace(/_/g, " ")}</p>
            <p className="text-lg font-semibold">{Number(v || 0).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </Panel>
  );
}

export function StatusLine({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-100 py-2 text-sm last:border-0">
      <span className="text-neutral-600">{label}</span>
      <span className="font-semibold">{value}</span>
    </div>
  );
}

export function Bars({ data }: { data: Array<{ label: string; value: number }> }) {
  const rows = data || [];
  const max = Math.max(1, ...rows.map((d) => Number(d.value || 0)));
  if (!rows.length) return <p className="text-sm text-neutral-500">No data.</p>;
  return (
    <div className="space-y-2">
      {rows.map((d) => (
        <div key={d.label}>
          <div className="mb-0.5 flex justify-between text-xs">
            <span className="truncate font-medium">{d.label}</span>
            <span className="text-neutral-500">{Number(d.value || 0).toLocaleString()}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div className="h-full rounded-full bg-teal-700" style={{ width: `${(Number(d.value || 0) / max) * 100}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function DailyChart({ data }: { data: Array<{ day: string; value: number }> }) {
  const rows = data || [];
  const max = Math.max(1, ...rows.map((d) => Number(d.value || 0)));
  if (!rows.length) return <p className="text-sm text-neutral-500">No daily data yet.</p>;
  return (
    <div className="flex h-40 items-end gap-1">
      {rows.slice(-30).map((d) => (
        <div key={d.day} className="flex flex-1 flex-col items-center justify-end gap-1" title={`${d.day}: ${d.value}`}>
          <div className="w-full rounded-t bg-teal-700/90" style={{ height: `${(Number(d.value || 0) / max) * 100}%`, minHeight: Number(d.value) > 0 ? 4 : 0 }} />
        </div>
      ))}
    </div>
  );
}
