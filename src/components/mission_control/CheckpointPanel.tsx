import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Database, ShieldCheck, ShieldAlert, Clock } from 'lucide-react';

export interface CheckpointEntry {
    id: string;
    label?: string;
    createdAt: number;
    sizeBytes: number;
    tasksCompleted: number;
    totalRetries: number;
    integrityValid: boolean;
    hash: string;
}

interface CheckpointPanelProps {
    checkpoints: CheckpointEntry[];
    autoInterval: number;
    maxCheckpoints: number;
}

function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const CheckpointPanel: React.FC<CheckpointPanelProps> = ({
    checkpoints,
    autoInterval,
    maxCheckpoints,
}) => {
    const validCount = checkpoints.filter(c => c.integrityValid).length;
    const totalSize = checkpoints.reduce((sum, c) => sum + c.sizeBytes, 0);

    return (
        <Card className="h-full flex flex-col">
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Database size={18} className="text-violet-600" /> Checkpoints
                </CardTitle>
                <CardDescription>
                    Phase 4.5 — Auto every {autoInterval} tasks, max {maxCheckpoints} retained
                </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden space-y-4">
                {/* Summary */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-violet-50 rounded-lg p-2 border border-violet-100">
                        <div className="text-xl font-bold text-violet-700">{checkpoints.length}</div>
                        <div className="text-[10px] text-violet-600 font-medium">Saved</div>
                    </div>
                    <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                        <div className="text-xl font-bold text-green-700">{validCount}</div>
                        <div className="text-[10px] text-green-600 font-medium">Verified</div>
                    </div>
                    <div className="bg-slate-50 rounded-lg p-2 border">
                        <div className="text-xl font-bold text-slate-700">{formatBytes(totalSize)}</div>
                        <div className="text-[10px] text-slate-500 font-medium">Total Size</div>
                    </div>
                </div>

                {/* Checkpoint list */}
                <ScrollArea className="h-[260px]">
                    <div className="space-y-2 pr-2">
                        {checkpoints.length === 0 ? (
                            <div className="text-center text-muted-foreground py-8 text-sm">
                                No checkpoints saved yet.
                            </div>
                        ) : (
                            [...checkpoints].reverse().map(ckpt => (
                                <div key={ckpt.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-slate-50 border text-xs">
                                    {ckpt.integrityValid ? (
                                        <ShieldCheck size={16} className="text-green-500 mt-0.5 shrink-0" />
                                    ) : (
                                        <ShieldAlert size={16} className="text-red-500 mt-0.5 shrink-0" />
                                    )}
                                    <div className="flex-1 min-w-0 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="font-mono font-semibold truncate">
                                                {ckpt.label ?? ckpt.id.slice(0, 16)}
                                            </span>
                                            <div className="flex items-center gap-1 text-muted-foreground shrink-0">
                                                <Clock size={10} />
                                                <span>{new Date(ckpt.createdAt).toLocaleTimeString()}</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <Badge variant="outline" className={`text-[10px] h-4 ${ckpt.integrityValid ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                                {ckpt.integrityValid ? 'SHA-256 ✓' : 'INTEGRITY FAIL'}
                                            </Badge>
                                            <span className="text-muted-foreground">{ckpt.tasksCompleted} tasks</span>
                                            <span className="text-muted-foreground">{formatBytes(ckpt.sizeBytes)}</span>
                                            {ckpt.totalRetries > 0 && (
                                                <span className="text-amber-600">{ckpt.totalRetries} retries</span>
                                            )}
                                        </div>
                                        <div className="font-mono text-[10px] text-slate-400 truncate">
                                            {ckpt.hash}
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
