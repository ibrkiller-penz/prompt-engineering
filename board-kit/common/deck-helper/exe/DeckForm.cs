// '단축키 꾸미기' 창 — 16칸의 이름·하는 일·아이콘을 고치고 저장하면 도우미가 보드로 보낸다. C# 5 문법만
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

class DeckForm : Form
{
    readonly Helper host;
    DeckConfig work;
    int sel;
    bool dirty, loading;

    readonly DeckGrid grid;
    readonly Label lblCell = new Label(), lblNameWarn = new Label(), lblHelp = new Label(), lblStatus = new Label();
    readonly TextBox txtName = new TextBox(), txtTarget = new TextBox(), txtText = new TextBox();
    readonly RadioButton rbApp = new RadioButton(), rbUrl = new RadioButton(), rbKeys = new RadioButton(), rbText = new RadioButton(), rbBuiltin = new RadioButton();
    readonly RadioButton icAuto = new RadioButton(), icLetter = new RadioButton(), icFav = new RadioButton(), icFile = new RadioButton(), icBuiltin = new RadioButton(), icLib = new RadioButton();
    readonly ComboBox cmbBuiltin = new ComboBox(), cmbIcon = new ComboBox();
    readonly Button btnBrowse = new Button(), btnClear = new Button(), btnDefault = new Button(), btnSave = new Button(), btnClose = new Button();
    readonly PictureBox pic = new PictureBox();
    readonly Timer poll = new Timer(), iconLater = new Timer();
    readonly Bitmap[] builtinPics = new Bitmap[16];

