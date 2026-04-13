import { describe, test, expect } from 'vitest';
import { ReactiveStore } from '../src/ReactiveStore';
import { GetterOutput } from '../src/Getter';

describe('Basic tests', () => {
    test('should initialize the reactive store correctly', () => {
        const r = new ReactiveStore(
            {
                count: 1,
            },
            {}
        );
        expect(r.state.count).toBe(1);
    });
    test('should return 1 when defining a getter to a property of value 1 and using runGetter to get result', () => {
        const oState = {
            count: 1,
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState, {
            getCount: (state: StateType) => state.count,
        });
        expect(r.runGetter('getCount')).toBe(1);
    });
    test('should return 1 when defining a getter to a property of value 1 and using r.getter to get result', () => {
        const oState = {
            count: 1,
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState, {
            getCount: (state: StateType) => state.count,
        });
        expect(r.getters.getCount).toBe(1);
    });
    test('should return 1 then return 2 when state property is changed from 1 to 2', () => {
        const oState = {
            count: 1,
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState, {
            getCount: (state: StateType) => state.count,
        });
        expect(r.getters.getCount).toBe(1);
        r.state.count = 2;
        expect(r.getters.getCount).toBe(2);
    });
    test('should not recompute getter getCount when asking value two times', () => {
        const oState = {
            count: 1,
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState, {
            getCount: (state: StateType) => {
                LOG.push('ask for getCount ' + state.count.toString());
                return state.count;
            },
        });

        const LOG: string[] = [];
        expect(LOG).toHaveLength(0);
        expect(r.getters.getCount).toBe(1);
        expect(LOG).toHaveLength(1);
        expect(r.getters.getCount).toBe(1);
        expect(LOG).toHaveLength(1);
        r.state.count = 2;
        expect(r.getters.getCount).toBe(2);
        expect(LOG).toHaveLength(2);
        expect(LOG).toEqual(['ask for getCount 1', 'ask for getCount 2']);
    });
});

describe('State with two levels', () => {
    test('should return alpha when asking for entity.name in state { entity: { name: alpha }}', () => {
        const oState = {
            entity: {
                name: 'alpha',
            },
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState, {
            getName: (state: StateType): string => {
                return state.entity.name;
            },
        });
        expect(r.runGetter('getName')).toBe('alpha');
    });
});

