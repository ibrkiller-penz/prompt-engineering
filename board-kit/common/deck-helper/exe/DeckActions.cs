// DeckActions.cs — 칸 실행: 자세한 설정(인자·시작 폴더·관리자·앞으로 가져오기 / 브라우저·새 창 / 넣고 Enter),
// '여러 동작' 차례 실행, 단축키 보내기(KeySend: Win 키 # 까지), 단축키를 사람이 읽는 글로(KeyText). C# 5 문법만
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;

static class DeckRun
{
    public static readonly string[] BrowserCodes = { "", "chrome", "msedge", "whale", "firefox" };
    public static readonly string[] BrowserNames = { "기본 브라우저", "크롬", "엣지", "웨일", "파이어폭스" };
    public const int MaxSteps = 12;

    // 하나 실행(화면 스레드에서). 실패하면 예외
    public static void Exec(string kind, string t, Dictionary<string, string> opt)
    {
        t = t ?? "";
        switch (kind)
        {
            case "keys":
                KeySend.Send(t);
                return;
            case "text":
            {
                // 원래 복사해 둔 것이 글자면 받아 두었다가, 붙여 넣은 뒤 되돌려 놓는다(그림·파일은 되돌리지 못함)
                string oldText = null;
                IDataObject old = null;
                try { old = Clipboard.GetDataObject(); } catch { }
                try { if (old != null && old.GetDataPresent(DataFormats.UnicodeText)) oldText = old.GetData(DataFormats.UnicodeText) as string; } catch { }
                Clipboard.SetDataObject(t, true, 10, 50);   // 다른 프로그램이 클립보드를 잡고 있으면 50ms 씩 10번 다시 해 본다
                KeySend.Send("^v");
                if (OptX.Get(opt, "enter") == "1") { Thread.Sleep(120); KeySend.Send("{ENTER}"); }
                if (oldText != null)
                {
                    Thread.Sleep(400);   // 받는 프로그램이 붙여 넣기를 끝낼 시간
                    try { Clipboard.SetDataObject(oldText, true, 10, 50); } catch { }
                }
                return;
            }
            case "url":
            {
                t = t.Trim();
                if (!UrlX.HasScheme(t)) t = "https://" + t;
                string br = OptX.Get(opt, "browser");
                bool nw = OptX.Get(opt, "newwin") == "1";
                if (br.Length > 0)
                {
                    string exe = DeckIcons.ResolveApp(br);
                    if (exe != null)
                    {
                        string a = (nw ? (br == "firefox" ? "-new-window " : "--new-window ") : "") + "\"" + t + "\"";
                        Process.Start(new ProcessStartInfo(exe, a) { UseShellExecute = true });
                        return;
                    }
                }
                Process.Start(new ProcessStartInfo(t) { UseShellExecute = true });
                return;
            }
            case "app":
            {
                string args = OptX.Get(opt, "args"), dir = OptX.Get(opt, "dir");
                // 넘길 값(args)이 있으면 열린 창을 앞으로 가져오지 않고 새로 연다(값이 버려지지 않게)
                if (OptX.Get(opt, "front") == "1" && args.Length == 0 && BringToFront(t)) return;
                var psi = new ProcessStartInfo(t) { UseShellExecute = true };
                if (args.Length > 0) psi.Arguments = args;
                if (dir.Length > 0 && Directory.Exists(dir)) psi.WorkingDirectory = dir;
                if (OptX.Get(opt, "admin") == "1") psi.Verb = "runas";
                Process.Start(psi);
                return;
            }
            default:
                Helper.Exec(kind, t);
                return;
        }
    }

    // 보드 칸·[눌러 보기]: 한 동작은 바로, '여러 동작'은 따로 스레드에서 차례대로(기다리는 동안 보드 통신이 멈추지 않게)
    public static bool Run(DeckCell c, SynchronizationContext ui, Action<string> log)
    {
        return Run(c, ui, log, null);
    }

    // fail: '여러 동작' 중 실패한 단계를 화면에 알려 줌(화면 스레드에서 불림)
    public static bool Run(DeckCell c, SynchronizationContext ui, Action<string> log, Action<string> fail)
    {
        return Run(c, ui, log, fail, null);
    }

