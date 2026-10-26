// DeckControls.cs — 직접 그리는 어두운 컨트롤: 단추(FlatButton), 이어 붙은 알약(Segmented), 둥근 입력칸(RoundBox),
// 아래 상태 띠(StatusBar), 얇은 스크롤(SlimScroll). 설계_도우미화면.md 6장. C# 5 문법만
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Text.RegularExpressions;
using System.Windows.Forms;

enum BtnStyle { Primary, Normal, Ghost, Danger }
enum BtnGlyph { None, Play, Down }
enum BoxState { Normal, Warn, Danger }

static class Paint0
{
    // 부모 바탕색(투명한 곳을 칠할 때)
    public static Color ParentBg(Control c)
    {
        for (var p = c.Parent; p != null; p = p.Parent) if (p.BackColor.A == 255) return p.BackColor;
        return Theme.Panel;
    }
}

class FlatButton : Control
{
    BtnStyle style = BtnStyle.Normal; BtnGlyph glyph = BtnGlyph.None;
    bool dot, hover, down;
    public ContextMenuStrip DropMenu;
    public Color Under = Color.Empty;   // 단추 뒤 바탕색(비우면 부모 색)

    public FlatButton()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
        SetStyle(ControlStyles.StandardDoubleClick, false);
        Font = DeckFonts.Medium(9.5f);
        Cursor = Cursors.Hand;
        TabStop = true;
        Size = new Size(120, 32);
    }

    public BtnStyle Style { get { return style; } set { style = value; Invalidate(); } }
    public BtnGlyph Glyph { get { return glyph; } set { glyph = value; Invalidate(); } }
    public bool Dot { get { return dot; } set { if (dot != value) { dot = value; Invalidate(); } } }

    protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hover = false; down = false; Invalidate(); base.OnMouseLeave(e); }
    // 누르면 초점을 가져온다: 입력칸의 Leave(주소 앞 https:// 붙이기 등)가 저장 전에 돌게(UI 검수 6)
    protected override void OnMouseDown(MouseEventArgs e) { if (e.Button == MouseButtons.Left) { if (CanFocus) Focus(); down = true; Invalidate(); } base.OnMouseDown(e); }
    protected override void OnMouseUp(MouseEventArgs e) { if (down) { down = false; Invalidate(); } base.OnMouseUp(e); }
    protected override void OnTextChanged(EventArgs e) { Invalidate(); base.OnTextChanged(e); }
    protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }
    protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
    protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
    protected override bool IsInputKey(Keys k) { return k == Keys.Enter || k == Keys.Space || base.IsInputKey(k); }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Enter || e.KeyCode == Keys.Space) { e.Handled = true; e.SuppressKeyPress = true; PerformClick(); return; }
        base.OnKeyDown(e);
    }
    public void PerformClick() { if (Enabled) OnClick(EventArgs.Empty); }
    protected override void OnClick(EventArgs e)
    {
        base.OnClick(e);
        if (DropMenu != null && Enabled) DropMenu.Show(this, new Point(0, Height + 2));
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        Color under = Under != Color.Empty ? Under : Paint0.ParentBg(this);
        g.Clear(under);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var r = new RectangleF(0.5f, 0.5f, Width - 1, Height - 1);
        bool on = Enabled;
        bool onRaised = under.ToArgb() == Theme.Raised.ToArgb();
        Color bg = Color.Empty, fg = Theme.Text1;
        Color border = Color.Empty;
        switch (style)
        {
            case BtnStyle.Primary:
                bg = !on ? Theme.A(Theme.Accent, 90) : down ? Theme.AccentDown : hover ? Theme.AccentHover : Theme.Accent;
                fg = on ? Color.White : Theme.A(Color.White, 150);
                break;
            case BtnStyle.Normal:
                bg = !on ? Theme.Raised : down ? Theme.BtnDown : hover ? Theme.BtnHover : Theme.Raised;
                fg = on ? Theme.Text1 : Theme.Text3;
                break;
            case BtnStyle.Ghost:
                bg = !on ? Color.Empty : down ? Theme.BtnDown : hover ? (onRaised ? Theme.BtnHover : Theme.Raised) : Color.Empty;
                fg = on ? (hover ? Theme.Text1 : Theme.Text2) : Theme.Text3;
                break;
            case BtnStyle.Danger:
                bg = !on ? Color.Empty : down ? Theme.A(Theme.Danger, 70) : hover ? Theme.A(Theme.Danger, 40) : Color.Empty;
                border = on ? Theme.A(Theme.Danger, 120) : Theme.A(Theme.Text3, 90);
                fg = on ? (hover ? Theme.DangerHover : Theme.Danger) : Theme.Text3;
                break;
        }
        if (bg != Color.Empty) Theme.FillRound(g, Theme.Br(bg), r, 6);
        if (border != Color.Empty) Theme.DrawRound(g, Theme.Pn(border), r, 6);

        float dy = down ? 1 : 0;
        float tw = Theme.TextWidth(Text, Font);
        float right = glyph == BtnGlyph.Down ? Width - 18 : Width;
        float lead = 0;
        if (glyph == BtnGlyph.Play) lead = 12 + 8;
        if (dot) lead += 6 + 8;
        float total = lead + tw;
        float x = Math.Max(glyph == BtnGlyph.Down ? 8 : 6, (right - total) / 2f);
        if (dot)
        {
            g.FillEllipse(Theme.Br(fg), x, Height / 2f - 3 + dy, 6, 6);
            x += 14;
        }
        if (glyph == BtnGlyph.Play)
        {
            Theme.Triangle(g, new RectangleF(x + 1, Height / 2f - 6 + dy, 10, 12), 0, Theme.Br(fg));
            x += 20;
        }
        Theme.Text(g, Text, Font, fg, new RectangleF(x, dy, Math.Max(10, right - x), Height), StringAlignment.Near);
        if (glyph == BtnGlyph.Down)
            Theme.Triangle(g, new RectangleF(Width - 8 - 6 - 2, Height / 2f - 2 + dy, 7, 4.5f), 1, Theme.Br(on ? Theme.Text2 : Theme.Text3));
        if (Focused && ShowFocusCues)
            Theme.DrawRound(g, Theme.Pn(Theme.AccentHover), new RectangleF(2.5f, 2.5f, Width - 6, Height - 6), 4);
    }
}

