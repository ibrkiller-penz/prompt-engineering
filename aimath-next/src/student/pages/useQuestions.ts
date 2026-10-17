// 문제 id 여러 개의 본문을 불러와요(오답노트·오늘의 복습). 레슨·단원 조각은 필요한 것만 불러요.
import { useEffect, useState } from "react";
import type { Question } from "../../shared/contracts.ts";
import { loadQuestion } from "../../content/index.ts";
import { planOf } from "../store/index.ts";

export interface QFound {
  q: Question;
  lid: string | null;
  unit: number;
  where: string;
}

export function useQuestions(ids: string[]): { map: Record<string, QFound | null>; loading: boolean } {
  const key = ids.join(",");
  const [map, setMap] = useState<Record<string, QFound | null>>({});
  const [loading, setLoading] = useState(ids.length > 0);
  useEffect(() => {
    let alive = true;
    if (!ids.length) {
      setLoading(false);
      return;
    }
    setLoading(true);
    Promise.all(ids.map((id) => loadQuestion(id).then((r) => [id, r] as const, () => [id, null] as const))).then((pairs) => {
      if (!alive) return;
      const m: Record<string, QFound | null> = {};
      for (const [id, r] of pairs) m[id] = r;
      setMap(m);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return { map, loading };
}

/** 문제가 나온 개념 소제목 번호(data/plan.json 의 sectionOf). 모르면 -1 */
export function sectionOfQ(lid: string, qid: string): number {
  const p = planOf(lid) as unknown as { sectionOf?: Record<string, number> } | undefined;
  const v = p && p.sectionOf ? p.sectionOf[qid] : undefined;
  return typeof v === "number" && v >= 0 ? v : -1;
}
