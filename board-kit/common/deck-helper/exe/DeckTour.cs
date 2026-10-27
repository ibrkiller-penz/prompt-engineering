// DeckTour.cs — 꾸미기 창의 [설명서]: HTML 설명서 열기(exe 안의 manual.zip 을 풀어서), '둘러보기 안내'(처음 켤 때 한 번,
// 화면 곳곳을 차례로 밝혀 설명), '연습 과제'(직접 해 보면 저절로 ✓). C# 5 문법만
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Compression;
using System.Reflection;
using System.Windows.Forms;

static class DeckManual
{
    public const string WebHtml = "https://penedu.web.app/board/manual/index.html";
    public const string WebPdf = "https://penedu.web.app/board/deck-helper-manual.pdf";

    // exe 안의 설명서(사용설명서.html + 그림 + 글꼴)를 도우미 폴더에 풀고 기본 브라우저로 연다. 없으면 인터넷 쪽
    public static void Open(IWin32Window owner, string anchor)
    {
        try
        {
            string dir = Path.Combine(Helper.DataDir, "manual");
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("deck.manual.zip"))
            {
                if (s != null)
                {
                    string ver = Path.Combine(dir, ".ver"), want = s.Length.ToString();
                    if (!File.Exists(ver) || File.ReadAllText(ver) != want)
                    {
                        Directory.CreateDirectory(dir);
                        using (var z = new ZipArchive(s, ZipArchiveMode.Read))
                            foreach (var e in z.Entries)
                            {
                                if (e.Name == "") continue;
                                string f = Path.Combine(dir, e.FullName.Replace('/', '\\'));
                                Directory.CreateDirectory(Path.GetDirectoryName(f));
                                using (var i = e.Open()) using (var o = File.Create(f)) i.CopyTo(o);
                            }
                        File.WriteAllText(ver, want);
                    }
                    string html = Path.Combine(dir, "사용설명서.html");
                    if (File.Exists(html))
                    {
                        string url = new Uri(html).AbsoluteUri + (string.IsNullOrEmpty(anchor) ? "" : "#" + anchor);
                        // file:// 에 #가 붙으면 ShellExecute 가 떼어 버리는 브라우저가 있어 html 은 그대로, 주소는 브라우저에 직접
                        try { Process.Start(new ProcessStartInfo(url) { UseShellExecute = true }); }
                        catch { Process.Start(new ProcessStartInfo(html) { UseShellExecute = true }); }
                        return;
                    }
                }
            }
            Process.Start(new ProcessStartInfo(WebHtml) { UseShellExecute = true });
        }
        catch (Exception ex)
        {
            MessageBox.Show(owner, "설명서를 열지 못했어요.\n인터넷 창에서 penedu.web.app/deck 을 열어 '사용 설명서'를 눌러 주세요.\n\n(" + ErrText.Easy(ex) + ")", "설명서");
        }
    }

    public static void OpenPdf(IWin32Window owner)
    {
        try { Process.Start(new ProcessStartInfo(WebPdf) { UseShellExecute = true }); }
        catch (Exception ex) { MessageBox.Show(owner, "열지 못했어요: " + ErrText.Easy(ex), "설명서"); }
    }
}

// ── 둘러보기 안내: 창 위를 어둡게 덮고 한 곳씩 밝혀 설명 ──
class TourStep
{
    public string Title, Body;
    public Func<Rectangle> Target;   // 창 안쪽 좌표. null 이면 가운데에 안내만
}

class TourOverlay : Control
{
    readonly Form owner;
    readonly List<TourStep> steps;
    readonly FlatButton prev = new FlatButton(), next = new FlatButton(), stop = new FlatButton(), practice = new FlatButton();
    Bitmap shot;
    int at;
    Rectangle card, spot;
    public event Action Finished, PracticeAsked;

