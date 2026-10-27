// Story flags: named values set by dialogue choices and read by levels and
// dialogue. A flag that was never set reads as false.

export type FlagValue = boolean | number | string;
export type Flags = Record<string, FlagValue>;

/** Every listed flag must equal its value. A missing flag counts as false. */
export type Condition = Record<string, FlagValue>;

export function flagValue(flags: Flags, name: string): FlagValue {
  return Object.hasOwn(flags, name) ? flags[name] : false;
}

/** True when there is no condition or every pair in it matches. */
export function matches(condition: Condition | undefined, flags: Flags): boolean {
  if (!condition) return true;
  return Object.entries(condition).every(([name, value]) => flagValue(flags, name) === value);
}

export function isFlagValue(v: unknown): v is FlagValue {
  return typeof v === 'boolean' || typeof v === 'string' || (typeof v === 'number' && Number.isFinite(v));
}

/** Throws with msg when value is not a flag-to-value object. */
export function checkFlagMap(value: unknown, fail: (msg: string) => never, what: string): void {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) fail(`${what} must be an object of flag names to values`);
  for (const [name, v] of Object.entries(value as object)) {
    if (!name) fail(`${what} has an empty flag name`);
    if (!isFlagValue(v)) fail(`${what} flag "${name}" must be true, false, a number or a string`);
  }
}
