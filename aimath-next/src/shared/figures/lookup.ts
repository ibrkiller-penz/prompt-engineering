// id 로 연결표 한 줄 찾기(순수).
import type { FigureId, FigureMeta } from "./types.ts";
import { FIGURE_META } from "./meta.ts";

export function metaOf(id: FigureId): FigureMeta {
  for (const m of FIGURE_META) if (m.id === id) return m;
  throw new Error("figures: 연결표에 없는 도식 id " + id);
}
