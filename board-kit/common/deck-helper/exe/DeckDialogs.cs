// DeckDialogs.cs — 속성 창에서 여는 작은 창 셋: 단축키 눌러서 넣기(KeyRecordForm), 자세한 설정(OptionsForm),
// 여러 동작 차례 고치기(StepsForm). 모두 어두운 모양(Theme·DeckFonts·FlatButton·RoundBox). C# 5 문법만
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

static class Dlg
{
    public static Form Make(string title, int w, int h)
    {
        var d = new Form();
        d.Text = title;
        d.ClientSize = new Size(w, h);
        d.StartPosition = FormStartPosition.CenterParent;
        d.FormBorderStyle = FormBorderStyle.FixedDialog;
        d.MinimizeBox = false; d.MaximizeBox = false; d.ShowInTaskbar = false;
        d.BackColor = Theme.Panel; d.ForeColor = Theme.Text1; d.Font = DeckFonts.Regular(9.5f);
        try { d.Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        d.HandleCreated += delegate { Theme.DarkTitle(d.Handle); };
        return d;
    }
    public static Label Lbl(Control parent, string t, int x, int y, int w, Color c, float size)
    {
        var l = new Label { Text = t, AutoSize = false, Location = new Point(x, y), Size = new Size(w, (int)(size * 2.4f) + 4), ForeColor = c, BackColor = Color.Transparent, Font = DeckFonts.Regular(size) };
        parent.Controls.Add(l);
        return l;
    }
    public static CheckBox Check(Control parent, string t, int x, int y, bool on)
    {
        var c = new CheckBox { Text = t, Checked = on, AutoSize = true, Location = new Point(x, y), ForeColor = Theme.Text1, BackColor = Theme.Panel, FlatStyle = FlatStyle.Flat, Font = DeckFonts.Regular(9.5f), Cursor = Cursors.Hand };
        c.FlatAppearance.BorderColor = Theme.KeyEdgeHover;
        c.FlatAppearance.CheckedBackColor = Theme.Accent;
        parent.Controls.Add(c);
        return c;
    }
    public static FlatButton Btn(Control parent, string t, BtnStyle st, int x, int y, int w)
    {
        var b = new FlatButton { Text = t, Style = st, Location = new Point(x, y), Size = new Size(w, 34) };
        parent.Controls.Add(b);
        return b;
    }
    public static RoundBox Box(Control parent, string text, string cue, int x, int y, int w)
    {
        var b = new RoundBox();
        b.SetBounds(x, y, w, 32);
        b.Box.Text = text ?? "";
        b.Placeholder = cue ?? "";
        parent.Controls.Add(b);
        return b;
    }
    // [확인]·[취소] 아래 오른쪽
    public static void OkCancel(Form d, Action onOk)
    {
        var ok = Btn(d, "확인", BtnStyle.Primary, d.ClientSize.Width - 16 - 96 - 8 - 96, d.ClientSize.Height - 16 - 34, 96);
        var no = Btn(d, "취소", BtnStyle.Normal, d.ClientSize.Width - 16 - 96, d.ClientSize.Height - 16 - 34, 96);
        ok.Click += delegate { if (onOk != null) onOk(); d.DialogResult = DialogResult.OK; d.Close(); };
        no.Click += delegate { d.DialogResult = DialogResult.Cancel; d.Close(); };
        d.CancelButton = null;
        d.KeyPreview = true;
        d.KeyDown += (s, e) => { if (e.KeyCode == Keys.Escape) { d.DialogResult = DialogResult.Cancel; d.Close(); } };
    }
}

// ── 단축키 눌러서 넣기 ──
class KeyRecordForm : Form
{
    public string Result = "";
    readonly Label show, hint;
    readonly CheckBox win;
    string mods = "", key = "";
    [DllImport("user32.dll")] static extern short GetKeyState(int vk);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint type);

