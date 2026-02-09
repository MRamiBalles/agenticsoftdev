/**
 * Agent Tracer: Distributed Tracing for Agentic Systems
 * 
 * Captures the "thought process" of agents for:
 * - Debugging hallucinations
 * - Auditing decision chains
 * - Performance profiling
 * 
 * Each trace includes:
 * - Agent ID
 * - Task context
 * - Reasoning steps
 * - Tool calls + results
 * - Final output
 * 
 * Compliance: Platform v5.0 - SRE Forensics
 */

import * as fs from 'fs';
import * as path from 'path';

interface TraceSpan {
    spanId: string;
    parentId: string | null;
    operationName: string;
    agentId: string;
    startTime: number;
    endTime?: number;
    tags: Record<string, string>;
    logs: TraceLog[];
    status: 'ok' | 'error';
}

interface TraceLog {
    timestamp: number;
    level: 'info' | 'warn' | 'error' | 'thought';
    message: string;
    data?: unknown;
}

interface Trace {
    traceId: string;
    spans: TraceSpan[];
    rootSpanId: string;
}

// In-memory trace store (production would use Jaeger/Zipkin)
const traces: Map<string, Trace> = new Map();

/**
 * Start a new trace for an agent task
 */
export function startTrace(agentId: string, taskName: string): string {
    const traceId = `trace-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const rootSpanId = `span-${Date.now()}`;

    const rootSpan: TraceSpan = {
        spanId: rootSpanId,
        parentId: null,
        operationName: taskName,
        agentId,
        startTime: Date.now(),
        tags: { agent: agentId },
        logs: [],
        status: 'ok',
    };

    traces.set(traceId, {
        traceId,
        spans: [rootSpan],
        rootSpanId,
    });

    console.log(`🔍 [Trace ${traceId}] Started: ${taskName} by ${agentId}`);
    return traceId;
}

/**
 * Add a child span (sub-operation)
 */
export function startSpan(traceId: string, parentSpanId: string, operationName: string): string {
    const trace = traces.get(traceId);
    if (!trace) throw new Error(`Trace ${traceId} not found`);

    const parentSpan = trace.spans.find(s => s.spanId === parentSpanId);
    if (!parentSpan) throw new Error(`Parent span ${parentSpanId} not found`);

    const spanId = `span-${Date.now()}-${trace.spans.length}`;
    const span: TraceSpan = {
        spanId,
        parentId: parentSpanId,
        operationName,
        agentId: parentSpan.agentId,
        startTime: Date.now(),
        tags: {},
        logs: [],
        status: 'ok',
    };

    trace.spans.push(span);
    return spanId;
}

/**
 * Log a "thought" - the reasoning step of an agent
 */
export function logThought(traceId: string, spanId: string, thought: string): void {
    const trace = traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.logs.push({
        timestamp: Date.now(),
        level: 'thought',
        message: thought,
    });

    console.log(`   💭 [${span.operationName}] ${thought}`);
}

/**
 * Log a tool call
 */
export function logToolCall(traceId: string, spanId: string, tool: string, args: unknown, result: unknown): void {
    const trace = traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.logs.push({
        timestamp: Date.now(),
        level: 'info',
        message: `Tool: ${tool}`,
        data: { args, result },
    });
}

/**
 * End a span
 */
export function endSpan(traceId: string, spanId: string, status: 'ok' | 'error' = 'ok'): void {
    const trace = traces.get(traceId);
    if (!trace) return;

    const span = trace.spans.find(s => s.spanId === spanId);
    if (!span) return;

    span.endTime = Date.now();
    span.status = status;
}

/**
 * End and export trace
 */
export function endTrace(traceId: string): Trace | null {
    const trace = traces.get(traceId);
    if (!trace) return null;

    // End root span
    const rootSpan = trace.spans.find(s => s.spanId === trace.rootSpanId);
    if (rootSpan && !rootSpan.endTime) {
        rootSpan.endTime = Date.now();
    }

    // Export to file
    const outputPath = path.resolve(process.cwd(), `data/traces/${traceId}.json`);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(trace, null, 2));

    console.log(`\n✅ [Trace ${traceId}] Completed. Exported to ${outputPath}`);

    const duration = rootSpan ? (rootSpan.endTime! - rootSpan.startTime) : 0;
    console.log(`   Duration: ${duration}ms`);
    console.log(`   Spans: ${trace.spans.length}`);

    return trace;
}

// Export for use by orchestrator
export default {
    startTrace,
    startSpan,
    logThought,
    logToolCall,
    endSpan,
    endTrace,
};
