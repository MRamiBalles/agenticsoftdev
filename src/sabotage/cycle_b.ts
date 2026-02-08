
import { a } from './cycle_a';

export const b = () => {
    console.log("B calls A");
    a();
};
