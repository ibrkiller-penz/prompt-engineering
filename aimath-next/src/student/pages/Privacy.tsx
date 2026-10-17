// 저장 내용 안내(#/privacy): 이 기기에 무엇을 저장하는지 키 목록 표 그대로 보여 줘요.
import { STUDENT_ROUTES } from "../../shared/contracts.ts";
import { href } from "../../shared/router/index.ts";
import { S_PREFIX, STUDENT_KEYS, type KeyInfo } from "../../shared/storage/index.ts";
import { StackTable } from "../../shared/ui/index.ts";
import { Screen, useDocTitle } from "../shell/Shell.tsx";
import { EXTRA_KEYS } from "../store/index.ts";

export default function PrivacyPage() {
  useDocTitle("저장 내용 안내");
  const rows: string[][] = [];
  const seen: Record<string, true> = {};
  const add = (table: Record<string, KeyInfo>) => {
    for (const k of Object.keys(table)) {
      if (seen[k]) continue;
      seen[k] = true;
      const v = table[k];
      rows.push([v.label, S_PREFIX + k, v.desc, v.backup ? "담아요" : "안 담아요"]);
    }
  };
  add(STUDENT_KEYS as unknown as Record<string, KeyInfo>);
  add(EXTRA_KEYS as unknown as Record<string, KeyInfo>);
  return (
    <Screen title="저장 내용 안내" tab="me" backTo="/me">
      <div className="page stack">
        <section className="card stack tight">
          <h2 className="h3">한눈에 보기</h2>
          <ul className="s-plain-list">
            <li>공부한 기록은 <strong>이 기기의 브라우저(localStorage)에만</strong> 저장돼요. 서버로 보내지 않아요.</li>
            <li>이름, 학번, 연락처, 반 같은 개인 정보는 묻지도 저장하지도 않아요.</li>
            <li>선생님 QR 주소에는 문제 번호만 들어 있어요.</li>
            <li>로그인이 없어서, 기기를 바꾸면 기록이 따라가지 않아요. '내 기록'에서 기록 파일로 저장해 옮길 수 있어요.</li>
            <li>외부 글꼴·광고·분석 도구를 쓰지 않아요.</li>
          </ul>
        </section>
        <section>
          <h2 className="section-title">저장하는 것</h2>
          <StackTable head={["이름", "저장 키", "무엇을 저장하나요", "기록 파일"]} rows={rows} caption="이 기기에 저장하는 학생 기록" surface="phone" />
        </section>
        <p className="small">
          지우고 싶으면 <a href={href(STUDENT_ROUTES.me)}>내 기록</a> 맨 아래 '기록 모두 지우기'를 누르거나, 브라우저 설정에서 이 사이트 데이터를 지워요.
        </p>
      </div>
    </Screen>
  );
}
