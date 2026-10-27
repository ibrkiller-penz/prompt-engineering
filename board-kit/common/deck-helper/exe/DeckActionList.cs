// DeckActionList.cs — 오른쪽 '동작 목록': 자주 쓰는 동작 13개 + 아이콘 모음 묶음(접고 펴기·찾기·얇은 스크롤), 끌어서 칸에 놓기.
// 설계_도우미화면.md 8장. 기본 목록 컨트롤(ListBox 등)을 쓰지 않고 보이는 줄만 직접 그린다. C# 5 문법만
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

class ActRow
{
    public bool IsGroup; public string Group;        // 묶음 머리이면 IsGroup. Group = 화면에 보이는 묶음 이름
    public string Title, Tag, Action, Tip;           // Action: "kind:app" / "builtin:#desktop" / "lib:word"
    public LibItem Item;                              // 모음 항목이면
    public string IconKey;                            // 목록 그림에 쓸 모음 key
    public int Count;                                 // 묶음 머리: 항목 수(찾기 중엔 맞은 수)
    public int Y, H;                                  // 지금 보이는 자리(목록 안 좌표)
}

class ActionList : Control
{
    readonly DeckForm f;
    public readonly RoundBox Find = new RoundBox();
    readonly List<ActRow> groups = new List<ActRow>();
    readonly Dictionary<ActRow, List<ActRow>> children = new Dictionary<ActRow, List<ActRow>>();
    readonly List<ActRow> vis = new List<ActRow>();
    readonly HashSet<string> open = new HashSet<string>();
    readonly Dictionary<string, Bitmap> icons = new Dictionary<string, Bitmap>();
    readonly SlimScroll sc;
    readonly Timer findLater = new Timer();
    readonly ToolTip tip = DarkTip.Make();
    readonly ContextMenuStrip rowMenu = new ContextMenuStrip();
    ToolStripItem miPut, miIcon;
    ActRow menuRow;
    string query = "";
    int total;
    int hoverIdx = -1, pressIdx = -1, keyIdx = -1;
    ActRow downRow; Point downPt;
    string curTip = "";

    public const string FirstGroup = "자주 쓰는 동작";
    const int ListTop = 88;

    public ActionList(DeckForm form)
    {
        f = form;
        SetStyle(ControlStyles.UserPaint | ControlStyles.AllPaintingInWmPaint | ControlStyles.OptimizedDoubleBuffer | ControlStyles.ResizeRedraw | ControlStyles.Selectable, true);
        SetStyle(ControlStyles.StandardDoubleClick, true);
        BackColor = Theme.Panel;
        TabStop = true;
        sc = new SlimScroll(this);

        Find.LeftPad = 30; Find.ShowClear = true;
        Find.Placeholder = "찾기 (예: 한글, 소리, 유튜브)";
        Find.SetBounds(16, 44, 268, 32);
        Controls.Add(Find);
        findLater.Interval = 150;
        findLater.Tick += delegate { findLater.Stop(); ApplyFind(Find.Box.Text); };
        Find.Box.TextChanged += delegate { findLater.Stop(); findLater.Start(); };
        Find.Box.KeyDown += delegate (object s, KeyEventArgs e)
        {
            if (e.KeyCode == Keys.Escape) { Find.Box.Text = ""; ApplyFind(""); e.Handled = true; e.SuppressKeyPress = true; }
            else if (e.KeyCode == Keys.Down) { Focus(); MoveKey(1); e.Handled = true; }
        };

        miPut = rowMenu.Items.Add("고른 칸에 넣기", null, delegate { if (menuRow != null) f.ApplyAction(f.Selected, menuRow.Action, false); });
        miIcon = rowMenu.Items.Add("아이콘만 넣기", null, delegate { if (menuRow != null) f.ApplyAction(f.Selected, menuRow.Action, true); });
        Theme.DarkMenu(rowMenu);

        Build();
        foreach (var g in DeckPrefs.Get("open", FirstGroup + "|수업·발표").Split('|')) if (g.Length > 0) open.Add(g);
        Rebuild();
    }

    // ── 줄 만들기(설계 8-2) ──
    static string TagOf(string kind)
    {
        switch (kind)
        {
            case "app": return "프로그램";
            case "url": return "사이트";
            case "keys": return "단축키";
            case "text": return "글자";
            case "builtin": return "컴퓨터 기능";
            default: return "그림만";
        }
    }

