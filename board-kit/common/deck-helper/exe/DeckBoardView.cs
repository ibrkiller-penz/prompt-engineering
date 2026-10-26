// DeckBoardView.cs — 가운데 '보드 미리보기': 7인치(2줄×8칸)·4인치(4줄×4칸) 모양, 둥근 단추 칸, 끌어다 놓기, 키보드.
// 설계_도우미화면.md 7장·11장·12장. C# 5 문법만
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

class BoardView : Control
{
    readonly DeckForm f;
    public readonly Segmented ShapePill = new Segmented();
    public readonly FlatButton HintOk = new FlatButton();
    readonly ToolTip tip = DarkTip.Make();
    readonly Timer pressTimer = new Timer();
    const string TipText = "끌어서 칸 순서 바꾸기 · 오른쪽 클릭: 복사·붙여넣기·비우기·눌러 보기\n프로그램·바로 가기·주소를 끌어다 놓으면 칸 채우기, 그림 파일을 놓으면 아이콘 바꾸기";

    bool hint, hintFits = true; string hintText = "";
    int cols = 8, rows = 2, cell = 88, pad = 24, gap = 12, nameH = 20;
    Rectangle body;
    int hover = -1, pressed = -1, dragFrom = -1, dropTarget = -1, downCell = -1;
    bool dropCopy, dropSwap, actionDrag;
    Point downPt;
    string curTip = "";

    class Scaled { public Bitmap Src, Img; public int Size; }
    readonly Dictionary<int, Scaled> scaled = new Dictionary<int, Scaled>();

    public BoardView(DeckForm form)
    {
        f = form;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
        SetStyle(ControlStyles.StandardDoubleClick, false);
        BackColor = Theme.Bg;
        AllowDrop = true;
        TabStop = true;

        ShapePill.Items = new[] { "7인치", "4인치" };
        ShapePill.Pill = true;
        ShapePill.Size = new Size(120, 28);
        ShapePill.Picked += delegate (int i) { f.SetShape(i == 0 ? 7 : 4); };
        Controls.Add(ShapePill);

        HintOk.Text = "알겠어요"; HintOk.Style = BtnStyle.Ghost; HintOk.Size = new Size(84, 28); HintOk.Under = Theme.Raised;
        HintOk.Click += delegate { f.HideHint(); };
        Controls.Add(HintOk);

        pressTimer.Interval = 120;
        pressTimer.Tick += delegate { pressTimer.Stop(); int p = pressed; pressed = -1; if (p >= 0) InvalidateCell(p); };
    }

    public void SetHint(bool visible, string text)
    {
        hint = visible; hintText = text ?? "";
        DoLayout();
    }

    // ── 배치 계산(설계 7-1) ──
    bool Seven { get { return f.Shape != 4; } }
    const int BottomM = 28;   // 보드 아래 설명 줄 자리

    public void DoLayout()
    {
        bool seven = Seven;
        cols = seven ? 8 : 4; rows = seven ? 2 : 4;
        // 7인치: 칸 사이를 넓히고(16) 칸은 아이콘에 붙게(최대 84). 4인치: 여백을 줄여 칸을 키운다(디자인 검수 2·3)
        pad = seven ? 24 : 12; gap = seven ? 16 : 8; nameH = seven ? 20 : 16;
        ShapePill.Location = new Point(Width - 16 - ShapePill.Width, 16 + (32 - ShapePill.Height) / 2);   // 도움말 띠(32)와 세로 가운데 맞춤
        ShapePill.SelectedIndex = seven ? 0 : 1;
        // 도움말 띠를 넣으면 칸이 너무 작아질 때(4인치·작은 창)는 띠를 잠시 숨긴다(닫은 것은 아님. UI 검수 1)
        hintFits = true;
        if (hint)
        {
            Place(56);
            if (cell < (seven ? 48 : 44)) hintFits = false;
        }
        bool showHint = hint && hintFits;
        HintOk.Visible = showHint;
        if (showHint) HintOk.Location = new Point(HintRect.Right - 4 - HintOk.Width, HintRect.Top + 2);
        Place(showHint ? 56 : 16);
        scaledClear();
        Invalidate();
    }

