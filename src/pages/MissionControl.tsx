import * as React from 'react';
import { useState, useEffect } from 'react';
import { HealthMonitor } from '../components/mission_control/HealthMonitor';
import { TimelineFeed } from '../components/mission_control/TimelineFeed';
import { ConeWidget } from '../components/mission_control/ConeWidget';
import { DAGStatusPanel } from '../components/mission_control/DAGStatusPanel';
import { AgentPerformancePanel } from '../components/mission_control/AgentPerformancePanel';
import { HealingEventsPanel } from '../components/mission_control/HealingEventsPanel';
import { CheckpointPanel } from '../components/mission_control/CheckpointPanel';
import { RaciCard } from '../components/governance/RaciCard';
import { Satellite, Shield, LayoutDashboard, Brain, Users, Network, ShieldCheck, Cpu, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AgentReasoningTimeline } from "@/components/governance/AgentReasoningTimeline";
import { OrgDebtHeatmap } from "@/components/governance/OrgDebtHeatmap";
import { ArchitectureRadar } from "@/components/governance/ArchitectureRadar";
import { OperationsLog } from "@/components/ops/OperationsLog";
import { useOrchestratorTelemetry } from '@/hooks/useOrchestratorTelemetry';

// Mock Data Loaders (Simulating API calls)
import adrData from '../../.ai/knowledge_base/adr_summary.json';

export default function MissionControl() {
    const [atdiHistory, setAtdiHistory] = useState<{ date: string; score: number }[]>([]);
    const [timelineEvents, setTimelineEvents] = useState<any[]>([]);
    const [pendingTasks, setPendingTasks] = useState<any[]>([]);
    const [currentPhase, setCurrentPhase] = useState<'Specify' | 'Plan' | 'Task' | 'Implement'>('Implement');

    // Orchestrator telemetry (Phases 4.0–4.8)
    const telemetry = useOrchestratorTelemetry(42);

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

    const latestAtdi = atdiHistory.length > 0 ? atdiHistory[atdiHistory.length - 1].score : 0;

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

            <Tabs defaultValue="orchestrator" className="space-y-6">
                <TabsList>
                    <TabsTrigger value="orchestrator" className="flex items-center gap-2 text-indigo-700"><Cpu size={16} /> Orchestrator</TabsTrigger>
                    <TabsTrigger value="overview" className="flex items-center gap-2"><LayoutDashboard size={16} /> Mission Overview</TabsTrigger>
                    <TabsTrigger value="org" className="flex items-center gap-2"><Users size={16} /> Team & Friction</TabsTrigger>
                    <TabsTrigger value="arch" className="flex items-center gap-2"><Network size={16} /> Architecture Radar</TabsTrigger>
                    <TabsTrigger value="ops" className="flex items-center gap-2 text-blue-700"><ShieldCheck size={16} /> Live Ops</TabsTrigger>
                    <TabsTrigger value="audit" className="flex items-center gap-2"><Brain size={16} /> Forensic Audit</TabsTrigger>
                </TabsList>

                {/* ─── NEW: Orchestrator Tab (Phases 4.0–4.8) ─── */}
                <TabsContent value="orchestrator" className="space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <h2 className="text-xl font-semibold text-slate-800">Agentic OS v5.0 Kernel</h2>
                            <Badge variant={telemetry.isLive ? 'default' : 'secondary'} className="text-[10px]">
                                {telemetry.isLive ? '● LIVE' : '○ SIMULATED'}
                            </Badge>
                        </div>
                        <Button variant="outline" size="sm" onClick={telemetry.refresh} className="flex items-center gap-1.5">
                            <RefreshCw size={14} /> Refresh
                        </Button>
                    </div>

                    {/* Row 1: DAG + Agent Performance */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <DAGStatusPanel execution={telemetry.dagExecution} />
                        <AgentPerformancePanel agents={telemetry.agentStats} />
                    </div>

                    {/* Row 2: Healing + Checkpoints */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <HealingEventsPanel
                            events={telemetry.healingEvents}
                            totalDetected={telemetry.healingSummary.detected}
                            totalHealed={telemetry.healingSummary.healed}
                            totalEscalated={telemetry.healingSummary.escalated}
                        />
                        <CheckpointPanel
                            checkpoints={telemetry.checkpoints}
                            autoInterval={telemetry.checkpointPolicy.autoInterval}
                            maxCheckpoints={telemetry.checkpointPolicy.maxCheckpoints}
                        />
                    </div>
                </TabsContent>

                <TabsContent value="overview" className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        <div className="lg:col-span-3">
                            <HealthMonitor atdiScore={latestAtdi} history={atdiHistory} />
                        </div>
                        <div>
                            <ConeWidget phase={currentPhase} uncertaintyFactor={currentPhase === 'Specify' ? 4.0 : currentPhase === 'Plan' ? 2.0 : currentPhase === 'Task' ? 1.5 : 1.0} />
                        </div>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2">
                            <TimelineFeed events={timelineEvents} />
                        </div>
                        <div>
                            {pendingTasks[0] && (
                                <RaciCard
                                    taskId={pendingTasks[0].id}
                                    taskTitle={pendingTasks[0].task_id}
                                    responsibleAgent={pendingTasks[0].responsible_agent_id}
                                    accountableHumanId={pendingTasks[0].accountable_user_id}
                                    accountableHumanName="Commander"
                                    currentUserId="user-123"
                                    atdiScore={pendingTasks[0].atdiScore}
                                    riskFactors={pendingTasks[0].riskFactors}
                                />
                            )}
                        </div>
                    </div>
                </TabsContent>

                <TabsContent value="org">
                    <div className="h-[600px] bg-white p-4 rounded-lg border shadow-sm">
                        <OrgDebtHeatmap />
                    </div>
                </TabsContent>

                <TabsContent value="arch">
                    <div className="h-[600px] bg-white p-4 rounded-lg border shadow-sm">
                        <ArchitectureRadar />
                    </div>
                </TabsContent>

                <TabsContent value="ops">
                    <div className="h-[800px]">
                        <OperationsLog />
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