    public TourOverlay(Form f, List<TourStep> s)
    {
        owner = f; steps = s;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.Selectable, true);
        TabStop = true;
        prev.Text = "이전"; prev.Size = new Size(80, 32);
        next.Text = "다음"; next.Style = BtnStyle.Primary; next.Size = new Size(96, 32);
        stop.Text = "그만 보기"; stop.Style = BtnStyle.Ghost; stop.Size = new Size(92, 32);
        practice.Text = "연습 과제 해 보기"; practice.Style = BtnStyle.Normal; practice.Size = new Size(150, 32);
        foreach (var b in new[] { prev, next, stop, practice }) { b.Under = Theme.Raised; Controls.Add(b); }
        prev.Click += delegate { Go(at - 1); };
        next.Click += delegate { if (at >= steps.Count - 1) End(false); else Go(at + 1); };
        stop.Click += delegate { End(false); };
        practice.Click += delegate { End(true); };
    }

    public void Start()
    {
        Bounds = owner.ClientRectangle;
        Capture2();
        Visible = true; BringToFront();
        Go(0);
        Focus();
    }

    // 창 모습을 그림으로(덮개 아래 그대로 보이게)
    void Capture2()
    {
        bool v = Visible; Visible = false;
        owner.Update();
        if (shot != null) shot.Dispose();
        var whole = new Bitmap(owner.Width, owner.Height);
        owner.DrawToBitmap(whole, new Rectangle(0, 0, owner.Width, owner.Height));
        Point c = owner.PointToScreen(Point.Empty);
        var r = new Rectangle(c.X - owner.Left, c.Y - owner.Top, owner.ClientSize.Width, owner.ClientSize.Height);
        r.Intersect(new Rectangle(0, 0, whole.Width, whole.Height));
        shot = whole.Clone(r, whole.PixelFormat);
        whole.Dispose();
        Visible = v;
    }

    public void Next() { Go(at + 1); }   // 미리보기 그림용

    void Go(int i)
    {
        at = Math.Max(0, Math.Min(steps.Count - 1, i));
        var st = steps[at];
        spot = st.Target != null ? st.Target() : Rectangle.Empty;
        if (!spot.IsEmpty) spot.Inflate(6, 6);
        // 설명 상자 자리: 밝힌 곳 아래 → 위 → 왼쪽 → 가운데
        int cw = 420, ch = MeasureCard(st, cw);
        var cl = ClientRectangle; cl.Inflate(-16, -16);
        Rectangle pos;
        if (spot.IsEmpty) pos = new Rectangle(cl.X + (cl.Width - cw) / 2, cl.Y + (cl.Height - ch) / 2, cw, ch);
        else if (spot.Bottom + 12 + ch <= cl.Bottom) pos = new Rectangle(spot.X, spot.Bottom + 12, cw, ch);
        else if (spot.Top - 12 - ch >= cl.Top) pos = new Rectangle(spot.X, spot.Top - 12 - ch, cw, ch);
        else if (spot.Left - 12 - cw >= cl.Left) pos = new Rectangle(spot.Left - 12 - cw, spot.Y, cw, ch);
        else pos = new Rectangle(spot.Right + 12, spot.Y, cw, ch);
        pos.X = Math.Max(cl.Left, Math.Min(cl.Right - cw, pos.X));
        pos.Y = Math.Max(cl.Top, Math.Min(cl.Bottom - ch, pos.Y));
        card = pos;
        int by = card.Bottom - 16 - 32;
        bool last = at == steps.Count - 1;
        next.Text = last ? "끝" : "다음";
        next.Location = new Point(card.Right - 16 - next.Width, by);
        prev.Location = new Point(next.Left - 8 - prev.Width, by);
        prev.Visible = at > 0;
        stop.Location = new Point(card.Left + 12, by);
        stop.Visible = !last;
        practice.Visible = last;
        practice.Location = new Point(card.Left + 16, by);
        Invalidate();
    }

    int MeasureCard(TourStep st, int w)
    {
        using (var g = CreateGraphics())
        {
            var sz = g.MeasureString(st.Body, DeckFonts.Regular(10f), w - 40);
            return (int)Math.Ceiling(16 + 22 + Theme.S(30) + sz.Height + 16 + 32 + 16);
        }
    }

    void End(bool wantPractice)
    {
        Visible = false;
        if (Parent != null) Parent.Controls.Remove(this);
        if (shot != null) { shot.Dispose(); shot = null; }
        if (Finished != null) Finished();
        if (wantPractice && PracticeAsked != null) PracticeAsked();
        Dispose();
    }

    protected override bool IsInputKey(Keys k) { return k == Keys.Left || k == Keys.Right || k == Keys.Escape || k == Keys.Enter || base.IsInputKey(k); }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Escape) End(false);
        else if (e.KeyCode == Keys.Right || e.KeyCode == Keys.Enter) { if (at >= steps.Count - 1) End(false); else Go(at + 1); }
        else if (e.KeyCode == Keys.Left) Go(at - 1);
        e.Handled = true;
        base.OnKeyDown(e);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        if (shot != null) g.DrawImageUnscaled(shot, 0, 0); else g.Clear(Theme.Bg);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        using (var dim = new Region(ClientRectangle))
        {
            if (!spot.IsEmpty) using (var p = Theme.Round(spot, 12)) dim.Exclude(p);
            using (var br = new SolidBrush(Color.FromArgb(175, 6, 8, 12))) g.FillRegion(br, dim);
        }
        if (!spot.IsEmpty) Theme.DrawRound(g, Theme.Pn(Theme.Accent, 3f), spot, 12);
        // 설명 상자
        Theme.FillRound(g, Theme.BrRaised, card, 12);
        Theme.DrawRound(g, Theme.Pn(Theme.KeyEdgeHover), card, 12);
        var st = steps[at];
        Theme.Text(g, (at + 1) + " / " + steps.Count, DeckFonts.Regular(8.5f), Theme.Text3, new RectangleF(card.X + 20, card.Y + 14, 100, 20));
        // 진행 점
        for (int i = 0; i < steps.Count; i++)
            g.FillEllipse(Theme.Br(i == at ? Theme.Accent : Theme.Thumb), card.Right - 20 - (steps.Count - i) * 12, card.Y + 20, 7, 7);
        Theme.Text(g, st.Title, DeckFonts.Medium(13f), Theme.Text1, new RectangleF(card.X + 20, card.Y + 36, card.Width - 40, 28));
        Theme.Text(g, st.Body, DeckFonts.Regular(10f), Theme.Text2, new RectangleF(card.X + 20, card.Y + 68, card.Width - 40, card.Height - 68 - 56), StringAlignment.Near, StringAlignment.Near, true);
    }
}

