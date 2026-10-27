import { Link } from "react-router-dom";
import kits from "../../../content/board/kits.json";
import { Callout, H2, P, PageNav, PageTitle, Steps, Table } from "./kit";

// 5 · 탭덱 — 보드의 단축키 단추를 컴퓨터에서 받아 여는 PC 프로그램(예전 이름 '단축키 도우미'). 받기·설명서는 /deck 과 /board/manual
function mb(bytes: number) {
  return bytes ? ` · ${(bytes / 1024 / 1024).toFixed(1)}MB` : "";
}

export default function TapDeck() {
  return (
    <>
      <PageTitle
        tag="5 · 탭덱"
        title="탭덱 — 보드 단추로 컴퓨터 열기"
        lead="보드의 단축키 단추를 누르면 컴퓨터의 프로그램·사이트가 열려요. 보드를 꽂은 윈도 컴퓨터에 작은 프로그램 탭덱(TapDeck)을 켜 두면 돼요. 16칸은 스트림덱처럼 마음대로 꾸며 보드로 보내요."
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <figure>
          <img src="/board/tapdeck-board.png" alt="보드의 단축키 화면: 탐색기·나이스·유튜브·한글 등 16칸" className="w-full rounded-card border border-line" />
          <figcaption className="mt-1.5 text-sm text-muted">보드 — 단추를 누르면 컴퓨터에서 바로 열려요</figcaption>
        </figure>
        <figure>
          <img src="/board/deck-helper-screen.png" alt="탭덱의 단축키 꾸미기 창: 보드 모양 미리보기, 오른쪽 동작 목록, 아래 칸 설정" className="w-full rounded-card border border-line" />
          <figcaption className="mt-1.5 text-sm text-muted">컴퓨터 — 탭덱에서 칸을 끌어다 놓아 꾸며요</figcaption>
        </figure>
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Link to="/deck" className="inline-flex min-h-[48px] items-center rounded-card bg-accent px-5 font-bold text-accent-ink hover:brightness-110">
          ⬇ 탭덱 받기{mb(kits.helperExe?.bytes ?? 0)}
        </Link>
        <a href="/board/manual/index.html" target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center rounded-card border-2 border-accent bg-surface px-5 font-bold hover:bg-accent-soft">
          📘 설명서 보기 · 따라 하기
        </a>
        <a href={`/board/${kits.helperManual?.file ?? "deck-helper-manual.pdf"}`} target="_blank" rel="noreferrer" className="inline-flex min-h-[48px] items-center rounded-card border border-line bg-surface px-5 font-semibold hover:border-accent">
          인쇄용 PDF
        </a>
      </div>

      <H2>3분이면 돼요</H2>
      <Steps>
        {[
          <>위의 <b>[탭덱 받기]</b>를 눌러 받은 압축 파일을 열고, 안의 <b>탭덱.exe</b> 를 두 번 클릭해요. 파란 ‘Windows의 PC 보호’ 창이 뜨면 [추가 정보] → [실행].</>,
          <>보드를 데이터 케이블로 꽂아요(7인치는 ‘UART’ 단자, 4인치는 USB-C). 작업 표시줄의 탭덱 아이콘이 <b>초록</b>이 되면 연결된 거예요.</>,
          <>보드의 단축키 단추를 눌러 보세요. 컴퓨터에서 프로그램이 열려요. 칸을 바꾸려면 보드 단축키 화면 왼쪽 아래 <b>[⚙ 꾸미기]</b>를 누르세요. 컴퓨터에 꾸미기 창이 떠요.</>,
        ]}
      </Steps>

      <H2>이런 걸 할 수 있어요</H2>
      <Table
        small
        head={["기능", "예"]}
        rows={[
          ["보드에서 바로 꾸미기", <>보드의 <b>[⚙ 꾸미기]</b> 단추를 누르면 컴퓨터 화면 맨 앞에 꾸미기 창이 떠요</>],
          ["되돌리기", "잘못 바꿨으면 Ctrl+Z(되돌리기)·Ctrl+Y(다시 하기). 저장할 때마다 예비 파일을 남겨 설정이 깨져도 되살려요"],
          ["여러 동작 묶기", <>칸 하나를 <b>‘수업 시작’</b>으로: 파워포인트 열기 → 2초 → 나이스 열기 → 소리 끄기</>],
          ["아이콘 모음 205개", "마이크로소프트·어도비·구글·한컴·학교 사이트·인공지능·윈도 도구. 보드 색 테마에 맞춘 모양 6가지"],
          ["단축키 눌러서 넣기", "Ctrl+Shift+M, Win+Shift+S(화면 캡처)처럼 키보드로 누른 그대로"],
          ["한 번에 채우기", "이 컴퓨터에 깔린 프로그램으로 16칸 자동, 또는 수업용·업무용·발표용 묶음"],
          ["나누기", "꾸민 16칸을 파일 하나로 내보내 다른 선생님이 가져오기"],
          ["처음 쓰는 분께", "처음 켜면 둘러보기 안내, 연습 과제 6가지, 그림 설명서(F1)"],
        ]}
      />
      <P>
        컴퓨터가 켜져 있는 동안 보드 화면을 끄지 않고, 컴퓨터가 꺼지면 보드도 화면을 꺼요. 보드 프로그램은 다시 굽지 않아도 칸이 바뀌어요.
      </P>

      <Callout tone="info" title="보드에 ‘탭덱이 필요해요’가 뜨면">
        <p>
          탭덱이 없는 컴퓨터에서 단축키를 누르면 보드가 짧은 주소 <Link to="/deck" className="font-semibold text-accent underline">penedu.web.app/deck</Link> 을 알려 줘요. 그
          컴퓨터의 인터넷 창에 치면 바로 받을 수 있어요.
        </p>
      </Callout>

      <PageNav current="/board/tapdeck" />
    </>
  );
}
