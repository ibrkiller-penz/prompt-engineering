import { useState } from "react";
import { Link } from "react-router-dom";
import essay from "../../../content/prompt/essay.json";
import type { Level, StoryFile } from "../../content/types";
import { Rich } from "../ui";

export const storyImg = (name: string) => `/img/prompt/${name}.webp`;

function Figure({ name, alt }: { name: string; alt: string }) {
  const [ok, setOk] = useState(true);
  if (!ok) return null;
  return (
    <figure className="mx-auto my-5 w-full overflow-hidden rounded-card border border-line bg-bg sm:w-3/5">
      <img src={storyImg(name)} alt={alt} loading="lazy" onError={() => setOk(false)} className="aspect-[3/2] w-full object-cover" />
    </figure>
  );
}

/** 차시를 여는 이야기 (수필 『다 된 줄 알았다』에서, 학교급별 문체) */
export default function StoryOpening({ story, level }: { story: StoryFile; level: Level }) {
  const v = story.levels[level];
  if (!v) return null;
  return (
    <article className="mb-6 rounded-card border border-line bg-surface px-5 py-7 shadow-sm sm:px-10 sm:py-9">
      <p className="text-sm font-semibold tracking-wide text-accent">{v.kicker}</p>
      <h2 className="mt-1 text-2xl font-extrabold tracking-tight sm:text-3xl">{v.title}</h2>
      <Figure name={story.image} alt={story.imageAlt} />
      <div className="mx-auto max-w-[680px] space-y-4 text-[1.05rem] leading-[1.9]">
        {v.paragraphs.map((p, i) => (
          <div key={i}>
            <p>
              <Rich text={p} />
            </p>
            {story.image2 && story.image2After === i && <Figure name={story.image2} alt={story.image2Alt ?? ""} />}
          </div>
        ))}
        <blockquote className="mt-6 border-l-4 border-accent pl-4 text-lg font-extrabold leading-snug">{v.closing}</blockquote>
        <p className="pt-2 text-xs text-muted">
          — {story.source}
          {(() => {
            const t = essay.toc.find((x) => x.lessons?.includes(story.lesson));
            return t ? (
              <Link to={`/prompt/essay?p=${t.page}`} className="no-print ml-2 font-semibold text-accent underline underline-offset-2">
                📖 수필에서 이어 읽기
              </Link>
            ) : null;
          })()}
        </p>
      </div>
    </article>
  );
}
