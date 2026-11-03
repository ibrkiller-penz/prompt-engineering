// ════ Claude 펫 — 이 컴퓨터의 Claude Code 기록에서 Claude 가 쓴 글의 양(출력 토큰)을 모아 펫을 키운다(사용자 지시 2026-11-03,
//  Tamamon 처럼). 보드의 사무실 쉼터에 '@pet 종류 단계 % 기분 먹음 뽑기표 도감' 으로 알린다.
//  - 먹이: 대화 기록의 "output_tokens"(같은 답이 여러 줄로 나뉘어 적히므로 답 번호 msg_… 로 한 번만 센다)
//  - 단계: 알 → 아기(2만) → 어린이(40만) → 어른(250만). 이 컴퓨터 기준 하루 30만~80만이라 일주일쯤이면 어른
//  - 뽑기: 한 주(월요일~)에 한 번. 보드에서 선물 상자를 누르면 '@petgacha' → 아직 없는 종류의 알이 새 펫이 된다
//  - 도감: 보드에서 도감 글을 누르면 '@petsel' → 가진 펫 중 다음 펫으로 바꾼다(전의 펫은 자란 만큼 그대로)
//  저장: %LOCALAPPDATA%\PeneduBoard\pet.txt (펫 상태 + 파일마다 어디까지 셌는지). 기록 내용은 이 컴퓨터 밖으로 나가지 않는다 ══
using System;
using System.Collections.Generic;
using System.Globalization;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;

