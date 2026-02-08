
import * as React from 'react';
import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { ShieldCheck, AlertTriangle, Activity, Terminal } from 'lucide-react';
import AUDIT_LOG from '@/data/audit_log.json';

interface LogEntry {
    id: string;
    timestamp: string;
    trigger_event: string;
    action_type: string;
    outcome: "SUCCESS" | "FAILURE" | "BLOCKED";
    action_payload: any;
    chain_of_thought: string;
}

export const OperationsLog: React.FC = () => {
    // Filter for SRE / Governance events
    const opsEvents = (AUDIT_LOG as LogEntry[]).filter(entry =>
        entry.trigger_event === "SYSTEM_SELF_HEALING" ||
        entry.trigger_event === "CRITICAL_ANOMALY_DETECTED" ||
        entry.trigger_event === "GOVERNANCE_INTERVENTION" ||
        entry.action_type === "GOVERNANCE_CHECK"
    ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const incidentCount = opsEvents.filter(e => e.trigger_event === "SYSTEM_SELF_HEALING" || e.outcome === "BLOCKED").length;
    const systemStatus = incidentCount > 0 ? "PROTECTED (Active Defense)" : "CLEAN (Monitoring)";
    const statusColor = incidentCount > 0 ? "text-blue-600" : "text-green-600";

    return (
        <div className="space-y-6">
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-l-4 border-l-blue-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <ShieldCheck size={16} /> Defense Status
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className={`text-2xl font-bold ${statusColor}`}>{systemStatus}</div>
                        <p className="text-xs text-muted-foreground">Sovereign SRE is active</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <AlertTriangle size={16} /> Threats Neutralized
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{incidentCount}</div>
                        <p className="text-xs text-muted-foreground">Auto-Reverts & Blocks</p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                            <Activity size={16} /> Uptime Integrity
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-green-600">99.9%</div>
                        <p className="text-xs text-muted-foreground">No unhandled violations</p>
                    </CardContent>
                </Card>
            </div>

            {/* Operations Log */}
            <Card className="h-[500px] flex flex-col">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Terminal size={18} /> Live Operations Feed
                    </CardTitle>
                    <CardDescription>Real-time log of SRE interventions and Governance checks.</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 overflow-hidden p-0">
                    <ScrollArea className="h-full p-4">
                        <div className="space-y-4">
                            {opsEvents.length === 0 ? (
                                <div className="text-center text-slate-400 py-10">
                                    No operational incidents recorded.
                                </div>
                            ) : (
                                opsEvents.map((event) => (
                                    <div key={event.id} className="flex gap-4 p-4 border rounded bg-slate-50/50 hover:bg-slate-50 transition-colors">
                                        <div className="mt-1">
                                            {event.outcome === 'BLOCKED' || event.trigger_event === 'CRITICAL_ANOMALY_DETECTED' ? (
                                                <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-200">
                                                    BLOCK
                                                </Badge>
                                            ) : event.trigger_event === 'SYSTEM_SELF_HEALING' ? (
                                                <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-200">
                                                    HEAL
                                                </Badge>
                                            ) : (
                                                <Badge variant="secondary">INFO</Badge>
                                            )}
                                        </div>
                                        <div className="flex-1 space-y-1">
                                            <div className="flex items-center justify-between">
                                                <span className="font-mono text-xs font-bold text-slate-700">
                                                    {event.action_type}
                                                </span>
                                                <span className="text-xs text-slate-400">
                                                    {new Date(event.timestamp).toLocaleString()}
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-slate-900">
                                                {event.chain_of_thought}
                                            </p>
                                            <div className="text-xs font-mono text-slate-500 bg-white p-2 rounded border">
                                                {JSON.stringify(event.action_payload, null, 2)}
                                            </div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </ScrollArea>
                </CardContent>
            </Card>
        </div>
    );
};
