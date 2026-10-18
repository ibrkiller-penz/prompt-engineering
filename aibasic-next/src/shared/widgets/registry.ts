// 체험 도구 등록부. 인공지능 기초에는 체험 도구가 없어서 비어 있어요(widget 블록이 없으면 도구 코드는 쓰이지 않아요).
// 도구를 더하려면 폴더(widgets/<id>/index.tsx)를 만들고 여기에 lazy 로 등록해요.
import type { ComponentType, LazyExoticComponent } from "react";
import type { WidgetId, WidgetProps } from "../contracts.ts";

export { WIDGET_IDS, WIDGET_TITLES, isWidgetId } from "./ids.ts";

export type WidgetComponent = ComponentType<WidgetProps>;

export const WIDGETS: Partial<Record<WidgetId, LazyExoticComponent<WidgetComponent>>> = {};