// 이어 붙은 알약: 하는 일 5개, 7인치/4인치
class Segmented : Control
{
    string[] items = new string[0];
    int selected = -1, hover = -1, keyIdx = -1;
    public bool[] ItemEnabled;
    public bool Pill;
    public event Action<int> Picked;   // 사람이 눌렀을 때만(코드로 SelectedIndex 를 바꿀 땐 안 부름)

    public Segmented()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
        SetStyle(ControlStyles.StandardDoubleClick, false);
        Font = DeckFonts.Medium(9.5f);
        Cursor = Cursors.Hand;
        TabStop = true;
        Height = 28;
    }

    public string[] Items { get { return items; } set { items = value ?? new string[0]; ItemEnabled = null; Invalidate(); } }
    public int SelectedIndex { get { return selected; } set { if (selected != value) { selected = value; Invalidate(); } } }
    bool On(int i) { return Enabled && (ItemEnabled == null || i >= ItemEnabled.Length || ItemEnabled[i]); }

    // 칸 폭: 글자 폭 + 24(모자라면 줄임, 남으면 고르게 늘림)
    RectangleF[] Cells()
    {
        int n = items.Length;
        var res = new RectangleF[n];
        if (n == 0) return res;
        float[] tw = new float[n];
        float sum = 0;
        for (int i = 0; i < n; i++) { tw[i] = Theme.TextWidth(items[i], Font); sum += tw[i]; }
        float gaps = 2 * (n - 1) + 4;
        float pad = (Width - gaps - sum) / n;      // 남으면 고르게 늘림
        if (pad < 6) pad = 6;
        float k = 1, need = sum + pad * n;
        if (need > Width - gaps) k = (Width - gaps) / need;   // 넘치면 비율로 줄임
        float x = 2;
        for (int i = 0; i < n; i++)
        {
            float w = (tw[i] + pad) * k;
            res[i] = new RectangleF(x, 2, w, Height - 4);
            x += w + 2;
        }
        return res;
    }

    // 글자 폭 + 24 씩 쓴 폭
    public int NaturalWidth
    {
        get
        {
            float s = 4 + 2 * Math.Max(0, items.Length - 1);
            foreach (var t in items) s += Theme.TextWidth(t, Font) + 24;
            return (int)Math.Ceiling(s);
        }
    }

    int Hit(Point p)
    {
        var c = Cells();
        for (int i = 0; i < c.Length; i++) if (p.X >= c[i].Left - 1 && p.X < c[i].Right + 1) return i;
        return -1;
    }

    protected override void OnMouseMove(MouseEventArgs e) { int h = Hit(e.Location); if (h != hover) { hover = h; Invalidate(); } base.OnMouseMove(e); }
    protected override void OnMouseLeave(EventArgs e) { hover = -1; Invalidate(); base.OnMouseLeave(e); }
    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (e.Button != MouseButtons.Left) return;
        if (CanFocus) Focus();   // 마우스로 고른 뒤 ←→ 키도 먹게(UI 검수 6)
        int i = Hit(e.Location);
        if (i >= 0 && On(i)) Pick(i);
    }
    void Pick(int i)
    {
        selected = i; keyIdx = i; Invalidate();
        if (Picked != null) Picked(i);
    }
    protected override bool IsInputKey(Keys k) { return k == Keys.Left || k == Keys.Right || base.IsInputKey(k); }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Left || e.KeyCode == Keys.Right)
        {
            int d = e.KeyCode == Keys.Left ? -1 : 1, i = selected < 0 ? (d > 0 ? -1 : items.Length) : selected;
            for (int k = 0; k < items.Length; k++) { i += d; if (i < 0 || i >= items.Length) break; if (On(i)) { Pick(i); break; } }
            e.Handled = true; return;
        }
        base.OnKeyDown(e);
    }
    protected override void OnGotFocus(EventArgs e) { Invalidate(); base.OnGotFocus(e); }
    protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }
    protected override void OnEnabledChanged(EventArgs e) { Invalidate(); base.OnEnabledChanged(e); }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Paint0.ParentBg(this));
        g.SmoothingMode = SmoothingMode.AntiAlias;
        float rad = Pill ? Height / 2f : 6;
        var all = new RectangleF(0.5f, 0.5f, Width - 1, Height - 1);
        Theme.FillRound(g, Theme.BrRaised, all, rad);
        var c = Cells();
        for (int i = 0; i < c.Length; i++)
        {
            bool on = On(i), sel = i == selected;
            float ir = Pill ? c[i].Height / 2f : 5;
            if (sel) Theme.FillRound(g, Theme.Br(Enabled ? Theme.Accent : Theme.A(Theme.Accent, 90)), c[i], ir);
            else if (i == hover && on) Theme.FillRound(g, Theme.Br(Theme.BtnHover), c[i], ir);
            Color fg = sel ? Color.White : !on ? Theme.Text3 : Theme.Text1;
            Theme.Text(g, items[i], Font, fg, new RectangleF(c[i].X, c[i].Y, c[i].Width, c[i].Height), StringAlignment.Center);
        }
        if (Focused && ShowFocusCues) Theme.DashedRound(g, all, rad, Theme.AccentHover, 1);
    }
}

