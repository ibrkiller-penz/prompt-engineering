import { lazy } from "react";
import type { ComponentType, LazyExoticComponent } from "react";
import type { WidgetId } from "../types";

// 체험 도구 등록. 각 파일은 props 없이 default export 하는 React 컴포넌트다.
export const WIDGETS: Record<WidgetId, LazyExoticComponent<ComponentType>> = {
  turing: lazy(() => import("./Turing")),
  rulevslearn: lazy(() => import("./RuleVsLearn")),
  bigdata: lazy(() => import("./BigData")),
  bow: lazy(() => import("./Bow")),
  tfidf: lazy(() => import("./Tfidf")),
  cosine: lazy(() => import("./Cosine")),
  sentiment: lazy(() => import("./Sentiment")),
  pixels: lazy(() => import("./Pixels")),
  imgtransform: lazy(() => import("./ImgTransform")),
  knn: lazy(() => import("./Knn")),
  bayes: lazy(() => import("./Bayes")),
  regression: lazy(() => import("./Regression")),
  gradient: lazy(() => import("./Gradient")),
  truth: lazy(() => import("./Truth")),
  flow: lazy(() => import("./Flow")),
  vecops: lazy(() => import("./VecOps")),
  tangent: lazy(() => import("./Tangent")),
};
