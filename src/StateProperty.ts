/**
 * This type is what types are allowed in state
 */

export type ScalarValue = number | string | boolean | null | undefined;

export type StateProperty = ScalarValue | StateObject | StateArray;

export interface StateObject {
    [key: string]: StateProperty;
}

export type StateArray = Array<StateProperty>;
