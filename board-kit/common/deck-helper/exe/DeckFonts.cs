// DeckFonts.cs — 프로그램 글꼴: 에스코어 드림 3 Light / 4 Regular / 5 Medium (C# 5 문법만)
//
// 글꼴 파일(fonts\SCDream3.otf, SCDream4.otf, SCDream5.otf)은 build_exe.ps1 이 exe 안에
// 'deck.font3' 'deck.font4' 'deck.font5' 라는 이름으로 묻는다. 사용자 PC에 설치할 필요 없다.
//
// ※ 라이선스(fonts\LICENSE_SCDream.txt): 에스코어 드림은 "폰트 파일을 수정할 수 없고 배포되는 파일
//   형태 그대로" 써야 한다. 그래서 공식 OTF 를 한 바이트도 바꾸지 않고 묻는다(ttf 변환·글자 줄이기 금지).
//   이 OTF 는 CFF 윤곽이지만 윈도 10·11 의 GDI+ 는 그대로 읽는다(2026-10 이 PC에서 그려 보고 확인).
//
// 쓰는 법:  label.Font = DeckFonts.Regular(10f);   g.DrawString(글, DeckFonts.Medium(12f), ...)
//   - 같은 크기·굵기는 한 번 만든 Font 를 다시 돌려준다(따로 Dispose 하지 말 것).
//   - 글꼴을 못 읽으면 "Malgun Gothic"(맑은 고딕)으로 대신한다. DeckFonts.Loaded 로 확인.
//
// 그리기 권장:
//   - 직접 그릴 때(OnPaint·타일)는 Graphics.DrawString 에
//     g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit 를 쓴다(가장 확실하다).
//   - TextRenderer(GDI)와 일반 컨트롤(Label·Button 등)은 GDI+ 의 PrivateFontCollection 글꼴을
//     모르기 때문에 제대로 안 그려질 수 있다(맑은 고딕 등으로 바뀜). 그래서 여기서 GDI 에도
//     AddFontMemResourceEx 로 이 프로그램 안에서만 보이게 등록해 둔다 — 그래도 모양이 다르면
//     해당 컨트롤은 직접 그리기(DrawString)로 바꾼다.
//
// AddMemoryFont 주의: 넘긴 메모리는 글꼴을 쓰는 동안 계속 살아 있고 자리가 바뀌면 안 된다.
//   그래서 byte[] 를 GC 가 옮기지 못하는 Marshal.AllocCoTaskMem 메모리에 복사해 두고 해제하지 않는다
//   (프로그램이 끝날 때 운영체제가 거둔다).
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Drawing.Text;
using System.IO;
using System.Reflection;
using System.Runtime.InteropServices;

static class DeckFonts
{
    public const string Fallback = "Malgun Gothic";

    static readonly object gate = new object();
    static bool tried;
    static PrivateFontCollection pfc;
    static FontFamily fam3, fam4, fam5;            // 3 Light, 4 Regular, 5 Medium
    static readonly List<IntPtr> pinned = new List<IntPtr>();   // 일부러 풀지 않는다(위 주석)
    static readonly Dictionary<string, Font> cache = new Dictionary<string, Font>();

    [DllImport("gdi32.dll")]
    static extern IntPtr AddFontMemResourceEx(IntPtr pbFont, uint cbFont, IntPtr pdv, out uint pcFonts);

    /// <summary>에스코어 드림 3 개를 모두 읽었으면 true(하나라도 못 읽으면 그 굵기만 맑은 고딕).</summary>
    public static bool Loaded { get { Init(); return fam3 != null && fam4 != null && fam5 != null; } }

    /// <summary>에스코어 드림 3 Light — 보조 글·설명.</summary>
    public static Font Light(float size) { return Get(3, size, FontStyle.Regular); }
    /// <summary>에스코어 드림 4 Regular — 기본 글.</summary>
    public static Font Regular(float size) { return Get(4, size, FontStyle.Regular); }
    /// <summary>에스코어 드림 5 Medium — 제목·단추·고른 칸.</summary>
    public static Font Medium(float size) { return Get(5, size, FontStyle.Regular); }

