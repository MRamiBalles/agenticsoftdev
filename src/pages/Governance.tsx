
import React, { useEffect, useState } from 'react';
import { RaciCard } from '../components/governance/RaciCard';
import { RaciMatrixEntry } from '../types/governance';
import { ShieldAlert } from 'lucide-react';

export default function GovernanceDashboard() {
    const [tasks, setTasks] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Mock Data for "Dogfooding" Demo
    useEffect(() => {
        const mockTasks = [
            {
                id: '123e4567-e89b-12d3-a456-426614174000',
                task_id: 'FEAT-204: Governance Module UI',
                responsible_agent_id: 'Agent-Architect',
                role: 'RACI',
                accountable_user_id: 'user-123',
                atdiScore: 2, // Low Risk
                riskFactors: [],
                created_at: new Date().toISOString()
            },
            {
                id: '123e4567-e89b-12d3-a456-426614174001',
                task_id: 'INFRA-002: Monolith Refactor',
                responsible_agent_id: 'Chaos-Monkey-Agent',
                role: 'RACI',
                accountable_user_id: 'user-123',
                atdiScore: 25, // CRITICAL RISK
                riskFactors: ['Cyclic Dependency: auth.ts <-> user.ts', 'God Component: utils.ts (>500 LOC)'],
                created_at: new Date().toISOString()
            }
        ];

        setTimeout(() => {
            setTasks(mockTasks);
            setLoading(false);
        }, 1000);
    }, []);

    const currentUser = { id: 'user-123', name: 'Manu (Admin)' };

    return (
        <div className="container mx-auto py-10">
            <div className="flex items-center gap-3 mb-8">
                <ShieldAlert className="h-10 w-10 text-blue-600" />
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Governance & Gatekeeper</h1>
                    <p className="text-muted-foreground">ISO 42001 Compliance Dashboard. Humans must sign for all AI actions.</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loading ? (
                    <p>Loading pending approvals...</p>
                ) : (
                    tasks.map(task => (
                        <RaciCard
                            key={task.id}
                            taskId={task.id}
                            taskTitle={task.task_id}
                            responsibleAgent={task.responsible_agent_id || 'Unknown-AI'}
                            accountableHumanId={task.accountable_user_id}
                            accountableHumanName={currentUser.name}
                            currentUserId={currentUser.id}
                            atdiScore={task.atdiScore}
                            riskFactors={task.riskFactors}
                        />
                    ))
                )}
            </div>

            <div className="mt-12 p-6 bg-slate-50 border rounded-lg">
                <h3 className="text-lg font-semibold mb-2">Audit Log Preview (Immutable)</h3>
                <div className="font-mono text-xs text-slate-600 bg-white p-4 border rounded">
                    waiting for signatures...
                </div>
            </div>
        </div>
    );
}
