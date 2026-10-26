// 교실 알림판 '단축키' 도우미 — exe 판(7인치·4인치 공통). tools/deck_helper.ps1 과 같은 일을 하고, 작업 표시줄에 아이콘을 둔다.
//   보드가 보내는 '@deck 이름' 줄을 받아 프로그램·사이트를 열고 '@deck ok 이름' / '@deck fail 이름' 으로 답한다.
//   5초마다 '@pc on' 을 보내고, '@board ok' 로 답하는 포트만 쥔다. 답이 없으면 놓고, 처음엔 1분 뒤(켠 직후 늦은 알림판),
//   두 번째부터는 10분 뒤에 다시 본다(같은 칩을 쓰는 다른 장치를 자꾸 잡지 않게).
//   %TEMP%\deck_helper.stop 파일이 있으면 포트를 놓고 기다린다(키트의 quick_start 가 보드를 구울 때 쓴다).
// 만들기: build_exe.ps1 (윈도우에 들어 있는 .NET Framework 4 의 csc.exe — C# 5 문법만 쓴다)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Ports;
using System.Management;
using System.Reflection;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("교실 알림판 단축키 도우미")]
[assembly: AssemblyProduct("교실 알림판 단축키 도우미")]
[assembly: AssemblyVersion("1.0.0.0")]

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        bool fresh;
        using (var m = new Mutex(true, "PeneduBoardDeckHelper", out fresh))
        {
            if (!fresh) { MessageBox.Show("단축키 도우미가 이미 켜져 있어요.\n화면 오른쪽 아래 작업 표시줄(^ 안쪽)의 아이콘을 보세요.", "교실 알림판 도우미"); return; }
            Application.EnableVisualStyles();
            Application.Run(new Helper(Array.IndexOf(args, "--test") >= 0));
        }
    }
}

class Board
{
    public string Name;          // COM 이름
    public string Kind;          // 7인치 / 4인치
    public SerialPort Port;
    public string Buf = "";
    public bool Ok;              // '@board ok' 를 받았나
    public DateTime Opened;
}

class Helper : ApplicationContext
{
    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    const string RunName = "PeneduBoardDeckHelper";
    static readonly string Dir = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PeneduBoard");
    static readonly string AppsFile = Path.Combine(Dir, "apps.txt");
    static readonly string LogFile = Path.Combine(Path.GetTempPath(), "deck_helper.log");
    static readonly string StopFile = Path.Combine(Path.GetTempPath(), "deck_helper.stop");

    // 보드 단추 이름 → 열 것. apps.txt(이름 = 열 것)가 있으면 그 값이 먼저다. #desktop = 바탕화면 보기, #altf4 = 맨 앞 창 닫기
    static readonly string[,] DefaultApps = {
        { "explorer", "explorer.exe" }, { "claude", "claude:" }, { "gemini", "https://gemini.google.com" }, { "gpt", "https://chatgpt.com" },
        { "cmd", "cmd.exe" }, { "powershell", "powershell.exe" }, { "neis", "https://idp1-pen.neis.go.kr:9443/Login_Server/generateFP.jsp" },
        { "naver", "https://www.naver.com" }, { "youtube", "https://www.youtube.com" },
        { "coolmsg", @"C:\Program Files (x86)\CoolMessenger Gentoo\CoolMessenger.exe" }, { "kakao", @"C:\Program Files\Kakao\KakaoTalk\KakaoTalk.exe" },
        { "excel", "excel" }, { "ppt", "powerpnt" }, { "close", "#altf4" },
        { "hwp", @"C:\Program Files (x86)\Hnc\Office 2024\HOffice130\Bin\Hwp.exe" }, { "desktop", "#desktop" },
    };

