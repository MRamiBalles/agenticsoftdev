import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Users, TrendingUp, TrendingDown } from 'lucide-react';

export interface AgentStats {
    agent: string;
    role: string;
    totalTasks: number;
    successRate: number;
    avgDurationMs: number;
    failureCount: number;
    retryCount: number;
    recommendations: string[];
}

interface AgentPerformancePanelProps {
    agents: AgentStats[];
}

const roleColor: Record<string, string> = {
    architect: '#6366f1',
    builder: '#22c55e',
    guardian: '#f59e0b',
    strategist: '#8b5cf6',
    researcher: '#06b6d4',
    devops: '#ef4444',
    designer: '#ec4899',
};

export const AgentPerformancePanel: React.FC<AgentPerformancePanelProps> = ({ agents }) => {
    if (agents.length === 0) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-lg">
                        <Users size={18} /> Agent Performance
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-muted-foreground text-center py-8">No agent data available yet.</p>
                </CardContent>
            </Card>
        );
    }

    const chartData = agents.map(a => ({
        name: a.agent,
        successRate: Math.round(a.successRate * 100),
        avgDuration: Math.round(a.avgDurationMs),
        role: a.role,
    }));

    return (
        <Card>
            <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-lg">
                    <Users size={18} className="text-indigo-600" /> Agent Performance
                </CardTitle>
                <CardDescription>Success rate by agent (Phase 4.4 Learning)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* Success Rate Chart */}
                <div className="h-[180px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData} layout="vertical" margin={{ left: 60, right: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                            <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fontFamily: 'monospace' }} width={60} />
                            <Tooltip
                                formatter={(value: number) => [`${value}%`, 'Success Rate']}
                                contentStyle={{ fontSize: 12 }}
                            />
                            <Bar dataKey="successRate" radius={[0, 4, 4, 0]} maxBarSize={24}>
                                {chartData.map((entry, idx) => (
                                    <Cell key={idx} fill={roleColor[entry.role] ?? '#94a3b8'} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                {/* Agent detail cards */}
                <div className="space-y-2">
                    {agents.map(agent => (
                        <div key={agent.agent} className="flex items-center gap-3 p-2.5 rounded-lg bg-slate-50 border text-xs">
                            <div className="w-2 h-8 rounded-full" style={{ backgroundColor: roleColor[agent.role] ?? '#94a3b8' }} />
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                    <span className="font-mono font-semibold">{agent.agent}</span>
                                    <Badge variant="outline" className="text-[10px] h-4">{agent.role}</Badge>
                                </div>
                                <div className="flex gap-3 mt-0.5 text-muted-foreground">
                                    <span>{agent.totalTasks} tasks</span>
                                    <span>{Math.round(agent.avgDurationMs)}ms avg</span>
                                    {agent.retryCount > 0 && <span className="text-amber-600">{agent.retryCount} retries</span>}
                                </div>
                            </div>
                            <div className="flex items-center gap-1">
                                {agent.successRate >= 0.8 ? (
                                    <TrendingUp size={14} className="text-green-500" />
                                ) : (
                                    <TrendingDown size={14} className="text-red-500" />
                                )}
                                <span className={`font-bold font-mono ${agent.successRate >= 0.8 ? 'text-green-700' : 'text-red-700'}`}>
                                    {Math.round(agent.successRate * 100)}%
                                </span>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Recommendations */}
                {agents.some(a => a.recommendations.length > 0) && (
                    <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-3 space-y-1">
                        <div className="text-xs font-semibold text-indigo-700">Adaptation Recommendations</div>
                        {agents.flatMap(a => a.recommendations.map((r, i) => (
                            <div key={`${a.agent}-${i}`} className="text-xs text-indigo-600 flex gap-2">
                                <span className="font-mono text-indigo-400">{a.agent}:</span>
                                <span>{r}</span>
                            </div>
                        )))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};
