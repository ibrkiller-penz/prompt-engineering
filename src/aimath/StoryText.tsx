import RichMath from "./RichMath";
import type { StoryImage } from "./types";

/** 이야기 문단들 사이에 작은 삽화를 글 옆에 띄워 넣는다. 삽화는 가로폭의 30%(최대 230px, 최소 104px)이고 좌우로 번갈아 놓인다. */
export default function StoryText({ paragraphs, images = [] }: { paragraphs: string[]; images?: StoryImage[] }) {
  const sorted = [...images].sort((a, b) => a.after - b.after);
  return (
    <div className="flow-root">
      {paragraphs.map((p, i) => {
        const here = sorted.filter((im) => im.after === i - 1);
        return (
          <div key={i} className="flow-root">
            {here.map((im) => {
              const right = sorted.indexOf(im) % 2 === 0;
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
            <p className="mt-3 leading-[1.9]"><RichMath text={p} /></p>
          </div>
        );
      })}
    </div>
  );
}