    // done: 모든 동작이 끝난 뒤 한 번(화면 스레드에서 불림). 실패한 단계 문구 목록을 준다(모두 됐으면 빈 목록)
    //  '여러 동작' 문구: "N번째 동작을 하지 못했어요 (쉬운 이유)" / 한 동작: "동작을 하지 못했어요 (쉬운 이유)"
    public static bool Run(DeckCell c, SynchronizationContext ui, Action<string> log, Action<string> fail, Action<List<string>> done)
    {
        if (c == null) return false;
        if (c.Kind == "multi")
        {
            var steps = new List<DeckStep>();
            foreach (var s in c.Steps) if (s.Target.Trim().Length > 0) steps.Add(s.Clone());
            if (steps.Count == 0) return false;
            string name = c.Name;
            var th = new Thread(delegate ()
            {
                var fails = new List<string>();
                for (int i = 0; i < steps.Count; i++)
                {
                    var s = steps[i];
                    try { ui.Send(delegate { Exec(s.Kind, s.Target, s.Opt); }, null); }
                    catch (Exception ex)
                    {
                        if (log != null) log("여러 동작 '" + name + "' " + (i + 1) + "번째 실패: " + ex.Message);
                        string msg = (i + 1) + "번째 동작을 하지 못했어요 (" + ErrText.Easy(ex) + ")";
                        fails.Add(msg);
                        if (fail != null)
                        {
                            try { ui.Post(delegate { try { fail(msg); } catch { } }, null); } catch { }
                        }
                    }
                    if (i < steps.Count - 1 && s.Wait > 0) Thread.Sleep(Math.Min(10000, s.Wait));
                }
                if (done != null)
                {
                    try { ui.Post(delegate { try { done(fails); } catch { } }, null); } catch { }
                }
            });
            th.IsBackground = true;
            th.Start();
            return true;
        }
        Exception err = null;
        ui.Send(delegate { try { Exec(c.Kind, c.Target, c.Opt); } catch (Exception ex) { err = ex; } }, null);
        if (done != null)
        {
            var one = new List<string>();
            if (err != null) one.Add("동작을 하지 못했어요 (" + ErrText.Easy(err) + ")");
            try { ui.Post(delegate { try { done(one); } catch { } }, null); } catch { }
        }
        if (err != null) { if (log != null) log("열기 실패: " + c.Name + " (" + err.Message + ")"); throw err; }
        return true;
    }

    // ── 이미 열린 프로그램 창을 앞으로 ──
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();

    static bool BringToFront(string target)
    {
        try
        {
            string path = DeckIcons.ResolveApp(target) ?? target;
            string lnk = path.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase) ? DeckIcons.LnkTarget(path) : null;
            if (lnk != null) path = lnk;
            if (!path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) return false;
            string name = Path.GetFileNameWithoutExtension(path);
            Process[] procs = Process.GetProcessesByName(name);
            try
            {
                IntPtr fg = GetForegroundWindow(), first = IntPtr.Zero;
                foreach (var p in procs)
                {
                    IntPtr h;
                    try { h = p.MainWindowHandle; } catch { continue; }
                    if (h == IntPtr.Zero) continue;
                    if (h == fg)
                    {   // 이미 맨 앞: Alt 를 누르지 않는다(Alt 가 메뉴 줄을 여는 프로그램이 있어서)
                        if (IsIconic(h)) ShowWindow(h, 9);   // SW_RESTORE
                        return true;
                    }
                    if (first == IntPtr.Zero) first = h;
                }
                if (first == IntPtr.Zero) return false;
                if (IsIconic(first)) ShowWindow(first, 9);   // SW_RESTORE
                KeySend.Tap(0x12);                           // Alt 한 번: 다른 프로그램 창을 앞으로 올릴 수 있게(윈도의 앞창 제한)
                SetForegroundWindow(first);
                return true;
            }
            finally
            {
                foreach (var p in procs) { try { p.Dispose(); } catch { } }
            }
        }
        catch { }
        return false;
    }
}

// ── 단축키 보내기: SendKeys 와 같은 글쓰기 + # = Win 키 ──
//  ^ Ctrl, + Shift, % Alt, # Win, ~ Enter, {ENTER} {F5} {TAB 3}, (묶음) 예) ^(ac), 글자 그대로는 {+} {^} {%} {~} {#} {(} {)} {{} {}}
static class KeySend
{
    [DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, int flags, IntPtr extra);
    [DllImport("user32.dll")] static extern uint MapVirtualKey(uint code, uint type);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern short VkKeyScan(char ch);

