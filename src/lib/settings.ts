// 교사 설정 (이 기기에만 저장). 학생 기기와 공유되지 않는다.
import { useStored } from "./storage";

export const AI_SERVICES = [
  { id: "claude", label: "Claude", url: "https://claude.ai/new" },
  { id: "chatgpt", label: "ChatGPT", url: "https://chatgpt.com/" },
  { id: "gemini", label: "Gemini", url: "https://gemini.google.com/app" },
  { id: "custom", label: "학교에서 정한 도구(주소 직접 입력)", url: "" },
] as const;

export interface TeacherSettings {
  /** 중·고 실험실에 '실제 AI로 해 보기' 버튼을 보일지 (초등은 항상 숨김) */
  realAi: boolean;
  service: (typeof AI_SERVICES)[number]["id"];
  customUrl: string;
}

export const DEFAULT_SETTINGS: TeacherSettings = { realAi: false, service: "claude", customUrl: "" };

export function useSettings() {
  return useStored<TeacherSettings>("settings", DEFAULT_SETTINGS);
}

export function aiUrl(s: TeacherSettings) {
  if (s.service === "custom") return /^https?:\/\//.test(s.customUrl) ? s.customUrl : "";
  return AI_SERVICES.find((a) => a.id === s.service)?.url ?? "";
}
