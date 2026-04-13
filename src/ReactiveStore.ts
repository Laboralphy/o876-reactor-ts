import { DependencyRegistry } from './DependencyRegistry';
import { Getter, GetterCollection, GetterDefs, GetterOutput } from './Getter';
import { SYMBOL_BASE_OBJECT, SYMBOL_PROXY } from './symbols';
import { isPositiveNumber, isReactiveObject } from './functions';

/**
 * Effect function are used in the dependency collecting mechanism
 */
type EffectFunction = () => void;

/**
 * Array methods that mutate contents in-place without necessarily changing length.
 * These must always trigger SYMBOL_BASE_OBJECT even when length is unchanged.
 */
const IN_PLACE_MUTATING_METHODS = new Set(['sort', 'reverse', 'fill', 'copyWithin']);

class Effect<S extends object, GO extends Record<string, unknown>> {
    constructor(
        private readonly fn: EffectFunction,
        public readonly depreg: DependencyRegistry,
        public readonly getter: Getter<S, unknown, GO>
    ) {}

    run() {
        this.fn();
    }
}

export class ReactiveStore<S extends object, G extends GetterDefs<S, G>> {
    public readonly state: S;
    private readonly getterCollection: GetterCollection<S, G> = {} as GetterCollection<S, G>;
    private readonly _getters: GetterOutput<G>;
    // When a getter is run, each time a state property is changed
    // all running effects are iterated, and dependencies are updated
    private readonly runningEffects: Effect<S, GetterOutput<G>>[] = [];
    private readonly currentlyProxyfying = new WeakSet<object>();
    // Reverse index: maps (target, property) → set of getters that depend on it.
    // Allows trigger() to find affected getters in O(k) instead of scanning all getters.
    private readonly reverseIndex = new WeakMap<
        object,
        Map<string | symbol, Set<Getter<S, unknown, GetterOutput<G>>>>
    >();

    constructor(initialState: S, getters: G) {
        this.state = this.proxifyObject(initialState);
        const registeredGetters = {} as GetterOutput<G>;
        for (const [n, g] of Object.entries(getters) as [
            keyof G & string,
            (state: S, getters: GetterOutput<G>) => unknown,
        ][]) {
            (
                this.getterCollection as Record<
                    keyof G & string,
                    Getter<S, unknown, GetterOutput<G>>
                >
            )[n] = new Getter<S, unknown, GetterOutput<G>>(g);
            Object.defineProperty(registeredGetters, n, {
                get: () => this.runGetter(n),
                enumerable: true,
                configurable: true,
            });
        }
        this._getters = registeredGetters;
    }

    get getters(): GetterOutput<G> {
        return this._getters;
    }

    /**
     * Returns a Getter instance, see Getter class for more information
     * @param getterName
     * @return Getter
     */
    getGetterData<K extends keyof G>(
        getterName: K
    ): Getter<S, GetterOutput<G>[K], GetterOutput<G>> {
        if (getterName in this.getterCollection) {
            return this.getterCollection[getterName];
        } else {
            throw new ReferenceError(`getter ${getterName.toString()} not found`);
        }
    }

    /**
     * This function is usually called by Proxy handler to notify that a (target, property) has been modified
     * This will cause all running effect to add (target, property) to their dependency registry
     * @param target
     * @param property
     * @private
     */
    track<X extends object>(target: X, property: string | symbol): void {
        if (
            typeof property === 'string' &&
            property !== 'length' &&
            ((property in Object.prototype && !Array.isArray(target)) ||
                (property in Array.prototype && Array.isArray(target)) ||
                (typeof target[property as keyof X] === 'function' &&
                    !Reflect.has(target, property)))
        ) {
            return;
        }
        for (const effect of this.runningEffects) {
            if (effect.depreg.add(target, property)) {
                this.addToReverseIndex(target, property, effect.getter);
            }
        }
    }

    /**
     * When a property of a target is being changed, all dependant getters are to be invalidated.
     * Uses the reverse index for O(k) lookup instead of scanning all getters.
     */
    trigger<X extends object>(target: X, property: string | symbol): void {
        const propMap = this.reverseIndex.get(target);
        if (!propMap) {
            return;
        }
        const getterSet = propMap.get(property);
        if (!getterSet || getterSet.size === 0) {
            return;
        }
        for (const getter of getterSet) {
            this.trigger(getter, 'value');
            getter.invalidate();
        }
    }

