// 아이콘 모음(약 200개 × 테마 6가지) — exe 안의 lib.zip 을 %LOCALAPPDATA%\PeneduBoard\icons\모음 에 풀고, 고르는 창을 띄운다. C# 5 문법만
using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.IO.Compression;
using System.Linq;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Windows.Forms;

class LibItem { public string Key, Name, Group, Kind, Target; }

static class DeckLibrary
{
    public static string Dir;                      // ...\icons\모음
    public static readonly string[] Themes = { "", "테마/1_따뜻함", "테마/2_남색밤", "테마/3_밝은종이", "테마/4_고대비", "테마/5_숲초록" };
    public static readonly string[] ThemeNames = { "기본(다크)", "따뜻함", "남색밤", "밝은종이", "고대비", "숲초록" };
    static List<LibItem> items;

    // exe 가 바뀌었을 때만 다시 푼다(lib.zip 크기를 .ver 에 적어 둠). 사용자가 넣은 파일은 건드리지 않는다
    public static void Extract(string dir)
    {
        Dir = dir;
        try
        {
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("deck.lib.zip"))
            {
                if (s == null) return;
                string ver = Path.Combine(dir, ".ver"), want = s.Length.ToString();
                if (File.Exists(ver) && File.ReadAllText(ver) == want) return;
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
        }
        catch { }
    }

    public static List<LibItem> Items()
    {
        if (items != null) return items;
        items = new List<LibItem>();
        try
        {
            string js = File.ReadAllText(Path.Combine(Dir, "목록.json"), Encoding.UTF8);
            // 단축키 값에 { } 가 들어 있어서(예: "{F5}") 중괄호로 자르지 않고 키 차례대로 읽는다(make_icon_library.py 가 늘 이 차례로 쓴다)
            const string S = "\"((?:[^\"\\\\]|\\\\.)*)\"";
            string pat = "\"key\":\\s*" + S + ",\\s*\"name\":\\s*" + S + ",\\s*\"group\":\\s*" + S + ",\\s*\"kind\":\\s*" + S + ",\\s*\"target\":\\s*" + S;
            foreach (Match m in Regex.Matches(js, pat))
            {
                Func<int, string> f = i => Regex.Unescape(m.Groups[i].Value);
                items.Add(new LibItem { Key = f(1), Name = f(2), Group = f(3), Kind = f(4), Target = f(5) });
            }
        }
        catch { }
        return items;
    }

    // src = "테마/2_남색밤/calc" 처럼 모음 안의 경로(확장자 없음)
    public static string PathOf(string src) { return Dir == null ? null : Path.Combine(Dir, src.Replace('/', '\\') + ".png"); }
    public static Bitmap Load(string src)
    {
        string f = PathOf(src);
        if (f == null || !File.Exists(f)) return null;
        using (var fs = new FileStream(f, FileMode.Open, FileAccess.Read)) using (var im = Image.FromStream(fs)) return DeckIcons.Fit72(im);
    }
}

// 고르는 창: 테마 · 묶음 · 찾기 + 72점 그림 목록
class LibraryPicker : Form
{
    readonly ComboBox cmbTheme = new ComboBox(), cmbGroup = new ComboBox();
    readonly TextBox txtFind = new TextBox();
    readonly ListView list = new ListView();
    readonly ImageList imgs = new ImageList();
    readonly CheckBox chkAct = new CheckBox();
    public LibItem Picked; public string PickedSrc; public bool UseAction;

