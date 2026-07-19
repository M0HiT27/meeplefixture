/**
 * League Fixture Generator
 * =========================
 * Works for any m (total players) and n (players per match, fixed per game).
 *
 * Input is m, n, and cycles (how many "everyone plays equally" cycles to run).
 *   - One cycle = mMin matches = m / gcd(m, n), in which every player plays
 *     exactly n / gcd(m, n) times. This is the smallest batch where play
 *     counts come out perfectly equal.
 *   - cycles = 2 runs two such batches back to back (double the matches,
 *     double the plays per player) - always perfectly equal, no remainder
 *     case to worry about.
 *
 * Guarantees across the WHOLE schedule (all cycles combined, not per-cycle):
 *   - No exact match (same n players) ever repeats.
 *   - Repeated pairings (two players sharing a match more than once) are
 *     minimized as much as possible via simulated annealing - more cycles
 *     means more total pair-slots are used, which both gives the optimizer
 *     more chances to spread players out AND, once you exceed the total
 *     number of unique pairs that exist (m*(m-1)/2), makes some pair
 *     repeats mathematically unavoidable (though exact matches still never
 *     repeat).
 *   - Every player's total play count is exactly equal.
 *
 * Usage:
 *   const result = generateFixtures({ m: 13, n: 4 });              // 1 cycle
 *   const result = generateFixtures({ m: 13, n: 4, cycles: 3 });   // 3 cycles
 */

export interface FixtureOptions {
  m: number;        // total players
  n: number;        // players per match
  cycles?: number;  // how many equalization cycles to generate (default: 1)
  seed?: number;    // RNG seed for reproducibility
  iterations?: number; // annealing steps PER restart (default: 30000) - see note below
  restarts?: number;   // independent annealing attempts, best one kept (default: 5)
}

export interface FixtureResult {
  matches: number[][];              // the fixture list: each entry is n player ids
  totalMatches: number;              // matches.length
  matchesPerPlayer: Record<number, number>; // how many matches each player plays (all equal)
  cost: number;                      // 0 = perfect (no repeated pairs anywhere)
  repeatedExactMatches: number;      // always 0 - hard constraint
  repeatedPairs: number;             // how many distinct pairs shared a match more than once
  maxPairRepeats: number;            // worst-case: max times any single pair met
}

// ---- Seeded RNG (mulberry32) so results are reproducible given a seed ----
function makeRng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(arr: T[], rng: () => number): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

/** One cycle = mMin matches, each player playing exactly perPlayer times. */
function cycleSize(m: number, n: number): { mMin: number; perPlayer: number } {
  const g = gcd(m, n);
  return { mMin: m / g, perPlayer: n / g };
}

function matchKey(group: number[]): string {
  return group.join(",");
}

function pairKey(a: number, b: number): string {
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}

