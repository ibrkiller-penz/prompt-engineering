import { Link } from "react-router-dom";
import { Callout, Check, Code, Ext, H2, PageNav, PageTitle, Steps } from "./kit";

export default function PcSetup() {
  return (
    <>
      <PageTitle
        tag="2 · PC 준비"
        title="프로그램 설치와 로그인"
        lead="보드에 프로그램을 넣으려면 PC에 도구 몇 가지가 필요해요. 키트 안의 설치 스크립트가 한 번에 깔아 주고, 아래 명령을 하나씩 입력해도 같아요."
      />

      <Callout tone="bad" title="작업 폴더는 영문·숫자만, 빈칸 없이">
        <p>
          <code>C:\dev</code> 처럼 한글이 없는 폴더에서 작업하세요. 한글·빈칸이 든 경로에서는 보드 빌드 도구(CMake·링커)가 멈춰요. 문서 폴더나 바탕화면
          안에 두지 마세요.
        </p>
      </Callout>

      <H2>설치할 것</H2>
      <Steps>
        <>
          <b>키트를 풀어요.</b> <Link to="/board#download" className="font-semibold text-accent underline">시작 쪽</Link>의 내려받기에서 보드에 맞는 zip을 받아{" "}
          <code>C:\dev\</code> 에 풀어요. 안에 <code>common</code> 폴더(공통)와 <code>7inch</code> 또는 <code>4inch</code> 폴더(보드별)가 있고, 설치 스크립트는 <code>common\tools\setup.ps1</code> 이에요.
        </>
        <>
          <b>설치 스크립트를 실행해요.</b> 이미 깔린 것은 건너뛰어서 여러 번 돌려도 돼요. 중간에 ‘허용’ 창이 뜨면 모두 [예]를 눌러요. 스크립트는 글로 열어서 무엇을 하는지
          읽어 볼 수 있어요.
          <Code>{`cd C:\\dev\\<푼 폴더 이름>
powershell -NoProfile -ExecutionPolicy Bypass -File common\\tools\\setup.ps1`}</Code>
        </>
        <>
          <b>스크립트 대신 직접 할 때</b>(같은 결과예요):
          <Code>{`winget install --id Git.Git -e
winget install --id Python.Python.3.12 -e
winget install --id OpenJS.NodeJS.LTS -e
winget install --id GitHub.cli -e
python -m pip install --upgrade platformio esptool pyserial pillow
npm install -g firebase-tools`}</Code>
          <p className="mt-2 text-sm text-muted">
            설치 뒤에는 새 터미널 창을 열어야 새 프로그램이 잡혀요. 확인표에 <b>X</b>가 남으면 스크립트를 한 번 더 실행해요.
          </p>
        </>
        <>
          <b>코딩 AI를 준비해요.</b> 이 쪽은 Claude Code와 함께 작업하도록 썼어요(
          <Ext href="https://docs.claude.com/en/docs/claude-code/overview">설치 안내</Ext>). 다른 코딩 AI도 되지만 작업지시서대로 움직이는지 확인해 주세요. AI 맞춤 설정은{" "}
          <Link to="/setup" className="font-semibold text-accent underline">AI 맞춤 설정</Link> 쪽을 참고하세요.
        </>
      </Steps>

      <H2>로그인 3가지는 직접</H2>
      <p className="mt-3 max-w-3xl leading-relaxed">
        이름·메일·계정이 필요한 일은 AI가 대신하지 않고 <b>여러분이 직접</b> 해요. 비밀번호나 열쇠를 AI에게 붙여 넣지 마세요.
      </p>
      <Code>{`git config --global user.name "영문이름"
git config --global user.email "메일주소"
gh auth login
firebase login`}</Code>
      <p className="mt-2 text-sm text-muted">
        <code>gh auth login</code>(GitHub)은 저장소에 올릴 때만 필요해요. 건너뛰어도 보드는 만들 수 있어요.
      </p>

      <H2>보드 USB 드라이버</H2>
      <ul className="mt-3 max-w-3xl list-disc space-y-1 pl-5 leading-relaxed">
        <li>
          <b>7인치</b> — ‘UART’ 표시된 USB-C에 꽂으면 CH343 변환 칩이 COM 포트를 만들어요. Windows 11은 보통 저절로 잡혀요. 안 보이면 칩 제조사(WCH)의 CH343 드라이버를
          설치해요.
        </li>
        <li>
          <b>4인치</b> — ESP32-S3 칩 안쪽 USB(USB-Serial/JTAG)를 써서 별도 드라이버가 필요 없어요.
        </li>
      </ul>

      <H2>확인</H2>
      <Check>
        <>
          <code>python --version</code>, <code>node --version</code>, <code>git --version</code>, <code>python -m platformio --version</code> 이 모두 버전을 보여 줘요.
        </>
        <>
          <code>firebase login:list</code> 에 내 Google 계정이 보여요.
        </>
        <>
          작업 폴더 경로에 한글이 없고, 디스크 여유가 15GB 이상이에요.
        </>
      </Check>

      <PageNav current="/board/pc" />
    </>
  );
}