describe('State with array of objects', () => {
    test('should be dependent to entites, length when getter return entities.length', () => {
        type StateType = { entities: number[] };
        const oState: StateType = { entities: [] };
        const r = new ReactiveStore(oState, {
            getCount: (state: StateType) => state.entities.length,
        });
        expect(r.getters.getCount).toBe(0);
        // should be dependent to entities.length
        const g1 = r.getGetterData('getCount');
        expect(g1.depreg.keys().includes('entities')).toBe(true);
        expect(g1.depreg.keys().includes('length')).toBe(true);
    });

    test('should update getter we length is modified', () => {
        type StateType = { entities: number[] };
        const oState: StateType = { entities: [] };
        const r = new ReactiveStore(oState, {
            getCount: (state: StateType) => state.entities.length,
        });
        expect(r.getters.getCount).toBe(0);
        r.state.entities[0] = 1;
        expect(r.getters.getCount).toBe(1);
        r.state.entities.splice(0, 1);
        expect(r.state.entities.length).toBe(0);
        expect(r.getters.getCount).toBe(0);
    });

    test('should update getter when using push to add an item', () => {
        type StateType = { entities: number[] };
        const oState: StateType = { entities: [] };
        const r = new ReactiveStore(oState, {
            getCount: (state: StateType) => state.entities.length,
        });
        expect(r.getters.getCount).toBe(0);
        r.state.entities.push(1);
        expect(r.getters.getCount).toBe(1);
        r.state.entities.splice(0, 1);
        expect(r.state.entities.length).toBe(0);
        expect(r.getters.getCount).toBe(0);
    });

    test('should update getter when asking for item 0 and changing item 0', () => {
        type StateType = { entities: number[] };
        const oState: StateType = { entities: [] };
        const r = new ReactiveStore(oState, {
            getItem0: (state: StateType) => (state.entities.length > 0 ? state.entities[0] : -1),
        });
        expect(r.getters.getItem0).toBe(-1);
        r.state.entities.push(1);
        expect(r.getters.getItem0).toBe(1);
        r.state.entities[0] = 3;
        expect(r.getters.getItem0).toBe(3);
    });

    test('should update iterative getter when adding item', () => {
        type StateType = { entities: number[] };
        const oState: StateType = { entities: [] };

        const myGetters = {
            getSum(state: StateType) {
                let n = 0;
                for (const v of state.entities) {
                    n += v;
                }
                return n;
            },
        };

        const r = new ReactiveStore(oState, myGetters);
        expect(r.getters.getSum).toBe(0);
        r.state.entities.push(1);
        expect(r.getters.getSum).toBe(1);
        r.state.entities[0] = 3;
        expect(r.getters.getSum).toBe(3);
        r.state.entities.push(10);
        expect(r.getters.getSum).toBe(13);
    });

    test('should return 20 as sum of values in state { entities: [{ value: 10 }, { value: 6 }, { value: 4 }] }', () => {
        type StateType = { entities: { value: number }[] };
        const oState: StateType = { entities: [] };
        const r = new ReactiveStore(oState, {
            getSumValue: (state: StateType) => {
                let n = 0;
                for (const v of state.entities) {
                    n += v.value;
                }
                return n;
            },
        });
        expect(r.getters.getSumValue).toBe(0);
        r.state.entities.push({ value: 10 });
        expect(r.state.entities[0].value).toBe(10);
        expect(r.getters.getSumValue).toBe(10);
        r.state.entities.push({ value: 6 });
        expect(r.getters.getSumValue).toBe(16);
        r.state.entities.push({ value: 4 });
        expect(r.getters.getSumValue).toBe(20);
    });

    test('should return 20 as sum of values when using array reducer, when all entites are already there', () => {
        type StateType = { entities: { value: number }[] };
        const oState: StateType = { entities: [{ value: 0 }, { value: 0 }, { value: 0 }] };
        const r = new ReactiveStore(oState, {
            getSumValue: (state: StateType) => {
                return state.entities.reduce((acc, v) => acc + v.value, 0);
            },
        });
        expect(r.getters.getSumValue).toBe(0);
        r.state.entities[0].value = 10;
        r.state.entities[1].value = 6;
        r.state.entities[2].value = 4;
        expect(r.getters.getSumValue).toBe(20);
    });

    test('should return 20 as sum of values when using array reducer', () => {
        type StateType = { entities: { value: number }[] };
        const oState: StateType = { entities: [] };
        const r = new ReactiveStore(oState, {
            getSumValue: (state: StateType) => {
                return state.entities.reduce((acc, v) => acc + v.value, 0);
            },
        });
        expect(r.getters.getSumValue).toBe(0);
        r.state.entities.push({ value: 10 });
        expect(r.getters.getSumValue).toBe(10);
        r.state.entities.push({ value: 6 });
        expect(r.getters.getSumValue).toBe(16);
        r.state.entities.push({ value: 4 });
        expect(r.getters.getSumValue).toBe(20);
    });
});

