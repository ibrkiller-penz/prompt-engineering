// DeckTheme.cs — '단축키 꾸미기' 창의 색·붓·둥근 모양·글자 그리기, 창 설정 기억(deckform.ini), 어두운 메뉴·풍선 도움말. C# 5 문법만
// 설계_도우미화면.md 2~4장, 6장(DarkMenuRenderer·DarkTip), 14장(DeckPrefs)
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Windows.Forms;

static class Theme
{
    static Color C(int r, int g, int b) { return Color.FromArgb(r, g, b); }

    public static readonly Color Bg = C(18, 21, 28), Panel = C(26, 30, 39), Raised = C(35, 40, 53), Line = C(42, 48, 64);
    public static readonly Color Device = C(12, 14, 19), DeviceEdge = C(46, 52, 69);
    public static readonly Color Key = C(30, 34, 44), KeyTop = C(35, 40, 54), KeyBottom = C(27, 31, 40), KeyEdge = C(48, 54, 74), KeyEdgeHover = C(60, 68, 89);
    public static readonly Color KeyEmpty = C(22, 25, 32), KeyEmptyEdge = C(53, 59, 77);
    public static readonly Color Accent = C(90, 140, 255), AccentHover = C(122, 162, 255), AccentDown = C(70, 115, 224);
    public static readonly Color AccentSoft = Color.FromArgb(40, 90, 140, 255);
    public static readonly Color DropTarget = C(52, 195, 160);
    public static readonly Color Text1 = C(233, 237, 245), Text2 = C(166, 175, 194), Text3 = C(132, 141, 165);   // Text3: Raised 위 4.6:1(디자인 검수 1)
    public static readonly Color Danger = C(229, 72, 77), DangerHover = C(255, 138, 141), Warn = C(245, 166, 35), Ok = C(16, 163, 127);
    public static readonly Color Thumb = C(54, 61, 80), ThumbHover = C(74, 83, 108);
    public static readonly Color BtnHover = C(44, 50, 67), BtnDown = C(31, 36, 48);

    // 붓·펜은 색마다 한 번만 만들어 프로그램 끝까지 쓴다(설계 0장 23)
    static readonly Dictionary<int, SolidBrush> brushes = new Dictionary<int, SolidBrush>();
    static readonly Dictionary<long, Pen> pens = new Dictionary<long, Pen>();
    public static SolidBrush Br(Color c)
    {
        SolidBrush b;
        int k = c.ToArgb();
        if (!brushes.TryGetValue(k, out b)) { b = new SolidBrush(c); brushes[k] = b; }
        return b;
    }
    public static Pen Pn(Color c, float w)
    {
        Pen p;
        long k = ((long)c.ToArgb() << 16) ^ (long)(w * 100);
        if (!pens.TryGetValue(k, out p)) { p = new Pen(c, w); pens[k] = p; }
        return p;
    }
    public static Pen Pn(Color c) { return Pn(c, 1f); }
    public static Color A(Color c, int alpha) { return Color.FromArgb(alpha, c.R, c.G, c.B); }

    public static SolidBrush BrBg { get { return Br(Bg); } }
    public static SolidBrush BrPanel { get { return Br(Panel); } }
    public static SolidBrush BrRaised { get { return Br(Raised); } }
    public static Pen PenLine { get { return Pn(Line); } }

