import { Link } from "react-router-dom";
import kits from "../../../content/board/kits.json";
import { BoardChip, Callout, H2, H3, PageTitle, Table } from "./kit";
import ScreenPreview from "./ScreenPreview";
import ScreenPreview4 from "./ScreenPreview4";
import PrincipalPreview from "./PrincipalPreview";
import { ProPath, useBoardMode } from "./mode";

function mb(bytes: number) {
  if (!bytes) return "";
  return bytes > 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)}MB` : `${Math.round(bytes / 1024)}KB`;
}

const FLOW = [
  { to: "/board/buy", t: "1 · 무엇을 살까", d: "보드 이름·버전, 케이블, 와이파이 조건" },
  { to: "/board/pc", t: "2 · PC 준비", d: "프로그램 설치와 로그인 3가지" },
  { to: "/board/flash", t: "3 · 처음 굽기", d: "프로그램을 보드에 넣고 화면 켜기" },
  { to: "/board/data", t: "4 · 내 시간표 올리기", d: "자료 형식, 무료로 올리는 법, 개인정보" },
  { to: "/board/shake", t: "5 · 화면 흔들림", d: "왜 흔들리고 어떻게 잡았나" },
  { to: "/board/brief", t: "6 · AI에게 시키기", d: "복사해서 쓰는 작업지시서" },
];

export default function BoardHome() {
  const { mode } = useBoardMode();
  return (
    <>
      <PageTitle
        tag="ESP32 터치 화면 · 따라 하기"
        title="시간표 단말 만들기"
        lead="교무실 벽이나 교실 책상에 두는 작은 터치 화면이에요. 시계·날씨·미세먼지·급식과 내 수업 시간표를 한눈에 보여 주고, 와이파이로 자료를 받아 와요. 부품은 보드 한 장과 USB 케이블이 전부예요."
      />

      {mode === "pro" && <ProPath />}
      {mode === "max" && (
        <p className="mt-2 max-w-3xl rounded-card border border-line bg-surface p-4">
          <b>맥스용</b>으로 보고 있어요. 아래 <a href="#flow" className="font-semibold text-accent underline">순서</a>대로 한 쪽씩 읽으며, 마지막 쪽의{" "}
          <Link to="/board/brief" className="font-semibold text-accent underline">맥스용 작업지시서</Link>를 AI에게 주면 AI가 한 단계씩 같이 해요.
        </p>
      )}

      <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_22rem]">
        <section>
          <ul className="grid gap-3 sm:grid-cols-2">
            {[
              ["🕒", "시계 화면", "큰 시계, 날짜, 수능 D-day(선택), 날씨·미세먼지, 지금·다음 수업"],
              ["🗓️", "시간표", "오늘·주간 시간표, 주 넘기기, 공강·지도·보강 표시"],
              ["🔎", "선생님 찾기", "이름을 누르면 지금 어느 교실에 있는지"],
              ["🍚", "급식", "나이스 급식 정보 (학교 코드만 넣으면 돼요)"],
              ["🏫", "교장실 모드", "학교 일정 사이트와 연동해 오늘·다가오는 일정, 학사 D-day, 지금 수업 중인 선생님 수"],
              ["🔋", "배터리 표시", "7인치 B·4인치는 배터리 남은 양과 충전 중을 보여 줘요"],
              ["⌨️", "단축키", "아이콘 16개를 누르면 컴퓨터의 프로그램·사이트가 열려요(컴퓨터에 작은 도우미를 켜 둬요)"],
            ].map(([i, t, d]) => (
              <li key={t} className="rounded-card border border-line bg-surface p-4">
                <p className="font-bold">
                  <span aria-hidden>{i} </span>
                  {t}
                </p>
                <p className="mt-1 text-[0.95rem] text-muted">{d}</p>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-sm text-muted">
            이 그림은 키트에 든 <b>가짜(샘플) 시간표</b>로 만든 화면 예시예요. 실제 보드 화면과 글꼴·배치가 조금 다를 수 있어요.
          </p>
        </section>
        <ScreenPreview />
      </div>

      <H2>어떤 보드로 할까</H2>
      <p className="mt-3 max-w-3xl leading-relaxed">
        <BoardChip board="7" /> 가 이 쪽의 <b>중심</b>이에요. 가로로 넓어서 주간 시간표가 한 화면에 다 들어와요. 같은 7인치에
        해상도가 더 높은 <b>7인치 B(1024×600)</b>도 같은 키트로 만들 수 있어요(빌드할 때 보드 종류만 골라요).{" "}
        <BoardChip board="4" /> 는 <b>작고 정사각형</b>이라 화면을 옆으로 밀어 넘겨요. 모든 보드가 같은 시간표 자료를 써요.
      </p>
      <Table
        head={["", "7인치", "7인치 B", "4인치"]}
        rows={[
          ["제품", "Waveshare ESP32-S3-Touch-LCD-7", "Waveshare ESP32-S3-Touch-LCD-7B", "Waveshare ESP32-S3-Touch-LCD-4 (V4.0)"],
          ["화면", "800×480 가로, 정전식 터치", "1024×600 가로, 정전식 터치 (글자·시계가 한 단계 커요)", "480×480 정사각, 정전식 터치"],
          ["보드에 연결하는 곳", "‘UART’ 표시된 USB-C (굽기·기록)", "‘UART’ 표시된 USB-C (같음)", "보드 USB-C (칩 안쪽 USB로 굽기·기록)"],
          ["화면 구성", "시계 · 주간 시간표 · 선생님 찾기 · 설정, 교장실 모드", "7인치와 같음", "시계 · 오늘 · 주간 · 선생님 찾기 · 설정 (옆으로 밀기)"],
          ["배터리 표시", "없음 (보드가 배터리 전압을 읽을 수 없어요)", "남은 양 % · 충전 중 · 충전 완료", "남은 양 % · 충전 중 · 충전 완료"],
          ["키트", "7인치 시작 프로젝트", "7인치 시작 프로젝트 (빌드 환경 board7b)", "4인치 시작 프로젝트"],
        ]}
      />

      <H3>기능 차이</H3>
      <p className="mt-2 max-w-3xl text-[0.95rem] text-muted">
        자료(시간표·날씨·급식)와 기본 기능은 같고, <b>화면을 보여 주는 방식</b>이 달라요.
      </p>
      <Table
        small
        head={["기능", "7인치", "4인치"]}
        rows={[
          ["켰을 때 첫 화면", "시계 (교장실 모드면 교장 화면)", "시계 (교장실 모드면 교장 화면)"],
          ["단축키", "위쪽 [단축키] 탭 — 8칸 × 2줄", "넷째 장 — 4칸 × 4줄"],
          ["교장실 모드", <>볼 시간표에서 <b>[교장]·[교감]</b>을 고르면 학교 일정 화면으로 바뀌어요 — 아래 ‘교장실 모드’</>, "있음 — 시계 장이 교장 화면(일정 5줄), 주간 장이 학교 일정 목록"],
          ["받은 자료가 오래되면", "‘자료 갱신 안 됨 · 10/16 기준’처럼 주황 글씨로 알려 줘요 (껐다 켜도 마지막 받은 때를 기억)", "같음"],
          ["화면 꾸밈", "따뜻한 어두운 색 · 둥근 큰 카드 · 지금 교시는 호박색 칸 · 다음 수업은 노란 테두리", "같은 따뜻한 색"],
          ["화면 넘기는 법", "위쪽 탭을 눌러요 (시간표 · 시계 · 찾기 · 설정)", "화면을 옆으로 밀어요 (아래 점이 몇 번째인지 알려 줘요)"],
          ["화면 수", "주간 시간표 · 시계 · 선생님 찾기 · 설정", "시계 · 오늘 · 주간 · 선생님 찾기 · 설정 (다섯 장)"],
          ["오늘 시간표", "시계 화면 오른쪽에 교시별 줄로 — 지금 교시는 호박색 칸에 ‘N분 남음’","있음 — 교시별 줄로 크게, 급식지도·당겨옴 표시"],
          ["주간 시간표", "가로가 넓어 월~금이 한눈에, 칸마다 과목·교실", "7교시 × 5일 격자(작은 글씨), 주 넘기기 단추"],
          ["지금·다음 수업 표시", "지금 교시 칸에 ‘N분 남음’, 수업 10분 전부터 아래에 ‘다음 수업’ 띠", "항상 ‘지금 / 다음’ 두 줄. 다음 수업이 있는 교시까지 건너뛰어 찾고, 10분 전부터 노랗게"],
          ["시계 화면", "큰 시계 · 바로 아래 날짜 · 날씨(오늘|내일)와 미세먼지 · ‘오늘’ 카드(할 일·점심/저녁) · 오른쪽에 오늘 시간표", "큰 시계 · 날씨(오늘|내일) · 미세먼지 · 지금/다음 띠 · 할 일 · 점심"],
          ["시간 표시", "24시간 또는 12시간(오전/오후)을 설정에서 골라요", "24시간 (고르는 설정 없음)"],
          ["보이는 것 고르기", <>설정 → <b>보이기</b>에서 날씨 · 미세먼지 · 할 일 · 급식 · 시간표 · D-day를 하나씩 켜고 꺼요. 끈 자리는 남은 것이 채워요</>, "없음 (모두 보여요)"],
          ["선생님 찾기", "이름을 누르면 지금 위치·다음 수업·그날 시간표", "목록에서 골라 자세히 보기"],
          ["시계로 돌아가기", "설정에서 20분(기본) · 5분 · 안 함 중에서 골라요", "20분 동안 만지지 않으면 첫 장(시계)으로 (고정)"],
          ["화면 불 끄기", "컴퓨터 도우미가 켜져 있으면 컴퓨터가 켜진 동안 끄지 않고, 컴퓨터가 꺼지면 끔. 도우미가 없으면 밤 10시~아침 7시·주말·휴일에 2분 무입력이면 끔", "같은 규칙 · 백라이트 밝기를 칩으로 조절할 수 있어요(값이 거꾸로라서 주의)"],
          ["보드가 더 가진 것", "CAN · RS485 · I2C 단자, TF 카드, 배터리 단자", "시계(RTC), microSD, RS485·CAN, 배터리 전압 확인, 부저"],
          ["화면 흔들림 대책", <>같은 원리, 설정이 조금 달라요 — <Link to="/board/shake" className="font-semibold text-accent underline">화면 흔들림</Link></>, "같은 원리, 그림 그리는 방식부터 공장 방식"],
        ]}
      />
      <p className="mt-2 max-w-3xl text-sm text-muted">
        표는 직접 만들어 쓰며 확인한 동작을 적은 거예요. 시작 프로젝트의 버전에 따라 조금 달라질 수 있어요.
      </p>

      <H3>4인치 화면 예시</H3>
      <ScreenPreview4 />

      <H2 id="principal">교장실 모드</H2>
      <p className="mt-3 max-w-3xl leading-relaxed">
        교장·교감 선생님 책상에 두는 화면이에요. 수업 시간표 대신 <b>학교 일정</b>을 크게 보여 줘요. 설정 → <b>볼 시간표</b>에서 맨 앞의{" "}
        <b>[교장]</b> 또는 <b>[교감]</b> 단추를 누르면 바로 바뀌고, 다른 선생님을 고르면 원래 화면으로 돌아와요. 7인치·7인치 B에서 돼요.
      </p>
      <PrincipalPreview />
      <Table
        small
        head={["화면", "보여 주는 것"]}
        rows={[
          ["학교 일정 8줄", "오늘 진행 중인 일정부터 다가오는 날 차례로. 오늘 일정은 제목이 길면 두 줄, 여러 날 일정은 ‘~10/24’처럼 언제까지인지. 다음 일정은 노란 테두리, 끝난 오늘 일정은 뒤로 가요"],
          ["일정 누르기", "제목 전체 · 날짜(오늘·내일·D-3) · 시간 · 장소 · 부서 · 담당 · 내용이 큰 창으로 떠요. [닫기] 또는 바깥을 눌러 닫아요"],
          ["학사 일정", "시험·행사·휴업일 3개와 D-day. 같은 이름이 이어지는 날은 ‘중간고사 · 10/28~10/30’처럼 한 줄로 묶어요"],
          ["학교 지금", "몇 교시인지, 남은 시간 링, ‘수업 중 31명 · 수업 없음 17명’. 쉬는 시간에는 다음 교시 기준, 주말·휴업일에는 ‘수업 없음’"],
          ["‘학교 지금’ 누르기", "수업 중 / 수업 없음 선생님 이름 단추가 떠요. 이름을 누르면 ‘선생님 찾기’에서 그 선생님의 오늘 수업이 보이고, [← 지금 선생님]으로 돌아와요"],
          ["[30일 일정]", "앞으로 30일 일정을 한 쪽 7개씩 넘겨 봐요 (위쪽 [시간표] 탭도 교장실 모드에서는 [학교 일정]이 돼요)"],
          ["날씨 칸", "기온·미세먼지·급식, 맨 아래 한 줄로 ‘운동장 활동 가능 / 야외 활동 주의 / 실내 활동 권장’"],
        ]}
      />
      <Callout tone="info" title="학교 일정 사이트와 연동">
        <p>
          보드는 1시간마다 학교 일정 사이트(구글 Apps Script로 만든 일정 등록 페이지)를 읽어 와요. 사이트 주소는 키트의{" "}
          <code>board_config.local.h</code> 에 <code>SCHEDULE_URL</code> 로 넣어요. 이 파일은 git 과 내려받기 키트에 들어가지 않아요.
          일정 사이트의 형식이 다르면 AI 작업지시서와 함께 맞춰 고치면 돼요.
        </p>
      </Callout>
      <Callout tone="bad" title="선생님 이름">
        <p>
          ‘수업 중 선생님’ 명단은 선생님 위치 파일(<code>where.json</code>)에서 셈해요. 이 파일도 인터넷 주소에 올라가므로, 실명을 쓸지 학교 방침을 먼저
          확인해 주세요.
        </p>
      </Callout>

      <H2 id="flow">{mode === "pro" ? "자세히 알고 싶을 때 (맥스용 순서)" : "순서"}</H2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {FLOW.map((f) => (
          <li key={f.to}>
            <Link
              to={f.to}
              className="block h-full rounded-card border border-line bg-surface p-4 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-md"
            >
              <p className="font-extrabold">{f.t}</p>
              <p className="mt-1 text-[0.95rem] text-muted">{f.d}</p>
            </Link>
          </li>
        ))}
      </ul>

      <H2 id="download">내려받기</H2>
      <p className="mt-3 max-w-3xl leading-relaxed">
        학교·교사 이름, 학교 코드, 주소가 <b>하나도 들어 있지 않은</b> 시작 프로젝트예요. 샘플 시간표가 들어 있어서, 내 자료를 넣기 전에도 화면이 떠요.
      </p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {(
          [
            ["7", "7인치 시작 프로젝트", kits["7inch"]],
            ["4", "4인치 시작 프로젝트", kits["4inch"]],
          ] as const
        ).map(([b, name, k]) => (
          <li key={b} className="flex flex-col rounded-card border border-line bg-surface p-4">
            <p className="font-extrabold">
              <BoardChip board={b} /> <span className="ml-1">{name}</span>
            </p>
            <p className="mt-1 text-sm text-muted">
              펌웨어 · 빌드 도구 · 샘플 자료 · 작업지시서(CLAUDE.md){k.bytes ? ` · ${mb(k.bytes)}` : ""}
            </p>
            <a
              href={`/board/${k.file}`}
              download
              className="mt-3 inline-flex min-h-[44px] items-center justify-center rounded-card bg-accent px-4 font-semibold text-accent-ink hover:brightness-110"
            >
              ⬇ {k.file}
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-sm text-muted">
        압축은 <b>영문 경로</b>(예: <code>C:\dev</code>)에 풀어 주세요. 한글 폴더에서는 빌드가 멈춰요.
      </p>

      <H2>시작하기 전에 알아 둘 것</H2>
      <Callout tone="bad" title="시간표를 올릴 때 개인정보">
        <p>
          보드는 인터넷 주소에서 시간표 파일을 받아 가요. <b>그 주소를 아는 사람은 누구나 파일을 볼 수 있어요.</b> 교사 실명이 든 시간표를 올리기 전에
          학교 방침을 확인하고, 내 시간표만 올리거나 이름 대신 ‘국어A’ 같은 표기를 쓰는 방법을 먼저 생각해 주세요. 자세한 내용은{" "}
          <Link to="/board/data" className="font-semibold text-accent underline">
            내 시간표 올리기
          </Link>
          에 있어요.
        </p>
      </Callout>
      <Callout tone="warn" title="시간과 준비">
        <p>
          Windows PC가 필요하고, 첫 빌드는 <b>25~45분</b> 걸려요(두 번째부터는 몇 분). 디스크 여유는 15GB 이상 있어야 해요. 코드는 AI(Claude Code 같은
          코딩 AI)와 함께 고쳐요 — 그래서 복사해서 쓰는{" "}
          <Link to="/board/brief" className="font-semibold text-accent underline">
            작업지시서
          </Link>
          를 준비했어요.
        </p>
      </Callout>
      <Callout tone="info" title="이 쪽의 가장 큰 노하우">
        <p>
          RGB 화면은 와이파이를 켜거나 저장을 할 때 <b>지지직 떨리거나 통째로 옆으로 밀릴 수</b> 있어요. 우리가 겪은 순서와 마지막에 정착한 설정을{" "}
          <Link to="/board/shake" className="font-semibold text-accent underline">
            화면 흔들림
          </Link>
          에 자세히 적었어요.
        </p>
      </Callout>
    </>
  );
}
