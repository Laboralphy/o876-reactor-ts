export class DependencyRegistry {
    private readonly _map = new Map<string | symbol, Set<object>>();
    private readonly _pairs: Array<[object, string | symbol]> = [];

    constructor() {}

    /**
     * Register a (target, property) dependency.
     * Returns true if the pair was newly added, false if it was already present.
     */
    add<T extends object>(target: T, property: string | symbol): boolean {
        let set = this._map.get(property);
        if (set?.has(target)) {
            return false;
        }
        if (!set) {
            set = new Set<object>();
            this._map.set(property, set);
        }
        set.add(target);
        this._pairs.push([target, property]);
        return true;
    }

    has<T extends object>(target: T, property: string | symbol): boolean {
        return this._map.get(property)?.has(target) ?? false;
    }

    /**
     * Returns all registered (target, property) pairs.
     * Used by the store to clean up the reverse index before resetting deps.
     */
    entries(): Array<[object, string | symbol]> {
        return this._pairs;
    }

    reset() {
        this._map.clear();
        this._pairs.length = 0;
    }

    keys() {
        return Array.from(this._map.keys());
    }
}