    void Place(int top)
    {
        Compute(top);
        // 보드 몸체가 오른쪽 위 알약과 겹치면 알약 아래로 내린다
        if (body.Top < ShapePill.Bottom + 8 && body.Right > ShapePill.Left - 8) Compute(ShapePill.Bottom + 12);
    }

    void Compute(int top)
    {
        int useW = Math.Max(100, Width - 48), useH = Math.Max(60, Height - top - BottomM);
        int byW = (useW - 2 * pad - (cols - 1) * gap) / cols;
        int byH = (useH - 2 * pad - rows * nameH - (rows - 1) * gap) / rows;
        cell = Math.Max(28, Math.Min(Seven ? 84 : 96, Math.Min(byW, byH)));
        int bw = 2 * pad + cols * cell + (cols - 1) * gap;
        int bh = 2 * pad + rows * (cell + nameH) + (rows - 1) * gap;
        body = new Rectangle((Width - bw) / 2, top + Math.Max(0, (useH - bh) / 2), bw, bh);
    }

    Rectangle HintRect { get { return new Rectangle(16, 16, Math.Max(100, ShapePill.Left - 16 - 16), 32); } }
    int IconSize { get { return Math.Min(72, cell - 8); } }
    float Radius { get { return Math.Max(8, cell * 0.16f); } }

    public Rectangle CellRect(int i)
    {
        int c = i % cols, r = i / cols;
        return new Rectangle(body.X + pad + c * (cell + gap), body.Y + pad + r * (cell + nameH + gap), cell, cell);
    }
    public Rectangle NameRect(int i)
    {
        var r = CellRect(i);
        return new Rectangle(r.X - gap / 2 + 1, r.Bottom + 4, cell + gap - 2, nameH);   // 고른 칸 테두리(밖 5px)와 안 겹치게 4 띄움
    }
    public int HitCell(Point p)
    {
        for (int i = 0; i < 16; i++)
        {
            var r = CellRect(i);
            var all = new Rectangle(r.X - gap / 2, r.Y - gap / 2, cell + gap, cell + nameH + gap);
            if (all.Contains(p)) return i;
        }
        return -1;
    }
    public void InvalidateCell(int i)
    {
        if (i < 0 || i > 15) return;
        Invalidate(Rectangle.Inflate(Rectangle.Union(CellRect(i), NameRect(i)), 8, 8));
    }

    // ▶ 눌러 보기 때 120ms 눌린 모습
    public void FlashPress(int i)
    {
        pressed = i; InvalidateCell(i);
        pressTimer.Stop(); pressTimer.Start();
    }

    void scaledClear() { foreach (var s in scaled.Values) if (s.Img != null && s.Img != s.Src) s.Img.Dispose(); scaled.Clear(); }

    Bitmap IconFor(int i, Bitmap tile, int size)
    {
        if (tile == null) return null;
        if (tile.Width == size && tile.Height == size) return tile;   // 72 그림을 72 로: 그대로(디자인 검수 14)
        Scaled s;
        if (scaled.TryGetValue(i, out s) && s.Src == tile && s.Size == size) return s.Img;
        if (s != null && s.Img != null) s.Img.Dispose();
        var b = new Bitmap(size, size);
        using (var g = Graphics.FromImage(b))
        {
            g.InterpolationMode = InterpolationMode.HighQualityBicubic;
            g.PixelOffsetMode = PixelOffsetMode.HighQuality;
            g.DrawImage(tile, new Rectangle(0, 0, size, size));
        }
        scaled[i] = new Scaled { Src = tile, Img = b, Size = size };
        return b;
    }

    protected override void OnResize(EventArgs e) { base.OnResize(e); DoLayout(); }