    // 둥근 사각형 길(반지름 0 이하이면 그냥 사각형)
    public static GraphicsPath Round(RectangleF r, float rad)
    {
        var p = new GraphicsPath();
        if (rad <= 0 || r.Width <= 0 || r.Height <= 0) { p.AddRectangle(r); return p; }
        float d = Math.Min(rad * 2, Math.Min(r.Width, r.Height));
        p.AddArc(r.X, r.Y, d, d, 180, 90);
        p.AddArc(r.Right - d, r.Y, d, d, 270, 90);
        p.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90);
        p.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }
    public static void FillRound(Graphics g, Brush b, RectangleF r, float rad) { using (var p = Round(r, rad)) g.FillPath(b, p); }
    public static void DrawRound(Graphics g, Pen pen, RectangleF r, float rad) { using (var p = Round(r, rad)) g.DrawPath(pen, p); }
    public static void DashedRound(Graphics g, RectangleF r, float rad, Color c, float w)
    {
        using (var pen = new Pen(c, w)) { pen.DashPattern = new float[] { 3, 3 }; using (var p = Round(r, rad)) g.DrawPath(pen, p); }
    }

    // 직접 그리는 글자는 모두 여기로(DrawString + AntiAliasGridFit, 설계 3장 규칙 2)
    // 모든 크기에서 격자 맞춤(GridFit)을 끈다: 작은 글은 GridFit 이 획을 지우고(예: '놓으세요'의 ㅡ), 큰 제목은 획이 1px 로 맞춰져 가늘고 계단처럼 보인다(디자인 검수 5)
    public static TextRenderingHint Hint(Font f) { return TextRenderingHint.AntiAlias; }

    public static void Text(Graphics g, string s, Font f, Color c, RectangleF r, StringAlignment h, StringAlignment v, bool wrap)
    {
        if (string.IsNullOrEmpty(s)) return;
        g.TextRenderingHint = Hint(f);
        using (var sf = new StringFormat())
        {
            sf.Alignment = h; sf.LineAlignment = v;
            sf.Trimming = StringTrimming.EllipsisCharacter;
            if (!wrap) sf.FormatFlags |= StringFormatFlags.NoWrap;
            sf.FormatFlags |= StringFormatFlags.LineLimit;
            g.DrawString(s, f, Br(c), r, sf);
        }
    }
    public static void Text(Graphics g, string s, Font f, Color c, RectangleF r, StringAlignment h)
    {
        Text(g, s, f, c, r, h, StringAlignment.Center, false);
    }
    public static void Text(Graphics g, string s, Font f, Color c, RectangleF r)
    {
        Text(g, s, f, c, r, StringAlignment.Near, StringAlignment.Center, false);
    }

    // 글자 폭(그리기와 같은 방식으로 잼)
    static Bitmap measureBmp; static Graphics measureG;
    public static float TextWidth(string s, Font f)
    {
        if (string.IsNullOrEmpty(s)) return 0;
        if (measureG == null) { measureBmp = new Bitmap(1, 1); measureG = Graphics.FromImage(measureBmp); }
        return TextWidth(measureG, s, f);
    }
    // Text() 로 그릴 때 차지하는 폭(DrawString 의 앞뒤 여백 포함)
    public static float TextWidth(Graphics g, string s, Font f)
    {
        if (string.IsNullOrEmpty(s)) return 0;
        using (var sf = new StringFormat())
        {
            sf.FormatFlags |= StringFormatFlags.NoWrap;
            var old = g.TextRenderingHint;
            g.TextRenderingHint = Hint(f);
            float w = g.MeasureString(s, f, PointF.Empty, sf).Width;
            g.TextRenderingHint = old;
            return w;
        }
    }
    // 글자를 붙여 그리기(찾은 글자 색칠용) — x 에서 시작, 다음 x 를 돌려준다
    public static float TextRun(Graphics g, string s, Font f, Color c, float x, RectangleF row)
    {
        if (string.IsNullOrEmpty(s)) return x;
        g.TextRenderingHint = Hint(f);
        using (var sf = new StringFormat(StringFormat.GenericTypographic))
        {
            sf.FormatFlags |= StringFormatFlags.MeasureTrailingSpaces | StringFormatFlags.NoWrap;
            sf.LineAlignment = StringAlignment.Center;
            float w = g.MeasureString(s, f, PointF.Empty, sf).Width;
            g.DrawString(s, f, Br(c), new RectangleF(x, row.Y, w + 2, row.Height), sf);
            return x + w;
        }
    }

    // 세모(글자 대신 그림). dir: 0 오른쪽, 1 아래, 2 왼쪽, 3 위
    public static void Triangle(Graphics g, RectangleF r, int dir, Brush b)
    {
        PointF[] p;
        if (dir == 0) p = new[] { new PointF(r.Left, r.Top), new PointF(r.Right, r.Top + r.Height / 2), new PointF(r.Left, r.Bottom) };
        else if (dir == 1) p = new[] { new PointF(r.Left, r.Top), new PointF(r.Right, r.Top), new PointF(r.Left + r.Width / 2, r.Bottom) };
        else if (dir == 2) p = new[] { new PointF(r.Right, r.Top), new PointF(r.Left, r.Top + r.Height / 2), new PointF(r.Right, r.Bottom) };
        else p = new[] { new PointF(r.Left, r.Bottom), new PointF(r.Right, r.Bottom), new PointF(r.Left + r.Width / 2, r.Top) };
        var old = g.SmoothingMode;
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.FillPolygon(b, p);
        g.SmoothingMode = old;
    }

    // 메뉴 그림용 작은 세모(눌러 보기)
    public static Bitmap PlayImage(int size, Color c)
    {
        var b = new Bitmap(size, size);
        using (var g = Graphics.FromImage(b)) Triangle(g, new RectangleF(size * 0.28f, size * 0.2f, size * 0.5f, size * 0.6f), 0, Br(c));
        return b;
    }

    // 어두운 창 제목 띠(윈도 10 1809 이상 19, 20H1 이상 20). 실패하면 그냥 둔다
    [DllImport("dwmapi.dll")] static extern int DwmSetWindowAttribute(IntPtr hwnd, int attr, ref int val, int size);
    public static void DarkTitle(IntPtr h)
    {
        try
        {
            int one = 1;
            if (DwmSetWindowAttribute(h, 20, ref one, 4) != 0) DwmSetWindowAttribute(h, 19, ref one, 4);
        }
        catch { }
    }

    [DllImport("uxtheme.dll", CharSet = CharSet.Unicode)] static extern int SetWindowTheme(IntPtr hwnd, string app, string idList);
    public static void DarkScroll(Control c)
    {
        try { SetWindowTheme(c.Handle, "DarkMode_Explorer", null); } catch { }
    }

    // 입력칸(TextBox)은 GDI 로 글자를 그린다. 에스코어 드림 4 Regular 는 글꼴 파일의 굵기 값이 200 이라
    // 보통 굵기(400)로 달라고 하면 윈도가 일부러 굵게 칠한다 -> 파일과 같은 굵기로 HFONT 를 만들어 WM_SETFONT 로 준다
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    class LOGFONT
    {
        public int lfHeight, lfWidth, lfEscapement, lfOrientation, lfWeight;
        public byte lfItalic, lfUnderline, lfStrikeOut, lfCharSet, lfOutPrecision, lfClipPrecision, lfQuality, lfPitchAndFamily;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string lfFaceName;
    }
    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)] static extern IntPtr CreateFontIndirect(LOGFONT lf);
    [DllImport("user32.dll")] static extern IntPtr SendMessage(IntPtr h, int msg, IntPtr w, IntPtr l);
    [DllImport("gdi32.dll")] static extern IntPtr CreateCompatibleDC(IntPtr hdc);
    [DllImport("gdi32.dll")] static extern bool DeleteDC(IntPtr hdc);
    [DllImport("gdi32.dll")] static extern IntPtr SelectObject(IntPtr hdc, IntPtr obj);
    [DllImport("gdi32.dll", CharSet = CharSet.Unicode)] static extern int GetTextFace(IntPtr hdc, int n, StringBuilder name);
    static readonly Dictionary<string, IntPtr> hfonts = new Dictionary<string, IntPtr>();
    /// <summary>입력칸 글꼴: 달라고 한 이름 → 윈도가 실제로 고른 이름(미리보기 preview.txt 에 남긴다. 디자인 검수 12)</summary>
    public static string GdiFaceLog = "";

    static string RealFace(IntPtr hfont)
    {
        IntPtr dc = CreateCompatibleDC(IntPtr.Zero);
        if (dc == IntPtr.Zero) return "?";
        try
        {
            IntPtr old = SelectObject(dc, hfont);
            var sb = new StringBuilder(64);
            GetTextFace(dc, 64, sb);
            SelectObject(dc, old);
            return sb.ToString();
        }
        finally { DeleteDC(dc); }
    }
    public static void GdiFont(Control c)
    {
        try
        {
            if (c == null || !c.IsHandleCreated) return;
            var f = c.Font;
            string fam = f.FontFamily.Name;
            int w = fam.Contains(" 3 ") ? 300 : fam.Contains(" 4 ") ? 200 : fam.Contains(" 5 ") ? 500 : -1;   // 글꼴 파일(OS/2)의 굵기 값
            if (w < 0) return;   // 맑은 고딕으로 대신 중이면 그대로
            string key = fam + "|" + f.SizeInPoints + "|" + w;
            IntPtr h;
            if (!hfonts.TryGetValue(key, out h))
            {
                var lf = new LOGFONT();
                f.ToLogFont(lf);
                lf.lfWeight = w;
                lf.lfQuality = 4;   // ANTIALIASED_QUALITY: 직접 그린 글(AntiAlias)과 같은 굵기로 보이게(디자인 검수 11)
                h = CreateFontIndirect(lf);
                hfonts[key] = h;   // 프로그램 끝까지 둔다(몇 개뿐)
                if (h != IntPtr.Zero)
                {
                    string line = lf.lfFaceName + " → " + RealFace(h);
                    if (GdiFaceLog.IndexOf(line, StringComparison.Ordinal) < 0) GdiFaceLog += (GdiFaceLog.Length > 0 ? " / " : "") + line;
                }
            }
            if (h != IntPtr.Zero) SendMessage(c.Handle, 0x30, h, (IntPtr)1);   // WM_SETFONT
        }
        catch { }
    }

    // 메뉴를 어둡게(하위 메뉴까지)
    public static void DarkMenu(ToolStripDropDown m)
    {
        m.Renderer = new DarkMenuRenderer();
        m.Font = DeckFonts.Regular(9.5f);
        m.ShowItemToolTips = true;
        foreach (ToolStripItem it in m.Items) DarkSub(it);
    }
    public static void DarkSub(ToolStripItem it)
    {
        var mi = it as ToolStripMenuItem;
        if (mi == null || !mi.HasDropDownItems) return;
        DarkMenu(mi.DropDown);
    }
}

