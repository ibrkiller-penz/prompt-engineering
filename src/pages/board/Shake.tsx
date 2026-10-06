import { Link } from "react-router-dom";
import { BoardChip, Callout, Code, Ext, H2, H3, P, PageNav, PageTitle, Table } from "./kit";
import { PathFigure, SymptomFigure } from "./ShakeFigures";

export default function Shake() {
  return (
    <>
      <PageTitle
        tag="5 · 가장 중요한 노하우"
        title="화면이 흔들리고 밀릴 때"
        lead="이 보드들의 RGB 화면은 와이파이를 켜거나 저장을 할 때 지지직 떨리거나 통째로 옆으로 밀릴 수 있어요. 불량이 아니에요. 왜 그런지, 우리가 어떤 순서로 겪고 어떻게 잡아 갔는지, 그리고 지금 쓰는 설정을 모두 적었어요."
      />

      <Callout tone="ok" title="먼저 결론">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            흔들림은 <b>그림이 화면에 가는 길(메모리)이 막혀서 박자가 어긋난 것</b>이에요. 부품 고장이 아니에요.
          </li>
          <li>
            길을 막는 건 <b>와이파이·저장(플래시 쓰기)·코드 읽기·너무 잦은 전체 다시 그리기</b>예요.
          </li>
          <li>
            그래서 <b>화면은 공장 방식으로 구동</b>하고, 키트의 <b>설정 몇 줄</b>로 길이 덜 막히게 했어요. 이 설정은 키트에 이미 들어 있어요.
          </li>
          <li>
            <b>하지 말아야 할 것</b>도 있어요(맨 아래). 우리가 직접 해 보고 더 나빠졌던 것들이에요.
          </li>
        </ul>
      </Callout>

      <H2>어떻게 보이나요 — 증상 세 가지</H2>
      <SymptomFigure />
      <Table
        small
        head={["증상", "언제", "이유", "처방"]}
        rows={[
          ["지지직 떨림", "와이파이로 받는 동안, 또는 시계가 자주 바뀔 때", "PSRAM으로 가는 길이 바빠서 줄 하나씩 늦어요", "와이파이·전체 그리기 줄이기, 코드를 PSRAM에서 실행"],
          ["옆으로 밀림", "가끔 갑자기, 또는 저장·와이파이 연결 직후", "박자가 한 번 어긋나서 한 줄이 시작점에서 벗어나요", "완충 버퍼 방식 + 캐시 64B 설정"],
          ["밀린 채 안 돌아옴", "한 번 밀리면 껐다 켤 때까지", "‘자동 복구 켜기’ 설정이 완충 버퍼와 부딪치는 버그", "그 설정(RESTART_IN_VSYNC)을 켜지 않기"],
        ]}
      />

      <H2>왜 RGB 화면은 흔들릴까</H2>
      <P>
        스마트폰 화면처럼 <b>화면 안에 그림을 기억하는 칩이 있는 화면</b>은 바뀔 때만 그림을 보내면 돼요. 그런데 이 보드들의 <b>RGB 화면</b>은 그림을 기억하지 못해요. ESP32가 <b>매 1/60초쯤마다
        그림 한 장 전체를 쉬지 않고 계속</b> 보내 줘야 해요. 한 번이라도 늦으면 그 줄이 어긋나요.
      </P>
      <P>
        그림 전체(800×480 화면이면 약 750KB)는 칩이 품기에 너무 커서 <b>칩 바깥 메모리(PSRAM)</b>에 있어요. 그런데 ESP32-S3는 PSRAM과 <b>프로그램이 든 플래시를 같은 길(SPI)</b>로 써요. 와이파이가 데이터를
        주고받거나 플래시에 무언가를 저장하는 동안에는 그 길을 쓰니, 화면에 보낼 그림이 제때 못 가요.
      </P>
      <PathFigure />
      <Callout tone="info" title="Espressif 공식 설명과 같아요">
        <p>
          Espressif의 ESP-FAQ(LCD)는 이 현상(‘화면 전체가 밀리는 drift’)의 원인으로 <b>① PCLK가 높아 PSRAM·GDMA 대역폭이 모자람 ② 플래시에 쓰는 동안(와이파이·OTA·BLE 등) PSRAM이 비활성화됨 ③
          플래시·PSRAM 데이터를 대량으로 읽음</b>을 들어요. 해결로는 <b>‘XIP on PSRAM + RGB 완충(bounce) 버퍼’</b> 방식을 권해요.{" "}
          <Ext href="https://docs.espressif.com/projects/esp-faq/en/latest/software-framework/peripherals/lcd.html">ESP-FAQ(LCD) 원문</Ext>
        </p>
      </Callout>

      <H2>처방 여섯 가지</H2>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[
          ["1", "그리는 횟수 줄이기", "시계를 매초 바꾸면 매초 800×480 전체를 다시 그려요. 이 화면 연결은 한 번 그릴 때마다 전체를 PSRAM에 다시 써요. 그래서 분이 바뀔 때만 그려요."],
          ["2", "와이파이는 필요할 때만", "평소에는 꺼 두고 1시간마다 10~20초만 켜서 시간·시간표를 받아요. 와이파이가 PSRAM 길을 같이 쓰기 때문이에요."],
          ["3", "코드·상수를 PSRAM에서 실행(XIP)", "프로그램 코드와 읽기 전용 값을 PSRAM에 올려 두면, 플래시에 쓰는 동안에도 PSRAM이 멈추지 않아요. (SPIRAM_XIP_FROM_PSRAM, SPIRAM_RODATA)"],
          ["4", "캐시 설정", "데이터 캐시 줄을 64바이트로(완충 버퍼 방식에 꼭 필요해요. 아니면 화면이 밀려요). 시간 박자(FREERTOS_HZ)를 1000으로, 컴파일 최적화를 속도 쪽으로."],
          ["5", "그림판은 칩 안쪽 RAM에", "PSRAM의 프레임 버퍼는 1장만 두고, 그림을 그리는 판(LVGL)은 칩 안쪽 RAM 10~30줄로 해요. 바뀐 곳만 PSRAM에 옮겨 길을 덜 써요."],
          ["6", "공장 방식으로 구동", "제조사(Waveshare) 공장 프로그램이 쓰는 방식 — ESP-IDF의 RGB 패널 드라이버와 공장 박자 값 — 으로 화면을 구동해요. 데모의 다른 방식(Arduino로 직접 그리기)은 떨렸어요."],
        ].map(([n, t, d]) => (
          <div key={n} className="rounded-card border border-line bg-surface p-4">
            <p className="font-extrabold">
              <span className="mr-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-accent text-sm text-accent-ink">{n}</span>
              {t}
            </p>
            <p className="mt-2 text-[0.95rem] leading-relaxed text-muted">{d}</p>
          </div>
        ))}
      </div>

      <H2>우리가 겪은 순서</H2>
      <P>
        한 번에 해결되지 않았어요. 아래는 실제 작업 기록을 날짜순으로 줄인 거예요. <b>더 나빠진 시도도 그대로</b> 적었어요 — 같은 길을 가지 않도록요.
      </P>
      <H3>
        <BoardChip board="7" /> 7인치 보드
      </H3>
      <Table
        small
        head={["날짜", "한 일", "결과"]}
        rows={[
          ["9/30", "시계를 매초 바꿨어요", "매초 전체를 다시 그려서 흔들림 → 분이 바뀔 때만 그리기"],
          ["9/30", "와이파이가 켜진 채로 두었어요", "받는 동안 흔들림 → 평소 끄고 1시간마다 10~20초만 켜기"],
          ["9/30", "픽셀 클록을 16MHz → 14MHz로 낮췄어요", <><b>더 나빠졌어요.</b> 계속 지지직 → 공장 값 16MHz로 되돌림</>],
          ["9/30", "옆으로 밀림 대책으로 ESP-IDF 라이브러리를 다시 컴파일(RESTART_IN_VSYNC·ISR_IRAM_SAFE·XIP)", "한동안 좋아졌고, 10/1에 연결해 보니 떨림이 없었어요"],
          ["10/2", "4인치에서 알게 된 것: RESTART_IN_VSYNC가 오히려 ‘영구 밀림’의 원인 (아래 설명)", "그 설정을 빼고, 설정을 공장 예제와 똑같이. 프레임 버퍼 1장 + 그림판은 안쪽 RAM 10줄"],
        ]}
      />
      <H3>
        <BoardChip board="4" /> 4인치 보드
      </H3>
      <Table
        small
        head={["날짜", "한 일", "결과"]}
        rows={[
          ["10/1", "공식 데모 방식(Arduino로 직접 그리기, 12MHz 약 42Hz)", "떨려 보였어요"],
          ["10/1", "박자를 공장 값 16MHz(약 60Hz)로 맞췄어요", "그래도 Arduino로 직접 그리는 방식(그림판·화면 버퍼가 모두 PSRAM)에서는 떨림이 남았어요"],
          ["10/1", "그림은 ESP-IDF RGB 패널로 바로 보내고, 그림판은 칩 안쪽 RAM 한 장(30줄). Arduino 라이브러리는 화면 켜는 명령(초기화)만", <><b>떨림 전혀 없음</b>(확인). 다만 와이파이로 받는 20~30초 동안은 심하고 끝나면 멎어요</>],
          ["10/1", "RESTART_IN_VSYNC·ISR_IRAM_SAFE·XIP 설정 추가", "받는 중에도 정상 동작"],
          ["10/2", "화면이 영구히 밀린 채 남는 현상을 조사", "RESTART_IN_VSYNC가 원인으로 드러나 빼고, 초기화 명령도 공장 값으로. 올린 뒤 켜기·받기·터치는 정상"],
        ]}
      />
      <Callout tone="warn" title="아직 지켜보는 중이에요 (2026-10-02 기준)">
        <p>
          10월 2일에 올린 마지막 설정으로 <b>켜기·와이파이 받기·터치는 정상</b>인 것을 확인했고, <b>다시 밀리는지는 지켜보는 중</b>이에요. 새로 알게 되는 내용이 있으면 이 쪽에 이어서 적을게요.
        </p>
      </Callout>

      <H2>가장 헷갈렸던 설정 — RESTART_IN_VSYNC</H2>
      <P>
        ESP-FAQ는 ‘화면이 밀린 뒤 <b>자동으로 복구</b>해 주는’ <code>CONFIG_LCD_RGB_RESTART_IN_VSYNC</code> 를 <b>권장하지 않음(완전한 해결은 아님)</b>으로 적어요. 우리는 처음에 이 설정을 켰고 효과가 있는 것처럼
        보였어요. 그런데 나중에 <b>화면이 가끔 밀린 채로 남고, 껐다 켜야 돌아오는</b> 현상이 생겼어요.
      </P>
      <P>
        조사해 보니 ESP-IDF 5.5.x의 완충(bounce) 버퍼 방식에서 이 설정을 켜면, 박자가 <b>한 번만</b> 어긋나도 내부 계수가 되돌려지지 않아 <b>영구히</b> 밀려요(
        <Ext href="https://github.com/espressif/esp-idf/issues/19070">espressif/esp-idf#19070</Ext>). 끄면 드라이버가 어긋남을 알아채고 다음 화면에서 <b>저절로 다시 맞춰요</b>. 그래서 키트는 이 설정을 <b>켜지 않아요</b>.
      </P>
      <P>
        Waveshare 같은 계열 보드의 비슷한 사례도 참고했어요(<Ext href="https://github.com/waveshareteam/ESP32-S3-Touch-LCD-5/issues/1">waveshareteam/ESP32-S3-Touch-LCD-5#1</Ext>): 그림판을 칩 안쪽 RAM에 두고, 프레임 버퍼는 1장만 쓰는 방식이에요.
      </P>

      <H2>지금 쓰는 설정</H2>
      <P>
        키트의 <code>firmware\platformio.ini</code> 에 <code>custom_sdkconfig</code> 로 들어 있어요. 설정을 바꾸면 ESP-IDF 라이브러리를 다시 컴파일하느라 첫 빌드가 오래 걸려요(25~45분).
      </P>
      <Table
        small
        head={["", "7인치", "4인치"]}
        rows={[
          ["구동 방식", "ESP32_Display_Panel + 공장 예제 설정", "ESP-IDF esp_lcd RGB 패널(공장 BSP 방식), Arduino GFX는 초기화 명령에만"],
          ["픽셀 클록", "16MHz (낮추면 오히려 나빠짐)", "16MHz, 약 60Hz"],
          ["프레임 버퍼", "PSRAM 1장", "PSRAM 1장"],
          ["그림판(LVGL)", "칩 안쪽 RAM 10줄 (바뀐 곳만)", "칩 안쪽 RAM 30줄"],
          ["완충 버퍼", "10줄, 공장 예제와 같은 박자", "20줄"],
          ["켜는 설정", <>SPIRAM_XIP_FROM_PSRAM, SPIRAM_RODATA, ESP32S3_INSTRUCTION_CACHE_32KB, ESP32S3_DATA_CACHE_64KB, ESP32S3_DATA_CACHE_LINE_64B, FREERTOS_HZ=1000</>, <>LCD_RGB_ISR_IRAM_SAFE, SPIRAM_XIP_FROM_PSRAM, ESP32S3_DATA_CACHE_LINE_64B, COMPILER_OPTIMIZATION_PERF</>],
          ["켜지 않는 설정", <b key="a">LCD_RGB_RESTART_IN_VSYNC</b>, <b key="b">LCD_RGB_RESTART_IN_VSYNC</b>],
          ["와이파이", "평소 꺼 둠, 1시간마다 10~20초", "같은 정책(받는 동안 약 20~30초 떨림이 남을 수 있음)"],
          ["화면 갱신", "분이 바뀔 때만", "필요할 때만"],
        ]}
      />
      <Code>{`; platformio.ini (7인치) 일부
custom_sdkconfig =
  CONFIG_SPIRAM_XIP_FROM_PSRAM=y
  CONFIG_SPIRAM_RODATA=y
  CONFIG_ESP32S3_INSTRUCTION_CACHE_32KB=y
  CONFIG_ESP32S3_DATA_CACHE_64KB=y
  CONFIG_ESP32S3_DATA_CACHE_LINE_64B=y
  CONFIG_FREERTOS_HZ=1000
  ; 넣지 말 것: CONFIG_LCD_RGB_RESTART_IN_VSYNC`}</Code>
      <Callout tone="info" title="메모리도 같이 지켜요">
        <p>
          화면 물체(LVGL)가 칩 안쪽 RAM을 다 쓰면 와이파이 암호화(HTTPS)가 <code>SSL - Memory allocation failed</code> 로 모두 실패해요. 그래서 화면을 켠 <b>뒤에</b>{" "}
          <code>heap_caps_malloc_extmem_enable(64)</code> 로 ‘64바이트보다 큰 건 PSRAM에 먼저’를 켜요. 화면을 켜기 <b>전</b>에 두면 화면 드라이버 자료가 PSRAM으로 가서 부팅이 멈춰요.
        </p>
      </Callout>

      <H2>내 보드가 흔들리면 — 순서대로 보기</H2>
      <Table
        head={["이럴 때", "이렇게 해 봐요"]}
        rows={[
          [
            "와이파이로 받는 20~30초 동안만 흔들려요",
            <>우리도 같았고 끝나면 멎었어요. 받는 횟수(1시간마다)와 시간을 줄이세요. 더 줄이고 싶으면 ESP-FAQ 방법이 있어요: 연결 전에 <code>esp_lcd_rgb_panel_set_pclk()</code> 로 PCLK를 잠깐 낮추고 약 20ms 쉰 뒤 되돌려요(화면이 잠깐 깜빡일 수 있어요). 우리는 써 보지 않았어요.</>,
          ],
          [
            "계속 지지직거려요",
            <>그림판이 PSRAM에 있지 않은지(칩 안쪽 RAM이어야 해요), 전체 다시 그리기가 너무 잦지 않은지(매초 시계 등), 데이터 캐시 줄이 64B인지 확인하세요.</>,
          ],
          [
            "가끔 옆으로 밀린 채 남아요",
            <><code>RESTART_IN_VSYNC</code> 가 켜져 있지 않은지 보고, 있으면 빼요. 설정을 바꾸면 첫 빌드가 길어요.</>,
          ],
          [
            "저장하거나 와이파이를 연결한 직후에 한 번 밀려요",
            <>XIP on PSRAM 설정이 들어 있는지 확인하세요(코드를 PSRAM에서 실행하면 플래시 쓰기 중에도 PSRAM이 멈추지 않아요).</>,
          ],
          [
            "빌드해서 올렸는데 설정이 안 바뀐 것 같아요",
            <>키트의 <code>tools\build_board.ps1</code> 로 빌드했는지, <code>custom_sdkconfig</code> 변경 뒤 첫 빌드가 끝까지 돌았는지 확인하세요.</>,
          ],
        ]}
      />

      <Callout tone="bad" title="하지 말아야 할 것 — 우리가 해 보고 더 나빠졌어요">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>픽셀 클록을 낮추기</b> — 16 → 14MHz로 낮췄더니 오히려 계속 지지직거렸어요. 공장 값을 쓰세요.
          </li>
          <li>
            <b>RESTART_IN_VSYNC 켜기</b> — 완충 버퍼와 함께 쓰면 한 번 밀린 화면이 영구히 남을 수 있어요.
          </li>
          <li>
            <b>PSRAM에 그림판을 두고 Arduino로 직접 그리기</b> — 4인치에서 떨렸어요.
          </li>
          <li>
            <b>매초 화면 전체를 갱신</b> — 시계는 분이 바뀔 때만 그려요.
          </li>
        </ul>
      </Callout>

      <H2>참고한 것</H2>
      <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 leading-relaxed">
        <li>
          <Ext href="https://docs.espressif.com/projects/esp-faq/en/latest/software-framework/peripherals/lcd.html">Espressif ESP-FAQ — LCD</Ext> (drift 원인과 XIP+bounce buffer 방법)
        </li>
        <li>
          <Ext href="https://github.com/espressif/esp-idf/issues/19070">espressif/esp-idf#19070</Ext> (RESTART_IN_VSYNC와 완충 버퍼)
        </li>
        <li>
          <Ext href="https://github.com/waveshareteam/ESP32-S3-Touch-LCD-5/issues/1">waveshareteam/ESP32-S3-Touch-LCD-5#1</Ext> (같은 계열 보드의 사례)
        </li>
        <li>
          <Ext href="https://docs.waveshare.com/ESP32-S3-Touch-LCD-7">Waveshare ESP32-S3-Touch-LCD-7 문서</Ext>
        </li>
      </ul>
      <p className="mt-3 max-w-3xl text-sm text-muted">
        이 쪽의 ‘우리가 겪은 일’은 직접 만들며 남긴 작업 기록이에요. 보드 개별 차이(부품 편차·전원·공유기)로 같은 설정에서도 결과가 다를 수 있어요. 막히면{" "}
        <Link to="/board/help" className="font-semibold text-accent underline">
          막힐 때
        </Link>
        를 함께 보세요.
      </p>

      <PageNav current="/board/shake" />
    </>
  );
}