    public KeyRecordForm(string start)
    {
        Text = "단축키 눌러서 넣기";
        ClientSize = new Size(480, 250);
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MinimizeBox = false; MaximizeBox = false; ShowInTaskbar = false;
        BackColor = Theme.Panel; ForeColor = Theme.Text1; Font = DeckFonts.Regular(9.5f);
        HandleCreated += delegate { Theme.DarkTitle(Handle); };
        KeyPreview = true;

        Dlg.Lbl(this, "보드 칸을 누를 때 보낼 단축키를 키보드에서 그대로 눌러 보세요.", 20, 16, 440, Theme.Text1, 9.5f);
        show = new Label { AutoSize = false, Location = new Point(20, 52), Size = new Size(440, 64), TextAlign = ContentAlignment.MiddleCenter,
            BackColor = Theme.Raised, ForeColor = Theme.Text1, Font = DeckFonts.Medium(16f) };
        Controls.Add(show);
        hint = Dlg.Lbl(this, "", 20, 122, 440, Theme.Text3, 8.5f);
        win = Dlg.Check(this, "Win 키도 함께(윈도 키는 이 창에서 잡히지 않아 여기서 켜요)", 20, 148, false);
        win.CheckedChanged += delegate { Refresh2(); };
        Result = start ?? "";
        if (Result.StartsWith("#")) { win.Checked = true; }
        Refresh2();
        var again = Dlg.Btn(this, "다시", BtnStyle.Normal, 20, 250 - 16 - 34, 96);
        again.Click += delegate { mods = ""; key = ""; Result = ""; Refresh2(); show.Focus(); };
        var ok = Dlg.Btn(this, "확인", BtnStyle.Primary, 480 - 16 - 96 - 8 - 96, 250 - 16 - 34, 96);
        var no = Dlg.Btn(this, "취소", BtnStyle.Normal, 480 - 16 - 96, 250 - 16 - 34, 96);
        ok.Click += delegate { DialogResult = Result.Length > 0 ? DialogResult.OK : DialogResult.Cancel; Close(); };
        no.Click += delegate { DialogResult = DialogResult.Cancel; Close(); };
        // 단추들이 Enter·Space·Tab 을 먹지 않게: 단추는 마우스로만
        foreach (Control c in new Control[] { again, ok, no, win }) c.TabStop = false;
        Shown += delegate { show.Focus(); };
    }

    void Refresh2()
    {
        string w = win.Checked ? "#" : "";
        string body = Result.TrimStart('#');
        if (key.Length > 0) body = mods + key;
        Result = body.Length > 0 ? w + body : "";
        show.Text = Result.Length > 0 ? KeyText.Describe(Result) : (mods.Length > 0 ? KeyText.Describe(w + mods).TrimEnd() + " + …" : "여기서 키를 누르세요");
        hint.Text = Result.Length > 0 ? "보드에 넣을 글: " + Result + "    (마음에 들면 [확인] 또는 Ctrl+Enter)" : "예) Ctrl+C, Alt+F4, F5  ·  키보드로 확인 Ctrl+Enter, 취소 Shift+Esc";
    }


