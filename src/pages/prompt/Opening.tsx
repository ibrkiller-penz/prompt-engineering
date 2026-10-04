import { useState } from "react";
import opening from "../../../content/prompt/opening.json";
import { Rich } from "../../components/ui";

const IMG: Record<string, string> = {
  "first-result": "/img/prompt/first-result.webp",
  "brick-level": "/img/prompt/brick-level.webp",
};

function Figure({ name, alt }: { name: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok || !IMG[name]) return null;
  return (
    <figure className="my-5 overflow-hidden rounded-card border border-line bg-bg">
      <img src={IMG[name]} alt={alt} loading="lazy" onError={() => setOk(false)} className="aspect-[3/2] w-full object-cover" />
    </figure>
  );
}

/** 이야기로 여는 첫 장 — 수필 『다 된 줄 알았다』 프롤로그에서 */
export default function Opening() {
  return (
    <article className="mx-auto max-w-[720px] rounded-card border border-line bg-surface px-5 py-8 shadow-sm sm:px-10 sm:py-10">
      <p className="text-sm font-semibold tracking-wide text-accent">{opening.kicker}</p>
      <h2 className="mt-1 text-3xl font-extrabold tracking-tight sm:text-4xl">{opening.title}</h2>
      {opening.sections.map((s, i) => (
        <section key={i}>
          <Figure name={s.image} alt={s.imageAlt} />
          <div className="space-y-4 text-[1.05rem] leading-[1.9]">
            {s.paragraphs.map((p, k) => (
              <p key={k}>
                <Rich text={p} />
              </p>
            ))}
          </div>
        </section>
      ))}
      <blockquote className="mt-8 border-l-4 border-accent pl-4 text-xl font-extrabold leading-snug">{opening.closing}</blockquote>
      <p className="mt-4 text-muted">{opening.invite}</p>
      <p className="mt-6 text-xs text-muted">— {opening.source}</p>
    </article>
  );
}