// 창 설정 기억: 데이터 폴더의 deckform.ini (이름=값, UTF-8). deck.json 과 따로(설계 14장)
static class DeckPrefs
{
    static Dictionary<string, string> vals;
    static string File_ { get { return Path.Combine(Helper.DataDir, "deckform.ini"); } }

    static void Load()
    {
        if (vals != null) return;
        vals = new Dictionary<string, string>();
        try
        {
            if (!File.Exists(File_)) return;
            foreach (var raw in File.ReadAllLines(File_, Encoding.UTF8))
            {
                int e = raw.IndexOf('=');
                if (e > 0) vals[raw.Substring(0, e).Trim()] = raw.Substring(e + 1).Trim();
            }
        }
        catch { }
    }

    public static string Get(string k, string def)
    {
        Load();
        string v;
        return vals.TryGetValue(k, out v) ? v : def;
    }

    public static void Set(string k, string v)
    {
        Load();
        string old;
        if (vals.TryGetValue(k, out old) && old == v) return;
        vals[k] = v;
        Save();
    }

    public static void Save()
    {
        if (Helper.IsPreview || vals == null) return;   // 미리보기는 아무것도 쓰지 않는다
        try
        {
            var sb = new StringBuilder();
            foreach (var kv in vals) sb.Append(kv.Key).Append('=').Append(kv.Value).Append("\r\n");
            Directory.CreateDirectory(Helper.DataDir);
            File.WriteAllText(File_, sb.ToString(), new UTF8Encoding(false));
        }
        catch { }
    }
}

