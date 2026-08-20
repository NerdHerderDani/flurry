export type TabId = "scan" | "grad" | "cfg" | "don";

const TABS: { id: TabId; key: string; label: string }[] = [
  { id: "scan", key: "F1", label: "SCANNER" },
  { id: "grad", key: "F2", label: "GRADUATION" },
  { id: "cfg", key: "F3", label: "CONFIG" },
  { id: "don", key: "F4", label: "SUPPORT" },
];

export function TabBar({ tab, onTab }: { tab: TabId; onTab: (t: TabId) => void }) {
  return (
    <div className="my-3 flex flex-wrap gap-2">
      {TABS.map((t) => {
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            onClick={() => onTab(t.id)}
            className="px-3 py-1 text-xs tracking-widest"
            style={{
              color: active ? "var(--flurry-bg)" : "var(--flurry-green)",
              background: active ? "var(--flurry-green)" : "transparent",
              border: `1px solid ${active ? "var(--flurry-green)" : "var(--flurry-dim)"}`,
              cursor: "pointer",
            }}
          >
            [{t.key}] {t.label}
          </button>
        );
      })}
    </div>
  );
}
