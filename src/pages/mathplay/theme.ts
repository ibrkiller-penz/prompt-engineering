import { useEffect } from "react";

/** 게임 글꼴(Jua)을 한 번만 불러온다. 못 불러오면 기본 글꼴로 보인다. */
export function useGameFont() {
  useEffect(() => {
    if (document.getElementById("gz-font")) return;
    const l = document.createElement("link");
    l.id = "gz-font";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Jua&display=swap";
    document.head.appendChild(l);
  }, []);
}
