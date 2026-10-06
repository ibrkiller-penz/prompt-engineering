import { BoardChip, Callout, Check, Ext, H2, PageNav, PageTitle, Table } from "./kit";

export default function Buy() {
  return (
    <>
      <PageTitle
        tag="1 · 준비물"
        title="무엇을 살까"
        lead="보드 이름과 버전이 조금만 달라도 핀 배치와 칩이 달라서, 이 쪽의 프로그램이 그대로 돌지 않을 수 있어요. 사기 전에 아래 이름과 숫자를 꼭 맞춰 보세요."
      />

      <H2>보드</H2>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <section className="rounded-card border-2 border-accent bg-surface p-5">
          <p className="font-extrabold">
            <BoardChip board="7" /> <span className="ml-1">중심 보드</span>
          </p>
          <h3 className="mt-2 text-xl font-extrabold">Waveshare ESP32-S3-Touch-LCD-7</h3>
          <ul className="mt-3 space-y-1 text-[0.95rem]">
            <li>화면: 7인치 IPS <b>800×480</b>, 정전식 터치(5점)</li>
            <li>칩: ESP32-S3, <b>플래시 16MB + PSRAM 8MB</b> (N16R8)</li>
            <li>와이파이 2.4GHz · 블루투스 5(LE)</li>
            <li>USB-C 포트 2개(‘UART’ 표시 / USB), CAN·RS485·I2C 단자, TF 카드, 3.7V 배터리 단자</li>
            <li>전원 5V, 약 450mA</li>
          </ul>
          <Callout tone="warn" title="터치 포함 판을 사세요">
            <p>
              같은 계열에 터치가 없는 <b>ESP32-S3-LCD-7</b>(별도 상품 번호)도 있어요. 이 쪽은 손으로 누르는 화면이 필요하니 이름에{" "}
              <b>Touch</b>가 들어간 것을 고르세요.
            </p>
          </Callout>
          <p className="mt-3 text-sm text-muted">
            제품 설명서: <Ext href="https://docs.waveshare.com/ESP32-S3-Touch-LCD-7">Waveshare 문서</Ext>
          </p>
        </section>

        <section className="rounded-card border border-line bg-surface p-5">
          <p className="font-extrabold">
            <BoardChip board="4" /> <span className="ml-1">서브 보드</span>
          </p>
          <h3 className="mt-2 text-xl font-extrabold">Waveshare ESP32-S3-Touch-LCD-4 (V4.0)</h3>
          <ul className="mt-3 space-y-1 text-[0.95rem]">
            <li>화면: 4인치 <b>480×480</b> 정사각, 정전식 터치</li>
            <li>칩: ESP32-S3, <b>플래시 16MB + PSRAM 8MB</b> (N16R8)</li>
            <li>와이파이 2.4GHz · 블루투스</li>
            <li>시계(RTC)·microSD·RS485·CAN, 백라이트·리셋을 맡는 도우미 칩(CH32V003) 포함</li>
          </ul>
          <Callout tone="warn" title="버전(V4.0)을 확인하세요">
            <p>
              이 쪽은 <b>V4.0</b> 보드로 만들고 확인했어요. 다른 버전은 화면 칩·핀이 다를 수 있어서 그대로 따라 하면 안 될 수 있어요. 우리는 쿠팡에서 샀고, V4.0 보드임을 확인했어요.
            </p>
          </Callout>
        </section>
      </div>

      <Callout tone="ok" title="사기 전 두 숫자 확인">
        <p>
          판매 페이지에 <b>16MB 플래시</b>와 <b>8MB PSRAM</b>이 적혀 있어야 해요. 이 쪽의 설정이 두 숫자를 전제로 해요. 받은 뒤에는{" "}
          <code>python -m esptool flash-id</code> 로 한 번 더 확인해요(다음 쪽들에서 해 봐요).
        </p>
      </Callout>

      <H2>함께 필요한 것</H2>
      <Table
        head={["준비물", "비고"]}
        rows={[
          ["USB-C 케이블", <><b>데이터용</b>이어야 해요. 충전 전용 케이블은 PC가 보드를 못 알아봐요.</>],
          ["전원", <>PC USB로 켜도 되고, 따로 둘 때는 <b>USB-A 충전기(5V 2A 이상) + A-C 케이블</b>을 권해요. 5인치 같은 계열 보드에서 USB-C 충전기로는 켜지지 않았어요(7·4인치에서는 따로 시험하지 않았어요).</>],
          ["와이파이", <><b>2.4GHz</b>, 웹 로그인(동의 화면) 없는 것. 보드는 5GHz를 잡지 못해요. 학교망이면 정보부서에 2.4GHz·기기 등록 여부를 미리 물어보세요.</>],
          ["PC", "Windows 10/11, 빈 디스크 15GB 이상(ESP32 도구만 약 7GB), 관리자 권한"],
          ["계정", <>Google 계정(자료를 무료로 올리는 Firebase용). GitHub 계정은 선택이에요.</>],
          ["AI", "Claude Code 같은 코딩 AI (코드를 같이 고쳐 줘요)"],
          ["선택", "스탠드·케이스, 3.7V 리튬 배터리(단일 셀) — 없어도 돼요"],
        ]}
      />
      <p className="mt-3 max-w-3xl text-sm text-muted">
        가격과 파는 곳은 시기마다 달라서 적지 않았어요. 쿠팡·알리익스프레스·Waveshare 공식몰 등에서 위 이름으로 찾아보세요.
      </p>

      <H2>받으면 먼저</H2>
      <Check>
        <>상자 안 구성품(보드, 케이블 등)을 확인해요.</>
        <>보드 뒷면의 이름·버전 글자가 위의 것과 같은지 봐요.</>
        <>USB 케이블로 PC에 꽂았을 때 보드 화면이 켜지는지 봐요(공장 프로그램이 들어 있어요). 이 프로그램은 곧 우리 프로그램으로 바뀌어요.</>
      </Check>

      <PageNav current="/board/buy" />
    </>
  );
}