    // 모든 키(Tab·화살표·Alt 조합·Enter 까지)를 이 창이 먼저 받는다
    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        const int WM_KEYDOWN = 0x100, WM_SYSKEYDOWN = 0x104;
        if (msg.Msg != WM_KEYDOWN && msg.Msg != WM_SYSKEYDOWN) return base.ProcessCmdKey(ref msg, keyData);
        Keys k = keyData & Keys.KeyCode;
        // 키보드만으로 닫기: Ctrl+Enter = 확인, Shift+Esc = 취소(이 두 조합은 단축키로 넣지 않는다. 필요하면 대상 칸에 ^{ENTER} 처럼 직접 써요)
        Keys mk = keyData & Keys.Modifiers;
        if (k == Keys.Enter && mk == Keys.Control) { DialogResult = Result.Length > 0 ? DialogResult.OK : DialogResult.Cancel; Close(); return true; }
        if (k == Keys.Escape && mk == Keys.Shift) { DialogResult = DialogResult.Cancel; Close(); return true; }
        string m = ((keyData & Keys.Control) != 0 ? "^" : "") + ((keyData & Keys.Alt) != 0 ? "%" : "") + ((keyData & Keys.Shift) != 0 ? "+" : "");
        if (GetKeyState(0x5B) < 0 || GetKeyState(0x5C) < 0) win.Checked = true;
        if (k == Keys.ControlKey || k == Keys.ShiftKey || k == Keys.Menu || k == Keys.LWin || k == Keys.RWin)
        {
            mods = m; key = ""; Result = ""; Refresh2(); return true;
        }
        string t = Token(k);
        if (t == null)
        {   // 넣을 수 없는 키(한/영·한자 등): 조용히 무시하지 않고 알린다
            hint.Text = "이 키는 넣을 수 없어요. 다른 키를 눌러 주세요.";
            return true;
        }
        mods = m; key = t;
        Refresh2();
        return true;
    }

    string Token(Keys k)
    {
        if (k >= Keys.A && k <= Keys.Z) return ((char)('a' + (k - Keys.A))).ToString();
        if (k >= Keys.D0 && k <= Keys.D9) return ((char)('0' + (k - Keys.D0))).ToString();
        if (k >= Keys.NumPad0 && k <= Keys.NumPad9) return ((char)('0' + (k - Keys.NumPad0))).ToString();
        if (k >= Keys.F1 && k <= Keys.F24) return "{F" + (1 + (k - Keys.F1)) + "}";
        switch (k)
        {
            case Keys.Enter: return "{ENTER}";
            case Keys.Escape: return "{ESC}";
            case Keys.Tab: return "{TAB}";
            case Keys.Back: return "{BACKSPACE}";
            case Keys.Delete: return "{DELETE}";
            case Keys.Insert: return "{INSERT}";
            case Keys.Home: return "{HOME}";
            case Keys.End: return "{END}";
            case Keys.PageUp: return "{PGUP}";
            case Keys.PageDown: return "{PGDN}";
            case Keys.Up: return "{UP}";
            case Keys.Down: return "{DOWN}";
            case Keys.Left: return "{LEFT}";
            case Keys.Right: return "{RIGHT}";
            case Keys.Space: return "{SPACE}";
            case Keys.Add: return "{ADD}";
            case Keys.Subtract: return "{SUBTRACT}";
            case Keys.Multiply: return "{MULTIPLY}";
            case Keys.Divide: return "{DIVIDE}";
            case Keys.PrintScreen: return "{PRTSC}";
            case Keys.Apps: return "{APPS}";
        }
        uint ch = MapVirtualKey((uint)k, 2) & 0x7fff;   // 기호 키( . , / ; ' [ ] - = ` \ )
        if (ch >= 0x20 && ch < 0x7f)
        {
            char c = char.ToLowerInvariant((char)ch);
            return "+^%~(){}[]#".IndexOf(c) >= 0 ? "{" + c + "}" : c.ToString();
        }
        return null;
    }
}

// ── 자세한 설정: 하는 일마다 ──
static class OptionsForm
{
    public static bool Edit(IWin32Window owner, string kind, Dictionary<string, string> opt)
    {
        using (var d = Build(kind, opt)) return d.ShowDialog(owner) == DialogResult.OK;
    }

