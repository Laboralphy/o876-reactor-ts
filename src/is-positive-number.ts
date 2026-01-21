import { getType, TYPES } from './get-type';

export function isPositiveNumber(x: string | number) {
    const sType: TYPES = getType(x);
    if (sType === TYPES.STRING || sType === TYPES.NUMBER) {
        const y = +x;
        return !isNaN(y) && y >= 0;
    } else {
        return false;
    }
}
