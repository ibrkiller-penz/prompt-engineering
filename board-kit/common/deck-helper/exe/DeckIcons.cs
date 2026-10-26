// 단축키 아이콘 만들기 — 프로그램 아이콘·글자·사이트 그림을 보드와 같은 '다크 사각'(72x72)으로, 보드용 .bin(RGB565+알파)과 CRC-32
using System;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Imaging;
using System.Drawing.Text;
using System.IO;
using System.Net;
using System.Reflection;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32;

static class DeckIcons
{
    public const int Size = 72, BinLen = 72 * 72 * 3;
    const int N = 288, Rad = 69, Bw = 13, G = 230;   // 4배로 그려 줄인다(make_deck_icons.py 와 같은 비율)
    static readonly Color Fill = Color.FromArgb(30, 34, 44);
    static readonly Color DefRing = Color.FromArgb(90, 140, 255);
    static readonly Color[] Palette = {
        Color.FromArgb(90, 140, 255), Color.FromArgb(16, 163, 127), Color.FromArgb(229, 72, 77), Color.FromArgb(124, 108, 246),
        Color.FromArgb(245, 166, 35), Color.FromArgb(37, 132, 235), Color.FromArgb(232, 92, 160), Color.FromArgb(40, 180, 200) };

    // ── CRC-32(IEEE, zlib 와 같은 값. "123456789" → cbf43926) ──
    static uint[] table;
    public static uint Crc32(byte[] b) { return Crc32(0, b, 0, b.Length); }
    public static uint Crc32(uint crc, byte[] b, int off, int len)
    {
        if (table == null)
        {
            var t = new uint[256];
            for (uint i = 0; i < 256; i++) { uint c = i; for (int k = 0; k < 8; k++) c = (c & 1) != 0 ? 0xEDB88320u ^ (c >> 1) : c >> 1; t[i] = c; }
            table = t;
        }
        crc = ~crc;
        for (int i = off; i < off + len; i++) crc = table[(crc ^ b[i]) & 0xFF] ^ (crc >> 8);
        return ~crc;
    }
    public static string Crc32Hex(byte[] b) { return Crc32(b).ToString("x8"); }

