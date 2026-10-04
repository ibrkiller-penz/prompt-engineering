import { useState } from "react";
import { Button, Card } from "../../components/ui";
import { clearAll } from "../../lib/storage";
import { COURSE_NAME } from "../../site";

export default function About() {
  const [cleared, setCleared] = useState(false);
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-extrabold sm:text-3xl">이용 안내</h1>
      <Card>
        <h2 className="text-lg font-bold">출처</h2>
        <p className="mt-2">
          {COURSE_NAME}는 『첫 결과물이 곧 완성은 아니다』와 부산 AI&amp;창의 교사 연구회의 초·중·고
          교재(학생용·교사용, 각 13차시)를 바탕으로 만들었어요. 차시의 문장과 예시는 교재에서 그대로 옮겼어요.
        </p>
        <p className="mt-2 text-muted">
          프롬프트 실험실의 AI 응답은 실제 AI가 아니라, 교재 이야기를 바탕으로 미리 써 둔 예시예요.
        </p>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">개인정보</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>회원가입·로그인이 없고, 이름·학교·연락처를 받지 않아요.</li>
          <li>메모와 활동 기록은 지금 쓰는 기기의 브라우저에만 저장되고, 어디로도 보내지 않아요.</li>
          <li>방문 분석 도구(광고·통계 추적)를 쓰지 않아요.</li>
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Button
            variant="ghost"
            onClick={() => {
              if (confirm("이 기기에 저장된 메모와 활동 기록을 모두 지울까요?")) {
                clearAll();
                setCleared(true);
              }
            }}
          >
            내 기록 지우기
          </Button>
          {cleared && <span className="text-ok">이 기기의 기록을 지웠어요.</span>}
        </div>
      </Card>
      <Card>
        <h2 className="text-lg font-bold">AI를 쓰기 전에</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5">
          <li>AI 서비스마다 쓸 수 있는 나이가 정해져 있어요. 선생님과 학교의 안내에 따라 사용해요.</li>
          <li>내 이름, 학교, 연락처 같은 개인정보는 입력하지 않아요.</li>
          <li>이 사이트의 활동은 AI를 직접 쓰지 않아도 할 수 있어요.</li>
        </ul>
      </Card>
    </div>
  );
}
