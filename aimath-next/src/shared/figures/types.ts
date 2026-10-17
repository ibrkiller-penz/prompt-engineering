// 코드로 그린 도식(figures)의 공용 타입. DOM 을 쓰지 않아요(node --test 에서 그대로 불러올 수 있어요).
import type { Surface } from "../contracts.ts";

export type FigureId = "ai-nested" | "neuron" | "net-342" | "turing" | "xor-points";

/** 모든 도식이 받는 props */
export interface FigureProps {
  /**
   * 공개 단계: 앞에서부터 몇 부분을 보일지(0 = 틀만, steps = 전부).
   * 주지 않으면 모두 보여요(학생 카드·인쇄). 칠판은 '다음'으로 1씩 올려 줘요.
   */
  step?: number;
  /** 표면. 없으면 문맥(UiSurfaceContext) → html[data-surface] 순서로 읽어요 */
  surface?: Surface;
  /** 그림 아래 설명 줄(figcaption)을 보일지. 기본은 보여요 */
  caption?: boolean;
  /** 그림 최대 너비(px). 없으면 표면마다 정한 값(휴대폰 100%, 준비 720, 칠판 960) */
  maxWidth?: number;
  className?: string;
}

/** 레슨 안 어디에 끼울지: 소제목 번호와 '이 블록 뒤' */
export interface FigureAnchor {
  /** 소제목 번호(0부터) */
  section: number;
  /** 이 블록(소제목 안 0부터) 뒤에 끼워요. match 가 맞는 블록을 찾으면 그쪽이 먼저예요 */
  after: number;
  /** 블록 글(p.text·list 첫 항목 등)이 이 말로 시작하면 그 블록 뒤. 원본이 조금 바뀌어도 따라가요 */
  match?: string;
}

/** 연결표 한 줄(컴포넌트 제외 부분 — 순수 데이터) */
export interface FigureMeta extends FigureAnchor {
  id: FigureId;
  lid: string;
  /** 그림 이름(화면 제목·스크린 리더 title) */
  title: string;
  /** 그림 설명(스크린 리더 desc·인쇄 대체 글). 그림 없이 읽어도 뜻이 통하게 써요 */
  desc: string;
  /** 그림 아래 한 줄 */
  caption: string;
  /** 공개 단계 수(step 의 최댓값) */
  steps: number;
  /** 단계마다 칠판에서 읽어 줄 짧은 이름(길이 = steps) */
  stepLabels: string[];
}