    readonly bool test;
    readonly NotifyIcon tray = new NotifyIcon();
    readonly ToolStripMenuItem miState = new ToolStripMenuItem("찾는 중…") { Enabled = false };
    readonly ToolStripMenuItem miAuto = new ToolStripMenuItem("컴퓨터를 켤 때 저절로 켜기");
    readonly ToolStripMenuItem miPause = new ToolStripMenuItem("잠깐 멈추기(보드 굽기 전에)");
    readonly Icon iconOn, iconOff, iconPause;
    readonly Dictionary<string, Board> boards = new Dictionary<string, Board>();
    readonly Dictionary<string, DateTime> skip = new Dictionary<string, DateTime>();
    readonly Dictionary<string, int> fails = new Dictionary<string, int>();   // 잇달아 답이 없던 횟수(확인되거나 뽑히면 지운다)
    readonly SynchronizationContext ui;
    volatile bool quit;
    volatile string lastTip = "";   // 보드 스레드가 만든 상태 글(화면 스레드는 이것만 읽는다)

    public Helper(bool testMode)
    {
        test = testMode;
        ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
        iconOn = MakeIcon(Color.FromArgb(34, 160, 90), false);
        iconOff = MakeIcon(Color.FromArgb(130, 130, 130), false);
        iconPause = MakeIcon(Color.FromArgb(220, 150, 30), true);

        var menu = new ContextMenuStrip();
        menu.Items.Add(miState);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("여는 프로그램 바꾸기(메모장)", null, delegate { OpenAppsFile(); });
        menu.Items.Add("기록 보기", null, delegate { ShellOpen(LogFile); });
        menu.Items.Add(miPause);
        menu.Items.Add(miAuto);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("끝내기", null, delegate { Quit(); });
        miPause.Click += delegate { TogglePause(); };
        miAuto.Click += delegate { SetAuto(!miAuto.Checked); };
        menu.Opening += delegate { miAuto.Checked = IsAuto(); miPause.Checked = File.Exists(StopFile); };
        tray.ContextMenuStrip = menu;
        tray.Icon = iconOff;
        tray.Text = "교실 알림판 도우미 · 찾는 중";
        tray.Visible = true;
        tray.MouseClick += delegate (object s, MouseEventArgs e) {
            // 화면 스레드에서는 보드 목록을 잠그지 않는다(보드 스레드가 프로그램을 열려고 화면 스레드를 기다리는 중일 수 있다)
            if (e.Button == MouseButtons.Left) tray.ShowBalloonTip(4000, "교실 알림판 도우미", lastTip.Length > 0 ? lastTip : "찾는 중", ToolTipIcon.Info);
        };

        Directory.CreateDirectory(Dir);
        if (!test) Install();
        Log("도우미(exe) 시작");
        var th = new Thread(Loop) { IsBackground = true, Name = "deck" };
        th.Start();
    }

    // 처음 켤 때: 자기를 %LOCALAPPDATA%\PeneduBoard 로 복사(압축 안이나 내려받기 폴더에서 바로 켜도 되게), 예전 스크립트 도우미는 끄고, 저절로 켜기 등록
    void Install()
    {
        try
        {
            string me = Application.ExecutablePath;
            string home = Path.Combine(Dir, "교실알림판_도우미.exe");
            if (!string.Equals(Path.GetFullPath(me), Path.GetFullPath(home), StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(me, home, true);
                bool firstTime = !IsAuto();
                SetAuto(true, home);
                if (firstTime) tray.ShowBalloonTip(6000, "교실 알림판 도우미", "설치했어요. 컴퓨터를 켤 때 저절로 켜져요.\n아이콘을 오른쪽 클릭하면 메뉴가 나와요.", ToolTipIcon.Info);
            }
            // 예전 판은 레지스트리 Run 에 등록했는데, 재부팅 뒤 켜지지 않은 적이 있다(백신이 막은 것으로 보임, 2026-10-26) → 시작프로그램 폴더 바로 가기로 옮긴다
            using (var k = Registry.CurrentUser.OpenSubKey(RunKey))
                if (k != null && k.GetValue(RunName) != null) { SetAuto(true, home); Log("자동 켜기를 시작프로그램 폴더로 옮김"); }
            if (File.Exists(home)) MakeLnk(MenuLnk, home);   // 시작 메뉴에서 '교실알림판 도우미'로 다시 켤 수 있게
            // 예전 방식(PowerShell 스크립트 도우미)과 같이 돌면 같은 보드를 서로 잡으려 한다 → 끄고 등록도 지운다
            string vbs = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "교실알림판_단축키도우미.vbs");
            if (File.Exists(vbs)) { File.Delete(vbs); Log("예전 스크립트 도우미 자동 켜기를 지움"); }
            using (var q = new ManagementObjectSearcher("SELECT ProcessId, CommandLine FROM Win32_Process WHERE Name='powershell.exe'"))
                foreach (ManagementObject p in q.Get())
                {
                    var cl = p["CommandLine"] as string;
                    if (cl != null && cl.IndexOf("deck_helper.ps1", StringComparison.OrdinalIgnoreCase) >= 0)
                        try { Process.GetProcessById(Convert.ToInt32(p["ProcessId"])).Kill(); Log("예전 스크립트 도우미를 끔"); } catch { }
                }
        }
        catch (Exception ex) { Log("설치 중 문제: " + ex.Message); }
    }