    public static readonly Dictionary<string, byte> Named = new Dictionary<string, byte>(StringComparer.OrdinalIgnoreCase) {
        { "ENTER", 0x0D }, { "TAB", 0x09 }, { "ESC", 0x1B }, { "ESCAPE", 0x1B }, { "BACKSPACE", 0x08 }, { "BS", 0x08 }, { "BKSP", 0x08 },
        { "DELETE", 0x2E }, { "DEL", 0x2E }, { "INSERT", 0x2D }, { "INS", 0x2D }, { "HOME", 0x24 }, { "END", 0x23 },
        { "PGUP", 0x21 }, { "PGDN", 0x22 }, { "UP", 0x26 }, { "DOWN", 0x28 }, { "LEFT", 0x25 }, { "RIGHT", 0x27 }, { "SPACE", 0x20 },
        { "ADD", 0x6B }, { "SUBTRACT", 0x6D }, { "MULTIPLY", 0x6A }, { "DIVIDE", 0x6F }, { "PRTSC", 0x2C }, { "CAPSLOCK", 0x14 },
        { "NUMLOCK", 0x90 }, { "SCROLLLOCK", 0x91 }, { "BREAK", 0x13 }, { "HELP", 0x2F }, { "WIN", 0x5B }, { "APPS", 0x5D } };
    static readonly byte[] Extended = { 0x21, 0x22, 0x23, 0x24, 0x25, 0x26, 0x27, 0x28, 0x2D, 0x2E, 0x5B, 0x5C, 0x5D, 0x6F, 0x90, 0x2C };

    static byte ModVk(char c) { return c == '^' ? (byte)0x11 : c == '+' ? (byte)0x10 : c == '%' ? (byte)0x12 : (byte)0x5B; }

    static void Key(byte vk, bool up)
    {
        int f = Array.IndexOf(Extended, vk) >= 0 ? 1 : 0;
        if (up) f |= 2;
        keybd_event(vk, (byte)MapVirtualKey(vk, 0), f, IntPtr.Zero);
    }
    public static void Tap(byte vk) { Key(vk, false); Key(vk, true); }

    static void TapWith(List<byte> mods, byte vk, int times)
    {
        int down = 0;
        try
        {
            foreach (var m in mods) { Key(m, false); down++; }
            for (int i = 0; i < Math.Max(1, times); i++) { Key(vk, false); Thread.Sleep(5); Key(vk, true); Thread.Sleep(5); }
        }
        finally
        {   // 중간에 예외가 나도 Ctrl·Alt·Win 이 눌린 채 남지 않게
            for (int i = down - 1; i >= 0; i--) Key(mods[i], true);
        }
        Thread.Sleep(15);
    }

    static void TapChar(List<byte> mods, char ch, int times)
    {
        short r = VkKeyScan(ch);
        if (r == -1)
        {   // 키보드에 없는 글자(한글 등): 앞 키를 쓰지 않고 SendKeys 로 글자만
            for (int i = 0; i < Math.Max(1, times); i++) SendKeys.SendWait(Regex.Replace(ch.ToString(), "[+^%~(){}\\[\\]]", "{$0}"));
            return;
        }
        var all = new List<byte>(mods);
        int st = (r >> 8) & 0xff;
        if ((st & 1) != 0 && !all.Contains(0x10)) all.Add(0x10);
        if ((st & 2) != 0 && !all.Contains(0x11)) all.Add(0x11);
        if ((st & 4) != 0 && !all.Contains(0x12)) all.Add(0x12);
        TapWith(all, (byte)(r & 0xff), times);
    }

    // ( 의 짝 ) 위치(깊이를 센다). 짝이 없으면 s.Length
    public static int CloseParen(string s, int i)
    {
        int depth = 1, j = i + 1;
        while (j < s.Length && depth > 0) { if (s[j] == '(') depth++; else if (s[j] == ')') depth--; if (depth > 0) j++; }
        return j;
    }

    // { 의 짝 } 위치. {}} 처럼 } 자체도 되게 i+2 부터 찾는다. 짝이 없으면 s.Length(끝까지)
    public static int CloseBrace(string s, int i)
    {
        int end = (i + 2 <= s.Length) ? s.IndexOf('}', i + 2) : -1;
        return end < 0 ? s.Length : end;
    }