// 둥근 바탕 안에 TextBox 하나
class RoundBox : Control
{
    public readonly TextBox Box = new TextBox();
    bool hover, multiline;
    BoxState state = BoxState.Normal;
    string placeholder = "";
    public int LeftPad = 10;
    public bool ShowClear;

    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, string l);

    public RoundBox()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        Box.BorderStyle = BorderStyle.None;
        Box.BackColor = Theme.Raised;
        Box.ForeColor = Theme.Text1;
        Box.Font = DeckFonts.Regular(9.5f);
        Controls.Add(Box);
        Cursor = Cursors.IBeam;
        Height = 32;
        EventHandler inv = delegate { Invalidate(); };
        Box.GotFocus += inv; Box.LostFocus += inv;
        Box.MouseEnter += delegate { hover = true; Invalidate(); };
        Box.MouseLeave += delegate { hover = ClientRectangle.Contains(PointToClient(MousePosition)); Invalidate(); };
        Box.TextChanged += delegate { if (ShowClear) Invalidate(); };
        Box.HandleCreated += delegate { Theme.GdiFont(Box); ApplyCue(); if (multiline) Theme.DarkScroll(Box); };
        Box.FontChanged += delegate { Theme.GdiFont(Box); };
    }

    public BoxState State { get { return state; } set { if (state != value) { state = value; Invalidate(); } } }
    public string Placeholder { get { return placeholder; } set { placeholder = value ?? ""; ApplyCue(); } }
    public bool Multiline
    {
        get { return multiline; }
        set { multiline = value; Box.Multiline = value; Box.ScrollBars = value ? ScrollBars.Vertical : ScrollBars.None; Box.AcceptsReturn = value; LayoutBox(); if (value && Box.IsHandleCreated) Theme.DarkScroll(Box); }
    }
    void ApplyCue()
    {
        if (!Box.IsHandleCreated || multiline) return;
        try { SendMessage(Box.Handle, 0x1501, (IntPtr)1, placeholder); } catch { }
    }

    protected override void OnResize(EventArgs e) { base.OnResize(e); LayoutBox(); }
    void LayoutBox()
    {
        int right = ShowClear ? 28 : 10;
        if (multiline) Box.SetBounds(LeftPad, 7, Math.Max(10, Width - LeftPad - 4), Math.Max(10, Height - 12));
        else Box.SetBounds(LeftPad, Math.Max(0, (Height - Box.Height) / 2), Math.Max(10, Width - LeftPad - right), Box.Height);
    }
    protected override void OnMouseEnter(EventArgs e) { hover = true; Invalidate(); base.OnMouseEnter(e); }
    protected override void OnMouseLeave(EventArgs e) { hover = false; Invalidate(); base.OnMouseLeave(e); }
    Rectangle ClearRect { get { return new Rectangle(Width - 26, Height / 2 - 8, 16, 16); } }
    protected override void OnMouseMove(MouseEventArgs e)
    {
        Cursor = ShowClear && Box.Text.Length > 0 && ClearRect.Contains(e.Location) ? Cursors.Hand : Cursors.IBeam;
        base.OnMouseMove(e);
    }
    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (ShowClear && Box.Text.Length > 0 && ClearRect.Contains(e.Location)) Box.Text = "";
        Box.Focus();
    }
    protected override void OnEnabledChanged(EventArgs e)
    {
        base.OnEnabledChanged(e);
        Box.ForeColor = Enabled ? Theme.Text1 : Theme.Text3;
        Box.BackColor = Enabled ? Theme.Raised : DisabledBg();
        Invalidate();
    }

    // 꺼진 바탕 = 부모 바탕 위에 Raised 를 반쯤 덮은 색(안의 TextBox 도 같은 색으로)
    Color DisabledBg()
    {
        Color p = Paint0.ParentBg(this), q = Theme.Raised;
        const int a = 110;
        return Color.FromArgb((q.R * a + p.R * (255 - a)) / 255, (q.G * a + p.G * (255 - a)) / 255, (q.B * a + p.B * (255 - a)) / 255);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Paint0.ParentBg(this));
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var r = new RectangleF(0.5f, 0.5f, Width - 1, Height - 1);
        // 꺼진 입력칸은 바탕을 흐리게(켜진 것과 구별. 디자인 검수 10)
        Theme.FillRound(g, Enabled ? Theme.BrRaised : Theme.Br(Theme.A(Theme.Raised, 110)), r, 6);
        Color b = !Enabled ? Color.Empty : state == BoxState.Danger ? Theme.Danger : state == BoxState.Warn ? Theme.Warn
            : Box.Focused ? Theme.Accent : hover && Enabled ? Theme.Line : Color.Empty;
        if (b != Color.Empty) Theme.DrawRound(g, Theme.Pn(b), r, 6);
        if (LeftPad >= 30)
        {   // 돋보기
            var pen = Theme.Pn(Theme.Text3, 1.5f);
            float cy = Height / 2f;
            g.DrawEllipse(pen, 11, cy - 7, 10, 10);
            g.DrawLine(pen, 19.5f, cy + 1.5f, 23.5f, cy + 5.5f);
        }
        if (ShowClear && Box.Text.Length > 0)
        {
            var cr = ClearRect;
            var pen = Theme.Pn(Theme.Text2, 1.5f);
            g.DrawLine(pen, cr.X + 4, cr.Y + 4, cr.Right - 4, cr.Bottom - 4);
            g.DrawLine(pen, cr.Right - 4, cr.Y + 4, cr.X + 4, cr.Bottom - 4);
        }
    }
}

