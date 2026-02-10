import { DependencyRegistry } from './DependencyRegistry';
import { ReactiveStore } from './ReactiveStore';

// A getter is a function that computes a result out of the state
export type GetterFunction<T extends object, R> = (store: ReactiveStore<T>) => R;
export type GetterCollection<T extends object> = {
    [key: string]: Getter<T, any>;
};
export type GetterRegistry = Record<string, any>;

/**
 * This class will manage a Getter and all associated data,
 * Associated data is typically :
 * - value : the computed getter value
 * - invalid : the invalidity flag
 * - depreg : the dependency registry
 */
export class Getter<T extends object, R> {
    // The cached value ; valid until one of the getter dependencies changes
    private _cache: any = undefined;
    // Set to true when a dependency is change, and the value needs to be re-evaluated
    // set to false when getter value is re-evaluated
    private _invalid: boolean = true;
    // The dependency registry store all getter dependencies
    // a dependency is a tuple (target, property)
    // if a registered (target, property) changes its value, the invalidity flag is set to true
    private readonly _depreg = new DependencyRegistry();

    /**
     * The constructor accepts a function that is the getter computation code
     * @param fn
     */
    constructor(private readonly fn: (store: ReactiveStore<T, any>) => R) {}

    /**
     * Returns true is getter value is valid
     * Returns false is getter value is invalid because some dependencies has changed
     */
    get invalid() {
        return this._invalid;
    }

    /**
     * Makes the getter invalid, and forces it to discard cached value
     */
    invalidate() {
        this._invalid = true;
    }

    /**
     * The dependency registry instance
     */
    get depreg() {
        return this._depreg;
    }

    /**
     * The getter last computed value,
     * This value is either valid, or invalid; check this.invalid to know.
     */
    get value(): R {
        if (this._invalid) {
            throw new Error('Getter not computed yet or invalid.');
        }
        return this._cache as R;
    }

    /**
     * return the getter value, if valid.
     * else, recompute getter value before returning it
     */
    run(store: ReactiveStore<T>) {
        if (this.invalid) {
            this._cache = this.fn(store);
            this._invalid = false;
        }
        return this._cache;
    }
}
