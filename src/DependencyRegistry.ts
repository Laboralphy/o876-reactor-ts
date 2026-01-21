import { StateProperty } from './StateProperty';

export class DependencyRegistry {
    private readonly _properties = new Map<string, Set<StateProperty>>();
    constructor() {}

    add<T extends StateProperty>(target: T, property: string) {
        const px = this._properties.get(property);
        if (px) {
            px.add(target);
        } else {
            this._properties.set(property, new Set([target]));
        }
    }

    has<T extends StateProperty>(target: T, property: string): boolean {
        const px = this._properties.get(property);
        return px !== undefined && px.has(target);
    }

    reset() {
        this._properties.clear();
    }
}
