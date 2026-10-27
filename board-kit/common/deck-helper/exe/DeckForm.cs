// '단축키 꾸미기' 창 — 16칸의 이름·하는 일·아이콘을 고치고 저장하면 도우미가 보드로 보낸다. C# 5 문법만
// 화면 짜임(설계_도우미화면.md): 위 띠(TopBar) / 가운데 보드 미리보기(BoardView) / 오른쪽 동작 목록(ActionList) / 아래 속성 창(Inspector) / 아래 띠(StatusBar)
// 일 함수(ShowCell·SetKind·SetIcon·Retile·ApplyLib·FillPreset·Export·Import·Save …)는 예전 그대로이고, 가리키는 컨트롤만 바뀌었다.
using System;
using System.Collections.Generic;
using System.ComponentModel;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

class DeckForm : Form
{
    readonly Helper host;
    DeckConfig work;
    int sel;
    bool dirty, loading;
    int shape = 7;

    readonly TopBar top;
    readonly StatusBar status;
    readonly ActionList actions;
    readonly Inspector insp;
    readonly BoardView board;
    readonly Panel mid, inner;   // mid: 스크롤 판 / inner: 그 안에서 보드·속성 창·동작 목록을 도킹으로 담는 판(최소 1080×(600-띠))
    const int LayoutW = 1080, LayoutH = 600;   // 짜임을 설계·시험한 가장 작은 안쪽 크기(이보다 작으면 스크롤)
    readonly ContextMenuStrip cellMenu = new ContextMenuStrip(), presetMenu = new ContextMenuStrip(), themeMenu = new ContextMenuStrip();
    readonly ContextMenuStrip moreMenu = new ContextMenuStrip(), builtinMenu = new ContextMenuStrip(), manualMenu = new ContextMenuStrip();
    TourOverlay tour; PracticePanel practice;   // 둘러보기 안내 · 연습 과제(DeckTour.cs)
    readonly ContextMenuStrip iconMenu;
    ToolStripMenuItem cellIconSub;
    readonly ToolTip tip = DarkTip.Make();
    DeckCell clip;   // 칸 복사·붙여넣기
    readonly Timer poll = new Timer(), iconLater = new Timer();
    readonly Bitmap[] builtinPics = new Bitmap[16];
    readonly Bitmap[] builtinSmall = new Bitmap[16];
    bool hintClosed, hintShown; string hintText;
    // 되돌리기·다시 하기: 바꾸기 직전의 16칸을 통째로 쌓아 둔다(최대 50번)
    readonly List<DeckCell[]> undo = new List<DeckCell[]>(), redo = new List<DeckCell[]>();
    const int UndoMax = 50;
    readonly Timer typeSnap = new Timer();   // 글자를 칠 때는 0.7초 묶음으로 첫 글자 전에 한 번만 쌓는다
    int favCell = -1;                        // 사이트 아이콘을 받는 중인 칸(-1 = 없음)
    static string DraftFile { get { return Path.Combine(Helper.DataDir, "deck.draft.json"); } }   // 윈도 종료 때 저장 못 한 꾸미기

    public static readonly string[] BuiltinCodes = { "#desktop", "#altf4", "#lock", "#mute", "#volup", "#voldown", "#playpause", "#next", "#prev" };
    public static readonly string[] BuiltinNames = { "바탕화면 보기", "맨 앞 창 닫기", "화면 잠그기", "소리 끄기·켜기", "소리 크게", "소리 작게", "재생·멈춤", "다음 곡", "이전 곡" };
    public static readonly string[] BuiltinIconKeys = { "desktop2", "closewin", "lock", "mute", "volup", "voldown", "playpause", "nexttrack", "sd_prev" };   // 동작 목록·끌어 놓기 그림(모음 key)
    static readonly string[] KindCodes = { "app", "url", "keys", "text", "builtin", "multi" };
    static readonly string[] KindNames = { "프로그램 열기", "사이트 열기", "단축키 누르기", "글자 넣기", "컴퓨터 기능", "여러 동작" };
    static int libTheme;   // 모음 창에서 마지막에 고른 테마
    static bool themeLoaded;
    static readonly Encoding Euc = Encoding.GetEncoding(51949, EncoderFallback.ExceptionFallback, DecoderFallback.ExceptionFallback);
    const string Extra = "°·→▶◀●";   // 보드 글꼴에 있는 기호
    const string TitleText = "탭덱 — 단축키 꾸미기";
    const string HintNormal = "오른쪽 목록에서 동작을 끌어 칸에 놓으세요. 칸을 누르면 아래에서 이름과 아이콘을 고칠 수 있어요.";
    const string HintEmpty = "비어 있어요. 위의 [한 번에 채우기]로 시작해도 좋아요.";

    public DeckForm(Helper h)
    {
        host = h;
        Text = TitleText;
        Font = DeckFonts.Regular(9.5f);
        BackColor = Theme.Bg;
        ForeColor = Theme.Text1;
        StartPosition = FormStartPosition.CenterScreen;
        ClientSize = new Size(1240, 720);
        MinimumSize = SizeFromClientSize(new Size(1080, 600));
        KeyPreview = true;
        try { Icon = Icon.ExtractAssociatedIcon(Application.ExecutablePath); } catch { }
        for (int i = 0; i < 16; i++)
        {
            builtinPics[i] = DeckIcons.Builtin(DeckConfig.Keys[i]);
            if (builtinPics[i] != null)
            {
                builtinSmall[i] = new Bitmap(24, 24);
                using (var g = Graphics.FromImage(builtinSmall[i])) { g.InterpolationMode = InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = PixelOffsetMode.HighQuality; g.DrawImage(builtinPics[i], 0, 0, 24, 24); }
            }
        }
        if (!themeLoaded)
        {
            themeLoaded = true;
            int t; if (int.TryParse(DeckPrefs.Get("theme", "0"), out t)) libTheme = Math.Max(0, Math.Min(DeckLibrary.Themes.Length - 1, t));
        }
        shape = FirstShape();

        // 짜임: 도킹은 Controls 의 뒤쪽부터 자리를 잡는다 → 아래 띠·위 띠·동작 목록·속성 창·보드 차례로 잡히게 거꾸로 넣는다
        status = new StatusBar { Dock = DockStyle.Bottom };
        top = new TopBar { Dock = DockStyle.Top };
        actions = new ActionList(this) { Dock = DockStyle.Right, Width = 300 };
        insp = new Inspector { Dock = DockStyle.Bottom };
        board = new BoardView(this) { Dock = DockStyle.Fill };
        // 가운데(보드·속성 창·동작 목록)는 스크롤 판 안에: 화면이 작아 창이 1080×600 보다 줄어들면(1366×768 150% 등) 짜임을 무너뜨리지 않고
        // 스크롤 막대가 생긴다. 위 띠·아래 띠([저장하고 보드에 보내기])는 늘 보인다(레이아웃 검수 1·2·3·7)
        // (스크롤 판에 바로 도킹하면 WinForms 가 도킹한 쪽 폭·높이를 스크롤 범위에 더해 버려 늘 막대가 생긴다 → 안쪽 판(inner)을 두고 크기를 손으로 맞춘다)
        mid = new Panel { Dock = DockStyle.Fill, AutoScroll = true, BackColor = Theme.Bg };
        inner = new Panel { Location = Point.Empty, BackColor = Theme.Bg };
        inner.Controls.Add(board); inner.Controls.Add(insp); inner.Controls.Add(actions);
        mid.Controls.Add(inner);
        Controls.Add(mid); Controls.Add(top); Controls.Add(status);
        board.TabIndex = 0; insp.TabIndex = 1; actions.TabIndex = 2; inner.TabIndex = 0; mid.TabIndex = 0; top.TabIndex = 3; status.TabIndex = 4;
        mid.Resize += delegate { LayoutMid(); };
        LayoutMid();

        iconMenu = BuildIconMenu();
        BuildMenus();
        insp.IconBtn.DropMenu = iconMenu;
        insp.BuiltinBtn.DropMenu = builtinMenu;
        top.Preset.DropMenu = presetMenu;
        top.ThemeBtn.DropMenu = themeMenu;
        top.More.DropMenu = moreMenu;
        top.Manual.DropMenu = manualMenu;
        manualMenu.Items.AddRange(new ToolStripItem[] {
            Item("설명서 보기(그림과 따라 하기)", delegate { DeckManual.Open(this, null); }),
            Item("둘러보기 안내 다시 보기", delegate { StartTour(); }),
            Item("연습 과제 해 보기", delegate { StartPractice(); }),
            new ToolStripSeparator(),
            Item("설명서 PDF(인터넷)", delegate { DeckManual.OpenPdf(this); }) });
        Theme.DarkMenu(manualMenu);
        tip.SetToolTip(top.Manual, "설명서 · 둘러보기 안내 · 연습 과제 (F1)");
        top.ThemeBtn.Text = "아이콘 모양: " + DeckLibrary.ThemeNames[libTheme];
        tip.SetToolTip(insp.TryBtn, "보드 없이 이 컴퓨터에서 바로 해 봐요(저장 전에도 돼요)");
        tip.SetToolTip(top.Preset, "16칸을 한 번에: 이 컴퓨터에 깔린 프로그램으로, 또는 수업용·업무용·발표용 묶음으로");
        tip.SetToolTip(top.ThemeBtn, "모음에서 고른 아이콘을 모두 이 테마 모양으로 바꿔요(보드 색 테마에 맞추기)");
        tip.SetToolTip(insp.ClearBtn, "이 칸을 빈 칸으로 만들어요(Delete)");

        // 바꾸면 바로 미리보기
        var txtName = insp.NameBox.Box; var txtTarget = insp.TargetBox.Box; var txtText = insp.TextBox.Box;
        txtName.TextChanged += delegate { if (loading) return; TypeSnap(); Prac("name"); Cur.Name = txtName.Text; CheckName(); if (Cur.IconMode == "letter") Retile(); Changed(); };
        txtTarget.TextChanged += delegate {
            tip.SetToolTip(txtTarget, txtTarget.Text.Length > 40 ? txtTarget.Text : "");   // 긴 경로는 마우스를 올리면 전체가 보이게(UX 검수)
            if (loading) return;
            TypeSnap();
            Cur.Target = txtTarget.Text.Trim();
            if (Cur.IconMode == "auto") { Cur.IconSrc = Cur.Target; iconLater.Stop(); iconLater.Start(); }
            if (Cur.Kind == "keys") UpdateHelp();
            Changed();
        };
        txtTarget.Leave += delegate {
            if (Cur.Kind == "url" && Cur.Target.Trim().Length > 0 && !UrlX.HasScheme(Cur.Target)) { txtTarget.Text = "https://" + Cur.Target.Trim(); }
        };
        txtText.TextChanged += delegate { if (loading) return; TypeSnap(); Cur.Target = txtText.Text; Changed(); };
        typeSnap.Interval = 700;
        typeSnap.Tick += delegate { typeSnap.Stop(); };
        iconLater.Interval = 700;
        iconLater.Tick += delegate { iconLater.Stop(); if (Cur.IconMode == "auto") { Retile(); board.Invalidate(); } };

        insp.Kind.Picked += delegate (int i) { SetKind(KindCodes[i]); };
        insp.BrowseBtn.Click += delegate { Browse(); };
        insp.RecordBtn.Click += delegate { RecordKeys(); };
        insp.OptBtn.Click += delegate { EditOptions(); };
        insp.StepsBtn.Click += delegate { EditSteps(); };
        tip.SetToolTip(insp.RecordBtn, "키보드에서 단축키를 그대로 누르면 넣어져요");
        tip.SetToolTip(insp.OptBtn, "프로그램: 함께 넘길 값·시작 폴더·관리자·열려 있으면 앞으로 / 사이트: 브라우저·새 창 / 글자: 넣고 Enter");
        tip.SetToolTip(insp.StepsBtn, "칸 하나로 여러 일을 차례대로(예: 한글 열기 → 1초 → 나이스 열기)");
        insp.ClearBtn.Click += delegate { ClearCell(sel); };
        insp.TryBtn.Click += delegate { TrySelected(); };
        insp.IconBoxClicked += delegate { iconMenu.Show(insp, new Point(16, 138)); };
        insp.IconImageDropped += delegate (string p) { SetIconFromImage(sel, p); };
        status.BtnSave.Click += delegate { Save(); };
        status.BtnClose.Click += delegate { Close(); };

        host.PushProgress += OnProgress;
        poll.Interval = 700;
        poll.Tick += delegate { if ((DateTime.Now - lastMsg).TotalSeconds > 2) Status(Friendly(host.DeckStatus())); };
        poll.Start();

        work = host.LoadDeck();
        SelectCell(0);
        Status(Friendly(host.DeckStatus()));
        if (host.LoadFailed)
        {   // deck.json 이 깨져 있었다: 원본은 deck.json.broken 으로 남겨 두었음을 알린다
            Status("설정 파일이 깨져 있어 기본값으로 시작해요(원본은 deck.json.broken).");
            lastMsg = DateTime.Now.AddSeconds(15);
        }
        UpdateHint();
        UpdateDirty();
    }