// ── 연습 과제: 직접 해 보면 하나씩 ✓ ──
class PracticePanel : Control
{
    static readonly string[] Keys0 = { "select", "drop", "swap", "name", "try", "save" };
    static readonly string[] Texts = {
        "보드 모양에서 칸 하나를 눌러 고르기",
        "오른쪽 목록의 줄 하나를 끌어 칸에 놓기",
        "칸을 끌어 다른 칸에 놓아 자리 바꾸기",
        "아래 '이름' 칸에서 이름 바꿔 보기",
        "[▶ 눌러 보기]로 이 컴퓨터에서 해 보기",
        "[저장하고 보드에 보내기] 누르기" };
    readonly bool[] done = new bool[6];
    readonly FlatButton close = new FlatButton();
    public event Action Closed;

    public PracticePanel()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Size = new Size(300, 64 + Texts.Length * Theme.S(30) + 20);   // 300: 보드 왼쪽에 비워 둔 자리에 들어가는 폭(DeckForm.PlacePractice)
        close.Text = "닫기"; close.Style = BtnStyle.Ghost; close.Size = new Size(64, 28); close.Under = Theme.Raised;
        close.Location = new Point(Width - 12 - 64, 12);
        close.Click += delegate { if (Closed != null) Closed(); };
        Controls.Add(close);
    }

    public bool AllDone { get { foreach (var d in done) if (!d) return false; return true; } }

    // 칸을 가리면 끌어서 옮길 수 있게
    Point grab; bool dragging;
    protected override void OnMouseDown(MouseEventArgs e) { if (e.Button == MouseButtons.Left) { dragging = true; grab = e.Location; Cursor = Cursors.SizeAll; } base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { dragging = false; Cursor = Cursors.Default; base.OnMouseUp(e); }
    protected override void OnMouseMove(MouseEventArgs e)
    {
        if (dragging && Parent != null)
        {
            var p = new Point(Left + e.X - grab.X, Top + e.Y - grab.Y);
            p.X = Math.Max(0, Math.Min(Parent.ClientSize.Width - Width, p.X));
            p.Y = Math.Max(0, Math.Min(Parent.ClientSize.Height - Height, p.Y));
            Location = p;
        }
        else Cursor = Cursors.SizeAll;
        base.OnMouseMove(e);
    }

    public void Done(string key)
    {
        int i = Array.IndexOf(Keys0, key);
        if (i < 0 || done[i]) return;
        done[i] = true;
        Invalidate();
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Paint0.ParentBg(this));
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var r = new Rectangle(0, 0, Width - 1, Height - 1);
        Theme.FillRound(g, Theme.BrRaised, r, 12);
        Theme.DrawRound(g, Theme.Pn(Theme.Accent, 2f), r, 12);
        int n = 0; foreach (var d in done) if (d) n++;
        Theme.Text(g, "연습 과제", DeckFonts.Medium(12f), Theme.Text1, new RectangleF(16, 12, 200, 28));
        Theme.Text(g, AllDone ? "모두 했어요! 이제 혼자서도 할 수 있어요." : n + " / " + Texts.Length + " · 해 보면 저절로 표시돼요 · 끌어서 옮기기", DeckFonts.Regular(8.5f),
            AllDone ? Theme.Ok : Theme.Text3, new RectangleF(16, 38, Width - 32, 20));
        for (int i = 0; i < Texts.Length; i++)
        {
            int y = 64 + i * Theme.S(30);
            var box = new Rectangle(16, y + 4, 18, 18);
            if (done[i]) { g.FillEllipse(Theme.Br(Theme.Ok), box); DrawCheck(g, box); }
            else g.DrawEllipse(Theme.Pn(Theme.KeyEdgeHover, 1.5f), box);
            Theme.Text(g, Texts[i], DeckFonts.Regular(9.5f), done[i] ? Theme.Text3 : Theme.Text1, new RectangleF(44, y, Width - 56, 26));
        }
    }

    static void DrawCheck(Graphics g, Rectangle b)
    {
        using (var p = new Pen(Color.White, 2f) { StartCap = LineCap.Round, EndCap = LineCap.Round, LineJoin = LineJoin.Round })
            g.DrawLines(p, new[] { new PointF(b.X + 4.5f, b.Y + 9.5f), new PointF(b.X + 8f, b.Y + 13f), new PointF(b.X + 13.5f, b.Y + 6f) });
    }
}
