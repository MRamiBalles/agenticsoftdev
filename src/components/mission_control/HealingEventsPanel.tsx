import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { HeartPulse, ShieldAlert, CheckCircle2, AlertTriangle } from 'lucide-react';

export interface HealingEvent {
    id: string;
    taskId: string;
    agent: string;
    failureCategory: string;
    actionTaken: string;
    healed: boolean;
    attempts: number;
    timestamp: number;
    escalated?: boolean;
    escalationLevel?: string;
}

interface HealingEventsPanelProps {
    events: HealingEvent[];
    totalDetected: number;
    totalHealed: number;
    totalEscalated: number;
}

export const HealingEventsPanel: React.FC<HealingEventsPanelProps> = ({
    events,
    totalDetected,
    totalHealed,
    totalEscalated,
}) => {
    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <HeartPulse size={18} className="text-rose-500" /> Self-Healing Engine
                </CardTitle>
                <CardDescription>Phase 4.7 — Autonomous failure recovery</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden space-y-4">
                {/* KPI row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-50 rounded-lg p-2 border">
                        <div className="text-xl font-bold text-slate-700">{totalDetected}</div>
                        <div className="text-[10px] text-slate-500 font-medium">Detected</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                        <div className="text-xl font-bold text-green-700">{totalHealed}</div>
                        <div className="text-[10px] text-green-600 font-medium">Healed</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                        <div className="text-xl font-bold text-red-700">{totalEscalated}</div>
                        <div className="text-[10px] text-red-600 font-medium">Escalated</div>
                    </div>
                </div>

                {/* Event feed */}
                <ScrollArea className="h-[300px]">
                    <div className="space-y-2 pr-2">
                        {events.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 text-sm">
                                No healing events recorded.
                            </div>
                        ) : (
                            events.map(event => (
                                <div key={event.id} className="flex gap-3 p-2.5 rounded-lg bg-slate-50 border text-xs">
                                    <div className="mt-0.5">
                                        {event.healed ? (
                                            <CheckCircle2 size={16} className="text-green-500" />
                                        ) : event.escalated ? (
                                            <ShieldAlert size={16} className="text-red-500" />
                                        ) : (
                                            <AlertTriangle size={16} className="text-amber-500" />
                                        )}
                                    </div>
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono font-semibold">{event.taskId}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(event.timestamp).toLocaleTimeString()}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-1.5 flex-wrap">
                                            <Badge variant="outline" className="text-[10px] h-4 bg-rose-50 text-rose-700 border-rose-200">
                                                {event.failureCategory}
                                            </Badge>
                                            <span className="text-muted-foreground">→</span>
                                            <Badge variant="outline" className={`text-[10px] h-4 ${event.healed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                                {event.actionTaken}
                                            </Badge>
                                            {event.attempts > 1 && (
                                                <span className="text-muted-foreground">({event.attempts} attempts)</span>
                                            )}
                                        </div>
                                        <div className="text-muted-foreground">
                                            Agent: <span className="font-mono">{event.agent}</span>
                                            {event.escalated && (
                                                <span className="text-red-600 ml-2">⚠ Escalated to {event.escalationLevel}</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
