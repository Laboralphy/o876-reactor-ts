import { ReactiveStore } from '../src/ReactiveStore'; // Ajuste le chemin selon ton projet

interface TestState {
    count: number;
    todos: string[];
}

describe('ReactiveStore', () => {
    let store: ReactiveStore<TestState, 'doubleCount' | 'completedTodos'>;

    beforeEach(() => {
        store = new ReactiveStore<TestState, 'doubleCount' | 'completedTodos'>({
            count: 0,
            todos: [],
        });
        store.defineGetters({
            doubleCount: (state) => state.count * 2,
            completedTodos: (state) => state.todos.filter((todo) => todo.includes('[x]')).length,
        });
    });

    // Test 1 : Le state initial est correct
    test('should initialize state correctly', () => {
        expect(store.state.count).toBe(0);
        expect(store.state.todos).toEqual([]);
    });

    // Test 2 : La modification du state déclenche les listeners
    test('should notify listeners on state change', () => {
        const mockListener = jest.fn();
        store.subscribe(mockListener);
        store.state.count = 1;
        expect(mockListener).toHaveBeenCalledTimes(1);
    });

    // Test 3 : Les getters calculent correctement leur valeur
    test('should compute getter values', () => {
        expect(store.getGetterValue('doubleCount')).toBe(0);
        store.state.count = 2;
        expect(store.getGetterValue('doubleCount')).toBe(4);
    });

    // Test 4 : Les getters mémorisent leurs dépendances
    test('should track getter dependencies', () => {
        // @ts-ignore (accès privé pour le test)
        expect(store.getterDependencies.get('doubleCount')).toEqual(new Set(['count']));
        // @ts-ignore
        expect(store.getterDependencies.get('completedTodos')).toEqual(new Set(['todos']));
    });

    // Test 5 : Les getters sont réactifs aux changements de dépendances
    test('should update getter value when dependency changes', () => {
        store.state.todos = ['[x] Task 1', '[ ] Task 2'];
        expect(store.getGetterValue('completedTodos')).toBe(1);
        store.state.todos.push('[x] Task 3');
        expect(store.getGetterValue('completedTodos')).toBe(2);
    });

    // Test 6 : Les listeners ne sont pas notifiés inutilement
    test('should not notify listeners if state does not change', () => {
        const mockListener = jest.fn();
        store.subscribe(mockListener);
        store.state.count = 0; // Même valeur
        expect(mockListener).not.toHaveBeenCalled();
    });

    // Test 7 : Désabonnement d'un listener
    test('should unsubscribe listener', () => {
        const mockListener = jest.fn();
        const unsubscribe = store.subscribe(mockListener);
        unsubscribe();
        store.state.count = 1;
        expect(mockListener).not.toHaveBeenCalled();
    });

    // Test 8 : Gestion des tableaux réactifs
    test('should handle reactive arrays', () => {
        const mockListener = jest.fn();
        store.subscribe(mockListener);
        const todos = store.state.todos;
        todos.push('[x] New Task');
        expect(mockListener).toHaveBeenCalledTimes(1);
        expect(store.getGetterValue('completedTodos')).toBe(1);
    });
});
