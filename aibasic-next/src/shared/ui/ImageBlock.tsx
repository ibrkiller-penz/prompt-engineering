// 그림 블록(t:"image"): content/aibasic/img 의 그림 한 장과 설명 줄. alt 는 그림 설명, caption 은 그림 아래 한 줄이에요.
import type { Surface } from "../contracts.ts";
import { contentUrl } from "../../content/assets.ts";
import { Rich } from "./tex.tsx";
import { useUiSurface } from "./surface.ts";
import "./ui.css";

export function ImageBlock(props: { src: string; alt: string; caption?: string; surface?: Surface }) {
  const sf = useUiSurface(props.surface);
  return (
    <figure className={"ui-image is-" + sf}>
      <img src={contentUrl(props.src)} alt={props.alt} loading="lazy" decoding="async" />
      {props.caption ? (
        <figcaption className="ui-image-cap">
          <Rich text={props.caption} />
        </figcaption>
      ) : null}
    </figure>
  );
}