    void Build()
    {
        var first = new ActRow { IsGroup = true, Group = FirstGroup };
        var list = new List<ActRow>();
        string[,] kinds = { { "프로그램 열기", "kind:app", "프로그램", "sd_open" }, { "사이트 열기", "kind:url", "사이트", "sd_website" },
            { "단축키 누르기", "kind:keys", "단축키", "sd_hotkey" }, { "글자 넣기", "kind:text", "글자", "sd_text" },
            { "여러 동작 묶기", "kind:multi", "여러", "sd_multi" } };
        for (int i = 0; i < kinds.GetLength(0); i++)
            list.Add(new ActRow { Group = FirstGroup, Title = kinds[i, 0], Action = kinds[i, 1], Tag = kinds[i, 2], IconKey = kinds[i, 3],
                Tip = "빈 칸에 놓으면 하는 일만 정해져요. 찬 칸이면 이름은 그대로" });
        for (int i = 0; i < DeckForm.BuiltinCodes.Length; i++)
            list.Add(new ActRow { Group = FirstGroup, Title = DeckForm.BuiltinNames[i], Action = "builtin:" + DeckForm.BuiltinCodes[i], Tag = "컴퓨터 기능",
                IconKey = DeckForm.BuiltinIconKeys[i], Tip = DeckForm.BuiltinNames[i] });
        first.Count = list.Count;
        groups.Add(first); children[first] = list;

        var byName = new Dictionary<string, ActRow>();
        foreach (var it in DeckLibrary.Items())
        {
            string gname = it.Group == "스트림덱 기본" ? "단추 기본 그림" : it.Group;
            ActRow g;
            if (!byName.TryGetValue(gname, out g))
            {
                g = new ActRow { IsGroup = true, Group = gname };
                byName[gname] = g; groups.Add(g); children[g] = new List<ActRow>();
            }
            string t = it.Target;
            string tipText = it.Kind == "app" ? "프로그램을 열어요: " + t
                : it.Kind == "url" ? (t.Length > 0 ? "사이트를 열어요: " + t : "사이트를 열어요(주소는 넣어 주세요)")
                : it.Kind == "keys" ? "단축키를 눌러요: " + t
                : it.Kind == "text" ? "글자를 넣어요"
                : it.Kind == "builtin" ? it.Name
                : "그림만 바꿔요(하는 일은 그대로)";
            children[g].Add(new ActRow { Group = gname, Title = it.Name, Tag = TagOf(it.Kind), Action = "lib:" + it.Key, Item = it, IconKey = it.Key, Tip = tipText });
        }
        total = 0;
        foreach (var g in groups) { g.Count = children[g].Count; total += g.Count; }
    }

    public int Total { get { return total; } }
    Rectangle ListArea { get { return new Rectangle(1, ListTop, Width - 1, Math.Max(0, Height - ListTop)); } }

    // 보이는 줄 다시 정하기(접힘·찾기)
    void Rebuild()
    {
        vis.Clear();
        string q = query;
        int y = 0;
        bool firstG = true;
        foreach (var g in groups)
        {
            var kids = children[g];
            List<ActRow> show;
            if (q.Length > 0)
            {
                bool gm = g.Group.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0;
                show = new List<ActRow>();
                foreach (var r in kids) if (gm || r.Title.IndexOf(q, StringComparison.OrdinalIgnoreCase) >= 0) show.Add(r);
                if (show.Count == 0) continue;
                g.Count = show.Count;
            }
            else
            {
                g.Count = kids.Count;
                show = open.Contains(g.Group) ? kids : new List<ActRow>();
            }
            if (!firstG) y += 8;
            firstG = false;
            g.Y = y; g.H = 32; vis.Add(g); y += 32;
            foreach (var r in show) { r.Y = y; r.H = 36; vis.Add(r); y += 36; }
        }
        sc.Content = y + 8;
        sc.View = ListArea.Height;
        sc.Fix();
        if (keyIdx >= vis.Count) keyIdx = vis.Count - 1;
        hoverIdx = -1;
        Invalidate();
    }

    bool Expanded(ActRow g) { return query.Length > 0 || open.Contains(g.Group); }

    void Toggle(ActRow g)
    {
        if (query.Length > 0) return;   // 찾는 중에는 모두 펴 둔다
        if (!open.Remove(g.Group)) open.Add(g.Group);
        SaveOpen();
        float keep = sc.Target;
        Rebuild();
        sc.ScrollTo(keep, false);
    }
    void SaveOpen() { DeckPrefs.Set("open", string.Join("|", new List<string>(open).ToArray())); }

