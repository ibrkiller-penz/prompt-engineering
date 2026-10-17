// 다른 담당이 만드는 교사 화면을 경로에 연결해요(화면을 열 때 따로 불러오는 조각).
//
// 약속: src/teacher/<폴더>/index.tsx 가 default 로 화면 부품을 내보내요. 부품은 TeacherPageProps(경로 일치 정보)를 받아요.
//   flow → flow/  · pick → pick/  · prep → prep/  · print → print/  · progress → progress/  · results → results/
//   unitTest → unit/  · privacy → privacy/(없으면 shell 의 기본 안내)  · board·boardQ·boardTool·boardEnd → board/ (m.name 으로 나눠요)
// 파일이 아직 없으면 '준비 중' 화면을 보여요(동시 작업 중에도 빌드가 깨지지 않아요).
import { lazy, Suspense, type ComponentType, type LazyExoticComponent } from "react";
import type { TEACHER_ROUTES, TeacherRoute } from "../../shared/contracts.ts";
import type { RouteMatch } from "../../shared/router/index.ts";
import { Loading, Soon } from "./Fallbacks.tsx";

export type TeacherPageProps = RouteMatch<typeof TEACHER_ROUTES>;
type PageModule = { default?: ComponentType<TeacherPageProps> };

const MODULES = import.meta.glob<PageModule>(["../*/index.tsx", "!../shell/**", "!../today/**", "!../find/**"]);

export const PAGE_DIR: Partial<Record<TeacherRoute, string>> = {
  flow: "flow",
  pick: "pick",
  prep: "prep",
  print: "print",
  progress: "progress",
  results: "results",
  unitTest: "unit",
  privacy: "privacy",
  board: "board",
  boardQ: "board",
  boardTool: "board",
  boardEnd: "board",
};

const cache: Record<string, LazyExoticComponent<ComponentType<TeacherPageProps>>> = {};

function lazyPage(dir: string): LazyExoticComponent<ComponentType<TeacherPageProps>> | null {
  const loader = MODULES["../" + dir + "/index.tsx"];
  if (!loader) return null;
  if (!cache[dir]) {
    cache[dir] = lazy(() =>
      loader().then((m) => ({
        default: m && m.default ? m.default : (((p: TeacherPageProps) => <Soon name={p.name} />) as ComponentType<TeacherPageProps>),
      })),
    );
  }
  return cache[dir];
}

/** 이 경로를 맡은 화면 파일이 있는지 */
export function hasPage(name: TeacherRoute): boolean {
  const dir = PAGE_DIR[name];
  return !!dir && !!MODULES["../" + dir + "/index.tsx"];
}

/** 경로 → 화면(따로 불러오는 동안은 '불러오는 중') */
export function RoutedPage({ m }: { m: TeacherPageProps }) {
  const dir = PAGE_DIR[m.name];
  const Page = dir ? lazyPage(dir) : null;
  if (!Page) return <Soon name={m.name} />;
  return (
    <Suspense fallback={<Loading />}>
      <Page {...m} />
    </Suspense>
  );
}
