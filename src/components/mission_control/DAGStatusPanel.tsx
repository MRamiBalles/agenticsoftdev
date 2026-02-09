import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GitBranch, CheckCircle2, XCircle, Clock, Zap, RotateCcw } from 'lucide-react';

export interface DAGTaskStatus {
    id: string;
    agent: string;
    type: string;
    status: 'COMPLETED' | 'FAILED' | 'RUNNING' | 'PENDING' | 'SKIPPED';
    durationMs: number;
    retries: number;
}

export interface DAGExecutionSummary {
    totalTasks: number;
    completed: number;
    failed: number;
    skipped: number;
    running: number;
    retries: number;
    spawned: number;
    durationMs: number;
    circuitBroken: boolean;
    tasks: DAGTaskStatus[];
}

interface DAGStatusPanelProps {
    execution: DAGExecutionSummary | null;
}

const statusIcon = (status: DAGTaskStatus['status']) => {
    switch (status) {
        case 'COMPLETED': return <CheckCircle2 size={14} className="text-green-500" />;
        case 'FAILED': return <XCircle size={14} className="text-red-500" />;
        case 'RUNNING': return <Zap size={14} className="text-blue-500 animate-pulse" />;
        case 'PENDING': return <Clock size={14} className="text-slate-400" />;
        case 'SKIPPED': return <RotateCcw size={14} className="text-amber-500" />;
    }
};

const statusColor = (status: DAGTaskStatus['status']) => {
    switch (status) {
        case 'COMPLETED': return 'bg-green-100 text-green-800 border-green-200';
        case 'FAILED': return 'bg-red-100 text-red-800 border-red-200';
        case 'RUNNING': return 'bg-blue-100 text-blue-800 border-blue-200';
        case 'PENDING': return 'bg-slate-100 text-slate-600 border-slate-200';
        case 'SKIPPED': return 'bg-amber-100 text-amber-800 border-amber-200';
    }
};

export const DAGStatusPanel: React.FC<DAGStatusPanelProps> = ({ execution }) => {
    if (!execution) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <GitBranch size={18} /> DAG Execution
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-8">No execution data available. Run the orchestrator to see live DAG status.</p>
                </CardContent>
            </Card>
        );
    }

    const progress = execution.totalTasks > 0
        ? ((execution.completed + execution.failed + execution.skipped) / execution.totalTasks) * 100
        : 0;

    return (
        <Card>
            <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <GitBranch size={18} className="text-indigo-600" /> DAG Execution
                        </CardTitle>
                        <CardDescription>{execution.durationMs}ms elapsed</CardDescription>
                    </div>
                    {execution.circuitBroken && (
                        <Badge variant="destructive" className="animate-pulse">CIRCUIT BROKEN</Badge>
                    )}
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Progress bar */}
                <div className="space-y-1">
                    <div className="flex justify-between text-xs text-muted-foreground">
                        <span>{execution.completed + execution.failed + execution.skipped}/{execution.totalTasks} tasks processed</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <Progress value={progress} className="h-2" />
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-green-50 rounded-lg p-2 border border-green-100">
                        <div className="text-xl font-bold text-green-700">{execution.completed}</div>
                        <div className="text-[10px] text-green-600 font-medium">Completed</div>
                    </div>
                    <div className="bg-red-50 rounded-lg p-2 border border-red-100">
                        <div className="text-xl font-bold text-red-700">{execution.failed}</div>
                        <div className="text-[10px] text-red-600 font-medium">Failed</div>
                    </div>
                    <div className="bg-amber-50 rounded-lg p-2 border border-amber-100">
                        <div className="text-xl font-bold text-amber-700">{execution.retries}</div>
                        <div className="text-[10px] text-amber-600 font-medium">Retries</div>
                    </div>
                </div>

                {/* Task grid */}
                <div className="space-y-1.5">
                    {execution.tasks.map(task => (
                        <div key={task.id} className="flex items-center gap-2 text-xs p-2 rounded-md bg-slate-50 border">
                            {statusIcon(task.status)}
                            <span className="font-mono font-medium w-24 truncate">{task.id}</span>
                            <Badge variant="outline" className={`text-[10px] h-5 ${statusColor(task.status)}`}>
                                {task.status}
                            </Badge>
                            <span className="text-muted-foreground ml-auto">{task.agent}</span>
                            <span className="text-muted-foreground font-mono">{task.durationMs}ms</span>
                            {task.retries > 0 && (
                                <span className="text-amber-600 font-mono">↻{task.retries}</span>
                            )}
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