    public void ApplyFind(string text)
    {
        string q = (text ?? "").Trim();
        if (q == query) return;
        query = q;
        Rebuild();
        sc.ScrollTo(0, false);
    }
    public void FocusFind() { Find.Box.Focus(); Find.Box.SelectAll(); }

    // 테마가 바뀌면 그림을 다시
    public void ClearIcons()
    {
        foreach (var b in icons.Values) if (b != null) b.Dispose();
        icons.Clear();
        Invalidate();
    }

    Bitmap Icon(ActRow r)
    {
        string key = r.IconKey ?? "";
        Bitmap b;
        if (icons.TryGetValue(key, out b)) return b;
        Bitmap big = null;
        try { big = key.Length > 0 ? DeckLibrary.Load(DeckForm.LibSrc(f.LibTheme, key)) : null; } catch { }
        if (big == null) try { big = DeckIcons.LetterTile(r.Title); } catch { }
        if (big != null)
        {
            b = new Bitmap(28, 28);
            using (var g = Graphics.FromImage(b))
            {
                g.InterpolationMode = InterpolationMode.HighQualityBicubic;
                g.PixelOffsetMode = PixelOffsetMode.HighQuality;
                g.DrawImage(big, new Rectangle(0, 0, 28, 28));
            }
            big.Dispose();
        }
        icons[key] = b;
        return b;
    }

    int HitRow(Point p)
    {
        var a = ListArea;
        if (!a.Contains(p)) return -1;
        float y = p.Y - a.Top + sc.Pos;
        for (int i = 0; i < vis.Count; i++) if (y >= vis[i].Y && y < vis[i].Y + vis[i].H) return i;
        return -1;
    }

    protected override void OnResize(EventArgs e)
    {
        base.OnResize(e);
        Find.SetBounds(16, 44, Math.Max(60, Width - 32), 32);
        sc.View = ListArea.Height; sc.Fix();
    }

    // ── 그리기(설계 8-3) ──
    protected override void OnPaint(PaintEventArgs e)
    {
        var g = e.Graphics;
        g.Clear(Theme.Panel);
        g.DrawLine(Theme.PenLine, 0, 0, 0, Height);
        Theme.Text(g, "동작", DeckFonts.Medium(11f), Theme.Text1, new RectangleF(16, 6, 120, 34));
        Theme.Text(g, total + "개", DeckFonts.Regular(8.5f), Theme.Text3, new RectangleF(Width - 16 - 80, 6, 80, 34), StringAlignment.Far);

        var a = ListArea;
        var oldClip = g.Clip;
        g.SetClip(a);
        if (vis.Count == 0 && query.Length > 0)
            Theme.Text(g, "찾는 것이 없어요", DeckFonts.Regular(9.5f), Theme.Text3, new RectangleF(a.X, a.Y + 40, a.Width, 30), StringAlignment.Center);
        float top = sc.Pos;
        for (int i = 0; i < vis.Count; i++)
        {
            var r = vis[i];
            if (r.Y + r.H < top || r.Y > top + a.Height) continue;
            var rc = new RectangleF(a.X, a.Top + r.Y - top, a.Width, r.H);
            if (r.IsGroup) DrawGroup(g, r, rc, i == hoverIdx);
            else DrawRow(g, r, rc, i);
        }
        // 위·아래가 잘리면 흐려지는 띠
        g.SmoothingMode = SmoothingMode.None;
        if (sc.Pos > 1)
            using (var lg = new LinearGradientBrush(new Rectangle(a.X, a.Top - 1, a.Width, 13), Theme.Panel, Color.FromArgb(0, Theme.Panel), LinearGradientMode.Vertical))
                g.FillRectangle(lg, a.X, a.Top, a.Width, 12);
        if (sc.Pos < sc.Max - 1)
            using (var lg = new LinearGradientBrush(new Rectangle(a.X, a.Bottom - 13, a.Width, 13), Color.FromArgb(0, Theme.Panel), Theme.Panel, LinearGradientMode.Vertical))
                g.FillRectangle(lg, a.X, a.Bottom - 12, a.Width, 12);
        sc.Paint(g, a);
        g.Clip = oldClip;
        if (Focused && ShowFocusCues) g.DrawRectangle(Theme.Pn(Theme.A(Theme.AccentHover, 120)), a.X, a.Y, a.Width - 1, a.Height - 1);
    }

