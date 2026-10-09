import { ART } from "./games/registry";

/** 게임 썸네일: 그라데이션 배경 + 장식 동그라미 + 큰 그림 문자 두 개 */
export default function Thumb({ id, size = "md", bob = false }: { id: string; size?: "md" | "lg"; bob?: boolean }) {
  const a = ART[id] ?? { e: "🎮", c: ["#c4b5fd", "#7c3aed"] as [string, string] };
  const big = size === "lg";
  return (
    <div
      className="relative overflow-hidden"
      style={{ background: `radial-gradient(circle at 30% 25%, ${a.c[0]} 0%, ${a.c[1]} 85%)`, aspectRatio: "1 / 1" }}
      aria-hidden
    >
      <span className="absolute -left-4 -top-4 h-16 w-16 rounded-full bg-white/25" />
      <span className="absolute -bottom-6 -right-6 h-24 w-24 rounded-full bg-white/20" />
      <span className="absolute right-4 top-5 h-3 w-3 rounded-full bg-white/60" />
      <span className="absolute bottom-6 left-5 h-2 w-2 rounded-full bg-white/70" />
      <span
        className={`absolute inset-0 flex items-center justify-center ${bob ? "gz-bob" : ""}`}
        style={{ fontSize: big ? 112 : 64, filter: "drop-shadow(0 6px 6px rgba(0,0,0,.25))" }}
      >
        {a.e}
      </span>
      {a.e2 && (
        <span className="absolute bottom-[10%] right-[12%]" style={{ fontSize: big ? 48 : 28, filter: "drop-shadow(0 3px 3px rgba(0,0,0,.25))" }}>
          {a.e2}
        </span>
      )}
    </div>
  );
}
