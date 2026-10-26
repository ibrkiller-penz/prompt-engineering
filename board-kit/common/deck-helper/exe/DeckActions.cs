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
                Clipboard.SetText(t);
                KeySend.Send("^v");
                if (OptX.Get(opt, "enter") == "1") { Thread.Sleep(120); KeySend.Send("{ENTER}"); }
                return;
            case "url":
            {
                if (!Regex.IsMatch(t, "^[a-zA-Z][a-zA-Z0-9+.-]*:")) t = "https://" + t;
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
                if (OptX.Get(opt, "front") == "1" && BringToFront(t)) return;
                var psi = new ProcessStartInfo(t) { UseShellExecute = true };
                string args = OptX.Get(opt, "args"), dir = OptX.Get(opt, "dir");
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
        if (c == null) return false;
        if (c.Kind == "multi")
        {
            var steps = new List<DeckStep>();
            foreach (var s in c.Steps) if (s.Target.Trim().Length > 0) steps.Add(s.Clone());
            if (steps.Count == 0) return false;
            string name = c.Name;
            var th = new Thread(delegate ()
            {
                for (int i = 0; i < steps.Count; i++)
                {
                    var s = steps[i];
                    try { ui.Send(delegate { Exec(s.Kind, s.Target, s.Opt); }, null); }
                    catch (Exception ex) { if (log != null) log("여러 동작 '" + name + "' " + (i + 1) + "번째 실패: " + ex.Message); }
                    if (i < steps.Count - 1 && s.Wait > 0) Thread.Sleep(Math.Min(10000, s.Wait));
                }
            });
            th.IsBackground = true;
            th.Start();
            return true;
        }
        Exception err = null;
        ui.Send(delegate { try { Exec(c.Kind, c.Target, c.Opt); } catch (Exception ex) { err = ex; } }, null);
        if (err != null) { if (log != null) log("열기 실패: " + c.Name + " (" + err.Message + ")"); throw err; }
        return true;
    }

    // ── 이미 열린 프로그램 창을 앞으로 ──
    [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] static extern bool ShowWindow(IntPtr h, int cmd);
    [DllImport("user32.dll")] static extern bool IsIconic(IntPtr h);

    static bool BringToFront(string target)
    {
        try
        {
            string path = DeckIcons.ResolveApp(target) ?? target;
            string lnk = path.EndsWith(".lnk", StringComparison.OrdinalIgnoreCase) ? DeckIcons.LnkTarget(path) : null;
            if (lnk != null) path = lnk;
            if (!path.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) return false;
            string name = Path.GetFileNameWithoutExtension(path);
            foreach (var p in Process.GetProcessesByName(name))
            {
                IntPtr h = p.MainWindowHandle;
                if (h == IntPtr.Zero) continue;
                if (IsIconic(h)) ShowWindow(h, 9);   // SW_RESTORE
                KeySend.Tap(0x12);                   // Alt 한 번: 다른 프로그램 창을 앞으로 올릴 수 있게(윈도의 앞창 제한)
                SetForegroundWindow(h);
                return true;
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
        foreach (var m in mods) Key(m, false);
        for (int i = 0; i < Math.Max(1, times); i++) { Key(vk, false); Thread.Sleep(5); Key(vk, true); Thread.Sleep(5); }
        for (int i = mods.Count - 1; i >= 0; i--) Key(mods[i], true);
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
                int depth = 1, j = i + 1;
                while (j < s.Length && depth > 0) { if (s[j] == '(') depth++; else if (s[j] == ')') depth--; if (depth > 0) j++; }
                string inner = s.Substring(i + 1, Math.Max(0, j - i - 1));
                foreach (var m in mods) Key(m, false);
                Send(inner);
                for (int k = mods.Count - 1; k >= 0; k--) Key(mods[k], true);
                mods.Clear();
                i = Math.Min(s.Length, j + 1);
                continue;
            }
            if (c == '{')
            {
                int end = s.IndexOf('}', i + 2);       // {}} 처럼 } 자체도 되게 i+2 부터 찾는다
                if (end < 0) end = s.Length - 1;
                string body = s.Substring(i + 1, end - i - 1);
                int times = 1;
                var mm = Regex.Match(body, "^(.+?) (\\d+)$");
                if (mm.Success) { body = mm.Groups[1].Value; times = Math.Min(50, int.Parse(mm.Groups[2].Value)); }
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
                int j = s.IndexOf(')', i);
                if (j < 0) j = s.Length;
                key = Describe(s.Substring(i + 1, Math.Max(0, j - i - 1)));
                i = j + 1;
            }
            else if (c == '{')
            {
                int end = s.IndexOf('}', i + 2);
                if (end < 0) end = s.Length - 1;
                string body = s.Substring(i + 1, Math.Max(0, end - i - 1));
                string times = "";
                var mm = Regex.Match(body, "^(.+?) (\\d+)$");
                if (mm.Success) { body = mm.Groups[1].Value; times = " ×" + mm.Groups[2].Value; }
                string n;
                key = (Nice.TryGetValue(body, out n) ? n : body.Length == 1 ? body.ToUpperInvariant() : body.ToUpperInvariant()) + times;
                i = end + 1;
            }
            else if (c == '~') { key = "Enter"; i++; }
            else if (c == ' ') { key = "Space"; i++; }
            else { key = c.ToString().ToUpperInvariant(); i++; }
            var all = new List<string>(mods); all.Add(key);
            parts.Add(string.Join(" + ", all.ToArray()));
            mods.Clear();
        }
        return string.Join(", ", parts.ToArray());
    }
}