// 어두운 메뉴 색
class DarkColors : ProfessionalColorTable
{
    public override Color ToolStripDropDownBackground { get { return Theme.Panel; } }
    public override Color ImageMarginGradientBegin { get { return Theme.Panel; } }
    public override Color ImageMarginGradientMiddle { get { return Theme.Panel; } }
    public override Color ImageMarginGradientEnd { get { return Theme.Panel; } }
    public override Color MenuBorder { get { return Theme.Line; } }
    public override Color MenuItemBorder { get { return Color.Transparent; } }
    public override Color MenuItemSelected { get { return Theme.AccentSoft; } }
    public override Color MenuItemSelectedGradientBegin { get { return Theme.AccentSoft; } }
    public override Color MenuItemSelectedGradientEnd { get { return Theme.AccentSoft; } }
    public override Color SeparatorDark { get { return Theme.Line; } }
    public override Color SeparatorLight { get { return Theme.Line; } }
    public override Color CheckBackground { get { return Color.Transparent; } }
    public override Color CheckSelectedBackground { get { return Color.Transparent; } }
    public override Color CheckPressedBackground { get { return Color.Transparent; } }
}

class DarkMenuRenderer : ToolStripProfessionalRenderer
{
    public DarkMenuRenderer() : base(new DarkColors()) { RoundedEdges = false; }

