
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Target } from 'lucide-react';

interface ConeWidgetProps {
    phase: 'Specify' | 'Plan' | 'Task' | 'Implement';
    uncertaintyFactor: number; // e.g., 4.0, 2.0, 1.0
}

export const ConeWidget: React.FC<ConeWidgetProps> = ({ phase, uncertaintyFactor }) => {
    const phases = ['Specify', 'Plan', 'Task', 'Implement'];
    const currentIndex = phases.indexOf(phase);
    const progress = ((currentIndex + 1) / 4) * 100;

    return (
        <Card>
            <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex justify-between">
                    <span>Cone of Uncertainty</span>
                    <Target size={16} />
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="text-2xl font-bold mb-1">
                    {uncertaintyFactor}x <span className="text-sm font-normal text-muted-foreground">Variance</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                    <div
                        className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${progress}%` }}
                    ></div>
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground font-mono">
                    {phases.map((p, i) => (
                        <span key={p} className={i === currentIndex ? "font-bold text-blue-700" : ""}>{p}</span>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};
