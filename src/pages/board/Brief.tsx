import brief from "../../../content/board/brief.md?raw";
import { Button, CopyButton } from "../../components/ui";
import { Callout, H2, PageNav, PageTitle, Steps } from "./kit";

function download() {
  const blob = new Blob([brief], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "시간표단말_작업지시서.md";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function Brief() {
  return (
    <>
      <PageTitle
        tag="6 · AI에게 시키기"
        title="AI 작업지시서"
        lead="이 글을 코딩 AI에 붙여 넣으면, AI가 이 쪽의 순서대로 한 단계씩 같이 해 줘요. 로그인과 열쇠는 AI가 대신하지 않고 여러분께 부탁해요."
      />

      <Steps>
        <>
          아래 <b>전체 복사</b>를 눌러요(또는 파일로 받아요).
        </>
        <>
          Claude Code 같은 코딩 AI를 <b>키트를 푼 폴더</b>에서 열고 붙여 넣은 뒤 <b>“이 지시서대로 한 단계씩 해 줘”</b>라고 말해요.
        </>
        <>
          AI가 보드 종류(7인치·4인치)를 물어보면 대답하고, 로그인 같은 일은 안내에 따라 직접 해요.
        </>
      </Steps>

      <Callout tone="info" title="키트에도 같은 지시서가 들어 있어요">
        <p>
          내려받은 키트의 <code>CLAUDE.md</code> 는 AI가 폴더에서 일할 때 읽는 <b>보드별 상세 지시서</b>(핀·화면 설정·자료 구조)예요. 여기 글은 처음부터 끝까지 가는 <b>순서</b>예요. 둘을 같이 쓰면 가장 잘 돼요.
        </p>
      </Callout>

      <H2>작업지시서</H2>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <CopyButton text={brief} label="📋 전체 복사" />
        <Button variant="ghost" onClick={download}>
          ⬇ 파일로 받기 (.md)
        </Button>
        <span className="text-sm text-muted">{brief.length.toLocaleString()}자</span>
      </div>
      <pre className="mt-3 max-h-[640px] overflow-auto whitespace-pre-wrap rounded-card border border-line bg-surface p-4 font-sans text-[0.92rem] leading-relaxed">
        {brief}
      </pre>

      <PageNav current="/board/brief" />
    </>
  );
}
