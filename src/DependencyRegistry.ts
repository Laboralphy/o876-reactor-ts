export class DependencyRegistry {
    private readonly _properties = new Map<string | symbol, WeakSet<object>>();
    constructor() {}

    add<T extends object>(target: T, property: string | symbol) {
        const px = this._properties.get(property);
        if (px) {
            px.add(target);
        } else {
            this._properties.set(property, new WeakSet([target]));
        }
    }

    has<T extends object>(target: T, property: string | symbol): boolean {
        const px = this._properties.get(property);
        return px !== undefined && px.has(target);
    }

    reset() {
        this._properties.clear();
    }

    keys() {
        return Array.from(this._properties.keys());
    }
}
