// 학생 화면 틀 부품: 사이트 띠(파랑) · 위 띠(TopBar 52) · 아래 탭 5개 · 아래 행동 띠(ActionBar 76) · 진행 레일.
// 간격은 flex gap 대신 형제 margin(Chrome 80). 모양은 공용 components.css + ./shell.css.
import { useEffect, type ReactNode } from "react";
import { STUDENT_ROUTES } from "../../shared/contracts.ts";
import { back as goBack, href, navigate } from "../../shared/router/index.ts";
import { Icon, type IconName } from "../../shared/icons/index.ts";

/** 맨 위 파란 띠(학생 사이트 표시) */
export function SiteBand() {
  return <div className="site-band s-band" aria-hidden="true" />;
}

export interface TopBarProps {
  title: ReactNode;
  /** 뒤로 가기 대신 갈 곳(사이트 밖에서 바로 들어온 경우) */
  backTo?: string;
  /** 뒤로 단추 없이(홈 등) */
  noBack?: boolean;
  /** 위쪽 작은 이름(예: "Ⅰ-3") */
  eyebrow?: ReactNode;
  right?: ReactNode;
  /** 뒤로 단추가 기록을 거슬러 가지 않고 backTo 로 바로 가요(카드 넘기기처럼 주소를 바꿔 쓰는 화면) */
  hardBack?: boolean;
}

export function TopBar({ title, backTo, noBack, eyebrow, right, hardBack }: TopBarProps) {
  return (
    <header className="topbar s-topbar">
      {noBack ? null : (
        <button type="button" className="btn btn-ghost btn-icon s-back" aria-label="뒤로" title="뒤로" onClick={() => (hardBack && backTo ? navigate(backTo) : goBack(backTo || "/"))}>
          <Icon name="prev" />
        </button>
      )}
      <div className="title s-title">
        {eyebrow ? <span className="s-title-eyebrow">{eyebrow}</span> : null}
        <span className="s-title-main">{title}</span>
      </div>
      {right || null}
    </header>
  );
}

export type TabId = "home" | "unit" | "note" | "dict" | "me";

const TABS: { id: TabId; label: string; icon: IconName; to: string }[] = [
  { id: "home", label: "홈", icon: "home", to: href(STUDENT_ROUTES.home) },
  { id: "unit", label: "단원", icon: "book", to: href(STUDENT_ROUTES.unit, { n: 1 }) },
  { id: "note", label: "오답노트", icon: "note", to: href(STUDENT_ROUTES.note) },
  { id: "dict", label: "사전", icon: "dict", to: href(STUDENT_ROUTES.dict) },
  { id: "me", label: "내 기록", icon: "progress", to: href(STUDENT_ROUTES.me) },
];

/** 아래 탭 5개(레슨 밖에서만) */
export function TabBar({ current, unitHref }: { current: TabId | null; unitHref?: string }) {
  return (
    <nav className="tabbar s-tabbar" aria-label="주 메뉴">
      {TABS.map((t) => (
        <a key={t.id} href={t.id === "unit" && unitHref ? unitHref : t.to} aria-current={current === t.id ? "page" : undefined}>
          <Icon name={t.icon} />
          <span>{t.label}</span>
        </a>
      ))}
    </nav>
  );
}

/** 아래 고정 행동 띠(76px + 안전 영역) */
export function ActionBar({ children, rail }: { children: ReactNode; rail?: ReactNode }) {
  return (
    <div className="s-actionbar" role="region" aria-label="카드 넘기기">
      {rail || null}
      <div className="s-actionbar-in">{children}</div>
    </div>
  );
}

export interface RailStep {
  id: string;
  label: string;
  cards: number;
}

/** 진행 레일: 단계마다 한 칸, 칸 안은 카드 수만큼 채워요. 지금 단계는 진하게 */
export function ProgressRail({ steps, at, card }: { steps: RailStep[]; at: number; card: number }) {
  let total = 0;
  let done = 0;
  steps.forEach((s, i) => {
    total += s.cards;
    if (i < at) done += s.cards;
  });
  done += card + 1;
  return (
    <div className="s-rail" role="progressbar" aria-label="레슨 진행" aria-valuemin={1} aria-valuemax={total} aria-valuenow={done} aria-valuetext={"모두 " + total + "장 중 " + done + "번째"}>
      {steps.map((s, i) => {
        const fill = i < at ? 100 : i > at ? 0 : Math.round(((card + 1) / Math.max(1, s.cards)) * 100);
        return (
          <span key={s.id} className={"s-rail-seg" + (i === at ? " is-now" : "")} style={{ flexGrow: Math.max(1, s.cards) }} title={s.label}>
            <i style={{ width: fill + "%" }} />
          </span>
        );
      })}
    </div>
  );
}

/** 화면 제목을 문서 제목에도 반영해요 */
export function useDocTitle(t: string) {
  useEffect(() => {
    try {
      document.title = t ? t + " · 인공지능 수학" : "인공지능 수학";
    } catch {
      /* 무시 */
    }
  }, [t]);
}

/** 불러오는 중·불러오지 못함 */
export function Loading({ error }: { error?: Error | null }) {
  if (error) {
    return (
      <div className="empty" role="alert">
        <p>내용을 불러오지 못했어요. 인터넷 연결을 확인하고 새로고침해 주세요.</p>
        <button type="button" className="btn" onClick={() => window.location.reload()}>
          새로고침
        </button>
      </div>
    );
  }
  return (
    <p className="empty" aria-busy="true">
      불러오는 중이에요…
    </p>
  );
}

/** 찾는 화면이 없을 때 */
export function NotFoundBody() {
  return (
    <div className="empty">
      <p>찾는 화면이 없어요. 주소가 바뀌었을 수 있어요.</p>
      <a className="btn btn-primary" href="#/">
        홈으로 가요
      </a>
    </div>
  );
}

export interface ScreenProps {
  title: ReactNode;
  eyebrow?: ReactNode;
  /** 아래 탭에서 켤 칸. null 이면 탭은 보이되 아무것도 켜지 않아요 */
  tab?: TabId | null;
  /** 탭 없이(레슨 개요처럼 레슨 안 화면) */
  noTabs?: boolean;
  noBack?: boolean;
  backTo?: string;
  right?: ReactNode;
  /** 아래 행동 띠(탭 대신) */
  action?: ReactNode;
  unitHref?: string;
  className?: string;
  children: ReactNode;
}

/** 일반 화면 틀: 사이트 띠 + 위 띠 + 본문 + (아래 탭 또는 행동 띠) */
export function Screen(props: ScreenProps) {
  const tabs = !props.noTabs && !props.action;
  return (
    <div className={"s-screen" + (props.className ? " " + props.className : "")}>
      <SiteBand />
      <TopBar title={props.title} eyebrow={props.eyebrow} noBack={props.noBack} backTo={props.backTo} right={props.right} />
      <main id="main" className={"s-main" + (tabs ? " has-tabbar" : props.action ? " has-actionbar" : "")}>
        {props.children}
      </main>
      {props.action ? <ActionBar>{props.action}</ActionBar> : null}
      {tabs ? <TabBar current={props.tab === undefined ? null : props.tab} unitHref={props.unitHref} /> : null}
    </div>
  );
}
