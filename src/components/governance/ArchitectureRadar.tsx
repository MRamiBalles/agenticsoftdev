
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Network, AlertTriangle, RefreshCw, Hexagon, Component } from 'lucide-react';
import ARCH_DATA from '@/data/architecture_report.json';

export const ArchitectureRadar: React.FC = () => {
    // In strict mode, verify data shape.
    const report = ARCH_DATA as any;
    const { circular_dependencies, hubs, sdp_violations, metrics } = report;

    const hasCriticalIssues = circular_dependencies.length > 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-full">

            {/* Left Col: High Level Stats & Alerts */}
            <div className="space-y-6">
                <Card className="border-l-4 border-l-blue-500 shadow-sm">
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center gap-2">
                            <Network className="text-blue-600" />
                            Structural Health Index
                        </CardTitle>
                        <CardDescription>Static Analysis via Madge</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-3 gap-4 text-center">
                            <div className="p-3 bg-slate-50 rounded border">
                                <div className="text-2xl font-bold text-slate-700">{circular_dependencies.length}</div>
                                <div className="text-xs text-slate-500 uppercase font-semibold">Cycles</div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded border">
                                <div className="text-2xl font-bold text-slate-700">{hubs.length}</div>
                                <div className="text-xs text-slate-500 uppercase font-semibold">Hubs</div>
                            </div>
                            <div className="p-3 bg-slate-50 rounded border">
                                <div className="text-2xl font-bold text-slate-700">{sdp_violations.length}</div>
                                <div className="text-xs text-slate-500 uppercase font-semibold">SDP Violations</div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {hasCriticalIssues && (
                    <Alert variant="destructive" className="animate-pulse bg-red-50 border-red-200">
                        <AlertTriangle className="h-4 w-4" />
                        <AlertTitle>Critical Structural Failures Detected</AlertTitle>
                        <AlertDescription>
                            Circular dependencies threaten modularity. Immediate refactor required.
                        </AlertDescription>
                    </Alert>
                )}

                <Card className="h-[300px] flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <RefreshCw size={16} /> Cycle Detector
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full p-4">
                            {circular_dependencies.length === 0 ? (
                                <div className="flex flex-col items-center justify-center h-full text-slate-400 text-sm">
                                    <CheckCircle size={24} className="mb-2 text-green-500 opacity-50" />
                                    No cycles detected. Good job.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {circular_dependencies.map((cycle: string[], i: number) => (
                                        <div key={i} className="p-3 bg-red-50 border border-red-100 rounded text-xs font-mono text-red-800 break-all">
                                            <span className="font-bold">Cycle #{i + 1}:</span> {cycle.join(' → ')}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>

            {/* Right Col: Hubs & Instability */}
            <div className="space-y-6">
                <Card className="h-[500px] flex flex-col">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                            <Hexagon size={16} /> Topography Risks (Hubs & Instability)
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-hidden p-0">
                        <ScrollArea className="h-full p-4 space-y-4">
                            {hubs.length > 0 && (
                                <div className="space-y-2">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase">Hub-like Nodes (God Components)</h4>
                                    {hubs.map((hub: any) => (
                                        <div key={hub.id} className="flex items-center justify-between p-2 bg-amber-50 border border-amber-100 rounded">
                                            <div className="flex items-center gap-2">
                                                <Component size={14} className="text-amber-600" />
                                                <span className="text-sm font-medium text-amber-900 truncate max-w-[150px]" title={hub.id}>{hub.id}</span>
                                            </div>
                                            <div className="flex gap-2 text-[10px]">
                                                <Badge variant="outline" className="bg-white">In: {hub.fanIn}</Badge>
                                                <Badge variant="outline" className="bg-white">Out: {hub.fanOut}</Badge>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {sdp_violations.length > 0 && (
                                <div className="space-y-2 pt-4">
                                    <h4 className="text-xs font-bold text-slate-500 uppercase">SDP Violations (Unstable Dependencies)</h4>
                                    {sdp_violations.map((v: any, i: number) => (
                                        <div key={i} className="p-2 bg-slate-50 border rounded text-xs">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="font-semibold text-slate-700">Stability Inversion</span>
                                                <Badge variant="destructive" className="h-4 text-[9px]">{v.diff} Diff</Badge>
                                            </div>
                                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center text-slate-500">
                                                <div className="truncate text-right" title={v.stable}>{v.stable.split('/').pop()}</div>
                                                <div className="text-red-400">→</div>
                                                <div className="truncate" title={v.unstable}>{v.unstable.split('/').pop()}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </ScrollArea>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};

// Icon helper
import { CheckCircle } from 'lucide-react';