// 아래 띠: 연결 점 + 상태 글 + 진행 막대 + [닫기] [저장하고 보드에 보내기]
class StatusBar : Control
{
    public readonly FlatButton BtnClose = new FlatButton(), BtnSave = new FlatButton();
    string msg = "";
    float progress = -1;
    bool progressDone, blinkOn = true;
    readonly Timer blink = new Timer(), doneTimer = new Timer();

    public StatusBar()
    {
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw, true);
        BackColor = Theme.Bg;
        Height = 56;
        BtnClose.Text = "닫기"; BtnClose.Style = BtnStyle.Normal; BtnClose.Size = new Size(96, 36);
        BtnSave.Text = "저장하고 보드에 보내기"; BtnSave.Style = BtnStyle.Primary; BtnSave.Size = new Size(220, 40);
        Controls.Add(BtnClose); Controls.Add(BtnSave);
        blink.Interval = 500;
        blink.Tick += delegate { blinkOn = !blinkOn; Invalidate(new Rectangle(0, 0, 40, Height)); };
        doneTimer.Interval = 1500;
        doneTimer.Tick += delegate { doneTimer.Stop(); progress = -1; progressDone = false; Invalidate(); };
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        BtnSave.Location = new Point(Width - 16 - BtnSave.Width, (Height - BtnSave.Height) / 2);
        BtnClose.Location = new Point(BtnSave.Left - 8 - BtnClose.Width, (Height - BtnClose.Height) / 2);
    }

    bool Busy { get { return msg.Contains("확인하는 중") || msg.Contains("보내는 중") || msg.Contains("찾는") || msg.Contains("되돌리는 중"); } }

    public string Message
    {
        get { return msg; }
        set
        {
            value = value ?? "";
            if (value == msg) return;
            msg = value;
            var m = Regex.Match(msg, @"(\d+)\s*/\s*(\d+)");
            if (msg.Contains("보냈어요") && progress >= 0) { progress = 1; progressDone = true; doneTimer.Stop(); doneTimer.Start(); }
            else if (m.Success && msg.Contains("보내는 중"))
            {
                float a = float.Parse(m.Groups[1].Value), b = float.Parse(m.Groups[2].Value);
                progress = b > 0 ? Math.Min(1, a / b) : 0; progressDone = false;
            }
            else if (msg.Contains("설정 보내는 중")) { progress = Math.Max(progress, 0.97f); progressDone = false; }
            else if (!progressDone) progress = -1;
            if (Busy) { if (!blink.Enabled) blink.Start(); } else { blink.Stop(); blinkOn = true; }
            Invalidate();
        }
    }

    public float Progress { get { return progress; } set { progress = value; Invalidate(); } }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { blink.Dispose(); doneTimer.Dispose(); }
        base.Dispose(disposing);
    }

    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Theme.Bg);
        g.DrawLine(Theme.PenLine, 0, 0, Width, 0);
        g.SmoothingMode = SmoothingMode.AntiAlias;
        Color dot = msg.Contains("연결됨") || msg.Contains("보냈어요") ? Theme.Ok : Busy ? (blinkOn ? Theme.Warn : Theme.A(Theme.Warn, 70)) : Theme.Text3;
        bool bar = progress >= 0;
        float textTop = bar ? 8 : 6, textH = bar ? 26 : Height - 12;
        g.FillEllipse(Theme.Br(dot), 16, (bar ? textTop + textH / 2f : Height / 2f) - 4, 8, 8);
        float right = BtnClose.Left - 16;
        Theme.Text(g, msg, DeckFonts.Regular(9f), Theme.Text2, new RectangleF(32, textTop, Math.Max(20, right - 32), textH),
            StringAlignment.Near, StringAlignment.Center, true);
        if (bar)
        {
            var track = new RectangleF(32, textTop + textH + 6, 200, 4);
            Theme.FillRound(g, Theme.BrRaised, track, 2);
            var fill = new RectangleF(track.X, track.Y, Math.Max(4, track.Width * progress), 4);
            Theme.FillRound(g, Theme.Br(progressDone ? Theme.Ok : Theme.Accent), fill, 2);
        }
    }
}

