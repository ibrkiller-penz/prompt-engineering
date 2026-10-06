import { Link } from "react-router-dom";
import { Callout, Check, Code, Ext, H2, H3, P, PageNav, PageTitle, Steps, Table } from "./kit";

export default function MyData() {
  return (
    <>
      <PageTitle
        tag="4 · 내 시간표"
        title="내 시간표를 올리고 보드에 연결하기"
        lead="보드는 인터넷 주소에서 시간표 파일을 받아 와요. 그 파일을 무료로 올려 두는 곳이 필요해요. 이 쪽은 Firebase Hosting(무료 요금제)을 써요."
      />

      <H2>보드는 무엇을 받아 올까</H2>
      <P>
        <code>BOARD_BASE_URL</code> 아래에서 세 가지 파일을 받아요. 켤 때와 그 뒤 1시간마다 받아요.
      </P>
      <Table
        small
        head={["파일", "내용"]}
        rows={[
          [<code key="a">index.json</code>, "볼 수 있는 시간표 목록(이름·학급·특별실)과 교시 시각"],
          [<code key="b">t/001.json …</code>, "시간표 하나당 파일 하나. 주별·날짜별 칸(과목·교실·종류)이 들어 있어요"],
          [<code key="c">where.json</code>, "‘선생님 찾기’용. 선생님별 앞으로 며칠의 수업 위치"],
        ]}
      />
      <p className="mt-3 max-w-3xl text-sm text-muted">
        칸 하나는 <code>[종류, 과목, 교실, 꼬리표]</code> 네 값이에요. 종류는 수업·동아리·지도·행사 등으로 색이 달라요. 필드 하나하나는 키트의{" "}
        <code>common\tools\data-format.md</code> 에 정리돼 있어요.
      </p>

      <H2>1단계 · 샘플로 먼저 해 보기</H2>
      <p className="mt-3 max-w-3xl leading-relaxed">
        내 학교 자료를 만들기 전에, 키트에 든 <b>가짜 시간표</b>로 ‘올리기 → 보드에서 받기’ 전체 길을 한 번 돌려 봐요. 이 길이 되면 나머지는 자료를 바꾸는 일뿐이에요.
      </p>
      <Steps>
        <>
          <b>샘플 자료를 만들어요.</b>
          <Code>{`node common/tools/make_sample_data.mjs`}</Code>
          <p className="mt-1 text-sm text-muted">
            <code>common\site\public\board\</code> 아래에 <code>index.json</code>, <code>t\</code>, <code>where.json</code> 이 생겨요. 이름은 모두 가짜예요.
          </p>
        </>
        <>
          <b>Firebase 프로젝트를 만들어요</b>(내 Google 계정으로). 표시 이름에 <b>한글을 넣으면 실패</b>해요. 프로젝트 ID는 전 세계에서 하나뿐이어야 해서, 이미 있다고 나오면 뒤에 숫자를 붙여요.
          <Code>{`firebase projects:create 내영문이름-board --display-name "My Board"`}</Code>
        </>
        <>
          <b>이름을 내 프로젝트로 바꿔요.</b> <code>common\site\firebase.json</code> 의 <code>site</code> 와 <code>common\site\.firebaserc</code> 의 <code>default</code> 에 방금 만든 ID를 넣어요.
        </>
        <>
          <b>올려요.</b>
          <Code>{`cd common\\site
firebase deploy --only hosting --project 내영문이름-board`}</Code>
        </>
        <>
          <b>열어 봐요.</b> 브라우저에서 <code>https://내영문이름-board.web.app/board/index.json</code> 이 열려야 해요.
        </>
        <>
          <b>보드에 알려 줘요.</b> <code>7inch\firmware\include\board_config.h</code>(4인치는 <code>4inch\...</code>)의 <code>BOARD_BASE_URL</code> 을{" "}
          <code>https://내영문이름-board.web.app/board/</code> 로 바꾸고(끝의 <code>/</code> 까지), 다시 굽거나(<Link to="/board/flash" className="font-semibold text-accent underline">처음 굽기</Link>의 3번) 이미 구운 보드는 같은 명령으로 올려요.
        </>
      </Steps>
      <Callout tone="ok" title="확인">
        <p>
          보드에서 와이파이를 고르면 기록에 <code>sync: ok</code> 비슷한 줄이 나오고, 화면에 샘플 시간표가 떠요.
        </p>
      </Callout>

      <H2>2단계 · 내 시간표로 바꾸기</H2>
      <P>
        학교마다 시간표를 만드는 프로그램과 내보내기 형식이 달라서, <b>내 자료를 위 형식으로 바꾸는 변환 도구</b>는 직접 만들어야 해요. 이 일을 AI에게 시키면 돼요.
      </P>
      <Steps>
        <>
          내 시간표를 파일로 뽑아요(시간표 프로그램의 내보내기, 엑셀, 나이스 등). <b>이 파일은 컴퓨터 안에만 두고</b> 저장소나 인터넷에 올리지 않아요.
        </>
        <>
          AI에게 <code>common\tools\data-format.md</code> 와 샘플 자료를 보여 주고, “내 파일을 이 형식으로 바꾸는 변환 도구를 <code>common\tools\</code> 에 만들어 줘. 먼저 한 사람 것만 해 보자”라고 시켜요.
          작업지시서에 이 부탁이 이미 들어 있어요(
          <Link to="/board/brief" className="font-semibold text-accent underline">
            AI 작업지시서
          </Link>
          ).
        </>
        <>
          만든 결과를 <code>common\site\public\board\</code> 에 넣고 다시 올려요. 보드는 1시간 안에 새 자료를 받아요.
        </>
      </Steps>

      <Callout tone="bad" title="인터넷 주소에 올린 시간표는 누구나 볼 수 있어요">
        <ul className="list-disc space-y-1 pl-5">
          <li>Firebase에 올린 파일은 주소를 아는 사람이면 누구나 열 수 있어요. 주소를 모르게 감춰도 안전하다고 할 수 없어요.</li>
          <li>교사 실명이 든 전체 시간표를 올리기 전에 <b>학교 방침(개인정보 담당)</b>을 확인하세요.</li>
          <li>가장 안전한 시작은 <b>내 시간표 한 장만</b> 올리는 거예요. 이름 대신 ‘국어A’ 같은 표기로 바꿔도 돼요.</li>
          <li>학생 이름·번호가 든 자료는 올리지 마세요. 이 키트는 시간표만 다뤄요.</li>
        </ul>
      </Callout>

      <H2>급식·날씨</H2>
      <H3>급식(나이스)</H3>
      <P>
        나이스 교육정보 개방 포털의 급식 정보를 인증키 없이 받아요(인증키 없이는 한 번에 5건까지라서 하루치만 받아요). 교육청 코드와 학교 코드를 알아야 해요. 학교 이름으로 찾아봐요.
      </P>
      <Code>{`https://open.neis.go.kr/hub/schoolInfo?Type=json&SCHUL_NM=학교이름`}</Code>
      <P>
        결과의 <code>ATPT_OFCDC_SC_CODE</code>(교육청 코드)와 <code>SD_SCHUL_CODE</code>(학교 코드)를 <code>board_config.h</code> 의 <code>NEIS_*</code> 에 넣어요. 13:30 전에는 점심, 그 뒤에는 저녁이 보여요. 알레르기 번호는
        빼고 보여 줘요. 학교 코드는 학교 이름을 알면 누구나 찾을 수 있는 공개 정보예요.
      </P>
      <H3>날씨·미세먼지</H3>
      <P>
        <Ext href="https://open-meteo.com/">Open-Meteo</Ext>를 써서 <b>열쇠(API 키)가 필요 없어요.</b> 학교 위치의 위도·경도만 넣어요(지도 앱에서 학교를 길게 눌러 좌표를 볼 수 있어요). 미세먼지는 측정소 값이 아니라 <b>모델이 추정한 값</b>이에요.
      </P>
      <Check>
        <>샘플 시간표가 보드에 떴어요.</>
        <>
          내 시간표로 바꾼 뒤, 보드 설정에서 내 이름을 골랐더니 내 주간 시간표가 나와요.
        </>
        <>급식과 날씨 칸에 내 학교 정보가 떠요.</>
      </Check>

      <PageNav current="/board/data" />
    </>
  );
}

