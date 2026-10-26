// DeckInspector.cs — 아래 '속성 창': 고른 칸의 아이콘 상자·이름·하는 일·대상. 배치와 바탕 그리기만 하고,
// 일(이벤트 처리)은 DeckForm 이 한다. 설계_도우미화면.md 9장. C# 5 문법만
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

class Inspector : Control
{
    public readonly RoundBox NameBox = new RoundBox(), TargetBox = new RoundBox(), TextBox = new RoundBox();
    public readonly Segmented Kind = new Segmented();
    public readonly FlatButton BrowseBtn = new FlatButton(), BuiltinBtn = new FlatButton(), IconBtn = new FlatButton();
    public readonly FlatButton TryBtn = new FlatButton(), ClearBtn = new FlatButton();
    public readonly FlatButton RecordBtn = new FlatButton(), OptBtn = new FlatButton(), StepsBtn = new FlatButton();   // 단축키 눌러서 넣기 · 자세히 · 여러 동작 차례

    // 그림으로 그리는 글
    string head = "", headSub = "", warn = "", help = "", mode = "";
    BoxState warnState = BoxState.Normal;
    Bitmap tile; bool iconOn = true, iconHot, iconDrop;
    string targetKind = "none";

    public event Action IconBoxClicked;
    public event Action<string> IconImageDropped;

    public Inspector()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Theme.Panel;
        Height = 208;
        AllowDrop = true;

