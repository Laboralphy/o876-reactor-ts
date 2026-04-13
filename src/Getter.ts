import { DependencyRegistry } from './DependencyRegistry';

/**
 * Maps a getter definition object to its output record type.
 * Each key maps to the return type of the corresponding getter function.
 */
export type GetterOutput<G> = {
    [K in keyof G]: G[K] extends (...args: never[]) => infer R ? R : never;
};

/**
 * The constraint for a getter definition object.
 * Each getter is a function (state: S, getters: GetterOutput<G>) => unknown.
 * G is self-referential: it references itself through GetterOutput<G>.
 * TypeScript resolves this through constraint inference — each getter's return type
 * is derived from state alone, so the circular reference is never actually evaluated.
 */
export type GetterDefs<S extends object, G> = {
    [K in keyof G]: (state: S, getters: GetterOutput<G>) => unknown;
};

/**
 * A collection of Getter instances, one per key in G.
 */
export type GetterCollection<S extends object, G> = {
    [K in keyof G]: Getter<S, GetterOutput<G>[K], GetterOutput<G>>;
};

/**
 * This class will manage a Getter and all associated data,
 * Associated data is typically :
 * - value : the computed getter value
 * - invalid : the invalidity flag
 * - depreg : the dependency registry
 */
export class Getter<
    S extends object,
    R,
    GO extends Record<string, unknown> = Record<string, unknown>,
> {
    // The cached value ; valid until one of the getter dependencies changes
    private _cache: R | undefined = undefined;
    // Set to true when a dependency is changed, and the value needs to be re-evaluated
    // set to false when getter value is re-evaluated
    private _invalid: boolean = true;
    // The dependency registry stores all getter dependencies
    // a dependency is a tuple (target, property)
    // if a registered (target, property) changes its value, the invalidity flag is set to true
    private readonly _depreg = new DependencyRegistry();

    constructor(private readonly fn: (state: S, getters: GO) => R) {}

    get invalid(): boolean {
        return this._invalid;
    }

    invalidate(): void {
        this._invalid = true;
    }

    get depreg(): DependencyRegistry {
        return this._depreg;
    }

    get value(): R {
        if (this._invalid) {
            throw new Error('Getter not computed yet or invalid.');
        }
        return this._cache as R;
    }

    run(state: S, getters: GO): R {
        if (this.invalid) {
            this._cache = this.fn(state, getters);
            this._invalid = false;
        }
        return this._cache as R;
    }
}
