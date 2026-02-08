
import { useState } from 'react';
import { approveTaskDeployment } from '@/lib/governance';

export interface RaciCardProps {
    taskId: string;
    taskTitle: string;
    responsibleAgent: string;
    accountableHumanId: string;
    accountableHumanName: string;
    currentUserId: string;
    atdiScore?: number;
    riskFactors?: string[];
}

export const useRaciCardLogic = (props: RaciCardProps) => {
    const { taskId, currentUserId, accountableHumanId, atdiScore = 0 } = props;

    const [justification, setJustification] = useState('');
    const [status, setStatus] = useState<'PENDING' | 'APPROVED' | 'BLOCKED'>('PENDING');
    const [isSigning, setIsSigning] = useState(false);

    const mockSupabase = { from: () => ({ insert: async () => ({ error: null }) }) };
    const isAccountable = currentUserId === accountableHumanId;

    // ATDI Risk Calculation
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

    return {
        justification,
        setJustification,
        status,
        setStatus,
        isSigning,
        isAccountable,
        isHighRisk,
        isMediumRisk,
        riskColor,
        riskLabel,
        handleApprove
    };
};
