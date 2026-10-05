// 스타일 템플릿의 작은 미리보기 (선택한 디자인의 색으로 그린다). 실제 결과는 노트북LM이 만든다.
type Colors = { bg: string; text: string; sub: string; a1: string; a2: string; point: string };

const bar = (w: string, c: string, h = "1.6cqw") => <span className="block rounded-full" style={{ width: w, height: h, background: c, opacity: 0.8 }} />;

export default function StyleMock({ id, c }: { id: string; c: Colors }) {
  const frame = "relative aspect-video overflow-hidden rounded-md border border-black/10 [container-type:inline-size]";
  const fill = "absolute inset-0 p-[6cqw]";
  switch (id) {
    case "editorial":
      return (
        <div className={frame} style={{ background: c.bg }} aria-hidden>
          <div className={fill}>
            <span className="block text-[2.6cqw] font-bold tracking-widest" style={{ color: c.a1 }}>
              KICKER
            </span>
            <span className="mt-[1cqw] block h-px w-[30cqw]" style={{ background: c.a1 }} />
            <b className="mt-[2cqw] block font-serif text-[10cqw] leading-none" style={{ color: c.text }}>
              Title
            </b>
            <div className="mt-[4cqw] grid grid-cols-2 gap-[4cqw]">
              <div className="space-y-[1.4cqw]">{bar("100%", c.sub)}{bar("85%", c.sub)}{bar("92%", c.sub)}</div>
              <div className="space-y-[1.4cqw]">{bar("90%", c.sub)}{bar("100%", c.sub)}{bar("70%", c.sub)}</div>
            </div>
          </div>
        </div>
      );
    case "bento":
      return (
        <div className={frame} style={{ background: c.bg }} aria-hidden>
          <div className={`${fill} grid grid-cols-3 grid-rows-2 gap-[2cqw] p-[4cqw]`}>
            <div className="col-span-2 row-span-2 rounded-[2.5cqw] p-[3cqw]" style={{ background: c.a1 }}>
              <b className="text-[6cqw] leading-tight" style={{ color: c.bg }}>Title</b>
            </div>
            <div className="rounded-[2.5cqw]" style={{ background: c.a2, opacity: 0.75 }} />
            <div className="flex items-center justify-center rounded-[2.5cqw]" style={{ border: `0.4cqw solid ${c.sub}` }}>
              <b className="text-[6cqw]" style={{ color: c.point }}>87</b>
            </div>
          </div>
        </div>
      );
    case "playful":
      return (
        <div className={frame} style={{ background: c.bg }} aria-hidden>
          <div className={`${fill} flex items-center justify-center`}>
            <div className="flex h-[70%] w-[70%] items-center justify-center rounded-[50%]" style={{ background: c.a1 }}>
              <b className="text-[8cqw]" style={{ color: c.bg }}>Title</b>
            </div>
            <span className="absolute left-[8cqw] top-[8cqw] h-[8cqw] w-[8cqw] rounded-full" style={{ background: c.point }} />
            <span className="absolute bottom-[8cqw] right-[10cqw] h-[6cqw] w-[6cqw] rounded-full" style={{ background: c.a2 }} />
          </div>
        </div>
      );
    case "sketch":
      return (
        <div className={frame} style={{ background: c.bg }} aria-hidden>
          <div className={fill}>
            <b className="block text-[9cqw] italic leading-none" style={{ color: c.text }}>Title</b>
            <span className="mt-[1.5cqw] block h-[1.4cqw] w-[32cqw] rounded-full" style={{ background: c.a1, transform: "rotate(-2deg)" }} />
            <div className="mt-[4cqw] space-y-[2.2cqw]">
              <span className="block w-fit px-[2cqw] text-[3.4cqw]" style={{ background: `${c.a2}55`, color: c.text }}>key word</span>
              <span className="block text-[3.4cqw]" style={{ color: c.sub }}>✓ short line</span>
            </div>
            <span className="absolute bottom-[6cqw] right-[8cqw] flex h-[14cqw] w-[14cqw] items-center justify-center rounded-full border-2 border-dashed text-[6cqw] font-bold" style={{ borderColor: c.point, color: c.point }}>3</span>
          </div>
        </div>
      );
    case "poster":
      return (
        <div className={frame} style={{ background: c.a1 }} aria-hidden>
          <div className={`${fill} flex items-end`}>
            <b className="text-[22cqw] font-black leading-[0.85]" style={{ color: c.bg }}>Aa</b>
            <span className="absolute right-[6cqw] top-[6cqw] text-[12cqw] font-black" style={{ color: c.point === c.a1 ? c.bg : c.point }}>7</span>
          </div>
        </div>
      );
    case "blueprint":
      return (
        <div
          className={frame}
          style={{
            background: `linear-gradient(${c.sub}33 1px, transparent 1px) 0 0/6cqw 6cqw, linear-gradient(90deg, ${c.sub}33 1px, transparent 1px) 0 0/6cqw 6cqw, ${c.bg}`,
          }}
          aria-hidden
        >
          <div className={`${fill} p-[5cqw]`}>
            <div className="h-full w-full p-[3cqw]" style={{ border: `0.5cqw solid ${c.a1}` }}>
              <span className="block font-mono text-[3cqw]" style={{ color: c.a1 }}>01 / 12</span>
              <b className="mt-[1cqw] block font-mono text-[6cqw]" style={{ color: c.text }}>TITLE</b>
              <span className="mt-[2cqw] block font-mono text-[3cqw]" style={{ color: c.point }}>■ 42.0 mm</span>
            </div>
          </div>
        </div>
      );
    case "glass":
      return (
        <div className={frame} style={{ background: `radial-gradient(circle at 25% 30%, ${c.a1}88, transparent 55%), radial-gradient(circle at 80% 75%, ${c.a2}88, transparent 55%), ${c.bg}` }} aria-hidden>
          <div className={`${fill} flex items-center justify-center`}>
            <div className="rounded-[3cqw] px-[8cqw] py-[6cqw] shadow-lg" style={{ background: `${c.bg}99`, border: `0.4cqw solid ${c.bg}`, backdropFilter: "blur(6px)" }}>
              <b className="text-[7cqw]" style={{ color: c.text }}>Title</b>
              <span className="mt-[1.5cqw] block h-[1.4cqw] w-[20cqw] rounded-full" style={{ background: c.sub }} />
            </div>
          </div>
        </div>
      );
    case "classic":
      return (
        <div className={frame} style={{ background: c.bg }} aria-hidden>
          <div className={`${fill} flex flex-col items-center justify-center text-center`}>
            <b className="font-serif text-[8cqw]" style={{ color: c.text }}>Title</b>
            <span className="mt-[2cqw] block h-[1.2cqw] w-[34cqw] border-y" style={{ borderColor: c.a1 }} />
            <span className="mt-[3cqw] text-[3.4cqw]" style={{ color: c.sub }}>1. First point</span>
          </div>
        </div>
      );
    default:
      return (
        <div className={frame} style={{ background: c.bg }} aria-hidden>
          <div className={`${fill} flex flex-col items-center justify-center text-center`}>
            <b className="text-[8cqw] leading-tight" style={{ color: c.text }}>Title</b>
            <span className="mt-[2cqw] block h-[1cqw] w-[26cqw] rounded-full" style={{ background: `linear-gradient(90deg,${c.a1},${c.a2})` }} />
            <span className="mt-[3cqw] text-[3.4cqw]" style={{ color: c.sub }}>subtitle</span>
          </div>
        </div>
      );
  }
}
