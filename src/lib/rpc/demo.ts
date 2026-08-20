import type { ChainProvider } from "./provider";
import { Launch, GraduationEntry, type SlotActivity, Platform } from "../schemas";

/** Deterministic-enough demo feed so the UI is fully exercisable with zero keys. */
const SYLL = [
  "moon",
  "pepe",
  "giga",
  "chad",
  "wif",
  "bonk",
  "turbo",
  "snail",
  "based",
  "fud",
  "cope",
  "degen",
  "pump",
  "sol",
  "cat",
  "dog",
  "frog",
  "brain",
  "ghost",
  "laser",
] as const;
const PLATFORMS = Platform.options;

const rand = (n: number) => Math.floor(Math.random() * n);
const pick = <T>(a: readonly T[]): T => a[rand(a.length)] as T;
const fakeAddr = () => {
  const c = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz123456789";
  return Array.from({ length: 44 }, () => c[rand(c.length)]).join("");
};

let slot = 300_000_000;

function makeLaunch(): Launch {
  const a = pick(SYLL),
    b = pick(SYLL);
  const bundled = Math.random() < 0.42;
  const deploySlot = ++slot;
  const funder = fakeAddr();
  const walletCount = bundled ? 4 + rand(16) : 1 + rand(3);
  const activity: SlotActivity[] = Array.from({ length: walletCount }, (_, i) => {
    const inDeploySlot = bundled || i === 0;
    const base = {
      wallet: fakeAddr(),
      slot: inDeploySlot ? deploySlot : deploySlot + 1 + rand(20),
      supplyPct: bundled ? 3 + rand(6) : rand(5),
    };
    return bundled && Math.random() < 0.8 ? { ...base, fundedBy: funder } : base;
  });
  return Launch.parse({
    mint: fakeAddr(),
    ticker: (a + b).toUpperCase().slice(0, 8),
    name: `${a} ${b}`,
    platform: pick(PLATFORMS),
    deployer: fakeAddr(),
    deploySlot,
    launchedAt: Date.now(),
    mcapUsd: (4 + rand(40)) * 1000,
    devHoldsPct: rand(12),
    deployerPriorLaunches: rand(30),
    deployerPriorRugs: bundled ? rand(6) : rand(2),
    slotActivity: activity,
  });
}

function makeGrad(): GraduationEntry {
  const a = pick(SYLL),
    b = pick(SYLL);
  return GraduationEntry.parse({
    mint: fakeAddr(),
    ticker: (a + b).toUpperCase().slice(0, 8),
    platform: pick(["PUMP.FUN", "BONK.FUN", "MOONSHOT"] as const),
    curveProgressPct: Math.min(55 + rand(46), 100),
    mcapUsd: (30 + rand(60)) * 1000,
    vol1hUsd: (5 + rand(120)) * 1000,
    holders: 40 + rand(900),
    pinned: false,
  });
}

export function createDemoProvider(): ChainProvider {
  return {
    name: "demo feed",
    subscribeLaunches(onLaunch) {
      for (let i = 0; i < 6; i++) onLaunch(makeLaunch());
      const t = setInterval(() => {
        if (Math.random() < 0.55) onLaunch(makeLaunch());
      }, 3000);
      return () => clearInterval(t);
    },
    getGraduationCandidates() {
      return Promise.resolve(Array.from({ length: 8 }, makeGrad));
    },
  };
}
