// 아이콘 스프라이트(<symbol> 묶음)를 문서에 한 번만 심어요. 외부 요청 없이 <use href="#i-…"> 로 그려요.
// 서버·node 시험(document 없음)에서는 아무것도 하지 않아요.

const mounted: Record<string, boolean> = {};

function insert(id: string, markup: string): void {
  if (document.getElementById(id)) return;
  const holder = document.createElement("div");
  holder.innerHTML = markup.trim();
  const svg = holder.firstElementChild;
  if (!svg) return;
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const body = document.body;
  if (body.firstChild) body.insertBefore(svg, body.firstChild);
  else body.appendChild(svg);
}

/** 스프라이트 svg 문자열(markup, 바깥 <svg id="…">)을 body 맨 앞에 넣어요. 여러 번 불러도 한 번만 들어가요 */
export function mountSprite(id: string, markup: string): void {
  if (mounted[id]) return;
  if (typeof document === "undefined") return;
  mounted[id] = true;
  try {
    if (document.body) insert(id, markup);
    else document.addEventListener("DOMContentLoaded", () => insert(id, markup), { once: true });
  } catch {
    mounted[id] = false; // 다음 그림 때 다시 해 봐요
  }
}
