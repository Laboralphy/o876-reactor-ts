
# ReactiveStore

**ReactiveStore** is a lightweight TypeScript library for managing reactive state. It uses `Proxy` to track property access and automatically invalidates getter caches when their dependencies change.

---

## Table of Contents

- [Installation](#installation)
- [Key Concepts](#key-concepts)
- [Usage](#usage)
    - [Creating a Store](#creating-a-store)
    - [Defining Getters](#defining-getters)
    - [Using Getters](#using-getters)
    - [Reactivity and Dependencies](#reactivity-and-dependencies)
- [The Getter Type System](#the-getter-type-system)
    - [Simple Getters](#simple-getters)
    - [Getters Calling Other Getters](#getters-calling-other-getters)
- [API](#api)
    - [`ReactiveStore`](#reactivestore)
    - [`Getter`](#getter)
- [Limitations](#limitations)
- [License](#license)

---

## Installation

```bash
npm install @laboralphy/reactor
```

---

## Key Concepts

- **Reactivity**: The store wraps state in a `Proxy` to intercept reads and writes. Reads register dependencies; writes invalidate them.
- **Getters**: Functions that compute a derived value from the state. Results are cached and only recomputed when a tracked dependency changes.
- **Lazy evaluation**: Getters are not evaluated until accessed. The cached value is reused on subsequent accesses as long as no dependency has changed.

---

## Usage

### Creating a Store

Pass an initial state object and a getter definition object to the constructor:

```typescript
import { ReactiveStore } from '@laboralphy/reactor';

type AppState = {
    todos: string[];
    count: number;
};

const store = new ReactiveStore({ todos: [], count: 0 } as AppState, {
    getCount: (state: AppState) => state.count,
    getCompletedTodos: (state: AppState) => state.todos.filter((t) => t.startsWith('[x]')),
});
```

### Defining Getters

Getters are plain functions passed as the second argument to the constructor:

```typescript
const store = new ReactiveStore(initialState, {
    getTotalAge: (state: AppState) => state.users.reduce((sum, u) => sum + u.age, 0),
});
```

Each getter receives the reactive state as its first argument. It may also receive a `getters` object as its second argument to call other getters (see [Getters Calling Other Getters](#getters-calling-other-getters)).

### Using Getters

Access computed values through `store.getters`:

```typescript
console.log(store.getters.getCount);          // number
console.log(store.getters.getCompletedTodos); // string[]
```

### Reactivity and Dependencies

Any state mutation automatically invalidates affected getter caches. On the next access, the getter recomputes:

```typescript
store.state.todos.push('[x] Write tests');
console.log(store.getters.getCompletedTodos); // recomputed, reflects new state
```

---

## The Getter Type System

ReactiveStore infers getter return types from the functions you provide. No manual type annotation of the store is required in the common case.

### Simple Getters

When getters only depend on state, TypeScript infers everything:

```typescript
type State = {
    level: number;
    constitution: number;
};

const state: State = { level: 4, constitution: 16 };

const store = new ReactiveStore(state, {
    getLevel: (state: State) => state.level,
    // store.getters.getLevel is inferred as number
    getConstitutionModifier: (state: State) => Math.floor((state.constitution - 10) / 2),
    // store.getters.getConstitutionModifier is inferred as number
});
```

The return types of `store.getters` are fully typed with no extra work.

### Getters Calling Other Getters

When a getter needs to call another getter, it receives a typed `getters` object as its second argument. Because the type of `getters` depends on the definitions themselves, TypeScript cannot resolve it through inference alone. In this case, define a `GetterType` alias for the getters being consumed and annotate the parameter explicitly:

```typescript
import { GetterOutput } from '@laboralphy/reactor';

type State = { level: number; constitution: number };

// Only list the getters this function actually calls.
// GetterOutput<T> maps a getter definition type to its output record.
type ConsumedGetters = {
    getLevel: (state: State) => number;
    getConstitutionModifier: (state: State) => number;
};

const state: State = { level: 4, constitution: 16 };

const store = new ReactiveStore(state, {
    getLevel: (state: State) => state.level,
    getConstitutionModifier: (state: State) => Math.floor((state.constitution - 10) / 2),
    getHitPoints: (state: State, getters: GetterOutput<ConsumedGetters>) =>
        getters.getConstitutionModifier * getters.getLevel,
    // getters.getConstitutionModifier and getters.getLevel are typed as number
});

console.log(store.getters.getHitPoints); // number
```

`GetterOutput<T>` is a utility type exported by the library. It maps a getter definition type to the record of return values:

```typescript
// Given:
type MyDefs = {
    getLevel: (state: State) => number;
    getName:  (state: State) => string;
};

// GetterOutput<MyDefs> is equivalent to:
// { getLevel: number; getName: string }
```

`ConsumedGetters` only needs to list the getters actually accessed inside the function — not all getters in the store.

---

## API

### `ReactiveStore<S, G>`

```typescript
new ReactiveStore(initialState: S, getters: G)
```

- `S` — the state type, inferred from `initialState`
- `G` — the getter definitions type, inferred from the `getters` object

| Member | Description |
|---|---|
| `state` | The reactive state proxy. Mutations trigger dependency invalidation. |
| `getters` | The computed getter values. Typed as `GetterOutput<G>`. |
| `runGetter(name)` | Runs a getter by name and returns its typed value. |
| `getGetterData(name)` | Returns the internal `Getter` instance for introspection (e.g. accessing `depreg`). |

### `Getter<S, R, GO>`

The internal class backing each getter entry. Normally not used directly.

| Member | Description |
|---|---|
| `value` | The cached computed value. Throws if invalid. |
| `invalid` | `true` if the cache needs to be recomputed. |
| `invalidate()` | Marks the getter as invalid, forcing recomputation on next access. |
| `depreg` | The `DependencyRegistry` tracking which state properties this getter depends on. |

---

## Limitations

- **No property deletion on state objects**: Deleting keys from a state object throws an error, as it would silently break getter dependency tracking.
- **Frozen or sealed objects are not reactive**: They are left as-is without proxying.
- **Circular getter dependencies**: A getter that depends on itself, directly or indirectly, will cause infinite recursion.
- **`getters` parameter type requires a manual annotation** when a getter calls other getters (see above). This is a known limitation of TypeScript's inference with self-referential generic constraints.

---

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.
