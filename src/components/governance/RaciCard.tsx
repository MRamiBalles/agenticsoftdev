
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AlertTriangle, CheckCircle, ShieldAlert, User, Bot } from 'lucide-react';
import { approveTaskDeployment } from '@/lib/governance';
// import { useSupabaseClient, useUser } from '@supabase/auth-helpers-react'; // Mocking for now as dependencies might vary

interface RaciCardProps {
    taskId: string;
    taskTitle: string;
    responsibleAgent: string;
    accountableHumanId: string; // ID of the human
    accountableHumanName: string; // Display name
    currentUserId: string; // The user viewing the card
}

export const RaciCard: React.FC<RaciCardProps> = ({
    taskId, taskTitle, responsibleAgent, accountableHumanId, accountableHumanName, currentUserId
}) => {
    const [justification, setJustification] = useState('');
    const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'BLOCKED'>('PENDING');
    const [isSigning, setIsSigning] = useState(false);

    // Mock Supabase client for the UI component interaction
    const mockSupabase = { from: () => ({ insert: async () => ({ error: null }) }) };

    const isAccountable = currentUserId === accountableHumanId;

    const handleApprove = async () => {
        if (!justification) return;
        setIsSigning(true);

        // Simulate API call
        const result = await approveTaskDeployment(mockSupabase, taskId, currentUserId, justification);

        if (result.success) {
            setStatus('APPROVED');
        }
        setIsSigning(false);
    };

    return (
        <Card className="w-[450px] border-l-4 border-l-yellow-500 shadow-lg">
            <CardHeader>
                <div className="flex justify-between items-center">
                    <CardTitle className="text-lg">Governance Gatekeeper</CardTitle>
                    {status === 'PENDING' && <Badge variant="outline" className="text-yellow-600 border-yellow-500 bg-yellow-50">Wait for Sign</Badge>}
                    {status === 'APPROVED' && <Badge className="bg-green-600">Approved</Badge>}
                </div>
                <CardDescription>ISO 42001 Accountability Check</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">

                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="flex flex-col space-y-1 p-3 bg-slate-50 rounded-md border">
                        <span className="text-muted-foreground flex items-center gap-1"><Bot size={14} /> Responsible (Agent)</span>
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
                                        placeholder="Mandatory Justification (Why is this safe?)"
                                        value={justification}
                                        onChange={(e) => setJustification(e.target.value)}
                                        className="text-sm"
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
                            className="bg-green-600 hover:bg-green-700 text-white"
                            disabled={justification.length < 10 || isSigning}
                            onClick={handleApprove}
                        >
                            {isSigning ? "Signing..." : "Cryptographic Sign & Approve"}
                        </Button>
                    </>
                )}
            </CardFooter>
        </Card>
    );
};
