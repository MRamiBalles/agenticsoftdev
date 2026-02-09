/**
 * Open Match: Match Function for Galactic Royale
 * 
 * Groups players based on:
 * 1. Latency (RTT to region)
 * 2. MMR (Matchmaking Rating)
 * 
 * Compliance: Platform v5.0 - Decoupled Matchmaking
 */

interface Player {
    id: string;
    region: string;
    rttMs: number;  // Round-trip time in milliseconds
    mmr: number;    // Matchmaking rating
    queuedAt: Date;
}

interface Match {
    matchId: string;
    players: Player[];
    avgRtt: number;
    avgMmr: number;
}

// Configuration
const CONFIG = {
    MATCH_SIZE: 50,           // Players per match
    RTT_TOLERANCE_MS: 50,     // Max RTT difference within match
    MMR_TOLERANCE: 200,       // Max MMR difference within match
    QUEUE_TIMEOUT_SEC: 120,   // Expand tolerance after this
};

/**
 * Main Match Function: Called by Open Match Director
 */
export function makeMatches(pool: Player[]): Match[] {
    const matches: Match[] = [];
    const used = new Set<string>();

    // Sort by queue time (FIFO priority)
    const sorted = [...pool].sort((a, b) =>
        a.queuedAt.getTime() - b.queuedAt.getTime()
    );

    for (const anchor of sorted) {
        if (used.has(anchor.id)) continue;

        // Find compatible players
        const compatible = sorted.filter(p =>
            !used.has(p.id) &&
            p.region === anchor.region &&
            Math.abs(p.rttMs - anchor.rttMs) <= CONFIG.RTT_TOLERANCE_MS &&
            Math.abs(p.mmr - anchor.mmr) <= CONFIG.MMR_TOLERANCE
        );

        if (compatible.length >= CONFIG.MATCH_SIZE) {
            // Form match
            const selected = compatible.slice(0, CONFIG.MATCH_SIZE);
            const match = createMatch(selected);
            matches.push(match);

            // Mark as used
            selected.forEach(p => used.add(p.id));
        }
    }

    // Handle long-waiting players: relax constraints
    const longWaiting = sorted.filter(p => {
        const waitTime = (Date.now() - p.queuedAt.getTime()) / 1000;
        return !used.has(p.id) && waitTime > CONFIG.QUEUE_TIMEOUT_SEC;
    });

    if (longWaiting.length >= CONFIG.MATCH_SIZE / 2) {
        // Create match with relaxed constraints
        const relaxedMatch = createMatch(longWaiting.slice(0, CONFIG.MATCH_SIZE));
        matches.push(relaxedMatch);
        longWaiting.slice(0, CONFIG.MATCH_SIZE).forEach(p => used.add(p.id));
    }

    return matches;
}

function createMatch(players: Player[]): Match {
    const avgRtt = players.reduce((sum, p) => sum + p.rttMs, 0) / players.length;
    const avgMmr = players.reduce((sum, p) => sum + p.mmr, 0) / players.length;

    return {
        matchId: `match-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        players,
        avgRtt: Math.round(avgRtt),
        avgMmr: Math.round(avgMmr),
    };
}

/**
 * Allocate GameServer via Agones
 * Called after match is formed
 */
export async function allocateServer(match: Match): Promise<string> {
    // In production, this calls Agones Allocation API
    // For now, return mock endpoint
    console.log(`🎮 Allocating server for match ${match.matchId}`);
    console.log(`   Players: ${match.players.length}`);
    console.log(`   Avg RTT: ${match.avgRtt}ms`);
    console.log(`   Avg MMR: ${match.avgMmr}`);

    // Mock: Return server address
    return `gameserver-${match.matchId}.galactic-royale.svc:7777`;
}

// Export for Open Match integration
export default {
    makeMatches,
    allocateServer,
};
