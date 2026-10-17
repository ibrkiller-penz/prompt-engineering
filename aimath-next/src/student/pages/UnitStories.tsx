// 단원 이야기: 위쪽(삽화 + 접힌 이야기 한 줄) · 레슨 목록 아래(시작하기 전에 읽는 이야기 · 왜 배울까).
// 이야기 카드는 첫 문단만 보이고 '이어서 읽기'로 펼쳐요. 삽화는 카드 위쪽에 넓게, 나머지 삽화는 펼친 글 사이에 넣어요.
// 문단 옆에는 읽어 주기 단추(지원하지 않는 기기에서는 SpeakButton 이 스스로 숨어요).
import { useState } from "react";
import { useUnit } from "../../content/index.ts";
import type { StoryImage } from "../../shared/contracts.ts";
import { Rich, SpeakButton } from "../../shared/ui/index.ts";

function Paragraphs({ paragraphs, images, collapsible, hideTop }: { paragraphs: string[]; images?: StoryImage[]; collapsible?: boolean; hideTop?: boolean }) {
  const [open, setOpen] = useState(false);
  const sorted = (images || []).slice().sort((a, b) => a.after - b.after);
  const top = sorted[0];
  const rest = sorted.slice(1);
  const folded = !!collapsible && !open && paragraphs.length > 1;
  const shown = folded ? paragraphs.slice(0, 1) : paragraphs;
  return (
    <div className="s-story-text">
      {top && !hideTop ? <img className="s-story-top" src={top.src} alt={top.alt} loading="lazy" width={640} height={640} /> : null}
      {shown.map((p, i) => (
        <div key={i} className="s-story-p">
          <p>
            <Rich text={p} />
          </p>
          {rest
            .filter((im) => im.after === i)
            .map((im) => (
              <img key={im.src} className="s-story-img is-block" src={im.src} alt={im.alt} loading="lazy" width={640} height={640} />
            ))}
        </div>
      ))}
      {folded ? (
        <button type="button" className="btn btn-soft s-story-more" aria-expanded={false} onClick={() => setOpen(true)}>
          이어서 읽기
        </button>
      ) : collapsible && paragraphs.length > 1 ? (
        <button type="button" className="btn btn-ghost s-story-more" aria-expanded={true} onClick={() => setOpen(false)}>
          접기
        </button>
      ) : null}
      <div className="s-story-speak">
        <SpeakButton text={paragraphs.join(" ")} label="이야기 읽어 주기" />
      </div>
    </div>
  );
}

/** 첫 화면 위쪽: 삽화를 넓게, 아래에 접힌 한 줄 이야기 */
export function UnitStories({ n }: { n: number }) {
  const { data } = useUnit(n);
  if (!data) return null;
  const imgs = (data.opening.images || []).slice().sort((a, b) => a.after - b.after);
  // 여는 이야기에 삽화가 없으면 시작 전 이야기의 첫 삽화를 단원 그림으로 써요
  let top = imgs[0];
  for (const st of data.stories || []) {
    if (top) break;
    const im = (st.images || []).slice().sort((a, b) => a.after - b.after)[0];
    if (im) top = im;
  }
  return (
    <div className="stack">
      {top ? <img className="s-story-top s-unit-art" src={top.src} alt={top.alt} width={640} height={640} /> : null}
      <details className="card s-story s-story-fold" aria-labelledby={"h-open-" + n}>
        <summary id={"h-open-" + n}>이야기 · {data.opening.title}</summary>
        <div className="s-story-body">
          <Paragraphs paragraphs={data.opening.paragraphs} images={data.opening.images} hideTop />
        </div>
      </details>
    </div>
  );
}

/** 레슨 목록 아래: 시작하기 전에 읽는 이야기 · 왜 배울까 */
export function UnitStoriesAfter({ n }: { n: number }) {
  const { data } = useUnit(n);
  if (!data) return null;
  const stories = data.stories || [];
  return (
    <div className="stack">
      {stories.length ? (
        <section aria-labelledby={"h-pre-" + n}>
          <h2 id={"h-pre-" + n} className="h3">
            📚 시작하기 전에 읽는 이야기
          </h2>
          <p className="small muted">건너뛰어도 되지만, 읽고 가면 공부가 훨씬 쉬워져요.</p>
          <div className="s-stories">
            {stories.map((s, i) => (
              <details key={i} className="card s-story-d">
                <summary className="s-story-sum">
                  <span className="s-story-no" aria-hidden>
                    {i + 1}
                  </span>
                  <span className="grow">
                    <span className="eyebrow">이야기{s.kicker ? " · " + s.kicker : ""}</span>
                    <strong className="s-story-title">{s.title}</strong>
                  </span>
                </summary>
                <Paragraphs paragraphs={s.paragraphs} images={s.images} />
              </details>
            ))}
          </div>
        </section>
      ) : null}
      <details className="card s-story s-story-fold" aria-labelledby={"h-why-" + n}>
        <summary id={"h-why-" + n}>왜 배울까? · {data.why.title}</summary>
        <div className="s-story-body">
          <Paragraphs paragraphs={data.why.paragraphs} />
        </div>
      </details>
    </div>
  );
}