    // 창만 만든다(미리보기 그림에도 쓴다). [확인]을 누르면 opt 에 넣는다
    public static Form Build(string kind, Dictionary<string, string> opt)
    {
        string title = kind == "app" ? "프로그램 열기 · 자세한 설정" : kind == "url" ? "사이트 열기 · 자세한 설정" : "글자 넣기 · 자세한 설정";
        int h = kind == "app" ? 330 : kind == "url" ? 230 : 170;
        var d = Dlg.Make(title, 520, h);
        {
            Action save = null;
            if (kind == "app")
            {
                Dlg.Lbl(d, "함께 넘길 값(파일 이름 등, 없으면 비워 두기)", 20, 16, 480, Theme.Text2, 9f);
                var args = Dlg.Box(d, OptX.Get(opt, "args"), "예) \"D:\\수업\\오늘.pptx\"", 20, 40, 480);
                Dlg.Lbl(d, "시작 폴더(없으면 비워 두기)", 20, 84, 380, Theme.Text2, 9f);
                var dir = Dlg.Box(d, OptX.Get(opt, "dir"), "예) D:\\수업", 20, 108, 376);
                var pick = Dlg.Btn(d, "폴더 고르기…", BtnStyle.Normal, 404, 107, 96);
                pick.Click += delegate
                {
                    using (var f = new FolderBrowserDialog { Description = "시작 폴더 고르기" })
                        if (f.ShowDialog(d) == DialogResult.OK) dir.Box.Text = f.SelectedPath;
                };
                var front = Dlg.Check(d, "이미 열려 있으면 그 창을 앞으로(넘길 값이 있으면 새로 열어요)", 20, 156, OptX.Get(opt, "front") == "1");
                var admin = Dlg.Check(d, "관리자 권한으로 열기(누를 때마다 윈도가 물어봐요)", 20, 186, OptX.Get(opt, "admin") == "1");
                Dlg.Lbl(d, "※ 대상에 파일·폴더 경로를 넣어도 돼요(그 파일을 기본 프로그램으로 열어요).", 20, 222, 480, Theme.Text3, 8.5f);
                save = delegate
                {
                    OptX.Set(opt, "args", args.Box.Text.Trim()); OptX.Set(opt, "dir", dir.Box.Text.Trim());
                    OptX.Set(opt, "front", front.Checked ? "1" : ""); OptX.Set(opt, "admin", admin.Checked ? "1" : "");
                };
            }
            else if (kind == "url")
            {
                Dlg.Lbl(d, "어느 브라우저로 열까요?", 20, 16, 480, Theme.Text2, 9f);
                var br = new Segmented { Items = DeckRun.BrowserNames, Location = new Point(20, 42), Size = new Size(480, 34) };
                int bi = Array.IndexOf(DeckRun.BrowserCodes, OptX.Get(opt, "browser"));
                br.SelectedIndex = bi < 0 ? 0 : bi;
                d.Controls.Add(br);
                var nw = Dlg.Check(d, "새 창으로 열기(기본 브라우저가 아닐 때만 돼요)", 20, 92, OptX.Get(opt, "newwin") == "1");
                Dlg.Lbl(d, "고른 브라우저가 이 컴퓨터에 없으면 기본 브라우저로 열어요.", 20, 124, 480, Theme.Text3, 8.5f);
                save = delegate
                {
                    OptX.Set(opt, "browser", DeckRun.BrowserCodes[Math.Max(0, br.SelectedIndex)]);
                    OptX.Set(opt, "newwin", nw.Checked ? "1" : "");
                };
            }
            else
            {
                var en = Dlg.Check(d, "글자를 넣은 뒤 Enter 누르기(채팅·검색창에 바로 보내기)", 20, 24, OptX.Get(opt, "enter") == "1");
                Dlg.Lbl(d, "글자는 복사해서 붙여 넣는 방식이라, 원래 복사해 둔 것은 바뀌어요.", 20, 62, 480, Theme.Text3, 8.5f);
                save = delegate { OptX.Set(opt, "enter", en.Checked ? "1" : ""); };
            }
            Dlg.OkCancel(d, save);
            return d;
        }
    }

    public static string Summary(string kind, Dictionary<string, string> opt)
    {
        var p = new List<string>();
        if (kind == "app")
        {
            if (OptX.Get(opt, "args").Length > 0) p.Add("값: " + OptX.Get(opt, "args"));
            if (OptX.Get(opt, "dir").Length > 0) p.Add("시작 폴더");
            if (OptX.Get(opt, "front") == "1") p.Add("열려 있으면 앞으로");
            if (OptX.Get(opt, "admin") == "1") p.Add("관리자 권한");
        }
        else if (kind == "url")
        {
            int bi = Array.IndexOf(DeckRun.BrowserCodes, OptX.Get(opt, "browser"));
            if (bi > 0) p.Add(DeckRun.BrowserNames[bi]);
            if (OptX.Get(opt, "newwin") == "1") p.Add("새 창");
        }
        else if (kind == "text" && OptX.Get(opt, "enter") == "1") p.Add("넣고 Enter");
        return string.Join(" · ", p.ToArray());
    }
}

// ── 여러 동작 차례 고치기 ──
class StepsForm : Form
{
    public readonly List<DeckStep> Steps = new List<DeckStep>();
    static readonly string[] KindCodes = { "app", "url", "keys", "text", "builtin" };
    static readonly string[] KindNames = { "프로그램 열기", "사이트 열기", "단축키 누르기", "글자 넣기", "컴퓨터 기능" };
    static readonly int[] Waits = { 0, 300, 500, 1000, 2000, 3000, 5000 };
    static readonly string[] WaitNames = { "바로", "0.3초", "0.5초", "1초", "2초", "3초", "5초" };

    readonly ListBox list = new ListBox();
    readonly Segmented kind = new Segmented(), wait = new Segmented();
    readonly RoundBox target = new RoundBox();
    readonly FlatButton browse = new FlatButton(), record = new FlatButton(), builtin = new FlatButton(), more = new FlatButton();
    readonly FlatButton add, up, down, del;
    readonly Label optSum;
    readonly ContextMenuStrip builtinMenu = new ContextMenuStrip();
    bool loading;

