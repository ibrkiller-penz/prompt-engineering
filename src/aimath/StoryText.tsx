import Prose from "./Prose";
import type { StoryImage } from "./types";

/** 이야기 문단들 사이에 작은 삽화를 글 옆에 띄워 넣는다. 삽화는 가로폭의 30% 이하이고 좌우로 번갈아 놓인다. */
export default function StoryText({ paragraphs, images = [], essay = false }: { paragraphs: string[]; images?: StoryImage[]; essay?: boolean }) {
  const sorted = [...images].sort((a, b) => a.after - b.after);
  return (
    <div className="flow-root">
      {paragraphs.map((p, i) => {
        const here = sorted.filter((im) => im.after === i - 1);
        return (
          <div key={i} className="flow-root">
            {here.map((im) => {
              const k = sorted.indexOf(im);
              const right = k % 2 === 0;
              return (
                <img
                  key={im.src}
                  src={im.src}
                  alt={im.alt}
                  loading="lazy"
                  width={640}
                  height={640}
                  className={`mb-2 mt-5 h-auto w-[30%] min-w-[104px] max-w-[230px] rounded-card ${right ? "float-right ml-4" : "float-left mr-4"}`}
                />
              );
            })}
            <Prose text={p} story={!essay} essay={essay} />
          </div>
        );
      })}
    </div>
  );
}
