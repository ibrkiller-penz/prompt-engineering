import { useEffect } from "react";
import { Link } from "react-router-dom";
import { HUB_NAME, SECTIONS } from "../site";

export default function Hub() {
  useEffect(() => {
    document.title = HUB_NAME;
  }, []);
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-12 sm:py-20">
        <p className="text-sm font-semibold tracking-widest text-accent">PENEDU</p>
        <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-5xl">{HUB_NAME}</h1>
        <p className="mt-4 max-w-2xl text-lg text-muted">수업에 바로 쓰는 교육자료를 한곳에 모았어요.</p>

        <ul className="mt-10 grid gap-4 sm:grid-cols-2">
          {SECTIONS.map((s) => (
            <li key={s.path}>
              <Link
                to={s.path}
                className="group block h-full rounded-card border border-line bg-surface p-6 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
              >
                <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">
                  {s.tag}
                </span>
                <h2 className="mt-3 text-2xl font-extrabold">{s.title}</h2>
                <p className="mt-2 text-muted">{s.desc}</p>
                <span className="mt-4 inline-block font-semibold text-accent group-hover:underline">들어가기 →</span>
              </Link>
            </li>
          ))}
          <li className="flex items-center justify-center rounded-card border border-dashed border-line p-6 text-muted">
            새 자료가 곧 더해져요
          </li>
        </ul>
      </main>
    </div>
  );
}
