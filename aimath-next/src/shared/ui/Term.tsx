// 용어: 본문 속 용어 카드(TermView)와, 누르면 아래 시트로 뜻을 보여 주는 단추(TermButton·TermPopup).
import { useState, type ReactNode } from "react";
import type { Surface } from "../contracts.ts";
import { Rich } from "./tex.tsx";
import { Sheet } from "./Sheet.tsx";
import { useUiSurface } from "./surface.ts";
import { SpeakButton } from "./SpeakButton.tsx";

export interface TermViewProps {
  term: string;
  def: string;
  surface?: Surface;
}

/** 용어 카드(블록 t:"term") */
export function TermView({ term, def, surface }: TermViewProps) {
  const sf = useUiSurface(surface);
  return (
    <dl className={"ui-term is-" + sf}>
      <dt className="ui-term-name">
        <span className="ui-term-tag">용어</span>
        <Rich text={term} />
      </dt>
      <dd className="ui-term-def">
        <Rich text={def} />
      </dd>
    </dl>
  );
}

export interface TermPopupProps {
  open: boolean;
  term: string;
  def: string;
  onClose: () => void;
  /** 처음 나온 곳(예: "Ⅰ-3 알고리즘") */
  from?: string;
}

/** 용어 풀이 시트 */
export function TermPopup({ open, term, def, onClose, from }: TermPopupProps) {
  return (
    <Sheet open={open} onClose={onClose} title={<Rich text={term} />}>
      <p className="ui-term-pop-def">
        <Rich text={def} />
      </p>
      {from ? <p className="small ui-muted">처음 나온 곳: {from}</p> : null}
      <SpeakButton text={term + ". " + def} />
    </Sheet>
  );
}

/** 본문 속에서 누르면 뜻이 뜨는 용어 단추 */
export function TermButton({ term, def, from, children }: { term: string; def: string; from?: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="term ui-term-btn" onClick={() => setOpen(true)} aria-haspopup="dialog">
        {children || <Rich text={term} />}
      </button>
      <TermPopup open={open} term={term} def={def} from={from} onClose={() => setOpen(false)} />
    </>
  );
}
