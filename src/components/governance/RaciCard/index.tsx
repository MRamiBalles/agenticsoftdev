
import React from 'react';
import { useRaciCardLogic, RaciCardProps } from './logic';
import { RaciCardLayout } from './layout';

export const RaciCard: React.FC<RaciCardProps> = (props) => {
    const logic = useRaciCardLogic(props);
    return <RaciCardLayout logic={logic} {...props} />;
};
