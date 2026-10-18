// 읽기 설정 묶음(학생 '내 기록'·교사 준비 화면에서 함께 써요).
// 글자 크기 4단계, 줄 간격, 화면 밝기(테마), 대비 높이기, 움직임 줄이기, 읽어 주기(지원할 때만).
import type { FontStep, ThemePref } from "../contracts.ts";
import { FS_LABELS, LH_LABELS, THEME_LABELS, hasUrlOverride, themeChoices, usePrefs, type LineStep } from "../prefs/index.ts";
import { speechSupported } from "../speak/index.ts";
import { SITE } from "../../site.ts";

function Seg<T extends string | number>({ label, value, options, onPick }: { label: string; value: T; options: { v: T; t: string }[]; onPick: (v: T) => void }) {
  return (
    <fieldset className="ui-seg-field">
      <legend className="ui-seg-legend">{label}</legend>
      <div className="ui-seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button key={String(o.v)} type="button" role="radio" aria-checked={o.v === value} className={"ui-seg-btn" + (o.v === value ? " is-on" : "")} onClick={() => onPick(o.v)}>
            {o.t}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

export function PrefsPanel() {
  const [p, set] = usePrefs();
  const fsOpts = ([0, 1, 2, 3] as FontStep[]).map((v) => ({ v, t: FS_LABELS[v] }));
  const lhOpts = ([0, 1, 2] as LineStep[]).map((v) => ({ v, t: LH_LABELS[v] }));
  const thOpts = themeChoices(SITE).map((v: ThemePref) => ({ v, t: THEME_LABELS[v] }));
  return (
    <div className="ui-prefs">
      {hasUrlOverride() ? <p className="small ui-muted">지금은 주소에 붙은 설정으로 잠시 바뀌어 있어요. 여기서 고르면 그 값으로 바뀌어요.</p> : null}
      <Seg label="글자 크기" value={p.fs} options={fsOpts} onPick={(v) => set({ fs: v })} />
      <p className="ui-prefs-sample" aria-hidden="true">
        가나다 ABC 123 — 이 정도 크기로 보여요.
      </p>
      <Seg label="줄 간격" value={p.lh || 0} options={lhOpts} onPick={(v) => set({ lh: v })} />
      <Seg label="화면 밝기" value={p.theme} options={thOpts} onPick={(v) => set({ theme: v })} />
      <label className="switch">
        <input type="checkbox" checked={p.contrast} onChange={(e) => set({ contrast: e.target.checked })} />
        <span>대비 높이기(글자와 테두리를 더 진하게)</span>
      </label>
      <label className="switch">
        <input type="checkbox" checked={p.motion === "reduce"} onChange={(e) => set({ motion: e.target.checked ? "reduce" : "auto" })} />
        <span>움직임 줄이기</span>
      </label>
      {speechSupported() ? (
        <label className="switch">
          <input type="checkbox" checked={p.speak} onChange={(e) => set({ speak: e.target.checked })} />
          <span>읽어 주기 단추 보이기</span>
        </label>
      ) : null}
    </div>
  );
}