    public LibraryPicker(int theme)
    {
        Text = "아이콘 모음에서 고르기"; Font = new Font("Malgun Gothic", 9.5f);
        ClientSize = new Size(820, 600); StartPosition = FormStartPosition.CenterParent; MinimizeBox = false;
        var top = new FlowLayoutPanel { Dock = DockStyle.Top, Height = 40, Padding = new Padding(8, 8, 8, 0) };
        top.Controls.Add(new Label { Text = "테마", AutoSize = true, Margin = new Padding(0, 6, 4, 0) });
        cmbTheme.DropDownStyle = ComboBoxStyle.DropDownList; cmbTheme.Width = 110; cmbTheme.Items.AddRange(DeckLibrary.ThemeNames);
        top.Controls.Add(cmbTheme);
        top.Controls.Add(new Label { Text = "묶음", AutoSize = true, Margin = new Padding(14, 6, 4, 0) });
        cmbGroup.DropDownStyle = ComboBoxStyle.DropDownList; cmbGroup.Width = 130; cmbGroup.Items.Add("전체");
        foreach (var g in DeckLibrary.Items().Select(i => i.Group).Distinct()) cmbGroup.Items.Add(g);
        top.Controls.Add(cmbGroup);
        top.Controls.Add(new Label { Text = "찾기", AutoSize = true, Margin = new Padding(14, 6, 4, 0) });
        txtFind.Width = 150; top.Controls.Add(txtFind);
        Controls.Add(top);

        var bottom = new Panel { Dock = DockStyle.Bottom, Height = 46 };
        chkAct.Text = "이름·하는 일도 같이 넣기(빈 칸이면 늘 넣음)"; chkAct.AutoSize = true; chkAct.Location = new Point(10, 14);
        var ok = new Button { Text = "고르기", Size = new Size(90, 30), Location = new Point(620, 8), DialogResult = DialogResult.OK };
        var no = new Button { Text = "취소", Size = new Size(90, 30), Location = new Point(716, 8), DialogResult = DialogResult.Cancel };
        bottom.Controls.AddRange(new Control[] { chkAct, ok, no });
        Controls.Add(bottom);
        AcceptButton = ok; CancelButton = no;

        imgs.ImageSize = new Size(72, 72); imgs.ColorDepth = ColorDepth.Depth32Bit;
        list.Dock = DockStyle.Fill; list.View = View.LargeIcon; list.LargeImageList = imgs; list.MultiSelect = false;
        list.BackColor = Color.FromArgb(24, 26, 32); list.ForeColor = Color.Gainsboro;
        Controls.Add(list); list.BringToFront();

        cmbTheme.SelectedIndex = Math.Max(0, Math.Min(theme, DeckLibrary.Themes.Length - 1)); cmbGroup.SelectedIndex = 0;
        cmbTheme.SelectedIndexChanged += delegate { Fill(); };
        cmbGroup.SelectedIndexChanged += delegate { Fill(); };
        txtFind.TextChanged += delegate { Fill(); };
        list.ItemActivate += delegate { DialogResult = DialogResult.OK; };
        FormClosing += (s, e) =>
        {
            if (DialogResult != DialogResult.OK) return;
            if (list.SelectedItems.Count == 0) { e.Cancel = true; return; }
            Picked = (LibItem)list.SelectedItems[0].Tag;
            PickedSrc = (Theme + "/" + Picked.Key).TrimStart('/'); UseAction = chkAct.Checked;
        };
        Fill();
    }

    public int ThemeIndex { get { return cmbTheme.SelectedIndex; } }
    string Theme { get { return DeckLibrary.Themes[Math.Max(0, cmbTheme.SelectedIndex)]; } }

    void Fill()
    {
        list.BeginUpdate(); list.Items.Clear();
        foreach (Image im in imgs.Images) im.Dispose();
        imgs.Images.Clear();
        bool paper = Theme.Contains("밝은종이");
        list.BackColor = paper ? Color.FromArgb(243, 237, 225) : Color.FromArgb(24, 26, 32);
        list.ForeColor = paper ? Color.FromArgb(40, 34, 28) : Color.Gainsboro;
        string g = cmbGroup.SelectedIndex > 0 ? (string)cmbGroup.SelectedItem : null, q = txtFind.Text.Trim();
        foreach (var it in DeckLibrary.Items())
        {
            if (g != null && it.Group != g) continue;
            if (q != "" && it.Name.IndexOf(q, StringComparison.OrdinalIgnoreCase) < 0 && it.Key.IndexOf(q, StringComparison.OrdinalIgnoreCase) < 0) continue;
            var b = DeckLibrary.Load((Theme + "/" + it.Key).TrimStart('/'));
            if (b == null) continue;
            imgs.Images.Add(b);
            list.Items.Add(new ListViewItem(it.Name, imgs.Images.Count - 1) { Tag = it });
        }
        list.EndUpdate();
    }
}
