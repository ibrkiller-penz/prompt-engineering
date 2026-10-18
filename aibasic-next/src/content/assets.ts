// 콘텐츠 그림(content/aibasic/img/…)의 주소. vite.config.ts 의 contentImages 플러그인이 빌드 결과의 c/ 아래로 내보내요.
export function contentUrl(src: string): string {
  const base = (import.meta.env && import.meta.env.BASE_URL) || "/";
  return base.replace(/\/?$/, "/") + "c/" + String(src).replace(/^\/+/, "");
}
