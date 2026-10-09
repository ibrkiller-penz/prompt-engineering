import type { ReactNode } from "react";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { HUB_NAME } from "../../site";
import SectionIcon from "../../components/SectionIcon";

export const MATHPLAY_NAME = "온라인 수학 체험";

/** 온라인 수학 체험 꼭지 공통 틀: 맨 위 이동 길, 제목, 안내 */
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
        {lead && <div className="mt-3 max-w-2xl text-lg text-muted">{lead}</div>}
        {children}
      </main>
    </div>
  );
}