    protected override void OnRenderToolStripBackground(ToolStripRenderEventArgs e)
    {
        e.Graphics.FillRectangle(Theme.BrPanel, e.AffectedBounds);
    }
    protected override void OnRenderImageMargin(ToolStripRenderEventArgs e)
    {
        e.Graphics.FillRectangle(Theme.BrPanel, e.AffectedBounds);
    }
    protected override void OnRenderToolStripBorder(ToolStripRenderEventArgs e)
    {
        var r = e.AffectedBounds;
        e.Graphics.DrawRectangle(Theme.PenLine, 0, 0, r.Width - 1, r.Height - 1);
    }
    protected override void OnRenderMenuItemBackground(ToolStripItemRenderEventArgs e)
    {
        var r = new Rectangle(2, 0, e.Item.Width - 4, e.Item.Height);
        e.Graphics.FillRectangle(Theme.BrPanel, new Rectangle(0, 0, e.Item.Width, e.Item.Height));
        if (e.Item.Selected && e.Item.Enabled)
        {
            e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
            Theme.FillRound(e.Graphics, Theme.Br(Theme.AccentSoft), r, 4);
        }
    }
    protected override void OnRenderSeparator(ToolStripSeparatorRenderEventArgs e)
    {
        int y = e.Item.Height / 2;
        e.Graphics.DrawLine(Theme.PenLine, 8, y, e.Item.Width - 8, y);
    }
    protected override void OnRenderItemText(ToolStripItemTextRenderEventArgs e)
    {
        bool shortcut = (e.TextFormat & TextFormatFlags.Right) != 0;
        Color c = !e.Item.Enabled ? Theme.Text3 : shortcut ? Theme.Text3 : Theme.Text1;
        var r = e.TextRectangle;
        Theme.Text(e.Graphics, e.Text, e.TextFont, c, new RectangleF(r.X, r.Y - 1, r.Width + 8, r.Height + 2),
            shortcut ? StringAlignment.Far : StringAlignment.Near);
    }
    protected override void OnRenderItemCheck(ToolStripItemImageRenderEventArgs e)
    {
        if (e.Item.Image != null) return;   // 그림이 있는 항목은 그림 둘레에 테두리(OnRenderItemImage)
        var r = e.ImageRectangle;
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        float d = 6;
        e.Graphics.FillEllipse(Theme.Br(Theme.Accent), r.X + (r.Width - d) / 2f, r.Y + (r.Height - d) / 2f, d, d);
    }
    // 그림이 있는 항목(기본 그림 ▸)에서 지금 고른 것: 그림 둘레에 파란 테두리(UI 검수 10)
    protected override void OnRenderItemImage(ToolStripItemImageRenderEventArgs e)
    {
        base.OnRenderItemImage(e);
        var mi = e.Item as ToolStripMenuItem;
        if (mi == null || !mi.Checked || e.Item.Image == null) return;
        var r = e.ImageRectangle;
        e.Graphics.SmoothingMode = SmoothingMode.AntiAlias;
        Theme.DrawRound(e.Graphics, Theme.Pn(Theme.Accent, 2), new RectangleF(r.X - 2, r.Y - 2, r.Width + 4, r.Height + 4), 4);
    }
    protected override void OnRenderArrow(ToolStripArrowRenderEventArgs e)
    {
        e.ArrowColor = e.Item != null && !e.Item.Enabled ? Theme.Text3 : Theme.Text2;
        base.OnRenderArrow(e);
    }
}

// 어두운 풍선 도움말
static class DarkTip
{
    public static ToolTip Make()
    {
        var t = new ToolTip();
        t.OwnerDraw = true;
        t.InitialDelay = 600; t.ReshowDelay = 200; t.AutoPopDelay = 12000;
        t.Popup += delegate (object s, PopupEventArgs e)
        {
            string txt = t.GetToolTip(e.AssociatedControl);
            var f = DeckFonts.Light(8.5f);
            using (var g = Graphics.FromHwnd(IntPtr.Zero))
            {
                g.TextRenderingHint = Theme.Hint(f);
                var sz = g.MeasureString(txt ?? "", f, 420);
                e.ToolTipSize = new Size((int)Math.Ceiling(sz.Width) + 18, (int)Math.Ceiling(sz.Height) + 14);
            }
        };
        t.Draw += delegate (object s, DrawToolTipEventArgs e)
        {
            var g = e.Graphics;
            var r = e.Bounds;
            g.FillRectangle(Theme.BrRaised, r);
            g.DrawRectangle(Theme.PenLine, 0, 0, r.Width - 1, r.Height - 1);
            Theme.Text(g, e.ToolTipText, DeckFonts.Light(8.5f), Theme.Text1, new RectangleF(8, 6, r.Width - 12, r.Height - 10),
                StringAlignment.Near, StringAlignment.Near, true);
        };
        return t;
    }
}
