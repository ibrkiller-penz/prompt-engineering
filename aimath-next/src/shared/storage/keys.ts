// 저장 키 목록(이 한 곳에서만 관리해요). 모두 이 기기의 브라우저(localStorage)에만 남고 서버로 보내지 않아요.
// 개인 정보(이름·학번·연락처 등)는 저장하지 않아요. 설명 문구는 '저장 내용 안내' 화면에 그대로 보여요.
import type { StudentKey, TeacherKey } from "../contracts.ts";

export const S_PREFIX = "aimn:s1:";
export const T_PREFIX = "aimn:t1:";

export interface KeyInfo {
  label: string; // 짧은 이름
  desc: string; // 무엇을 저장하는지(해요체)
  backup: boolean; // 기록 파일에 담는지
}

export const STUDENT_KEYS: Record<StudentKey, KeyInfo> = {
  q: { label: "문제 기록", desc: "문제마다 처음에 맞혔는지, 틀린 횟수, 연 힌트, 풀이를 봤는지, 시도한 때를 저장해요.", backup: true },
  read: { label: "읽은 소제목", desc: "개념 소제목을 끝까지 넘기고 확인 문제를 풀어 본 곳을 저장해요.", backup: true },
  pos: { label: "보던 카드", desc: "레슨마다 마지막으로 보던 카드 위치를 저장해요.", backup: true },
  last: { label: "이어서 공부하기", desc: "마지막으로 공부한 화면 주소와 제목을 저장해요.", backup: true },
  prefs: { label: "읽기 설정", desc: "글자 크기, 화면 밝기, 움직임 줄이기, 읽어 주기 설정을 저장해요.", backup: true },
  prereq: { label: "먼저 알고 가요", desc: "'알아요/헷갈려요'로 고른 것을 저장해요.", backup: true },
  assigned: { label: "선생님이 고른 문제", desc: "수업 끝 QR 로 받은 숙제·확인 문제 번호를 저장해요. 이름이나 반은 들어 있지 않아요.", backup: true },
  tools: { label: "체험 미션", desc: "체험 도구 미션을 해냈는지 저장해요.", backup: true },
};

export const TEACHER_KEYS: Record<TeacherKey, KeyInfo> = {
  prefs: { label: "화면 설정", desc: "글자 크기, 테마, 움직임 줄이기 설정을 저장해요.", backup: true },
  last: { label: "이어서 하기", desc: "마지막으로 띄운 레슨·차시·장면 번호를 저장해요.", backup: true },
  duration: { label: "수업 시간", desc: "고른 수업 시간(45·50·70분)을 저장해요.", backup: true },
  flow: { label: "수업 흐름", desc: "차시마다 켜고 끈 장면과 조절한 시간을 저장해요.", backup: true },
  pick: { label: "고른 문제", desc: "칠판·끝 확인·숙제 바구니에 담은 문제 번호를 저장해요.", backup: true },
  progress: { label: "반별 진도", desc: "반 이름(예: 2-3)과 레슨별 진도 표시를 저장해요. 학생 이름은 저장하지 않아요.", backup: true },
  results: { label: "손들기 결과", desc: "문제마다 보기별로 손든 학생 수(숫자만)를 저장해요.", backup: true },
};

export const studentKeyList = Object.keys(STUDENT_KEYS) as StudentKey[];
export const teacherKeyList = Object.keys(TEACHER_KEYS) as TeacherKey[];
