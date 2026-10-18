// 교사 사이트 저장 내용 안내(#/privacy). privacy/index.tsx 가 따로 생기면 그쪽이 먼저예요.
import { useState } from "react";
import { TEACHER_KEYS, teacherKeyList, teacherStore } from "../../shared/storage/index.ts";
import { STUDENT_URL } from "../../site.ts";

export default function Privacy() {
  const [cleared, setCleared] = useState(false);
  const clearAll = () => {
    let ok = true;
    try {
      ok = window.confirm("이 기기에 저장된 교사 설정(반 이름·진도 표시·고른 문제 등)을 모두 지울까요? 되돌릴 수 없어요.");
    } catch {
      ok = true;
    }
    if (!ok) return;
    teacherStore.clear();
    setCleared(true);
  };
  return (
    <section className="page stack-lg">
      <header className="stack tight">
        <p className="eyebrow">교사용</p>
        <h1 className="h1">저장 내용 안내</h1>
        <p className="muted prose">
          이 사이트는 로그인이 없고, 서버로 아무것도 보내지 않아요. 아래 설정만 이 기기의 브라우저 안에 남아요. 학생 이름·학번 같은 개인 정보는 받지도, 저장하지도
          않아요.
        </p>
      </header>

      <div className="card">
        <h2 className="h3">이 기기에 남는 것</h2>
        <ul className="list t-keys">
          {teacherKeyList.map((k) => (
            <li key={k} className="list-row">
              <b className="t-key-name">{TEACHER_KEYS[k].label}</b>
              <span className="grow muted">{TEACHER_KEYS[k].desc}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="card stack">
        <h2 className="h3">저장하지 않는 것</h2>
        <ul className="prose">
          <li>칠판에 쓴 판서는 장면을 넘기거나 화면을 닫으면 사라져요.</li>
          <li>모둠 점수와 번호 뽑기 결과는 저장하지 않아요.</li>
          <li>학생의 학습 기록은 학생 각자의 휴대폰 안에만 있어요({STUDENT_URL.replace(/^https?:\/\//, "")}). 교사 사이트에서는 볼 수 없어요.</li>
        </ul>
      </div>

      <div className="card stack">
        <h2 className="h3">설정 지우기</h2>
        <p className="muted">공용 컴퓨터에서 썼다면 수업이 끝난 뒤 지워 두면 좋아요.</p>
        <p>
          <button type="button" className="btn btn-danger" onClick={clearAll}>
            이 기기의 교사 설정 모두 지우기
          </button>
        </p>
        {cleared ? (
          <p className="verdict ok" role="status">
            모두 지웠어요.
          </p>
        ) : null}
      </div>
    </section>
  );
}