    // ── 그리기(설계 7-2, 7-3) ──
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Theme.Bg);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var w = f.Work;
        if (w == null) return;

        if (hint && hintFits)
        {
            var hr = HintRect;
            Theme.FillRound(g, Theme.BrRaised, hr, 6);
            Theme.Text(g, hintText, DeckFonts.Light(8.5f), Theme.Text2, new RectangleF(hr.X + 12, hr.Y, HintOk.Left - hr.X - 20, hr.Height));
        }

        // 몸체 그림자 3겹 → 몸체 → 테두리
        int[] alpha = { 70, 35, 15 };
        for (int k = 0; k < 3; k++)
        {
            var sr = new RectangleF(body.X - 2 * k, body.Y + 6 - 2 * k, body.Width + 4 * k, body.Height + 4 * k);
            using (var b = new SolidBrush(Color.FromArgb(alpha[k], 0, 0, 0))) Theme.FillRound(g, b, sr, 20 + 2 * k);
        }
        Theme.FillRound(g, Theme.Br(Theme.Device), body, 20);
        Theme.DrawRound(g, Theme.Pn(Theme.DeviceEdge), new RectangleF(body.X + 0.5f, body.Y + 0.5f, body.Width - 1, body.Height - 1), 20);

        for (int i = 0; i < 16; i++)
        {
            var ar = Rectangle.Inflate(Rectangle.Union(CellRect(i), NameRect(i)), 8, 8);
            if (!e.ClipRectangle.IntersectsWith(ar)) continue;
            DrawCell(g, i, w.Cells[i]);
        }

        string cap = f.Shape == 4 ? "4인치 보드 · 4줄 × 4칸" : "7인치 보드 · 2줄 × 8칸";
        Theme.Text(g, cap, DeckFonts.Light(8.5f), Theme.Text3, new RectangleF(0, body.Bottom + 6, Width, 18), StringAlignment.Center);
    }

    void DrawCell(Graphics g, int i, DeckCell c)
    {
        bool none = c.Kind == "none", sel = i == f.Selected, hov = i == hover && dragFrom < 0, down = i == pressed;
        float rad = Radius;
        RectangleF r = CellRect(i);
        if (down) r.Offset(0, 1);
        var rr = new RectangleF(r.X + 0.5f, r.Y + 0.5f, r.Width - 1, r.Height - 1);

        if (none)
        {
            Theme.FillRound(g, Theme.Br(Theme.KeyEmpty), r, rad);
            if (actionDrag) Theme.DashedRound(g, rr, rad, Theme.A(Theme.DropTarget, 120), 1);
            else Theme.DashedRound(g, rr, rad, Theme.KeyEmptyEdge, 1);
            float len = cell * 0.22f, cx = r.X + r.Width / 2, cy = r.Y + r.Height / 2;
            var pen = Theme.Pn(hov ? Theme.Accent : Theme.Text3, 2);
            g.DrawLine(pen, cx - len / 2, cy, cx + len / 2, cy);
            g.DrawLine(pen, cx, cy - len / 2, cx, cy + len / 2);
            // 이름 자리 안에서만(옆 칸 이름과 안 겹치게). 칸이 작으면 짧게(디자인 검수 13)
            var er = NameRect(i); er.Inflate(0, 2);
            Theme.Text(g, cell < 64 ? "놓기" : "끌어다 놓기", DeckFonts.Light(8f), Theme.Text3, er, StringAlignment.Center);
        }
        else
        {
            int isz = IconSize;
            var img = IconFor(i, c.Tile, isz);
            if (!down) using (var sb = new SolidBrush(Color.FromArgb(90, 0, 0, 0))) Theme.FillRound(g, sb, new RectangleF(r.X, r.Y + 2, r.Width, r.Height), rad);
            using (var lg = new LinearGradientBrush(new RectangleF(r.X, r.Y - 1, r.Width, r.Height + 2), Theme.KeyTop, Theme.KeyBottom, LinearGradientMode.Vertical))
                Theme.FillRound(g, lg, r, rad);
            // 아이콘 그림에 이미 테두리가 있으니, 그림이 있는 칸은 칸 테두리·윗변 빛 줄을 빼서 '칸 안에 칸'처럼 보이지 않게(디자인 검수 3)
            if (img == null || hov) Theme.DrawRound(g, Theme.Pn(hov ? Theme.KeyEdgeHover : Theme.KeyEdge), rr, rad);
            if (img == null) g.DrawLine(Theme.Pn(Color.FromArgb(14, 255, 255, 255)), r.X + rad, r.Y + 1.5f, r.Right - rad, r.Y + 1.5f);
            if (img != null)
            {
                var old = g.InterpolationMode;
                g.InterpolationMode = InterpolationMode.NearestNeighbor;   // img 는 이미 isz 크기라 늘리지 않는다
                g.DrawImage(img, new Rectangle((int)(r.X + (r.Width - isz) / 2f), (int)(r.Y + (r.Height - isz) / 2f), isz, isz));
                g.InterpolationMode = old;
            }
            if (hov) using (var hb = new SolidBrush(Color.FromArgb(10, 255, 255, 255))) Theme.FillRound(g, hb, r, rad);
            if (down) using (var db = new SolidBrush(Color.FromArgb(40, 0, 0, 0))) Theme.FillRound(g, db, r, rad);
            // 이름 문제 점
            int lv = DeckForm.NameLevel(c.Name);
            float dd = cell < 48 ? 6 : 8;
            if (lv > 0)
            {
                g.FillEllipse(Theme.Br(Theme.Device), r.Right - 4 - dd - 1, r.Y + 3, dd + 2, dd + 2);
                g.FillEllipse(Theme.Br(lv == 2 ? Theme.Danger : Theme.Warn), r.Right - 4 - dd, r.Y + 4, dd, dd);
            }
            var nr = NameRect(i); nr.Inflate(0, 2);   // 글 줄 높이가 이름 자리보다 조금 커도 글이 사라지지 않게
            Theme.Text(g, c.Name, DeckFonts.Medium(f.Shape == 4 ? 8f : 9f), Theme.Text1, nr, StringAlignment.Center);
        }
        // 칸 번호: 작은 칸에서도 숨기지 않는다. 아이콘 위에서도 읽히게 어두운 작은 바탕을 깐다(디자인 검수 2)
        {
            var nf = DeckFonts.Light(7f);
            string num = (i + 1).ToString();
            float nw = Theme.TextWidth(g, num, nf);
            var nb = new RectangleF(r.X + 3, r.Y + 3, nw + 2, 13);
            if (!none) Theme.FillRound(g, Theme.Br(Color.FromArgb(190, Theme.Device)), nb, 4);
            Theme.Text(g, num, nf, Theme.A(Theme.Text3, 230), nb, StringAlignment.Center, StringAlignment.Center, false);
        }

        if (i == dragFrom)
        {   // 끌고 있는 원래 칸
            using (var fb = new SolidBrush(Color.FromArgb(165, Theme.Bg))) Theme.FillRound(g, fb, r, rad);
            Theme.DashedRound(g, rr, rad, Theme.Text3, 1);
        }
        if (sel)
        {
            Theme.DrawRound(g, Theme.Pn(Theme.Accent, 2), RectangleF.Inflate(r, 3, 3), rad + 3);
            // 키보드 초점이 보드에 있으면 바깥 링을 점선으로(화살표 키가 먹는 곳이라는 표시. UI 검수 11)
            if (Focused && ShowFocusCues) Theme.DashedRound(g, RectangleF.Inflate(r, 6, 6), rad + 6, Theme.AccentHover, 1.5f);
            else Theme.DrawRound(g, Theme.Pn(Theme.A(Theme.Accent, 40), 2), RectangleF.Inflate(r, 5, 5), rad + 5);
        }
        if (i == dropTarget)
        {
            using (var ob = new SolidBrush(Theme.A(Theme.DropTarget, 30))) Theme.FillRound(g, ob, r, rad);
            Theme.DrawRound(g, Theme.Pn(Theme.DropTarget, 2), RectangleF.Inflate(r, -1, -1), rad - 1);
            var wp = Theme.Pn(Color.FromArgb(200, 255, 255, 255), 2);
            float cx = r.X + r.Width / 2, cy = r.Y + r.Height / 2, s = Math.Max(8, cell * 0.14f);
            if (dropCopy)
            {
                g.DrawLine(wp, cx - s, cy, cx + s, cy); g.DrawLine(wp, cx, cy - s, cx, cy + s);
            }
            else if (dropSwap)
            {   // 좌우 화살표 두 개
                var b = Theme.Br(Color.FromArgb(200, 255, 255, 255));
                g.DrawLine(wp, cx - s, cy - s / 2.5f, cx + s * 0.6f, cy - s / 2.5f);
                Theme.Triangle(g, new RectangleF(cx + s * 0.5f, cy - s / 2.5f - 4, 6, 8), 0, b);
                g.DrawLine(wp, cx + s, cy + s / 2.5f, cx - s * 0.6f, cy + s / 2.5f);
                Theme.Triangle(g, new RectangleF(cx - s * 0.5f - 6, cy + s / 2.5f - 4, 6, 8), 2, b);
            }
        }
    }

    // ── 마우스 ──
    protected override void OnMouseDown(MouseEventArgs e)
    {
        Focus();
        int i = HitCell(e.Location);
        if (i >= 0)
        {
            f.SelectCell(i);
            if (e.Button == MouseButtons.Right) f.ShowCellMenu(this, e.Location);
            else if (e.Button == MouseButtons.Left) { downCell = i; downPt = e.Location; pressed = i; InvalidateCell(i); }
        }
        base.OnMouseDown(e);
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        int h = HitCell(e.Location);
        if (h != hover) { int o = hover; hover = h; InvalidateCell(o); InvalidateCell(h); Cursor = h >= 0 ? Cursors.Hand : Cursors.Default; }
        string t = h >= 0 || (hint && HintRect.Contains(e.Location)) ? "" : TipText;
        if (t != curTip) { curTip = t; tip.SetToolTip(this, t); }
        if (downCell >= 0 && e.Button == MouseButtons.Left && (Math.Abs(e.X - downPt.X) > 8 || Math.Abs(e.Y - downPt.Y) > 8))
        {
            int from = downCell; downCell = -1;
            pressed = -1; dragFrom = from; InvalidateCell(from);
            try { DoDragDrop(new DataObject("PeneduCell", from), DragDropEffects.Move | DragDropEffects.Copy); }
            finally { dragFrom = -1; dropTarget = -1; actionDrag = false; Invalidate(); }
        }
        base.OnMouseMove(e);
    }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        downCell = -1;
        if (pressed >= 0 && !pressTimer.Enabled) { int p = pressed; pressed = -1; InvalidateCell(p); }
        base.OnMouseUp(e);
    }
    protected override void OnMouseLeave(EventArgs e)
    {
        if (hover >= 0) { int o = hover; hover = -1; InvalidateCell(o); }
        base.OnMouseLeave(e);
    }

    // ── 끌어다 놓기(설계 11장) ──
    static string WebText(IDataObject d)
    {
        if (!d.GetDataPresent(DataFormats.UnicodeText)) return null;
        var t = (d.GetData(DataFormats.UnicodeText) as string ?? "").Trim();
        return t.StartsWith("http://") || t.StartsWith("https://") ? t : null;
    }

    void UpdateDrop(DragEventArgs e)
    {
        int i = HitCell(PointToClient(new Point(e.X, e.Y)));
        bool copy = false, swap = false;
        DragDropEffects eff = DragDropEffects.None;
        if (i >= 0)
        {
            if (e.Data.GetDataPresent("PeneduCell"))
            {
                int from = (int)e.Data.GetData("PeneduCell");
                if (i != from)
                {
                    if ((e.KeyState & 8) != 0) { eff = DragDropEffects.Copy; copy = true; }
                    else { eff = DragDropEffects.Move; swap = true; }
                }
            }
            else if (e.Data.GetDataPresent("PeneduAction")) eff = DragDropEffects.Copy;
            else if (e.Data.GetDataPresent(DataFormats.FileDrop)) eff = DragDropEffects.Copy;
            else if (WebText(e.Data) != null) eff = DragDropEffects.Copy;
        }
        e.Effect = eff;
        int t = eff == DragDropEffects.None ? -1 : i;
        if (t != dropTarget || copy != dropCopy || swap != dropSwap)
        {
            int o = dropTarget; dropTarget = t; dropCopy = copy; dropSwap = swap;
            InvalidateCell(o); InvalidateCell(t);
        }
    }

    protected override void OnDragEnter(DragEventArgs e)
    {
        bool a = e.Data.GetDataPresent("PeneduAction");
        if (a != actionDrag) { actionDrag = a; Invalidate(); }
        UpdateDrop(e);
        base.OnDragEnter(e);
    }
    protected override void OnDragOver(DragEventArgs e) { UpdateDrop(e); base.OnDragOver(e); }
    protected override void OnDragLeave(EventArgs e)
    {
        dropTarget = -1; actionDrag = false; Invalidate();
        base.OnDragLeave(e);
    }

    protected override void OnDragDrop(DragEventArgs e)
    {
        int i = HitCell(PointToClient(new Point(e.X, e.Y)));
        bool ctrl = (e.KeyState & 8) != 0, shift = (e.KeyState & 4) != 0;
        dropTarget = -1; actionDrag = false; Invalidate();
        base.OnDragDrop(e);
        if (i < 0) return;
        if (e.Data.GetDataPresent("PeneduCell"))
        {
            int from = (int)e.Data.GetData("PeneduCell");
            if (from == i) return;
            if (ctrl) f.CopyCell(from, i); else f.SwapCells(from, i);
            return;
        }
        if (e.Data.GetDataPresent("PeneduAction")) { f.ApplyAction(i, e.Data.GetData("PeneduAction") as string, shift); return; }
        string path = null;
        var files = e.Data.GetData(DataFormats.FileDrop) as string[];
        if (files != null && files.Length > 0) path = files[0];
        else path = WebText(e.Data);
        if (path == null) return;
        if (DeckForm.IsImage(path))
        {   // 그림 파일 → 아이콘만 바꾸기. 묻는 창은 놓기가 끝난 뒤에(탐색기가 멈추지 않게. UI 검수 4)
            int ci = i; string ip = path;
            BeginInvoke((Action)delegate { f.SetIconFromImage(ci, ip); });
            return;
        }
        f.FillFromPath(i, path, true);
        f.SelectCell(i);
        f.MarkDirty();
        f.Notify((i + 1) + "번 칸에 '" + f.Work.Cells[i].Name + "'을 넣었어요.");
    }

    // ── 키보드(설계 12장) ──
    protected override bool IsInputKey(Keys k)
    {
        Keys c = k & Keys.KeyCode;
        if (c == Keys.Left || c == Keys.Right || c == Keys.Up || c == Keys.Down || c == Keys.Enter) return true;
        return base.IsInputKey(k);
    }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        int s = f.Selected;
        bool done = true;
        if (e.KeyCode == Keys.Left && !e.Control) { if (s > 0) f.SelectCell(s - 1); }
        else if (e.KeyCode == Keys.Right && !e.Control) { if (s < 15) f.SelectCell(s + 1); }
        else if (e.KeyCode == Keys.Up) { if (s - cols >= 0) f.SelectCell(s - cols); }
        else if (e.KeyCode == Keys.Down) { if (s + cols <= 15) f.SelectCell(s + cols); }
        else if (e.KeyCode == Keys.Enter) f.TrySelected();
        else if (e.KeyCode == Keys.Delete) f.ClearCell(s);
        else if (e.KeyCode == Keys.C && e.Control) f.ClipCopy();
        else if (e.KeyCode == Keys.V && e.Control) f.ClipPaste();
        else if (e.KeyCode == Keys.F2) f.FocusName();
        else done = false;
        if (done) { e.Handled = true; e.SuppressKeyPress = true; return; }
        base.OnKeyDown(e);
    }
    protected override void OnGotFocus(EventArgs e) { InvalidateCell(f.Selected); base.OnGotFocus(e); }
    protected override void OnLostFocus(EventArgs e) { InvalidateCell(f.Selected); base.OnLostFocus(e); }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { scaledClear(); pressTimer.Dispose(); tip.Dispose(); }
        base.Dispose(disposing);
    }
}
