
import React, { useState, useEffect } from 'react';
import { HealthMonitor } from '../components/mission_control/HealthMonitor';
import { TimelineFeed } from '../components/mission_control/TimelineFeed';
import { ConeWidget } from '../components/mission_control/ConeWidget';
import { RaciCard } from '../components/governance/RaciCard';
import { Satellite, Shield, LayoutDashboard, Brain } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentReasoningTimeline } from "@/components/governance/AgentReasoningTimeline";

// Mock Data Loaders (Simulating API calls)
import adrData from '../../.ai/knowledge_base/adr_summary.json';

export default function MissionControl() {
    const [atdiHistory, setAtdiHistory] = useState<{ date: string; score: number }[]>([]);
    const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
    const [pendingTasks, setPendingTasks] = useState<any[]>([]);
    const [currentPhase, setCurrentPhase] = useState<'Specify' | 'Plan' | 'Task' | 'Implement'>('Implement');

    useEffect(() => {
        // 1. Load ATDI History (Mock)
        setAtdiHistory([
            { date: '2026-02-01', score: 0 },
            { date: '2026-02-02', score: 0 },
            { date: '2026-02-04', score: 0 },
            { date: '2026-02-06', score: 5 }, // Simulation
            { date: '2026-02-08', score: 20 }, // Sabotage Test!
            { date: '2026-02-08', score: 0 },  // Clean
        ]);

        // 2. Load Timeline Events (ADRs + Mock Deploys)
        const adrs = (adrData as any[]).map(adr => ({
            id: adr.id,
            date: adr.date,
            title: `${adr.id}: ${adr.title}`,
            description: adr.decision,
            type: 'ADR'
        }));

        const deploys = [
            { id: 'dep-1', date: '2026-02-08', title: 'v1.0 Initial Release', description: 'Deployment of Sovereign SDLC Platform', type: 'DEPLOY' }
        ];

        setTimelineEvents([...adrs, ...deploys].sort((a, b) => b.date.localeCompare(a.date)));

        // 3. Load Pending Governance Tasks (Mock)
        setPendingTasks([
            {
                id: 'task-101',
                task_id: 'FEAT-305: Self-Healing Agent',
                responsible_agent_id: 'Agent-SRE',
                accountable_user_id: 'user-123',
                atdiScore: 0,
                riskFactors: []
            }
        ]);

    }, []);

    import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
    import { AgentReasoningTimeline } from "@/components/governance/AgentReasoningTimeline";

    // ... inside component ...

    return (
        <div className="container mx-auto py-6 space-y-8 bg-slate-50 min-h-screen">

            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Satellite className="h-8 w-8 text-blue-600 animate-pulse" />
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Mission Control</h1>
                        <p className="text-slate-500">Sovereign SDLC Command Center</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setCurrentPhase('Specify')}>Specify</Button>
                    <Button variant="outline" size="sm" onClick={() => setCurrentPhase('Plan')}>Plan</Button>
                    <Button variant="default" size="sm">Implement (Active)</Button>
                </div>
            </div>

            <Tabs defaultValue="overview" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="overview" className="flex items-center gap-2"><LayoutDashboard size={16} /> Mission Overview</TabsTrigger>
                    <TabsTrigger value="audit" className="flex items-center gap-2"><Brain size={16} /> Forensic Audit (Black Box)</TabsTrigger>
                </TabsList>

                <TabsContent value="overview" className="space-y-6">
                    {/* Main Grid: Overview */}
                    <div className="grid grid-cols-12 gap-6">
                        {/* Left Column: Metrics & Memory (8 cols) */}
                        <div className="col-span-12 lg:col-span-8 space-y-6">
                            {/* Top Row: Cone & Health */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="col-span-1">
                                    <ConeWidget phase={currentPhase} uncertaintyFactor={currentPhase === 'Specify' ? 4.0 : 1.0} />
                                </div>
                                <div className="col-span-2">
                                    <HealthMonitor atdiScore={atdiHistory[atdiHistory.length - 1]?.score || 0} history={atdiHistory} />
                                </div>
                            </div>

                            {/* Governance Panel (Moral Crumple Zone) */}
                            <div className="bg-white p-6 rounded-lg border shadow-sm">
                                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                                    <Shield size={20} className="text-blue-600" />
                                    Active Governance (Pending Signatures)
                                </h3>
                                <div className="flex flex-wrap gap-6">
                                    {pendingTasks.map(task => (
                                        <RaciCard
                                            key={task.id}
                                            taskId={task.id}
                                            taskTitle={task.task_id}
                                            responsibleAgent={task.responsible_agent_id}
                                            accountableHumanId={task.accountable_user_id}
                                            accountableHumanName="Manu (Admin)"
                                            currentUserId="user-123"
                                            atdiScore={task.atdiScore}
                                            riskFactors={task.riskFactors}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Right Column: Timeline (4 cols) */}
                        <div className="col-span-12 lg:col-span-4">
                            <TimelineFeed events={timelineEvents} />
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="audit">
                    <div className="h-[800px]">
                        <AgentReasoningTimeline />
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    );
}
