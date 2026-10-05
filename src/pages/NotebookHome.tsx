import { useEffect } from "react";
import { Link } from "react-router-dom";
import { HUB_NAME } from "../site";
import SectionIcon from "../components/SectionIcon";

/** 제미나이 노트북(노트북LM) 안의 하위 메뉴. 새 메뉴는 여기에 한 줄 추가하고 App.tsx에 라우트를 연결한다. */
const MENUS = [
  {
    path: "/notebook/slides",
    title: "슬라이드·인포그래픽 프롬프트",
    tag: "디자인 18종 · 구성 방식 10가지",
    desc: "디자인을 고르면 대본 → 슬라이드·인포그래픽 프롬프트가 채워져요. 복사해서 붙여 넣기만 하면 돼요.",
    cta: "프롬프트 만들러 가기 →",
  },
  {
    path: "/notebook/cases",
    title: "활용 사례",
    tag: "오디오·동영상·퀴즈·마인드맵·표·채팅",
    desc: "슬라이드 말고도 할 수 있는 것들. 수업에 바로 쓰는 프롬프트가 사례마다 들어 있어요.",
    cta: "활용 사례 보러 가기 →",
  },
];

const PANELS = [
  { n: 1, name: "소스", desc: "자료를 올리는 곳. 체크한 자료만 근거로 써요." },
  { n: 2, name: "채팅", desc: "질문하거나 프롬프트를 붙여 넣는 곳." },
  { n: 3, name: "스튜디오", desc: "슬라이드·퀴즈·오디오 같은 결과물을 만드는 곳." },
];

const SOURCE_WAYS = [
  "파일 올리기 (PDF·Word·PowerPoint·텍스트·이미지·오디오 등)",
  "웹 주소(URL) 넣기",
  "YouTube 링크 넣기 (자막이 있는 공개 영상)",
  "구글 드라이브의 문서·슬라이드 가져오기",
  "복사한 글 붙여 넣기",
  "웹에서 소스 찾기 (Fast Research · Deep Research)",
];

/** 제미나이 노트북(노트북LM) 첫 화면 — 하위 메뉴와 처음 쓰는 방법 */
export default function NotebookHome() {
  useEffect(() => {
    document.title = `제미나이 노트북 · ${HUB_NAME}`;
  }, []);
  return (
    <div className="min-h-screen">
      <main className="mx-auto max-w-4xl px-4 py-8 sm:py-12">
        <Link to="/" className="inline-flex min-h-[44px] items-center gap-2 text-sm font-semibold text-muted hover:text-ink">
          <img src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8" />
          {HUB_NAME}
        </Link>
        <div className="mt-4 flex items-center gap-4">
          <SectionIcon path="/notebook" size={64} />
          <div className="min-w-0">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">제미나이 노트북</h1>
            <p className="text-muted">예전 이름은 노트북LM(NotebookLM)이에요.</p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-lg text-muted">
          올려 둔 자료만 근거로 답하고 결과물을 만들어 주는 구글의 AI 노트북이에요. 수업 자료로 슬라이드·퀴즈·오디오 같은 것을 만들 수 있어요.
        </p>

        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {MENUS.map((m) => (
            <li key={m.path}>
              <Link
                to={m.path}
                className="group block h-full rounded-card border border-line bg-surface p-5 transition hover:-translate-y-0.5 hover:border-accent hover:shadow-lg"
              >
                <span className="inline-block rounded-full bg-accent-soft px-3 py-0.5 text-sm font-semibold text-accent">{m.tag}</span>
                <div className="mt-2 flex items-center gap-3">
                  <SectionIcon path={m.path} size={44} />
                  <h2 className="text-xl font-extrabold leading-tight">{m.title}</h2>
                </div>
                <p className="mt-2 text-muted">{m.desc}</p>
                <span className="mt-3 inline-block font-semibold text-accent group-hover:underline">{m.cta}</span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="mt-10 rounded-card border border-line bg-surface p-5 sm:p-6" aria-labelledby="start">
          <h2 id="start" className="text-xl font-bold">
            처음이세요? 화면은 세 칸이에요
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-3">
            {PANELS.map((p) => (
              <div key={p.n} className="rounded-card border border-line bg-bg p-3">
                <b className="text-lg">
                  {p.n}번 {p.name}
                </b>
                <p className="mt-1 text-sm text-muted">{p.desc}</p>
              </div>
            ))}
          </div>

          <h3 className="mt-6 font-bold">자료(소스)를 넣는 방법은 여러 가지예요</h3>
          <p className="text-sm text-muted">왼쪽 1번 소스 칸의 [+ 추가]를 눌러요.</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {SOURCE_WAYS.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>

          <h3 className="mt-6 font-bold">알아 두면 좋아요</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li>결과물은 AI가 만들어서 사실과 다르거나 어색할 수 있어요. 수업에 쓰기 전에 꼭 확인하세요.</li>
            <li>만 18세 이상만 쓸 수 있고, 만들려면 노트북의 수정 권한이 필요해요. 학생에게는 교사 계정으로 만든 결과물을 나눠 주세요.</li>
            <li>쓸 자료만 체크하면 그 자료만 근거로 써요. 결과물마다 체크를 바꿔 가며 쓰면 좋아요.</li>
          </ul>
          <p className="mt-4 text-xs text-muted">
            참고: 공식 도움말{" "}
            <a className="underline" href="https://support.google.com/notebooklm/answer/16206563?hl=ko" target="_blank" rel="noopener">
              노트북 만들기와 화면 구성
            </a>
            ,{" "}
            <a className="underline" href="https://support.google.com/notebooklm/answer/16215270?hl=ko" target="_blank" rel="noopener">
              소스 추가·검색
            </a>
            . 화면 이름은 업데이트에 따라 조금 달라질 수 있어요.
          </p>
        </section>
      </main>
    </div>
  );
}
