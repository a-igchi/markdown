import * as fc from "fast-check";

const FIXED_SEED = 42;

export function fcOptions(overrides?: fc.Parameters<unknown>): fc.Parameters<unknown> {
  const seed = process.env.FC_SEED === "random" ? undefined : FIXED_SEED;
  return { seed, ...overrides };
}