    // {키 N} 의 N: 숫자가 아니거나 너무 크면 50 으로 자른다
    public static int Repeat(string n)
    {
        int v;
        if (!int.TryParse(n, out v) || v > 50) return 50;
        return Math.Max(1, v);
    }

    public static void Send(string s)
    {
        s = s ?? "";
        int i = 0;
        var mods = new List<byte>();
        while (i < s.Length)
        {
            char c = s[i];
            if (c == '^' || c == '+' || c == '%' || c == '#')
            {
                byte m = ModVk(c);
                if (!mods.Contains(m)) mods.Add(m);
                i++;
                if (i >= s.Length) { TapWith(new List<byte>(), m, 1); break; }   // 끝에 혼자 있는 # = Win 키만 누르기
                continue;
            }
            if (c == '(')
            {
                int j = CloseParen(s, i);
                string inner = s.Substring(i + 1, Math.Max(0, j - i - 1));
                int down = 0;
                try
                {
                    foreach (var m in mods) { Key(m, false); down++; }
                    Send(inner);
                }
                finally
                {   // 안쪽에서 예외가 나도 앞 키를 꼭 뗀다
                    for (int k = down - 1; k >= 0; k--) Key(mods[k], true);
                }
                mods.Clear();
                i = Math.Min(s.Length, j + 1);
                continue;
            }
            if (c == '{')
            {
                int end = CloseBrace(s, i);
                string body = s.Substring(i + 1, Math.Max(0, end - i - 1));
                int times = 1;
                var mm = Regex.Match(body, "^(.+?) (\\d+)$");
                if (mm.Success) { body = mm.Groups[1].Value; times = Repeat(mm.Groups[2].Value); }
                byte vk;
                var fk = Regex.Match(body, "^F([1-9]|1[0-9]|2[0-4])$", RegexOptions.IgnoreCase);
                if (fk.Success) TapWith(mods, (byte)(0x6F + int.Parse(fk.Groups[1].Value)), times);
                else if (Named.TryGetValue(body, out vk)) TapWith(mods, vk, times);
                else if (body.Length == 1) TapChar(mods, body[0], times);
                mods.Clear();
                i = end + 1;
                continue;
            }
            if (c == '~') TapWith(mods, 0x0D, 1);
            else TapChar(mods, c, 1);
            mods.Clear();
            i++;
        }
    }
}

// 단축키 글 → 사람이 읽는 글(예: "^+m" → "Ctrl + Shift + M")
static class KeyText
{
    static readonly Dictionary<string, string> Nice = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase) {
        { "ENTER", "Enter" }, { "TAB", "Tab" }, { "ESC", "Esc" }, { "ESCAPE", "Esc" }, { "BACKSPACE", "Backspace" }, { "BS", "Backspace" }, { "BKSP", "Backspace" },
        { "DELETE", "Delete" }, { "DEL", "Delete" }, { "INSERT", "Insert" }, { "INS", "Insert" }, { "HOME", "Home" }, { "END", "End" },
        { "PGUP", "PageUp" }, { "PGDN", "PageDown" }, { "UP", "↑" }, { "DOWN", "↓" }, { "LEFT", "←" }, { "RIGHT", "→" }, { "SPACE", "Space" },
        { "ADD", "숫자판 +" }, { "SUBTRACT", "숫자판 -" }, { "MULTIPLY", "숫자판 *" }, { "DIVIDE", "숫자판 /" }, { "PRTSC", "PrintScreen" },
        { "CAPSLOCK", "CapsLock" }, { "NUMLOCK", "NumLock" }, { "WIN", "Win" }, { "APPS", "메뉴 키" } };

    public static string Describe(string s)
    {
        s = s ?? "";
        var parts = new List<string>();
        var mods = new List<string>();
        int i = 0;
        while (i < s.Length)
        {
            char c = s[i];
            string m = c == '^' ? "Ctrl" : c == '+' ? "Shift" : c == '%' ? "Alt" : c == '#' ? "Win" : null;
            if (m != null) { if (!mods.Contains(m)) mods.Add(m); i++; if (i >= s.Length) { parts.Add(string.Join(" + ", mods.ToArray())); mods.Clear(); } continue; }
            string key;
            if (c == '(')
            {
                int j = KeySend.CloseParen(s, i);
                key = Describe(s.Substring(i + 1, Math.Max(0, j - i - 1)));
                i = j + 1;
            }
            else if (c == '{')
            {
                int end = KeySend.CloseBrace(s, i);
                string body = s.Substring(i + 1, Math.Max(0, end - i - 1));
                string times = "";
                var mm = Regex.Match(body, "^(.+?) (\\d+)$");
                if (mm.Success) { body = mm.Groups[1].Value; times = " ×" + KeySend.Repeat(mm.Groups[2].Value); }
                string n;
                key = (Nice.TryGetValue(body, out n) ? n : body.ToUpperInvariant()) + times;
                if (body.Length == 1 && body[0] >= 'A' && body[0] <= 'Z' && !mods.Contains("Shift")) mods.Add("Shift");   // 대문자는 Shift 가 함께 눌린다(Send 와 같게)
                i = end + 1;
            }
            else if (c == '~') { key = "Enter"; i++; }
            else if (c == ' ') { key = "Space"; i++; }
            else
            {
                key = c.ToString().ToUpperInvariant();
                if (c >= 'A' && c <= 'Z' && !mods.Contains("Shift")) mods.Add("Shift");   // 대문자는 Shift 가 함께 눌린다(Send 와 같게)
                i++;
            }
            var all = new List<string>(mods); all.Add(key);
            parts.Add(string.Join(" + ", all.ToArray()));
            mods.Clear();
        }
        return string.Join(", ", parts.ToArray());
    }
}