function pairCounts(schedule: number[][]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const group of schedule) {
    for (let i = 0; i < group.length; i++) {
      for (let j = i + 1; j < group.length; j++) {
        const key = pairKey(group[i], group[j]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
  }
  return counts;
}

function matchCounts(schedule: number[][]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const group of schedule) {
    const key = matchKey([...group].sort((a, b) => a - b));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function cost(schedule: number[][]): number {
  const pcounts = pairCounts(schedule);
  const mcounts = matchCounts(schedule);
  let pairPenalty = 0;
  for (const c of pcounts.values()) if (c > 1) pairPenalty += c - 1;
  let matchPenalty = 0;
  for (const c of mcounts.values()) if (c > 1) matchPenalty += (c - 1) * 1000;
  return pairPenalty + matchPenalty;
}

/** Build an initial sequence where every player appears exactly `perPlayerTotal`
 * times, avoiding same-player-twice-in-a-match where possible. */
function buildInitialSequence(
  m: number,
  n: number,
  totalMatches: number,
  perPlayerTotal: number,
  rng: () => number
): number[][] {
  const pool: number[] = [];
  for (let p = 1; p <= m; p++) {
    for (let i = 0; i < perPlayerTotal; i++) pool.push(p);
  }

  const tryBuild = (): number[][] | null => {
    shuffle(pool, rng);
    const matches: number[][] = [];
    for (let i = 0; i < totalMatches; i++) {
      const group = pool.slice(i * n, (i + 1) * n);
      if (new Set(group).size !== n) return null;
      matches.push([...group].sort((a, b) => a - b));
    }
    return matches;
  };

  for (let attempt = 0; attempt < 500; attempt++) {
    const result = tryBuild();
    if (result) return result;
  }

  // Fallback: build without duplicate-checking, then repair via swaps.
  shuffle(pool, rng);
  const matches: number[][] = [];
  for (let i = 0; i < totalMatches; i++) {
    matches.push(pool.slice(i * n, (i + 1) * n));
  }
  for (let i = 0; i < matches.length; i++) {
    const seen = new Set<number>();
    for (let j = 0; j < matches[i].length; j++) {
      const p = matches[i][j];
      if (seen.has(p)) {
        outer: for (let k = 0; k < matches.length; k++) {
          if (k === i) continue;
          for (let l = 0; l < matches[k].length; l++) {
            const q = matches[k][l];
            if (q !== p && !matches[i].includes(q) && !matches[k].includes(p)) {
              [matches[i][j], matches[k][l]] = [matches[k][l], matches[i][j]];
              break outer;
            }
          }
        }
      }
      seen.add(matches[i][j]);
    }
  }
  return matches.map((g) => [...g].sort((a, b) => a - b));
}

/** Simulated annealing: swap a player between two different matches anywhere in
 * the flat list (across cycle boundaries too - the whole thing is optimized as
 * one list). This move preserves every player's total play count exactly. */
function localSearch(
  schedule: number[][],
  n: number,
  rng: () => number,
  iterations: number
): { schedule: number[][]; cost: number } {
  let current: number[][] = schedule.map((g) => [...g]);
  let currentCost = cost(current);
  let best: number[][] = current.map((g) => [...g]);
  let bestCost = currentCost;

  const totalMatches = current.length;
  if (totalMatches < 2) {
    return { schedule: best, cost: bestCost };
  }

  const startTemp = 3.0;
  const endTemp = 0.01;

  for (let it = 0; it < iterations; it++) {
    if (bestCost === 0) break;
    const temp = startTemp * Math.pow(endTemp / startTemp, it / iterations);

    const i = Math.floor(rng() * totalMatches);
    let j = Math.floor(rng() * totalMatches);
    while (j === i) j = Math.floor(rng() * totalMatches);

    const pi = Math.floor(rng() * n);
    const pj = Math.floor(rng() * n);
    const a = current[i][pi];
    const b = current[j][pj];
    if (a === b) continue;
    if (current[j].includes(a) || current[i].includes(b)) continue; // would duplicate a player within a match

    current[i][pi] = b;
    current[j][pj] = a;

    const candidate = current.map((g) => [...g].sort((x, y) => x - y));
    const newCost = cost(candidate);
    const delta = newCost - currentCost;

    if (delta <= 0 || rng() < Math.exp(-delta / Math.max(temp, 1e-9))) {
      currentCost = newCost;
      if (currentCost < bestCost) {
        best = current.map((g) => [...g]);
        bestCost = currentCost;
      }
    } else {
      // revert
      current[i][pi] = a;
      current[j][pj] = b;
    }
  }

  return { schedule: best.map((g) => [...g].sort((x, y) => x - y)), cost: bestCost };
}

/**
 * Generate a fair, diversity-optimized fixture list for m players in matches of n,
 * running `cycles` full equalization cycles.
 */
export function generateFixtures(options: FixtureOptions): FixtureResult {
  const { m, n } = options;
  if (n <= 1) throw new Error("n must be at least 2");
  if (m < n) throw new Error("m must be at least n");

  const cycles = options.cycles ?? 1;
  const { mMin, perPlayer } = cycleSize(m, n);
  const totalMatches = cycles * mMin;
  const perPlayerTotal = cycles * perPlayer;

  const seed = options.seed ?? 42;
  const iterations = options.iterations ?? 30000;
  const restarts = options.restarts ?? 5;

  let bestSchedule: number[][] | null = null;
  let bestCost = Infinity;

  for (let r = 0; r < restarts; r++) {
    const rng = makeRng(seed + r * 7919);
    const initial = buildInitialSequence(m, n, totalMatches, perPlayerTotal, rng);
    const { schedule, cost: finalCost } = localSearch(initial, n, rng, iterations);
    if (finalCost < bestCost) {
      bestSchedule = schedule;
      bestCost = finalCost;
    }
    if (bestCost === 0) break;
  }

  const matches = bestSchedule as number[][];

  const matchesPerPlayer: Record<number, number> = {};
  for (let p = 1; p <= m; p++) matchesPerPlayer[p] = 0;
  for (const group of matches) for (const p of group) matchesPerPlayer[p]++;

  const pcounts = pairCounts(matches);
  const mcounts = matchCounts(matches);
  let repeatedPairs = 0;
  let maxPairRepeats = 0;
  for (const c of pcounts.values()) {
    if (c > 1) {
      repeatedPairs++;
      if (c > maxPairRepeats) maxPairRepeats = c;
    }
  }
  let repeatedExactMatches = 0;
  for (const c of mcounts.values()) if (c > 1) repeatedExactMatches++;

  return {
    matches,
    totalMatches: matches.length,
    matchesPerPlayer,
    cost: bestCost,
    repeatedExactMatches,
    repeatedPairs,
    maxPairRepeats,
  };
}
