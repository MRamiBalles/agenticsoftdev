
import { functionA } from './bad_module_a';

export const functionB = () => {
    console.log("I am B calling A");
    functionA();
}
