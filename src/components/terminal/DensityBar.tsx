import { useAtomValue } from "jotai";
import { sparkline } from "../../lib/ascii";
import { criticalCountAtom, launchTimestampsAtom, scannedCountAtom } from "../../state/atoms";

/**
 * A3 — density as a feature. Every element here carries real information:
 * launches/min shape for the session, how much was actually scanned, and how
 * much of it was CRITICAL. Session-scoped, nothing persisted.
 */
export function DensityBar({ now }: { now: number }) {
  const timestamps = useAtomValue(launchTimestampsAtom);
  const scanned = useAtomValue(scannedCountAtom);
  const critical = useAtomValue(criticalCountAtom);
  const spark = sparkline(timestamps, now);
  const perMin = timestamps.filter((t) => now - t < 60_000).length;

  if (timestamps.length === 0 && scanned === 0) return null;

  return (
    <div
      className="mb-2 flex flex-wrap items-baseline gap-x-3 text-xs"
      style={{ color: "var(--flurry-mid)" }}
    >
      {spark && (
        <span>
          LAUNCHES/MIN{" "}
          <span
            style={{ color: "var(--flurry-green)", letterSpacing: "1px" }}
            title="launches per minute over this session, newest bucket on the right"
          >
            {spark}
          </span>{" "}
          <span style={{ color: "var(--flurry-green)" }}>{perMin}</span>
        </span>
      )}
      <span>
        SCANNED <span style={{ color: "var(--flurry-green)" }}>{scanned}</span>
      </span>
      <span>
        CRITICAL{" "}
        <span style={{ color: critical > 0 ? "var(--flurry-red)" : "var(--flurry-mid)" }}>
          {critical}
        </span>
      </span>
    </div>
  );
}
