import { StateArray, StateObject, StateProperty } from './StateProperty';
import { getType } from './get-type';
import { DependencyRegistry } from './DependencyRegistry';

const SYMBOL_PROXY = Symbol('O876_REACTOR_PROXY');
const SYMBOL_DEPREG = Symbol('O876_REACTOR_DEPREG');
const SYMBOL_CACHE = Symbol('O876_REACTOR_CACHE');
const SYMBOL_INVALID = Symbol('O876_REACTOR_INVALID');
const SYMBOL_BASE_OBJECT = Symbol('O876_REACTOR_BASE_OBJECT');
const SYMBOL_ANTI_RECURSIVITY_TAG = Symbol('O876_REACTOR_ANTI_RECURSIVITY_TAG');

type Getter<T> = (state: T) => any;
type Getters<T> = Record<string, Getter<T>>;
type State<T> = T;
type EffectFunction = () => void;

interface EffectWithDepreg extends EffectFunction {
    [SYMBOL_DEPREG]: DependencyRegistry;
    [SYMBOL_CACHE]: StateProperty;
    [SYMBOL_INVALID]: boolean;
}

class Reactor000<T extends StateObject> {
    private readonly _runningEffects: EffectWithDepreg[] = [];
    private readonly _getters: Getters<T> = {};

    isReactive<T extends StateProperty>(target: T): boolean {
        return target !== null && target !== undefined && SYMBOL_PROXY in target;
    }

    getGetterData(sGetterName: string): {
        depreg: DependencyRegistry;
        cache: StateProperty;
        invalid: boolean;
    } {
        const getter = this._getters[sGetterName];
        if (!getter) {
            throw new ReferenceError(`Getters ${sGetterName} not found.`);
        }
        return {};
    }

    /**
     * a property has been accessed for reading : register this target/property
     * to all currently running getters.
     * @param target {object} an object whose property is being accessed
     * @param property {string} name of the property that is accessed
     */
    track(target: StateObject, property: string) {
        if (typeof target[property] === 'function') {
            return;
        }
        // all runningEffects receive target/prop
        for (const effect of this._runningEffects) {
            const d = effect[SYMBOL_DEPREG];
            d.add(target, property);
        }
    }

    /**
     * a property is being changed : all dependant getters
     * are to be invalidated
     * @param target {object} an object whose property is being modified
     * @param property {string} name of the property that is modified
     */
    trigger(target: StateObject, property: string) {
        // if no property specified, is getter dependent to target
        // invalidate cache for all getters having target/property
        const gd = this._getterData;
        this.iterate(this._getters, (g, name) => {
            const gns = gd[name];
            const depreg = gns._depreg;
            let bInvalidate = false;
            if (depreg.has(target, property)) {
                bInvalidate = true;
            }
            if (bInvalidate) {
                this.trigger(gns, '_cache');
                gns._invalidCache = true;
            }
        });
    }

    createArrayProxy<T extends StateArray>(target: T): T {
        if (this.isReactive(target)) {
            return target;
        }
        return new Proxy(target, {
            get(target, property: string | symbol, receiver) {
                if (property === SYMBOL_PROXY) {
                    return true;
                }
                if (typeof property === 'symbol') {
                    return Reflect.get(target, property, receiver);
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
        });
    }
}