    public StepsForm(List<DeckStep> src, string cellName)
    {
        Text = "여러 동작 · " + (cellName.Length > 0 ? cellName : "차례 고치기");
        ClientSize = new Size(720, 520);
        StartPosition = FormStartPosition.CenterParent;
        FormBorderStyle = FormBorderStyle.FixedDialog;
        MinimizeBox = false; MaximizeBox = false; ShowInTaskbar = false;
        BackColor = Theme.Panel; ForeColor = Theme.Text1; Font = DeckFonts.Regular(9.5f);
        HandleCreated += delegate { Theme.DarkTitle(Handle); };
        foreach (var s in src) Steps.Add(s.Clone());

        Dlg.Lbl(this, "칸을 한 번 누르면 아래 차례대로 해요. (최대 " + DeckRun.MaxSteps + "가지)", 20, 14, 680, Theme.Text1, 9.5f);
        list.SetBounds(20, 44, 520, 206);
        list.DrawMode = DrawMode.OwnerDrawFixed; list.ItemHeight = 34; list.BorderStyle = BorderStyle.None;
        list.BackColor = Theme.Raised; list.ForeColor = Theme.Text1; list.IntegralHeight = false;
        list.DrawItem += DrawStep;
        list.SelectedIndexChanged += delegate { ShowStep(); };
        Controls.Add(list);
        add = Dlg.Btn(this, "+ 동작 더하기", BtnStyle.Primary, 552, 44, 148);
        up = Dlg.Btn(this, "위로", BtnStyle.Normal, 552, 86, 148);
        down = Dlg.Btn(this, "아래로", BtnStyle.Normal, 552, 128, 148);
        del = Dlg.Btn(this, "빼기", BtnStyle.Danger, 552, 170, 148);
        var test = Dlg.Btn(this, "▶ 차례대로 해 보기", BtnStyle.Normal, 552, 216, 148);

        // 고른 단계 고치기
        int y = 268;
        Dlg.Lbl(this, "고른 동작", 20, y, 200, Theme.Text2, 9f);
        kind.Items = KindNames; kind.SetBounds(20, y + 24, 680, 32); Controls.Add(kind);
        target.SetBounds(20, y + 66, 560, 32); Controls.Add(target);
        browse.Text = "찾아보기…"; browse.SetBounds(588, y + 65, 112, 34); Controls.Add(browse);
        record.Text = "눌러서 넣기"; record.SetBounds(588, y + 65, 112, 34); Controls.Add(record);
        builtin.Glyph = BtnGlyph.Down; builtin.SetBounds(20, y + 65, 260, 34); Controls.Add(builtin);
        more.Text = "자세히…"; more.SetBounds(588, y + 65, 112, 34); Controls.Add(more);
        optSum = Dlg.Lbl(this, "", 20, y + 104, 680, Theme.Text3, 8.5f);
        optSum.Height = 20; optSum.AutoEllipsis = true;   // 긴 요약은 한 줄에서 … 로 줄인다(두 줄로 넘어가 아래 글과 겹치지 않게)
        Dlg.Lbl(this, "다음 동작까지 기다리기(프로그램이 뜨는 시간을 주세요)", 20, y + 128, 400, Theme.Text2, 9f);
        wait.Items = WaitNames; wait.SetBounds(20, y + 152, 520, 32); Controls.Add(wait);

        for (int i = 0; i < DeckForm.BuiltinCodes.Length; i++)
        {
            int n = i;
            builtinMenu.Items.Add(DeckForm.BuiltinNames[i], null, delegate { if (Cur != null) { Cur.Target = DeckForm.BuiltinCodes[n]; builtin.Text = DeckForm.BuiltinNames[n]; list.Invalidate(); } });
        }
        Theme.DarkMenu(builtinMenu);
        builtin.DropMenu = builtinMenu;

        var addMenu = new ContextMenuStrip();
        for (int i = 0; i < KindNames.Length; i++) { int n = i; addMenu.Items.Add(KindNames[i], null, delegate { AddStep(KindCodes[n]); }); }
        Theme.DarkMenu(addMenu);
        add.DropMenu = addMenu;
        up.Click += delegate { MoveStep(-1); };
        down.Click += delegate { MoveStep(1); };
        del.Click += delegate { int i = list.SelectedIndex; if (i < 0) return; Steps.RemoveAt(i); Fill(Math.Min(i, Steps.Count - 1)); };
        test.Click += delegate { TryAll(); };
        kind.Picked += delegate (int i) { if (Cur == null) return; Cur.Kind = KindCodes[i]; Cur.Target = Cur.Kind == "builtin" ? DeckForm.BuiltinCodes[0] : ""; Cur.Opt.Clear(); ShowStep(); list.Invalidate(); };
        target.Box.TextChanged += delegate { if (loading || Cur == null) return; Cur.Target = target.Box.Text; list.Invalidate(); };
        wait.Picked += delegate (int i) { if (Cur == null) return; Cur.Wait = Waits[i]; list.Invalidate(); };
        browse.Click += delegate
        {
            if (Cur == null) return;
            using (var f = new OpenFileDialog { Title = "열 프로그램·파일 고르기", Filter = "프로그램·바로 가기|*.exe;*.lnk;*.bat;*.cmd|모든 파일|*.*", DereferenceLinks = false })
                if (f.ShowDialog(this) == DialogResult.OK) target.Box.Text = f.FileName;
        };
        record.Click += delegate
        {
            if (Cur == null) return;
            using (var r = new KeyRecordForm(Cur.Target)) if (r.ShowDialog(this) == DialogResult.OK) target.Box.Text = r.Result;
        };
        more.Click += delegate { if (Cur != null && OptionsForm.Edit(this, Cur.Kind, Cur.Opt)) ShowStep(); };

        Dlg.OkCancel(this, null);
        Fill(Steps.Count > 0 ? 0 : -1);
    }

