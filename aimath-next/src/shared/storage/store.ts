// localStorage 읽기·쓰기(모두 try/catch). 저장이 막혀도(사생활 보호 창·용량 초과) 화면은 그대로 돌아가요.
// DOM 에 기대지 않아서 node --test 에서 가짜 저장소로 시험할 수 있어요.
import type { StudentData, TeacherData } from "../contracts.ts";
import { S_PREFIX, T_PREFIX, STUDENT_KEYS, TEACHER_KEYS } from "./keys.ts";

/** localStorage 와 같은 모양(시험용 가짜도 이 모양) */
export interface StorageLike {
  getItem(k: string): string | null;
  setItem(k: string, v: string): void;
  removeItem(k: string): void;
  key(i: number): string | null;
  readonly length: number;
}

/** 값이 바뀌면 window 에 이 이름의 이벤트를 내요(detail: { prefix, key }) */
export const STORE_EVENT = "aimn-store";

export interface Store<D> {
  readonly prefix: string;
  read<K extends keyof D & string>(key: K, fallback: D[K]): D[K];
  write<K extends keyof D & string>(key: K, value: D[K]): boolean;
  /** 지금 값을 읽어 고친 뒤 저장 */
  update<K extends keyof D & string>(key: K, fallback: D[K], fn: (cur: D[K]) => D[K]): D[K];
  remove(key: keyof D & string): void;
  /** 이 접두사의 키를 모두 지워요(다른 꼭지·사이트 기록은 건드리지 않아요) */
  clear(): void;
  /** 알려진 키의 값만 모아요(백업용). 깨진 값은 빼요 */
  dump(): Record<string, unknown>;
  /** 백업에서 읽은 값을 써요. 알려진 키만 */
  restore(data: Record<string, unknown>): number;
  /** 저장소를 쓸 수 있는지(사생활 보호 창 등에서 false 일 수 있어요) */
  available(): boolean;
}

function defaultStorage(): StorageLike | null {
  try {
    const ls = (globalThis as { localStorage?: StorageLike }).localStorage;
    return ls || null;
  } catch {
    return null; // 접근만 해도 SecurityError 가 나는 브라우저가 있어요
  }
}

function emit(prefix: string, key: string) {
  try {
    const w = (globalThis as { window?: { dispatchEvent(e: Event): boolean } }).window;
    if (w && typeof CustomEvent === "function") w.dispatchEvent(new CustomEvent(STORE_EVENT, { detail: { prefix, key } }));
  } catch {
    /* 알림 실패는 무시 */
  }
}

export function createStore<D>(prefix: string, knownKeys: readonly string[], getStorage: () => StorageLike | null = defaultStorage): Store<D> {
  const known = new Set(knownKeys);
  const s = () => {
    try {
      return getStorage();
    } catch {
      return null;
    }
  };

  const api: Store<D> = {
    prefix,
    read(key, fallback) {
      try {
        const st = s();
        if (!st) return fallback;
        const raw = st.getItem(prefix + key);
        if (raw == null) return fallback;
        const v = JSON.parse(raw);
        return v === null && fallback !== null ? fallback : v;
      } catch {
        return fallback;
      }
    },
    write(key, value) {
      let ok = false;
      try {
        const st = s();
        if (st) {
          st.setItem(prefix + key, JSON.stringify(value));
          ok = true;
        }
      } catch {
        ok = false;
      }
      emit(prefix, key);
      return ok;
    },
    update(key, fallback, fn) {
      const next = fn(api.read(key, fallback));
      api.write(key, next);
      return next;
    },
    remove(key) {
      try {
        const st = s();
        if (st) st.removeItem(prefix + key);
      } catch {
        /* 무시 */
      }
      emit(prefix, key);
    },
    clear() {
      try {
        const st = s();
        if (st) {
          const mine: string[] = [];
          for (let i = 0; i < st.length; i++) {
            const k = st.key(i);
            if (k && k.indexOf(prefix) === 0) mine.push(k);
          }
          mine.forEach((k) => st.removeItem(k));
        }
      } catch {
        /* 무시 */
      }
      emit(prefix, "*");
    },
    dump() {
      const out: Record<string, unknown> = {};
      try {
        const st = s();
        if (!st) return out;
        known.forEach((k) => {
          try {
            const raw = st.getItem(prefix + k);
            if (raw != null) out[k] = JSON.parse(raw);
          } catch {
            /* 깨진 값은 건너뛰어요 */
          }
        });
      } catch {
        /* 무시 */
      }
      return out;
    },
    restore(data) {
      let n = 0;
      for (const k of Object.keys(data)) {
        if (!known.has(k)) continue;
        try {
          const st = s();
          if (!st) break;
          st.setItem(prefix + k, JSON.stringify(data[k]));
          n++;
        } catch {
          /* 용량 초과 등 */
        }
      }
      emit(prefix, "*");
      return n;
    },
    available() {
      try {
        const st = s();
        if (!st) return false;
        const t = prefix + "__t";
        st.setItem(t, "1");
        st.removeItem(t);
        return true;
      } catch {
        return false;
      }
    },
  };
  return api;
}

/** 학생 기록(aimn:s1:*) — 교사 사이트에서는 쓰지 않아요 */
export const studentStore = createStore<StudentData>(S_PREFIX, Object.keys(STUDENT_KEYS));
/** 교사 설정(aimn:t1:*) */
export const teacherStore = createStore<TeacherData>(T_PREFIX, Object.keys(TEACHER_KEYS));

/** 시험용: 메모리 저장소 */
export function memoryStorage(init?: Record<string, string>): StorageLike & { map: Map<string, string> } {
  const map = new Map<string, string>(init ? Object.keys(init).map((k) => [k, init[k]] as [string, string]) : []);
  return {
    map,
    getItem: (k) => (map.has(k) ? (map.get(k) as string) : null),
    setItem: (k, v) => void map.set(k, String(v)),
    removeItem: (k) => void map.delete(k),
    key: (i) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size;
    },
  };
}
