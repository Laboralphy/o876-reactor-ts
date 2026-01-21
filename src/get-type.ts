export enum TYPES {
    UNDEFINED,
    NULL,
    NUMBER,
    BOOLEAN,
    STRING,
    OBJECT,
    ARRAY,
}

/**
 * Returns target type
 * @param target value whose type is to be evaluated
 * @return target type
 */
export function getType(target: unknown): TYPES {
    const sType = typeof target;
    switch (sType.toLowerCase()) {
        case 'object': {
            if (target === null) {
                return TYPES.NULL;
            } else if (Array.isArray(target)) {
                return TYPES.ARRAY;
            } else {
                return TYPES.OBJECT;
            }
        }
        case 'number': {
            return TYPES.NUMBER;
        }
        case 'boolean': {
            return TYPES.BOOLEAN;
        }
        case 'undefined': {
            return TYPES.UNDEFINED;
        }
        case 'string': {
            return TYPES.STRING;
        }
        default: {
            throw new TypeError(`Unsupported type ${typeof target}`);
        }
    }
}
