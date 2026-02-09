/**
 * Dashboard Feed: Observability Pipeline
 * 
 * Reads vital_signs.json and pushes metrics to:
 * - InfluxDB (for Grafana visualization)
 * - Console (for local debugging)
 * 
 * Metrics Tracked:
 * - ATDI (Architectural Technical Debt Index) over time
 * - Agent hallucination rate
 * - Task completion rate
 * - Latency of reasoning
 * 
 * Compliance: Platform v5.0 - SRE Observability
 */

import * as fs from 'fs';
import * as path from 'path';

interface VitalSigns {
    timestamp: string;
    atdi: number;
    hallucinationRate: number;
    taskCompletionRate: number;
    avgReasoningLatencyMs: number;
    agentStates: Record<string, AgentState>;
}

interface AgentState {
    name: string;
    status: 'idle' | 'working' | 'error';
    lastAction: string;
    errorCount: number;
}

interface MetricPoint {
    measurement: string;
    tags: Record<string, string>;
    fields: Record<string, number>;
    timestamp: number;
}

// Configuration
const CONFIG = {
    VITAL_SIGNS_PATH: path.resolve(process.cwd(), 'data/vital_signs.json'),
    INFLUXDB_URL: process.env.INFLUXDB_URL || 'http://localhost:8086',
    INFLUXDB_BUCKET: 'agenticsoftdev',
    POLL_INTERVAL_MS: 5000,
};

/**
 * Read current vital signs from file
 */
function readVitalSigns(): VitalSigns | null {
    if (!fs.existsSync(CONFIG.VITAL_SIGNS_PATH)) {
        console.warn('⚠️ vital_signs.json not found');
        return null;
    }

    try {
        const content = fs.readFileSync(CONFIG.VITAL_SIGNS_PATH, 'utf-8');
        return JSON.parse(content);
    } catch (error) {
        console.error('❌ Failed to parse vital_signs.json:', error);
        return null;
    }
}

/**
 * Convert vital signs to InfluxDB line protocol
 */
function toLineProtocol(vitals: VitalSigns): string[] {
    const timestamp = new Date(vitals.timestamp).getTime() * 1_000_000; // nanoseconds
    const lines: string[] = [];

    // Platform-level metrics
    lines.push(
        `platform_health,env=production atdi=${vitals.atdi},hallucination_rate=${vitals.hallucinationRate},task_completion=${vitals.taskCompletionRate},reasoning_latency=${vitals.avgReasoningLatencyMs} ${timestamp}`
    );

    // Per-agent metrics
    for (const [id, agent] of Object.entries(vitals.agentStates)) {
        const status = agent.status === 'error' ? 0 : agent.status === 'working' ? 1 : 2;
        lines.push(
            `agent_state,agent=${id} status=${status},errors=${agent.errorCount} ${timestamp}`
        );
    }

    return lines;
}

/**
 * Push metrics to InfluxDB (or console in dev mode)
 */
async function pushMetrics(lines: string[]): Promise<void> {
    if (process.env.NODE_ENV === 'development') {
        console.log('📊 Metrics (dev mode):');
        lines.forEach(line => console.log(`   ${line}`));
        return;
    }

    // Production: Send to InfluxDB
    try {
        const response = await fetch(`${CONFIG.INFLUXDB_URL}/api/v2/write?bucket=${CONFIG.INFLUXDB_BUCKET}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'text/plain',
                'Authorization': `Token ${process.env.INFLUXDB_TOKEN}`,
            },
            body: lines.join('\n'),
        });

        if (!response.ok) {
            console.error('❌ InfluxDB write failed:', response.statusText);
        }
    } catch (error) {
        console.error('❌ Failed to push to InfluxDB:', error);
    }
}

/**
 * Main polling loop
 */
async function main(): Promise<void> {
    console.log('📡 Dashboard Feed - Observability Pipeline\n');
    console.log(`   Polling: ${CONFIG.VITAL_SIGNS_PATH}`);
    console.log(`   Interval: ${CONFIG.POLL_INTERVAL_MS}ms`);
    console.log(`   Target: ${CONFIG.INFLUXDB_URL}\n`);

    setInterval(async () => {
        const vitals = readVitalSigns();
        if (vitals) {
            const lines = toLineProtocol(vitals);
            await pushMetrics(lines);
            console.log(`✅ Pushed ${lines.length} metrics at ${new Date().toISOString()}`);
        }
    }, CONFIG.POLL_INTERVAL_MS);
}

// Run
main().catch(console.error);