// 직접 그리는 목록용 얇은 스크롤(컨트롤 아님): 위치 계산·부드러운 휠·손잡이 끌기·그리기
class SlimScroll
{
    readonly Control owner;
    readonly Timer anim = new Timer();
    public int Content, View;
    public float Pos, Target;
    public bool HoverList, HoverThumb, Dragging;
    float dragStartY, dragStartPos;

    public SlimScroll(Control c)
    {
        owner = c;
        anim.Interval = 16;
        anim.Tick += delegate
        {
            float d = Target - Pos;
            if (Math.Abs(d) < 1) { Pos = Target; anim.Stop(); }
            else Pos += d * 0.4f;
            owner.Invalidate();
        };
    }

    public float Max { get { return Math.Max(0, Content - View); } }
    public bool Needed { get { return Content > View; } }
    float Clamp(float v) { return Math.Max(0, Math.Min(Max, v)); }

    public void Wheel(int delta) { Target = Clamp(Target - delta / 120f * 108f); anim.Start(); }
    public void ScrollTo(float t, bool smooth) { Target = Clamp(t); if (smooth) anim.Start(); else { Pos = Target; anim.Stop(); owner.Invalidate(); } }
    public void Fix() { Target = Clamp(Target); Pos = Clamp(Pos); }
    public void Stop() { anim.Stop(); }

