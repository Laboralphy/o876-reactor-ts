import { DependencyRegistry } from './DependencyRegistry';
import { Getter, GetterCollection, GetterFunction, GetterRegistry } from './Getter';
import { SYMBOL_BASE_OBJECT, SYMBOL_PROXY } from './symbols';
import { isPositiveNumber, isReactiveObject } from './functions';

/**
 * Effect function are used in the dependency collecting mechanism
 */
type EffectFunction = () => void;

class Effect {
    constructor(
        private readonly fn: EffectFunction,
        public readonly depreg: DependencyRegistry
    ) {}

    run() {
        this.fn();
    }
}

export class ReactiveStore<T extends object> {
    public readonly state: T;
    public getter: GetterRegistry = {};
    private readonly getterCollection: GetterCollection<T> = {};
    // When a getter is run, each time a state property is changed
    // all running effect are iterated, and dependencies are updated
    private readonly runningEffects: Effect[] = [];
    private readonly currentlyProxyfying = new WeakSet<object>();

    constructor(initialState: T) {
        this.state = this.proxifyObject(initialState);
    }

    getGetterData(getterName: string) {
        if (getterName in this.getterCollection) {
            return this.getterCollection[getterName];
        } else {
            throw new ReferenceError(`getter ${getterName} not found`);
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
        this.runningEffects.forEach((effect) => {
            effect.depreg.add(target, property);
        });
    }

    /**
     * When a property of a target is being changed, all dependant getters are to be invalidated.
     */
    trigger<X extends object>(target: X, property: string | symbol): void {
        for (const getter of Object.values(this.getterCollection)) {
            const depreg = getter.depreg;
            if (depreg.has(target, property)) {
                this.trigger(getter, 'value');
                getter.invalidate();
            }
        }
    }

    handlerGet<X extends object>(target: X, property: string | symbol, receiver: any): any {
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
        value: any,
        receiver: any
    ): boolean {
        let bNewProperty: boolean = false;
        let result: boolean;
        if (typeof value === 'object' && value !== null) {
            bNewProperty = !(property in target);
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

    handlerArrayGet<X extends any[]>(target: X, property: string | symbol, receiver: any): any {
        if (property === SYMBOL_PROXY) {
            return true;
        }
        if (typeof property === 'string' && property in Array.prototype) {
            const method = Array.prototype[property as keyof typeof Array.prototype];
            if (typeof method === 'function') {
                return (...args: any[]): any => {
                    const nPrevLength = target.length;
                    const result = method.apply(
                        target,
                        args.map((x) => this.proxifyObject(x))
                    );
                    const nNewLength = target.length;
                    this.track(target, SYMBOL_BASE_OBJECT);
                    if (nNewLength !== nPrevLength) {
                        this.trigger(target, SYMBOL_BASE_OBJECT);
                        this.trigger(target, 'length');
                    }
                    return result;
                };
            }
        }
        this.track(target, property);
        return Reflect.get(target, property, receiver);
    }

    handlerArraySet<X extends any[]>(
        target: X,
        property: string | symbol,
        value: any,
        receiver: any
    ): boolean {
        if (typeof property === 'string' && isPositiveNumber(property)) {
            // This is a numeric index
            value = this.proxifyObject(value);
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

    handlerArrayHas<X extends any[]>(target: X, property: string | symbol): boolean {
        const result = Reflect.has(target, property);
        this.track(target, property);
        return result;
    }

    handlerArrayOwnKeys<X extends any[]>(target: X): ArrayLike<string | symbol> {
        const result = Reflect.ownKeys(target);
        this.track(target, SYMBOL_BASE_OBJECT);
        return result;
    }

    handlerArrayDeleteProperty<X extends any[]>(target: X, property: string | symbol): boolean {
        const result = Reflect.deleteProperty(target, property);
        const nPrevLength = target.length;
        this.trigger(target, property);
        const nNewLength = target.length;
        if (nNewLength !== nPrevLength) {
            this.trigger(target, 'length');
        }
        return result;
    }

    /**
     * Turn a regular object into à reactive object unless it is already reactive
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
     * Creates an effect that push itself onto a stack
     * in order to keep track of what's currently running.
     */
    createEffect(fn: EffectFunction, depreg: DependencyRegistry) {
        const effect = new Effect(() => {
            this.runningEffects.push(effect);
            try {
                fn();
            } catch (e) {
                throw e;
            } finally {
                this.runningEffects.pop();
            }
        }, depreg);
        effect.run();
    }

    defineGetter<R>(name: string, getter: GetterFunction<T, R>) {
        this.getterCollection[name] = new Getter(getter);
        Object.defineProperty(this.getter, name, {
            get: (): R => {
                // Appelle `runGetter` quand la propriété est accédée
                return this.runGetter(name);
            },
            enumerable: true,
            configurable: true,
        });
    }

    runGetter<Key extends keyof GetterCollection<T>>(
        name: Key
    ): ReturnType<GetterCollection<T>[Key]['run']> {
        const getter = this.getterCollection[name];
        if (!getter) {
            throw new ReferenceError(`Getter ${name} not found`);
        }
        this.createEffect(() => {
            getter.run(this.state, this.getter);
        }, getter.depreg);
        return getter.value;
    }
}