// 주소인지 가리기: "https://", "mailto:" 처럼 앞에 방식이 붙었는지(localhost:3000·naver.com:8080 은 방식이 아님)
static class UrlX
{
    // ://  또는  두 글자 이상 이름 + ':' 다음이 숫자가 아님(steam:rungameid, slack:open, mailto:). localhost:3000·naver.com:8080 은 아님, C:\ 도 아님
    static readonly Regex Scheme = new Regex("^([a-zA-Z][a-zA-Z0-9+.-]*://|[a-zA-Z][a-zA-Z0-9+-]+:(?![0-9]))", RegexOptions.IgnoreCase);
    public static bool HasScheme(string t) { return t != null && Scheme.IsMatch(t.Trim()); }
    public static bool IsWeb(string t)
    {
        if (t == null) return false;
        t = t.Trim();
        return t.StartsWith("http://", StringComparison.OrdinalIgnoreCase) || t.StartsWith("https://", StringComparison.OrdinalIgnoreCase);
    }
}

// 예외를 쉬운 한국어로(원문은 기록에만 남긴다)
static class ErrText
{
    public static string Easy(Exception ex)
    {
        if (ex == null) return "알 수 없는 문제가 생겼어요";
        var w = ex as System.ComponentModel.Win32Exception;
        if (w != null)
        {
            if (w.NativeErrorCode == 2 || w.NativeErrorCode == 3) return "파일이나 프로그램을 찾지 못했어요";
            if (w.NativeErrorCode == 1223) return "실행을 취소했어요";
            if (w.NativeErrorCode == 5) return "권한이 없어요";
            return "열지 못했어요";
        }
        if (ex is FileNotFoundException || ex is DirectoryNotFoundException) return "파일이나 폴더를 찾지 못했어요";
        if (ex is UnauthorizedAccessException) return "권한이 없어 읽거나 쓸 수 없어요";
        if (ex is PathTooLongException) return "파일 경로가 너무 길어요";
        if (ex is IOException) return "다른 프로그램이 파일을 쓰고 있거나 읽고 쓸 수 없어요";
        if (ex is FormatException || ex is ArgumentException || ex is InvalidDataException || ex is InvalidCastException) return "파일 내용이 올바르지 않아요";
        if (ex is OutOfMemoryException) return "파일이 너무 크거나 그림 파일이 아니에요";
        return "알 수 없는 문제가 생겼어요";
    }
}

