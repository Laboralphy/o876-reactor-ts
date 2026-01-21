import { SYMBOL_BASE_OBJECT, SYMBOL_PROXY } from './symbols';
import { StateArray, StateObject } from './StateProperty';

enum ReactorTypes {
    UNDEFINED,
    NULL,
    NUMBER,
    BOOLEAN,
    STRING,
    OBJECT,
    ARRAY,
}

// ProxyHandler

export class Reactor {
    private readonly _arrayProxyHandler: ProxyHandler<StateArray>;


    constructor() {
        this._arrayProxyHandler = {
            get(target: StateArray , property: number | Symbol, receiver) {
                if (property === SYMBOL_PROXY) {
                    return true;
                }
                const result = Reflect.get(target, property, receiver);
                if (typeof target[property] === 'function') {
                    track(target, SYMBOL_BASE_OBJECT);
                }
                if (property === 'length' || isPositiveNumber(property)) {
                    track(target, property);
                }
                return result;
            },
            set(target, property, value, receiver) {
                const bIndex = isPositiveNumber(property);
                if (bIndex) {
                    const nIndex = +property;
                    const nPrevLength = target.length;
                    const result = Reflect.set(target, nIndex, proxify(value), receiver);
                    const nNewLength = target.length;
                    trigger(target, property);
                    if (nNewLength !== nPrevLength) {
                        trigger(target, 'length');
                    }
                    return result;
                } else if (property === 'length') {
                    const result = Reflect.set(target, property, proxify(value), receiver);
                    trigger(target, property);
                    return result;
                }
            },
            has(target, property) {
                const result = Reflect.has(target, property);
                track(target, property);
                return result;
            },
            ownKeys(target) {
                const result = Reflect.ownKeys(target);
                track(target, SYMBOL_BASE_OBJECT);
                return result;
            },
            deleteProperty(target, property) {
                const result = Reflect.deleteProperty(target, property);
                const nPrevLength = target.length;
                trigger(target, property);
                const nNewLength = target.length;
                if (nNewLength !== nPrevLength) {
                    trigger(target, 'length');
                }
                return result;
            }
        }

        /**
         * Returns target type
         * @param target value whose type is to be evaluated
         * @return target type
         */
        getType(target: unknown): ReactorTypes {
            const sType = typeof target;
            switch (sType.toLowerCase()) {
                case 'object': {
                    if (target === null) {
                        return ReactorTypes.NULL;
                    } else if (Array.isArray(target)) {
                        return ReactorTypes.ARRAY;
                    } else {
                        return ReactorTypes.OBJECT;
                    }
                }
                case 'number': {
                    return ReactorTypes.NUMBER;
                }
                case 'boolean': {
                    return ReactorTypes.BOOLEAN;
                }
                case 'undefined': {
                    return ReactorTypes.UNDEFINED;
                }
                case 'string': {
                    return ReactorTypes.STRING;
                }
                default: {
                    throw new TypeError(`Unsupported type ${typeof target}`);
                }
            }
        }

        /**
         * Installs a proxy on an object to make it reactive
         * @param target {object|[]}
         */
        proxify(target: unknown) {
            switch (this.getType(target)) {
                case ReactorTypes.ARRAY:
                case ReactorTypes.OBJECT: {
                    return this.proxifyObject(target);
                }

                default:
                    return target;
            }
        }

        /**
         * Turn an object into à reactive object
         * @param oTarget
         * @returns {Proxy}
         */
        proxifyObject<T extends StateObject | StateArray>(oTarget: T): T {
            if (Object.isFrozen(oTarget) || Object.isSealed(oTarget) || this.isReactive(oTarget)) {
                return oTarget;
            }
            const bArray = Array.isArray(oTarget);
            Object.defineProperty(oTarget, SYMBOL_PROXY, {
                value: true,
                writable: false,
                configurable: false,
                enumerable: false,
            });
            if (bArray) {
                const aClone = oTarget.map((e) => this.proxify(e));
                return this.createArrayProxy(aClone);
            } else {
                const oClone = {};
                Reflect.ownKeys(oTarget).forEach((key) => {
                    if (typeof key === 'symbol') {
                        if (key !== SYMBOL_PROXY) {
                            oClone[key] = oTarget[key];
                        }
                    } else {
                        oClone[key] = this.proxify(oTarget[key]);
                    }
                });
                return this.createProxy(oClone);
            }
        }

        isReactive(oTarget: any): boolean {
            const targetType = this.getType(oTarget);
            if (targetType === ReactorTypes.UNDEFINED || targetType === ReactorTypes.NULL) {
                return true;
            }
            if (targetType === ReactorTypes.OBJECT) {
                return !!oTarget[SYMBOL_PROXY];
            }
            return false;
        }

        createArrayProxy(aTarget: StateArray): StateArray {
            if (this.isReactive(aTarget)) {
                return aTarget;
            }
            return new Proxy(aTarget, this._handlerArray);
        }
    }
