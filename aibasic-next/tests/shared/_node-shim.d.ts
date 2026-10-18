// @types/node 가 설치돼 있지 않아서, 시험 파일이 쓰는 node 모듈만 최소로 적어 둬요(타입 검사용).
declare module "node:test" {
  type Fn = (t?: unknown) => void | Promise<void>;
  export function test(name: string, fn: Fn): Promise<void>;
  export function test(name: string, opts: { skip?: boolean | string; only?: boolean; timeout?: number }, fn: Fn): Promise<void>;
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn: Fn): void;
  export default test;
}
declare module "node:assert/strict" {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    notDeepEqual(actual: unknown, expected: unknown, message?: string): void;
    match(value: string, re: RegExp, message?: string): void;
    throws(fn: () => unknown, message?: string): void;
    fail(message?: string): never;
  }
  const assert: Assert;
  export default assert;
}
declare module "node:fs" {
  export function readFileSync(path: string, enc: "utf8"): string;
  export function readdirSync(path: string): string[];
}
declare module "node:path" {
  export function join(...p: string[]): string;
  export function dirname(p: string): string;
}
declare module "node:url" {
  export function fileURLToPath(u: string | URL): string;
}
