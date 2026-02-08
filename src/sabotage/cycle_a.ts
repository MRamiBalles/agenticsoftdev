
import { b } from './cycle_b';

export const a = () => {
    console.log("A calls B");
    b();
};
