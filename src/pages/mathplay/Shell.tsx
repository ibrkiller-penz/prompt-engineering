import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { HUB_NAME } from "../../site";
import SectionIcon from "../../components/SectionIcon";

export const MATHPLAY_NAME = "온라인 수학 체험";

/** 온라인 수학 체험 꼭지 공통 틀: 맨 위 이동 길, 제목, 바닥 안내 */
export default function Shell({ title, children, lead }: { title: string; lead?: ReactNode; children: ReactNode }) {
  useEffect(() => {
    document.title = `${title} · ${title === MATHPLAY_NAME ? HUB_NAME : MATHPLAY_NAME}`;
  }, [title]);
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <nav className="flex flex-wrap items-center gap-x-2 text-sm font-semibold text-muted" aria-label="위치">
          <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 hover:text-ink">
            <img src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8" />
            {HUB_NAME}
          </Link>
          <span aria-hidden>›</span>
          <Link to="/mathplay" className="inline-flex min-h-[44px] items-center hover:text-ink">
            {MATHPLAY_NAME}
          </Link>
        </nav>
        <div className="mt-3 flex items-center gap-4">
          <SectionIcon path="/mathplay" size={56} />
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
        </div>
        {lead && <div className="mt-4 max-w-2xl text-lg text-muted">{lead}</div>}
        {children}
        <p className="mt-12 border-t border-line pt-4 text-xs text-muted">
          부산수학문화관 층별 목록은 부산광역시교육청 창의융합교육원 분원 부산수학문화관 누리집의 ‘체험 미리보기’에서 이름과 영상 주소를 옮기고, 주제 묶음은 새로 나눈 것이에요. 영상은 부산수학문화관 유튜브에 올라 있는 것이에요. 게임과 퍼즐은 체험 이름과 수학 내용을 바탕으로 이 사이트에서 새로 만든 것이라 실제 체험과 다를 수 있어요. 공식 누리집과 직접 관계는 없어요.
        </p>
      </main>
    </div>
  );
}
