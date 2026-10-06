import { useState } from "react";
import { Link } from "react-router-dom";
import { BoardChip, Callout, Check, Code, H2, PageNav, PageTitle, Steps, Table } from "./kit";

type Board = "7" | "4";

export default function Flash() {
  const [b, setB] = useState<Board>("7");
  const seven = b === "7";
  return (
    <>
      <PageTitle
        tag="3 · 처음 굽기"
        title="프로그램을 보드에 넣기"
        lead="‘굽는다’는 프로그램을 보드의 저장 공간(플래시)에 쓰는 일이에요. 처음에는 오래 걸리지만 한 번만 그래요."
      />

      <div className="flex gap-2" role="tablist" aria-label="보드 고르기">
        {(["7", "4"] as const).map((x) => (
          <button
            key={x}
            type="button"
            role="tab"
            aria-selected={b === x}
            onClick={() => setB(x)}
            className={`min-h-[44px] rounded-full px-5 font-bold ${
              b === x ? "bg-accent text-accent-ink" : "border border-line bg-surface text-muted hover:text-ink"
            }`}
          >
            {x === "7" ? "7인치 보드" : "4인치 보드"}
          </button>
        ))}
      </div>

      <section role="tabpanel" className="mt-2">
        <H2>1. 연결하고 확인하기</H2>
        <Steps>
          <>
            <b>보드를 PC에 꽂아요.</b>{" "}
            {seven ? (
              <>
                보드에 USB-C 포트가 두 개 있어요. <b>‘UART’라고 적힌 쪽</b>에 데이터용 케이블을 꽂아요. 굽기와 기록 보기가 모두 이 포트로 돼요. 옆의 <b>UART2 단자</b>(작은 핀
                단자)는 보조라서 굽기가 안 돼요.
              </>
            ) : (
              <>
                보드의 USB-C 단자에 데이터용 케이블을 꽂아요. 칩 안쪽 USB(USB-Serial/JTAG)라서 굽기와 기록 보기가 모두 이 단자로 돼요.
              </>
            )}
          </>
          <>
            <b>COM 번호를 찾아요.</b> 장치 관리자의 ‘포트(COM & LPT)’ 아래에 새로 생긴 항목의 번호예요(예: COM3).
            <Code>{`python -c "import serial.tools.list_ports as l; [print(p.device, p.description) for p in l.comports()]"`}</Code>
          </>
          <>
            <b>보드가 맞는지 확인해요.</b> 아래처럼 <b>ESP32-S3, 플래시 16MB, PSRAM 8MB</b>가 나오면 맞아요.
            <Code>{`python -m esptool --port COM3 flash-id`}</Code>
          </>
        </Steps>

        {seven ? (
          <Callout tone="warn" title="포트가 안 보이면 (7인치)">
            <p>
              Waveshare 설명서에 따르면 ‘UART’ 포트는 굽기·기록용이에요. 그래도 PC가 포트를 못 잡으면 <b>BOOT 버튼을 누른 채</b> 케이블을 꽂고, 켜진 뒤에 BOOT를 놓아요. 굽기가 끝나면
              RESET 버튼으로 다시 시작해요. (‘UART’가 아닌 쪽 USB-C는 CAN과 핀을 나눠 써서 기본 상태로는 PC가 잡지 못해요.)
            </p>
          </Callout>
        ) : (
          <Callout tone="warn" title="포트가 안 보이면 (4인치)">
            <p>
              보드를 BOOT 버튼을 누른 채 꽂았다가 BOOT를 놓으면 굽기 모드로 들어가요(ESP32-S3 공통 방법). 프로그램이 멈춘 보드는 포트가 사라질 수 있어요.
            </p>
          </Callout>
        )}

        <H2>2. 내 값 넣기</H2>
        <p className="mt-3 max-w-3xl leading-relaxed">
          <code>{seven ? "7inch" : "4inch"}\firmware\include\board_config.h</code> 한 파일에 <b>사람마다 다른 값</b>이 모여 있어요. 처음에는 샘플 값 그대로 두고 <b>먼저 화면부터 띄워</b> 봐도 돼요.
          시간표 자료 주소와 학교 코드는{" "}
          <Link to="/board/data" className="font-semibold text-accent underline">
            내 시간표 올리기
          </Link>
          에서 채워요.
        </p>
        <Table
          small
          head={["값", "무엇"]}
          rows={[
            [<code key="a">BOARD_BASE_URL</code>, "시간표 자료가 올라간 주소(끝에 / 까지)"],
            [<code key="b">BOARD_DEFAULT_TT</code>, "처음 볼 시간표 이름(내 이름 또는 학급 이름). 켠 뒤 설정 화면에서 바꿀 수 있어요"],
            [<code key="c">BOARD_TITLE</code>, "위쪽 막대에 보이는 이름"],
            [<code key="d">NEIS_*</code>, "급식을 받을 교육청·학교 코드"],
            [<code key="e">WEATHER_LAT / LON</code>, "날씨·미세먼지를 받을 학교 위치(위도·경도)"],
            [<code key="f">SUNEUNG_DATE</code>, "수능 D-day를 보이고 싶을 때 날짜(비워 두면 안 보여요)"],
          ]}
        />
        <p className="mt-2 text-sm text-muted">
          와이파이 이름·비밀번호는 <b>코드에 넣지 않아요.</b> 보드를 켠 뒤 설정 화면에서 고르고 입력하면 보드에만 저장돼요.
        </p>

        <H2>3. 빌드하고 올리기</H2>
        <p className="mt-3 max-w-3xl leading-relaxed">
          PowerShell을 <b><code>{seven ? "7inch" : "4inch"}</code> 폴더</b>에서 열고 실행해요.
        </p>
        <Code>{`powershell -NoProfile -ExecutionPolicy Bypass -File tools\\build_board.ps1 -Port COM3`}</Code>
        <p className="mt-3 max-w-3xl leading-relaxed">
          끝에 <code>[SUCCESS]</code> 와 <code>Hard resetting via RTS pin...</code> 이 나오면 보드에 올라간 거예요. 올리지 않고 빌드만 해 보려면 <code>-NoUpload</code> 를 붙여요.
        </p>
        <Callout tone="info" title="처음에는 왜 25~45분이나 걸릴까요">
          <p>
            화면이 흔들리지 않도록 ESP32의 기본 라이브러리(ESP-IDF)를 <b>다른 설정으로 다시 컴파일</b>하기 때문이에요(약 3GB를 받아 7GB로 풀려요). 설정을 바꾸지 않는 한 <b>두 번째부터는
            몇 분</b>이면 끝나요. 어떤 설정인지는{" "}
            <Link to="/board/shake" className="font-semibold text-accent underline">
              화면 흔들림
            </Link>
            에서 설명해요. 빌드 중에는 PC를 끄거나 창을 닫지 마세요.
          </p>
        </Callout>
        <Callout tone="bad" title="빌드는 키트의 스크립트로만">
          <p>
            <code>platformio run</code> 을 한글이 든 폴더에서 바로 실행하면 실패해요. 스크립트가 <b>영문 경로로 복사해서</b> 빌드해 줘요(<code>%USERPROFILE%\.pio-build</code> 아래).
          </p>
        </Callout>

        <H2>4. 켜졌는지 확인</H2>
        <Check>
          <>한글이 깨지지 않고 화면에 나와요.</>
          <>화면을 누르면 반응해요(터치).</>
          <>
            와이파이를 고르면 시간표·날씨·급식이 내려와요. 처음에는 와이파이가 없어서 비어 있는 게 정상이에요.
          </>
          <>
            재부팅(전원을 껐다 켬)해도 와이파이가 다시 붙어요.
          </>
          {seven && (
            <>
              설정 화면에서 <b>시계 화면</b>(24시간/12시간, 시계로 돌아가는 시간)과 <b>보이기</b>(날씨·미세먼지·할 일·급식·시간표·D-day) 단추가 눌리고, 바로 화면에 반영돼요.
            </>
          )}
        </Check>
        <p className="mt-3 max-w-3xl leading-relaxed">
          보드가 하는 말(기록)은 30초만 읽고 끝나는 도구로 봐요. 무한정 기다리는 명령은 쓰지 마세요.
        </p>
        <Code>{`python tools/serial_log.py 30 --port COM3 --grep "sync,download,weather,meal"`}</Code>
        {!seven && (
          <Callout tone="bad" title="4인치는 기록을 볼 때 보드를 강제로 다시 시작하지 마세요">
            <p>
              USB 신호로 보드를 강제로 다시 시작시킨 뒤 <b>부저가 계속 울린</b> 적이 있어요. USB(배터리)를 완전히 뽑고 10초 뒤 다시 꽂아야 멎었어요. 기록은 <b>읽기만</b> 하세요.
            </p>
          </Callout>
        )}

        <p className="mt-6 max-w-3xl">
          <BoardChip board={b} /> 막히면{" "}
          <Link to="/board/help" className="font-semibold text-accent underline">
            막힐 때
          </Link>
          에서 증상으로 찾아보세요.
        </p>
      </section>

      <PageNav current="/board/flash" />
    </>
  );
}