static class ClaudePet
{
    public const int Kinds = 7;   // 0 말랑이 1 냥냥이 2 토실이 3 뿔뿔이 4 새싹이 5 별빛이 6 부캉이
    static readonly long[] Need = { 20000, 400000, 2500000 };   // 아기·어린이·어른이 되는 데 드는 먹이(누적)
    static readonly string Root = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.UserProfile), ".claude", "projects");
    static readonly string Dir = Environment.GetEnvironmentVariable("PENEDU_DECK_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PeneduBoard");
    static string FilePath { get { return Path.Combine(Dir, "pet.txt"); } }

    static readonly object gate = new object();
    static int sp;                              // 지금 펫 종류
    static readonly long[] xp = new long[Kinds]; // 종류마다 먹은 양
    static int owned;                           // 가진 종류(비트)
    static string gachaWeek = "";               // 마지막으로 뽑은 주(그 주 월요일 날짜)
    static readonly Dictionary<string, long> seen = new Dictionary<string, long>();   // 파일 → 어디까지 셌나(바이트)
    static readonly HashSet<string> msgs = new HashSet<string>();
    static DateTime fedAt = DateTime.MinValue;
    static bool loaded, dirty;
    static DateTime next = DateTime.MinValue;
    static volatile bool busy;
    static DateTime busyAt;
    static readonly Random rnd = new Random();

    static readonly Regex OutRx = new Regex("\"output_tokens\":(\\d+)");
    static readonly Regex IdRx = new Regex("\"id\":\"(msg_[^\"]+)\"");

    // Loop 에서 자주 부른다. 10초마다 한 번 훑는다(따로 스레드)
    public static void Tick()
    {
        if ((busy && (DateTime.Now - busyAt).TotalMinutes < 2) || DateTime.Now < next) return;
        busy = true; busyAt = DateTime.Now; next = DateTime.Now.AddSeconds(10);
        new Thread(Scan) { IsBackground = true, Name = "claude pet" }.Start();
    }

    static void Scan()
    {
        try
        {
            lock (gate)
            {
                if (!loaded) Load();
                Feed();
                if (dirty) Save();
            }
        }
        catch (Exception ex) { Helper.Log("Claude 펫: 훑기 실패 " + ex.GetType().Name); }
        busy = false;
    }

    static string WeekKey(DateTime d)
    {
        int back = ((int)d.DayOfWeek + 6) % 7;   // 월요일 = 0
        return d.Date.AddDays(-back).ToString("yyyy-MM-dd", CultureInfo.InvariantCulture);
    }

    static void Load()
    {
        loaded = true;
        bool fresh = !File.Exists(FilePath);
        if (!fresh)
        {
            try
            {
                foreach (var raw in File.ReadAllLines(FilePath, Encoding.UTF8))
                {
                    string[] p = raw.Split('|');
                    if (p.Length >= 2 && p[0] == "sp") int.TryParse(p[1], out sp);
                    else if (p.Length >= 2 && p[0] == "owned") int.TryParse(p[1], out owned);
                    else if (p.Length >= 2 && p[0] == "week") gachaWeek = p[1];
                    else if (p.Length >= 3 && p[0] == "xp") { int k; long v; if (int.TryParse(p[1], out k) && k >= 0 && k < Kinds && long.TryParse(p[2], out v)) xp[k] = v; }
                    else if (p.Length >= 3 && p[0] == "f") { long v; if (long.TryParse(p[2], out v)) seen[p[1]] = v; }
                }
            }
            catch (Exception ex) { Helper.Log("Claude 펫: 저장 파일 읽기 실패 " + ex.GetType().Name); }
        }
        if (sp < 0 || sp >= Kinds) sp = 0;
        if (owned == 0)
        {   // 처음: 알 하나를 선물로(이 주의 뽑기로 친다)
            sp = rnd.Next(Kinds); owned = 1 << sp; gachaWeek = WeekKey(DateTime.Now); dirty = true;
            Helper.Log("Claude 펫: 첫 알을 받음(종류 " + sp + ")");
        }
        if (fresh)
        {   // 처음 켰을 때는 지난 기록을 먹이로 세지 않는다(지금부터 쓴 만큼만 자란다)
            foreach (var f in RecentFiles()) { try { seen[f] = new FileInfo(f).Length; } catch { } }
            dirty = true;
        }
    }

    static void Save()
    {
        var sb = new StringBuilder();
        sb.Append("sp|").Append(sp).Append('\n');
        sb.Append("owned|").Append(owned).Append('\n');
        sb.Append("week|").Append(gachaWeek).Append('\n');
        for (int k = 0; k < Kinds; k++) sb.Append("xp|").Append(k).Append('|').Append(xp[k]).Append('\n');
        foreach (var kv in seen) sb.Append("f|").Append(kv.Key).Append('|').Append(kv.Value).Append('\n');
        try
        {
            Directory.CreateDirectory(Dir);
            string tmp = FilePath + ".tmp";
            File.WriteAllText(tmp, sb.ToString(), new UTF8Encoding(false));
            if (File.Exists(FilePath)) File.Delete(FilePath);
            File.Move(tmp, FilePath);
            dirty = false;
        }
        catch (Exception ex) { Helper.Log("Claude 펫: 저장 실패 " + ex.GetType().Name); }
    }

    // 최근 3시간 안에 바뀐 대화 기록 파일
    static List<string> RecentFiles()
    {
        var list = new List<string>();
        if (!Directory.Exists(Root)) return list;
        var now = DateTime.UtcNow;
        foreach (var dir in Directory.GetDirectories(Root))
        {
            string[] files;
            try { files = Directory.GetFiles(dir, "*.jsonl"); } catch { continue; }
            foreach (var f in files)
            {
                try { if ((now - File.GetLastWriteTimeUtc(f)).TotalHours < 3) list.Add(f); } catch { }
            }
        }
        return list;
    }

    static void Feed()
    {
        var files = RecentFiles();
        var keep = new HashSet<string>(files);
        foreach (var k in new List<string>(seen.Keys)) if (!keep.Contains(k)) { seen.Remove(k); dirty = true; }   // 3시간 넘게 조용한 파일은 잊는다
        long got = 0;
        foreach (var f in files)
        {
            long len, pos;
            try { len = new FileInfo(f).Length; } catch { continue; }
            if (!seen.TryGetValue(f, out pos)) pos = 0;   // 새 대화: 처음부터
            if (pos > len) pos = 0;                        // 파일이 줄었다(새로 써짐)
            if (len - pos < 2) continue;
            long take = Math.Min(len - pos, 8L << 20);     // 한 번에 8MB 까지
            byte[] buf;
            try
            {
                using (var fs = new FileStream(f, FileMode.Open, FileAccess.Read, FileShare.ReadWrite | FileShare.Delete))
                {
                    fs.Seek(pos, SeekOrigin.Begin);
                    buf = new byte[take];
                    int n = 0; while (n < take) { int r = fs.Read(buf, n, (int)take - n); if (r <= 0) break; n += r; }
                    if (n < take) Array.Resize(ref buf, n);
                }
            }
            catch { continue; }
            int end = Array.LastIndexOf(buf, (byte)'\n');
            if (end < 0) continue;                         // 아직 다 쓰지 않은 한 줄
            string text = Encoding.UTF8.GetString(buf, 0, end + 1);
            foreach (var ln in text.Split('\n'))
            {
                if (ln.IndexOf("\"type\":\"assistant\"", StringComparison.Ordinal) < 0) continue;
                var om = OutRx.Match(ln);
                if (!om.Success) continue;
                var im = IdRx.Match(ln);
                if (im.Success && !msgs.Add(im.Groups[1].Value)) continue;   // 같은 답의 다른 줄
                long v; if (long.TryParse(om.Groups[1].Value, out v)) got += v;
            }
            seen[f] = pos + end + 1; dirty = true;
        }
        if (msgs.Count > 20000) msgs.Clear();
        if (got > 0)
        {
            int before = StageOf(xp[sp]);
            xp[sp] += got; fedAt = DateTime.Now; dirty = true;
            int after = StageOf(xp[sp]);
            if (after != before) Helper.Log("Claude 펫: 자랐어요(단계 " + before + " → " + after + ")");
        }
    }

    static int StageOf(long v)
    {
        int s = 0; while (s < Need.Length && v >= Need[s]) s++;
        return s;
    }

    // 보드에 보낼 줄. 기분: w = Claude 가 일하는 중 · q = 허락 기다림 · i = 쉬는 중
    public static string Line
    {
        get
        {
            lock (gate)
            {
                if (!loaded) return null;
                long v = xp[sp]; int st = StageOf(v);
                int pct = st >= Need.Length ? 100 : (int)(100 * (v - (st == 0 ? 0 : Need[st - 1])) / (Need[st] - (st == 0 ? 0 : Need[st - 1])));
                string ag = ClaudeAgents.Line;
                char mood = ag.Contains(",w,") || ag.Contains(",r,") ? 'w' : ag.Contains(",q,") ? 'q' : 'i';
                int fed = (DateTime.Now - fedAt).TotalSeconds < 15 ? 1 : 0;
                int ticket = WeekKey(DateTime.Now) != gachaWeek ? 1 : 0;
                var dex = new StringBuilder();
                for (int k = 0; k < Kinds; k++) dex.Append((owned & (1 << k)) != 0 ? (char)('0' + StageOf(xp[k])) : '-');
                return "@pet " + sp + " " + st + " " + pct + " " + mood + " " + fed + " " + ticket + " " + dex;
            }
        }
    }

    // 보드의 선물 상자: 이번 주 뽑기
    public static void Gacha()
    {
        lock (gate)
        {
            if (!loaded) return;
            string wk = WeekKey(DateTime.Now);
            if (wk == gachaWeek) return;
            var pool = new List<int>();
            for (int k = 0; k < Kinds; k++) if ((owned & (1 << k)) == 0) pool.Add(k);
            if (pool.Count == 0) for (int k = 0; k < Kinds; k++) if (k != sp) pool.Add(k);   // 다 모았으면 다른 펫으로
            sp = pool[rnd.Next(pool.Count)];
            owned |= 1 << sp; gachaWeek = wk; dirty = true;
            Helper.Log("Claude 펫: 뽑기 → 종류 " + sp);
            Save();
        }
    }

    // 보드의 도감 글: 가진 펫 중 다음 펫으로
    public static void Next()
    {
        lock (gate)
        {
            if (!loaded) return;
            for (int i = 1; i <= Kinds; i++)
            {
                int k = (sp + i) % Kinds;
                if ((owned & (1 << k)) != 0) { if (k != sp) { sp = k; dirty = true; Save(); } return; }
            }
        }
    }
}
