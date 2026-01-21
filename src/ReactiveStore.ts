import { DependencyRegistry } from './DependencyRegistry';

type Listener<T> = (state: T) => void;

// A getter is a function that computes a result out of the state
type GetterFunction<T, R> = (state: T, getters: GetterCollection<T>) => R;
type GetterCollection<T> = {
    [key: string]: Getter<T, any>;
};

// Type for potentially reactive objects
interface ReactiveObject extends Record<typeof SYMBOL_PROXY, boolean> {
    [key: string]: any;
}

// Type guard to check if object is reactive
function isReactiveObject<T extends object>(target: T): target is T & ReactiveObject {
    return SYMBOL_PROXY in target;
}

class Getter<T, R> {
    private _cache: any = undefined;
    private _invalid: boolean = true;
    private readonly _depreg = new DependencyRegistry();

    constructor(private readonly fn: GetterFunction<T, R>) {}

    get invalid() {
        return this._invalid;
    }

    get depreg() {
        return this._depreg;
    }

    get value(): R {
        if (this._invalid) {
            throw new Error('Getter not computed yet or invalid.');
        }
        return this._cache as R;
    }

    run(state: T, getters: GetterCollection<T>) {
        if (this.invalid) {
            this._cache = this.fn(state, getters);
            this._invalid = false;
        }
        return this._cache;
    }
}

type EffectFunction = () => void;

class Effect {
    constructor(
        private readonly fn: EffectFunction,
        private readonly depreg: DependencyRegistry
    ) {}

    run() {
        this.fn();
    }
}

// Where all data go
type State<T> = T;

export class ReactiveStore<T extends object, K extends string> {
    public readonly state: T;
    private listeners: Set<Listener<T>> = new Set();
    private readonly getters: GetterCollection<T> = {};
    private readonly runningEffects: Effect[] = [];

    constructor(initialState: T) {
        this.state = initialState;
    }

    proxifyValue<X>(t: X): X {
        if (typeof t === 'object' && t !== null) {
            return this.proxifyObject(t);
        } else {
            return t;
        }
    }

    isReactive<X extends object>(target: X): boolean {
        return !!target[SYMBOL_PROXY];
    }

    /**
     * Turn an object into à reactive object
     * @param oTarget
     * @returns {Proxy}
     */
    proxifyObject<X extends object>(oTarget: X): X {
        if (Object.isFrozen(oTarget) || Object.isSealed(oTarget) || isReactiveObject(oTarget)) {
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
            return new Proxy(oTarget.map((e) => this.proxifyValue(e)));
        } else {
            const oClone = {};
            Reflect.ownKeys(oTarget).forEach((key) => {
                if (typeof key === 'symbol') {
                    if (key !== SYMBOL_PROXY) {
                        oClone[key] = oTarget[key];
                    }
                } else {
                    const t = oTarget[key];
                    oClone[key] =
                        t !== undefined && t !== null && typeof t === 'object'
                            ? this.proxifyObject(t)
                            : t;
                }
            });
            return this.createProxy(oClone);
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

    runGetter<Key extends keyof GetterCollection<T>>(
        name: Key
    ): ReturnType<GetterCollection<T>[Key]['run']> {
        const getter = this.getters[name];
        if (!getter) {
            throw new ReferenceError(`Getter ${name} not found`);
        }
        this.createEffect(() => {
            getter.run(this.state, this.getters);
        }, getter.depreg);
        return getter.value;
    }
}
