
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Activity, Shuffle, AlertOctagon } from 'lucide-react';
import ORG_DATA from '@/data/org_debt_report.json';

interface OrgDebtFile {
    path: string;
    authors: string[];
    commit_count: number;
    social_complexity: number;
    friction_score: number;
    risk_level: 'LOW' | 'MEDIUM' | 'HIGH';
}

export const OrgDebtHeatmap: React.FC = () => {
    // In strict mode, we'd fetch. For demo, import JSON directly or fallback.
    const [hotspots, setHotspots] = useState<OrgDebtFile[]>([]);

    useEffect(() => {
        // Load data if available
        if ((ORG_DATA as any).files) {
            setHotspots((ORG_DATA as any).files);
        }
    }, []);

    if (hotspots.length === 0) {
        return (
            <Card className="h-full bg-slate-50 border-dashed">
                <div className="flex flex-col items-center justify-center h-full text-slate-400 p-6">
                    <Activity className="mb-2 h-8 w-8 opacity-50" />
                    <p>No Organizational Debt data found.</p>
                    <p className="text-xs">Run 'npm run analyze:debt'</p>
                </div>
            </Card>
        );
    }

    return (
        <Card className="h-full flex flex-col shadow-sm border-l-4 border-l-purple-500">
            <CardHeader className="pb-3 border-b bg-slate-50">
                <CardTitle className="text-lg flex items-center gap-2">
                    <Users className="h-5 w-5 text-purple-600" />
                    Organizational Debt Radar
                </CardTitle>
                <CardDescription>
                    Inverse Conway's Law: High Coordination Cost Files
                </CardDescription>
            </CardHeader>
            <CardContent className="p-0 flex-1 overflow-hidden">
                <ScrollArea className="h-[300px] p-4">
                    <div className="space-y-4">
                        {hotspots.map((file, idx) => (
                            <div key={idx} className="flex items-center justify-between p-3 bg-white border rounded-md shadow-sm group hover:border-purple-200 transition-colors">
                                <div className="flex-1 min-w-0 pr-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Badge variant={file.risk_level === 'HIGH' ? 'destructive' : 'secondary'} className="text-[10px] px-1 h-4">
                                            {file.risk_level}
                                        </Badge>
                                        <span className="font-mono text-xs font-medium truncate text-slate-700" title={file.path}>
                                            {file.path.split('/').pop()}
                                        </span>
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate mb-2" title={file.path}>
                                        {file.path}
                                    </div>

                                    {/* Metrics Bar */}
                                    <div className="flex items-center gap-4 text-[10px] text-slate-600">
                                        <div className="flex items-center gap-1" title="Unique Authors">
                                            <Users size={12} className="text-blue-400" />
                                            {file.authors.length}
                                        </div>
                                        <div className="flex items-center gap-1" title="Commits">
                                            <Activity size={12} className="text-slate-400" />
                                            {file.commit_count}
                                        </div>
                                        {file.friction_score > 0.3 && (
                                            <div className="flex items-center gap-1 text-amber-600 font-bold" title="Human-AI Friction (Swaps)">
                                                <Shuffle size={12} />
                                                {(file.friction_score * 100).toFixed(0)}% Friction
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="text-xl font-bold text-slate-900">{file.social_complexity.toFixed(1)}</div>
                                    <div className="text-[10px] text-slate-400 uppercase">Score</div>
                                </div>
                            </div>
                        ))}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