describe('Array prototype', () => {
    type EntityType = {
        name: string;
        age: number;
        role: string[];
    };

    type StateType = {
        entities: EntityType[];
    };

    describe('ReactiveStore - Array Getters', () => {
        // Test 1 : Teste le getter utilisant `filter`
        test('should filter entities by age', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    getFilterAge20: (state: StateType) => state.entities.filter((e) => e.age >= 20),
                }
            );
            const result = store.getters.getFilterAge20;
            expect(result).toHaveLength(2);
            expect(result).toEqual([
                { name: 'Alice', age: 25, role: ['admin'] },
                { name: 'Charlie', age: 30, role: ['admin', 'user'] },
            ]);
            store.state.entities[1].age = 50;
            const result2 = store.getters.getFilterAge20;
            expect(result2).toHaveLength(3);
            expect(result2).toEqual([
                { name: 'Alice', age: 25, role: ['admin'] },
                { name: 'Bob', age: 50, role: ['user'] },
                { name: 'Charlie', age: 30, role: ['admin', 'user'] },
            ]);
        });

        // Test 2 : Teste le getter utilisant `map`
        test('should map entity names', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    getEntityNames: (state: StateType) => state.entities.map((e) => e.name),
                }
            );
            const result = store.getters.getEntityNames;
            expect(result).toEqual(['Alice', 'Bob', 'Charlie']);
            store.state.entities.push({ name: 'Deborah', age: 22, role: [] });
            const result2 = store.getters.getEntityNames;
            expect(result2).toEqual(['Alice', 'Bob', 'Charlie', 'Deborah']);
        });

        // Test 3 : Teste le getter utilisant `reduce`
        test('should reduce to total age', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    getTotalAge: (state: StateType) =>
                        state.entities.reduce((sum, e) => sum + e.age, 0),
                }
            );
            const result = store.getters.getTotalAge;
            expect(result).toBe(74);
        });

        // Test 4 : Teste le getter utilisant `find`
        test('should find entity by name', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    getEntityByName: (state: StateType) =>
                        state.entities.find((e) => e.name === 'Bob'),
                }
            );
            const result = store.getters.getEntityByName;
            expect(result).toEqual({ name: 'Bob', age: 19, role: ['user'] });
        });

        // Test 5 : Teste le getter utilisant `some`
        test('should check if some entity is admin', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    hasAdmin: (state: StateType) =>
                        state.entities.some((e) => e.role.includes('admin')),
                }
            );
            const result = store.getters.hasAdmin;
            expect(result).toBe(true);
        });

        // Test 6 : Teste le getter utilisant `every`
        test('should check if every entity is at least 18', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    allAdults: (state: StateType) => state.entities.every((e) => e.age >= 18),
                }
            );
            const result = store.getters.allAdults;
            expect(result).toBe(true);
        });

        // Test 7 : Teste la réactivité du getter `filter` après modification du state
        test('should update filter getter when state changes', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    getFilterAge20: (state: StateType) => state.entities.filter((e) => e.age >= 20),
                }
            );
            expect(store.getters.getFilterAge20).toHaveLength(2);
            store.state.entities.push({ name: 'David', age: 22, role: ['user'] });
            expect(store.getters.getFilterAge20).toHaveLength(3);
        });

        // Test 8 : Teste la réactivité du getter `map` après modification du state
        test('should update map getter when state changes', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    getEntityNames: (state: StateType) => state.entities.map((e) => e.name),
                }
            );
            expect(store.getters.getEntityNames).toEqual(['Alice', 'Bob', 'Charlie']);
            store.state.entities.push({ name: 'David', age: 22, role: ['user'] });
            expect(store.getters.getEntityNames).toEqual(['Alice', 'Bob', 'Charlie', 'David']);
        });

        // Test 9 : Teste la réactivité du getter `reduce` après modification du state
        test('should update reduce getter when state changes', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    getTotalAge: (state: StateType) =>
                        state.entities.reduce((sum, e) => sum + e.age, 0),
                }
            );
            expect(store.getters.getTotalAge).toBe(74);
            store.state.entities.push({ name: 'David', age: 22, role: ['user'] });
            expect(store.getters.getTotalAge).toBe(96);
        });

        // Test 10 : Teste la réactivité du getter `find` après modification du state
        test('should update find getter when state changes', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    getEntityByName: (state: StateType) =>
                        state.entities.find((e) => e.name === 'David'),
                }
            );
            expect(store.getters.getEntityByName).toBeUndefined();
            store.state.entities.push({ name: 'David', age: 22, role: ['user'] });
            expect(store.getters.getEntityByName).toEqual({
                name: 'David',
                age: 22,
                role: ['user'],
            });
        });

        // Test 11 : Teste la réactivité du getter `some` après modification du state
        test('should update some getter when state changes', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    hasAdmin: (state: StateType) =>
                        state.entities.some((e) => e.role.includes('admin')),
                }
            );
            expect(store.getters.hasAdmin).toBe(true);
            store.state.entities = store.state.entities.map((e) => ({ ...e, role: ['user'] }));
            expect(store.getters.hasAdmin).toBe(false);
        });

        // Test 12 : Teste la réactivité du getter `every` après modification du state
        test('should update every getter when state changes', () => {
            const store = new ReactiveStore(
                {
                    entities: [
                        { name: 'Alice', age: 25, role: ['admin'] },
                        { name: 'Bob', age: 19, role: ['user'] },
                        { name: 'Charlie', age: 30, role: ['admin', 'user'] },
                    ],
                },
                {
                    allAdults: (state: StateType) => state.entities.every((e) => e.age >= 18),
                }
            );
            expect(store.getters.allAdults).toBe(true);
            store.state.entities.push({ name: 'Eve', age: 17, role: ['user'] });
            expect(store.getters.allAdults).toBe(false);
        });
    });
});

