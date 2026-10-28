// 탭덱(TapDeck) — 교실 알림판 단축키 PC 프로그램, exe 판(7인치·4인치 공통). 2026-10-27 '단축키 도우미'에서 이름을 바꿈. tools/deck_helper.ps1 과 같은 일을 하고, 작업 표시줄에 아이콘을 둔다.
//   보드가 보내는 '@deck 이름' 줄을 받아 프로그램·사이트를 열고 '@deck ok 이름' / '@deck fail 이름' 으로 답한다.
//   5초마다 '@pc on' 을 보내고, '@board ok' 로 답하는 포트만 쥔다. 답이 없으면 놓고, 처음엔 1분 뒤(켠 직후 늦은 알림판),
//   두 번째부터는 10분 뒤에 다시 본다(같은 칩을 쓰는 다른 장치를 자꾸 잡지 않게).
//   %TEMP%\deck_helper.stop 파일이 있으면 포트를 놓고 기다린다(키트의 quick_start 가 보드를 구울 때 쓴다).
//   '단축키 꾸미기'(DeckForm.cs)로 칸을 바꾸면 deck.json 에 저장하고, 보드에 이름·아이콘을 줄 단위로 보낸다(설계_단축키꾸미기.md 2~4장).
//   보드가 '@deck s3' 를 보내면 deck.json 의 칸 3 을, '@deck explorer' 같은 영문 키면 apps.txt/기본값을 연다(옛 보드 호환).
// 만들기: build_exe.ps1 (윈도우에 들어 있는 .NET Framework 4 의 csc.exe — C# 5 문법만 쓴다)
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.IO;
using System.IO.Ports;
using System.Management;
using System.Net;
using System.Reflection;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.RegularExpressions;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Win32;

[assembly: AssemblyTitle("탭덱 TapDeck")]
[assembly: AssemblyProduct("탭덱 TapDeck")]
[assembly: AssemblyVersion("1.1.0.0")]

static class Program
{
    [STAThread]
    static void Main(string[] args)
    {
        // --preview <폴더>: '단축키 꾸미기' 창 그림만 만들고 끝낸다(뮤텍스·포트·트레이·설치·로그·사용자 폴더를 건드리지 않음)
        int pi = Array.IndexOf(args, "--preview");
        if (pi >= 0) { Environment.ExitCode = RunPreview(pi + 1 < args.Length ? args[pi + 1] : "미리보기그림"); return; }
        RunTray(args);
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    static void RunTray(string[] args)
    {
        bool fresh;
        using (var m = new Mutex(true, "PeneduBoardDeckHelper", out fresh))
        {
            if (!fresh) { MessageBox.Show("탭덱이 이미 켜져 있어요.\n화면 오른쪽 아래 작업 표시줄(^ 안쪽)의 아이콘을 보세요.", "탭덱"); return; }
            // 화면 쪽에서 미처 못 잡은 예외: 도우미가 꺼지지 않게 기록만 남긴다
            Application.SetUnhandledExceptionMode(UnhandledExceptionMode.CatchException);
            Application.ThreadException += delegate (object s, ThreadExceptionEventArgs e) { Helper.Log("화면 오류(계속 켜 둠): " + e.Exception); };
            // 보드·실행 스레드에서 못 잡은 예외: 꺼지기 전에 까닭이라도 기록에 남긴다
            AppDomain.CurrentDomain.UnhandledException += delegate (object s, UnhandledExceptionEventArgs e) { Helper.Log("뜻밖의 오류로 꺼짐: " + e.ExceptionObject); };
            Application.EnableVisualStyles();
            Application.Run(new Helper(Array.IndexOf(args, "--test") >= 0));
        }
    }

    [MethodImpl(MethodImplOptions.NoInlining)]
    static int RunPreview(string dir)
    {
        dir = Path.GetFullPath(dir);
        Directory.CreateDirectory(dir);
        // Helper 의 static 필드(Dir)가 만들어지기 전에 자료 폴더를 바꿔 둔다
        Environment.SetEnvironmentVariable("PENEDU_DECK_DIR", Path.Combine(dir, "_자료"));
        return DeckPreview.Run(dir);
    }
}

// 포트 감싸개(시험 때 가짜 보드로 바꿔 끼울 수 있게)
class Link
{
    readonly SerialPort sp;
    public Link(SerialPort p) { sp = p; }
    // 글자가 들어오면 wake 를 깨운다(보드 스레드가 100ms 를 다 기다리지 않고 바로 읽게)
    public Link(SerialPort p, AutoResetEvent wake) : this(p) { p.DataReceived += delegate { try { wake.Set(); } catch { } }; }
    protected Link() { }
    public virtual void Write(string s) { sp.Write(s); }
    public virtual string ReadExisting() { return sp.ReadExisting(); }
    public virtual void Close() { sp.Close(); }
}

class Board
{
    public string Name;          // COM 이름
    public string Kind;          // 7인치 / 4인치
    public Link Port;
    public string Buf = "";
    public bool Ok;              // '@board ok' 를 받았나
    public DateTime TimeAt;      // 마지막으로 '@time' 을 보낸 때
    public DateTime Opened;
    // 아이콘 보내기
    public volatile bool Pushing;   // 보내는 스레드가 포트를 쓰는 중(이때 Loop 는 읽지도 쓰지도 않는다)
    public bool CanDeck;            // '@board ok deck=' 를 받음 = 새 보드
    public bool OldBoard;           // '@board ok' 뒤 3초 안에 deck= 이 안 옴 = 옛 보드(절대 안 보냄)
    public DateTime OkAt = DateTime.MinValue;
    public volatile string Hash;    // 보드가 가진 cfg 해시("0" = 내장)
    public int PushFails;
    public DateTime NextTry = DateTime.MinValue;
    public bool PushStopped;        // 3번 잇달아 실패 → 설정 창에서 다시 보낼 때까지 멈춤
    public DateTime LastBeat, StopChk;
    public DateTime LastRx = DateTime.Now;   // 마지막으로 보드에서 글자를 받은 때(20초 넘게 말이 없으면 다시 찾는다)
}

class Helper : ApplicationContext
{
    const string RunKey = @"Software\Microsoft\Windows\CurrentVersion\Run";
    const string RunName = "PeneduBoardDeckHelper";
    static readonly string Dir = Environment.GetEnvironmentVariable("PENEDU_DECK_DIR") ?? Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PeneduBoard");   // 시험용으로 바꿀 수 있음
    static readonly string AppsFile = Path.Combine(Dir, "apps.txt");
    static readonly string LogFile = Path.Combine(Path.GetTempPath(), "deck_helper.log");
    static readonly string StopFile = Path.Combine(Path.GetTempPath(), "deck_helper.stop");
    static readonly string DeckFile = Path.Combine(Dir, "deck.json");
    static readonly string IconDir = Path.Combine(Dir, "icons");

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
    readonly Control marshal;                  // 화면 스레드에서 만든 숨은 컨트롤(창 열기를 화면 스레드로 넘기는 데 쓴다)
    volatile bool quit;
    volatile string lastTip = "";   // 보드 스레드가 만든 상태 글(화면 스레드는 이것만 읽는다)
    volatile bool paused;           // '잠깐 멈춤' 파일이 있나(Loop 바퀴 첫머리에서 한 번만 본다)
    volatile bool resumed;          // 절전에서 깨어남 → Loop 가 보드를 모두 놓고 곧바로 다시 찾는다
    readonly AutoResetEvent rxWake = new AutoResetEvent(false);   // 포트에 글자가 들어옴·실행 결과가 나옴
    readonly Dictionary<string, string> lastDropWhy = new Dictionary<string, string>();   // 포트마다 마지막 놓은 까닭(같은 기록 되풀이 안 함)
    readonly HashSet<string> quietOpen = new HashSet<string>();   // 마지막 놓기 기록을 건너뛴 포트('포트 열어 봄'도 건너뜀)
    string[] lastPorts;             // 지난번 COM 이름 목록(같으면 WMI 를 돌리지 않는다)
    Dictionary<string, string> lastFound = new Dictionary<string, string>();   // 지난번 WMI 로 확인한 알림판 포트(COM → 7인치/4인치)
    DateTime lastWmi = DateTime.MinValue;
    // 실행 일꾼: 보드가 누른 칸은 이 스레드가 차례로 연다(Loop·보내기 스레드는 줄에 넣기만 해서 막히지 않는다)
    Thread runTh;
    readonly List<KeyValuePair<string, string>> runQueue = new List<KeyValuePair<string, string>>();   // (보드 이름, 키)
    readonly List<KeyValuePair<string, string>> runDone = new List<KeyValuePair<string, string>>();    // (보드 이름, "@deck ok 키"/"@deck fail 키")
    readonly AutoResetEvent runWake = new AutoResetEvent(false);
    readonly HashSet<string> running = new HashSet<string>();   // 지금 하는 중인 칸(같은 칸을 겹쳐 열지 않게)
    DateTime lastStaleTip = DateTime.MinValue;                  // '새 단축키를 보내는 중' 풍선(10초에 한 번)
    readonly object saveLock = new object();                    // deck.json·icons 파일 쓰기(설정 창 저장과 보내기 고치기가 겹치지 않게)
    const string WhyChanged = "설정이 바뀌어 다음에 다시";
    // 단축키 꾸미기
    readonly object deckLock = new object();
    DeckConfig deck;                // 저장된 설정(없으면 null = 꾸민 적 없음)
    byte[] cfgBytes; string cfgHash = "";
    volatile bool forcePush, resetPending;
    volatile string deckTip = "보드가 연결되지 않았어요";
    volatile string pushState = "";
    DeckForm form;
    public event Action<string> PushProgress;   // 보드 스레드에서 온다(창은 ui.Post 로 받는다)
    public SynchronizationContext Ui { get { return ui; } }

