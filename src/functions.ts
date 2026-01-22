// Type for potentially reactive objects
import { SYMBOL_PROXY } from './symbols';

interface ReactiveObject extends Record<typeof SYMBOL_PROXY, boolean> {
    [key: string]: any;
}

// Type guard to check if indice is a positive number
export function isPositiveNumber(x: string | number) {
    const y = +x;
    return !isNaN(y) && y >= 0;
}

// Type guard to check if object is reactive
export function isReactiveObject<T extends object>(target: T): target is T & ReactiveObject {
    return SYMBOL_PROXY in target;
}