    DeckStep Cur { get { int i = list.SelectedIndex; return i >= 0 && i < Steps.Count ? Steps[i] : null; } }

    void Fill(int select)
    {
        list.Items.Clear();
        for (int i = 0; i < Steps.Count; i++) list.Items.Add(i);
        if (select >= 0 && select < Steps.Count) list.SelectedIndex = select; else ShowStep();
        add.Enabled = Steps.Count < DeckRun.MaxSteps;
    }

    void AddStep(string k)
    {
        if (Steps.Count >= DeckRun.MaxSteps) return;
        var s = new DeckStep { Kind = k, Target = k == "builtin" ? DeckForm.BuiltinCodes[0] : "", Wait = 1000 };
        int at = list.SelectedIndex >= 0 ? list.SelectedIndex + 1 : Steps.Count;
        Steps.Insert(at, s);
        Fill(at);
        if (k != "builtin") target.Box.Focus();
    }

    void MoveStep(int d)
    {
        int i = list.SelectedIndex, j = i + d;
        if (i < 0 || j < 0 || j >= Steps.Count) return;
        var t = Steps[i]; Steps[i] = Steps[j]; Steps[j] = t;
        Fill(j);
    }

    void ShowStep()
    {
        loading = true;
        var s = Cur;
        bool on = s != null;
        foreach (Control c in new Control[] { kind, target, wait, up, down, del }) c.Enabled = on;
        string k = on ? s.Kind : "";
        kind.SelectedIndex = on ? Array.IndexOf(KindCodes, k) : -1;
        target.Visible = !on || k != "builtin";
        target.Width = 560;
        target.Box.Text = on && k != "builtin" ? s.Target : "";
        target.Placeholder = k == "url" ? "https://…" : k == "keys" ? "[눌러서 넣기]로 넣어요. 예) ^c" : k == "app" ? "프로그램·파일 경로" : k == "text" ? "넣을 글자" : "";
        browse.Visible = k == "app";
        record.Visible = k == "keys";
        more.Visible = k == "url" || k == "text";
        if (k == "app") { target.Width = 560 - 120; browse.Left = 20 + 440 + 8; more.Visible = true; more.Left = 588; }
        else { browse.Left = 588; more.Left = 588; }
        builtin.Visible = k == "builtin";
        if (k == "builtin") { int bi = Math.Max(0, Array.IndexOf(DeckForm.BuiltinCodes, s.Target)); builtin.Text = DeckForm.BuiltinNames[bi]; }
        int wi = on ? Array.IndexOf(Waits, s.Wait) : -1;
        if (on && wi < 0) { wi = 3; for (int i = 0; i < Waits.Length; i++) if (Waits[i] <= s.Wait) wi = i; }
        wait.SelectedIndex = wi;
        string sum = on ? OptionsForm.Summary(k, s.Opt) : "";
        optSum.Text = !on ? "위 [+ 동작 더하기]로 동작을 넣으세요." : k == "keys" && s.Target.Length > 0 ? "누를 키: " + KeyText.Describe(s.Target) : sum.Length > 0 ? "자세한 설정: " + sum : "";
        up.Enabled = on && list.SelectedIndex > 0;
        down.Enabled = on && list.SelectedIndex < Steps.Count - 1;
        loading = false;
    }

