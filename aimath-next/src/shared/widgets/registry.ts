// 체험 도구 17종 등록. 화면에 들어갈 때만 불러와요(lazy). WidgetId 는 @legacy/types 와 같아요.
import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { WidgetId, WidgetProps } from "../contracts.ts";

export { WIDGET_IDS, WIDGET_TITLES, isWidgetId } from "./ids.ts";

export type WidgetComponent = ComponentType<WidgetProps>;

export const WIDGETS: Record<WidgetId, LazyExoticComponent<WidgetComponent>> = {
  turing: lazy(() => import("./turing/index.tsx")),
  rulevslearn: lazy(() => import("./rulevslearn/index.tsx")),
  bigdata: lazy(() => import("./bigdata/index.tsx")),
  bow: lazy(() => import("./bow/index.tsx")),
  tfidf: lazy(() => import("./tfidf/index.tsx")),
  cosine: lazy(() => import("./cosine/index.tsx")),
  sentiment: lazy(() => import("./sentiment/index.tsx")),
  pixels: lazy(() => import("./pixels/index.tsx")),
  imgtransform: lazy(() => import("./imgtransform/index.tsx")),
  knn: lazy(() => import("./knn/index.tsx")),
  bayes: lazy(() => import("./bayes/index.tsx")),
  regression: lazy(() => import("./regression/index.tsx")),
  gradient: lazy(() => import("./gradient/index.tsx")),
  truth: lazy(() => import("./truth/index.tsx")),
  flow: lazy(() => import("./flow/index.tsx")),
  vecops: lazy(() => import("./vecops/index.tsx")),
  tangent: lazy(() => import("./tangent/index.tsx")),
};