    // 처음 모양: 연결된 보드 → 지난번 모양 → 7인치
    // 아래 띠의 보드 상태 글: 안 꽂혀 있을 때는 무엇을 하면 되는지도 같이(UX 검수)
    static string Friendly(string st)
    {
        if (st == null) return "";
        if (st == "보드가 연결되지 않았어요") return "보드가 연결되지 않았어요 · USB 선을 꽂으면 저절로 찾아요. 지금 저장해 두면 다음에 꽂을 때 보내요.";
        return st;
    }

    int FirstShape()
    {
        if (Helper.IsPreview) return 7;
        string st = host.DeckStatus() ?? "";
        bool s7 = st.Contains("7인치"), s4 = st.Contains("4인치");
        if (s7 != s4) return s7 ? 7 : 4;
        return DeckPrefs.Get("shape", "7") == "4" ? 4 : 7;
    }

    protected override bool ShowWithoutActivation { get { return Helper.IsPreview; } }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        Theme.DarkTitle(Handle);
    }

    protected override void OnShown(EventArgs e)
    {
        base.OnShown(e);
        // 지난번 윈도 종료 때 남긴 꾸미기가 있으면 먼저 묻고, 그다음 둘러보기 안내(처음 한 번만)
        bool hasDraft = !Helper.IsPreview && File.Exists(DraftFile);
        bool firstTour = !Helper.IsPreview && DeckPrefs.Get("tour", "0") != "1";
        if (hasDraft || firstTour) BeginInvoke((Action)delegate { if (hasDraft) CheckDraft(); if (firstTour && !IsDisposed) StartTour(); });
    }

    // ── 둘러보기 안내 · 연습 과제 ──
    Rectangle Rel(Control c, Rectangle r) { return RectangleToClient(c.RectangleToScreen(r)); }
    Rectangle Rel(Control c) { return Rel(c, c.ClientRectangle); }

    public void StartTour()
    {
        if (tour != null) return;
        var st = new List<TourStep> {
            new TourStep { Title = "단축키 꾸미기 창이에요", Body = "보드의 단추 16개를 여기서 바꿔요. 어디에 무엇이 있는지 차례로 보여 드릴게요.\n[다음]을 누르거나 키보드의 → 를 누르세요. 그만 보려면 Esc." },
            // 제목에 ①②… 번호를 붙이지 않는다(머리의 'n / 10' 과 번호가 달라 헷갈림. UX 검수)
            new TourStep { Title = "보드 모양", Body = "보드와 똑같은 16칸이에요. 칸을 누르면 고를 수 있어요. 칸을 끌어 다른 칸에 놓으면 두 칸의 자리가 바뀌어요. 오른쪽 위에서 7인치·4인치 모양을 바꿔 볼 수 있어요(가로로 긴 보드가 7인치, 네모난 보드가 4인치).", Target = () => Rel(board) },
            new TourStep { Title = "동작 목록", Body = "칸에 넣을 수 있는 것들이 모여 있어요. 줄 하나를 마우스로 끌어 칸에 놓으면 이름·하는 일·그림이 한꺼번에 들어가요. 맨 위 찾기 칸에 '한글', '소리'처럼 쳐 보세요.", Target = () => Rel(actions) },
            new TourStep { Title = "칸 설정", Body = "고른 칸의 이름, 하는 일, 대상을 고쳐요. 이름은 보드 칸 아래에 나오는 글자예요. 한글 6자 안쪽이 보기 좋아요.", Target = () => Rel(insp) },
            new TourStep { Title = "하는 일", Body = "프로그램 열기 · 사이트 열기 · 단축키 누르기 · 글자 넣기 · 컴퓨터 기능 · 여러 동작 중에서 골라요. '여러 동작'을 고르면 칸 하나로 여러 일을 차례대로 해요.", Target = () => Rel(insp.Kind) },
            new TourStep { Title = "아이콘", Body = "그림을 누르면 아이콘을 바꿀 수 있어요. 아이콘 모음 205개에서 고르거나, 내 그림 파일을 여기에 끌어다 놓아도 돼요.", Target = () => Rel(insp, new Rectangle(16, 16, 120, 160)) },
            new TourStep { Title = "눌러 보기", Body = "보드가 없어도 이 컴퓨터에서 바로 해 볼 수 있어요. 저장하기 전에 잘 되는지 먼저 확인하세요.", Target = () => Rel(insp.TryBtn) },
            new TourStep { Title = "한 번에 채우기 · 아이콘 모양", Body = "처음이라면 [한 번에 채우기]에서 시작하세요. 이 컴퓨터에 깔린 프로그램으로 16칸을 한 번에 채워 줘요. [아이콘 모양]은 보드 색에 맞춰 그림 모양을 한꺼번에 바꿔요.", Target = () => Rectangle.Union(Rel(top.Preset), Rel(top.ThemeBtn)) },
            new TourStep { Title = "저장하고 보드에 보내기", Body = "다 고쳤으면 꼭 이 단추를 누르세요. 보드 화면에 '새 단축키를 받았습니다'가 나오면 끝이에요. 보드가 꽂혀 있지 않으면 다음에 꽂을 때 저절로 보내요.", Target = () => Rel(status.BtnSave) },
            new TourStep { Title = "설명서", Body = "언제든 여기서 그림 설명서를 보거나, 이 안내를 다시 보거나, 연습 과제를 해 볼 수 있어요(키보드 F1).\n지금 연습 과제를 해 보면 금방 익숙해져요.", Target = () => Rel(top.Manual) },
        };
        tour = new TourOverlay(this, st);
        Controls.Add(tour);
        tour.Finished += delegate { tour = null; DeckPrefs.Set("tour", "1"); DeckPrefs.Save(); };
        tour.PracticeAsked += delegate { StartPractice(); };
        tour.Start();
    }

    public void StartPractice()
    {
        if (practice != null) { practice.BringToFront(); return; }
        practice = new PracticePanel();
        practice.Closed += delegate { if (practice != null) { Controls.Remove(practice); practice.Dispose(); practice = null; board.ReserveLeft = 0; } };
        Controls.Add(practice);
        board.ReserveLeft = practice.Width + 32;   // 보드를 오른쪽으로 밀어 과제 목록이 칸을 가리지 않게(자리가 모자라면 보드는 그대로. UX 검수)
        PlacePractice();
        practice.BringToFront();
        Notify("연습 과제를 시작해요. 보드 왼쪽의 목록을 하나씩 해 보세요.");
    }

    void PlacePractice()
    {
        if (practice == null) return;
        var b = Rel(board);
        if (board.ReserveApplied) practice.Location = new Point(b.Left + 16, Math.Max(b.Top + 16, b.Top + (b.Height - practice.Height) / 2));
        else practice.Location = new Point(b.Left + 16, Math.Max(b.Top + 16, b.Bottom - practice.Height - 8));   // 겹쳐 뜸(끌어서 옮길 수 있음)
    }

    // 안쪽 판 크기 = 스크롤 판의 안쪽과 '1080×600 에서 위·아래 띠를 뺀 것' 중 큰 쪽. 창이 그보다 크면 막대는 안 생기고,
    // 작으면 막대가 생긴다. 세로 막대가 생기면 안쪽 폭이 17 줄어 가로 막대까지 따라 생기지 않게 두세 번 되풀이해 맞춘다
    void LayoutMid()
    {
        if (mid == null || inner == null) return;
        int minH = Math.Max(100, LayoutH - top.Height - status.Height);
        for (int pass = 0; pass < 3; pass++)
        {
            var cs = mid.ClientSize;
            var want = new Size(Math.Max(LayoutW, cs.Width), Math.Max(minH, cs.Height));
            if (inner.Size == want) break;
            inner.Size = want;
            mid.PerformLayout();
        }
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        LayoutMid();
        PlacePractice();
        if (tour != null) { var t = tour; tour = null; t.Visible = false; Controls.Remove(t); t.Dispose(); StartTour(); }   // 창 크기가 바뀌면 안내를 새 모습으로
    }

    void Prac(string k) { if (practice != null) practice.Done(k); }
    public void PreviewTour(int steps) { StartTour(); for (int i = 0; i < steps; i++) tour.Next(); }
    public void PreviewTourEnd() { if (tour != null) { var t = tour; tour = null; Controls.Remove(t); t.Dispose(); } }
    public void PreviewPractice() { StartPractice(); Prac("select"); Prac("drop"); }
    public void PreviewPracticeEnd() { if (practice != null) { var p = practice; practice = null; Controls.Remove(p); p.Dispose(); board.ReserveLeft = 0; } }
    public Control PreviewTourLayer { get { return tour; } }
    public Control PreviewPracticeLayer { get { return practice; } }

    protected override void OnLoad(EventArgs e)
    {
        base.OnLoad(e);
        if (Helper.IsPreview) return;
        // 지난번 창 크기·자리(화면 밖이면 쓰지 않는다)
        Rectangle saved; bool max;
        bool has = ReadWin(out saved, out max);
        var wa = has ? Screen.FromRectangle(saved).WorkingArea : Screen.FromPoint(Cursor.Position).WorkingArea;
        // 1366×768 처럼 작은 화면이면 최소 크기도 작업 영역 안으로, 창도 작업 영역에 맞춰 줄인다(가운데는 스크롤 판이라 짜임은 그대로)
        MinimumSize = new Size(Math.Min(MinimumSize.Width, wa.Width), Math.Min(MinimumSize.Height, wa.Height));
        if (has)
        {
            StartPosition = FormStartPosition.Manual;
            Bounds = new Rectangle(saved.X, saved.Y, Math.Min(saved.Width, wa.Width), Math.Min(saved.Height, wa.Height));
        }
        if (Width > wa.Width || Height > wa.Height)
        {
            Size = new Size(Math.Min(Width, wa.Width), Math.Min(Height, wa.Height));
            Location = new Point(wa.X + (wa.Width - Width) / 2, wa.Y + (wa.Height - Height) / 2);
        }
        if (max || Width > wa.Width || Height > wa.Height) WindowState = FormWindowState.Maximized;   // 그래도 넘치면 최대화
    }

    // DeckPrefs "win" = x,y,너비,높이,최대화(1/0). 제목 줄이 어느 화면 작업 영역에도 없으면 버린다
    static bool ReadWin(out Rectangle r, out bool max)
    {
        r = Rectangle.Empty; max = false;
        string[] p = DeckPrefs.Get("win", "").Split(',');
        if (p.Length < 5) return false;
        int x, y, w, h;
        if (!int.TryParse(p[0], out x) || !int.TryParse(p[1], out y) || !int.TryParse(p[2], out w) || !int.TryParse(p[3], out h)) return false;
        if (w < 200 || h < 150) return false;
        var title = new Point(x + Math.Min(60, w / 2), y + 12);
        foreach (var s in Screen.AllScreens)
            if (s.WorkingArea.Contains(title)) { r = new Rectangle(x, y, w, h); max = p[4].Trim() == "1"; return true; }
        return false;
    }

    void SaveWin()
    {
        if (Helper.IsPreview) return;
        var r = WindowState == FormWindowState.Normal ? Bounds : RestoreBounds;
        if (r.Width < 200 || r.Height < 150) return;
        DeckPrefs.Set("win", r.X + "," + r.Y + "," + r.Width + "," + r.Height + "," + (WindowState == FormWindowState.Maximized ? "1" : "0"));
    }

    DateTime lastMsg = DateTime.MinValue;
    void OnProgress(string s)
    {
        host.Ui.Post(delegate { if (!IsDisposed) { Status(s); lastMsg = DateTime.Now; } }, null);
    }

    public void Status(string s) { status.Message = s; }
    // 알림 문장: 0.7초마다 도는 보드 상태 글이 곧바로 덮어쓰지 않게 잠시 붙잡아 둔다(UI 검수 5)
    public void Notify(string s) { Status(s); lastMsg = DateTime.Now; }
    // 잘 안 됐을 때의 안내: 조금 더 오래(6초) 붙잡아 둔다
    void Warn(string s) { Status(s); lastMsg = DateTime.Now.AddSeconds(6); }

    // 질문 창(어두운 모양, DeckDialogs.cs): 고른 단추 번호(0부터), 창을 그냥 닫으면 cancel.
    int Ask(string title, string msg, string[] btns, int def, int cancel)
    {
        return Dlg.Ask(this, title, msg, btns, def, cancel);
    }

    protected override void OnFormClosing(FormClosingEventArgs e)
    {
        bool ending = e.CloseReason == CloseReason.WindowsShutDown || e.CloseReason == CloseReason.TaskManagerClosing;
        if (dirty && ending)
        {   // 윈도 종료·로그아웃: 묻지 않고 고친 내용을 deck.draft.json 에 남겨 두었다가, 다음에 창을 열 때 되살릴지 묻는다
            try { Directory.CreateDirectory(Helper.DataDir); File.WriteAllText(DraftFile, work.ToJson(), new UTF8Encoding(false)); }
            catch { }
        }
        else if (dirty)
        {
            int r = Ask("단축키 꾸미기", "고친 내용이 있어요. 저장하지 않으면 사라져요.", new[] { "저장하고 닫기", "저장 안 하고 닫기", "계속 고치기" }, 0, 2);
            if (r == 2 || (r == 0 && !Save())) { e.Cancel = true; return; }
        }
        host.PushProgress -= OnProgress;
        poll.Stop(); iconLater.Stop(); typeSnap.Stop();
        DeckPrefs.Set("theme", libTheme.ToString());
        SaveWin();
        DeckPrefs.Save();
        base.OnFormClosing(e);
    }

    // 지난번 윈도 종료 때 남긴 deck.draft.json: 되살릴지 묻고, 어느 쪽이든 파일은 지운다
    void CheckDraft()
    {
        if (IsDisposed) return;
        // 먼저 읽어서 풀어 보고(실패하면 파일을 남겨 둔다), 되살리든 버리든 그다음에 지운다
        string json = null;
        try { json = File.ReadAllText(DraftFile, Encoding.UTF8); } catch { }
        DeckConfig cfg = null;
        if (json != null)
        {
            try { cfg = DeckConfig.Parse(json); }
            catch (Exception ex) { Helper.Log("deck.draft.json 을 읽지 못함: " + ex.Message); }
        }
        if (cfg == null)
        {   // 읽지 못했다: 파일은 그대로 두고(다음에 다시 시도) 알리기만
            Warn("지난번 꾸미기 내용을 읽지 못했어요(파일은 deck.draft.json 에 남겨 두었어요).");
            return;
        }
        int r = Ask("단축키 꾸미기", "지난번에 저장하지 않은 꾸미기 내용이 있어요. 되살릴까요?", new[] { "되살리기", "버리기" }, 0, 1);
        try { File.Delete(DraftFile); } catch { }
        if (r != 0) return;
        Snap();   // Ctrl+Z 로 저장해 둔 상태로 돌아갈 수 있게
        var refetch = new List<int>();   // 사이트 아이콘인데 그림이 없는 칸: 뒤에서 다시 받아 온다
        for (int i = 0; i < 16; i++)
        {   // 그림(Tile)은 LoadDeck 과 같은 방식으로 채운다. 사이트 아이콘은 지금 칸에 같은 것이 있으면 그 그림을 쓴다
            var c = cfg.Cells[i];
            c.Tile = null;
            if (c.IconMode == "builtin") c.Tile = DeckIcons.Builtin(c.IconSrc.Length > 0 ? c.IconSrc : DeckConfig.Keys[i]);
            else if (c.IconMode == "favicon")
            {
                foreach (var o in work.Cells) if (o.IconMode == "favicon" && o.IconSrc == c.IconSrc && o.Tile != null) { c.Tile = new Bitmap(o.Tile); break; }
                if (c.Tile == null && c.IconSrc.Length > 0) refetch.Add(i);   // 임시로 글자 그림을 두고 받아 오면 바꾼다(글자 그림으로 굳지 않게)
            }
            if (c.Tile == null && c.IconMode != "builtin") c.Tile = DeckIcons.MakeTile(c, null);
        }
        work = cfg; work.IsDefault = false;
        SelectCell(sel);
        dirty = true; board.Invalidate(); UpdateDirty(); UpdateHint();
        Warn("지난번 꾸미기 내용을 되살렸어요. 확인하고 [저장하고 보드에 보내기]를 누르세요.");
        if (refetch.Count > 0) RefetchFavicons(cfg, refetch);
    }

    // 되살린 칸의 사이트 아이콘을 뒤에서 다시 받는다(받는 사이 칸이 바뀌었으면 그 칸은 그대로 둔다)
    void RefetchFavicons(DeckConfig cfg, List<int> idx)
    {
        var th = new System.Threading.Thread(delegate ()
        {
            foreach (int i0 in idx)
            {
                int i = i0;
                string url = cfg.Cells[i].IconSrc;
                Bitmap g = null;
                try { g = DeckIcons.IconFavicon(url); } catch { g = null; }
                if (g == null) continue;
                try
                {
                    BeginInvoke((Action)delegate
                    {
                        using (g)
                        {
                            if (IsDisposed || work != cfg) return;
                            var c = work.Cells[i];
                            if (c.IconMode != "favicon" || c.IconSrc != url) return;
                            if (c.Tile != null) c.Tile.Dispose();
                            c.Tile = DeckIcons.Tile(g);
                            if (i == sel) ShowIconBox();
                            board.InvalidateCell(i);
                        }
                    });
                }
                catch { g.Dispose(); }   // 그 사이 창을 닫았다
            }
        });
        th.IsBackground = true;
        th.Start();
    }

    // ── 되돌리기·다시 하기 ──
    DeckCell[] CloneCells()
    {
        var a = new DeckCell[16];
        for (int i = 0; i < 16; i++) a[i] = work.Cells[i].Clone();
        return a;
    }

    static void DisposeCells(DeckCell[] a)
    {
        foreach (var c in a) if (c != null && c.Tile != null) { c.Tile.Dispose(); c.Tile = null; }
    }

    static void PushLimited(List<DeckCell[]> list, DeckCell[] a)
    {
        list.Add(a);
        while (list.Count > UndoMax) { DisposeCells(list[0]); list.RemoveAt(0); }
    }

    // 값을 바꾸기 직전에 부른다: 지금 16칸을 되돌리기 목록에 쌓고, 다시 하기 목록은 비운다
    void Snap()
    {
        if (work == null) return;
        typeSnap.Stop();
        PushLimited(undo, CloneCells());
        foreach (var a in redo) DisposeCells(a);
        redo.Clear();
    }

    // 글자를 칠 때: 첫 글자 전에 한 번만 쌓고, 0.7초 동안 더 치는 글자는 같은 묶음
    void TypeSnap()
    {
        bool first = !typeSnap.Enabled;
        if (first) Snap();
        typeSnap.Stop(); typeSnap.Start();
    }

    void RestoreCells(DeckCell[] a)
    {
        iconLater.Stop(); typeSnap.Stop();
        for (int i = 0; i < 16; i++) work.Cells[i] = a[i];
        work.IsDefault = false;
        ShowCell();
        board.Invalidate();
        dirty = true; UpdateDirty(); UpdateHint();
    }

    public void Undo()
    {
        if (undo.Count == 0) { Notify("되돌릴 것이 없어요."); return; }
        var a = undo[undo.Count - 1];
        undo.RemoveAt(undo.Count - 1);
        PushLimited(redo, CloneCells());
        RestoreCells(a);
        Notify("되돌렸어요. 다시 하려면 Ctrl+Y");
    }

    public void Redo()
    {
        if (redo.Count == 0) { Notify("다시 할 것이 없어요."); return; }
        var a = redo[redo.Count - 1];
        redo.RemoveAt(redo.Count - 1);
        PushLimited(undo, CloneCells());
        RestoreCells(a);
        Notify("다시 했어요. 되돌리려면 Ctrl+Z");
    }

    protected override bool ProcessCmdKey(ref Message msg, Keys keyData)
    {
        if (keyData == (Keys.Control | Keys.Z))
        {   // 입력칸에서 글자를 치던 중이면 그 칸의 글자 되돌리기가 먼저(16칸 전체를 되돌리는 것은 그다음 Ctrl+Z)
            var tb = FocusedBox();
            if (tb != null && tb.CanUndo) { tb.Undo(); tb.ClearUndo(); return true; }
            Undo(); return true;
        }
        if (keyData == (Keys.Control | Keys.Y) || keyData == (Keys.Control | Keys.Shift | Keys.Z)) { Redo(); return true; }
        if (keyData == (Keys.Control | Keys.S)) { Save(); return true; }
        if (keyData == (Keys.Control | Keys.F)) { actions.FocusFind(); return true; }
        if (keyData == Keys.F1) { DeckManual.Open(this, null); return true; }
        return base.ProcessCmdKey(ref msg, keyData);
    }

    // 지금 키보드 초점이 있는 글 입력칸(없으면 null)
    TextBoxBase FocusedBox()
    {
        Control c = ActiveControl;
        while (c != null)
        {
            var tb = c as TextBoxBase;
            if (tb != null) return tb.ReadOnly ? null : tb;
            var cc = c as ContainerControl;
            c = cc != null ? cc.ActiveControl : null;
        }
        return null;
    }

    public DeckConfig Work { get { return work; } }
    public int Selected { get { return sel; } }
    public int Shape { get { return shape; } }
    public int LibTheme { get { return libTheme; } }
    DeckCell Cur { get { return work.Cells[sel]; } }
    void Changed() { dirty = true; board.Invalidate(); UpdateDirty(); UpdateHint(); }
    public void MarkDirty() { dirty = true; board.Invalidate(); UpdateDirty(); UpdateHint(); }

    // 저장 안 함 표시 세 곳: 창 제목 ●, 위 띠 '저장 안 함', 저장 단추의 점
    void UpdateDirty()
    {
        string t = (dirty ? "● " : "") + TitleText;
        if (Text != t) Text = t;
        top.Dirty = dirty;
        status.BtnSave.Dot = dirty;
    }

    // 처음 도움말 띠
    void UpdateHint()
    {
        bool allEmpty = true;
        for (int i = 0; i < 16; i++) if (work.Cells[i].Kind != "none") { allEmpty = false; break; }
        bool show = !hintClosed && (allEmpty || DeckPrefs.Get("hint", "0") != "1");
        string text = allEmpty ? HintEmpty : HintNormal;
        if (show == hintShown && (!show || text == hintText)) return;
        hintShown = show; hintText = text;
        board.SetHint(show, text);
    }
    public void HideHint()
    {
        hintClosed = true;
        DeckPrefs.Set("hint", "1");
        hintShown = false;
        board.SetHint(false, "");
    }

    public void SetShape(int s)
    {
        s = s == 4 ? 4 : 7;
        if (s == shape) return;
        shape = s;
        board.DoLayout();
        DeckPrefs.Set("shape", s.ToString());
    }

    public void SelectCell(int i)
    {
        if (iconLater.Enabled) { iconLater.Stop(); if (Cur.IconMode == "auto") Retile(); }   // 고치던 칸의 아이콘을 마저 만든다
        if (i != sel) typeSnap.Stop();   // 다른 칸에서 치는 글자는 새 되돌리기 묶음
        sel = i;
        ShowCell();
        board.Invalidate();
        Prac("select");
    }

    static string ModeName(string m)
    {
        switch (m)
        {
            case "auto": return "자동";
            case "letter": return "글자";
            case "favicon": return "사이트 아이콘";
            case "file": return "그림 파일";
            case "fileraw": return "그림 그대로";
            case "builtin": return "기본 그림";
            case "library": return "모음에서";
            default: return "";
        }
    }

    void ShowIconBox()
    {
        var c = Cur;
        insp.SetIcon(c.Kind == "none" ? null : c.Tile, c.Kind == "none" ? "" : "지금: " + ModeName(c.IconMode), c.Kind != "none");
    }

    // 고른 칸을 속성 창에 보여 준다
    void ShowCell()
    {
        loading = true;
        var c = Cur;
        int n = sel + 1;
        insp.SetHead(n + "번 칸", "7인치 " + (sel < 8 ? "윗줄 " : "아랫줄 ") + (sel % 8 + 1) + "번째  ·  4인치 " + (sel / 4 + 1) + "줄 " + (sel % 4 + 1) + "번째");
        insp.NameBox.Box.Text = c.Name;
        insp.Kind.SelectedIndex = Array.IndexOf(KindCodes, c.Kind);
        insp.TargetBox.Box.Text = c.Kind == "text" || c.Kind == "builtin" ? "" : c.Target;
        insp.TextBox.Box.Text = c.Kind == "text" ? c.Target : "";
        int bi = c.Kind == "builtin" ? Math.Max(0, Array.IndexOf(BuiltinCodes, c.Target)) : -1;
        insp.BuiltinBtn.Text = bi >= 0 ? BuiltinNames[bi] : "";
        LayoutKind();
        ShowIconBox();
        CheckName();
        loading = false;
    }

    // 하는 일에 따라 대상 줄 모양을 바꾼다
    void LayoutKind()
    {
        string k = Cur.Kind;
        insp.SetTargetKind(k);
        UpdateHelp();
        bool on = k != "none";
        insp.NameBox.Enabled = insp.ClearBtn.Enabled = insp.TryBtn.Enabled = on;   // 빈 칸은 눌러 볼 것도 없다(UI 검수 12)
        insp.IconBtn.Enabled = on && favCell < 0;   // 사이트 아이콘을 받는 동안은 잠가 둔다
    }

    // 대상 줄 아래 도움말: 자세한 설정 요약·단축키 읽는 글·여러 동작 차례
    void UpdateHelp()
    {
        try { UpdateHelpCore(); }
        catch (Exception ex) { Helper.Log("도움말 오류: " + ex.Message); insp.SetHelp(""); }   // 글을 치는 도중의 이상한 값으로 창이 멈추지 않게
    }

    void UpdateHelpCore()
    {
        var c = Cur;
        string k = c.Kind;
        string sum = OptionsForm.Summary(k, c.Opt);
        insp.OptBtn.Dot = sum.Length > 0;
        if (k == "url") insp.SetHelp(sum.Length > 0 ? "자세한 설정: " + sum : "사이트 주소를 넣어요. 예) https://www.naver.com");
        else if (k == "keys") insp.SetHelp(c.Target.Length > 0 ? "누를 키: " + KeyText.Describe(c.Target) + "    (# = Win, ^ = Ctrl, + = Shift, % = Alt)" : "[눌러서 넣기]를 누르고 키보드에서 단축키를 그대로 눌러요.");
        else if (k == "app") insp.SetHelp(sum.Length > 0 ? "자세한 설정: " + sum : "[찾아보기]로 고르거나, 프로그램·바로 가기·파일을 위 칸에 끌어다 놓아요.");
        else if (k == "multi")
        {
            var parts = new List<string>();
            for (int i = 0; i < c.Steps.Count && i < 4; i++) parts.Add((i + 1) + ") " + StepsForm.Line(c.Steps[i]));
            insp.SetHelp(c.Steps.Count == 0 ? "[동작 차례 고치기]에서 할 일을 차례대로 넣어요(예: 한글 열기 → 1초 → 나이스 열기)."
                : c.Steps.Count + "가지: " + string.Join("  →  ", parts.ToArray()) + (c.Steps.Count > 4 ? "  …" : ""));
        }
        else if (k == "none") insp.SetHelp("빈 칸이에요. 위에서 하는 일을 고르거나, 오른쪽 목록에서 끌어다 놓으세요.");
        else insp.SetHelp("");
    }

    void RecordKeys()
    {
        if (Cur.Kind != "keys") return;
        using (var r = new KeyRecordForm(Cur.Target))
            if (r.ShowDialog(this) == DialogResult.OK && r.Result.Length > 0) { insp.TargetBox.Box.Text = r.Result; UpdateHelp(); }
    }

    void EditOptions()
    {
        var c = Cur;
        if (c.Kind != "app" && c.Kind != "url" && c.Kind != "text") return;
        var o = new Dictionary<string, string>(c.Opt);
        if (!OptionsForm.Edit(this, c.Kind, o)) return;
        Snap();
        c.Opt = o;
        UpdateHelp(); Changed();
    }

    void EditSteps() { EditSteps(true); }
    // snap=false: '하는 일'을 여러 동작으로 바꾸며 곧바로 열렸을 때(SetKind 가 이미 쌓아서, 되돌리기 한 번에 처음으로 돌아가게)
    void EditSteps(bool snap)
    {
        var c = Cur;
        if (c.Kind != "multi") return;
        using (var d = new StepsForm(c.Steps, c.Name))
        {
            if (d.ShowDialog(this) != DialogResult.OK)
            {   // 동작을 하나도 넣지 않고 닫았으면 '여러 동작'으로 남기지 않고 빈 칸으로 되돌린다
                if (c.Steps.Count == 0) { c.Kind = "none"; c.Target = ""; c.Opt.Clear(); ShowCell(); Changed(); }
                return;
            }
            if (snap) Snap();
            c.Steps = d.Steps;
            UpdateHelp(); Changed();
        }
    }

    // 하는 일 바꾸기. 지워지는 설정이 있으면 먼저 묻는다(그만두면 false)
    bool SetKind(string k)
    {
        var c = Cur;
        if (c.Kind == k) return true;
        string ask = null;
        if (c.Kind == "multi" && c.Steps.Count >= 2)
        {
            bool same = c.Steps.Exists(s => s.Kind == k);
            ask = same ? "여러 동작 " + c.Steps.Count + "가지 중 같은 종류 1가지만 남고 나머지는 지워져요. 바꿀까요?"
                       : "여러 동작 " + c.Steps.Count + "가지가 모두 지워져요. 바꿀까요?";
        }
        else if (c.Kind != "none" && c.Kind != "multi" && k != "multi" && c.Opt.Count > 0)   // '여러 동작'으로 바꿀 때는 설정이 첫 동작으로 옮겨 가서 지워지지 않는다
            ask = "'함께 넘길 값·시작 폴더' 같은 자세한 설정이 지워져요. 바꿀까요?";
        if (ask != null && Ask("하는 일 바꾸기", ask + "\n(바꾼 뒤에도 Ctrl+Z 로 되돌릴 수 있어요)", new[] { "바꾸기", "그대로 두기" }, 1, 1) != 0)
        {
            ShowCell();   // 하는 일 표시를 원래 값으로
            return false;
        }
        Snap();
        bool wasNone = c.Kind == "none";
        if (k == "multi")
        {   // 여러 동작으로: 지금 하던 일을 첫 동작으로 옮기고 차례 창을 연다
            c.Steps = new List<DeckStep>();
            if (!wasNone && c.Target.Trim().Length > 0)
                c.Steps.Add(new DeckStep { Kind = c.Kind, Target = c.Target, Wait = 1000, Opt = new Dictionary<string, string>(c.Opt) });
            c.Kind = "multi"; c.Target = ""; c.Opt.Clear();
            if (wasNone || c.IconMode == "auto" || c.IconMode == "favicon") { c.IconMode = "letter"; c.IconSrc = ""; }
            Retile(); ShowCell(); Changed();
            BeginInvoke((Action)delegate { EditSteps(false); });
            return true;
        }
        if (c.Kind == "multi")
        {   // 여러 동작에서 하나로: 같은 종류의 첫 동작이 있으면 그것을 살린다
            var first = c.Steps.Find(s => s.Kind == k);
            c.Kind = k; c.Steps.Clear();
            c.Target = first != null ? first.Target : (k == "builtin" ? BuiltinCodes[0] : "");
            c.Opt = first != null ? new Dictionary<string, string>(first.Opt) : new Dictionary<string, string>();
            Retile(); ShowCell(); Changed();
            return true;
        }
        c.Opt.Clear();   // 자세한 설정은 하는 일마다 다르다
        c.Kind = k;
        if (k == "builtin") c.Target = BuiltinCodes[0];
        else if (k == "text" || wasNone || c.Target.StartsWith("#")) c.Target = "";
        if (c.IconMode == "auto" && k != "app") c.IconMode = "letter";
        if (c.IconMode == "favicon" && k != "url") c.IconMode = "letter";
        if (wasNone) { c.IconMode = k == "app" ? "auto" : "letter"; c.IconSrc = ""; }
        Retile();
        ShowCell();
        Changed();
        return true;
    }

    void SetIcon(string mode)
    {
        var c = Cur;
        Snap();
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
        ShowIconBox();
        board.Invalidate();
    }

    // 사이트 아이콘 받기: 인터넷에서 받는 동안 창이 멈추지 않게 따로 스레드에서
    void GetFavicon()
    {
        var c = Cur;
        if (favCell >= 0) { Notify("사이트 아이콘을 받는 중이에요…"); return; }
        if (TargetEmpty(c)) { Notify("먼저 사이트 주소를 넣어 주세요."); ShowCell(); return; }
        int cell = sel;
        string url = c.Target;
        string mode = c.IconMode, src = c.IconSrc;   // 받는 사이에 칸·아이콘을 바꿨는지 알아보려고
        favCell = cell;
        FavBusy(true);
        Status("사이트 아이콘을 받는 중이에요…"); lastMsg = DateTime.Now.AddSeconds(20);
        var th = new System.Threading.Thread(delegate ()
        {
            Bitmap g = null;
            try { g = DeckIcons.IconFavicon(url); } catch { g = null; }
            try { BeginInvoke((Action)delegate { FavDone(c, cell, url, mode, src, g); }); }
            catch { if (g != null) g.Dispose(); }   // 그 사이 창을 닫았다
        });
        th.IsBackground = true;
        th.Start();
    }

    void FavBusy(bool busy)
    {
        insp.IconBtn.Text = busy ? "받는 중…" : "아이콘 바꾸기";
        insp.IconBtn.Enabled = !busy && Cur.Kind != "none";
    }

    void FavDone(DeckCell c, int cell, string url, string mode, string src, Bitmap g)
    {
        favCell = -1;
        if (IsDisposed) { if (g != null) g.Dispose(); return; }
        FavBusy(false);
        if (sel != cell || work.Cells[cell] != c || c.Kind != "url" || c.Target != url || c.IconMode != mode || c.IconSrc != src)
        {   // 그 사이 다른 칸을 골랐거나 주소·아이콘을 바꿨으면 받은 것은 버린다
            if (g != null) g.Dispose();
            Notify("받는 동안 칸이 바뀌어서 사이트 아이콘은 넣지 않았어요.");
            return;
        }
        if (g == null)
        {
            Warn("사이트 아이콘을 받지 못했어요(인터넷 연결을 확인해 주세요). 아이콘은 그대로 둘게요.");
            return;
        }
        Snap();
        using (g) c.Tile = DeckIcons.Tile(g);
        c.IconMode = "favicon"; c.IconSrc = url;
        ShowCell(); Changed();
        Notify((cell + 1) + "번 칸에 사이트 아이콘을 넣었어요.");
    }

    void PickImage()
    {
        using (var d = new OpenFileDialog { Title = "아이콘으로 쓸 그림 고르기", Filter = "그림 파일|*.png;*.jpg;*.jpeg;*.bmp;*.ico;*.gif|모든 파일|*.*" })
        {
            if (d.ShowDialog(this) != DialogResult.OK) { ShowCell(); return; }
            // 테두리까지 다 그린 그림이면 '그대로', 기호만 있으면 다른 칸과 같은 틀에 넣는다(아이콘_직접만들기.md)
            int r = Ask("단축키 꾸미기", "이 그림을 어떻게 넣을까요?\n\n틀에 넣기 — 기호만 있는 그림(다른 칸과 같은 테두리를 씌워요)\n그림 그대로 — 테두리까지 다 그린 완성 그림",
                new[] { "틀에 넣기", "그림 그대로", "그만두기" }, 0, 2);
            if (r == 2) { ShowCell(); return; }
            bool raw = r == 1;
            Bitmap tile;
            try { using (var g = DeckIcons.IconFromFile(d.FileName)) tile = raw ? DeckIcons.Fit72(g) : DeckIcons.Tile(g); }
            catch { Warn("이 그림은 열 수 없어요. 다른 그림 파일을 골라 주세요."); ShowCell(); return; }
            Snap();
            Cur.Tile = tile;
            Cur.IconMode = raw ? "fileraw" : "file"; Cur.IconSrc = d.FileName;
            ShowCell(); Changed();
        }
    }

    void PickLibrary()
    {
        if (DeckLibrary.Items().Count == 0) { Warn("아이콘 모음을 찾지 못했어요. 탭덱을 새로 받아 주세요."); ShowCell(); return; }
        using (var d = new LibraryPicker(libTheme))
        {
            if (d.ShowDialog(this) != DialogResult.OK || d.Picked == null) { ShowCell(); return; }
            if (libTheme != d.ThemeIndex) { libTheme = d.ThemeIndex; ThemeShown(); }
            Snap();
            ApplyLib(Cur, d.Picked, d.PickedSrc, d.UseAction);
            Retile(); ShowCell(); Changed();
        }
    }

    // 모음 항목을 칸에 넣기. 빈 칸이거나 withAction 이면 이름·하는 일도 모음의 추천대로(대상이 비어 있는 추천은 하는 일만)
    static void ApplyLib(DeckCell c, LibItem it, string src, bool withAction)
    {
        if ((c.Kind == "none" || withAction) && it.Kind != "")
        {
            c.Name = it.Name;
            c.Kind = it.Kind;
            if (it.Kind == "builtin") c.Target = "#" + it.Target;
            else if (it.Target != "") c.Target = it.Target;
            if (c.Kind == "builtin" && Array.IndexOf(BuiltinCodes, c.Target) < 0) c.Target = BuiltinCodes[0];
        }
        else if (c.Kind == "none") { c.Name = it.Name; c.Kind = "url"; c.Target = ""; }
        c.IconMode = "library"; c.IconSrc = src;
    }

    public static string LibSrc(int theme, string key) { return (DeckLibrary.Themes[Math.Max(0, theme)] + "/" + key).TrimStart('/'); }

    // ── 동작 목록 → 칸(설계 11장) ──
    public void ApplyAction(int cell, string action, bool iconOnly)
    {
        if (cell < 0 || cell > 15 || string.IsNullOrEmpty(action) || work == null) return;
        Prac("drop");
        SelectCell(cell);
        var c = Cur;
        int n = cell + 1;
        if (action.StartsWith("kind:"))
        {
            // 하는 일 줄에는 그림이 없으니 Shift(아이콘만)로 놓아도 보통처럼 넣는다(UI 검수 9)
            string k = action.Substring(5);
            int ki = Array.IndexOf(KindCodes, k);
            if (ki < 0) return;
            if (!SetKind(k)) return;   // 묻는 창에서 [그대로 두기]
            Status(n + "번 칸에 '" + KindNames[ki] + "'을 넣었어요."); lastMsg = DateTime.Now;
            if (k == "app") insp.BrowseBtn.Focus();
            else if (k == "url")
            {
                var b = insp.TargetBox.Box;
                b.Focus();
                if (b.Text.Length == 0) b.Text = "https://";
                b.SelectionStart = b.Text.Length;
            }
            else if (k == "keys") insp.TargetBox.Box.Focus();
            else if (k == "text") insp.TextBox.Box.Focus();
            return;
        }
        if (action.StartsWith("builtin:"))
        {
            string code = action.Substring(8);
            int bi = Array.IndexOf(BuiltinCodes, code);
            if (bi < 0) return;
            string key = BuiltinIconKeys[bi];
            if (iconOnly)
            {   // 아이콘만: 이름·하는 일·대상은 그대로(UI 검수 2)
                if (c.Kind == "none") { Notify(n + "번 칸이 비어 있어요. 아이콘만 넣으려면 먼저 하는 일을 정해 주세요."); return; }
                if (!File.Exists(DeckLibrary.PathOf(LibSrc(libTheme, key)) ?? "")) { Notify("이 기능의 그림을 찾지 못했어요."); return; }
                Snap();
                c.IconMode = "library"; c.IconSrc = LibSrc(libTheme, key);
                c.Tile = DeckIcons.MakeTile(c, null);
                ShowCell(); Changed();
                Notify(n + "번 칸 아이콘을 바꿨어요.");
                return;
            }
            Snap();
            c.Kind = "builtin"; c.Target = code; c.Name = CleanName(BuiltinNames[bi]);
            if (File.Exists(DeckLibrary.PathOf(LibSrc(libTheme, key)) ?? "")) { c.IconMode = "library"; c.IconSrc = LibSrc(libTheme, key); }
            else { c.IconMode = "letter"; c.IconSrc = ""; }
            c.Tile = DeckIcons.MakeTile(c, null);
            ShowCell(); Changed();
            Status(n + "번 칸에 '" + c.Name + "'을 넣었어요."); lastMsg = DateTime.Now;
            return;
        }
        if (action.StartsWith("lib:"))
        {
            string key = action.Substring(4);
            LibItem it = null;
            foreach (var x in DeckLibrary.Items()) if (x.Key == key) { it = x; break; }
            if (it == null) return;
            Snap();
            ApplyLib(c, it, LibSrc(libTheme, key), !iconOnly);
            c.Tile = DeckIcons.MakeTile(c, null);
            ShowCell(); Changed();
            if (iconOnly) Status(n + "번 칸 아이콘을 바꿨어요.");
            else Status(n + "번 칸에 '" + c.Name + "'을 넣었어요.");
            lastMsg = DateTime.Now;
            if ((c.Kind == "app" || c.Kind == "url" || c.Kind == "keys") && c.Target.Trim().Length == 0)
            {
                Status(n + "번 칸: 주소를 넣어 주세요."); lastMsg = DateTime.Now.AddSeconds(2);
                insp.TargetBox.Box.Focus();
            }
        }
    }

    public void CopyCell(int from, int to)
    {
        if (from == to || from < 0 || to < 0) return;
        Snap();
        work.Cells[to] = work.Cells[from].Clone();
        SelectCell(to); Changed();
        Status((from + 1) + "번 칸을 " + (to + 1) + "번 칸에 복사했어요."); lastMsg = DateTime.Now;
    }

    public void ClearCell(int i)
    {
        if (i < 0 || i > 15) return;
        if (work.Cells[i].Kind == "none") { Notify((i + 1) + "번 칸은 이미 비어 있어요."); return; }
        Snap();
        work.Cells[i] = DeckConfig.Empty();
        if (i == sel) ShowCell();
        Changed();
        Status((i + 1) + "번 칸을 비웠어요. 되돌리려면 Ctrl+Z"); lastMsg = DateTime.Now.AddSeconds(3);
    }

    public void TrySelected() { board.FlashPress(sel); TryCell(sel); }
    public void FocusName() { if (insp.NameBox.Enabled) { insp.NameBox.Box.Focus(); insp.NameBox.Box.SelectAll(); } }
    public void ClipCopy() { clip = Cur.Clone(); Status("복사했어요."); lastMsg = DateTime.Now; }
    public void ClipPaste() { if (clip == null) return; PasteCell(sel); Status("붙여넣었어요."); lastMsg = DateTime.Now; }

    // ── 메뉴(오른쪽 클릭·한 번에 채우기·아이콘 모양·더보기·내장 기능) ──
    static ToolStripMenuItem Item(string t, EventHandler h)
    {
        var m = new ToolStripMenuItem(t);
        if (h != null) m.Click += h;
        return m;
    }

    // '아이콘 바꾸기' 메뉴(아이콘 바꾸기 단추·아이콘 상자·칸 오른쪽 클릭이 같이 씀)
    public ContextMenuStrip BuildIconMenu()
    {
        var m = new ContextMenuStrip();
        Theme.DarkMenu(m);
        m.Opening += delegate (object s, CancelEventArgs e)
        {
            m.Items.Clear();
            AddIconItems(m.Items);
            foreach (ToolStripItem it in m.Items) Theme.DarkSub(it);
            e.Cancel = false;
        };
        return m;
    }

    void AddIconItems(ToolStripItemCollection col)
    {
        var c = Cur;
        string k = c.Kind, md = c.IconMode;
        bool on = k != "none";
        var a = Item("자동(프로그램에서)", delegate { SetIcon("auto"); }); a.Enabled = on && k == "app"; a.Checked = md == "auto";
        var l = Item("글자", delegate { SetIcon("letter"); }); l.Enabled = on; l.Checked = md == "letter";
        bool favBusy = favCell >= 0;
        var fv = Item(favBusy ? "받는 중…" : "사이트 아이콘 받기", delegate { GetFavicon(); }); fv.Enabled = on && k == "url" && !favBusy; fv.Checked = md == "favicon";
        var fi = Item("그림 파일…", delegate { PickImage(); }); fi.Enabled = on; fi.Checked = md == "file" || md == "fileraw";
        var bt = new ToolStripMenuItem("기본 그림"); bt.Enabled = on; bt.Checked = md == "builtin";
        for (int i = 0; i < 16; i++)
        {
            int n = i;
            var it = Item(DeckConfig.KeyNames[i], delegate
            {
                Snap(); Cur.IconMode = "builtin"; Cur.IconSrc = DeckConfig.Keys[n]; Retile(); ShowCell(); Changed();
            });
            it.Image = builtinSmall[i];
            it.ImageScaling = ToolStripItemImageScaling.None;
            it.Checked = md == "builtin" && c.IconSrc == DeckConfig.Keys[i];
            bt.DropDownItems.Add(it);
        }
        var lb = Item("모음에서 고르기…", delegate { PickLibrary(); }); lb.Enabled = on; lb.Checked = md == "library";
        col.AddRange(new ToolStripItem[] { a, l, fv, fi, bt, lb });
    }

    void BuildMenus()
    {
        var play = Item("눌러 보기(이 컴퓨터에서)", delegate { TrySelected(); });
        play.Image = Theme.PlayImage(16, Theme.Text1); play.ShortcutKeyDisplayString = "Enter";
        cellMenu.Items.Add(play);
        cellMenu.Items.Add(new ToolStripSeparator());
        var copy = Item("복사", delegate { ClipCopy(); }); copy.ShortcutKeyDisplayString = "Ctrl+C";
        var paste = Item("붙여넣기", delegate { ClipPaste(); }); paste.ShortcutKeyDisplayString = "Ctrl+V";
        var clear = Item("비우기", delegate { ClearCell(sel); }); clear.ShortcutKeyDisplayString = "Delete";
        var undoIt = Item("되돌리기", delegate { Undo(); }); undoIt.ShortcutKeyDisplayString = "Ctrl+Z";
        var redoIt = Item("다시 하기", delegate { Redo(); }); redoIt.ShortcutKeyDisplayString = "Ctrl+Y";
        cellMenu.Items.AddRange(new ToolStripItem[] { copy, paste, clear, new ToolStripSeparator(), undoIt, redoIt, new ToolStripSeparator() });
        cellIconSub = new ToolStripMenuItem("아이콘 바꾸기");
        cellIconSub.DropDownItems.Add("");   // 열 때 채운다
        cellMenu.Items.Add(cellIconSub);
        Theme.DarkMenu(cellMenu);
        cellMenu.Opening += delegate
        {
            paste.Enabled = clip != null;
            undoIt.Enabled = undo.Count > 0; redoIt.Enabled = redo.Count > 0;
            cellIconSub.DropDownItems.Clear();
            AddIconItems(cellIconSub.DropDownItems);
            cellIconSub.Enabled = Cur.Kind != "none";
            Theme.DarkMenu(cellIconSub.DropDown);
        };

        presetMenu.Items.Add("이 컴퓨터에 깔린 프로그램으로", null, delegate { FillPreset("installed"); });
        presetMenu.Items.Add(new ToolStripSeparator());
        presetMenu.Items.Add("수업용 (한글·PPT·발표 넘기기·타이머·소리)", null, delegate { FillPreset("class"); });
        presetMenu.Items.Add("업무용 (나이스·업무포털·메신저·문서·AI)", null, delegate { FillPreset("work"); });
        presetMenu.Items.Add("발표·원격수업용 (슬라이드·마이크·카메라·화면 공유)", null, delegate { FillPreset("present"); });
        Theme.DarkMenu(presetMenu);

        for (int i = 0; i < DeckLibrary.ThemeNames.Length; i++)
        {
            int n = i;
            themeMenu.Items.Add(Item(DeckLibrary.ThemeNames[i], delegate { ApplyTheme(n); }));
        }
        themeMenu.Opening += delegate { for (int i = 0; i < themeMenu.Items.Count; i++) ((ToolStripMenuItem)themeMenu.Items[i]).Checked = i == libTheme; };
        Theme.DarkMenu(themeMenu);

        var ex = Item("내보내기…", delegate { Export(); }); ex.ToolTipText = "지금 16칸을 파일 하나로 저장해요(다른 선생님께 주기)";
        var im = Item("가져오기…", delegate { Import(); }); im.ToolTipText = "내보낸 파일을 불러와요(저장을 눌러야 보드로 가요)";
        var undo2 = Item("되돌리기", delegate { Undo(); }); undo2.ShortcutKeyDisplayString = "Ctrl+Z";
        var redo2 = Item("다시 하기", delegate { Redo(); }); redo2.ShortcutKeyDisplayString = "Ctrl+Y";
        moreMenu.Items.AddRange(new ToolStripItem[] { undo2, redo2, new ToolStripSeparator(), ex, im, new ToolStripSeparator(), Item("기본값으로 되돌리기…", delegate { ToDefault(); }),
            new ToolStripSeparator(), Item("글꼴 안내", delegate { ShowFontInfo(); }) });
        moreMenu.Opening += delegate { undo2.Enabled = undo.Count > 0; redo2.Enabled = redo.Count > 0; };
        Theme.DarkMenu(moreMenu);

        for (int i = 0; i < BuiltinCodes.Length; i++)
        {
            int n = i;
            builtinMenu.Items.Add(Item(BuiltinNames[i], delegate
            {
                if (Cur.Kind != "builtin" || Cur.Target == BuiltinCodes[n]) return;
                Snap();
                Cur.Target = BuiltinCodes[n]; insp.BuiltinBtn.Text = BuiltinNames[n]; Changed();
            }));
        }
        builtinMenu.Opening += delegate { for (int i = 0; i < builtinMenu.Items.Count; i++) ((ToolStripMenuItem)builtinMenu.Items[i]).Checked = Cur.Target == BuiltinCodes[i]; };
        Theme.DarkMenu(builtinMenu);
    }

    public void ShowCellMenu(Control at, Point p) { cellMenu.Show(at, p); }

    // 더보기 → 글꼴 안내(사용 조건 4조: 저작권 표시를 함께 둔다)
    void ShowFontInfo()
    {
        string txt = "";
        try
        {
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("deck.fontlicense"))
                if (s != null) using (var r = new StreamReader(s, Encoding.UTF8)) txt = r.ReadToEnd();
        }
        catch { }
        txt = "글꼴: 에스코어 드림 (S-Core)\r\n\r\n" + (txt.Length > 0 ? txt.Replace("\r\n", "\n").Replace("\n", "\r\n") : "Copyright (c) S-Core Co., Ltd., 2018. All rights reserved.");
        using (var d = new Form())
        {
            d.Text = "글꼴 안내";
            d.ClientSize = new Size(600, 420);
            d.StartPosition = FormStartPosition.CenterParent;
            d.MinimizeBox = false; d.MaximizeBox = false; d.ShowInTaskbar = false;
            d.BackColor = Theme.Panel; d.Font = DeckFonts.Regular(9.5f);
            d.HandleCreated += delegate { Theme.DarkTitle(d.Handle); };
            var box = new RoundBox { Multiline = true };
            box.Box.ReadOnly = true; box.Box.Text = txt; box.Box.BackColor = Theme.Raised;
            box.SetBounds(16, 16, 568, 340);
            box.Anchor = AnchorStyles.Top | AnchorStyles.Bottom | AnchorStyles.Left | AnchorStyles.Right;
            var ok = new FlatButton { Text = "닫기", Style = BtnStyle.Normal, Size = new Size(96, 36) };
            ok.Location = new Point(600 - 16 - 96, 420 - 16 - 36);
            ok.Anchor = AnchorStyles.Bottom | AnchorStyles.Right;
            ok.Click += delegate { d.Close(); };
            d.Controls.Add(box); d.Controls.Add(ok);
            d.Shown += delegate { ok.Focus(); box.Box.SelectionLength = 0; };
            d.ShowDialog(this);
        }
    }

    // 대상이 비었는지: 'https://' 만 있는 주소도 빈 것으로 본다(UI 검수 3)
    static bool TargetEmpty(DeckCell c)
    {
        if (c.Kind == "multi") return c.Steps.Count == 0 || EmptyStep(c) >= 0;
        string t = (c.Target ?? "").Trim();
        if (t.Length == 0) return true;
        return c.Kind == "url" && Regex.IsMatch(t, "^https?://$", RegexOptions.IgnoreCase);
    }

    // '여러 동작' 중 대상이 빈 첫 단계(0부터). 없으면 -1
    static int EmptyStep(DeckCell c)
    {
        for (int k = 0; k < c.Steps.Count; k++) if ((c.Steps[k].Target ?? "").Trim().Length == 0) return k;
        return -1;
    }

    // 대상이 비었을 때 하는 일마다 알맞은 안내
    static string EmptyWhy(DeckCell c)
    {
        switch (c.Kind)
        {
            case "url": return "사이트 주소를 넣어 주세요.";
            case "keys": return "누를 단축키를 넣어 주세요.";
            case "text": return "넣을 글자를 써 주세요.";
            case "multi":
            {
                if (c.Steps.Count == 0) return "동작을 먼저 넣어 주세요([동작 차례 고치기]).";
                int k = EmptyStep(c);
                return (k + 1) + "번째 동작이 비어 있어요. [동작 차례 고치기]에서 채워 주세요.";
            }
            default: return "무엇을 열지(대상)를 넣어 주세요.";
        }
    }

    // 주소에 http(s):// 같은 앞머리가 없으면 https:// 를 붙인다(입력칸 Leave 와 같은 규칙)
    static void FixUrl(DeckCell c)
    {
        if (c.Kind != "url") return;
        c.Target = (c.Target ?? "").Trim();
        if (c.Target.Length > 0 && !UrlX.HasScheme(c.Target)) c.Target = "https://" + c.Target;
    }

    void TryCell(int i)
    {
        var c = work.Cells[i];
        if (c.Kind == "none") { Notify("이 칸은 아직 할 일이 없어요."); return; }
        if (TargetEmpty(c)) { Warn(EmptyWhy(c)); return; }
        // 단축키·글자 넣기는 이 창이 아니라 그 전에 쓰던 창에 가야 한다 → 창을 잠깐 내려 두고 한다
        bool toOther = c.Kind == "keys" || c.Kind == "text" || c.Target == "#altf4";
        if (c.Kind == "multi") foreach (var s in c.Steps) if (s.Kind == "keys" || s.Kind == "text" || s.Target == "#altf4") toOther = true;
        bool multi = c.Kind == "multi";
        string nm = c.Name;
        var fails = new List<string>();
        bool restored = false;
        Action restore = delegate
        {
            if (restored || IsDisposed) return;
            restored = true;
            if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        };
        // 다 끝났을 때(화면 스레드): 내려 둔 창을 올리고, 안 된 동작이 있으면 그때 한 번 알린다
        Action done = delegate
        {
            if (IsDisposed) return;
            if (toOther && multi) restore();
            if (fails.Count > 0) Warn("'" + nm + "' " + string.Join(" · ", fails.ToArray()) + ". [동작 차례 고치기]에서 확인해 주세요.");
        };
        try
        {
            if (toOther) { WindowState = FormWindowState.Minimized; Application.DoEvents(); System.Threading.Thread.Sleep(400); }
            RunForTry(c.Clone(), delegate (string why) { if (!IsDisposed) fails.Add(why); }, done);
            Prac("try");
            Notify("'" + c.Name + "' 해 봤어요." + (multi ? " (" + c.Steps.Count + "가지를 차례대로)" : ""));
        }
        catch (Exception ex)
        {
            Helper.Log("눌러 보기 실패: " + c.Name + " (" + ex.Message + ")");
            Warn("열지 못했어요: " + ErrText.Easy(ex) + ". 대상(무엇을 열지)을 확인해 주세요.");
        }
        finally
        {   // 한 동작: 내려 둔 창은 1.5초 뒤 다시 올린다(UI 검수 14). 여러 동작: 끝나면 done 에서 올리고, 이 타이머는 안전용(동작 수 × 10초 + 2초)
            if (toOther)
            {
                var back = new Timer { Interval = multi ? Math.Max(1, c.Steps.Count) * 10000 + 2000 : 1500 };
                back.Tick += delegate { back.Stop(); back.Dispose(); restore(); };
                back.Start();
            }
        }
    }

    // 눌러 보기 실행: 실패한 동작은 fail, 다 끝나면 done(둘 다 화면 스레드, DeckActions.cs). 한 동작이 안 되면 예외
    void RunForTry(DeckCell c, Action<string> fail, Action done)
    {
        DeckRun.Run(c, host.Ui, null, fail, delegate (List<string> l) { done(); });
    }

    void PasteCell(int i)
    {
        if (clip == null) return;
        Snap();
        work.Cells[i] = clip.Clone();
        SelectCell(i); Changed();
    }

    public void SwapCells(int a, int b)
    {
        if (a == b || a < 0 || b < 0) return;
        Snap();
        var t = work.Cells[a]; work.Cells[a] = work.Cells[b]; work.Cells[b] = t;
        SelectCell(b); Changed();
        Status((a + 1) + "번 칸과 " + (b + 1) + "번 칸을 바꿨어요."); lastMsg = DateTime.Now;
        Prac("swap");
    }

    // 그림 파일을 칸에 끌어다 놓았을 때: 아이콘만 바꾼다
    public void SetIconFromImage(int i, string path)
    {
        SelectCell(i);
        int r = Ask("단축키 꾸미기", "이 그림을 " + (i + 1) + "번 칸 아이콘으로 넣을까요?\n\n틀에 넣기 — 기호만 있는 그림\n그림 그대로 — 테두리까지 다 그린 완성 그림",
            new[] { "틀에 넣기", "그림 그대로", "그만두기" }, 0, 2);
        if (r == 2) return;
        var c = work.Cells[i];
        bool raw = r == 1;
        Bitmap tile;
        try { using (var g = DeckIcons.IconFromFile(path)) tile = raw ? DeckIcons.Fit72(g) : DeckIcons.Tile(g); }
        catch { Warn("이 그림은 열 수 없어요. 다른 그림 파일을 골라 주세요."); return; }
        Snap();
        c.Tile = tile;
        c.IconMode = raw ? "fileraw" : "file"; c.IconSrc = path;
        if (c.Kind == "none") { c.Kind = "app"; c.Name = CleanName(Path.GetFileNameWithoutExtension(path)); c.Target = ""; }
        ShowCell(); Changed();
        Status((i + 1) + "번 칸 아이콘을 바꿨어요."); lastMsg = DateTime.Now;
    }

    public static bool IsImage(string path)
    {
        string e = Path.GetExtension(path).ToLowerInvariant();
        return e == ".png" || e == ".jpg" || e == ".jpeg" || e == ".bmp" || e == ".gif" || e == ".ico";
    }

    // 위 띠 단추 글과 동작 목록 그림을 지금 테마로
    void ThemeShown()
    {
        top.ThemeBtn.Text = "아이콘 모양: " + DeckLibrary.ThemeNames[libTheme];
        actions.ClearIcons();
        DeckPrefs.Set("theme", libTheme.ToString());
    }

    // 모음에서 고른 아이콘을 모두 다른 테마 판으로
    void ApplyTheme(int t)
    {
        libTheme = t;
        ThemeShown();
        int n = 0;
        for (int i = 0; i < 16; i++)
        {
            var c = work.Cells[i];
            if (c.Kind == "none" || c.IconMode != "library") continue;
            if (n == 0) Snap();   // 처음 바꾸는 칸 앞에서 한 번
            string key = c.IconSrc.Substring(c.IconSrc.LastIndexOf('/') + 1);
            c.IconSrc = LibSrc(t, key);
            c.Tile = DeckIcons.MakeTile(c, null); n++;
        }
        if (n > 0) { ShowCell(); Changed(); }
        Status(n > 0 ? "모음 아이콘 " + n + "개를 '" + DeckLibrary.ThemeNames[t] + "' 모양으로 바꿨어요. 저장하면 보드로 가요."
                     : "앞으로 모음에서 고르는 아이콘은 '" + DeckLibrary.ThemeNames[t] + "' 모양이에요(지금 칸에는 모음 아이콘이 없어요).");
        lastMsg = DateTime.Now;
    }

    // ── 한 번에 채우기 ──
    static readonly string[] PresetClass = { "explorer2", "hwp2", "powerpoint", "chrome", "youtube2", "pptstart", "pptprev", "pptnext",
        "blackscreen", "fullscreen", "timer", "padlet", "gclassroom", "volup", "voldown", "desktop2" };
    static readonly string[] PresetWork = { "explorer2", "hwp2", "excel", "word", "neis2", "eduportal", "coolmsg2", "kakao2",
        "chrome", "chatgpt", "gemini2", "calc", "snip", "print", "closewin", "desktop2" };
    static readonly string[] PresetPresent = { "powerpoint", "pptstart", "pptprev", "pptnext", "blackscreen", "fullscreen", "zoomin", "zoomout",
        "sharescreen", "micoff", "camoff", "zoom", "teams", "gmeet", "timer", "desktop2" };
    // '깔린 프로그램으로': 앞에서부터 이 컴퓨터에 있는 것만 골라 16칸(모자라면 사이트·기능으로 채움)
    static readonly string[] PresetInstalledApps = { "explorer2", "hwp2", "word", "excel", "powerpoint", "hcell", "hshow", "outlook", "onenote",
        "chrome", "edge", "whale", "kakao2", "coolmsg2", "teams", "zoom", "photoshop", "illustrator", "premiere", "acrobat", "obs", "potplayer", "bandizip" };
    static readonly string[] PresetFill = { "neis2", "chatgpt", "gemini2", "youtube2", "naver2", "calc", "snip", "closewin", "desktop2" };

    static bool Installed(LibItem it)
    {
        if (it.Kind != "app") return true;
        string t = it.Target;
        if (t.StartsWith("shell:") || t.StartsWith("ms-") || t == "explorer.exe" || t == "calc" || t == "notepad" || t == "mspaint" || t == "cmd.exe") return true;
        return DeckIcons.ResolveApp(t) != null;
    }

    void FillPreset(string which)
    {
        var lib = new Dictionary<string, LibItem>();
        foreach (var it in DeckLibrary.Items()) lib[it.Key] = it;
        if (lib.Count == 0) { Warn("아이콘 모음을 찾지 못했어요. 탭덱을 새로 받아 주세요."); return; }
        var keys = new List<string>();
        if (which == "installed")
        {
            Cursor = Cursors.WaitCursor;
            try
            {
                foreach (var k in PresetInstalledApps) if (keys.Count < 16 && lib.ContainsKey(k) && Installed(lib[k])) keys.Add(k);
                foreach (var k in PresetFill) if (keys.Count < 16 && lib.ContainsKey(k) && !keys.Contains(k)) keys.Add(k);
            }
            finally { Cursor = Cursors.Default; }
        }
        else keys.AddRange(which == "class" ? PresetClass : which == "work" ? PresetWork : PresetPresent);
        var names = new List<string>();
        foreach (var k in keys) if (lib.ContainsKey(k)) names.Add(lib[k].Name);
        if (Ask("한 번에 채우기", "16칸을 아래처럼 바꿀까요? 지금 칸은 지워져요(바꾼 뒤 Ctrl+Z 로 되돌릴 수 있어요). 저장을 눌러야 보드로 가요.\n\n" + string.Join(" · ", names.ToArray()),
            new[] { "바꾸기", "그만두기" }, 0, 1) != 0) return;
        Snap();
        Cursor = Cursors.WaitCursor;
        try
        {
            for (int i = 0; i < 16; i++)
            {
                var c = DeckConfig.Empty();
                if (i < keys.Count && lib.ContainsKey(keys[i])) { ApplyLib(c, lib[keys[i]], LibSrc(libTheme, keys[i]), true); c.Tile = DeckIcons.MakeTile(c, null); }
                work.Cells[i] = c;
            }
        }
        finally { Cursor = Cursors.Default; }
        SelectCell(0); Changed();
        Status("16칸을 채웠어요. '학교 누리집'처럼 주소가 비어 있는 칸은 대상을 넣고 [저장하고 보드에 보내기]를 누르세요."); lastMsg = DateTime.Now.AddSeconds(4);
    }

    // ── 내보내기·가져오기(다른 선생님과 나누기): zip 안에 deck.json + 칸 그림 cell_N.png ──
    void Export()
    {
        using (var d = new SaveFileDialog { Title = "단축키 설정 내보내기", Filter = "알림판 단축키 설정|*.zip", FileName = "알림판_단축키_" + DateTime.Now.ToString("MMdd") + ".zip" })
        {
            if (d.ShowDialog(this) != DialogResult.OK) return;
            try
            {
                if (File.Exists(d.FileName)) File.Delete(d.FileName);
                using (var z = ZipFile.Open(d.FileName, ZipArchiveMode.Create))
                {
                    using (var w = new StreamWriter(z.CreateEntry("deck.json").Open(), new UTF8Encoding(false))) w.Write(work.ToJson());
                    for (int i = 0; i < 16; i++)
                        if (work.Cells[i].Kind != "none" && work.Cells[i].Tile != null)
                            using (var s = z.CreateEntry("cell_" + i + ".png").Open()) work.Cells[i].Tile.Save(s, System.Drawing.Imaging.ImageFormat.Png);
                }
                Status("내보냈어요: " + d.FileName); lastMsg = DateTime.Now.AddSeconds(4);
            }
            catch (Exception ex) { Helper.Log("내보내기 실패: " + ex.Message); Warn("내보내지 못했어요: " + ErrText.Easy(ex)); }
        }
    }

    void Import()
    {
        using (var d = new OpenFileDialog { Title = "단축키 설정 가져오기", Filter = "알림판 단축키 설정|*.zip" })
        {
            if (d.ShowDialog(this) != DialogResult.OK) return;
            try
            {
                DeckConfig cfg; var pics = new Dictionary<int, Bitmap>();
                using (var z = ZipFile.OpenRead(d.FileName))
                {
                    var e = z.GetEntry("deck.json");
                    if (e == null) { Warn("알림판 단축키 설정 파일이 아니에요(deck.json 이 없어요)."); return; }
                    using (var r = new StreamReader(e.Open(), Encoding.UTF8)) cfg = DeckConfig.Parse(r.ReadToEnd());
                    bool any = false;
                    for (int i = 0; i < 16; i++) if (cfg.Cells[i].Kind != "none") any = true;
                    if (!any) { Warn("칸 정보가 없는 파일이에요. 다른 파일을 골라 주세요."); return; }
                    // 지금 16칸을 바꾸기 전에 묻는다(그림 파일을 쓰기 전에 물어야 '가져옴' 폴더에 쓸데없는 파일이 안 남는다)
                    if (dirty && Ask("단축키 가져오기", "저장하지 않은 고친 내용이 있어요.\n가져오면 지금 16칸이 바뀌어요(가져온 뒤 Ctrl+Z 로 되돌릴 수 있어요). 가져올까요?",
                        new[] { "가져오기", "그만두기" }, 0, 1) != 0) return;
                    for (int i = 0; i < 16; i++)
                    {
                        var p = z.GetEntry("cell_" + i + ".png");
                        if (p != null)
                            try { using (var s = p.Open()) using (var ms = new MemoryStream()) { s.CopyTo(ms); ms.Position = 0; using (var im = Image.FromStream(ms)) pics[i] = new Bitmap(im); } }
                            catch (Exception pe) { Helper.Log("가져오기: cell_" + i + ".png 를 열지 못함(" + pe.Message + ")"); }   // 그림 하나가 깨져도 나머지는 가져온다
                    }
                }
                // 다른 컴퓨터의 그림 파일 경로는 여기 없으니, 함께 온 칸 그림을 도우미 폴더에 두고 '그대로'로 쓴다
                string dir = Path.Combine(Path.GetDirectoryName(DeckLibrary.Dir ?? Path.GetTempPath()), "가져옴");
                Directory.CreateDirectory(dir);
                string stamp = DateTime.Now.ToString("yyyyMMddHHmmss");
                for (int i = 0; i < 16; i++)
                {
                    var c = cfg.Cells[i];
                    if (c.Kind == "none") { c.Tile = null; continue; }
                    bool portable = c.IconMode == "builtin" || c.IconMode == "letter" || c.IconMode == "library";
                    if (!portable && pics.ContainsKey(i))
                    {
                        string f = Path.Combine(dir, stamp + "_" + i + ".png");
                        pics[i].Save(f, System.Drawing.Imaging.ImageFormat.Png);
                        c.IconMode = "fileraw"; c.IconSrc = f;
                    }
                    c.Tile = DeckIcons.MakeTile(c, null);
                }
                foreach (var b in pics.Values) b.Dispose();
                Snap();
                work = cfg; work.IsDefault = false;
                SelectCell(0); Changed();
                Status("가져왔어요. 확인하고 [저장하고 보드에 보내기]를 누르세요. (이 컴퓨터에 없는 프로그램 칸은 대상을 고쳐 주세요)"); lastMsg = DateTime.Now.AddSeconds(4);
            }
            catch (Exception ex)
            {
                Helper.Log("가져오기 실패: " + ex.Message);
                string why = ex is InvalidDataException ? "zip 파일이 깨져 있어요" : ex is FormatException ? "설정 내용이 올바르지 않아요" : ErrText.Easy(ex);
                Warn("가져오지 못했어요: " + why);
            }
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
        Snap();   // 끌어다 놓기·찾아보기 모두 여기를 지난다
        var c = work.Cells[i];
        bool wasNone = c.Kind == "none";
        string ext = Path.GetExtension(path).ToLowerInvariant();
        path = (path ?? "").Trim();
        bool web = UrlX.IsWeb(path);
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

    // 보드 칸 점에 쓰는 이름 수준: 0 괜찮음 / 1 조금 김(주황) / 2 저장 막힘(빨강) — CheckName 과 같은 셈
    public static int NameLevel(string name)
    {
        name = name ?? "";
        if (name.Trim().Length == 0) return 2;   // 찬 칸인데 이름이 비면 저장이 막힌다(UI 검수 7)
        foreach (char ch in name) if (!CharOk(ch)) return 2;
        if (Encoding.UTF8.GetByteCount(name) > 39) return 2;
        double w = 0; foreach (char ch in name) w += ch < 128 ? 0.6 : 1;
        return w > 6.01 ? 1 : 0;
    }

    // 이름 검사: 안 되는 글자 빨강(저장 막음), 길면 주황
    bool CheckName()
    {
        string bad = "";
        foreach (char ch in Cur.Name) if (!CharOk(ch) && bad.IndexOf(ch) < 0) bad += ch;
        double w = 0; foreach (char ch in Cur.Name) w += ch < 128 ? 0.6 : 1;
        if (bad.Length > 0)
        {
            insp.SetWarn("이 글자는 보드에 나오지 않아요: " + bad, BoxState.Danger);
            return false;
        }
        tip.SetToolTip(insp.NameBox.Box, "");
        if (Encoding.UTF8.GetByteCount(Cur.Name) > 39)
        {
            insp.SetWarn("이름이 너무 길어요. 줄여 주세요.", BoxState.Danger);
            return false;
        }
        if (Cur.Kind != "none" && Cur.Name.Trim().Length == 0)
        {
            insp.SetWarn("이름을 넣어 주세요.", BoxState.Danger);
            return false;
        }
        if (w > 6.01)
        {   // 작은 창에서도 안 잘리게 짧게, 자세한 설명은 풍선 도움말로(UI 검수 13)
            insp.SetWarn("조금 길어요. 끝이 … 로 잘려요.", BoxState.Warn);
            tip.SetToolTip(insp.NameBox.Box, "한글 6자, 영문 10자 안쪽이 좋아요. 더 길면 보드에서 끝이 … 로 잘릴 수 있어요.");
        }
        else insp.SetWarn(Cur.Kind == "none" ? "" : "보드 칸 아래에 나오는 이름이에요.", BoxState.Normal);
        return true;
    }

    bool Save()
    {
        for (int i = 0; i < 16; i++) FixUrl(work.Cells[i]);   // 입력칸을 떠나지 않고 저장해도 주소 앞머리를 맞춘다(UI 검수 6)
        for (int i = 0; i < 16; i++)
        {
            var c = work.Cells[i];
            if (c.Kind == "none") continue;
            string bad = "";
            foreach (char ch in c.Name) if (!CharOk(ch)) bad += ch;
            string why = bad.Length > 0 ? "이 글자는 보드에 나오지 않아요: " + bad
                : Encoding.UTF8.GetByteCount(c.Name) > 39 ? "이름이 너무 길어요."
                : c.Name.Trim().Length == 0 ? "이름을 넣어 주세요."
                : TargetEmpty(c) ? EmptyWhy(c) : null;
            if (why != null) { SelectCell(i); Warn("저장하지 못했어요. " + (i + 1) + "번 칸: " + why); return false; }
        }
        work.IsDefault = false;
        try { Cursor = Cursors.WaitCursor; host.SaveDeck(work); }
        catch (Exception ex) { Helper.Log("저장 실패: " + ex.Message); Warn("저장하지 못했어요: " + ErrText.Easy(ex)); return false; }
        finally { Cursor = Cursors.Default; }
        host.RequestPush(true);
        dirty = false;
        UpdateDirty();
        Status(host.HasDeckBoard() ? "저장했어요. 보드에 보내요(7인치는 1분쯤 걸려요)." : "저장했어요. 보드를 꽂으면 저절로 보내요.");
        lastMsg = DateTime.Now.AddSeconds(2);
        ShowCell(); board.Invalidate();
        Prac("save");
        return true;
    }

    void ToDefault()
    {
        if (Ask("단축키 꾸미기", "지금 꾸민 16칸이 모두 지워져요.\n먼저 [내보내기]로 저장해 두면 나중에 다시 가져올 수 있어요.\n되돌릴까요?",
            new[] { "되돌리기", "그만두기" }, 1, 1) != 0) return;
        Snap();   // 기본값은 곧바로 저장되지만, Ctrl+Z 로 돌아온 뒤 다시 저장하면 되살릴 수 있다(RestoreCells 가 dirty 를 켠다)
        work = DeckConfig.Default(Helper.AppFor);
        for (int i = 0; i < 16; i++) work.Cells[i].Tile = builtinPics[i] != null ? new Bitmap(builtinPics[i]) : null;
        work.IsDefault = true;
        try { host.SaveDeck(work); work.IsDefault = true; }
        catch (Exception ex) { Helper.Log("저장 실패: " + ex.Message); Warn("저장하지 못했어요: " + ErrText.Easy(ex)); return; }
        host.RequestReset();
        dirty = false;
        UpdateDirty();
        Status("기본값으로 되돌렸어요. 보드도 기본 아이콘으로 되돌려요. 되돌리려면 Ctrl+Z 뒤 저장");
        lastMsg = DateTime.Now.AddSeconds(4);
        SelectCell(sel);
        UpdateHint();
    }

    // ── 미리보기 그림 만들기(--preview)에서만 쓴다 ──
    public void PreviewFind(string q) { actions.Find.Box.Text = q; actions.ApplyFind(q); }
    public void PreviewEmpty(int i) { work.Cells[i] = DeckConfig.Empty(); if (i == sel) ShowCell(); board.Invalidate(); }
    public void PreviewDiscard() { dirty = false; UpdateDirty(); }
    public void PreviewName(int i, string name) { work.Cells[i].Name = name; if (i == sel) ShowCell(); MarkDirty(); }
    // 미리보기 그림용 예시 칸(--preview 에서만)
    public void PreviewMulti(int i)
    {
        var c = new DeckCell { Name = "수업 시작", Kind = "multi", IconMode = "letter" };
        c.Steps.Add(new DeckStep { Kind = "app", Target = "powerpnt", Wait = 2000, Opt = new Dictionary<string, string> { { "front", "1" } } });
        c.Steps.Add(new DeckStep { Kind = "url", Target = "https://www.neis.go.kr", Wait = 1000, Opt = new Dictionary<string, string> { { "browser", "msedge" } } });
        c.Steps.Add(new DeckStep { Kind = "builtin", Target = "#mute", Wait = 0 });
        c.Tile = DeckIcons.LetterTile(c.Name);
        work.Cells[i] = c; SelectCell(i); MarkDirty();
    }
    public void PreviewKeys(int i)
    {
        var c = new DeckCell { Name = "화면 캡처", Kind = "keys", Target = "#+s", IconMode = "letter" };
        c.Tile = DeckIcons.LetterTile(c.Name);
        work.Cells[i] = c; SelectCell(i); MarkDirty();
    }
}

// 위 띠: 제목 · 저장 안 함 · [한 번에 채우기 ▾] [아이콘 모양: … ▾] [더보기 ▾]
class TopBar : Control
{
    public readonly FlatButton Preset = new FlatButton(), ThemeBtn = new FlatButton(), More = new FlatButton(), Manual = new FlatButton();
    bool dirty;

    public TopBar()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Theme.Panel;
        Height = 52;
        Preset.Text = "한 번에 채우기"; Preset.Glyph = BtnGlyph.Down; Preset.Size = new Size(150, 32);
        ThemeBtn.Glyph = BtnGlyph.Down; ThemeBtn.Size = new Size(200, 32);
        More.Text = "더보기"; More.Glyph = BtnGlyph.Down; More.Style = BtnStyle.Ghost; More.Size = new Size(96, 32);
        Manual.Text = "설명서"; Manual.Glyph = BtnGlyph.Down; Manual.Style = BtnStyle.Ghost; Manual.Size = new Size(100, 32);
        Controls.AddRange(new Control[] { Preset, ThemeBtn, More, Manual });
        Preset.TabIndex = 0; ThemeBtn.TabIndex = 1; More.TabIndex = 2; Manual.TabIndex = 3;
    }

    public bool Dirty { get { return dirty; } set { if (dirty != value) { dirty = value; Invalidate(); } } }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        int y = (Height - 32) / 2, x = Width - 16;
        x -= More.Width; More.Location = new Point(x, y);
        x -= 8 + ThemeBtn.Width; ThemeBtn.Location = new Point(x, y);
        x -= 8 + Preset.Width; Preset.Location = new Point(x, y);
        x -= 8 + Manual.Width; Manual.Location = new Point(x, y);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Theme.Panel);
        g.DrawLine(Theme.PenLine, 0, Height - 1, Width, Height - 1);
        var tf = DeckFonts.Medium(13f);
        float tw = Theme.TextWidth(g, "탭덱 · 단축키 꾸미기", tf);
        Theme.Text(g, "탭덱 · 단축키 꾸미기", tf, Theme.Text1, new RectangleF(16, 0, tw + 8, Height - 1));
        if (dirty)
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            float x = 16 + tw + 14;
            g.FillEllipse(Theme.Br(Theme.Warn), x, Height / 2f - 3, 6, 6);
            Theme.Text(g, "저장 안 함", DeckFonts.Light(8.5f), Theme.Warn, new RectangleF(x + 10, 0, 100, Height - 1));
        }
    }
}
