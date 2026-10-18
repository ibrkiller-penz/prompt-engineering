// 사전(#/dict?u=2): 모든 레슨의 용어. 초성 검색('ㅇㄱㅈㄴ' → 인공지능)과 단원 거르기.
import { useState } from "react";
import { STUDENT_ROUTES, type TermEntry } from "../../shared/contracts.ts";
import { href, navigate } from "../../shared/router/index.ts";
import { INDEX, useTerms } from "../../content/index.ts";
import { Icon } from "../../shared/icons/index.ts";
import { Rich, SpeakButton } from "../../shared/ui/index.ts";
import { chosungFilter } from "../../shared/logic/chosung.ts";
import { Loading, PageHead, Screen, useDocTitle } from "../shell/Shell.tsx";

const MAX = 120;

export default function DictPage({ query }: { query: Record<string, string> }) {
  useDocTitle("사전");
  const { data, error } = useTerms();
  const [text, setText] = useState(query.q || "");
  const unit = /^[1-5]$/.test(query.u || "") ? Number(query.u) : 0;
  const pool: TermEntry[] = data ? data.filter((t) => !unit || t.unit === unit) : [];
  const found = text.trim() ? chosungFilter(pool, text, (t) => [t.term, plain(t.def)]) : pool;
  const shown = found.slice(0, MAX);
  const setUnit = (u: number) => navigate("/dict", { u: u || undefined, q: text.trim() || undefined }, { replace: true });

  return (
    <Screen title="사전" noBack tab="dict">
      <div className="page s-dictpage">
        <PageHead eyebrow="낱말 찾기" title="사전" sub="수업에 나온 용어를 모아 놓았어요." />
        <div className="field s-search">
          <label htmlFor="s-dict-q">용어 찾기</label>
          <div className="row nowrap">
            <Icon name="search" />
            <input
              id="s-dict-q"
              className="input grow"
              type="search"
              inputMode="search"
              autoComplete="off"
              placeholder="예: 벡터, ㅂㅌ, ㅇㄱㅈㄴ"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <p className="s-hint">초성만 쳐도 찾아요. 뜻 안의 낱말로도 찾을 수 있어요.</p>
        </div>

        <div className="row wrap s-unit-filter" role="group" aria-label="단원 거르기">
          <button type="button" className="chip" aria-pressed={!unit} onClick={() => setUnit(0)}>
            전체
          </button>
          {INDEX.units.map((u) => (
            <button key={u.id} type="button" className="chip" aria-pressed={unit === u.id} onClick={() => setUnit(u.id)}>
              {u.roman}
            </button>
          ))}
        </div>

        {!data ? (
          <Loading error={error} />
        ) : (
          <>
            <p className="s-count-line" role="status">
              {text.trim() ? "'" + text.trim() + "' 찾은 용어 " + found.length + "개" : "용어 " + found.length + "개"}
              {found.length > MAX ? " · 앞의 " + MAX + "개만 보여요. 더 좁혀 찾아 봐요." : ""}
            </p>
            {shown.length ? (
              <dl className="s-dict">
                {shown.map((t, i) => {
                  const m = INDEX.lessons[t.lid];
                  return (
                    <div key={t.term + i} className="card s-dict-item">
                      <dt className="s-dict-term">
                        <Rich text={t.term} />
                      </dt>
                      <dd className="s-dict-def">
                        <Rich text={t.def} />
                        <span className="row wrap s-dict-meta">
                          {m ? (
                            <a className="small" href={href(STUDENT_ROUTES.lesson, { lid: t.lid })}>
                              처음 나온 곳: {m.code} {m.title}
                            </a>
                          ) : null}
                          <SpeakButton text={t.term + ". " + t.def} />
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            ) : (
              <div className="empty">
                <p>찾는 용어가 없어요. 초성이나 다른 낱말로 찾아 봐요.</p>
              </div>
            )}
          </>
        )}
      </div>
    </Screen>
  );
}

/** 검색용: 수식·굵게 표시를 걷어 낸 글자 */
function plain(s: string): string {
  return String(s || "")
    .replace(/\$[^$]*\$/g, " ")
    .replace(/\*\*/g, "");
}
