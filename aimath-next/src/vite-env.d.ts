/// <reference types="vite/client" />

/** 빌드 모드에서 정해지는 사이트(vite.config.ts 의 define) */
declare const __SITE__: "student" | "teacher";

interface ImportMetaEnv {
  readonly VITE_STUDENT_URL?: string;
  readonly VITE_TEACHER_URL?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

/** tools/content-index.mjs 가 만드는 가상 모듈 */
declare module "virtual:content-index" {
  const index: import("./shared/contracts.ts").ContentIndex;
  export default index;
}
declare module "virtual:content-terms" {
  const terms: import("./shared/contracts.ts").TermEntry[];
  export default terms;
}

/* ── node --test 용 최소 타입(@types/node 를 새로 설치하지 않으려고 둬요). tests/*.test.ts 와 scripts 의 타입 검사에 써요 ── */
declare module "node:test" {
  type Fn = (t: unknown) => void | Promise<void>;
  interface TestFn {
    (name: string, fn: Fn): Promise<void>;
    (name: string, opts: { skip?: boolean | string; only?: boolean; timeout?: number }, fn: Fn): Promise<void>;
  }
  const test: TestFn;
  export default test;
  export const describe: (name: string, fn: () => void | Promise<void>) => Promise<void>;
  export const it: TestFn;
  export const before: (fn: () => void | Promise<void>) => void;
  export const after: (fn: () => void | Promise<void>) => void;
  export const beforeEach: (fn: () => void | Promise<void>) => void;
  export const afterEach: (fn: () => void | Promise<void>) => void;
}
declare module "node:assert/strict" {
  interface Assert {
    (value: unknown, message?: string): asserts value;
    ok(value: unknown, message?: string): asserts value;
    equal<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    notEqual(actual: unknown, expected: unknown, message?: string): void;
    deepEqual<T>(actual: unknown, expected: T, message?: string): asserts actual is T;
    notDeepEqual(actual: unknown, expected: unknown, message?: string): void;
    throws(fn: () => unknown, error?: RegExp | ((e: unknown) => boolean) | object, message?: string): void;
    doesNotThrow(fn: () => unknown, message?: string): void;
    rejects(p: Promise<unknown> | (() => Promise<unknown>), error?: RegExp | object, message?: string): Promise<void>;
    match(value: string, re: RegExp, message?: string): void;
    doesNotMatch(value: string, re: RegExp, message?: string): void;
    fail(message?: string): never;
  }
  const assert: Assert;
  export default assert;
}
declare module "node:fs" {
  export function readFileSync(path: string, enc: "utf8"): string;
  export function readdirSync(path: string): string[];
  export function existsSync(path: string): boolean;
  export function statSync(path: string): { isDirectory(): boolean; size: number };
  const fs: {
    readFileSync: typeof readFileSync;
    readdirSync: typeof readdirSync;
    existsSync: typeof existsSync;
    statSync: typeof statSync;
  };
  export default fs;
}
declare module "node:path" {
  export function join(...p: string[]): string;
  export function resolve(...p: string[]): string;
  export function dirname(p: string): string;
  export function relative(from: string, to: string): string;
  export function basename(p: string, ext?: string): string;
  const path: { join: typeof join; resolve: typeof resolve; dirname: typeof dirname; relative: typeof relative; basename: typeof basename; sep: string };
  export default path;
}
declare module "node:url" {
  export function fileURLToPath(u: string | URL): string;
  export function pathToFileURL(p: string): URL;
}
