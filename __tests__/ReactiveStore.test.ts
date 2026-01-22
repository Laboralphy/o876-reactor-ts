import { ReactiveStore } from '../src/ReactiveStore'; // Ajuste le chemin selon ton projet

describe('Basic tests', () => {
    test('should initialize the reactive store correctly', () => {
        const r = new ReactiveStore({
            count: 1,
        });
        expect(r.state.count).toBe(1);
    });
    test('should return 1 when defining a getter to a property of value 1 and using runGetter to get result', () => {
        const oState = {
            count: 1,
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState);
        r.defineGetter('getCount', (state: StateType) => state.count);
        expect(r.runGetter('getCount')).toBe(1);
    });
    test('should return 1 when defining a getter to a property of value 1 and using r.getter to get result', () => {
        const oState = {
            count: 1,
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState);
        r.defineGetter('getCount', (state: StateType) => state.count);
        expect(r.getter.getCount).toBe(1);
    });
    test('should return 1 then return 2 when state property is changed from 1 to 2', () => {
        const oState = {
            count: 1,
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState);
        r.defineGetter('getCount', (state: StateType) => state.count);
        expect(r.getter.getCount).toBe(1);
        r.state.count = 2;
        expect(r.getter.getCount).toBe(2);
    });
    test('should not recompute getter getCount when asking value two times', () => {
        const oState = {
            count: 1,
        };
        type StateType = typeof oState;
        const r = new ReactiveStore(oState);
        const LOG: string[] = [];
        r.defineGetter('getCount', (state: StateType) => {
            LOG.push('ask for getCount ' + state.count.toString());
            return state.count;
        });
        expect(LOG).toHaveLength(0);
        expect(r.getter.getCount).toBe(1);
        expect(LOG).toHaveLength(1);
        expect(r.getter.getCount).toBe(1);
        expect(LOG).toHaveLength(1);
        r.state.count = 2;
        expect(r.getter.getCount).toBe(2);
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
        const r = new ReactiveStore(oState);
        r.defineGetter('getName', (state: StateType): string => {
            return state.entity.name;
        });
        expect(r.runGetter('getName')).toBe('alpha');
    });
});

describe('State with array of objects', () => {
    test('should be dependent to entites, length when getter return entities.length', () => {
        type StateType = { entities: number[] };
        const oState: StateType = { entities: [] };
        const r = new ReactiveStore(oState);
        r.defineGetter('getCount', (state: StateType) => state.entities.length);
        expect(r.getter.getCount).toBe(0);
        // should be dependent to entitei.length
        const g1 = r.getGetterData('getCount');
        expect(g1.depreg.keys().includes('entities')).toBe(true);
        expect(g1.depreg.keys().includes('length')).toBe(true);
    });

    test('should return 20 as sum of values in state { entities: [{ value: 10 }, { value: 6 }, { value: 4 }] }', () => {
        type StateType = { entities: { value: number }[] };
        const oState: StateType = { entities: [] };
        const r = new ReactiveStore(oState);
        r.defineGetter('getSumValue', (state: StateType) =>
            state.entities.reduce((acc, val) => acc + val.value, 0)
        );
        expect(r.getter.getSumValue).toBe(0);
        r.state.entities[0] = { value: 10 };
        expect(r.state.entities[0].value).toBe(10);
        console.log(r.getGetterData('getSumValue').depreg);
        expect(r.getter.getSumValue).toBe(10);
        r.state.entities.push({ value: 6 });
        expect(r.getter.getSumValue).toBe(16);
        r.state.entities.push({ value: 4 });
        expect(r.getter.getSumValue).toBe(20);
    });
});
