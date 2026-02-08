
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, ShieldAlert, User, Bot, Activity } from 'lucide-react';
import { approveTaskDeployment } from '@/lib/governance';

interface RaciCardProps {
    taskId: string;
    taskTitle: string;
    responsibleAgent: string;
    accountableHumanId: string;
    accountableHumanName: string;
    currentUserId: string;
    // New Prop for ATDI
    atdiScore?: number; // Optional until backend is fully connected
    riskFactors?: string[];
}

export const RaciCard: React.FC<RaciCardProps> = ({
    taskId, taskTitle, responsibleAgent, accountableHumanId, accountableHumanName, currentUserId,
    atdiScore = 0, riskFactors = []
}) => {
    const [justification, setJustification] = useState('');
    const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'BLOCKED'>('PENDING');
    const [isSigning, setIsSigning] = useState(false);

    const mockSupabase = { from: () => ({ insert: async () => ({ error: null }) }) };
    const isAccountable = currentUserId === accountableHumanId;

    // ATDI Logic
    const isHighRisk = atdiScore >= 15;
    const isMediumRisk = atdiScore >= 5 && atdiScore < 15;

    let riskColor = "bg-green-100 text-green-800 border-green-200";
    let riskLabel = "Low Risk";

    if (isHighRisk) {
        riskColor = "bg-red-100 text-red-800 border-red-200";
        riskLabel = "CRITICAL RISK";
    } else if (isMediumRisk) {
        riskColor = "bg-yellow-100 text-yellow-800 border-yellow-200";
        riskLabel = "Medium Risk";
    }

    const handleApprove = async () => {
        if (!justification) return;
        setIsSigning(true);
        // Simulate API call
        const result = await approveTaskDeployment(mockSupabase, taskId, currentUserId, justification);
        if (result.success) setStatus('APPROVED');
        setIsSigning(false);
    };

    return (
        <Card className={`w-[450px] shadow-lg border-l-4 ${isHighRisk ? 'border-l-red-500' : 'border-l-yellow-500'}`}>
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Governance Gatekeeper</CardTitle>
                    <div className={`px-2 py-1 rounded-full text-xs font-bold border ${riskColor} flex items-center gap-1`}>
                        <Activity size={12} />
                        ATDI: {atdiScore} ({riskLabel})
                    </div>
                </div>
                <CardDescription>ISO 42001 Accountability Check</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

                {/* Security Threats Section (The Shield) */}
                {riskFactors.some(r => r.includes("SECRET") || r.includes("VULNERABILITY") || r.includes("CRITICAL")) && (
                    <div className="bg-red-100 p-3 rounded border border-red-300 text-sm animate-pulse">
                        <p className="font-bold text-red-900 flex items-center gap-2">
                            <ShieldAlert size={16} /> SECURITY THREAT DETECTED
                        </p>
                        <ul className="list-disc list-inside mt-1 text-red-800 text-xs font-mono">
                            {riskFactors.filter(r => r.includes("SECRET") || r.includes("VULNERABILITY")).map((r, i) => (
                                <li key={i}>{r}</li>
                            ))}
                        </ul>
                    </div>
                )}

                {/* Risk Report Section */}
                {(isHighRisk || isMediumRisk) && (
                    <div className="bg-amber-50 p-3 rounded border border-amber-100 text-sm">
                        <p className="font-semibold text-amber-800 flex items-center gap-2">
                            <Activity size={16} /> Architectural Smells Detected:
                        </p>
                        <ul className="list-disc list-inside mt-1 text-amber-700 text-xs">
                            {riskFactors.filter(r => !r.includes("SECRET") && !r.includes("VULNERABILITY")).length > 0 ?
                                riskFactors.filter(r => !r.includes("SECRET") && !r.includes("VULNERABILITY")).map((r, i) => (
                                    <li key={i}>{r}</li>
                                )) : <li>Complexity overhead.</li>}
                        </ul>
                    </div>
                )}

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col space-y-1 p-3 bg-slate-50 rounded-md border">
                        <span className="text-muted-foreground flex items-center gap-1"><Bot size={14} /> Responsible (Amount)</span>
                        <span className="font-mono font-bold text-blue-600">{responsibleAgent}</span>
                    </div>
                    <div className="flex flex-col space-y-1 p-3 bg-slate-50 rounded-md border">
                        <span className="text-muted-foreground flex items-center gap-1"><User size={14} /> Accountable (Human)</span>
                        <span className={`font-mono font-bold ${isAccountable ? 'text-green-700' : 'text-gray-700'}`}>
                            {accountableHumanName} {isAccountable && "(You)"}
                        </span>
                    </div>
                </div>

                <div className="pt-2">
                    <h4 className="text-sm font-medium mb-2">Task: {taskTitle}</h4>

                    {status === 'PENDING' ? (
                        <>
                            {isAccountable ? (
                                <div className="space-y-3">
                                    <div className="bg-yellow-50 p-3 rounded text-xs text-yellow-800 flex gap-2">
                                        <AlertTriangle size={16} className="shrink-0" />
                                        <p>By signing, you accept full legal responsibility for this deployment under ISO 42001.</p>
                                    </div>
                                    <Textarea
                                        placeholder={isHighRisk ? "MANDATORY: Explain why you are overriding the Architect Agent..." : "Mandatory Justification (Why is this safe?)"}
                                        value={justification}
                                        onChange={(e) => setJustification(e.target.value)}
                                        className={`text-sm ${isHighRisk ? 'border-red-300 focus:ring-red-500' : ''}`}
                                    />
                                </div>
                            ) : (
                                <div className="bg-gray-100 p-4 rounded text-center text-sm text-gray-500">
                                    Waiting for the Accountable Person to sign.
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="bg-green-50 p-4 rounded border border-green-200 flex items-center gap-3 text-green-800">
                            <CheckCircle size={24} />
                            <div>
                                <p className="font-bold text-sm">Cryptographically Signed</p>
                                <p className="text-xs opacity-80">Hash: sha256:e3b0c442...</p>
                            </div>
                        </div>
                    )}
                </div>

            </CardContent>
            <CardFooter className="justify-end gap-2">
                {status === 'PENDING' && isAccountable && (
                    <>
                        <Button variant="ghost" onClick={() => setStatus('BLOCKED')}>Reject</Button>
                        <Button
                            className={`${isHighRisk ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'} text-white transition-colors`}
                            disabled={justification.length < (isHighRisk ? 50 : 10) || isSigning} // Harder to approve high risk
                            onClick={handleApprove}
                        >
                            {isSigning ? "Signing..." : isHighRisk ? "Override & Sign (High Risk)" : "Cryptographic Sign & Approve"}
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
};