    static Helper() { }                       // static 필드를 '처음 쓸 때' 만들게 해서 --preview 의 PENEDU_DECK_DIR 가 먹게 한다
    public static bool Quiet;                  // true 면 Log() 가 아무것도 안 씀(미리보기)
    public static bool IsPreview;              // 미리보기: DeckForm 이 설정 쓰기·창 줄이기를 건너뜀
    public static string DataDir { get { return Dir; } }

    // 미리보기 전용: 트레이·포트·설치·스레드 없음
    internal Helper(string previewData)
    {
        test = true; Quiet = true; IsPreview = true;
        ui = SynchronizationContext.Current ?? new WindowsFormsSynchronizationContext();
        string real = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "PeneduBoard");
        if (string.Equals(Path.GetFullPath(Dir).TrimEnd('\\'), real.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("미리보기가 사용자 폴더를 쓰려고 함");   // 안전장치
        Directory.CreateDirectory(Dir);
        DeckIcons.ExtractBuiltins(Path.Combine(IconDir, "기본"));
        DeckLibrary.Extract(Path.Combine(IconDir, "모음"));
    }

    public Helper(bool testMode)
    {
        test = testMode;
        ui = (SynchronizationContext.Current as WindowsFormsSynchronizationContext) ?? new WindowsFormsSynchronizationContext();   // 윈폼 것이 아니면(스레드 풀로 보냄) 새로 만든다
        marshal = new Control();                 // 화면 스레드 표지: 보드 스레드가 창을 열 때 이것으로 넘긴다
        IntPtr mh = marshal.Handle;
        iconOn = MakeIcon(Color.FromArgb(34, 160, 90), false);
        iconOff = MakeIcon(Color.FromArgb(130, 130, 130), false);
        iconPause = MakeIcon(Color.FromArgb(220, 150, 30), true);

        var menu = new ContextMenuStrip();
        menu.Items.Add(miState);
        menu.Items.Add("단축키 꾸미기…", null, delegate { OpenDeckForm(); });
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("예전 보드만 쓰는 프로그램 목록", null, delegate { OpenAppsFile(); });
        menu.Items.Add("기록 보기", null, delegate { ShellOpen(LogFile); });
        menu.Items.Add(miPause);
        menu.Items.Add(miAuto);
        menu.Items.Add(new ToolStripSeparator());
        menu.Items.Add("끝내기", null, delegate { Quit(); });
        miPause.Click += delegate { TogglePause(); };
        miAuto.Click += delegate { SetAuto(!miAuto.Checked); };
        menu.Opening += delegate { miAuto.Checked = IsAuto(); miPause.Checked = File.Exists(StopFile); };
        Theme.DarkMenu(menu);   // 꾸미기 창과 같은 어두운 메뉴·글꼴(체크 표시는 DarkMenuRenderer 가 파란 점으로 그림)
        tray.ContextMenuStrip = menu;
        tray.Icon = iconOff;
        tray.Text = "탭덱 · 찾는 중";
        tray.Visible = true;
        tray.MouseClick += delegate (object s, MouseEventArgs e) {
            // 화면 스레드에서는 보드 목록을 잠그지 않는다(보드 스레드가 프로그램을 열려고 화면 스레드를 기다리는 중일 수 있다)
            if (e.Button == MouseButtons.Left) tray.ShowBalloonTip(4000, "탭덱", lastTip.Length > 0 ? lastTip : "찾는 중", ToolTipIcon.Info);
        };
        tray.MouseDoubleClick += delegate (object s, MouseEventArgs e) { if (e.Button == MouseButtons.Left) OpenDeckForm(); };   // 두 번 누르면 꾸미기 창

        Directory.CreateDirectory(Dir);
        RotateLog();
        Log("탭덱 시작");
        if (File.Exists(DeckFile))
        {
            bool fromBak; string err;
            var c = ReadDeckFile(out fromBak, out err);
            if (c != null) RefreshCfg(c);
            else Balloon("단축키 설정 파일이 깨졌어요. 단축키 꾸미기를 열어 다시 저장해 주세요", ToolTipIcon.Warning);
        }
        try { SystemEvents.PowerModeChanged += OnPowerMode; } catch (Exception ex) { Log("절전 알림을 받지 못함: " + ex.Message); }
        // 보드 찾기를 먼저 시작하고(켤 때 느리지 않게), 설치·예전 도우미 정리는 뒤에서
        runTh = new Thread(RunWorker) { IsBackground = true, Name = "deck-run" };
        runTh.SetApartmentState(ApartmentState.STA);   // 바로 가기·셸 COM 을 쓸 수 있게
        runTh.Start();
        loopTh = new Thread(Loop) { IsBackground = true, Name = "deck" };
        loopTh.Start();
        DeckIcons.ExtractBuiltins(Path.Combine(IconDir, "기본"));
        DeckLibrary.Extract(Path.Combine(IconDir, "모음"));
        if (!test)
        {
            var inst = new Thread(Install) { IsBackground = true, Name = "deck-install" };
            inst.SetApartmentState(ApartmentState.STA);   // WScript.Shell(바로 가기) COM
            inst.Start();
        }
    }

    void OnPowerMode(object s, PowerModeChangedEventArgs e)
    {
        if (e.Mode == PowerModes.Resume) { resumed = true; try { rxWake.Set(); } catch { } }
    }

    // deck.json 읽기. 깨졌으면 deck.json.bak(지난번 저장본)을 한 번 더 본다. 둘 다 안 되면 null
    static DeckConfig ReadDeckFile(out bool fromBak, out string err)
    {
        fromBak = false; err = "";
        try { return DeckConfig.Parse(File.ReadAllText(DeckFile, Encoding.UTF8)); }
        catch (Exception ex) { err = ex.Message; Log("deck.json 을 읽지 못함: " + ex.Message); }
        string bak = DeckFile + ".bak";
        if (File.Exists(bak))
            try
            {
                var c = DeckConfig.Parse(File.ReadAllText(bak, Encoding.UTF8));
                fromBak = true;
                Log("deck.json.bak 으로 되살림");
                return c;
            }
            catch (Exception ex) { Log("deck.json.bak 도 읽지 못함: " + ex.Message); }
        return null;
    }
    Thread loopTh;
    // 보드가 누른 칸('@deck 키'): Read 는 모아 두기만 하고, Loop 가 보드 목록 잠금을 푼 뒤에 연다(보드 스레드만 쓴다)
    readonly List<KeyValuePair<string, string>> deckReq = new List<KeyValuePair<string, string>>();

    // 처음 켤 때: 자기를 %LOCALAPPDATA%\PeneduBoard 로 복사(압축 안이나 내려받기 폴더에서 바로 켜도 되게), 예전 스크립트 도우미는 끄고, 저절로 켜기 등록
    void Install()
    {
        try
        {
            string me = Application.ExecutablePath;
            string home = Path.Combine(Dir, ExeName);
            // 예전 도우미 정리는 한 번만(끝나면 .migrated 를 남긴다 — 켤 때마다 WMI 로 프로세스를 뒤지지 않게)
            string marker = Path.Combine(Dir, ".migrated");
            bool migrate = !File.Exists(marker);
            bool wasAuto = false;
            if (migrate)
            {
                // 예전 이름('교실알림판 도우미')의 바로 가기·exe 를 새 이름으로 옮긴다(2026-10-27)
                foreach (var old in new[] { OldStartupLnk, OldMenuLnk })
                    if (File.Exists(old)) { if (old == OldStartupLnk) wasAuto = true; try { File.Delete(old); Log("예전 바로 가기를 지움: " + Path.GetFileName(old)); } catch { } }
                string oldExe = Path.Combine(Dir, "교실알림판_도우미.exe");
                if (File.Exists(oldExe) && !string.Equals(Path.GetFullPath(me), Path.GetFullPath(oldExe), StringComparison.OrdinalIgnoreCase))
                    try { File.Delete(oldExe); } catch { }
                if (wasAuto && !IsAuto() && File.Exists(home)) SetAuto(true, home);
            }
            if (!string.Equals(Path.GetFullPath(me), Path.GetFullPath(home), StringComparison.OrdinalIgnoreCase))
            {
                File.Copy(me, home, true);
                bool firstTime = !IsAuto() && !wasAuto;
                SetAuto(true, home);
                if (firstTime) ui.Post(delegate { tray.ShowBalloonTip(6000, "탭덱", "설치했어요. 컴퓨터를 켤 때 저절로 켜져요.\n아이콘을 오른쪽 클릭하면 메뉴가 나와요.", ToolTipIcon.Info); }, null);
            }
            if (migrate)
            {
                // 예전 판은 레지스트리 Run 에 등록했는데, 재부팅 뒤 켜지지 않은 적이 있다(백신이 막은 것으로 보임, 2026-10-26) → 시작프로그램 폴더 바로 가기로 옮긴다
                using (var k = Registry.CurrentUser.OpenSubKey(RunKey))
                    if (k != null && k.GetValue(RunName) != null) { SetAuto(true, home); Log("자동 켜기를 시작프로그램 폴더로 옮김"); }
            }
            if (File.Exists(home) && !File.Exists(MenuLnk)) MakeLnk(MenuLnk, home);   // 시작 메뉴에서 '탭덱'으로 다시 켤 수 있게
            if (migrate)
            {
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
                try { File.WriteAllText(marker, DateTime.Now.ToString("yyyy-MM-dd HH:mm:ss")); } catch { }
            }
        }
        catch (Exception ex) { Log("설치 중 문제: " + ex.Message); }
    }

    // 저절로 켜기 = 시작프로그램 폴더의 바로 가기(사용자가 탐색기에서 보고 지울 수도 있다)
    public const string ExeName = "탭덱.exe";
    static readonly string StartupLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "탭덱.lnk");
    static readonly string MenuLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "탭덱.lnk");
    static readonly string OldStartupLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Startup), "교실알림판 도우미.lnk");
    static readonly string OldMenuLnk = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.Programs), "교실알림판 도우미.lnk");

    static bool IsAuto() { return File.Exists(StartupLnk); }

    void SetAuto(bool on) { SetAuto(on, Path.Combine(Dir, ExeName)); }
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
            st.InvokeMember("Description", BindingFlags.SetProperty, null, sc, new object[] { "탭덱 - 교실 알림판 단축키" });
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
        // 먼저 '끌까요?'를 묻고, 그다음에 꾸미기 창을 닫는다(저장 안 한 것이 있으면 창이 묻는다). '계속 고치기'로 창이 남으면 끄지 않는다.
        // (순서가 거꾸로면 창을 먼저 닫아 고친 내용을 버린 뒤 '아니오'를 눌러도 되돌릴 수 없다)
        if (MessageBox.Show("탭덱을 끄면 보드 단추를 눌러도 컴퓨터에서 아무 일도 안 일어나요.\n다시 켜려면 시작 메뉴에서 '탭덱'을 누르세요.\n끌까요?", "탭덱",
                MessageBoxButtons.YesNo, MessageBoxIcon.Question, MessageBoxDefaultButton.Button2) != DialogResult.Yes) return;
        if (form != null && !form.IsDisposed)
        {
            form.Close();
            if (!form.IsDisposed) return;
        }
        // 화면 스레드에서는 보드 목록을 잠그지 않는다(보드 스레드가 칸을 열려고 화면 스레드를 기다리는 중이면 서로 막힌다).
        // quit 만 켜면 Loop 가 스스로 포트를 닫고 끝난다. 잠깐만 기다린다
        quit = true;
        try { rxWake.Set(); } catch { }
        if (loopTh != null) try { loopTh.Join(1500); } catch { }
        try { runWake.Set(); } catch { }
        if (runTh != null) try { runTh.Join(1500); } catch { }
        try { SystemEvents.PowerModeChanged -= OnPowerMode; } catch { }
        tray.Visible = false;
        Log("탭덱 끝냄");
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
                paused = File.Exists(StopFile);   // 이 바퀴에서는 이 값만 쓴다(StateText·UpdateTray 도)
                if (paused)
                {
                    lock (boards) foreach (var n in new List<string>(boards.Keys)) Drop(n, "포트 놓음(멈춤)");
                    deckReq.Clear();
                    lock (runQueue) runQueue.Clear();   // 멈추기 직전에 줄에 들어온 칸도 실행하지 않는다(답을 보낼 보드가 이미 없다)
                    lock (runDone) runDone.Clear();
                    UpdateTray();
                    Thread.Sleep(1000); continue;
                }
                if (resumed)
                {   // 절전에서 깨면 포트가 살아 있는 척하다 죽는 일이 있다 → 모두 놓고 곧바로 다시 찾는다
                    resumed = false;
                    lock (boards) foreach (var n in new List<string>(boards.Keys)) Drop(n, WhyResume);
                    lastScan = DateTime.MinValue;
                    lastPorts = null;   // WMI 로 다시 확인
                }
                var now = DateTime.Now;
                if ((now - lastScan).TotalSeconds >= 5) { lastScan = now; Scan(now); }
                if ((now - lastBeat).TotalSeconds >= 5)
                {
                    lastBeat = now;
                    lock (boards) foreach (var n in new List<string>(boards.Keys)) if (!boards[n].Pushing)
                    {
                        Send(n, "@pc on");   // 보내는 중에는 보내는 스레드가 아이콘 사이에 보낸다
                        Board tb;
                        if (boards.TryGetValue(n, out tb) && tb.Ok && (now - tb.TimeAt).TotalSeconds >= 30)
                        {   // 설정 '컴퓨터만' 인 보드는 와이파이가 없으니 이 컴퓨터의 시각을 알려 준다(다른 보드는 무시)
                            tb.TimeAt = now;
                            Send(n, "@time " + (long)(DateTime.UtcNow - new DateTime(1970, 1, 1, 0, 0, 0, DateTimeKind.Utc)).TotalSeconds);
                        }
                    }
                }
                if (forcePush)
                {
                    forcePush = false;
                    lock (boards) foreach (var b in boards.Values) { b.PushFails = 0; b.PushStopped = false; b.NextTry = DateTime.MinValue; }
                }
                lock (boards)
                    foreach (var n in new List<string>(boards.Keys))
                    {
                        var b = boards[n];
                        if (b.Pushing) continue;
                        if (!b.Ok && (now - b.Opened).TotalSeconds >= 40)
                        {
                            int f; fails.TryGetValue(n, out f); fails[n] = ++f;
                            // 같은 칩을 쓰는 다른 장치일 수 있다: 1분 → 10분 → 그 뒤로는 30분마다 다시 열어 본다.
                            // (영영 안 여는 쪽은 안 된다: 굽는 중·부팅 중인 진짜 알림판이 세 번 겹치면, 5초 안에 뽑았다 꽂아 목록이 안 바뀔 때 다시 열 길이 없다)
                            int wait = f >= 3 ? 30 : f >= 2 ? 10 : 1;
                            Drop(n, "알림판 아님(답 없음, " + wait + "분 뒤 다시)"); skip[n] = now.AddMinutes(wait);
                            continue;
                        }
                        if (b.Ok && (now - b.LastRx).TotalSeconds > 20)
                        {   // '@pc on'(5초마다)에 20초 넘게 답이 없다 → 놓고 다음 Scan 이 바로 다시 연다(skip 안 넣음)
                            Drop(n, "답 없음(다시 찾기)");
                            continue;
                        }
                        if (b.Ok && !b.CanDeck && !b.OldBoard && b.OkAt != DateTime.MinValue && (now - b.OkAt).TotalSeconds > 3)
                        {
                            b.OldBoard = true;
                            Log("아이콘 받기를 못 하는 옛 보드: " + n + " (보내지 않음)");
                        }
                        MaybePush(b, now);
                    }
                lock (boards) foreach (var n in new List<string>(boards.Keys)) if (!boards[n].Pushing) Read(n);
                if (deckReq.Count > 0)
                {   // 여는 일은 실행 일꾼에게(여는 동안 화면 스레드를 기다려도 보드 통신·끝내기·창이 막히지 않게)
                    lock (runQueue) runQueue.AddRange(deckReq);
                    deckReq.Clear();
                    runWake.Set();
                }
                // 실행 일꾼이 남긴 답을 보드에. 보내는 중인 보드 것은 보내기 스레드가 가져간다(그 포트는 그 스레드만 쓴다)
                FlushDoneToBoards();
                UpdateTray();
            }
            catch (Exception ex) { Log("오류: " + ex.Message); }
            if (quit) break;
            rxWake.WaitOne(100);   // 글자가 들어오거나 실행 결과가 나오면 바로 깬다
        }
        lock (boards) foreach (var b in boards.Values) try { b.Port.Close(); } catch { }
    }

    // Loop 전용: runDone 에서 보내는 중이 아닌 보드의 답을 순서대로 꺼내 보낸다
    void FlushDoneToBoards()
    {
        lock (boards)
        {
            var send = new List<KeyValuePair<string, string>>();
            lock (runDone)
                for (int i = 0; i < runDone.Count; )
                {
                    Board rb;
                    if (!boards.TryGetValue(runDone[i].Key, out rb)) { runDone.RemoveAt(i); continue; }
                    if (rb.Pushing) { i++; continue; }
                    send.Add(runDone[i]); runDone.RemoveAt(i);
                }
            foreach (var kv in send) Send(kv.Key, kv.Value);
        }
    }

    // 보내기 스레드 전용: 그 보드에 갈 답만 꺼내 직접 쓴다
    void FlushDoneTo(Board b)
    {
        List<string> lines = null;
        lock (runDone)
            for (int i = 0; i < runDone.Count; )
            {
                if (runDone[i].Key == b.Name) { if (lines == null) lines = new List<string>(); lines.Add(runDone[i].Value); runDone.RemoveAt(i); }
                else i++;
            }
        if (lines != null) foreach (var l in lines) Write(b, l);
    }

    // ── 실행 일꾼(STA): 줄에서 하나씩 꺼내 연다 ──
    void RunWorker()
    {
        while (!quit)
        {
            try { runWake.WaitOne(1000); } catch { }
            while (!quit)
            {
                KeyValuePair<string, string> r;
                lock (runQueue)
                {
                    if (runQueue.Count == 0) break;
                    r = runQueue[0]; runQueue.RemoveAt(0);
                }
                bool ok = false;
                try { ok = RunOne(r.Key, r.Value); }
                catch (Exception ex) { Log("실행 중 오류: " + r.Value + " (" + ex.Message + ")"); }
                lock (runDone) runDone.Add(new KeyValuePair<string, string>(r.Key, (ok ? "@deck ok " : "@deck fail ") + r.Value));
                try { rxWake.Set(); } catch { }   // Loop·보내기 스레드가 곧바로 답을 보내게
            }
        }
    }

    // 같은 칸을 겹쳐 열지 않는다(하는 중이면 열지 않고 ok 로 답한다)
    bool RunOne(string board, string key)
    {
        lock (running)
        {
            if (running.Contains(key)) { Log("아직 앞의 동작을 하는 중: " + key); return true; }
            running.Add(key);
        }
        bool later = false;
        try { return OpenApp(key, board, out later); }
        finally { if (!later) lock (running) running.Remove(key); }   // 여러 동작은 다 끝났을 때(done 콜백) 뺀다
    }

    void Scan(DateTime now)
    {
        // COM 이름 목록이 지난번과 같으면 WMI(느림, 1~2초)는 건너뛰고 지난번 결과를 쓴다. 처음·목록이 바뀔 때·30초마다는 WMI 로 VID 확인
        string[] names;
        try { names = SerialPort.GetPortNames(); } catch { names = new string[0]; }
        Array.Sort(names, StringComparer.OrdinalIgnoreCase);
        bool same = lastPorts != null && lastPorts.Length == names.Length;
        if (same) for (int i = 0; i < names.Length; i++) if (!string.Equals(names[i], lastPorts[i], StringComparison.OrdinalIgnoreCase)) { same = false; break; }
        Dictionary<string, string> found;
        if (same && (now - lastWmi).TotalSeconds < 30) found = lastFound;
        else
        {
            found = new Dictionary<string, string>();
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
            lastPorts = names; lastFound = found; lastWmi = DateTime.Now;
            if (File.Exists(StopFile)) return;   // 찾는 사이(1~2초) '잠깐 멈춤'이 생겼으면 새로 열지 않는다(굽기·화면 찍기가 포트를 바로 쓰게)
        }
        foreach (var k in new List<string>(fails.Keys)) if (!found.ContainsKey(k)) fails.Remove(k);   // 뽑았다 꽂으면 다시 처음부터
        foreach (var k in new List<string>(skip.Keys)) if (!found.ContainsKey(k)) skip.Remove(k);
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
                // USB 를 뽑은 뒤 포트 스트림의 마무리(finalizer)가 예외를 내며 프로그램을 끄는 .NET 버그를 피한다
                try { GC.SuppressFinalize(sp.BaseStream); } catch { }
                lock (boards) boards[kv.Key] = new Board { Name = kv.Key, Kind = kv.Value, Port = new Link(sp, rxWake), Opened = now, LastRx = now };
                Send(kv.Key, "@pc on");
                if (!quietOpen.Contains(kv.Key)) Log("포트 열어 봄: " + kv.Key);   // 같은 까닭으로 놓았다 다시 여는 것은 되풀이 기록 안 함
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
        string last;
        if (lastDropWhy.TryGetValue(n, out last) && last == why) quietOpen.Add(n);   // 같은 포트에 같은 까닭이 잇달아 나오면 기록하지 않는다
        else { lastDropWhy[n] = why; quietOpen.Remove(n); Log(why + ": " + n); }
        if (b.Ok && why != WhyResume) Balloon(b.Kind + " 알림판 연결이 끊겼어요", ToolTipIcon.Warning);   // 절전에서 깬 뒤 다시 찾는 것은 알리지 않음
    }
    const string WhyResume = "절전에서 깨어남(다시 찾기)";

    void Read(string n)
    {
        Board b;
        if (!boards.TryGetValue(n, out b)) return;
        string s;
        try { s = b.Port.ReadExisting(); } catch { Drop(n, "포트 끊김"); return; }
        if (string.IsNullOrEmpty(s)) return;
        b.Buf += s;
        b.LastRx = DateTime.Now;
        int k;
        while ((k = b.Buf.IndexOf('\n')) >= 0)
        {
            string line = b.Buf.Substring(0, k).Trim();
            b.Buf = b.Buf.Substring(k + 1);
            if (line == "@board ok") { if (!b.Ok) Confirm(b); if (!b.CanDeck && b.OkAt == DateTime.MinValue) b.OkAt = DateTime.Now; }
            else if (line.StartsWith("@board ok deck="))   // 새 보드: 가진 설정의 해시
            {
                if (!b.Ok) Confirm(b);
                if (!b.CanDeck) Log("아이콘 받기가 되는 보드: " + n + " (deck=" + line.Substring(15).Trim() + ")");
                b.CanDeck = true; b.OldBoard = false; b.OkAt = DateTime.MinValue;
                b.Hash = line.Substring(15).Trim();
            }
            else if (line == "@pc?") { if (!b.Ok) Confirm(b); Send(n, "@pc on"); Log("보드가 연결을 다시 확인함(새로 고침): " + n); }   // 보드의 [새로 고침] 단추: 바로 답한다
            else if (line == "@pcui") { if (!b.Ok) Confirm(b); FormFromBoard(n); Send(n, "@pcui ok"); }   // 보드의 [꾸미기] 단추: 이 컴퓨터에 꾸미기 창을 띄운다
            else if (line.StartsWith("@get ")) { if (!b.Ok) Confirm(b); StartFetch(b, line); }   // 설정 '컴퓨터만' 인 보드가 시간표·날씨·급식을 부탁한다
            else if (line.StartsWith("@deck "))
            {
                if (!b.Ok) Confirm(b);
                string key = line.Substring(6).Trim();
                deckReq.Add(new KeyValuePair<string, string>(n, key));   // 여는 일은 Loop 가 잠금을 푼 뒤에
            }
            else if (Regex.IsMatch(line, "^(sync|reset reason|health|download|index|where|schedule|weather|meal|air|heap|pc helper|backlight|restart|deck)"))
                BoardLog(n, line);
        }
        if (b.Buf.Length > 4096) b.Buf = "";
    }

    void Confirm(Board b)
    {
        b.Ok = true;
        b.LastRx = DateTime.Now;
        fails.Remove(b.Name);
        lastDropWhy.Remove(b.Name); quietOpen.Remove(b.Name);   // 알림판이 맞으면 '되풀이 기록 안 함'도 처음부터
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
    // 실행 일꾼 스레드에서 부른다. board = 누른 보드의 COM 이름. later = 여러 동작이 아직 뒤에서 도는 중(running 은 done 콜백이 뺀다)
    bool OpenApp(string key, string board, out bool later)
    {
        later = false;
        string kind, t;
        var m = Regex.Match(key, "^s([0-9]|1[0-5])$");
        if (m.Success)   // 사용자 설정 칸 번호(새 보드)
        {
            // 보드가 옛 설정(해시가 다름)을 보이고 있으면 칸 번호가 어긋날 수 있다 → 열지 않고 알린다
            string bh = null; bool stopped = false, pushing = false; string ch;
            lock (boards) { Board bb; if (board != null && boards.TryGetValue(board, out bb)) { bh = bb.Hash; stopped = bb.PushStopped; pushing = bb.Pushing; } }
            bool have;
            lock (deckLock) { ch = cfgHash; have = deck != null; }
            if (have && bh != null && bh != "0" && bh != ch)   // 꾸민 적이 없으면(deck 없음) 보낼 것도 없으니 막지 않는다
            {
                Log("보드 설정이 컴퓨터와 달라 열지 않음: " + key + " (보드 " + bh + " / 컴퓨터 " + ch + ")");
                if ((DateTime.Now - lastStaleTip).TotalSeconds >= 10)
                {
                    lastStaleTip = DateTime.Now;
                    Balloon(stopped && !pushing ? "보드에 새 단축키를 못 보냈어요. 단축키 꾸미기에서 [저장하고 보드에 보내기]를 다시 눌러 주세요"
                                                : "보드에 새 단축키를 보내는 중이에요. 잠시 뒤 다시 눌러 주세요", ToolTipIcon.Info);
                }
                return false;
            }
            DeckCell c = null;
            lock (deckLock) if (deck != null) c = deck.Cells[int.Parse(m.Groups[1].Value)].Clone();
            if (c == null || c.Kind == "none" || (c.Kind == "multi" ? c.Steps.Count == 0 : c.Target.Length == 0)) { Log("설정이 없는 칸: " + key); return false; }
            // 자세한 설정·여러 동작까지(DeckActions.cs). 여러 동작은 따로 스레드에서 차례대로 해서 보드에는 바로 ok
            bool done = false;
            if (c.Kind == "multi")
            {
                string rk = key;
                // 다 끝났을 때(done, 화면 스레드) running 에서 빼서 같은 칸을 겹쳐 열지 않게 한다
                Action<List<string>> fin = delegate { lock (running) running.Remove(rk); };
                try { done = DeckRun.Run(c, ui, Log, null, fin); } catch { done = false; }
                later = done;   // 시작됐으면 done 콜백이 올 때까지 running 에 남겨 둔다
            }
            else
                try { done = DeckRun.Run(c, ui, Log); } catch { }
            if (done) Log("열기: " + key + (c.Kind == "multi" ? " (여러 동작 " + c.Steps.Count + "개)" : ""));
            return done;
        }
        else
        {
            t = Apps(key);
            if (t == null) { Log("모르는 단추: " + key); return false; }
            kind = t.StartsWith("#") ? "builtin" : "app";
        }
        bool ok = false;
        ui.Send(delegate {
            try { Exec(kind, t); ok = true; }
            catch (Exception ex) { Log("열기 실패: " + key + " (" + ex.Message + ")"); }
        }, null);
        if (ok) Log("열기: " + key);
        return ok;
    }

    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern bool LockWorkStation();
    [System.Runtime.InteropServices.DllImport("user32.dll")] static extern void keybd_event(byte vk, byte scan, int flags, IntPtr extra);
    // 소리·음악 키(아이콘 모음의 '소리 크게'·'재생/멈춤' 등)
    static readonly Dictionary<string, byte> MediaKeys = new Dictionary<string, byte> {
        { "#volup", 0xAF }, { "#voldown", 0xAE }, { "#playpause", 0xB3 }, { "#next", 0xB0 }, { "#prev", 0xB1 } };

    // 설정 창의 [▶ 눌러 보기]: 보드 없이 이 컴퓨터에서 바로 해 본다(화면 스레드에서 부른다)
    public static void TryCell(string kind, string t) { Exec(kind, t); }

    // 칸 하나 실행(화면 스레드): 프로그램·사이트 열기 / 단축키 / 글자 붙여 넣기 / 내장 기능. 자세한 설정이 있으면 DeckRun.Exec
    internal static void Exec(string kind, string t)
    {
        switch (kind)
        {
            case "keys": KeySend.Send(t); return;   // SendKeys 는 Win 키(#)를 모른다 → 직접 보낸다
            case "text": DeckRun.Exec("text", t, null); return;   // 복사해 둔 글자를 되돌려 놓는 쪽(DeckActions.cs)으로 통일
            case "url":
                t = (t ?? "").Trim();
                if (!UrlX.HasScheme(t)) t = "https://" + t;
                Process.Start(new ProcessStartInfo(t) { UseShellExecute = true });
                return;
            case "builtin":
                if (t == "#desktop")
                {
                    var sh = Type.GetTypeFromProgID("Shell.Application");
                    var o = Activator.CreateInstance(sh);
                    sh.InvokeMember("ToggleDesktop", BindingFlags.InvokeMethod, null, o, null);
                }
                else if (t == "#altf4") SendKeys.SendWait("%{F4}");
                else if (t == "#lock") LockWorkStation();
                else if (t == "#mute") { keybd_event(0xAD, 0, 0, IntPtr.Zero); keybd_event(0xAD, 0, 2, IntPtr.Zero); }
                else if (MediaKeys.ContainsKey(t)) { byte vk = MediaKeys[t]; keybd_event(vk, 0, 0, IntPtr.Zero); keybd_event(vk, 0, 2, IntPtr.Zero); }
                else throw new ArgumentException("모르는 내장 기능 " + t);
                return;
            default:
                Process.Start(new ProcessStartInfo(t) { UseShellExecute = true });
                return;
        }
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
            sb.AppendLine("# 고치고 저장하면 바로 쓰여요(탭덱을 다시 켤 필요 없음). 줄을 지우면 기본값으로 돌아가요.");
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

    // ════ 단축키 꾸미기: 설정 창과의 접점 ════
    void OpenDeckForm()
    {
        if (form != null && !form.IsDisposed) { form.WindowState = FormWindowState.Normal; form.Activate(); return; }
        form = new DeckForm(this);
        form.Show();
    }

    // 보드의 [꾸미기] 단추(어느 스레드에서든 부른다): 화면 스레드에서 창을 열고 맨 앞으로 끌어온다.
    // 윈도는 뒤에 있는 프로그램이 창을 앞으로 가져오는 것을 막으므로 잠깐 '항상 위'로 올렸다 내린다.
    void FormFromBoard(string port)
    {
        Log("보드에서 꾸미기 창 열기: " + port);
        if (marshal == null || marshal.IsDisposed) return;
        // ui.Post 가 아니라 화면 스레드에서 만든 컨트롤로 넘긴다(ui 가 화면 스레드를 못 가리키면 창이 다른 스레드에서 만들어져
        // '끌어다 놓기를 등록하지 못했습니다' 오류가 났다, 2026-10-27)
        marshal.BeginInvoke((MethodInvoker)delegate
        {
            OpenDeckForm();
            if (form == null || form.IsDisposed) return;
            if (form.WindowState == FormWindowState.Minimized) form.WindowState = FormWindowState.Normal;
            form.TopMost = true; form.TopMost = false;
            form.Activate();
        });
    }

    public static string AppFor(string key) { return Apps(key); }

    // 마지막 LoadDeck 에서 deck.json 이 깨져 기본값으로 시작했나(꾸미기 창이 상태줄에 알린다)
    public bool LoadFailed;

    // deck.json 읽기(없으면 기본 16개). 미리보기 그림(Tile)도 채운다
    public DeckConfig LoadDeck()
    {
        DeckConfig c = null;
        LoadFailed = false;
        if (File.Exists(DeckFile))
        {
            bool fromBak; string err;
            c = ReadDeckFile(out fromBak, out err);
            if (c == null || fromBak)
            {   // 깨진 파일은 저장으로 덮어쓰기 전에 deck.json.broken 으로 남겨 둔다
                try { File.Copy(DeckFile, DeckFile + ".broken", true); } catch (Exception ex2) { Log("deck.json.broken 을 만들지 못함: " + ex2.Message); }
            }
            LoadFailed = c == null;   // .bak 으로 살아났으면 실패가 아니다
        }
        if (c == null) c = DeckConfig.Default(Apps);
        for (int i = 0; i < 16; i++)
        {
            var cell = c.Cells[i];
            string png = Path.Combine(IconDir, "cell_" + i + ".png");
            if (cell.IconMode == "builtin") cell.Tile = DeckIcons.Builtin(cell.IconSrc.Length > 0 ? cell.IconSrc : DeckConfig.Keys[i]);
            else if (File.Exists(png))
                try { using (var fs = new FileStream(png, FileMode.Open, FileAccess.Read)) using (var im = Image.FromStream(fs)) cell.Tile = new Bitmap(im); } catch { }
            if (cell.Tile == null && cell.IconMode != "builtin") cell.Tile = DeckIcons.MakeTile(cell, png);
        }
        return c;
    }

    // deck.json 쓰기 + icons\cell_i.bin/.png 다시 만들기 + crc 채우기(화면 스레드에서 부른다)
    public void SaveDeck(DeckConfig c)
    {
        lock (saveLock)   // 보내기 스레드의 '아이콘 파일 고치기'와 겹치지 않게
        {
            Directory.CreateDirectory(IconDir);
            for (int i = 0; i < 16; i++)
            {
                var cell = c.Cells[i];
                string png = Path.Combine(IconDir, "cell_" + i + ".png"), bin = Path.Combine(IconDir, "cell_" + i + ".bin");
                if (cell.Kind == "none") { cell.Name = ""; cell.Target = ""; cell.IconMode = "builtin"; cell.IconSrc = ""; cell.Tile = null; }
                if (cell.IconMode == "builtin")
                {
                    cell.IconCrc = "";
                    try { File.Delete(png); File.Delete(bin); } catch { }
                    continue;
                }
                var t = cell.Tile ?? DeckIcons.MakeTile(cell, png);
                var data = DeckIcons.ToBin(t);
                SavePngAtomic(t, png);
                WriteBytesAtomic(bin, data);
                cell.IconCrc = DeckIcons.Crc32Hex(data);
                if (cell.Tile == null) cell.Tile = t;
            }
            WriteAtomic(DeckFile, c.ToJson());
            c.Exists = true;
            if (!c.IsDefault) resetPending = false;   // 새로 꾸몄으면 되돌리기 예약은 버린다(보낸 뒤 바로 지워지지 않게)
            RefreshCfg(c);
            Log("단축키 설정 저장(해시 " + cfgHash + (c.IsDefault ? ", 기본값" : "") + ")");
        }
    }

    // 쓰다가 꺼져도 반쯤 쓴 파일이 남지 않게: .tmp 에 다 쓴 뒤 바꿔 끼운다(deck.json 은 지난번 것을 .bak 으로 남김)
    static void WriteAtomic(string path, string text)
    {
        string tmp = path + ".tmp";
        File.WriteAllText(tmp, text, new UTF8Encoding(false));
        if (File.Exists(path))
        {
            try { File.Replace(tmp, path, path + ".bak"); }
            catch (IOException)
            {   // 일부 폴더(네트워크·동기화 폴더)에서는 Replace 가 안 될 수 있다 → 복사로
                File.Copy(path, path + ".bak", true);
                File.Copy(tmp, path, true);
                File.Delete(tmp);
            }
        }
        else File.Move(tmp, path);
    }

    static void WriteBytesAtomic(string path, byte[] data)
    {
        string tmp = path + ".tmp";
        File.WriteAllBytes(tmp, data);
        SwapIn(tmp, path);
    }

    static void SavePngAtomic(Image im, string path)
    {
        string tmp = path + ".tmp";
        im.Save(tmp, System.Drawing.Imaging.ImageFormat.Png);
        SwapIn(tmp, path);
    }

    static void SwapIn(string tmp, string path)
    {
        if (File.Exists(path)) File.Delete(path);
        File.Move(tmp, path);
    }

    // 보드 스레드에 "보내라"(force = 3번 실패로 멈춘 것도 다시)
    public void RequestPush(bool force)
    {
        if (force) forcePush = true;
        SetPushState("");
    }

    // 보드를 내장 16개로 되돌리기('@deckreset')
    public void RequestReset()
    {
        resetPending = true;
        forcePush = true;
    }

    // 설정 창 상태 줄(보드 스레드가 만든 글)
    public string DeckStatus() { return deckTip; }
    public bool HasDeckBoard() { return deckTip.StartsWith("보드:") && deckTip.IndexOf("못 해요") < 0; }

    void RefreshCfg(DeckConfig c)
    {
        var copy = c.Clone();
        foreach (var cell in copy.Cells) cell.Tile = null;
        var bytes = copy.CfgBytes();
        lock (deckLock) { deck = copy; cfgBytes = bytes; cfgHash = DeckIcons.Crc32Hex(bytes); }
    }

    void SetPushState(string s)
    {
        pushState = s;
        var h = PushProgress;
        if (h != null && s.Length > 0) try { h(s); } catch { }
    }

    string DeckStateText()
    {
        var parts = new List<string>();
        bool active; string hash;
        lock (deckLock) { active = deck != null && !deck.IsDefault; hash = cfgHash; }
        lock (boards)
            foreach (var b in boards.Values)
            {
                if (!b.Ok) continue;
                string s;
                if (b.Pushing) s = pushState.Length > 0 ? pushState : "보내는 중";
                else if (b.OldBoard) s = "이 보드는 아이콘 받기를 못 해요(보드 프로그램을 새로 구워야 해요)";
                else if (!b.CanDeck || b.Hash == null) s = "연결됨 · 확인하는 중";
                else if (resetPending && b.Hash != "0") s = "기본 아이콘으로 되돌리는 중";
                else if (!active) s = b.Hash == "0" ? "연결됨 · 보드는 기본 아이콘" : "연결됨 · 보드에 예전에 보낸 설정이 있어요";
                else if (b.Hash == hash) s = "연결됨 · 보드와 같음";
                else if (b.PushStopped) s = "보내지 못해 멈췄어요 · [저장하고 보드에 보내기]를 다시 눌러 주세요";
                else s = "연결됨 · 곧 보내요";
                parts.Add(b.Kind + " " + s);
            }
        return parts.Count == 0 ? "보드가 연결되지 않았어요" : "보드: " + string.Join(" / ", parts.ToArray());
    }

    // Loop 안(boards 잠금 중): 보낼지 정한다
    void MaybePush(Board b, DateTime now)
    {
        if (!b.Ok || !b.CanDeck || b.Hash == null || now < b.NextTry) return;
        if (b.PushStopped) return;   // 3번 실패하면 되돌리기도 멈춘다([기본값으로]·[저장하고 보드에 보내기]가 forcePush 로 다시 풂)
        // 되돌리기: 예약이 있거나, 저장된 설정이 '기본값'인데 보드가 예전 설정을 가진 경우(보드마다 — 나중에 꽂은 보드도)
        bool isDef;
        lock (deckLock) isDef = deck != null && deck.Exists && deck.IsDefault;
        bool reset = b.Hash != "0" && (resetPending || isDef);
        if (!reset)
        {
            lock (deckLock) if (deck == null || deck.IsDefault || b.Hash == cfgHash) return;
        }
        b.Pushing = true;
        var th = new Thread(delegate () { PushJob(b, reset); }) { IsBackground = true, Name = "push " + b.Name };
        th.SetApartmentState(ApartmentState.STA);   // 아이콘을 다시 만들 때 셸 COM 을 쓴다
        th.Start();
    }

    // ════ 보내기(lock-step, 설계 2-3) — 이 스레드만 그 보드의 포트를 쓴다 ════
    class PushAbort : Exception { public PushAbort(string m) : base(m) { } }

    void PushJob(Board b, bool reset)
    {
        bool ok = false;
        string why = "";
        try
        {
            b.LastBeat = DateTime.Now;
            if (reset)
            {
                SetPushState("기본 아이콘으로 되돌리는 중");
                ok = Ask(b, "@deckreset", 5000, 2, delegate (string l) { return l == "@deckreset ok"; }) != null;
                if (ok)
                {
                    b.Hash = "0";
                    bool all = true;   // 예약은 연결된 새 보드가 모두 기본으로 돌아갔을 때만 지운다(보드가 둘이면 둘 다)
                    lock (boards) foreach (var x in boards.Values) if (x.Ok && x.CanDeck && x.Hash != "0") { all = false; break; }
                    if (all) resetPending = false;
                    Log("보드를 기본 아이콘으로 되돌림: " + b.Name); SetPushState("보드를 기본 아이콘으로 되돌렸어요");
                }
                else why = "되돌리기 답 없음";
            }
            else ok = Push(b, out why);
        }
        catch (PushAbort ex) { why = ex.Message; }
        catch (Exception ex) { why = "포트 문제: " + ex.Message; }
        finally
        {
            if (!ok && why != WhyChanged) { try { b.Port.Write("@deckabort\n"); } catch { } }
            b.Buf = "";
            lock (boards)
            {
                if (ok) { b.PushFails = 0; b.PushStopped = false; }
                else if (why == WhyChanged) Log("보내기 미룸: " + b.Name + " — " + why);   // 실패로 세지 않고 다음 바퀴에 새 설정으로
                else
                {
                    b.PushFails++;
                    b.NextTry = DateTime.Now.AddSeconds(60);
                    Log("보내기 실패(" + b.PushFails + "번째): " + b.Name + " — " + why);
                    if (b.PushFails >= 3)
                    {
                        b.PushStopped = true;
                        SetPushState("보드에 보내지 못했어요");
                        Balloon("보드에 보내지 못했어요. 탭덱 메뉴 '단축키 꾸미기'에서 다시 보내 주세요", ToolTipIcon.Warning);
                    }
                    else
                    {
                        SetPushState("보드에 보내지 못했어요(1분 뒤 다시 해 봅니다)");
                        Balloon("보드에 보내지 못했어요(다시 해 봅니다)", ToolTipIcon.Warning);
                    }
                }
                b.Pushing = false;
            }
        }
    }

    bool Push(Board b, out string why)
    {
        why = "";
        // 보낼 것 한 벌(이 동안 설정 창이 저장해도 섞이지 않게)
        DeckConfig snap; byte[] cfg; string hash;
        lock (deckLock) { snap = deck.Clone(); cfg = cfgBytes; hash = cfgHash; }
        var bins = new byte[16][];
        lock (saveLock)   // 설정 창의 저장(SaveDeck)과 겹치지 않게: 아이콘 파일 읽기·고치기·deck.json 쓰기를 한 번에
        {
            string now;
            lock (deckLock) now = cfgHash;
            if (now != hash) { why = WhyChanged; return false; }   // 한 벌을 잡은 뒤 설정 창이 저장했다 → 옛 것을 덮어쓰지 않는다
            bool fixedAny = false;
            for (int i = 0; i < 16; i++)
            {
                var c = snap.Cells[i];
                if (c.IconMode == "builtin") continue;
                string bin = Path.Combine(IconDir, "cell_" + i + ".bin"), png = Path.Combine(IconDir, "cell_" + i + ".png");
                byte[] d = null;
                try { if (File.Exists(bin)) d = File.ReadAllBytes(bin); } catch { }
                if (d == null || d.Length != DeckIcons.BinLen)   // 파일이 없으면 다시 만든다
                {
                    using (var t = DeckIcons.MakeTile(c, png)) { d = DeckIcons.ToBin(t); try { SavePngAtomic(t, png); } catch { } }
                    WriteBytesAtomic(bin, d);
                }
                string crc = DeckIcons.Crc32Hex(d);
                if (crc != c.IconCrc) { c.IconCrc = crc; fixedAny = true; }
                bins[i] = d;
            }
            if (fixedAny)   // 아이콘 파일이 바뀌어 있었다 → deck.json 고치고 해시 다시
            {
                WriteAtomic(DeckFile, snap.ToJson());
                RefreshCfg(snap);
                lock (deckLock) { cfg = cfgBytes; hash = cfgHash; }
                Log("아이콘 파일을 다시 만들어 deck.json 을 고침");
            }
        }

        // ① 보드가 가진 것
        SetPushState("보드에 확인하는 중");
        string ls = Ask(b, "@deckls", 3000, 3, delegate (string l) { return l.StartsWith("@deckls "); });
        if (ls == null) { why = "@deckls 답 없음"; return false; }
        var tok = ls.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        if (tok.Length < 18) { why = "@deckls 형식: " + ls; return false; }
        var todo = new List<int>();
        for (int i = 0; i < 16; i++) if (bins[i] != null && tok[2 + i] != snap.Cells[i].IconCrc) todo.Add(i);
        if (tok[1] == hash && todo.Count == 0) { b.Hash = hash; return true; }

        // ② 시작(와이파이 받기 중이면 15초씩 기다림, 최대 5분)
        for (int k = 0; ; k++)
        {
            string r = Ask(b, "@deckbegin " + hash + " " + todo.Count, 3000, 3,
                delegate (string l) { return l == "@deckbegin ok" || l == "@deckbusy" || l.StartsWith("@deckbegin fail"); });
            if (r == null) { why = "@deckbegin 답 없음"; return false; }
            if (r == "@deckbegin ok") break;
            if (r.StartsWith("@deckbegin fail")) { why = r; return false; }
            if (k >= 19) { why = "보드가 계속 받기 중"; return false; }
            SetPushState("보드가 날씨·시간표를 받는 중이라 기다려요");
            var until = DateTime.Now.AddSeconds(15);
            while (DateTime.Now < until) { Beat(b); NextLine(b, 200); }
        }
        Log("보내기 시작: " + b.Name + " 아이콘 " + todo.Count + "개, 해시 " + hash);

        // ③④⑤ 아이콘(바뀐 것만) → cfg(맨 끝)
        for (int k = 0; k < todo.Count; k++)
        {
            Beat(b);
            SetPushState("아이콘 보내는 중 " + (k + 1) + "/" + todo.Count);
            if (!SendItem(b, todo[k].ToString(), bins[todo[k]], out why)) return false;
        }
        Beat(b);
        SetPushState("설정 보내는 중");
        if (!SendItem(b, "c", cfg, out why)) return false;

        // ⑥ 끝(보드가 검사하고 화면을 한 번 그린다)
        string e = Ask(b, "@deckend", 10000, 1, delegate (string l) { return l.StartsWith("@deckend "); });
        if (e == null) { why = "@deckend 답 없음"; return false; }
        if (!e.StartsWith("@deckend ok")) { why = e; return false; }
        b.Hash = e.Substring(11).Trim();
        if (b.Hash != hash) Log("보드 해시가 다름: " + b.Hash + " / " + hash);
        Log("보내기 끝: " + b.Name + " (해시 " + b.Hash + ")");
        SetPushState("보드에 보냈어요");
        Balloon(b.Kind + " 알림판에 새 단축키를 보냈어요", ToolTipIcon.Info);
        return true;
    }

    // ════ 보드 대신 받아 주기 — 보드가 '@get 이름 주소' 로 부탁하면 이 컴퓨터가 받아 '@fbegin/@fdata/@fend' 로 넘긴다 ════
    void StartFetch(Board b, string line)
    {
        // 호출: Loop 의 Read(boards 잠금 중). 이 보드가 이미 보내는 중이면 무시(보드가 시간이 지나 다시 부탁한다)
        var tok = line.Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
        if (tok.Length < 3 || b.Pushing) return;
        string id = tok[1], url = tok[2];
        if (!Regex.IsMatch(id, "^[a-z]{1,7}$") || !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase)) { try { b.Port.Write("@fnone " + (id.Length <= 7 ? id : "x") + " 0\n"); } catch { } return; }
        b.Pushing = true;
        var th = new Thread(delegate () { FetchJob(b, id, url); }) { IsBackground = true, Name = "fetch " + b.Name };
        th.Start();
    }

    void FetchJob(Board b, string id, string url)
    {
        string why = "";
        bool ok = false;
        try
        {
            b.LastBeat = DateTime.Now;
            byte[] data = null; int code = 0; string err = "";
            var dl = new Thread(delegate ()
            {
                try
                {
                    ServicePointManager.SecurityProtocol = (SecurityProtocolType)(3072 | 768 | 192);   // TLS 1.2 · 1.1 · 1.0
                    var req = (HttpWebRequest)WebRequest.Create(url);
                    req.Timeout = 12000; req.ReadWriteTimeout = 12000; req.UserAgent = "TapDeck";   // 압축은 쓰지 않는다(일부 서버의 deflate 를 .NET 이 못 푼다)
                    using (var resp = (HttpWebResponse)req.GetResponse())
                    {
                        code = (int)resp.StatusCode;
                        using (var st = resp.GetResponseStream())
                        using (var ms = new MemoryStream())
                        {
                            var buf = new byte[8192]; int n;
                            while ((n = st.Read(buf, 0, buf.Length)) > 0) { ms.Write(buf, 0, n); if (ms.Length > 400000) { code = -2; return; } }
                            if (code == 200) data = ms.ToArray();
                        }
                    }
                }
                catch (WebException wex) { var r = wex.Response as HttpWebResponse; code = r != null ? (int)r.StatusCode : -1; err = wex.Status + " " + wex.Message; }
                catch (Exception ex2) { code = -1; err = ex2.GetType().Name + " " + ex2.Message; }
            }) { IsBackground = true };
            dl.Start();
            while (!dl.Join(2000)) Beat(b);   // 받는 동안에도 보드에 '@pc on' (보드가 컴퓨터가 사라졌다고 보지 않게)
            if (data == null || data.Length == 0) { Write(b, "@fnone " + id + " " + code); Log("대신 받기 실패: " + id + " (" + code + ") " + err + " " + url); ok = true; }
            else { ok = SendFile(b, id, data, out why); if (ok) Log("대신 받아 보냄: " + id + " (" + data.Length + "바이트)"); }
        }
        catch (PushAbort ex) { why = ex.Message; }
        catch (Exception ex) { why = "포트 문제: " + ex.Message; }
        finally
        {
            if (!ok) Log("대신 받기 중단: " + id + " — " + why);
            b.Buf = "";
            lock (boards) b.Pushing = false;
        }
    }

    // 파일 하나를 192바이트 조각으로(조각마다 답을 기다림)
    bool SendFile(Board b, string id, byte[] data, out string why)
    {
        why = "";
        string crc = DeckIcons.Crc32Hex(data);
        string r = Ask(b, "@fbegin " + id + " " + data.Length + " " + crc, 3000, 3,
            delegate (string l) { return l == "@fbegin ok " + id || l == "@fbegin fail " + id; });
        if (r != "@fbegin ok " + id) { why = "@fbegin " + id + (r == null ? " 답 없음" : " 거절"); return false; }
        int n = (data.Length + 191) / 192;
        for (int seq = 0; seq < n; seq++)
        {
            Beat(b);
            int len = Math.Min(192, data.Length - seq * 192);
            string line = "@fdata " + id + " " + seq + " " + Convert.ToBase64String(data, seq * 192, len);
            string okL = "@fdata ok " + id + " " + seq, errL = "@fdata err " + id + " " + seq;
            bool got = false;
            for (int t = 0; t < 4 && !got; t++)
            {
                string a = Ask(b, line, 2000, 1, delegate (string l) { return l == okL || l == errL || l.StartsWith(errL + " "); });
                if (a == okL) got = true;
                else if (a != null) Log("조각 다시: " + a);
            }
            if (!got) { why = "조각 " + id + "/" + seq + " 답 없음"; return false; }
        }
        string end = Ask(b, "@fend " + id, 5000, 1,
            delegate (string l) { return l == "@fend done " + id || l.StartsWith("@fend bad " + id); });
        if (end != "@fend done " + id) { why = end == null ? "@fend 답 없음" : end; return false; }
        return true;
    }

    // 하나(아이콘 칸 번호 또는 c)를 192바이트 조각으로
    bool SendItem(Board b, string id, byte[] data, out string why)
    {
        why = "";
        string crc = DeckIcons.Crc32Hex(data);
        for (int redo = 0; redo < 3; redo++)
        {
            string r = Ask(b, "@deckitem " + id + " " + data.Length + " " + crc, 3000, 3,
                delegate (string l) { return l == "@deckitem ok " + id || l == "@deckitem fail " + id || l.StartsWith("@deckitem fail " + id + " "); });
            if (r == null) { why = "@deckitem " + id + " 답 없음"; return false; }
            if (r.StartsWith("@deckitem fail")) { why = r; return false; }
            int n = (data.Length + 191) / 192;
            for (int seq = 0; seq < n; seq++)
            {
                int len = Math.Min(192, data.Length - seq * 192);
                string line = "@deckdata " + id + " " + seq + " " + Convert.ToBase64String(data, seq * 192, len);
                string okL = "@deckdata ok " + id + " " + seq, errL = "@deckdata err " + id + " " + seq;
                bool got = false;
                for (int t = 0; t < 4 && !got; t++)
                {
                    string a = Ask(b, line, 2000, 1, delegate (string l) { return l == okL || l == errL || l.StartsWith(errL + " "); });
                    if (a == okL) got = true;
                    else if (a != null) Log("조각 다시: " + a);
                }
                if (!got) { why = "조각 " + id + "/" + seq + " 답 없음"; return false; }
            }
            string end = Ask(b, "@deckitem end " + id, 5000, 1,
                delegate (string l) { return l == "@deckitem done " + id || l == "@deckitem bad " + id || l.StartsWith("@deckitem bad " + id + " "); });
            if (end == null) { why = "@deckitem end " + id + " 답 없음"; return false; }
            if (end == "@deckitem done " + id) return true;
            Log("다시 보냄: " + end);
        }
        why = "칸 " + id + " 이(가) 계속 깨짐";
        return false;
    }

    // 아이콘 사이에만 '@pc on'(5초마다)
    void Beat(Board b)
    {
        if ((DateTime.Now - b.LastBeat).TotalSeconds < 5) return;
        b.LastBeat = DateTime.Now;
        Write(b, "@pc on");
    }

    void Write(Board b, string line)
    {
        if (quit) throw new PushAbort("끝냄");
        if ((DateTime.Now - b.StopChk).TotalMilliseconds > 500)   // '잠깐 멈추기'(보드 굽기)면 보내기도 멈춘다
        {
            b.StopChk = DateTime.Now;
            if (File.Exists(StopFile)) throw new PushAbort("잠깐 멈춤");
        }
        b.Port.Write(line + "\n");
    }

    // 한 줄 보내고, 맞는 답이 올 때까지 기다림(시간이 지나면 같은 줄을 다시, tries 번까지)
    string Ask(Board b, string line, int timeoutMs, int tries, Predicate<string> match)
    {
        for (int t = 0; t < tries; t++)
        {
            Write(b, line);
            var until = DateTime.Now.AddMilliseconds(timeoutMs);
            while (DateTime.Now < until)
            {
                string l = NextLine(b, (int)Math.Max(1, (until - DateTime.Now).TotalMilliseconds));
                if (l != null && match(l)) return l;
            }
        }
        return null;
    }

    // '@deck…' 답 한 줄(다른 줄은 여기서 처리하거나 버린다). 없으면 null
    string NextLine(Board b, int waitMs)
    {
        var until = DateTime.Now.AddMilliseconds(waitMs);
        while (true)
        {
            FlushDoneTo(b);   // 실행 일꾼이 끝낸 이 보드의 칸 답('@deck ok/fail 키')
            int k;
            while ((k = b.Buf.IndexOf('\n')) >= 0)
            {
                string line = b.Buf.Substring(0, k).Trim();
                b.Buf = b.Buf.Substring(k + 1);
                if (line.StartsWith("@deck "))   // 보내기 직전에 누른 칸: 버리지 않고 실행 일꾼에게(답은 다음 NextLine 에서)
                {
                    string key = line.Substring(6).Trim();
                    lock (runQueue) runQueue.Add(new KeyValuePair<string, string>(b.Name, key));
                    runWake.Set();
                    continue;
                }
                if (line.StartsWith("@deck") || line.StartsWith("@f")) return line;   // @f… 는 '대신 받아 주기'의 답
                if (line.StartsWith("@board ok deck=")) b.Hash = line.Substring(15).Trim();
                else if (line == "@pc?") Write(b, "@pc on");
                else if (line == "@pcui") { FormFromBoard(b.Name); Write(b, "@pcui ok"); }
                else if (Regex.IsMatch(line, "^(sync|heap|deck|restart|reset reason)")) BoardLog(b.Name, line);
            }
            if (b.Buf.Length > 8192) b.Buf = "";
            if (DateTime.Now >= until) return null;
            string s = b.Port.ReadExisting();   // 끊기면 예외 → 보내기 끝
            if (string.IsNullOrEmpty(s))
            {   // 글자가 오면(DataReceived) 바로 깬다. 늦어도 20ms 마다 다시 본다
                int left = (int)Math.Max(1, (until - DateTime.Now).TotalMilliseconds);
                rxWake.WaitOne(Math.Min(20, left));
            }
            else { b.Buf += s; b.LastRx = DateTime.Now; }
            if (quit) throw new PushAbort("끝냄");
        }
    }

    // ── 작업 표시줄 아이콘 ──
    string StateText()
    {
        if (paused) return "잠깐 멈춤 — 보드를 놓았어요(메뉴에서 다시 켜기)";
        var ok = new List<string>();
        lock (boards) foreach (var b in boards.Values) if (b.Ok) ok.Add(b.Kind + "(" + b.Name + ")");
        return ok.Count > 0 ? "연결됨: " + string.Join(", ", ok.ToArray()) : "알림판을 찾는 중 — 7인치는 UART 단자, 4인치는 USB-C 단자에 꽂아 주세요";
    }

    void UpdateTray()
    {
        deckTip = DeckStateText();
        string st = StateText();
        if (st == lastTip) return;
        lastTip = st;
        bool stop = paused, on = st.StartsWith("연결됨");
        ui.Post(delegate {
            tray.Icon = stop ? iconPause : on ? iconOn : iconOff;
            string tip = "탭덱 · " + st;
            tray.Text = tip.Length > 63 ? tip.Substring(0, 63) : tip;   // 작업 표시줄 글은 63자까지
            miState.Text = st;
        }, null);
    }

    void Balloon(string text, ToolTipIcon kind)
    {
        ui.Post(delegate { tray.ShowBalloonTip(4000, "탭덱", text, kind); }, null);
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

    static int logN;
    static readonly object logLock = new object();   // 보드·실행·보내기·화면 스레드가 같은 파일에 쓴다 → 한 번에 하나씩(공유 위반으로 줄이 사라지지 않게)
    internal static void Log(string m)
    {
        if (Quiet) return;
        string line = DateTime.Now.ToString("MM-dd HH:mm:ss") + " " + m + "\r\n";
        lock (logLock)
        {
            if (Interlocked.Increment(ref logN) % 100 == 0) RotateLog();   // 100번에 한 번 크기 확인
            try { File.AppendAllText(LogFile, line, Encoding.UTF8); } catch { }
        }
    }

    // 기록 파일이 1MB 를 넘으면 .old 로 옮기고 새로 시작(오래 켜 두어도 끝없이 커지지 않게). logLock 안에서 부른다
    static void RotateLog()
    {
        if (Quiet) return;
        lock (logLock)
            try
            {
                if (File.Exists(LogFile) && new FileInfo(LogFile).Length > 1024 * 1024) { File.Copy(LogFile, LogFile + ".old", true); File.Delete(LogFile); }
            }
            catch { }
    }
}
