import { DependencyRegistry } from './DependencyRegistry';

/**
 * This is the interface of definition of getters
 */
export interface IGetterDefinition<S extends object> {
    [name: string]: (state: S, getters: any) => any;
}

// /**
//  * A getter collection, collects all Getter instance
//  * This is useful to quickly recover data about any getter (cached value, dependency registry...)
//  */
// export interface GetterCollection<T extends object> {
//     [key: string]: Getter<T, any>;
// }

export type GetterCollection<S extends object> = {
    [K in keyof IGetterDefinition<S>]: Getter<S, ReturnType<IGetterDefinition<S>[K]>>;
};

/**
 * A getter registry is an object that holds the type of all final getters
 * In this object, getter are no longer function but real getter properties that triggers
 * a run function of one item of the getterCollection
 */
export interface GetterRegistry {
    [name: string]: any;
}

/**
 * This class will manage a Getter and all associated data,
 * Associated data is typically :
 * - value : the computed getter value
 * - invalid : the invalidity flag
 * - depreg : the dependency registry
 */
export class Getter<S extends object, R> {
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
    constructor(private readonly fn: (state: S, getters: GetterRegistry) => R) {}

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
    run(state: S, getters: GetterRegistry): R {
        if (this.invalid) {
            this._cache = this.fn(state, getters);
            this._invalid = false;
        }
        return this._cache;
    }
}
