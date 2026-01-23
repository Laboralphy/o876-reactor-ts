
# ReactiveStore

**ReactiveStore** is a lightweight library for managing reactive state in TypeScript. It allows you to create a state store where modifications automatically trigger updates to dependencies, such as getters and effects.

---

## Table of Contents

- [Installation](#installation)
- [Key Concepts](#key-concepts)
- [Usage](#usage)
    - [Creating a Store](#creating-a-store)
    - [Defining Getters](#defining-getters)
    - [Using Getters](#using-getters)
    - [Reactivity and Dependencies](#reactivity-and-dependencies)
- [API](#api)
    - [`ReactiveStore`](#reactivestore)
    - [`Getter`](#getter)
    - [`Effect`](#effect)
- [Full Example](#full-example)
- [Limitations](#limitations)
- [License](#license)

---

## Installation

To use `ReactiveStore`, clone this repository or install it via npm (if available):

```bash
npm install @laboralphy/o876-rudimentary-reactor
```

---

## Key Concepts

- **Reactivity**: The store uses `Proxy` to intercept property access and modifications. Each change triggers an update to dependencies.
- **Getters**: Getters are functions that compute a value from the state. They track their dependencies and automatically recalculate when those dependencies change.
- **Effects**: Effects are functions executed in response to state changes. They help collect dependencies for getters.

---

## Usage

### Creating a Store

```typescript
import { ReactiveStore } from './ReactiveStore';

interface AppState {
  todos: string[];
  count: number;
}

const initialState: AppState = {
  todos: ['Learn TypeScript', 'Create a reactive store'],
  count: 0,
};

const store = new ReactiveStore<AppState>(initialState);
```

### Defining Getters

```typescript
store.defineGetter<number>('completedTodos', (state) =>
  state.todos.filter((todo) => todo.includes('[x]')).length
);
```

### Using Getters

```typescript
console.log(store.getter.completedTodos); // Access the getter value
```

### Reactivity and Dependencies

Every state modification automatically invalidates dependent getters:

```typescript
store.state.todos.push('[x] Take a break');
console.log(store.getter.completedTodos); // Automatically updated
```

---

## API

### `ReactiveStore`

- **`constructor(initialState: T)`**: Creates a store with an initial state.
- **`defineGetter<R>(name: string, getter: GetterFunction<T, R>)`**: Defines a named getter.
- **`runGetter<Key extends keyof GetterCollection<T>>(name: Key)`**: Runs a getter and returns its value.
- **`getGetterData(getterName: string)`**: Returns the getter instance.
- **`createEffect(fn: EffectFunction, depreg: DependencyRegistry)`**: Creates an effect to collect dependencies.

### `Getter`

- **`value`**: Cached value of the getter.
- **`invalid`**: Indicates if the getter needs to be recalculated.
- **`invalidate()`**: Forces the getter to recalculate.

### `Effect`

- **`run()`**: Executes the effect and collects dependencies.

---

## Full Example

```typescript
interface AppState {
  todos: string[];
  count: number;
}

const store = new ReactiveStore<AppState>({
  todos: ['Learn TypeScript', '[x] Create a reactive store'],
  count: 0,
});

// Define a getter
store.defineGetter<number>('completedTodos', (state) =>
  state.todos.filter((todo) => todo.includes('[x]')).length
);

// Access the getter
console.log(store.getter.completedTodos); // 1

// Modify the state
store.state.todos.push('[x] Write a README');
console.log(store.getter.completedTodos); // 2
```

---

## Limitations

- **No Property Deletion**: Deleting properties is not allowed to avoid inconsistencies in the getter cache.
- **No Support for Frozen or Sealed Objects**: Frozen or sealed objects cannot be made reactive.
- **No Support for Circular Dependencies**: Circular dependencies between getters can cause infinite loops.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

You can download the English version of the `README.md` here:







Let me know if you need any further adjustments or if you want to explore additional features! 😊