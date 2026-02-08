
import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Activity } from 'lucide-react';

interface HealthMonitorProps {
    atdiScore: number;
    history: { date: string; score: number }[];
}

export const HealthMonitor: React.FC<HealthMonitorProps> = ({ atdiScore, history }) => {
    const isHealthy = atdiScore < 5;
    const color = isHealthy ? "#22c55e" : (atdiScore < 15 ? "#eab308" : "#ef4444");

    return (
        <Card className="col-span-1 md:col-span-2">
            <CardHeader>
                <div className="flex bg items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Activity className={`h-5 w-5 ${isHealthy ? 'text-green-500' : 'text-red-500'}`} />
                            Architectural Health (ATDI)
                        </CardTitle>
                        <CardDescription>Technical Debt Trend Analysis</CardDescription>
                    </div>
                    <div className={`text-2xl font-bold font-mono px-3 py-1 rounded border`} style={{ borderColor: color, color: color, backgroundColor: `${color}10` }}>
                        {atdiScore.toFixed(1)}
                    </div>
                </div>
            </CardHeader>
            <CardContent>
                <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={history}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                            <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                            <YAxis />
                            <Tooltip />
                            <Area type="monotone" dataKey="score" stroke={color} fill={color} fillOpacity={0.2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
                <p className="text-xs text-muted-foreground mt-2 text-center">
                    {isHealthy
                        ? "Architecture is clean. Development velocity is optimal."
                        : "Debt accumulation detected. Schedule refactoring sprint."}
                </p>
            </CardContent>
        </Card>
    );
};
