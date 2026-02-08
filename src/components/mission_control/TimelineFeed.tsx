
import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { FileText, GitCommit } from 'lucide-react';

interface TimelineEvent {
    id: string;
    date: string;
    title: string;
    description: string;
    type: 'ADR' | 'DEPLOY';
    status?: string;
}

interface TimelineFeedProps {
    events: TimelineEvent[];
}

export const TimelineFeed: React.FC<TimelineFeedProps> = ({ events }) => {
    return (
        <Card className="col-span-1 h-full">
            <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                    <GitCommit size={18} /> Deep Memory
                </CardTitle>
            </CardHeader>
            <CardContent className="h-[400px] p-0">
                <ScrollArea className="h-full px-4">
                    <div className="space-y-4 pb-4">
                        {events.map((event, idx) => (
                            <div key={idx} className="flex gap-3 text-sm relative border-l-2 border-slate-200 pl-4 py-1 ml-2">
                                <div className="absolute -left-[5px] top-2 h-2 w-2 rounded-full bg-slate-400" />
                                <div className="flex-1 space-y-1">
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono text-xs text-muted-foreground">{event.date}</span>
                                        <Badge variant={event.type === 'ADR' ? 'outline' : 'secondary'} className="text-[10px] h-5">
                                            {event.type}
                                        </Badge>
                                    </div>
                                    <h4 className="font-medium leading-none">{event.title}</h4>
                                    <p className="text-xs text-muted-foreground line-clamp-2">
                                        {event.description}
                                    </p>
                                </div>
                            </div>
                        ))}
                        {events.length === 0 && <p className="text-center text-muted-foreground py-4">No memory recorded yet.</p>}
                    </div>
                </ScrollArea>
            </CardContent>
        </Card>
    );
};