    private addToReverseIndex(
        target: object,
        property: string | symbol,
        getter: Getter<S, unknown, GetterOutput<G>>
    ): void {
        let propMap = this.reverseIndex.get(target);
        if (!propMap) {
            propMap = new Map();
            this.reverseIndex.set(target, propMap);
        }
        let getterSet = propMap.get(property);
        if (!getterSet) {
            getterSet = new Set();
            propMap.set(property, getterSet);
        }
        getterSet.add(getter);
    }

    private removeGetterFromReverseIndex(getter: Getter<S, unknown, GetterOutput<G>>): void {
        for (const [target, property] of getter.depreg.entries()) {
            this.reverseIndex.get(target)?.get(property)?.delete(getter);
        }
    }

    handlerGet<X extends object>(target: X, property: string | symbol, receiver: unknown): unknown {
        if (property === SYMBOL_PROXY) {
            return true;
        }
        const result = Reflect.get(target, property, receiver);
        this.track(target, property);
        return result;
    }

    handlerSet<X extends object>(
        target: X,
        property: string | symbol,
        value: unknown,
        receiver: unknown
    ): boolean {
        const bNewProperty = !(property in target);
        let result: boolean;
        if (typeof value === 'object' && value !== null) {
            result = Reflect.set(target, property, this.proxifyObject(value), receiver);
        } else {
            result = Reflect.set(target, property, value, receiver);
        }
        this.trigger(target, property);
        if (bNewProperty) {
            this.trigger(target, SYMBOL_BASE_OBJECT);
        }
        return result;
    }

    handlerHas<X extends object>(target: X, property: string | symbol): boolean {
        const result = Reflect.has(target, property);
        this.track(target, property);
        return result;
    }

    handlerOwnKeys<X extends object>(target: X): ArrayLike<string | symbol> {
        const result = Reflect.ownKeys(target);
        this.track(target, SYMBOL_BASE_OBJECT);
        return result;
    }

    handlerDeleteProperty<X extends object>(target: X, property: string | symbol): never {
        throw new Error(
            'Cannot delete key ' +
                property.toString() +
                '. Adding or deleting keys is forbidden in state. This is because getters cache is not invalidate by adding/removing properties'
        );
        // trigger(target, property)
        // return Reflect.deleteProperty(target, property)
    }

    handlerArrayGet<X extends unknown[]>(
        target: X,
        property: string | symbol,
        receiver: unknown
    ): unknown {
        if (property === SYMBOL_PROXY) {
            return true;
        }
        if (typeof property === 'string' && property in Array.prototype) {
            const method = Array.prototype[property as keyof typeof Array.prototype];
            if (typeof method === 'function') {
                return (...args: unknown[]): unknown => {
                    const nPrevLength = target.length;
                    const result = (method as (...a: unknown[]) => unknown).apply(
                        target,
                        args.map((x) =>
                            typeof x === 'object' && x !== null ? this.proxifyObject(x) : x
                        )
                    );
                    const nNewLength = target.length;
                    this.track(target, SYMBOL_BASE_OBJECT);
                    if (nNewLength !== nPrevLength || IN_PLACE_MUTATING_METHODS.has(property)) {
                        this.trigger(target, SYMBOL_BASE_OBJECT);
                    }
                    if (nNewLength !== nPrevLength) {
                        this.trigger(target, 'length');
                    }
                    return result;
                };
            }
        }
        this.track(target, property);
        // Reading an element by index or accessing the iterator means the getter cares
        // about the array's contents, so also depend on SYMBOL_BASE_OBJECT.
        // This ensures in-place mutations (sort, reverse, fill, copyWithin) that trigger
        // SYMBOL_BASE_OBJECT will properly invalidate such getters.
        if (
            property === Symbol.iterator ||
            (typeof property === 'string' && isPositiveNumber(property))
        ) {
            this.track(target, SYMBOL_BASE_OBJECT);
        }
        return Reflect.get(target, property, receiver);
    }

