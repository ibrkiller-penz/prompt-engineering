import { useEffect, type ReactNode } from "react";
import { Link } from "react-router-dom";
import kits from "../../../content/board/kits.json";
import { HUB_NAME } from "../../site";

// penedu.web.app/deck — 보드가 '도우미가 필요해요' 창에서 알려 주는 짧은 주소(펌웨어의 DECK_HELP_URL 과 같게).
// 다른 컴퓨터에서 처음 여는 쪽이라 /board 의 틀(프로·맥스 고르기 창 등) 없이 받기만 크게 보인다.
// PC용은 exe 판 하나만(예전 PowerShell 판 설치.bat 은 2026-10-27 에 없앰).
function mb(bytes: number) {
  return bytes ? ` · ${(bytes / 1024 / 1024).toFixed(1)}MB` : "";
}

function Steps({ items }: { items: ReactNode[] }) {
  return (
    <ol className="mt-4 space-y-4">
      {items.map((s, i) => (
        <li key={i} className="flex gap-4 rounded-card border border-line bg-surface p-4 leading-relaxed">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink">{i + 1}</span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  );
}

export default function DeckGet() {
  useEffect(() => {
    document.title = `단축키 도우미 받기 · ${HUB_NAME}`;
  }, []);
  const install = [
    <>
      아래 <b>[도우미 받기]</b>를 눌러 압축 파일을 받아요. 인터넷 창이 “흔하지 않은 파일”이라고 하면 <b>[유지]</b>를 눌러요.
    </>,
    <>
      받은 압축 파일을 더블클릭해 열고, 안의 <b>교실알림판_도우미.exe</b> 를 더블클릭해요(압축을 풀지 않아도 돼요). 파란{" "}
      <b>“Windows의 PC 보호”</b> 창이 뜨면 <b>[추가 정보] → [실행]</b>.
    </>,
    <>
      화면 오른쪽 아래 작업 표시줄(<b>^</b> 안쪽)에 알림판 아이콘이 생겨요. 보드를 USB 로 꽂으면 <b>초록</b>으로 바뀌어요. 관리자 권한은 필요 없고,
      컴퓨터를 켤 때 저절로 켜져요.
    </>,
    <>보드에서 단축키 단추를 눌러요. 이 컴퓨터에서 프로그램·사이트가 열려요.</>,
  ];
  const custom = [
    <>
      작업 표시줄의 알림판 아이콘을 <b>오른쪽 클릭 → [단축키 꾸미기…]</b>. 가운데 보드 모양, 오른쪽 <b>동작 목록</b>, 아래 <b>칸 설정</b>이 보여요.
    </>,
    <>
      오른쪽 목록에서 원하는 것(예: 한글, 나이스, 소리 크게, 발표 시작)을 <b>끌어서 칸에 놓아요</b>. 이름·하는 일·아이콘이 한꺼번에 들어가요. 찾기 칸에
      “소리”, “유튜브”처럼 치면 바로 나와요. 칸끼리 끌면 자리가 바뀌어요.
    </>,
    <>
      처음이면 위의 <b>[한 번에 채우기]</b>가 편해요 — <b>이 컴퓨터에 깔린 프로그램으로</b>, 수업용, 업무용, 발표·원격수업용 중에서 고르면 16칸이 한 번에
      채워져요. <b>[아이콘 모양]</b>에서 보드 색 테마(따뜻함·남색밤·밝은종이·고대비·숲초록)에 맞출 수 있어요.
    </>,
    <>
      칸을 누르고 <b>[▶ 눌러 보기]</b>로 이 컴퓨터에서 먼저 해 본 뒤, <b>[저장하고 보드에 보내기]</b>. 보드 화면에 “아이콘 받는 중 3/16” → “새 단축키를
      받았습니다”가 나오면 끝(7인치는 16칸 다 바꾸면 1분쯤).
    </>,
  ];
  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl px-4 py-10 sm:py-16 lg:max-w-6xl lg:px-8 2xl:max-w-7xl">
      {/* 넓은 화면: 위는 [소개·받기 | 화면 그림], 아래는 [깔기·안 될 때 | 칸 꾸미기] 두 단 */}
      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:items-center lg:gap-12">
      <div>
      <p className="text-sm font-semibold tracking-widest text-accent">교실 알림판 · 7인치·4인치 공통 · 윈도 PC용</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">단축키 도우미 받기</h1>
      <p className="mt-3 leading-relaxed text-muted">
        보드의 단축키 단추를 누르면 <b className="text-ink">이 컴퓨터</b>의 프로그램·사이트가 열리게 해 주는 작은 프로그램(exe)이에요. 보드의 16칸을{" "}
        <b className="text-ink">스트림덱처럼</b> 마음대로 꾸며 보낼 수도 있어요. 보드를 꽂은 컴퓨터에 한 번만 깔면 돼요.
      </p>

      <a
        href={`/board/${kits.helperExe.file}`}
        download="교실알림판_도우미.zip"
        className="mt-6 flex min-h-[64px] items-center justify-center rounded-card bg-accent px-6 text-lg font-extrabold text-accent-ink hover:brightness-110"
      >
        ⬇ 도우미 받기 (교실알림판_도우미.exe{mb(kits.helperExe.bytes)})
      </a>
      <a
        href={`/board/${kits.helperManual.file}`}
        target="_blank"
        rel="noreferrer"
        className="mt-3 flex min-h-[48px] items-center justify-center rounded-card border border-line bg-surface px-6 font-bold hover:border-accent"
      >
        📘 사용 설명서 PDF 보기{mb(kits.helperManual.bytes)}
      </a>
      <p className="mt-2 text-center text-sm text-muted">
        설명서·읽어보기·끄기 파일까지 든 꾸러미:{" "}
        <a href={`/board/${kits.helper.file}`} download className="font-semibold text-accent underline">
          {kits.helper.file}
          {mb(kits.helper.bytes)}
        </a>
      </p>
      </div>
      <img
        src="/board/deck-helper-screen.png"
        alt="단축키 꾸미기 창: 가운데 보드 미리보기, 오른쪽 동작 목록, 아래 칸 설정"
        className="mt-8 w-full rounded-card border border-line shadow-lg lg:mt-0"
        loading="lazy"
      />
      </div>

      <div className="lg:mt-6 lg:grid lg:grid-cols-2 lg:gap-12">
      <div>
      <h2 className="mt-10 text-xl font-extrabold">① 깔기</h2>
      <Steps items={install} />
      <TroubleShoot />
      </div>

      <div>
      <h2 className="mt-10 text-xl font-extrabold">② 칸 꾸미기 (스트림덱처럼)</h2>
      <Steps items={custom} />
      <ul className="mt-4 list-disc space-y-2 pl-5 leading-relaxed text-muted">
        <li>
          <b className="text-ink">그림 파일</b>을 칸에 끌어다 놓으면 아이콘만 바뀌어요. 인공지능으로 아이콘을 만들 땐 <b className="text-ink">정사각형 1024×1024,
          배경 투명 PNG, 가운데 굵은 기호 하나</b>로 만들면 보드에서 또렷해요.
        </li>
        <li>
          <b className="text-ink">[더보기] → 내보내기·가져오기</b>로 꾸민 16칸을 파일 하나로 다른 선생님과 나눌 수 있어요.
        </li>
        <li>
          <b className="text-ink">여러 동작</b>: 칸 하나로 여러 일을 차례대로 해요(예: 파워포인트 열기 → 2초 → 나이스 열기 → 소리 끄기). 하는 일에서{" "}
          <b className="text-ink">[여러 동작]</b> → <b className="text-ink">[동작 차례 고치기…]</b>.
        </li>
        <li>
          <b className="text-ink">단축키 눌러서 넣기</b>: 단축키 칸의 <b className="text-ink">[눌러서 넣기]</b>를 누르고 키보드에서 Ctrl+Shift+M 처럼 그대로 누르면
          들어가요. Win 키 조합(Win+Shift+S 화면 캡처 등)도 돼요.
        </li>
        <li>
          <b className="text-ink">[자세히…]</b>: 프로그램은 함께 열 파일·시작 폴더·관리자 권한·“이미 열려 있으면 그 창을 앞으로”, 사이트는 브라우저(크롬·엣지·웨일)·새 창,
          글자는 “넣고 Enter”.
        </li>
        <li>키보드: 화살표 칸 옮기기 · Enter 눌러 보기 · Delete 비우기 · Ctrl+C/V 복사·붙여넣기 · Ctrl+S 저장</li>
      </ul>
      </div>
      </div>

      <p className="mt-10 text-sm text-muted">
        알림판을 직접 만들어 보려면{" "}
        <Link to="/board" className="font-semibold text-accent underline">
          시간표 단말 만들기
        </Link>
        로 가요. · 글꼴: 에스코어 드림(S-Core)
      </p>
    </main>
  );
}

function TroubleShoot() {
  return (
    <>
      <h2 className="mt-10 text-xl font-extrabold">안 될 때</h2>
      <ul className="mt-3 list-disc space-y-2 pl-5 leading-relaxed text-muted">
        <li>
          보드가 컴퓨터에 <b className="text-ink">데이터 케이블</b>로 꽂혀 있어야 해요. 7인치는 <b className="text-ink">‘UART’</b> 단자, 4인치는{" "}
          <b className="text-ink">USB-C</b> 단자예요.
        </li>
        <li>
          컴퓨터를 다시 켠 뒤 아이콘이 안 보이면: <b className="text-ink">시작 메뉴</b>에서 <b className="text-ink">‘교실알림판 도우미’</b>를 눌러 켜요. 보드
          단축키 화면 오른쪽 아래 <b className="text-ink">⟳</b> 단추를 누르면 연결을 바로 다시 확인해요.
        </li>
        <li>
          아이콘이 회색에서 바뀌지 않으면: 아이콘 오른쪽 클릭 → <b className="text-ink">기록 보기</b>. “알림판 아님”이 보이면 보드 프로그램이 예전 것이라 다시
          구워야 해요. 꾸민 칸을 보내지 못하면(“이 보드는 아이콘 받기를 못 해요”) 마찬가지로 보드를 새로 구워요.
        </li>
        <li>
          학교 백신이 exe 를 막으면: 백신의 <b className="text-ink">예외(허용)</b>에 교실알림판_도우미.exe 를 넣어 주세요. 끄고 지우려면 꾸러미의{" "}
          <b className="text-ink">끄기.bat</b>.
        </li>
      </ul>
    </>
  );
}
