import { useEffect } from "react";
import { Link } from "react-router-dom";
import { HUB_NAME, SECTIONS } from "../site";
import SectionIcon from "../components/SectionIcon";

export default function Hub() {
  useEffect(() => {
    document.title = HUB_NAME;
  }, []);
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <div className="flex items-center gap-4 sm:gap-6">
          <img
            src="/icon-512.png"
            alt="살빠진 임선생"
            width={512}
            height={512}
            className="h-20 w-20 shrink-0 drop-shadow-md sm:h-32 sm:w-32"
          />
          <div className="min-w-0">
            <p className="text-sm font-semibold tracking-widest text-accent">PENEDU</p>
            <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{HUB_NAME}</h1>
            <p className="mt-3 max-w-2xl text-lg text-muted">수업에 바로 쓰는 교육자료를 한곳에 모았어요.</p>
          </div>
        </div>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => {
            const cls =
              "group block h-full rounded-card border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg";
            const inner = (
              <>
                <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">{s.tag}</span>
                <div className="mt-3 flex items-center gap-3">
                  <SectionIcon path={s.path} size={44} />
                  <h2 className="text-2xl font-extrabold leading-tight">{s.title}</h2>
                </div>
                <p className="mt-2 text-muted">{s.desc}</p>
                <span className="mt-4 inline-block font-semibold text-accent group-hover:underline">{s.cta ?? "들어가기 →"}</span>
              </>
            );
            return (
              <li key={s.path}>
                {s.external ? (
                  <a href={s.path} target="_blank" rel="noopener" className={cls}>
                    {inner}
                  </a>
                ) : (
                  <Link to={s.path} className={cls}>
                    {inner}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </div>
  );
}