    handlerArraySet<X extends unknown[]>(
        target: X,
        property: string | symbol,
        value: unknown,
        receiver: unknown
    ): boolean {
        if (typeof property === 'string' && isPositiveNumber(property)) {
            // This is a numeric index
            value = typeof value === 'object' && value !== null ? this.proxifyObject(value) : value;
        }
        const nPrevLength = target.length;
        const result = Reflect.set(target, property, value, receiver);
        const nNewLength = target.length;
        if (Array.isArray(target)) {
            this.trigger(target, SYMBOL_BASE_OBJECT);
        }
        if (nNewLength !== nPrevLength) {
            this.trigger(target, 'length');
        }
        this.trigger(target, property);
        return result;
    }

    handlerArrayHas<X extends unknown[]>(target: X, property: string | symbol): boolean {
        const result = Reflect.has(target, property);
        this.track(target, property);
        return result;
    }

    handlerArrayOwnKeys<X extends unknown[]>(target: X): ArrayLike<string | symbol> {
        const result = Reflect.ownKeys(target);
        this.track(target, SYMBOL_BASE_OBJECT);
        return result;
    }

    handlerArrayDeleteProperty<X extends unknown[]>(target: X, property: string | symbol): boolean {
        const nPrevLength = target.length;
        const result = Reflect.deleteProperty(target, property);
        const nNewLength = target.length;
        this.trigger(target, property);
        this.trigger(target, SYMBOL_BASE_OBJECT);
        if (nNewLength !== nPrevLength) {
            this.trigger(target, 'length');
        }
        return result;
    }

    /**
     * Turn a regular object into a reactive object unless it is already reactive
     * @param oTarget
     * @returns {Proxy}
     */
    proxifyObject<X extends object>(oTarget: X): X {
        if (typeof oTarget !== 'object') {
            return oTarget;
        }
        if (this.currentlyProxyfying.has(oTarget)) {
            return oTarget;
        }
        if (Object.isFrozen(oTarget) || Object.isSealed(oTarget) || isReactiveObject(oTarget)) {
            return oTarget;
        }
        this.currentlyProxyfying.add(oTarget);
        Object.defineProperty(oTarget, SYMBOL_PROXY, {
            value: true,
            writable: false,
            configurable: false,
            enumerable: false,
        });
        if (Array.isArray(oTarget)) {
            for (let i = 0, l = oTarget.length; i < l; ++i) {
                const value = oTarget[i];
                if (typeof value === 'object' && value !== null) {
                    oTarget[i] = this.proxifyObject(value);
                }
            }
            this.currentlyProxyfying.delete(oTarget);
            return new Proxy(oTarget, {
                get: this.handlerArrayGet.bind(this),
                set: this.handlerArraySet.bind(this),
                has: this.handlerArrayHas.bind(this),
                ownKeys: this.handlerArrayOwnKeys.bind(this),
                deleteProperty: this.handlerArrayDeleteProperty.bind(this),
            });
        } else {
            Reflect.ownKeys(oTarget).forEach((key) => {
                const value = oTarget[key as keyof X];
                if (typeof value === 'object' && value !== null) {
                    // pure object
                    oTarget[key as keyof X] = this.proxifyObject(value);
                }
            });
            this.currentlyProxyfying.delete(oTarget);
            return new Proxy(oTarget, {
                get: this.handlerGet.bind(this),
                set: this.handlerSet.bind(this),
                has: this.handlerHas.bind(this),
                ownKeys: this.handlerOwnKeys.bind(this),
                deleteProperty: this.handlerDeleteProperty.bind(this),
            });
        }
    }

    /**
     * Creates an effect that pushes itself onto a stack
     * in order to keep track of what's currently running.
     */
    createEffect(
        fn: EffectFunction,
        depreg: DependencyRegistry,
        getter: Getter<S, unknown, GetterOutput<G>>
    ): void {
        const effect = new Effect<S, GetterOutput<G>>(
            () => {
                this.runningEffects.push(effect);
                try {
                    fn();
                } finally {
                    this.runningEffects.pop();
                }
            },
            depreg,
            getter
        );
        effect.run();
    }

    runGetter<K extends keyof G>(name: K): GetterOutput<G>[K] {
        const getter = this.getterCollection[name];
        if (!getter) {
            throw new ReferenceError(`Getter ${name.toString()} not found`);
        }
        if (!getter.invalid) {
            this.track(getter, 'value');
            return getter.value;
        }

        this.removeGetterFromReverseIndex(getter);
        getter.depreg.reset();
        this.createEffect(
            () => {
                getter.run(this.state, this._getters);
            },
            getter.depreg,
            getter
        );
        this.track(getter, 'value');
        return getter.value;
    }
}