    float W { get { return Dragging || HoverThumb ? 10 : HoverList ? 8 : 6; } }
    public RectangleF Track(Rectangle area) { return new RectangleF(area.Right - 4 - W, area.Top + 2, W, area.Height - 4); }
    public RectangleF Thumb(Rectangle area)
    {
        var t = Track(area);
        if (!Needed) return RectangleF.Empty;
        float h = Math.Max(32, t.Height * View / (float)Content);
        float y = t.Top + (t.Height - h) * (Max <= 0 ? 0 : Pos / Max);
        return new RectangleF(t.X, y, t.Width, h);
    }
    public bool OnThumbArea(Rectangle area, Point p)
    {
        if (!Needed) return false;
        return p.X >= area.Right - 16 && p.Y >= area.Top && p.Y < area.Bottom;
    }
    public bool MouseDown(Rectangle area, Point p)
    {
        if (!OnThumbArea(area, p)) return false;
        var th = Thumb(area);
        if (p.Y < th.Top || p.Y > th.Bottom)
        {   // 길을 누르면 그 자리로
            var t = Track(area);
            ScrollTo((p.Y - t.Top - th.Height / 2) / Math.Max(1, t.Height - th.Height) * Max, true);
            th = Thumb(area);
        }
        Dragging = true; dragStartY = p.Y; dragStartPos = Target;
        owner.Capture = true;
        return true;
    }
    public bool MouseMove(Rectangle area, Point p)
    {
        if (Dragging)
        {
            var t = Track(area); var th = Thumb(area);
            float span = Math.Max(1, t.Height - th.Height);
            ScrollTo(dragStartPos + (p.Y - dragStartY) / span * Max, false);
            return true;
        }
        bool hl = area.Contains(p), ht = OnThumbArea(area, p);
        if (hl != HoverList || ht != HoverThumb) { HoverList = hl; HoverThumb = ht; owner.Invalidate(); }
        return false;
    }
    public void MouseUp() { if (Dragging) { Dragging = false; owner.Capture = false; owner.Invalidate(); } }
    public void MouseLeave() { if (HoverList || HoverThumb) { HoverList = false; HoverThumb = false; owner.Invalidate(); } }

    public void Paint(Graphics g, Rectangle area)
    {
        if (!Needed) return;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var t = Track(area);
        Theme.FillRound(g, Theme.Br(Color.FromArgb(6, 255, 255, 255)), t, t.Width / 2);
        var th = Thumb(area);
        Theme.FillRound(g, Theme.Br(Dragging || HoverThumb ? Theme.ThumbHover : Theme.Thumb), th, th.Width / 2);
    }
}