    /// <summary>굵기 번호(3·4·5)로 고르기. 다른 번호는 가까운 쪽으로.</summary>
    public static Font ByWeight(int weight, float size)
    {
        return Get(weight <= 3 ? 3 : (weight >= 5 ? 5 : 4), size, FontStyle.Regular);
    }

    static Font Get(int w, float size, FontStyle style)
    {
        Init();
        if (size <= 0f) size = 9f;
        string key = w + "|" + size.ToString("0.###", System.Globalization.CultureInfo.InvariantCulture) + "|" + (int)style;
        lock (gate)
        {
            Font f;
            if (cache.TryGetValue(key, out f)) return f;
            FontFamily fam = w == 3 ? fam3 : (w == 5 ? fam5 : fam4);
            f = null;
            if (fam != null)
            {
                try
                {
                    // 이 글꼴은 Regular 하나뿐이다. Bold 를 달라면 GDI+ 가 흉내(굵게 칠함)로 그린다.
                    FontStyle st = fam.IsStyleAvailable(style) ? style : FontStyle.Regular;
                    f = new Font(fam, size, st, GraphicsUnit.Point);
                }
                catch { f = null; }
            }
            if (f == null)
            {
                FontStyle fs = style;
                if (w >= 5 && style == FontStyle.Regular) fs = FontStyle.Bold;   // 맑은 고딕엔 Medium 이 없어 굵게로 대신
                try { f = new Font(Fallback, size, fs, GraphicsUnit.Point); }
                catch { f = new Font(SystemFonts.DefaultFont.FontFamily, size, fs, GraphicsUnit.Point); }
            }
            cache[key] = f;
            return f;
        }
    }

    static void Init()
    {
        lock (gate)
        {
            if (tried) return;
            tried = true;
            try
            {
                pfc = new PrivateFontCollection();
                fam3 = Load(3);
                fam4 = Load(4);
                fam5 = Load(5);
            }
            catch { }
        }
    }

    // exe 리소스 'deck.font{n}' → 고정 메모리 → GDI+ 와 GDI 양쪽에 등록 → 새로 생긴 글꼴 집안을 찾아 돌려준다.
    static FontFamily Load(int n)
    {
        try
        {
            byte[] data = ReadResource("deck.font" + n);
            if (data == null || data.Length == 0) return null;
            IntPtr mem = Marshal.AllocCoTaskMem(data.Length);
            Marshal.Copy(data, 0, mem, data.Length);
            pinned.Add(mem);

            HashSet<string> before = new HashSet<string>();
            foreach (FontFamily ff in pfc.Families) before.Add(ff.Name);
            pfc.AddMemoryFont(mem, data.Length);

            uint count;
            try { AddFontMemResourceEx(mem, (uint)data.Length, IntPtr.Zero, out count); } catch { }   // TextRenderer·컨트롤용

            FontFamily found = null;
            foreach (FontFamily ff in pfc.Families)
            {
                if (before.Contains(ff.Name)) continue;
                found = ff;
                break;
            }
            if (found == null)   // 이름으로 한 번 더(예: "S-Core Dream 4 Regular")
            {
                string tag = " " + n + " ";
                foreach (FontFamily ff in pfc.Families)
                    if ((" " + ff.Name + " ").IndexOf(tag, StringComparison.Ordinal) >= 0) { found = ff; break; }
            }
            return found;
        }
        catch { return null; }
    }

    static byte[] ReadResource(string name)
    {
        Assembly asm = Assembly.GetExecutingAssembly();
        using (Stream s = asm.GetManifestResourceStream(name))
        {
            if (s == null) return null;
            using (MemoryStream ms = new MemoryStream())
            {
                s.CopyTo(ms);
                return ms.ToArray();
            }
        }
    }
}
