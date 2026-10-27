import { useState } from "react";
import brief from "../../../content/board/brief.md?raw";
import briefPro from "../../../content/board/brief_pro.md?raw";
import { Button, CopyButton } from "../../components/ui";
import { Callout, H2, PageNav, PageTitle, Steps, Table } from "./kit";
import { useBoardMode } from "./mode";

function download(text: string, name: string) {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

const KINDS = {
  pro: { label: "프로용 (토큰 적게)", text: briefPro, file: "시간표단말_작업지시서_프로.md" },
  max: { label: "맥스용 (자세히)", text: brief, file: "시간표단말_작업지시서_맥스.md" },
} as const;

export default function Brief() {
  const { mode } = useBoardMode();
  const [kind, setKind] = useState<keyof typeof KINDS>(mode ?? "pro");   // 처음에 고른 길로 연다
  const k = KINDS[kind];
  return (
    <>
      <PageTitle
        tag="7 · AI에게 시키기"
        title="AI 작업지시서"
        lead="AI 사용량(토큰)에 맞춰 두 가지로 나눴어요. 프로용은 스크립트가 일하고 AI는 막힐 때만, 맥스용은 AI가 한 단계씩 같이 해요."
      />

      <Table
        small
        head={["", "프로용 (토큰 적게)", "맥스용 (자세히)"]}
        rows={[
          ["이런 분께", "Claude Pro 등 사용량이 넉넉하지 않을 때", "Claude Max 등 사용량이 넉넉할 때, 처음부터 원리까지 알고 싶을 때"],
          ["누가 일하나", <>키트의 <code>quick_start.ps1</code> 이 설치 확인·자료 올리기·내 값·빌드·굽기를 차례로</>, "AI가 단계마다 실행하고 결과를 확인한 뒤 다음으로"],
          ["AI를 부를 때", "막혔을 때 빨간 줄 몇 개만 붙여 넣기", "처음부터 끝까지 같이"],
          ["AI가 읽는 것", <>짧은 안내판(<code>CLAUDE.md</code>)과 <code>docs/지시서_프로.md</code></>, <><code>docs/지시서_맥스.md</code> (핀·화면 설정·자료 구조까지)</>],
        ]}
      />

      <Steps>
        <>아래에서 <b>프로용</b> 또는 <b>맥스용</b>을 고르고 <b>전체 복사</b>를 눌러요(또는 파일로 받아요).</>
        <>
          Claude Code 같은 코딩 AI를 <b>키트를 푼 폴더</b>에서 열고 붙여 넣은 뒤 <b>“프로로 하자”</b> 또는 <b>“맥스로 하자”</b>라고 말해요.
        </>
        <>로그인 같은 일은 안내에 따라 직접 해요.</>
      </Steps>

      <Callout tone="info" title="키트 안에도 같은 두 가지가 들어 있어요">
        <p>
          키트의 <code>7inch/CLAUDE.md</code> 는 AI가 대화마다 다시 읽는 파일이라 <b>일부러 짧게</b> 만들었어요(안내판). AI는 처음에 “프로로 할까요, 맥스로
          할까요?”를 묻고 고른 쪽 지시서만 읽어요. 빌드 도구도 결과 몇 줄만 보여 줘서 토큰을 덜 써요.
        </p>
      </Callout>

      <H2>작업지시서</H2>
      <div className="mt-3 flex flex-wrap gap-2" role="tablist" aria-label="지시서 고르기">
        {(Object.keys(KINDS) as (keyof typeof KINDS)[]).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={kind === key}
            onClick={() => setKind(key)}
            className={`min-h-[44px] rounded-card border px-4 font-semibold ${
              kind === key ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {KINDS[key].label}
          </button>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton text={k.text} label="📋 전체 복사" />
        <Button variant="ghost" onClick={() => download(k.text, k.file)}>
          ⬇ 파일로 받기 (.md)
        </Button>
        <span className="text-sm text-muted">{k.text.length.toLocaleString()}자</span>
      </div>
      <pre className="mt-3 max-h-[640px] overflow-auto whitespace-pre-wrap rounded-card border border-line bg-surface p-4 font-sans text-[0.92rem] leading-relaxed">
        {k.text}
      </pre>

      <PageNav current="/board/brief" />
    </>
  );
}