    public static string Line(DeckStep s)
    {
        string k = s.Kind == "app" ? "열기" : s.Kind == "url" ? "사이트" : s.Kind == "keys" ? "단축키" : s.Kind == "text" ? "글자" : "기능";
        string t;
        if (s.Kind == "builtin") { int bi = Array.IndexOf(DeckForm.BuiltinCodes, s.Target); t = bi >= 0 ? DeckForm.BuiltinNames[bi] : s.Target; }
        else if (s.Kind == "keys") t = s.Target.Length > 0 ? KeyText.Describe(s.Target) : "(키를 넣어 주세요)";
        else if (s.Kind == "app") t = s.Target.Length > 0 ? System.IO.Path.GetFileNameWithoutExtension(s.Target.Trim('"')) : "(프로그램을 골라 주세요)";
        else t = s.Target.Length > 0 ? s.Target.Replace("\r", " ").Replace("\n", " ") : "(비어 있어요)";
        return k + " · " + t;
    }

    void DrawStep(object sender, DrawItemEventArgs e)
    {
        if (e.Index < 0 || e.Index >= Steps.Count) return;
        var g = e.Graphics;
        bool selected = (e.State & DrawItemState.Selected) != 0;
        g.FillRectangle(Theme.Br(selected ? Theme.BtnHover : Theme.Raised), e.Bounds);
        if (selected) g.FillRectangle(Theme.Br(Theme.Accent), e.Bounds.X, e.Bounds.Y + 4, 3, e.Bounds.Height - 8);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var s = Steps[e.Index];
        var num = new Rectangle(e.Bounds.X + 10, e.Bounds.Y + 6, 22, 22);
        g.FillEllipse(Theme.Br(Theme.Accent), num);
        Theme.Text(g, (e.Index + 1).ToString(), DeckFonts.Medium(8.5f), Color.White, num, StringAlignment.Center);
        bool empty = s.Target.Trim().Length == 0;
        Theme.Text(g, Line(s), DeckFonts.Regular(9.5f), empty ? Theme.Warn : Theme.Text1, new RectangleF(e.Bounds.X + 42, e.Bounds.Y, e.Bounds.Width - 140, e.Bounds.Height));
        if (e.Index < Steps.Count - 1)
            Theme.Text(g, s.Wait == 0 ? "바로 다음" : "↓ " + (s.Wait / 1000.0).ToString("0.#") + "초 뒤", DeckFonts.Light(8.5f), Theme.Text3,
                new RectangleF(e.Bounds.Right - 96, e.Bounds.Y, 88, e.Bounds.Height), StringAlignment.Far);
    }

    void TryAll()
    {
        var c = new DeckCell { Name = "시험", Kind = "multi" };
        foreach (var s in Steps) c.Steps.Add(s.Clone());
        bool other = false;
        foreach (var s in Steps) if (s.Kind == "keys" || s.Kind == "text" || s.Target == "#altf4") other = true;   // Alt+F4 가 이 창을 닫지 않게
        if (other) { WindowState = FormWindowState.Minimized; Application.DoEvents(); System.Threading.Thread.Sleep(400); }
        try
        {
            bool started = DeckRun.Run(c, System.Threading.SynchronizationContext.Current, null, delegate (string why) {
                if (IsDisposed) return;
                if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
                MessageBox.Show(this, why + ".\n그 동작의 대상을 확인해 주세요.", "여러 동작");
            });
            if (!started)
            {
                if (other) WindowState = FormWindowState.Normal;
                MessageBox.Show(this, Steps.Count == 0 ? "동작을 먼저 넣어 주세요." : "해 볼 동작이 없어요. 비어 있는 동작을 채워 주세요.", "여러 동작");
                return;
            }
        }
        catch (Exception ex) { Helper.Log("차례대로 해 보기 실패: " + ex.Message); MessageBox.Show(this, "해 보지 못했어요: " + ErrText.Easy(ex), "여러 동작"); }
        if (other)
        {
            int total = 1500; foreach (var s in Steps) total += s.Wait;
            var back = new Timer { Interval = Math.Min(15000, total) };
            back.Tick += delegate { back.Stop(); back.Dispose(); if (!IsDisposed) WindowState = FormWindowState.Normal; };
            back.Start();
        }
    }
}
