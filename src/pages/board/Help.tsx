import { Link } from "react-router-dom";
import { BoardChip, Callout, H2, PageNav, PageTitle, Table } from "./kit";

export default function Help() {
  return (
    <>
      <PageTitle
        tag="막힐 때"
        title="증상으로 찾기"
        lead="직접 만들며 실제로 겪은 것들이에요. 위에서부터 훑어서 내 증상과 같은 줄을 찾아보세요."
      />

      <H2>공통</H2>
      <Table
        small
        head={["증상", "원인", "해결"]}
        rows={[
          [
            <>빌드가 <code>CMake Error</code> · <code>cannot open map file</code></>,
            "프로젝트 경로에 한글·빈칸",
            <><code>C:\dev\영문이름</code> 처럼 영문 경로에서 작업하고, 키트의 <code>tools\build_board.ps1</code> 로 빌드해요(영문 경로로 복사해 빌드해 줘요).</>,
          ],
          [
            <><code>Could not open COM3, the port is busy</code></>,
            "다른 창이 시리얼을 잡고 있거나 보드가 빠짐",
            "시리얼 창·모니터를 닫고 케이블을 확인해요. 파이썬으로 기록을 읽다 멈춘 창이 있는지도 봐요.",
          ],
          [
            "굽는 중 글자 오류로 멈추고 포트가 계속 잡혀 있어요",
            "esptool 진행 막대 글자를 cp949로 못 써서 멈춤",
            <>환경변수 <code>PYTHONIOENCODING=utf-8</code>, <code>PYTHONUTF8=1</code> 을 켜고 다시 해요(키트의 빌드 스크립트에 이미 들어 있어요).</>,
          ],
          [
            "PowerShell 스크립트의 한글이 깨지고 문법 오류가 나요",
            ".ps1 파일이 BOM 없는 UTF-8",
            <>파일을 <b>UTF-8 BOM</b>으로 저장해요.</>,
          ],
          [
            "월~목만 보이고 금요일이 잘려요",
            "화면 크기 설정이 보드와 안 맞음",
            <>7인치는 <b>800×480</b>이에요. 펌웨어의 해상도 설정(<code>ESP_PANEL_USE_1024_600_LCD</code>)이 0인지 확인해요. 4인치는 480×480 고정이에요.</>,
          ],
          [
            <>HTTPS가 <code>SSL - Memory allocation failed</code> 로 모두 실패해요</>,
            "화면 물체(LVGL)가 칩 안쪽 RAM을 다 씀",
            <>화면을 켠 <b>뒤에</b> <code>heap_caps_malloc_extmem_enable(64)</code>. 앞에 두면 부팅이 멈춰요. 자세히는 <Link to="/board/shake" className="font-semibold text-accent underline">화면 흔들림</Link>.</>,
          ],
          [
            "시간표가 반쪽만 받아져요 (JSON 오류)",
            "조각으로 오는 응답이 도중에 끊김(-11 시간 초과)",
            <>HTTP/1.0 + 15초 제한으로 받고, <b>크기와 JSON을 확인한 뒤에만</b> 저장본을 바꿔요. 키트에 이미 반영돼 있어요.</>,
          ],
          [
            "와이파이가 안 붙어요",
            "5GHz이거나, 웹 로그인이 있는 망, 신호 약함",
            <>2.4GHz·로그인 없는 망인지 확인해요. 보드 기록의 이유 코드로 구분돼요: <b>201</b> 그 이름의 공유기를 못 찾음, <b>15·204·202</b> 비밀번호 문제, <b>200</b> 신호가 약함. 같은 이름의 공유기가 여러 대면 가장 센 곳에 붙어요.</>,
          ],
          [
            "비밀번호 없는 와이파이인데 비밀번호를 물어요",
            "옛 펌웨어",
            "최신 펌웨어는 비밀번호 없이 바로 붙어요. 키트를 다시 받아 올려요.",
          ],
          [
            <><code>firebase projects:create</code> 가 실패해요</>,
            "표시 이름에 한글",
            "표시 이름을 영문으로 해요. 프로젝트 ID가 이미 있다고 나오면 뒤에 숫자를 붙여요.",
          ],
          [
            "화면이 지지직·옆으로 밀려요",
            "와이파이·저장과 화면이 PSRAM 길을 같이 씀",
            <><Link to="/board/shake" className="font-semibold text-accent underline">화면 흔들림</Link> 쪽을 순서대로 따라가요. <b>픽셀 클록을 낮추지 마세요.</b></>,
          ],
        ]}
      />

      <H2>
        <BoardChip board="7" /> 7인치만
      </H2>
      <Table
        small
        head={["증상", "원인", "해결"]}
        rows={[
          [
            <><code>No serial data received</code> — 보드가 응답이 없어요</>,
            <>‘UART’가 아닌 단자(UART2 핀 단자 등)에 꽂음</>,
            <>‘UART’라고 적힌 <b>USB-C</b>에 꽂아요. UART2 핀 단자는 보조라서 굽기·기록이 안 돼요.</>,
          ],
          [
            "PC가 COM 포트를 못 잡아요",
            <>USB 포트와 CAN이 핀을 나눠 쓰는데 기본값이 CAN 쪽이에요(Waveshare 설명서의 FAQ)</>,
            <>굽기·기록은 ‘UART’ 포트로 해요. 그래도 안 되면 <b>BOOT 버튼을 누른 채</b> 케이블을 꽂고 켜진 뒤 BOOT를 놓아요. 굽기가 끝나면 RESET을 눌러요.</>,
          ],
          [
            "USB-C 충전기로는 안 켜져요",
            "C 충전기의 전원 요청 신호를 보드가 못 보내는 것으로 보임 (같은 계열 5인치 보드에서 겪음)",
            <><b>USB-A 충전기 + A-C 케이블</b>, 5V 2A 이상을 써요.</>,
          ],
        ]}
      />

      <H2>
        <BoardChip board="4" /> 4인치만
      </H2>
      <Table
        small
        head={["증상", "원인", "해결"]}
        rows={[
          [
            "화면이 완전히 깜깜해요 (켜졌는데 아무것도 안 보여요)",
            <>백라이트 밝기 값이 <b>거꾸로</b>예요. 0이 가장 밝고 255가 꺼짐인데 255를 썼어요</>,
            <>도우미 칩(CH32)은 ESP를 다시 시작해도 안 풀려요. <b>USB(배터리)를 완전히 뽑아 전원을 끊었다가</b> 다시 꽂아요. 밝기 값은 ‘0이 가장 밝다’는 것만 기억해 두세요(Waveshare 예제 설명의 ‘255가 가장 밝다’는 틀려요).</>,
          ],
          [
            "부저 소리가 계속 나요",
            "USB 신호로 보드를 강제로 다시 시작한 뒤 도우미 칩이 상태를 쥐고 있음",
            <>USB(배터리)를 뽑고 10초 뒤 다시 꽂아요. 기록을 볼 때는 강제 재시작(<code>--reset</code>)을 쓰지 말고 읽기만 해요.</>,
          ],
          [
            "글자는 안 보이고 띠·칸만 보여요",
            "글꼴이 압축 형식인데 압축 글꼴 설정이 꺼져 있음",
            <><code>lv_conf.h</code> 의 <code>LV_USE_FONT_COMPRESSED</code> 를 <b>1</b>로 해요.</>,
          ],
          [
            <>빌드 중 <code>Network.h</code> 를 못 찾아요</>,
            <><code>lib_ldf_mode = deep+</code> 설정</>,
            "그 줄을 지우고 기본값으로 둬요.",
          ],
          [
            "microSD가 안 되거나 화면 켜기가 이상해요",
            "SD 카드 핀(1·2)이 화면 초기화 신호 핀과 겹침",
            "SD 카드는 화면 초기화가 끝난 뒤에만 써요.",
          ],
          [
            "화면이 거꾸로 나와요",
            "데모 기본 회전이 180°",
            <>USB 단자를 왼쪽에 둔 설치에서는 회전을 0으로 써요(키트 기본값).</>,
          ],
        ]}
      />

      <Callout tone="info" title="그래도 안 되면">
        <p>
          AI에게 <b>오류 메시지 전체</b>와 “어느 쪽 보드인지, 몇 번째 단계인지”를 함께 알려 주세요. 작업지시서에는 ‘같은 오류가 세 번 나면 멈추고 원인과 선택지를 설명한다’는 규칙이 있어요.
          비밀번호·열쇠는 붙여 넣지 마세요.
        </p>
      </Callout>

      <PageNav current="/board/help" />
    </>
  );
}