    void DrawGroup(Graphics g, ActRow r, RectangleF rc, bool hot)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        bool ex = Expanded(r);
        var tri = ex ? new RectangleF(16, rc.Y + rc.Height / 2 - 3, 10, 6) : new RectangleF(18, rc.Y + rc.Height / 2 - 5, 6, 10);
        Theme.Triangle(g, tri, ex ? 1 : 0, Theme.Br(hot ? Theme.Text1 : Theme.Text3));
        string cnt = r.Count.ToString();
        var cf = DeckFonts.Regular(8.5f);
        float cw = Theme.TextWidth(g, cnt, cf) + 14;
        var pill = new RectangleF(rc.Right - 16 - cw, rc.Y + (rc.Height - 18) / 2, cw, 18);
        Theme.FillRound(g, Theme.BrRaised, pill, 9);
        Theme.Text(g, cnt, cf, Theme.Text3, pill, StringAlignment.Center);
        Theme.Text(g, r.Group, DeckFonts.Medium(10f), hot ? Theme.Text1 : Theme.Text2, new RectangleF(34, rc.Y, pill.Left - 34 - 8, rc.Height));
    }

    void DrawRow(Graphics g, ActRow r, RectangleF rc, int i)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        var bgR = new RectangleF(8, rc.Y + 2, rc.Width - 16 - (sc.Needed ? 6 : 0), rc.Height - 4);
        if (i == pressIdx || i == keyIdx && Focused) Theme.FillRound(g, Theme.Br(Theme.AccentSoft), bgR, 6);
        else if (i == hoverIdx) Theme.FillRound(g, Theme.BrRaised, bgR, 6);
        var ic = Icon(r);
        if (ic != null) g.DrawImage(ic, 16, (int)(rc.Y + (rc.Height - 28) / 2));
        var tf = DeckFonts.Regular(8.5f);
        float tw = Theme.TextWidth(g, r.Tag, tf) + 14;
        var pill = new RectangleF(rc.Right - 20 - tw, rc.Y + (rc.Height - 18) / 2, tw, 18);
        if (!string.IsNullOrEmpty(r.Tag))
        {
            Theme.FillRound(g, Theme.Br(i == hoverIdx ? Theme.BtnHover : Theme.Raised), pill, 9);
            Theme.Text(g, r.Tag, tf, Theme.Text3, pill, StringAlignment.Center);
        }
        var nf = DeckFonts.Regular(9.5f);
        var nr = new RectangleF(54, rc.Y, pill.Left - 54 - 8, rc.Height);
        int at = query.Length > 0 ? r.Title.IndexOf(query, StringComparison.OrdinalIgnoreCase) : -1;
        if (at >= 0 && Theme.TextWidth(g, r.Title, nf) <= nr.Width)
        {   // 찾은 글자만 파랗게
            float x = Theme.TextRun(g, r.Title.Substring(0, at), nf, Theme.Text1, nr.X, nr);
            x = Theme.TextRun(g, r.Title.Substring(at, query.Length), nf, Theme.Accent, x, nr);
            Theme.TextRun(g, r.Title.Substring(at + query.Length), nf, Theme.Text1, x, nr);
        }
        else Theme.Text(g, r.Title, nf, Theme.Text1, nr);
    }

    // ── 마우스(설계 8-6) ──
    protected override void OnMouseDown(MouseEventArgs e)
    {
        base.OnMouseDown(e);
        if (!Find.Box.Focused || ListArea.Contains(e.Location)) Focus();
        if (e.Button == MouseButtons.Left && sc.MouseDown(ListArea, e.Location)) return;
        int i = HitRow(e.Location);
        if (i < 0) return;
        var r = vis[i];
        keyIdx = i;
        // 묶음 머리: 한 번 누를 때만 접고 펴기(두 번 누르기의 둘째 누름은 건너뛴다 — 깜박임 막기. UI 검수 8)
        if (r.IsGroup) { if (e.Button == MouseButtons.Left && e.Clicks == 1) Toggle(r); return; }
        if (e.Button == MouseButtons.Left) { pressIdx = i; downRow = r; downPt = e.Location; Invalidate(); }
        else if (e.Button == MouseButtons.Right)
        {
            menuRow = r;
            miIcon.Enabled = !r.Action.StartsWith("kind:");
            rowMenu.Show(this, e.Location);
        }
    }

    protected override void OnMouseMove(MouseEventArgs e)
    {
        base.OnMouseMove(e);
        if (sc.MouseMove(ListArea, e.Location)) return;
        int i = sc.OnThumbArea(ListArea, e.Location) ? -1 : HitRow(e.Location);
        if (i != hoverIdx) { hoverIdx = i; Invalidate(); }
        Cursor = i >= 0 ? Cursors.Hand : Cursors.Default;
        string t = i >= 0 && !vis[i].IsGroup ? vis[i].Tip ?? "" : "";
        if (t != curTip) { curTip = t; tip.SetToolTip(this, t); }
        if (downRow != null && e.Button == MouseButtons.Left && (Math.Abs(e.X - downPt.X) > 8 || Math.Abs(e.Y - downPt.Y) > 8))
        {
            var r = downRow; downRow = null; pressIdx = -1; Invalidate();
            tip.Hide(this);
            DoDragDrop(new DataObject("PeneduAction", r.Action), DragDropEffects.Copy);
        }
    }

    protected override void OnMouseUp(MouseEventArgs e)
    {
        base.OnMouseUp(e);
        sc.MouseUp();
        downRow = null;
        if (pressIdx >= 0) { pressIdx = -1; Invalidate(); }
    }
    protected override void OnMouseLeave(EventArgs e)
    {
        base.OnMouseLeave(e);
        sc.MouseLeave();
        if (hoverIdx >= 0) { hoverIdx = -1; Invalidate(); }
    }
    protected override void OnMouseDoubleClick(MouseEventArgs e)
    {
        base.OnMouseDoubleClick(e);
        if (e.Button != MouseButtons.Left) return;
        int i = HitRow(e.Location);
        if (i >= 0 && !vis[i].IsGroup) f.ApplyAction(f.Selected, vis[i].Action, false);
    }
    protected override void OnMouseWheel(MouseEventArgs e)
    {
        base.OnMouseWheel(e);
        sc.Wheel(e.Delta);
    }
    protected override void OnMouseEnter(EventArgs e) { base.OnMouseEnter(e); }

    // ── 키보드 ──
    protected override bool IsInputKey(Keys k)
    {
        Keys c = k & Keys.KeyCode;
        if (c == Keys.Up || c == Keys.Down || c == Keys.Left || c == Keys.Right || c == Keys.Enter) return true;
        return base.IsInputKey(k);
    }
    void MoveKey(int d)
    {
        if (vis.Count == 0) return;
        keyIdx = Math.Max(0, Math.Min(vis.Count - 1, (keyIdx < 0 ? (d > 0 ? -1 : 0) : keyIdx) + d));
        var r = vis[keyIdx];
        var a = ListArea;
        if (r.Y < sc.Target) sc.ScrollTo(r.Y, true);
        else if (r.Y + r.H > sc.Target + a.Height) sc.ScrollTo(r.Y + r.H - a.Height, true);
        Invalidate();
    }
    protected override void OnKeyDown(KeyEventArgs e)
    {
        if (e.KeyCode == Keys.Up) MoveKey(-1);
        else if (e.KeyCode == Keys.Down) MoveKey(1);
        else if ((e.KeyCode == Keys.Left || e.KeyCode == Keys.Right) && keyIdx >= 0 && keyIdx < vis.Count)
        {
            var r = vis[keyIdx];
            ActRow g = r.IsGroup ? r : null;
            if (g == null) foreach (var x in groups) if (x.Group == r.Group) g = x;
            if (g != null && query.Length == 0 && (open.Contains(g.Group) == (e.KeyCode == Keys.Left)))
            {
                Toggle(g);
                keyIdx = vis.IndexOf(g);
            }
        }
        else if (e.KeyCode == Keys.Enter && keyIdx >= 0 && keyIdx < vis.Count)
        {
            if (vis[keyIdx].IsGroup) Toggle(vis[keyIdx]);
            else f.ApplyAction(f.Selected, vis[keyIdx].Action, false);
        }
        else { base.OnKeyDown(e); return; }
        e.Handled = true;
    }
    protected override void OnGotFocus(EventArgs e) { if (keyIdx < 0 && vis.Count > 0) keyIdx = 0; Invalidate(); base.OnGotFocus(e); }
    protected override void OnLostFocus(EventArgs e) { Invalidate(); base.OnLostFocus(e); }

    protected override void Dispose(bool disposing)
    {
        if (disposing) { sc.Stop(); findLater.Dispose(); tip.Dispose(); ClearIcons(); }
        base.Dispose(disposing);
    }
}
