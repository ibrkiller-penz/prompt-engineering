// ════ Claude 사무실 — 이 컴퓨터의 Claude Code 기록(%USERPROFILE%\.claude\projects\*\*.jsonl)을 2초마다 훑어 작업마다 지금 상태를 알아내고,
//  보드에 '@ag 자리,캐릭터,상태,이름;…' 으로 알린다(사용자 지시 2026-11-01, Pixel Agents(MIT, pixel-agents-hq/pixel-agents) 를 본뜸).
//  상태: w 일하는 중(타자) · r 읽는 중 · q 허락 기다림 · d 끝남(선생님 차례) · i 쉬는 중(끝나고 10분 넘음)
//  기록은 이 컴퓨터에서 상태를 가리는 데만 쓰고, 보드에는 작업 제목(앞 12자)과 상태 글자만 간다 ══
using System;
using System.Collections.Generic;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

static class ClaudeAgents
{
    static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude", "projects");
    public const int Max = 6;                     // 보드의 책상 수
    public static volatile string Line = "@ag";   // 보드에 보낼 줄(작업이 없으면 '@ag')
    static DateTime next = DateTime.MinValue;
    static volatile bool busy;
    static DateTime busyAt;   // 훑기를 시작한 때. 1분 넘게 안 끝나면 걸린 것으로 보고 새로 훑는다(2026-11-03 탭덱이 멈춰 사무실이 비었다)

    class Seat { public int Slot, Chr; }
    class Info { public DateTime Mt; public long Len; public string State, Tool, Name; }
    static readonly Dictionary<string, Seat> seats = new Dictionary<string, Seat>();
    static readonly Dictionary<string, Info> cache = new Dictionary<string, Info>();   // 파일이 안 바뀌었으면 다시 읽지 않는다

    static readonly Regex KindRx = new Regex("\"type\":\"(assistant|user|system)\"");
    static readonly Regex ToolRx = new Regex("\"type\":\"tool_use\",\"id\":\"[^\"]*\",\"name\":\"([^\"]+)\"");
    static readonly Regex SubRx = new Regex("\"subtype\":\"([a-z_]+)\"");
    static readonly Regex TitleRx = new Regex("\"customTitle\":\"((?:[^\"\\\\]|\\\\.)*)\"");
    static readonly Regex NameRx = new Regex("\"agentName\":\"((?:[^\"\\\\]|\\\\.)*)\"");
    static readonly Regex CwdRx = new Regex("\"cwd\":\"((?:[^\"\\\\]|\\\\.)*)\"");
    // 끝나는 데 시간이 걸리지 않는 도구: 기록이 8초 넘게 멈춰 있으면 허락을 기다리는 것으로 본다
    static readonly HashSet<string> AskTools = new HashSet<string> { "Edit", "Write", "MultiEdit", "NotebookEdit" };
    static readonly HashSet<string> ReadTools = new HashSet<string> { "Read", "Grep", "Glob", "LS", "WebFetch", "WebSearch", "NotebookRead", "ToolSearch" };

    // Loop 에서 자주 부른다. 2초마다 한 번 훑는다(따로 스레드)
    public static void Tick()
    {
        if ((busy && (DateTime.Now - busyAt).TotalMinutes < 1) || DateTime.Now < next) return;
        busy = true; busyAt = DateTime.Now; next = DateTime.Now.AddSeconds(2);
        new Thread(Scan) { IsBackground = true, Name = "claude agents" }.Start();
    }

    static void Scan()
    {
        try { Line = Build(); }
        catch (Exception ex) { Helper.Log("Claude 사무실: 훑기 실패 " + ex.GetType().Name); }
        busy = false;
    }

    static string Build()
    {
        var now = DateTime.UtcNow;
        var live = new List<KeyValuePair<string, DateTime>>();
        if (Directory.Exists(Root))
            foreach (var dir in Directory.GetDirectories(Root))
            {
                string[] files;
                try { files = Directory.GetFiles(dir, "*.jsonl"); } catch { continue; }   // 경로가 너무 긴 폴더 등
                foreach (var f in files)
                {
                    DateTime mt;
                    try { mt = File.GetLastWriteTimeUtc(f); } catch { continue; }
                    if ((now - mt).TotalMinutes < 60) live.Add(new KeyValuePair<string, DateTime>(f, mt));
                }
            }
        live.Sort(delegate (KeyValuePair<string, DateTime> a, KeyValuePair<string, DateTime> b) { return b.Value.CompareTo(a.Value); });
        if (live.Count > Max) live.RemoveRange(Max, live.Count - Max);

        var keep = new HashSet<string>();
        foreach (var kv in live) keep.Add(kv.Key);
        foreach (var k in new List<string>(seats.Keys)) if (!keep.Contains(k)) seats.Remove(k);
        foreach (var k in new List<string>(cache.Keys)) if (!keep.Contains(k)) cache.Remove(k);

        var parts = new List<string>();
        foreach (var kv in live)
        {
            Info inf = Read(kv.Key, kv.Value);
            if (inf == null || inf.State == null) continue;
            Seat s = SeatFor(kv.Key);
            double age = (now - kv.Value).TotalSeconds;
            string st = inf.State;
            if (st == "w" && inf.Tool != null && AskTools.Contains(inf.Tool) && age > 8) st = "q";
            else if (st == "w" && inf.Tool != null && ReadTools.Contains(inf.Tool)) st = "r";
            else if (st == "w" && inf.Tool == null && age > 300) st = "i";   // 도구도 없이 5분 넘게 멈춤 = 끊긴 작업
            if (st == "d" && age > 600) st = "i";
            parts.Add(s.Slot + "," + s.Chr + "," + st + "," + inf.Name);
        }
        return parts.Count == 0 ? "@ag" : "@ag " + string.Join(";", parts.ToArray());
    }

