
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronRight, ChevronDown, Terminal, ShieldCheck, AlertTriangle, FileJson } from 'lucide-react';

// Interfaces ensuring type safety for the log entries
interface ForensicLogEntry {
    id: string;
    timestamp: string;
    previous_hash: string;
    agent_id: string;
    trigger_event: string;
    chain_of_thought: string;
    action_type: string;
    action_payload: any;
    outcome: "SUCCESS" | "FAILURE" | "BLOCKED";
}

// Mock Data for demonstration (until real data is linked)
// In production, this would fetch from an API endpoint serving the .jsonl
const MOCK_LOGS: ForensicLogEntry[] = [
    {
        id: "550e8400-e29b-41d4-a716-446655440000",
        timestamp: new Date().toISOString(),
        previous_hash: "GENESIS_HASH",
        agent_id: "ArchitectAgent-v2.1",
        trigger_event: "User Request: /implement auth",
        chain_of_thought: "<thinking>\nUser wants auth. Checking constitution... Auth requires Supabase. I should check existing auth.ts. It is missing. I will create a plan to add Supabase Auth.\n</thinking>",
        action_type: "PLAN_DECISION",
        action_payload: { file: "plan.md", status: "CREATED" },
        outcome: "SUCCESS"
    },
    {
        id: "550e8400-e29b-41d4-a716-446655440001",
        timestamp: new Date(Date.now() + 1000).toISOString(),
        previous_hash: "a1b2c3d4...",
        agent_id: "SecurityOfficer-v2.1",
        trigger_event: "File Change: src/secrets.ts",
        chain_of_thought: "<thinking>\nScanning file content... Detected pattern 'sk-'. This matches OpenAI Secret Key regex. Reviewing Constitution Article IV. Secrets are forbidden. I must BLOCK this action and redact the secret in logs.\n</thinking>",
        action_type: "GOVERNANCE_CHECK",
        action_payload: { file: "secrets.ts", violation: "CRITICAL_SECRET_EXPOSED" },
        outcome: "BLOCKED"
    }
];

export const AuditLogViewer: React.FC = () => {
    const [logs, setLogs] = useState<ForensicLogEntry[]>(MOCK_LOGS);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    // In a real implementation, this would fetch the published JSON log
    // useEffect(() => {
    //  fetch('/data/audit_log.json').then(res => res.json()).then(setLogs);
    // }, []);

    const toggleExpand = (id: string) => {
        const newSet = new Set(expandedIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setExpandedIds(newSet);
    };

    return (
        <Card className="h-full flex flex-col border-slate-300 shadow-sm">
            <CardHeader className="pb-3 bg-slate-50 border-b">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Terminal className="h-5 w-5 text-slate-600" />
                            Forensic Audit Trail (Black Box)
                        </CardTitle>
                        <CardDescription>
                            Immutable record of Agent Chain-of-Thought (ISO 42001 Compliance)
                        </CardDescription>
                    </div>
                    <Badge variant="outline" className="font-mono text-xs">
                        HASH_CHAIN_VERIFIED
                    </Badge>
                </div>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-[500px] p-4">
                    <div className="space-y-4">
                        {logs.map((log) => (
                            <div key={log.id} className="border rounded-md bg-white text-sm relative overflow-hidden group">
                                {/* Status Line */}
                                <div className={`absolute left-0 top-0 bottom-0 w-1 ${log.outcome === 'BLOCKED' ? 'bg-red-500' :
                                        log.outcome === 'FAILURE' ? 'bg-amber-500' : 'bg-emerald-500'
                                    }`} />

                                <div className="p-3 pl-4 cursor-pointer hover:bg-slate-50 transition-colors"
                                    onClick={() => toggleExpand(log.id)}>
                                    <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                            <Badge variant={log.outcome === 'BLOCKED' ? 'destructive' : 'secondary'}
                                                className="text-[10px] h-5">
                                                {log.outcome}
                                            </Badge>
                                            <span className="font-bold font-mono text-slate-700">{log.action_type}</span>
                                            <span className="text-xs text-slate-400">by {log.agent_id}</span>
                                        </div>
                                        <div className="flex items-center gap-2 text-slate-400 text-xs font-mono">
                                            {new Date(log.timestamp).toLocaleTimeString()}
                                            {expandedIds.has(log.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                        </div>
                                    </div>
                                    <div className="text-slate-600 font-medium">
                                        {log.trigger_event}
                                    </div>
                                </div>

                                {/* Expanded Detail (Chain of Thought) */}
                                {expandedIds.has(log.id) && (
                                    <div className="bg-slate-900 text-slate-300 p-4 border-t font-mono text-xs space-y-3">
                                        <div>
                                            <h4 className="text-emerald-400 font-bold mb-1 flex items-center gap-2">
                                                <ShieldCheck size={12} /> Chain of Thought (Thinking Process)
                                            </h4>
                                            <div className="pl-4 border-l-2 border-slate-700 italic text-slate-400 whitespace-pre-wrap">
                                                {log.chain_of_thought}
                                            </div>
                                        </div>

                                        <div>
                                            <h4 className="text-blue-400 font-bold mb-1 flex items-center gap-2">
                                                <FileJson size={12} /> Action Payload
                                            </h4>
                                            <pre className="bg-black p-2 rounded text-slate-400 overflow-x-auto">
                                                {JSON.stringify(log.action_payload, null, 2)}
                                            </pre>
                                        </div>

                                        <div className="pt-2 border-t border-slate-800 flex justify-between text-[10px] text-slate-500">
                                            <span>Entry ID: {log.id}</span>
                                            <span>Prev Hash: {log.previous_hash.substring(0, 12)}...</span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </ScrollArea>
                <div className="p-2 border-t bg-slate-50 flex justify-center">
                    <Button variant="ghost" size="sm" className="text-xs text-slate-500 h-6">
                        Verify Cryptographic Integrity
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
};