        NameBox.Box.MaxLength = 20;
        Kind.Items = new[] { "프로그램 열기", "사이트 열기", "단축키 누르기", "글자 넣기", "내장 기능", "여러 동작" };
        RecordBtn.Text = "눌러서 넣기"; RecordBtn.Size = new Size(112, 32);
        OptBtn.Text = "자세히…"; OptBtn.Size = new Size(80, 32);
        StepsBtn.Text = "동작 차례 고치기…"; StepsBtn.Style = BtnStyle.Primary; StepsBtn.Size = new Size(200, 32);
        Controls.AddRange(new Control[] { RecordBtn, OptBtn, StepsBtn });
        Kind.Height = 32;
        BrowseBtn.Text = "찾아보기…"; BrowseBtn.Size = new Size(96, 32);
        BuiltinBtn.Glyph = BtnGlyph.Down; BuiltinBtn.Size = new Size(240, 32);
        TextBox.Multiline = true;
        IconBtn.Text = "아이콘 바꾸기"; IconBtn.Glyph = BtnGlyph.Down; IconBtn.Size = new Size(120, 28);
        TryBtn.Text = "눌러 보기"; TryBtn.Glyph = BtnGlyph.Play; TryBtn.Size = new Size(160, 32);
        ClearBtn.Text = "이 칸 비우기"; ClearBtn.Style = BtnStyle.Danger; ClearBtn.Size = new Size(160, 32);
        Controls.AddRange(new Control[] { NameBox, Kind, TargetBox, BrowseBtn, TextBox, BuiltinBtn, IconBtn, TryBtn, ClearBtn });
        int t = 0;
        foreach (Control c in new Control[] { NameBox, Kind, TargetBox, TextBox, BuiltinBtn, BrowseBtn, IconBtn, TryBtn, ClearBtn }) c.TabIndex = t++;
    }

    // ── 바깥에서 정하는 값 ──
    public void SetHead(string main, string sub) { head = main ?? ""; headSub = sub ?? ""; Invalidate(new Rectangle(140, 0, Width, 44)); }
    public void SetWarn(string text, BoxState st)
    {
        warn = text ?? ""; warnState = st; NameBox.State = st;
        Invalidate(new Rectangle(NameBox.Right, NameBox.Top - 4, Width, NameBox.Height + 8));
    }
    public void SetHelp(string text) { help = text ?? ""; Invalidate(new Rectangle(200, 120, Width, Height - 120)); }
    public void SetIcon(Bitmap b, string modeText, bool on)
    {
        tile = b; mode = modeText ?? ""; iconOn = on;
        Invalidate(new Rectangle(0, 0, 150, Height));
    }
    // 대상 줄 모양(하는 일에 따라)
    public void SetTargetKind(string k)
    {
        targetKind = k ?? "none";
        TargetBox.Visible = k == "app" || k == "url" || k == "keys";
        BrowseBtn.Visible = k == "app";
        TextBox.Visible = k == "text";
        BuiltinBtn.Visible = k == "builtin";
        RecordBtn.Visible = k == "keys";
        OptBtn.Visible = k == "app" || k == "url" || k == "text";
        StepsBtn.Visible = k == "multi";
        TargetBox.Placeholder = k == "url" ? "https://…" : k == "keys" ? "[눌러서 넣기] 또는 직접: ^c" : k == "app" ? "프로그램·파일·폴더 경로" : "";
        DoLayout();
        Invalidate();
    }

    Rectangle IconBox { get { return new Rectangle(16, 16, 120, 120); } }

    // ── 배치(설계 9장 표) ──
    protected override void OnResize(EventArgs e) { base.OnResize(e); DoLayout(); }
    void DoLayout()
    {
        int W = Width;
        int colX = W - 176;
        // 하는 일·대상 줄 폭: 단추 열 아래까지 넘어가면 단추 열 오른쪽 끝(W-16)에, 아니면 단추 열 왼쪽(W-176-12)에 끝선을 맞춘다(디자인 검수 9)
        int rowW = 216 + 532 > colX - 12 ? W - 16 - 216 : Math.Min(760, colX - 12 - 216);
        rowW = Math.Max(200, rowW);
        IconBtn.SetBounds(16, 144, 120, 28);
        NameBox.SetBounds(216, 48, 240, 32);
        Kind.SetBounds(216, 88, rowW, 32);
        // 대상 줄 오른쪽 단추: 프로그램 = [찾아보기][자세히] / 사이트 = [자세히] / 단축키 = [눌러서 넣기] / 글자 = [자세히]
        int right = targetKind == "app" ? 104 + 88 : targetKind == "url" ? 88 : targetKind == "keys" ? 120 : 0;
        int tw = Math.Max(80, rowW - right);
        TargetBox.SetBounds(216, 128, tw, 32);
        BrowseBtn.SetBounds(216 + tw + 8, 128, 96, 32);
        RecordBtn.SetBounds(216 + tw + 8, 128, 112, 32);
        OptBtn.SetBounds(targetKind == "app" ? 216 + tw + 8 + 104 : targetKind == "text" ? 216 + rowW - 80 : 216 + tw + 8, 128, 80, 32);
        TextBox.SetBounds(216, 128, targetKind == "text" ? rowW - 88 : rowW, 56);
        BuiltinBtn.SetBounds(216, 128, 240, 32);
        StepsBtn.SetBounds(216, 128, 200, 32);
        TryBtn.SetBounds(colX, 16, 160, 32);
        ClearBtn.SetBounds(colX, 56, 160, 32);
    }

    // ── 그리기 ──
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Theme.Panel);
        g.DrawLine(Theme.PenLine, 0, 0, Width, 0);
        g.SmoothingMode = SmoothingMode.AntiAlias;

        // 아이콘 상자
        var ib = IconBox;
        Theme.FillRound(g, Theme.Br(iconHot && iconOn ? Theme.BtnHover : Theme.Raised), ib, 12);
        if (tile != null)
        {   // 72 그림은 늘리지 않고 그대로(보드 칸과 같은 선명함. 디자인 검수 7). 다른 크기만 72 안에 맞춘다
            int s = 72;
            var dst = new Rectangle(ib.X + (ib.Width - s) / 2, ib.Y + (ib.Height - s) / 2, s, s);
            bool exact = tile.Width == s && tile.Height == s;
            g.InterpolationMode = exact ? InterpolationMode.NearestNeighbor : InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = exact ? PixelOffsetMode.Half : PixelOffsetMode.HighQuality;
            g.DrawImage(tile, dst);
            g.PixelOffsetMode = PixelOffsetMode.Default;
        }
        else
            Theme.Text(g, "아이콘 없음", DeckFonts.Light(8.5f), Theme.Text3, ib, StringAlignment.Center);
        if (iconDrop) Theme.DashedRound(g, new RectangleF(ib.X + 1.5f, ib.Y + 1.5f, ib.Width - 3, ib.Height - 3), 11, Theme.DropTarget, 2);
        Theme.Text(g, mode, DeckFonts.Light(8.5f), Theme.Text3, new RectangleF(16, 176, 120, 18), StringAlignment.Center);

        // 머리줄: 큰 글과 작은 글의 아랫선(글자 바닥선)을 맞춘다(디자인 검수 8)
        var hf = DeckFonts.Medium(12f);
        var sf = DeckFonts.Light(8.5f);
        float hw = Theme.TextWidth(g, head, hf);
        const float headTop = 14;
        float baseY = headTop + Ascent(hf);
        Theme.Text(g, head, hf, Theme.Text1, new RectangleF(152, headTop, hw + 8, 26), StringAlignment.Near, StringAlignment.Near, false);
        Theme.Text(g, headSub, sf, Theme.Text2, new RectangleF(152 + hw + 12, baseY - Ascent(sf), Math.Max(10, Width - 176 - 16 - (152 + hw + 12)), 20),
            StringAlignment.Near, StringAlignment.Near, false);

        // 이름표
        var lf = DeckFonts.Regular(9.5f);
        Theme.Text(g, "이름", lf, Theme.Text2, new RectangleF(152, NameBox.Top, 60, NameBox.Height));
        Theme.Text(g, "하는 일", lf, Theme.Text2, new RectangleF(152, Kind.Top, 62, Kind.Height));
        if (targetKind != "none")
            Theme.Text(g, targetKind == "multi" ? "차례" : "대상", lf, Theme.Text2, new RectangleF(152, 128, 60, 32));

        // 이름 검사 글(두 줄까지)
        float wx = NameBox.Right + 12, wr = Width - 176 - 12;
        Color wc = warnState == BoxState.Danger ? Theme.Danger : warnState == BoxState.Warn ? Theme.Warn : Theme.Text2;
        if (wr - wx > 20)
            Theme.Text(g, warn, DeckFonts.Light(8.5f), wc, new RectangleF(wx, NameBox.Top - 2, wr - wx, NameBox.Height + 4), StringAlignment.Near, StringAlignment.Center, true);

        // 도움말: 빈 칸이면 대상 줄 자리(128)로 올려 가운데가 비지 않게(디자인 검수 10)
        if (targetKind != "text")
        {
            float hy = targetKind == "none" ? 128 : 166;
            float hh = targetKind == "none" ? 32 : 20;
            Theme.Text(g, help, DeckFonts.Light(8.5f), Theme.Text2, new RectangleF(216, hy, Math.Max(20, Width - 16 - 216), hh));
        }
    }

    // 글꼴의 윗부분 높이(픽셀). DrawString 은 줄 위쪽을 사각형 위에 맞추므로, 바닥선 = 위 + Ascent
    static float Ascent(Font f)
    {
        var ff = f.FontFamily;
        return f.SizeInPoints * 96f / 72f * ff.GetCellAscent(f.Style) / ff.GetEmHeight(f.Style);
    }

    // ── 아이콘 상자: 누르기·그림 끌어 놓기 ──
    protected override void OnMouseMove(MouseEventArgs e)
    {
        bool h = IconBox.Contains(e.Location);
        if (h != iconHot) { iconHot = h; Cursor = h && iconOn ? Cursors.Hand : Cursors.Default; Invalidate(IconBox); }
        base.OnMouseMove(e);
    }
    protected override void OnMouseLeave(EventArgs e) { if (iconHot) { iconHot = false; Invalidate(IconBox); } base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (IconBox.Contains(e.Location) && iconOn && IconBoxClicked != null) IconBoxClicked();
    }

    static string ImagePath(IDataObject d)
    {
        var files = d.GetData(DataFormats.FileDrop) as string[];
        if (files != null && files.Length > 0 && DeckForm.IsImage(files[0])) return files[0];
        return null;
    }
    void DropState(DragEventArgs e)
    {
        bool ok = iconOn && IconBox.Contains(PointToClient(new Point(e.X, e.Y))) && ImagePath(e.Data) != null;
        e.Effect = ok ? DragDropEffects.Copy : DragDropEffects.None;
        if (ok != iconDrop) { iconDrop = ok; Invalidate(IconBox); }
    }
    protected override void OnDragEnter(DragEventArgs e) { DropState(e); base.OnDragEnter(e); }
    protected override void OnDragOver(DragEventArgs e) { DropState(e); base.OnDragOver(e); }
    protected override void OnDragLeave(EventArgs e) { iconDrop = false; Invalidate(IconBox); base.OnDragLeave(e); }
    protected override void OnDragDrop(DragEventArgs e)
    {
        bool ok = iconDrop;
        iconDrop = false; Invalidate(IconBox);
        base.OnDragDrop(e);
        string p = ImagePath(e.Data);
        // 묻는 창은 놓기가 끝난 뒤에 띄운다(끈 쪽 탐색기가 멈추지 않게. UI 검수 4)
        if (ok && p != null && IconImageDropped != null) BeginInvoke((Action)delegate { if (IconImageDropped != null) IconImageDropped(p); });
    }
}