// 지금 맨 앞 창을 N번 모니터로 옮겨 최대화(탭덱 '컴퓨터 기능' #mon1~#mon4, 2026-10-29).
// 번호: 윈도 디스플레이 이름(\.\DISPLAYn)의 n 이 작은 차례(디스플레이 설정의 1·2·3·4 와 같다. 사이가 비면 다음 것).
// 탭덱은 화면 배율을 모르는 앱이라(app.manifest), 이 일을 하는 동안만 스레드를 '모니터마다 배율' 모드로 바꿔 실제 픽셀로 다룬다.
static class WinMove
{
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern IntPtr GetShellWindow();
    [DllImport("user32.dll")] static extern IntPtr GetAncestor(IntPtr h, uint flags);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);
    [DllImport("user32.dll")] static extern bool IsZoomed(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll", SetLastError = true)] static extern bool SetWindowPos(IntPtr h, IntPtr after, int x, int y, int w, int hh, uint flags);
    [DllImport("user32.dll")] static extern IntPtr SetThreadDpiAwarenessContext(IntPtr ctx);
    [DllImport("user32.dll")] static extern bool EnumDisplayMonitors(IntPtr hdc, IntPtr clip, MonProc cb, IntPtr data);
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern bool GetMonitorInfo(IntPtr mon, ref MonInfo mi);
    delegate bool MonProc(IntPtr mon, IntPtr hdc, ref Rect r, IntPtr data);
    [StructLayout(LayoutKind.Sequential)] struct Rect { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Unicode)]
    struct MonInfo { public int Size; public Rect Mon; public Rect Work; public uint Flags; [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 32)] public string Device; }

    public static void ToMonitor(int n)
    {
        IntPtr w = GetForegroundWindow();
        if (w != IntPtr.Zero) w = GetAncestor(w, 2);   // GA_ROOT: 창 안의 조각이 아니라 바깥 창
        if (w == IntPtr.Zero || w == GetShellWindow()) throw new InvalidOperationException("옮길 창이 없어요(먼저 창을 하나 눌러 두세요)");
        Move(w, n);
    }

    // 창 하나를 N번 모니터로 옮겨 최대화(시험에서는 창을 직접 넘긴다)
    public static void Move(IntPtr w, int n)
    {
        IntPtr old = IntPtr.Zero;
        try { old = SetThreadDpiAwarenessContext(new IntPtr(-4)); } catch (EntryPointNotFoundException) { }   // PER_MONITOR_AWARE_V2(윈도 10 1607 이상)
        try
        {
            var mons = new List<KeyValuePair<int, Rect>>();
            MonProc cb = delegate (IntPtr mon, IntPtr hdc, ref Rect r, IntPtr d)
            {
                var mi = new MonInfo(); mi.Size = Marshal.SizeOf(typeof(MonInfo));
                if (GetMonitorInfo(mon, ref mi))
                {
                    var m = Regex.Match(mi.Device ?? "", @"(\d+)$");
                    mons.Add(new KeyValuePair<int, Rect>(m.Success ? int.Parse(m.Groups[1].Value) : 999, mi.Work));
                }
                return true;
            };
            EnumDisplayMonitors(IntPtr.Zero, IntPtr.Zero, cb, IntPtr.Zero);
            GC.KeepAlive(cb);
            mons.Sort(delegate (KeyValuePair<int, Rect> a, KeyValuePair<int, Rect> b) { return a.Key.CompareTo(b.Key); });
            if (n < 1 || n > mons.Count) throw new InvalidOperationException(n + "번 모니터가 없어요(이 컴퓨터 모니터 " + mons.Count + "대)");
            Rect wa = mons[n - 1].Value;
            if (IsIconic(w) || IsZoomed(w)) ShowWindow(w, 9);   // SW_RESTORE: 최대화된 창은 풀어야 옮겨진다
            int ww = (wa.R - wa.L) * 3 / 4, wh = (wa.B - wa.T) * 3 / 4;
            if (!SetWindowPos(w, IntPtr.Zero, wa.L + (wa.R - wa.L - ww) / 2, wa.T + (wa.B - wa.T - wh) / 2, ww, wh, 0x0004 | 0x0010))   // NOZORDER|NOACTIVATE
                throw new InvalidOperationException("이 창은 옮길 수 없어요(관리자 권한으로 열린 창일 수 있어요)");
            ShowWindow(w, 3);   // SW_MAXIMIZE: 지금 놓인 모니터에서 최대화
        }
        finally { if (old != IntPtr.Zero) try { SetThreadDpiAwarenessContext(old); } catch { } }
    }
}