describe('Array getter recompute', () => {
    type ArrEntityType = { name: string; age: number; role: string[] };
    type ArrStateType = { entities: ArrEntityType[] };

    test('should recompute all entities', () => {
        const store = new ReactiveStore(
            {
                entities: [
                    {
                        name: 'David',
                        age: 18,
                        role: ['user'],
                    },
                    {
                        name: 'Eve',
                        age: 20,
                        role: ['user'],
                    },
                    {
                        name: 'Charlie',
                        age: 30,
                        role: ['admin'],
                    },
                    {
                        name: 'Bob',
                        age: 40,
                        role: ['user'],
                    },
                    {
                        name: 'Alice',
                        age: 25,
                        role: ['user', 'moderator'],
                    },
                ],
            },
            {
                getAdmins: (state: ArrStateType): string[] => {
                    nCalled++;
                    return state.entities
                        .filter((e) => e.role.includes('admin'))
                        .map((e) => e.name);
                },
            }
        );
        let nCalled = 0;
        const a11 = store.getters.getAdmins;
        expect(nCalled).toBe(1);
        expect(a11.includes('David')).toBe(false);
        const a13 = store.getters.getAdmins;
        expect(nCalled).toBe(1);
        expect(a13.includes('Charlie')).toBe(true);
        const a15 = store.getters.getAdmins;
        expect(a15.includes('Alice')).toBe(false);
        expect(nCalled).toBe(1);
        store.state.entities[4].role.push('admin');
        const a21 = store.getters.getAdmins;
        expect(a21.includes('David')).toBe(false);
        expect(nCalled).toBe(2);
        const a23 = store.getters.getAdmins;
        expect(a23.includes('Charlie')).toBe(true);
        expect(nCalled).toBe(2);
        const a25 = store.getters.getAdmins;
        expect(a25.includes('Alice')).toBe(true);
        expect(nCalled).toBe(2);
    });
});

describe('getter calling other getters', () => {
    test('should call other getters', () => {
        type EntityType = {
            name: string;
            age: number;
            role: string[];
        };

        type StateType = {
            entities: EntityType[];
        };

        // For inter-getter calls, define the getter shapes explicitly so TypeScript
        // can resolve the self-referential GetterOutput<MyGetters> type for the
        // `getters` parameter inside each function.
        type MyGetters = {
            getAdmins: (state: StateType) => string[];
            getAdminCount: (state: StateType, getters: GetterOutput<MyGetters>) => number;
        };

        let nCalled: number = 0;
        const store = new ReactiveStore<StateType, MyGetters>(
            {
                entities: [
                    {
                        name: 'David',
                        age: 18,
                        role: ['user'],
                    },
                    {
                        name: 'Eve',
                        age: 20,
                        role: ['user'],
                    },
                    {
                        name: 'Charlie',
                        age: 30,
                        role: ['admin'],
                    },
                    {
                        name: 'Bob',
                        age: 40,
                        role: ['user'],
                    },
                    {
                        name: 'Alice',
                        age: 25,
                        role: ['user', 'moderator'],
                    },
                ],
            },
            {
                getAdminCount: (state, getters) => {
                    ++nCalled;
                    return getters.getAdmins.length;
                },
                getAdmins: (state) =>
                    state.entities.filter((e) => e.role.includes('admin')).map((e) => e.name),
            }
        );
        expect(store.getters.getAdmins).toEqual(['Charlie']);
        expect(store.getters.getAdminCount).toBe(1);
        expect(nCalled).toBe(1);
        expect(store.getters.getAdminCount).toBe(1);
        expect(nCalled).toBe(1);
        store.state.entities[4].role.push('admin');
        expect(store.getters.getAdminCount).toBe(2);
        expect(store.getters.getAdmins).toEqual(['Charlie', 'Alice']);
        expect(nCalled).toBe(2);
    });
});

