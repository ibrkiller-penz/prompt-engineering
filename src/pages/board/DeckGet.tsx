import { useEffect } from "react";
import { Link } from "react-router-dom";
import kits from "../../../content/board/kits.json";
import { HUB_NAME } from "../../site";

// penedu.web.app/deck — 보드가 '도우미가 필요해요' 창에서 알려 주는 짧은 주소(펌웨어의 DECK_HELP_URL 과 같게).
// 다른 컴퓨터에서 처음 여는 쪽이라 /board 의 틀(프로·맥스 고르기 창 등) 없이 받기만 크게 보인다.
function kb(bytes: number) {
  return bytes ? ` · ${Math.round(bytes / 1024)}KB` : "";
}

export default function DeckGet() {
  useEffect(() => {
    document.title = `단축키 도우미 받기 · ${HUB_NAME}`;
  }, []);
  const steps = [
    <>
      받은 압축 파일을 더블클릭해 열고, 안의 <b>교실알림판_도우미.exe</b> 를 더블클릭해요(압축을 풀지 않아도 돼요). 파란 <b>“Windows의 PC 보호”</b> 창이
      뜨면 <b>[추가 정보] → [실행]</b>. 인터넷 창이 “흔하지 않은 파일”이라고 하면 <b>[유지]</b>를 눌러요.
    </>,
    <>
      화면 오른쪽 아래 작업 표시줄(<b>^</b> 안쪽)에 알림판 아이콘이 생겨요. 보드와 이어지면 <b>초록</b>으로 바뀌어요. 관리자 권한은 필요 없고, 컴퓨터를
      켤 때 저절로 켜져요.
    </>,
    <>보드에서 단축키 단추를 다시 눌러요. 이 컴퓨터에서 프로그램·사이트가 열려요.</>,
  ];
  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-4 py-10 sm:py-16">
      <p className="text-sm font-semibold tracking-widest text-accent">교실 알림판 · 7인치·4인치 공통</p>
      <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">단축키 도우미 받기</h1>
      <p className="mt-3 leading-relaxed text-muted">
        보드의 단축키 단추를 누르면 <b className="text-ink">이 컴퓨터</b>의 프로그램·사이트가 열리게 해 주는 작은 프로그램이에요. 보드를 꽂은 컴퓨터에 한 번만
        깔면 돼요.
      </p>

      <a
        href={`/board/${kits.helperExe.file}`}
        download="교실알림판_도우미.zip"
        className="mt-6 flex min-h-[64px] items-center justify-center rounded-card bg-accent px-6 text-lg font-extrabold text-accent-ink hover:brightness-110"
      >
        ⬇ 도우미 받기 (교실알림판_도우미{kb(kits.helperExe.bytes)})
      </a>

      <ol className="mt-8 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-4 rounded-card border border-line bg-surface p-4 leading-relaxed">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink">{i + 1}</span>
            <span>{s}</span>
          </li>
        ))}
      </ol>

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
          구워야 해요.
        </li>
        <li>
          학교 백신이 exe 를 막으면{" "}
          <a href={`/board/${kits.helper.file}`} download className="font-semibold text-accent underline">
            압축 꾸러미{kb(kits.helper.bytes)}
          </a>
          를 받아 풀고 <b className="text-ink">설치.bat</b> 을 더블클릭해요(같은 일을 해요).
        </li>
      </ul>

      <p className="mt-10 text-sm text-muted">
        알림판을 직접 만들어 보려면{" "}
        <Link to="/board" className="font-semibold text-accent underline">
          시간표 단말 만들기
        </Link>
        로 가요.
      </p>
    </main>
  );
}
