
import { functionB } from './bad_module_b';

export const functionA = () => {
    console.log("I am A calling B");
    functionB();
}