    // 자리(책상)와 캐릭터는 작업이 살아 있는 동안 바뀌지 않는다
    static Seat SeatFor(string f)
    {
        Seat s;
        if (seats.TryGetValue(f, out s)) return s;
        var usedSlot = new bool[Max]; var usedChr = new bool[Max];
        foreach (var o in seats.Values) { usedSlot[o.Slot] = true; usedChr[o.Chr] = true; }
        s = new Seat();
        while (s.Slot < Max - 1 && usedSlot[s.Slot]) s.Slot++;
        int h = 0; foreach (char c in Path.GetFileName(f)) h = h * 31 + c;
        s.Chr = (h & 0x7fffffff) % Max;
        for (int i = 0; i < Max && usedChr[s.Chr]; i++) s.Chr = (s.Chr + 1) % Max;
        seats[f] = s;
        return s;
    }

    static Info Read(string f, DateTime mt)
    {
        Info inf;
        long len;
        try { len = new FileInfo(f).Length; } catch { return null; }
        if (cache.TryGetValue(f, out inf) && inf.Mt == mt && inf.Len == len) return inf;
        inf = new Info { Mt = mt, Len = len };
        string tail;
        try
        {
            using (var fs = new FileStream(f, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
            {
                int n = (int)Math.Min(fs.Length, 1 << 20);
                fs.Seek(-n, SeekOrigin.End);
                var buf = new byte[n];
                int got = 0; while (got < n) { int r = fs.Read(buf, got, n - got); if (r <= 0) break; got += r; }
                tail = Encoding.UTF8.GetString(buf, 0, got);
            }
        }
        catch { return null; }
        var lines = tail.Split('\n');
        int first = lines.Length > 1 && len > (1 << 20) ? 1 : 0;   // 잘린 첫 줄은 버린다
        for (int i = lines.Length - 1; i >= first && inf.State == null; i--)
        {
            string ln = lines[i];
            if (ln.Length < 10 || ln.Contains("\"isSidechain\":true")) continue;
            var k = KindRx.Match(ln);
            if (!k.Success) continue;
            string kind = k.Groups[1].Value;
            if (kind == "system")
            {
                var sm = SubRx.Match(ln);
                string sub = sm.Success ? sm.Groups[1].Value : "";
                if (sub == "stop_hook_summary" || sub == "turn_duration") inf.State = "d";
            }
            else if (kind == "user")
                inf.State = ln.Contains("Request interrupted") || ln.Contains("<local-command-stdout>") ? "d" : "w";
            else
            {
                var tm = ToolRx.Matches(ln);
                if (tm.Count > 0) { inf.State = "w"; inf.Tool = tm[tm.Count - 1].Groups[1].Value; }
                else inf.State = ln.Contains("\"stop_reason\":\"end_turn\"") ? "d" : "w";
            }
        }
        inf.Name = Title(tail);
        cache[f] = inf;
        return inf;
    }

    static string Title(string tail)
    {
        string t = LastGroup(TitleRx, tail) ?? LastGroup(NameRx, tail);
        if (t == null)
        {
            string cwd = LastGroup(CwdRx, tail);
            if (cwd != null) { cwd = cwd.Replace("\\\\", "\\").TrimEnd('\\', '/'); int p = Math.Max(cwd.LastIndexOf('\\'), cwd.LastIndexOf('/')); t = cwd.Substring(p + 1); }
        }
        var sb = new StringBuilder();
        foreach (char c in t ?? "")
        {
            if (c == ',' || c == ';' || !DeckForm.CharOk(c)) continue;   // 보드 글꼴에 없는 글자·구분 기호는 뺀다
            if (sb.Length == 0 && c == ' ') continue;
            sb.Append(c);
            if (sb.Length >= 12) break;
        }
        string r = sb.ToString().Trim();
        return r.Length > 0 ? r : "Claude";
    }

    static string LastGroup(Regex rx, string s)
    {
        var ms = rx.Matches(s);
        if (ms.Count == 0) return null;
        return Regex.Unescape(ms[ms.Count - 1].Groups[1].Value.Replace("\\\\", "\u0001")).Replace("\u0001", "\\\\");
    }
}