    // 저절로 켜기 = 시작프로그램 폴더의 바로 가기(사용자가 탐색기에서 보고 지울 수도 있다)
    static readonly string StartupLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "교실알림판 도우미.lnk");
    static readonly string MenuLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "교실알림판 도우미.lnk");

    static bool IsAuto() { return File.Exists(StartupLnk); }

    void SetAuto(bool on) { SetAuto(on, Path.Combine(Dir, "교실알림판_도우미.exe")); }
    void SetAuto(bool on, string exe)
    {
        if (test) return;
        if (!File.Exists(exe)) exe = Application.ExecutablePath;
        try { using (var k = Registry.CurrentUser.CreateSubKey(RunKey)) k.DeleteValue(RunName, false); } catch { }   // 예전 판의 등록은 지운다
        if (on) MakeLnk(StartupLnk, exe);
        else try { File.Delete(StartupLnk); } catch { }
    }

    // 바로 가기(.lnk) 만들기 — 윈도우에 들어 있는 WScript.Shell 을 쓴다(C# 5 라 dynamic 대신 InvokeMember)
    static void MakeLnk(string lnk, string target)
    {
        try
        {
            var t = Type.GetTypeFromProgID("WScript.Shell");
            object sh = Activator.CreateInstance(t);
            object sc = t.InvokeMember("CreateShortcut", BindingFlags.InvokeMethod, null, sh, new object[] { lnk });
            var st = sc.GetType();
            st.InvokeMember("TargetPath", BindingFlags.SetProperty, null, sc, new object[] { target });
            st.InvokeMember("WorkingDirectory", BindingFlags.SetProperty, null, sc, new object[] { Path.GetDirectoryName(target) });
            st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { "교실 알림판 단축키 도우미" });
            st.InvokeMember("Save", BindingFlags.InvokeMethod, null, sc, null);
        }
        catch (Exception ex) { Log("바로 가기를 만들지 못함: " + ex.Message); }
    }

    void TogglePause()
    {
        try { if (File.Exists(StopFile)) File.Delete(StopFile); else File.WriteAllText(StopFile, ""); } catch { }
    }

    void Quit()
    {
        quit = true;
        lock (boards) foreach (var b in boards.Values) try { b.Port.Close(); } catch { }
        tray.Visible = false;
        Log("도우미(exe) 끝냄");
        ExitThread();
    }

    // ── 보드와 이야기하기(별도 스레드) ──
    void Loop()
    {
        DateTime lastScan = DateTime.MinValue, lastBeat = DateTime.MinValue;
        while (!quit)
        {
            try
            {
                if (File.Exists(StopFile))
                {
                    lock (boards) foreach (var n in new List<string>(boards.Keys)) Drop(n, "포트 놓음(멈춤)");
                    UpdateTray();
                    Thread.Sleep(1000); continue;
                }
                var now = DateTime.Now;
                if ((now - lastScan).TotalSeconds >= 5) { lastScan = now; Scan(now); }
                if ((now - lastBeat).TotalSeconds >= 5)
                {
                    lastBeat = now;
                    lock (boards) foreach (var n in new List<string>(boards.Keys)) Send(n, "@pc on");
                }
                lock (boards)
                    foreach (var n in new List<string>(boards.Keys))
                    {
                        var b = boards[n];
                        if (!b.Ok && (now - b.Opened).TotalSeconds >= 40)
                        {
                            int f; fails.TryGetValue(n, out f); fails[n] = ++f;
                            int wait = f >= 2 ? 10 : 1;
                            Drop(n, "알림판 아님(답 없음, " + wait + "분 뒤 다시)"); skip[n] = now.AddMinutes(wait);
                        }
                    }
                lock (boards) foreach (var n in new List<string>(boards.Keys)) Read(n);
                UpdateTray();
            }
            catch (Exception ex) { Log("오류: " + ex.Message); }
            Thread.Sleep(100);
        }
    }

    void Scan(DateTime now)
    {
        var found = new Dictionary<string, string>();
        try
        {
            using (var q = new ManagementObjectSearcher("SELECT Name, DeviceID FROM Win32_PnPEntity WHERE Name LIKE '%(COM%'"))
                foreach (ManagementObject o in q.Get())
                {
                    string id = (o["DeviceID"] as string) ?? "", name = (o["Name"] as string) ?? "";
                    var m = Regex.Match(name, @"\((COM\d+)\)");
                    if (!m.Success) continue;
                    if (id.IndexOf("VID_1A86", StringComparison.OrdinalIgnoreCase) >= 0) found[m.Groups[1].Value] = "7인치";
                    else if (id.IndexOf("VID_303A", StringComparison.OrdinalIgnoreCase) >= 0) found[m.Groups[1].Value] = "4인치";
                }
        }
        catch { return; }
        if (File.Exists(StopFile)) return;   // 찾는 사이(1~2초) '잠깐 멈춤'이 생겼으면 새로 열지 않는다(굽기·화면 찍기가 포트를 바로 쓰게)
        foreach (var k in new List<string>(fails.Keys)) if (!found.ContainsKey(k)) fails.Remove(k);   // 뽑았다 꽂으면 다시 처음부터
        foreach (var kv in found)
        {
            lock (boards) if (boards.ContainsKey(kv.Key)) continue;
            DateTime until;
            if (skip.TryGetValue(kv.Key, out until) && now < until) continue;
            try
            {
                var sp = new SerialPort(kv.Key, 115200);
                sp.DtrEnable = false; sp.RtsEnable = false;   // 열 때 보드가 다시 시작되지 않게
                sp.ReadTimeout = 50; sp.WriteTimeout = 500; sp.NewLine = "\n"; sp.Encoding = Encoding.UTF8;
                sp.Open();
                lock (boards) boards[kv.Key] = new Board { Name = kv.Key, Kind = kv.Value, Port = sp, Opened = now };
                Send(kv.Key, "@pc on");
                Log("포트 열어 봄: " + kv.Key);
            }
            catch { }
        }
    }

    void Send(string n, string line)
    {
        Board b;
        if (!boards.TryGetValue(n, out b)) return;
        try { b.Port.Write(line + "\n"); } catch { Drop(n, "포트 끊김"); }
    }

    void Drop(string n, string why)
    {
        Board b;
        if (!boards.TryGetValue(n, out b)) return;
        try { b.Port.Close(); } catch { }
        boards.Remove(n);
        Log(why + ": " + n);
        if (b.Ok) Balloon(b.Kind + " 알림판 연결이 끊겼어요", ToolTipIcon.Warning);
    }

    void Read(string n)
    {
        Board b;
        if (!boards.TryGetValue(n, out b)) return;
        string s;
        try { s = b.Port.ReadExisting(); } catch { Drop(n, "포트 끊김"); return; }
        if (string.IsNullOrEmpty(s)) return;
        b.Buf += s;
        int k;
        while ((k = b.Buf.IndexOf('\n')) >= 0)
        {
            string line = b.Buf.Substring(0, k).Trim();
            b.Buf = b.Buf.Substring(k + 1);
            if (line == "@board ok") { if (!b.Ok) Confirm(b); }
            else if (line == "@pc?") { if (!b.Ok) Confirm(b); Send(n, "@pc on"); Log("보드가 연결을 다시 확인함(새로 고침): " + n); }   // 보드의 [새로 고침] 단추: 바로 답한다
            else if (line.StartsWith("@deck "))
            {
                if (!b.Ok) Confirm(b);
                string key = line.Substring(6).Trim();
                bool ok = OpenApp(key);
                Send(n, (ok ? "@deck ok " : "@deck fail ") + key);
            }
            else if (Regex.IsMatch(line, "^(sync|reset reason|health|download|index|where|schedule|weather|meal|air|heap|pc helper|backlight|restart)"))
                BoardLog(n, line);
        }
        if (b.Buf.Length > 4096) b.Buf = "";
    }

    void Confirm(Board b)
    {
        b.Ok = true;
        fails.Remove(b.Name);
        Log("알림판 확인: " + b.Name + " (" + b.Kind + ")");
        Balloon(b.Kind + " 알림판과 연결됐어요 (" + b.Name + ")", ToolTipIcon.Info);
    }

    // 보드 기록 중 중요한 줄만 %TEMP%\board_COMx.log 에(1MB 넘으면 .old)
    static void BoardLog(string n, string line)
    {
        try
        {
            string f = Path.Combine(Path.GetTempPath(), "board_" + n + ".log");
            if (File.Exists(f) && new FileInfo(f).Length > 1024 * 1024) { File.Copy(f, f + ".old", true); File.Delete(f); }
            File.AppendAllText(f, DateTime.Now.ToString("MM-dd HH:mm:ss") + " " + line + "\r\n", Encoding.UTF8);
        }
        catch { }
    }

    // ── 프로그램 열기(화면 스레드에서) ──
    bool OpenApp(string key)
    {
        string t = Apps(key);
        if (t == null) { Log("모르는 단추: " + key); return false; }
        bool ok = false;
        ui.Send(delegate {
            try
            {
                if (t == "#desktop")
                {
                    var sh = Type.GetTypeFromProgID("Shell.Application");
                    var o = Activator.CreateInstance(sh);
                    sh.InvokeMember("ToggleDesktop", BindingFlags.InvokeMethod, null, o, null);
                }
                else if (t == "#altf4") SendKeys.SendWait("%{F4}");
                else Process.Start(new ProcessStartInfo(t) { UseShellExecute = true });
                ok = true;
            }
            catch (Exception ex) { Log("열기 실패: " + key + " (" + ex.Message + ")"); }
        }, null);
        if (ok) Log("열기: " + key);
        return ok;
    }

    static string Apps(string key)
    {
        try
        {
            if (File.Exists(AppsFile))
                foreach (var raw in File.ReadAllLines(AppsFile, Encoding.UTF8))
                {
                    string l = raw.Trim();
                    if (l.Length == 0 || l.StartsWith("#")) continue;
                    int e = l.IndexOf('=');
                    if (e > 0 && l.Substring(0, e).Trim() == key) return l.Substring(e + 1).Trim();
                }
        }
        catch { }
        for (int i = 0; i < DefaultApps.GetLength(0); i++) if (DefaultApps[i, 0] == key) return DefaultApps[i, 1];
        return null;
    }

    static void OpenAppsFile()
    {
        if (!File.Exists(AppsFile))
        {
            var sb = new StringBuilder();
            sb.AppendLine("# 교실 알림판 단축키: 보드 단추 이름 = 열 것(프로그램 경로 · 사이트 주소)");
            sb.AppendLine("# 고치고 저장하면 바로 쓰여요(도우미를 다시 켤 필요 없음). 줄을 지우면 기본값으로 돌아가요.");
            sb.AppendLine("# #desktop = 바탕화면 보기, #altf4 = 맨 앞 창 닫기. 단추 이름(왼쪽)은 바꾸지 마세요.");
            for (int i = 0; i < DefaultApps.GetLength(0); i++) sb.AppendLine(DefaultApps[i, 0] + " = " + DefaultApps[i, 1]);
            File.WriteAllText(AppsFile, sb.ToString(), new UTF8Encoding(true));
        }
        try { Process.Start("notepad.exe", "\"" + AppsFile + "\""); } catch { }
    }

    static void ShellOpen(string f)
    {
        try { if (!File.Exists(f)) File.WriteAllText(f, ""); Process.Start("notepad.exe", "\"" + f + "\""); } catch { }
    }

    // ── 작업 표시줄 아이콘 ──
    string StateText()
    {
        if (File.Exists(StopFile)) return "잠깐 멈춤 — 보드를 놓았어요(메뉴에서 다시 켜기)";
        var ok = new List<string>();
        lock (boards) foreach (var b in boards.Values) if (b.Ok) ok.Add(b.Kind + "(" + b.Name + ")");
        return ok.Count > 0 ? "연결됨: " + string.Join(", ", ok.ToArray()) : "알림판을 찾는 중 — 7인치는 UART 단자, 4인치는 USB-C 단자에 꽂아 주세요";
    }

    void UpdateTray()
    {
        string st = StateText();
        if (st == lastTip) return;
        lastTip = st;
        bool paused = File.Exists(StopFile), on = st.StartsWith("연결됨");
        ui.Post(delegate {
            tray.Icon = paused ? iconPause : on ? iconOn : iconOff;
            string tip = "교실 알림판 도우미 · " + st;
            tray.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;   // 작업 표시줄 글은 63자까지
            miState.Text = st;
        }, null);
    }

    void Balloon(string text, ToolTipIcon kind)
    {
        ui.Post(delegate { tray.ShowBalloonTip(4000, "교실 알림판 도우미", text, kind); }, null);
    }

    // 둥근 사각형(알림판) 아이콘. 연결됨 = 초록, 찾는 중 = 회색, 멈춤 = 주황 + 일시정지 표시
    static Icon MakeIcon(Color c, bool pause)
    {
        var bmp = new Bitmap(32, 32);
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.Clear(Color.Transparent);
            using (var path = new GraphicsPath())
            {
                var r = new Rectangle(2, 5, 28, 22); int d = 8;
                path.AddArc(r.X, r.Y, d, d, 180, 90); path.AddArc(r.Right - d, r.Y, d, d, 270, 90);
                path.AddArc(r.Right - d, r.Bottom - d, d, d, 0, 90); path.AddArc(r.X, r.Bottom - d, d, d, 90, 90);
                path.CloseFigure();
                using (var br = new SolidBrush(c)) g.FillPath(br, path);
            }
            using (var w = new SolidBrush(Color.White))
            {
                if (pause) { g.FillRectangle(w, 11, 10, 4, 12); g.FillRectangle(w, 18, 10, 4, 12); }
                else for (int y = 0; y < 2; y++) for (int x = 0; x < 3; x++) g.FillRectangle(w, 7 + x * 7, 10 + y * 7, 5, 5);   // 단추 6개
            }
        }
        return Icon.FromHandle(bmp.GetHicon());
    }

    static void Log(string m)
    {
        try { File.AppendAllText(LogFile, DateTime.Now.ToString("MM-dd HH:mm:ss") + " " + m + "\r\n", Encoding.UTF8); } catch { }
    }
}
