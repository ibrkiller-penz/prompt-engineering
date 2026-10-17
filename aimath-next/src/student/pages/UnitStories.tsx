// 단원 이야기: 이야기로 열기 · 시작하기 전에 읽는 이야기(접기) · 왜 배울까.
// 삽화(images)는 after 번째 문단 다음에, 글 옆에 가로폭 30%로 좌우 번갈아 떠요.
import { useUnit } from "../../content/index.ts";
import type { StoryImage } from "../../shared/contracts.ts";
import { Rich } from "../../shared/ui/index.ts";

function Paragraphs({ paragraphs, images }: { paragraphs: string[]; images?: StoryImage[] }) {
  const sorted = (images || []).slice().sort((a, b) => a.after - b.after);
  return (
    <div className="s-story-text">
      {paragraphs.map((p, i) => (
        <div key={i} className="s-story-p">
          {sorted
            .filter((im) => im.after === i - 1)
            .map((im) => (
              <img
                key={im.src}
                className={"s-story-img " + (sorted.indexOf(im) % 2 === 0 ? "is-right" : "is-left")}
                src={im.src}
                alt={im.alt}
                loading="lazy"
                width={640}
                height={640}
              />
            ))}
          <p>
            <Rich text={p} />
          </p>
        </div>
      ))}
    </div>
  );
}

export function UnitStories({ n }: { n: number }) {
  const { data } = useUnit(n);
  if (!data) return null;
  const stories = data.stories || [];
  return (
    <div className="stack">
      <section className="card s-story" aria-labelledby={"h-open-" + n}>
        <p className="eyebrow">이야기로 열기</p>
        <h2 id={"h-open-" + n} className="h3">
          {data.opening.title}
        </h2>
        <Paragraphs paragraphs={data.opening.paragraphs} images={data.opening.images} />
      </section>
      {stories.length ? (
        <section aria-labelledby={"h-pre-" + n}>
          <h2 id={"h-pre-" + n} className="h3">
            📚 시작하기 전에 읽는 이야기
          </h2>
          <p className="small muted">건너뛰어도 되지만, 읽고 가면 공부가 훨씬 쉬워져요.</p>
          <div className="s-stories">
            {stories.map((s, i) => (
              <details key={i} className="card s-story-d" open={i === 0}>
                <summary className="s-story-sum">
                  <span className="s-story-no" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="grow">
                    {s.kicker ? <span className="eyebrow">{s.kicker}</span> : null}
                    <strong className="s-story-title">{s.title}</strong>
                  </span>
                </summary>
                <Paragraphs paragraphs={s.paragraphs} images={s.images} />
              </details>
            ))}
          </div>
        </section>
      ) : null}
      <section className="card s-story" aria-labelledby={"h-why-" + n}>
        <p className="eyebrow">왜 배울까?</p>
        <h2 id={"h-why-" + n} className="h3">
          {data.why.title}
        </h2>
        <Paragraphs paragraphs={data.why.paragraphs} />
      </section>
    </div>
  );
}