    // ── 72x72 그림 → 보드 바이트: [RGB565 아래][RGB565 위][알파] ──
    public static byte[] ToBin(Bitmap tile72)
    {
        var bmp = tile72.Width == Size && tile72.Height == Size && tile72.PixelFormat == PixelFormat.Format32bppArgb ? tile72 : Resize(tile72, Size);
        var d = bmp.LockBits(new Rectangle(0, 0, Size, Size), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        var raw = new byte[d.Stride * Size];
        Marshal.Copy(d.Scan0, raw, 0, raw.Length);
        int stride = d.Stride;
        bmp.UnlockBits(d);
        if (!ReferenceEquals(bmp, tile72)) bmp.Dispose();
        var o = new byte[BinLen];
        int j = 0;
        for (int y = 0; y < Size; y++)
            for (int x = 0; x < Size; x++)
            {
                int k = y * stride + x * 4;   // B G R A
                int v = ((raw[k + 2] >> 3) << 11) | ((raw[k + 1] >> 2) << 5) | (raw[k] >> 3);
                o[j++] = (byte)(v & 0xFF); o[j++] = (byte)(v >> 8); o[j++] = raw[k + 3];
            }
        return o;
    }

    static Bitmap Resize(Image src, int s)
    {
        var b = new Bitmap(s, s, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(b)) { Hq(g); g.DrawImage(src, 0, 0, s, s); }
        return b;
    }

    // 그림을 테두리 없이 72x72 에 비율 그대로 맞춘다(아이콘 모음·'그대로' 그림 파일)
    public static Bitmap Fit72(Image src)
    {
        var b = new Bitmap(Size, Size, PixelFormat.Format32bppArgb);
        float k = Math.Min((float)Size / src.Width, (float)Size / src.Height);
        float w = src.Width * k, h = src.Height * k;
        using (var g = Graphics.FromImage(b)) { Hq(g); g.DrawImage(src, (Size - w) / 2, (Size - h) / 2, w, h); }
        return b;
    }

    static void Hq(Graphics g)
    {
        g.SmoothingMode = SmoothingMode.AntiAlias;
        g.InterpolationMode = InterpolationMode.HighQualityBicubic;
        g.PixelOffsetMode = PixelOffsetMode.HighQuality;
        g.CompositingQuality = CompositingQuality.HighQuality;
    }

    static GraphicsPath Round(float x, float y, float w, float h, float r)
    {
        var p = new GraphicsPath(); float d = r * 2;
        p.AddArc(x, y, d, d, 180, 90); p.AddArc(x + w - d, y, d, d, 270, 90);
        p.AddArc(x + w - d, y + h - d, d, d, 0, 90); p.AddArc(x, y + h - d, d, d, 90, 90);
        p.CloseFigure();
        return p;
    }

    // ── 다크 사각: 어두운 바탕 + 색 테두리 + 안쪽 은은한 빛, 가운데에 그림(230 안에 비율 유지) ──
    public static Bitmap Tile(Bitmap glyph) { return Tile(glyph, null); }
    public static Bitmap Tile(Bitmap glyph, Color? ring)
    {
        Color rc = ring.HasValue ? ring.Value : (glyph != null ? MainColor(glyph) : DefRing);
        using (var big = new Bitmap(N, N, PixelFormat.Format32bppArgb))
        {
            using (var g = Graphics.FromImage(big))
            {
                Hq(g);
                g.Clear(Color.Transparent);
                using (var outer = Round(0, 0, N, N, Rad)) using (var br = new SolidBrush(rc)) g.FillPath(br, outer);
                using (var inner = Round(Bw, Bw, N - 2 * Bw, N - 2 * Bw, Rad - Bw))
                {
                    using (var br = new SolidBrush(Fill)) g.FillPath(br, inner);
                    g.SetClip(inner);
                    for (int k = 6; k >= 1; k--)   // 번짐 흉내: 넓고 옅은 선부터
                        using (var pen = new Pen(Color.FromArgb(14, rc), Bw * k * 0.6f)) g.DrawPath(pen, inner);
                    g.ResetClip();
                }
                if (glyph != null)
                {
                    float sc = Math.Min((float)G / glyph.Width, (float)G / glyph.Height);
                    float w = glyph.Width * sc, h = glyph.Height * sc;
                    using (var ia = new ImageAttributes())
                    {
                        ia.SetWrapMode(WrapMode.TileFlipXY);
                        g.DrawImage(glyph, new Rectangle((int)((N - w) / 2), (int)((N - h) / 2), (int)w, (int)h), 0, 0, glyph.Width, glyph.Height, GraphicsUnit.Pixel, ia);
                    }
                }
            }
            var t = new Bitmap(Size, Size, PixelFormat.Format32bppArgb);
            using (var g = Graphics.FromImage(t))
            using (var ia = new ImageAttributes())
            {
                Hq(g);
                ia.SetWrapMode(WrapMode.TileFlipXY);
                g.DrawImage(big, new Rectangle(0, 0, Size, Size), 0, 0, N, N, GraphicsUnit.Pixel, ia);
            }
            return t;
        }
    }

    // 대표색: 알파>128 픽셀 중 채도가 높은 쪽(위 20%) 평균. 거의 회색뿐이면 기본 파랑
    public static Color MainColor(Bitmap b)
    {
        using (var s = Resize(b, 64))
        {
            var d = s.LockBits(new Rectangle(0, 0, 64, 64), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
            var raw = new byte[d.Stride * 64];
            Marshal.Copy(d.Scan0, raw, 0, raw.Length);
            s.UnlockBits(d);
            var sats = new System.Collections.Generic.List<int[]>();
            for (int k = 0; k < raw.Length; k += 4)
            {
                if (raw[k + 3] <= 128) continue;
                int bb = raw[k], gg = raw[k + 1], rr = raw[k + 2];
                int mx = Math.Max(rr, Math.Max(gg, bb)), mn = Math.Min(rr, Math.Min(gg, bb));
                int sat = mx == 0 ? 0 : (mx - mn) * 255 / mx;
                if (mx < 40) sat = 0;   // 너무 어두우면 테두리로 안 보인다
                sats.Add(new[] { sat, rr, gg, bb });
            }
            if (sats.Count == 0) return DefRing;
            sats.Sort(delegate (int[] x, int[] y) { return y[0].CompareTo(x[0]); });
            if (sats[0][0] < 50) return DefRing;
            int n = Math.Max(1, sats.Count / 5); long r = 0, gsum = 0, bl = 0;
            for (int i = 0; i < n; i++) { r += sats[i][1]; gsum += sats[i][2]; bl += sats[i][3]; }
            return Color.FromArgb((int)(r / n), (int)(gsum / n), (int)(bl / n));
        }
    }

    // ── 글자 아이콘(이름 첫 글자: 한글 1자, 영문 2자) ──
    public static Bitmap IconLetter(string name)
    {
        string t = Letters(name);
        var b = new Bitmap(G, G, PixelFormat.Format32bppArgb);
        using (var g = Graphics.FromImage(b))
        {
            Hq(g);
            g.TextRenderingHint = TextRenderingHint.AntiAlias;
            g.Clear(Color.Transparent);
            if (t.Length == 0) return b;
            FontFamily ff;
            try { ff = new FontFamily("Malgun Gothic"); } catch { ff = FontFamily.GenericSansSerif; }
            using (ff)
            using (var p = new GraphicsPath())
            {
                p.AddString(t, ff, (int)FontStyle.Bold, 110f, new PointF(0, 0), StringFormat.GenericTypographic);
                var r = p.GetBounds();
                float sc = Math.Min(1f, (G - 20) / Math.Max(r.Width, 1));
                using (var m = new Matrix())
                {
                    m.Translate(G / 2f, G / 2f);
                    m.Scale(sc, sc);
                    m.Translate(-(r.X + r.Width / 2), -(r.Y + r.Height / 2));
                    p.Transform(m);
                }
                g.FillPath(Brushes.White, p);
            }
        }
        return b;
    }

    public static string Letters(string name)
    {
        name = (name ?? "").Trim();
        if (name.Length == 0) return "";
        char c = name[0];
        if (c < 128 && name.Length > 1 && name[1] < 128 && char.IsLetterOrDigit(name[1]))
            return char.ToUpperInvariant(c).ToString() + name[1];
        return char.ToUpperInvariant(c).ToString();
    }

    public static Color LetterColor(string name)
    {
        int h = 0; foreach (char c in name ?? "") h = h * 31 + c;
        return Palette[(h & 0x7FFFFFFF) % Palette.Length];
    }

    public static Bitmap LetterTile(string name) { using (var g = IconLetter(name)) return Tile(g, LetterColor(name)); }

    // ── 그림 파일(PNG/JPG/BMP/ICO) ──
    public static Bitmap IconFromFile(string path)
    {
        if (path.EndsWith(".ico", StringComparison.OrdinalIgnoreCase))
            try { using (var ic = new Icon(path, 256, 256)) return ic.ToBitmap(); } catch { }
        using (var fs = new FileStream(path, FileMode.Open, FileAccess.Read))
        using (var im = Image.FromStream(fs))
            return new Bitmap(im);
    }

    // ── 프로그램 아이콘(가능한 큰 크기). 못 찾으면 null ──
    public static Bitmap IconFromApp(string target) { return IconFromApp(target, 256); }
    public static Bitmap IconFromApp(string target, int px)
    {
        string path = ResolveApp(target);
        if (path == null) return null;
        Bitmap b = null;
        try { b = ShellImage(path, px); } catch { }
        if (b == null)
        {
            string t = LnkTarget(path);
            if (t != null) try { b = ShellImage(t, px); } catch { }
        }
        if (b == null && File.Exists(path))
            try { using (var ic = Icon.ExtractAssociatedIcon(path)) b = ic.ToBitmap(); } catch { }
        if (b == null) return null;
        var c = CropAlpha(b);
        if (!ReferenceEquals(c, b)) b.Dispose();
        return c;
    }

    // 대상 글을 실제 파일 경로로: 전체 경로 · App Paths(excel, powerpnt) · PATH(cmd.exe) · 프로토콜(claude:)
    public static string ResolveApp(string t)
    {
        t = (t ?? "").Trim().Trim('"');
        if (t.Length == 0 || t.StartsWith("#")) return null;
        try
        {
            if (File.Exists(t) || Directory.Exists(t)) return t;
            string exe = t.EndsWith(".exe", StringComparison.OrdinalIgnoreCase) ? t : t + ".exe";
            if (t.IndexOf('\\') < 0 && t.IndexOf(':') < 0)
            {
                foreach (var hive in new[] { Registry.CurrentUser, Registry.LocalMachine })
                    using (var k = hive.OpenSubKey(@"Software\Microsoft\Windows\CurrentVersion\App Paths\" + exe))
                        if (k != null) { var v = (k.GetValue("") as string ?? "").Trim('"'); if (File.Exists(v)) return v; }
                var dirs = (Environment.GetEnvironmentVariable("PATH") ?? "").Split(';');
                foreach (var d in dirs)
                    try { var f = Path.Combine(d.Trim(), exe); if (d.Trim().Length > 0 && File.Exists(f)) return f; } catch { }
            }
            int colon = t.IndexOf(':');
            if (colon > 1 && t.IndexOf("://") < 0 && (colon == t.Length - 1 || t[colon + 1] != '\\'))
            {
                string proto = t.Substring(0, colon);
                using (var k = Registry.ClassesRoot.OpenSubKey(proto + @"\DefaultIcon"))
                    if (k != null) { var v = FirstPath(k.GetValue("") as string); if (v != null) return v; }
                using (var k = Registry.ClassesRoot.OpenSubKey(proto + @"\shell\open\command"))
                    if (k != null) { var v = FirstPath(k.GetValue("") as string); if (v != null) return v; }
            }
        }
        catch { }
        return null;
    }

    static string FirstPath(string v)
    {
        if (string.IsNullOrEmpty(v)) return null;
        v = v.Trim();
        string p;
        if (v.StartsWith("\"")) { int e = v.IndexOf('"', 1); p = e > 0 ? v.Substring(1, e - 1) : v.Trim('"'); }
        else { int e = v.IndexOf(','); p = e > 0 ? v.Substring(0, e) : v; int sp = p.ToLowerInvariant().IndexOf(".exe "); if (sp > 0) p = p.Substring(0, sp + 4); }
        p = Environment.ExpandEnvironmentVariables(p);
        return File.Exists(p) ? p : null;
    }

    // .lnk 의 대상(없으면 null) — WScript.Shell
    public static string LnkTarget(string lnk)
    {
        if (!lnk.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase)) return null;
        try
        {
            var t = Type.GetTypeFromProgID("WScript.Shell");
            object sh = Activator.CreateInstance(t);
            object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, sh, new object[] { lnk });
            string tp = sc.GetType().InvokeMember("TargetPath", BindingFlags.GetProperty, null, sc, null) as string;
            return string.IsNullOrEmpty(tp) ? null : tp;
        }
        catch { return null; }
    }

    // 알파가 있는 부분만 잘라 낸다(큰 아이콘이 없으면 윈도우가 256 칸 가운데에 48 짜리를 넣어 준다)
    static Bitmap CropAlpha(Bitmap b)
    {
        var src = b.PixelFormat == PixelFormat.Format32bppArgb ? b : new Bitmap(b);
        var d = src.LockBits(new Rectangle(0, 0, src.Width, src.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        var raw = new byte[d.Stride * src.Height];
        Marshal.Copy(d.Scan0, raw, 0, raw.Length);
        int stride = d.Stride;
        src.UnlockBits(d);
        int l = src.Width, t = src.Height, r = -1, bo = -1;
        for (int y = 0; y < src.Height; y++)
            for (int x = 0; x < src.Width; x++)
                if (raw[y * stride + x * 4 + 3] > 16) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > bo) bo = y; }
        if (r < 0) return src;
        int w = r - l + 1, h = bo - t + 1;
        if (w == src.Width && h == src.Height) return src;
        var o = src.Clone(new Rectangle(l, t, w, h), PixelFormat.Format32bppArgb);
        if (!ReferenceEquals(src, b)) src.Dispose();
        return o;
    }

    // ── 셸 아이콘(IShellItemImageFactory, 256까지) ──
    [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
    [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx, cy; }
    [StructLayout(LayoutKind.Sequential)] struct BITMAP { public int bmType, bmWidth, bmHeight, bmWidthBytes; public ushort bmPlanes, bmBitsPixel; public IntPtr bmBits; }
    [StructLayout(LayoutKind.Sequential)] struct BMIH { public uint biSize; public int biWidth, biHeight; public ushort biPlanes, biBitCount; public uint biCompression, biSizeImage; public int biXPelsPerMeter, biYPelsPerMeter; public uint biClrUsed, biClrImportant; }
    [StructLayout(LayoutKind.Sequential)] struct DIBSECTION { public BITMAP dsBm; public BMIH dsBmih; public uint b0, b1, b2; public IntPtr dshSection; public uint dsOffset; }
    [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
    static extern int SHCreateItemFromParsingName(string path, IntPtr pbc, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);
    [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
    [DllImport("gdi32.dll")] static extern int GetObject(IntPtr h, int size, ref DIBSECTION ds);

    static Bitmap ShellImage(string path, int px)
    {
        var iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
        IShellItemImageFactory f;
        if (SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out f) != 0 || f == null) return null;
        IntPtr hb = IntPtr.Zero;
        try
        {
            var sz = new SIZE { cx = px, cy = px };
            if (f.GetImage(sz, 0x4 /* SIIGBF_ICONONLY */, out hb) != 0 || hb == IntPtr.Zero) return null;
            var ds = new DIBSECTION();
            bool isDib = GetObject(hb, Marshal.SizeOf(typeof(DIBSECTION)), ref ds) == Marshal.SizeOf(typeof(DIBSECTION));
            var bm = ds.dsBm;
            int w = bm.bmWidth, h = Math.Abs(bm.bmHeight);
            if (bm.bmBitsPixel != 32 || bm.bmBits == IntPtr.Zero) { using (var x = Image.FromHbitmap(hb)) return new Bitmap(x); }
            // DIB 비트를 직접 읽는다(Image.FromHbitmap 은 알파를 버린다). 미리 곱한 알파(PARGB), 보통 아래에서 위로 쌓임
            var raw = new byte[bm.bmWidthBytes * h];
            Marshal.Copy(bm.bmBits, raw, 0, raw.Length);
            bool anyA = false;
            for (int k = 3; k < raw.Length; k += 4) if (raw[k] != 0) { anyA = true; break; }
            var o = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            var d = o.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            var dst = new byte[d.Stride * h];
            bool bottomUp = isDib && ds.dsBmih.biHeight > 0;
            for (int y = 0; y < h; y++)
            {
                int sy = bottomUp ? h - 1 - y : y;
                for (int x = 0; x < w; x++)
                {
                    int s = sy * bm.bmWidthBytes + x * 4, t = y * d.Stride + x * 4;
                    int a = anyA ? raw[s + 3] : 255;
                    if (a == 0) continue;
                    if (anyA && a < 255)
                    {
                        dst[t] = (byte)Math.Min(255, raw[s] * 255 / a); dst[t + 1] = (byte)Math.Min(255, raw[s + 1] * 255 / a); dst[t + 2] = (byte)Math.Min(255, raw[s + 2] * 255 / a);
                    }
                    else { dst[t] = raw[s]; dst[t + 1] = raw[s + 1]; dst[t + 2] = raw[s + 2]; }
                    dst[t + 3] = (byte)a;
                }
            }
            Marshal.Copy(dst, 0, d.Scan0, dst.Length);
            o.UnlockBits(d);
            return o;
        }
        finally
        {
            if (hb != IntPtr.Zero) DeleteObject(hb);
            Marshal.ReleaseComObject(f);
        }
    }

    // ── 사이트 파비콘(사용자가 단추를 눌렀을 때만). 못 받으면 null ──
    public static Bitmap IconFavicon(string url)
    {
        string host;
        try { host = new Uri(url.Contains("://") ? url : "https://" + url).Host; } catch { return null; }
        try { ServicePointManager.SecurityProtocol |= (SecurityProtocolType)3072; } catch { }   // TLS 1.2
        foreach (var u in new[] { "https://www.google.com/s2/favicons?domain=" + host + "&sz=128", "https://" + host + "/favicon.ico" })
        {
            try
            {
                var rq = (HttpWebRequest)WebRequest.Create(u);
                rq.Timeout = 6000; rq.ReadWriteTimeout = 6000; rq.UserAgent = "Mozilla/5.0";
                using (var rs = rq.GetResponse())
                using (var st = rs.GetResponseStream())
                using (var ms = new MemoryStream())
                {
                    st.CopyTo(ms);
                    if (ms.Length < 50) continue;
                    ms.Position = 0;
                    Bitmap b = null;
                    try { using (var ic = new Icon(ms, 256, 256)) b = ic.ToBitmap(); } catch { ms.Position = 0; }
                    if (b == null) using (var im = Image.FromStream(ms)) b = new Bitmap(im);
                    if (b.Width >= 16) return b;
                    b.Dispose();
                }
            }
            catch { }
        }
        return null;
    }

    // ── 기본 그림 16개(exe 안에 묻은 PNG → 도우미 폴더 icons\기본\) ──
    public static string BuiltinDir;
    public static void ExtractBuiltins(string dir)
    {
        BuiltinDir = dir;
        try
        {
            Directory.CreateDirectory(dir);
            var asm = Assembly.GetExecutingAssembly();
            // exe 가 바뀌어 묻은 그림이 달라졌으면 덮어쓴다(그림 크기들을 .ver 에 적어 둠, DeckLibrary.Extract 와 같은 방식)
            var sizes = new StringBuilder();
            foreach (var k in DeckConfig.Keys)
                using (var s = asm.GetManifestResourceStream("deck." + k + ".png")) sizes.Append(s != null ? s.Length : 0).Append(',');
            string ver = Path.Combine(dir, ".ver"), want = sizes.ToString();
            bool same = false, allOk = true;
            try { same = File.Exists(ver) && File.ReadAllText(ver) == want; } catch { }
            foreach (var k in DeckConfig.Keys)
            {
                string f = Path.Combine(dir, k + ".png");
                if (same && File.Exists(f)) continue;
                try
                {
                    using (var s = asm.GetManifestResourceStream("deck." + k + ".png"))
                        if (s != null) using (var fs = File.Create(f)) s.CopyTo(fs);
                }
                catch { allOk = false; }   // 다른 곳에서 그림을 쓰는 중이면 다음에
            }
            if (allOk && !same) try { File.WriteAllText(ver, want); } catch { }
        }
        catch { }
    }

    public static Bitmap Builtin(string key)
    {
        try
        {
            if (BuiltinDir != null)
            {
                string f = Path.Combine(BuiltinDir, key + ".png");
                if (File.Exists(f)) using (var fs = new FileStream(f, FileMode.Open, FileAccess.Read)) using (var im = Image.FromStream(fs)) return new Bitmap(im);
            }
            using (var s = Assembly.GetExecutingAssembly().GetManifestResourceStream("deck." + key + ".png"))
                if (s != null) using (var im = Image.FromStream(s)) return new Bitmap(im);
        }
        catch { }
        return null;
    }

    // 칸 하나의 72x72 그림을 설정대로 새로 만든다(favicon 은 인터넷 없이: 저장된 미리보기 → 글자)
    public static Bitmap MakeTile(DeckCell c, string savedPng)
    {
        try
        {
            switch (c.IconMode)
            {
                case "builtin":
                    return Builtin(c.IconSrc) ?? LetterTile(c.Name);
                case "auto":
                    if (c.Kind == "app")
                    {
                        using (var g = IconFromApp(c.IconSrc.Length > 0 ? c.IconSrc : c.Target)) if (g != null) return Tile(g);
                    }
                    break;
                case "file":
                    using (var g = IconFromFile(c.IconSrc)) return Tile(g);
                case "fileraw":                    // 테두리까지 그린 완성 그림: 틀을 또 씌우지 않는다
                    using (var g = IconFromFile(c.IconSrc)) return Fit72(g);
                case "library":                    // 아이콘 모음(이미 다크 사각으로 그려 둔 것)
                    { var b = DeckLibrary.Load(c.IconSrc); if (b != null) return b; }
                    break;
                case "favicon":
                    if (savedPng != null && File.Exists(savedPng)) using (var fs = new FileStream(savedPng, FileMode.Open, FileAccess.Read)) using (var im = Image.FromStream(fs)) return new Bitmap(im);
                    break;
            }
        }
        catch { }
        return LetterTile(c.Name);
    }
}