    static readonly string[] BuiltinCodes = { "#desktop", "#altf4", "#lock", "#mute", "#volup", "#voldown", "#playpause", "#next", "#prev" };
    static readonly string[] BuiltinNames = { "바탕화면 보기", "맨 앞 창 닫기", "화면 잠그기", "소리 끄기·켜기", "소리 크게", "소리 작게", "재생·멈춤", "다음 곡", "이전 곡" };
    static int libTheme;   // 모음 창에서 마지막에 고른 테마
    static readonly Color Dark = Color.FromArgb(30, 34, 48);
    static readonly Encoding Euc = Encoding.GetEncoding(51949, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
    const string Extra = "°·→▶◀●";   // 보드 글꼴에 있는 기호

    public DeckForm(Helper h)
    {
        host = h;
        Text = "단축키 꾸미기 — 교실 알림판";
        Font = new Font("Malgun Gothic", 9.5f);
        ClientSize = new Size(960, 610);
        MinimumSize = new Size(976, 649);
        StartPosition = FormStartPosition.CenterScreen;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        for (int i = 0; i < 16; i++) builtinPics[i] = DeckIcons.Builtin(DeckConfig.Keys[i]);

        grid = new DeckGrid(this) { Location = new Point(12, 12), Size = new Size(492, 492) };
        Controls.Add(grid);

        int x = 524, lx = 590, y = 14;
        lblCell.SetBounds(x, y, 420, 40); lblCell.Font = new Font(Font.FontFamily, 10.5f, FontStyle.Bold); Controls.Add(lblCell);
        y += 46;
        AddLabel("이름", x, y + 3);
        txtName.SetBounds(lx, y, 200, 26); txtName.MaxLength = 20; Controls.Add(txtName);
        lblNameWarn.SetBounds(lx, y + 28, 360, 36); Controls.Add(lblNameWarn);
        y += 66;
        AddLabel("하는 일", x, y + 3);
        var kinds = new FlowLayoutPanel { Location = new Point(lx, y), Size = new Size(360, 56), FlowDirection = FlowDirection.LeftToRight };
        Radio(rbApp, "프로그램 열기", kinds); Radio(rbUrl, "사이트 열기", kinds); Radio(rbKeys, "단축키 누르기", kinds);
        Radio(rbText, "글자 넣기", kinds); Radio(rbBuiltin, "내장 기능", kinds);
        Controls.Add(kinds);
        y += 62;
        AddLabel("대상", x, y + 3);
        txtTarget.SetBounds(lx, y, 262, 26); Controls.Add(txtTarget);
        btnBrowse.SetBounds(lx + 268, y - 1, 92, 28); btnBrowse.Text = "찾아보기…"; Controls.Add(btnBrowse);
        cmbBuiltin.SetBounds(lx, y, 200, 26); cmbBuiltin.DropDownStyle = ComboBoxStyle.DropDownList; cmbBuiltin.Items.AddRange(BuiltinNames); Controls.Add(cmbBuiltin);
        txtText.SetBounds(lx, y, 360, 70); txtText.Multiline = true; txtText.ScrollBars = ScrollBars.Vertical; Controls.Add(txtText);
        lblHelp.SetBounds(lx, y + 30, 360, 44); lblHelp.ForeColor = Color.DimGray; Controls.Add(lblHelp);
        y += 80;
        AddLabel("아이콘", x, y + 3);
        var icons = new FlowLayoutPanel { Location = new Point(lx, y), Size = new Size(380, 78), FlowDirection = FlowDirection.LeftToRight };
        Radio(icAuto, "자동(프로그램에서)", icons); Radio(icLetter, "글자", icons); Radio(icFav, "사이트 아이콘 받기", icons);
        Radio(icFile, "그림 파일…", icons); Radio(icBuiltin, "기본 그림", icons); Radio(icLib, "모음에서…", icons);
        Controls.Add(icons);
        y += 80;
        cmbIcon.SetBounds(lx, y + 20, 170, 40); cmbIcon.DropDownStyle = ComboBoxStyle.DropDownList; cmbIcon.DrawMode = DrawMode.OwnerDrawFixed; cmbIcon.ItemHeight = 38;
        for (int i = 0; i < 16; i++) cmbIcon.Items.Add(DeckConfig.KeyNames[i]);
        cmbIcon.DrawItem += DrawIconItem;
        Controls.Add(cmbIcon);
        pic.SetBounds(lx + 200, y, 88, 88); pic.BackColor = Dark; pic.SizeMode = PictureBoxSizeMode.CenterImage; Controls.Add(pic);
        y += 100;
        btnClear.SetBounds(lx, y, 120, 30); btnClear.Text = "이 칸 비우기"; Controls.Add(btnClear);

        lblStatus.SetBounds(12, 514, 936, 40); lblStatus.ForeColor = Color.FromArgb(40, 90, 160); Controls.Add(lblStatus);
        btnDefault.SetBounds(12, 564, 120, 34); btnDefault.Text = "기본값으로"; Controls.Add(btnDefault);
        btnSave.SetBounds(640, 564, 200, 34); btnSave.Text = "저장하고 보드에 보내기"; btnSave.Font = new Font(Font, FontStyle.Bold); Controls.Add(btnSave);
        btnClose.SetBounds(848, 564, 100, 34); btnClose.Text = "닫기"; Controls.Add(btnClose);
        foreach (Control c in new Control[] { btnDefault, btnSave, btnClose, lblStatus }) c.Anchor = AnchorStyles.Bottom | AnchorStyles.Left;
        btnSave.Anchor = btnClose.Anchor = AnchorStyles.Bottom | AnchorStyles.Right;

        // 바꾸면 바로 미리보기
        txtName.TextChanged += delegate { if (loading) return; Cur.Name = txtName.Text; CheckName(); if (Cur.IconMode == "letter") Retile(); Changed(); };
        txtTarget.TextChanged += delegate {
            if (loading) return;
            Cur.Target = txtTarget.Text.Trim();
            if (Cur.IconMode == "auto") { Cur.IconSrc = Cur.Target; iconLater.Stop(); iconLater.Start(); }
            Changed();
        };
        txtTarget.Leave += delegate {
            if (Cur.Kind == "url" && Cur.Target.Length > 0 && !Regex.IsMatch(Cur.Target, "^[a-zA-Z][a-zA-Z0-9+.-]*:")) { txtTarget.Text = "https://" + Cur.Target; }
        };
        txtText.TextChanged += delegate { if (loading) return; Cur.Target = txtText.Text; Changed(); };
        cmbBuiltin.SelectedIndexChanged += delegate { if (loading || cmbBuiltin.SelectedIndex < 0) return; Cur.Target = BuiltinCodes[cmbBuiltin.SelectedIndex]; Changed(); };
        iconLater.Interval = 700;
        iconLater.Tick += delegate { iconLater.Stop(); if (Cur.IconMode == "auto") { Retile(); grid.Invalidate(); } };

        foreach (var rb in new[] { rbApp, rbUrl, rbKeys, rbText, rbBuiltin }) rb.Click += delegate (object s, EventArgs e) { SetKind((RadioButton)s); };
        icAuto.Click += delegate { SetIcon("auto"); };
        icLetter.Click += delegate { SetIcon("letter"); };
        icFav.Click += delegate { GetFavicon(); };
        icFile.Click += delegate { PickImage(); };
        icLib.Click += delegate { PickLibrary(); };
        icBuiltin.Click += delegate { SetIcon("builtin"); };
        cmbIcon.SelectedIndexChanged += delegate { if (loading || cmbIcon.SelectedIndex < 0) return; Cur.IconMode = "builtin"; Cur.IconSrc = DeckConfig.Keys[cmbIcon.SelectedIndex]; Retile(); ShowCell(); Changed(); };
        btnBrowse.Click += delegate { Browse(); };
        btnClear.Click += delegate { work.Cells[sel] = DeckConfig.Empty(); ShowCell(); Changed(); };
        btnSave.Click += delegate { Save(); };
        btnDefault.Click += delegate { ToDefault(); };
        btnClose.Click += delegate { Close(); };

        host.PushProgress += OnProgress;
        poll.Interval = 700;
        poll.Tick += delegate { if ((DateTime.Now - lastMsg).TotalSeconds > 2) lblStatus.Text = host.DeckStatus(); };
        poll.Start();

        work = host.LoadDeck();
        SelectCell(0);
        lblStatus.Text = host.DeckStatus();
    }

    DateTime lastMsg = DateTime.MinValue;
    void OnProgress(string s)
    {
        host.Ui.Post(delegate { if (!IsDisposed) { lblStatus.Text = s; lastMsg = DateTime.Now; } }, null);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        if (dirty)
        {
            var r = MessageBox.Show(this, "저장하지 않은 변경이 있어요. 저장할까요?", "단축키 꾸미기", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
            if (r == DialogResult.Cancel || (r == DialogResult.Yes && !Save())) { e.Cancel = true; return; }
        }
        host.PushProgress -= OnProgress;
        poll.Stop(); iconLater.Stop();
        base.OnFormClosing(e);
    }

    void AddLabel(string t, int x, int y) { var l = new Label { Text = t, Location = new Point(x, y), AutoSize = true }; Controls.Add(l); }
    static void Radio(RadioButton rb, string t, Control parent) { rb.Text = t; rb.AutoSize = true; rb.Margin = new Padding(0, 2, 10, 2); parent.Controls.Add(rb); }

    public DeckConfig Work { get { return work; } }
    public int Selected { get { return sel; } }
    DeckCell Cur { get { return work.Cells[sel]; } }
    void Changed() { dirty = true; grid.Invalidate(); }
    public void MarkDirty() { dirty = true; grid.Invalidate(); }

    public void SelectCell(int i)
    {
        if (iconLater.Enabled) { iconLater.Stop(); if (Cur.IconMode == "auto") Retile(); }   // 고치던 칸의 아이콘을 마저 만든다
        sel = i;
        ShowCell();
        grid.Invalidate();
    }

    // 고른 칸을 오른쪽에 보여 준다
    void ShowCell()
    {
        loading = true;
        var c = Cur;
        int n = sel + 1;
        lblCell.Text = n + "번 칸   ·  7인치: " + (sel < 8 ? "윗줄 " : "아랫줄 ") + (sel % 8 + 1) + "번째  ·  4인치: " + (sel / 4 + 1) + "줄 " + (sel % 4 + 1) + "번째";
        txtName.Text = c.Name;
        rbApp.Checked = c.Kind == "app"; rbUrl.Checked = c.Kind == "url"; rbKeys.Checked = c.Kind == "keys";
        rbText.Checked = c.Kind == "text"; rbBuiltin.Checked = c.Kind == "builtin";
        if (c.Kind == "none") foreach (var rb in new[] { rbApp, rbUrl, rbKeys, rbText, rbBuiltin }) rb.Checked = false;
        txtTarget.Text = c.Kind == "text" || c.Kind == "builtin" ? "" : c.Target;
        txtText.Text = c.Kind == "text" ? c.Target : "";
        cmbBuiltin.SelectedIndex = c.Kind == "builtin" ? Math.Max(0, Array.IndexOf(BuiltinCodes, c.Target)) : -1;
        icAuto.Checked = c.IconMode == "auto"; icLetter.Checked = c.IconMode == "letter"; icFav.Checked = c.IconMode == "favicon";
        icFile.Checked = c.IconMode == "file" || c.IconMode == "fileraw"; icBuiltin.Checked = c.IconMode == "builtin"; icLib.Checked = c.IconMode == "library";
        int bi = Array.IndexOf(DeckConfig.Keys, c.IconSrc);
        cmbIcon.SelectedIndex = c.IconMode == "builtin" ? (bi >= 0 ? bi : sel) : -1;
        LayoutKind();
        pic.Image = c.Kind == "none" ? null : c.Tile;
        cmbIcon.Visible = c.Kind != "none" && c.IconMode == "builtin";
        CheckName();
        loading = false;
    }

    // 하는 일에 따라 대상 칸 모양을 바꾼다
    void LayoutKind()
    {
        string k = Cur.Kind;
        txtTarget.Visible = k == "app" || k == "url" || k == "keys";
        btnBrowse.Visible = k == "app";
        txtText.Visible = k == "text";
        cmbBuiltin.Visible = k == "builtin";
        lblHelp.Visible = k == "url" || k == "keys" || k == "app" || k == "none";
        if (k == "url") lblHelp.Text = "사이트 주소를 넣어요. 예) https://www.naver.com";
        else if (k == "keys") lblHelp.Text = "^ = Ctrl,  + = Shift,  % = Alt.  예) ^c 복사, ^+m, %{F4} 창 닫기, {ENTER} 엔터, {F5}";
        else if (k == "app") lblHelp.Text = "[찾아보기]로 고르거나, 프로그램·바로 가기를 왼쪽 칸에 끌어다 놓아요.";
        else if (k == "none") lblHelp.Text = "빈 칸이에요. 위에서 하는 일을 고르세요.";
        txtTarget.Width = k == "app" ? 262 : 360;
        icAuto.Enabled = k == "app";
        icFav.Enabled = k == "url";
        bool on = k != "none";
        icLetter.Enabled = icFile.Enabled = icBuiltin.Enabled = icLib.Enabled = cmbIcon.Enabled = txtName.Enabled = btnClear.Enabled = on;
    }

    void SetKind(RadioButton rb)
    {
        var c = Cur;
        string k = rb == rbApp ? "app" : rb == rbUrl ? "url" : rb == rbKeys ? "keys" : rb == rbText ? "text" : "builtin";
        if (c.Kind == k) return;
        bool wasNone = c.Kind == "none";
        c.Kind = k;
        if (k == "builtin") c.Target = BuiltinCodes[0];
        else if (k == "text" || wasNone || c.Target.StartsWith("#")) c.Target = "";
        if (c.IconMode == "auto" && k != "app") c.IconMode = "letter";
        if (c.IconMode == "favicon" && k != "url") c.IconMode = "letter";
        if (wasNone) { c.IconMode = k == "app" ? "auto" : "letter"; c.IconSrc = ""; }
        Retile();
        ShowCell();
        Changed();
    }

    void SetIcon(string mode)
    {
        var c = Cur;
        c.IconMode = mode;
        if (mode == "auto") c.IconSrc = c.Target;
        else if (mode == "builtin") { int bi = Array.IndexOf(DeckConfig.Keys, c.IconSrc); c.IconSrc = DeckConfig.Keys[bi >= 0 ? bi : sel]; }
        else if (mode == "letter") c.IconSrc = "";
        Retile();
        ShowCell();
        Changed();
    }

    // 아이콘 그림을 지금 설정대로 다시 만든다
    void Retile()
    {
        var c = Cur;
        Cursor = Cursors.WaitCursor;
        try
        {
            if (c.IconMode == "letter") c.Tile = DeckIcons.LetterTile(c.Name);
            else if (c.IconMode == "favicon") { if (c.Tile == null) c.Tile = DeckIcons.LetterTile(c.Name); }
            else c.Tile = DeckIcons.MakeTile(c, null);
        }
        finally { Cursor = Cursors.Default; }
        pic.Image = c.Tile;
    }

    void GetFavicon()
    {
        var c = Cur;
        if (c.Target.Length == 0) { MessageBox.Show(this, "먼저 사이트 주소를 넣어 주세요.", "단축키 꾸미기"); ShowCell(); return; }
        Cursor = Cursors.WaitCursor;
        Bitmap g = null;
        try { g = DeckIcons.IconFavicon(c.Target); } finally { Cursor = Cursors.Default; }
        if (g == null)
        {
            MessageBox.Show(this, "사이트 아이콘을 받지 못했어요(인터넷 연결을 확인해 주세요). 글자 아이콘으로 둘게요.", "단축키 꾸미기");
            SetIcon("letter");
            return;
        }
        using (g) c.Tile = DeckIcons.Tile(g);
        c.IconMode = "favicon"; c.IconSrc = c.Target;
        ShowCell(); Changed();
    }

    void PickImage()
    {
        using (var d = new OpenFileDialog { Title = "아이콘으로 쓸 그림 고르기", Filter = "그림 파일|*.png;*.jpg;*.jpeg;*.bmp;*.ico;*.gif|모든 파일|*.*" })
        {
            if (d.ShowDialog(this) != DialogResult.OK) { ShowCell(); return; }
            try
            {
                // 테두리까지 다 그린 그림이면 '그대로', 기호만 있으면 다른 칸과 같은 틀에 넣는다(아이콘_직접만들기.md)
                var r = MessageBox.Show(this, "이 그림을 어떻게 넣을까요?\n\n[예] 틀에 넣기 — 기호만 있는 그림(다른 칸과 같은 테두리를 씌워요)\n[아니요] 그대로 — 테두리까지 다 그린 완성 그림",
                    "단축키 꾸미기", MessageBoxButtons.YesNoCancel, MessageBoxIcon.Question);
                if (r == DialogResult.Cancel) { ShowCell(); return; }
                bool raw = r == DialogResult.No;
                using (var g = DeckIcons.IconFromFile(d.FileName)) Cur.Tile = raw ? DeckIcons.Fit72(g) : DeckIcons.Tile(g);
                Cur.IconMode = raw ? "fileraw" : "file"; Cur.IconSrc = d.FileName;
            }
            catch { MessageBox.Show(this, "이 그림은 열 수 없어요.", "단축키 꾸미기"); }
            ShowCell(); Changed();
        }
    }

    void PickLibrary()
    {
        if (DeckLibrary.Items().Count == 0) { MessageBox.Show(this, "아이콘 모음을 찾지 못했어요. 도우미를 새로 받아 주세요.", "단축키 꾸미기"); ShowCell(); return; }
        using (var d = new LibraryPicker(libTheme))
        {
            if (d.ShowDialog(this) != DialogResult.OK || d.Picked == null) { ShowCell(); return; }
            libTheme = d.ThemeIndex;
            var c = Cur; var it = d.Picked;
            // 빈 칸이거나 '같이 넣기'를 고르면 이름·하는 일도 모음의 추천대로(대상이 비어 있는 추천은 하는 일만)
            if ((c.Kind == "none" || d.UseAction) && it.Kind != "")
            {
                c.Name = it.Name;
                c.Kind = it.Kind;
                if (it.Kind == "builtin") c.Target = "#" + it.Target;
                else if (it.Target != "") c.Target = it.Target;
                if (c.Kind == "builtin" && Array.IndexOf(BuiltinCodes, c.Target) < 0) c.Target = BuiltinCodes[0];
            }
            else if (c.Kind == "none") { c.Name = it.Name; c.Kind = "url"; c.Target = ""; }
            c.IconMode = "library"; c.IconSrc = d.PickedSrc;
            Retile(); ShowCell(); Changed();
        }
    }

    void Browse()
    {
        using (var d = new OpenFileDialog { Title = "열 프로그램 고르기", Filter = "프로그램·바로 가기|*.exe;*.lnk;*.bat;*.cmd|모든 파일|*.*", DereferenceLinks = false })
        {
            if (d.ShowDialog(this) != DialogResult.OK) return;
            FillFromPath(sel, d.FileName, false);
            ShowCell(); Changed();
        }
    }

    // 파일·바로 가기·주소로 칸 채우기(끌어다 놓기·찾아보기)
    public void FillFromPath(int i, string path, bool rename)
    {
        var c = work.Cells[i];
        bool wasNone = c.Kind == "none";
        string ext = Path.GetExtension(path).ToLowerInvariant();
        bool web = path.StartsWith("http://") || path.StartsWith("https://");
        if (ext == ".url")
            try { foreach (var l in File.ReadAllLines(path)) if (l.StartsWith("URL=", StringComparison.OrdinalIgnoreCase)) { path = l.Substring(4).Trim(); web = true; break; } } catch { }
        if (rename || wasNone || c.Name.Length == 0)
        {
            string nm = web ? HostName(path) : Path.GetFileNameWithoutExtension(path);
            c.Name = CleanName(nm);
        }
        c.Kind = web ? "url" : "app";
        c.Target = path;
        c.IconMode = web ? "letter" : "auto";
        c.IconSrc = web ? "" : path;
        int keep = sel; sel = i; Retile(); sel = keep;
    }

    static string HostName(string url)
    {
        try { var h = new Uri(url).Host; if (h.StartsWith("www.")) h = h.Substring(4); int d = h.IndexOf('.'); return d > 0 ? h.Substring(0, d) : h; }
        catch { return url; }
    }

    // 보드 글꼴 밖 글자는 빼고 8자에서 자른다
    public static string CleanName(string s)
    {
        var sb = new StringBuilder();
        foreach (char ch in s ?? "") if (CharOk(ch)) sb.Append(ch);
        string r = sb.ToString().Trim();
        return r.Length > 8 ? r.Substring(0, 8).Trim() : r;
    }

    // 보드에 나오는 글자: 영문·숫자·기본 기호, 몇 가지 기호, 한글 2,350자(EUC-KR 로 바뀌는 완성형)
    public static bool CharOk(char ch)
    {
        if (ch >= 0x20 && ch <= 0x7E) return true;
        if (Extra.IndexOf(ch) >= 0) return true;
        if (ch < 0xAC00 || ch > 0xD7A3) return false;
        try { Euc.GetBytes(ch.ToString()); return true; } catch { return false; }
    }

    // 이름 검사: 안 되는 글자 빨강(저장 막음), 길면 노랑
    bool CheckName()
    {
        string bad = "";
        foreach (char ch in Cur.Name) if (!CharOk(ch) && bad.IndexOf(ch) < 0) bad += ch;
        double w = 0; foreach (char ch in Cur.Name) w += ch < 128 ? 0.6 : 1;
        if (bad.Length > 0)
        {
            lblNameWarn.ForeColor = Color.Red; txtName.BackColor = Color.FromArgb(255, 225, 225);
            lblNameWarn.Text = "이 글자는 보드에 나오지 않아요: " + bad;
            return false;
        }
        txtName.BackColor = SystemColors.Window;
        if (Encoding.UTF8.GetByteCount(Cur.Name) > 39)
        {
            lblNameWarn.ForeColor = Color.Red; lblNameWarn.Text = "이름이 너무 길어요. 줄여 주세요.";
            return false;
        }
        if (w > 6.01) { lblNameWarn.ForeColor = Color.DarkGoldenrod; lblNameWarn.Text = "조금 길어요(한글 6자, 영문 10자 안쪽이 좋아요). 보드에서 끝이 … 로 잘릴 수 있어요."; }
        else { lblNameWarn.ForeColor = Color.DimGray; lblNameWarn.Text = Cur.Kind == "none" ? "" : "보드 칸 아래에 나오는 이름이에요."; }
        return true;
    }

    bool Save()
    {
        for (int i = 0; i < 16; i++)
        {
            var c = work.Cells[i];
            if (c.Kind == "none") continue;
            string bad = "";
            foreach (char ch in c.Name) if (!CharOk(ch)) bad += ch;
            string why = bad.Length > 0 ? "이 글자는 보드에 나오지 않아요: " + bad
                : Encoding.UTF8.GetByteCount(c.Name) > 39 ? "이름이 너무 길어요."
                : c.Name.Trim().Length == 0 ? "이름을 넣어 주세요."
                : c.Target.Trim().Length == 0 ? "무엇을 열지(대상)를 넣어 주세요." : null;
            if (why != null) { SelectCell(i); MessageBox.Show(this, (i + 1) + "번 칸: " + why, "단축키 꾸미기", MessageBoxButtons.OK, MessageBoxIcon.Warning); return false; }
        }
        work.IsDefault = false;
        try { Cursor = Cursors.WaitCursor; host.SaveDeck(work); }
        catch (Exception ex) { MessageBox.Show(this, "저장하지 못했어요: " + ex.Message, "단축키 꾸미기"); return false; }
        finally { Cursor = Cursors.Default; }
        host.RequestPush(true);
        dirty = false;
        lblStatus.Text = host.HasDeckBoard() ? "저장했어요. 보드에 보내요(7인치는 1분쯤 걸려요)." : "저장했어요. 보드를 꽂으면 저절로 보내요.";
        lastMsg = DateTime.Now.AddSeconds(2);
        ShowCell(); grid.Invalidate();
        return true;
    }

    void ToDefault()
    {
        if (MessageBox.Show(this, "16칸을 처음 상태로 되돌릴까요?\n보드도 기본 아이콘으로 돌아가요.", "단축키 꾸미기", MessageBoxButtons.YesNo, MessageBoxIcon.Question) != DialogResult.Yes) return;
        work = DeckConfig.Default(Helper.AppFor);
        for (int i = 0; i < 16; i++) work.Cells[i].Tile = builtinPics[i] != null ? new Bitmap(builtinPics[i]) : null;
        work.IsDefault = true;
        try { host.SaveDeck(work); work.IsDefault = true; }
        catch (Exception ex) { MessageBox.Show(this, "저장하지 못했어요: " + ex.Message, "단축키 꾸미기"); return; }
        host.RequestReset();
        dirty = false;
        lblStatus.Text = "기본값으로 되돌렸어요. 보드도 기본 아이콘으로 되돌려요.";
        lastMsg = DateTime.Now.AddSeconds(2);
        SelectCell(sel);
    }

    void DrawIconItem(object s, DrawItemEventArgs e)
    {
        e.DrawBackground();
        if (e.Index < 0) return;
        if (builtinPics[e.Index] != null)
        {
            e.Graphics.FillRectangle(new SolidBrush(Dark), e.Bounds.X + 2, e.Bounds.Y + 1, 36, 36);
            e.Graphics.InterpolationMode = InterpolationMode.HighQualityBicubic;
            e.Graphics.DrawImage(builtinPics[e.Index], e.Bounds.X + 3, e.Bounds.Y + 2, 34, 34);
        }
        TextRenderer.DrawText(e.Graphics, DeckConfig.KeyNames[e.Index], e.Font, new Point(e.Bounds.X + 44, e.Bounds.Y + 10), e.ForeColor);
        e.DrawFocusRectangle();
    }
}

// 왼쪽 4x4 미리보기(누르면 고르기, 파일을 끌어다 놓으면 채우기)
class DeckGrid : Control
{
    readonly DeckForm f;
    const int Cell = 120, Gap = 4;
    public DeckGrid(DeckForm form)
    {
        f = form;
        DoubleBuffered = true;
        AllowDrop = true;
        BackColor = Color.FromArgb(30, 34, 48);
        Cursor = Cursors.Hand;
    }

    int HitCell(Point p)
    {
        int cx = (p.X - Gap) / (Cell + Gap), cy = (p.Y - Gap) / (Cell + Gap);
        if (cx < 0 || cx > 3 || cy < 0 || cy > 3) return -1;
        return cy * 4 + cx;
    }

    Rectangle CellRect(int i) { return new Rectangle(Gap + (i % 4) * (Cell + Gap), Gap + (i / 4) * (Cell + Gap), Cell, Cell); }

    protected override void OnMouseDown(MouseEventArgs e) { int i = HitCell(e.Location); if (i >= 0) f.SelectCell(i); base.OnMouseDown(e); }

    protected override void OnDragEnter(DragEventArgs e)
    {
        e.Effect = e.Data.GetDataPresent(DataFormats.FileDrop) || e.Data.GetDataPresent(DataFormats.UnicodeText) ? DragDropEffects.Copy : DragDropEffects.None;
    }

    protected override void OnDragDrop(DragEventArgs e)
    {
        int i = HitCell(PointToClient(new Point(e.X, e.Y)));
        if (i < 0) return;
        string path = null;
        var files = e.Data.GetData(DataFormats.FileDrop) as string[];
        if (files != null && files.Length > 0) path = files[0];
        else
        {
            var t = (e.Data.GetData(DataFormats.UnicodeText) as string ?? "").Trim();
            if (t.StartsWith("http://") || t.StartsWith("https://")) path = t;
        }
        if (path == null) return;
        f.FillFromPath(i, path, true);
        f.SelectCell(i);
        f.MarkDirty();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        var w = f.Work;
        if (w == null) return;
        using (var small = new Font("Malgun Gothic", 8f))
        using (var name = new Font("Malgun Gothic", 10f, FontStyle.Bold))
            for (int i = 0; i < 16; i++)
            {
                var r = CellRect(i);
                var c = w.Cells[i];
                bool on = i == f.Selected;
                using (var br = new SolidBrush(on ? Color.FromArgb(52, 60, 84) : Color.FromArgb(40, 45, 62))) g.FillRectangle(br, r);
                if (on) using (var pen = new Pen(Color.FromArgb(90, 140, 255), 3)) g.DrawRectangle(pen, r.X + 1, r.Y + 1, r.Width - 3, r.Height - 3);
                TextRenderer.DrawText(g, (i + 1).ToString(), small, new Point(r.X + 4, r.Y + 2), Color.FromArgb(130, 140, 160));
                if (c.Kind == "none")
                {
                    TextRenderer.DrawText(g, "+ 비어 있음", name, new Rectangle(r.X, r.Y + 40, r.Width, 30), Color.FromArgb(110, 118, 136), TextFormatFlags.HorizontalCenter);
                    continue;
                }
                if (c.Tile != null) g.DrawImage(c.Tile, r.X + (Cell - 72) / 2, r.Y + 12, 72, 72);
                TextRenderer.DrawText(g, c.Name, name, new Rectangle(r.X + 2, r.Y + 88, r.Width - 4, 24), Color.White,
                    TextFormatFlags.HorizontalCenter | TextFormatFlags.EndEllipsis | TextFormatFlags.SingleLine);
            }
    }
}