describe('In-place mutating array methods', () => {
    test('sort: getter should be invalidated even though length does not change', () => {
        type StateType = { values: number[] };
        const store = new ReactiveStore({ values: [3, 1, 2] } as { values: number[] }, {
            getSorted: (state: StateType) => [...state.values],
        });
        expect(store.getters.getSorted).toEqual([3, 1, 2]);
        store.state.values.sort((a, b) => a - b);
        expect(store.getters.getSorted).toEqual([1, 2, 3]);
    });

    test('reverse: getter should be invalidated even though length does not change', () => {
        type StateType = { values: number[] };
        const store = new ReactiveStore({ values: [1, 2, 3] } as { values: number[] }, {
            getValues: (state: StateType) => [...state.values],
        });
        expect(store.getters.getValues).toEqual([1, 2, 3]);
        store.state.values.reverse();
        expect(store.getters.getValues).toEqual([3, 2, 1]);
    });

    test('fill: getter should be invalidated even though length does not change', () => {
        type StateType = { values: number[] };
        const store = new ReactiveStore({ values: [1, 2, 3] } as { values: number[] }, {
            getValues: (state: StateType) => [...state.values],
        });
        expect(store.getters.getValues).toEqual([1, 2, 3]);
        store.state.values.fill(0);
        expect(store.getters.getValues).toEqual([0, 0, 0]);
    });
});

describe('New primitive properties on state objects', () => {
    test('getter using Object.keys should be invalidated when a new primitive property is added', () => {
        type StateType = { config: Record<string, number> };
        const store = new ReactiveStore(
            { config: { a: 1 } } as { config: Record<string, number> },
            { getKeys: (state: StateType) => Object.keys(state.config) }
        );
        expect(store.getters.getKeys).toEqual(['a']);
        (store.state.config as Record<string, number>).b = 2;
        expect(store.getters.getKeys).toEqual(['a', 'b']);
    });
});

describe('Array element deletion', () => {
    test('getter using spread should be invalidated when an element is deleted', () => {
        type StateType = { values: number[] };
        const store = new ReactiveStore({ values: [1, 2, 3] } as { values: number[] }, {
            getValues: (state: StateType) => [...state.values],
        });
        expect(store.getters.getValues).toEqual([1, 2, 3]);
        delete (store.state.values as number[])[1];
        expect(store.getters.getValues).toEqual([1, undefined, 3]);
    });

    test('getter using direct index access should be invalidated when that element is deleted', () => {
        type StateType = { values: number[] };
        const store = new ReactiveStore({ values: [1, 2, 3] } as { values: number[] }, {
            getFirst: (state: StateType) => state.values[0],
        });
        expect(store.getters.getFirst).toBe(1);
        delete (store.state.values as number[])[0];
        expect(store.getters.getFirst).toBeUndefined();
    });
});

describe('Getter dependency test', () => {
    test('should return 12 when having level 4 and constitution modifier +3', () => {
        type Abilities = {
            constitution: number;
        };
        type StateType = {
            abilities: Abilities;
            level: number;
        };
        const state: StateType = {
            abilities: {
                constitution: 16,
            },
            level: 4,
        };
        type GetterType = {
            getConstitutionModifier: number;
            getLevel: number;
            getHitPoints: number;
        };
        const getters = {
            getConstitutionModifier: (state: StateType): number =>
                Math.floor((state.abilities.constitution - 10) / 2),
            getLevel: (state: StateType): number => state.level,
            getHitPoints: (state: StateType, getters: GetterType): number =>
                getters.getConstitutionModifier * getters.getLevel,
        };
        const store = new ReactiveStore(state, getters);
        expect(store.getters.getHitPoints).toBe(12);
    });
});
