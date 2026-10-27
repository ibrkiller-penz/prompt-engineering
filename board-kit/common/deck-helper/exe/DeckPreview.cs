// DeckPreview.cs — '--preview <폴더>': '단축키 꾸미기' 창을 화면 밖에서 만들어 그림 8장을 저장하고 끝낸다(검수용).
// 이미 켜진 사용자 도우미·포트·트레이·사용자 폴더·기록을 건드리지 않는다(설계_도우미화면.md 16장). C# 5 문법만
using System;
using System.Drawing;
using System.IO;
using System.Text;
using System.Windows.Forms;

static class DeckPreview
{
    public static int Run(string outDir)
    {
        var log = new StringBuilder();
        try
        {
            Application.EnableVisualStyles();
            var h = new Helper(Path.Combine(outDir, "_자료"));
            var f = new DeckForm(h);
            f.StartPosition = FormStartPosition.Manual;
            f.ShowInTaskbar = false;                       // Show 전에
            f.Location = new Point(-20000, -20000);        // 화면 밖
            f.Show(); Pump(f);
            Shot(f, outDir, "01_기본_7인치.png", log);
            f.SelectCell(10); Pump(f); Shot(f, outDir, "02_칸고름_7인치.png", log);
            f.SetShape(4); f.SelectCell(5); Pump(f); Shot(f, outDir, "03_4인치.png", log);
            f.SetShape(7); f.PreviewFind("소리"); Pump(f); Shot(f, outDir, "04_찾기_소리.png", log);
            f.PreviewFind(""); f.PreviewEmpty(15); f.SelectCell(15); Pump(f); Shot(f, outDir, "05_빈칸.png", log);
            f.ClientSize = new Size(1080, 600); Pump(f); Shot(f, outDir, "06_가장작은창.png", log);
            // 저장 안 함 표시 세 곳 + 칸 이름 점(주황: 긴 이름, 빨강: 안 되는 글자·빈 이름)
            f.ClientSize = new Size(1240, 720);
            f.PreviewName(2, "아주아주긴이름입니다"); f.PreviewName(4, "별★"); f.PreviewName(6, "");
            f.SelectCell(2); Pump(f); Shot(f, outDir, "07_저장안함_이름점.png", log);
            // 4인치 + 가장 작은 창(아래 칸이 잘리지 않는지)
            f.SetShape(4); f.SelectCell(14); f.ClientSize = new Size(1080, 600); Pump(f); Shot(f, outDir, "08_4인치_가장작은창.png", log);
            f.SetShape(7); f.ClientSize = new Size(1240, 720);
            // 동작 세팅(2026-10-27): 여러 동작 칸 · 단축키 칸 · 작은 창 셋
            f.PreviewMulti(0); Pump(f); Shot(f, outDir, "09_여러동작_칸.png", log);
            f.PreviewKeys(1); Pump(f); Shot(f, outDir, "10_단축키_칸.png", log);
            Dialog(new StepsForm(f.Work.Cells[0].Steps, f.Work.Cells[0].Name), outDir, "11_여러동작_차례창.png", log);
            Dialog(new KeyRecordForm("#+s"), outDir, "12_단축키_눌러넣기.png", log);
            var o = new System.Collections.Generic.Dictionary<string, string> { { "front", "1" }, { "args", "D:/수업/오늘.pptx" } };
            Dialog(OptionsForm.Build("app", o), outDir, "13_자세히_프로그램.png", log);
            Dialog(OptionsForm.Build("url", new System.Collections.Generic.Dictionary<string, string> { { "browser", "chrome" } }), outDir, "14_자세히_사이트.png", log);
            // 둘러보기 안내·연습 과제(2026-10-27)
            f.SelectCell(3);
            // DrawToBitmap 은 겹친 자식의 앞뒤를 거꾸로 그려서, 안내 덮개는 덮개만 따로 찍는다(덮개가 창 모습을 품고 있다)
            f.PreviewTour(0); Pump(f); Layer(f, null, outDir, "15_둘러보기_시작.png", log);
            f.PreviewTourEnd(); f.PreviewTour(2); Pump(f); Layer(f, null, outDir, "16_둘러보기_동작목록.png", log);
            f.PreviewTourEnd(); f.PreviewTour(9); Pump(f); Layer(f, null, outDir, "17_둘러보기_끝.png", log);
            f.PreviewTourEnd(); f.PreviewPractice(); Pump(f); Layer(f, f.PreviewPracticeLayer, outDir, "18_연습과제.png", log);
            f.PreviewDiscard();                            // 닫을 때 묻지 않게
            f.Close(); f.Dispose();
            log.AppendLine("글꼴 에스코어 드림 읽음: " + DeckFonts.Loaded);
            log.AppendLine("입력칸 글꼴(달라고 한 이름 → 윈도가 고른 이름): " + Theme.GdiFaceLog);
            File.WriteAllText(Path.Combine(outDir, "preview.txt"), log.ToString(), new UTF8Encoding(false));
            return 0;
        }
        catch (Exception ex)
        {
            log.AppendLine("실패: " + ex);
            try { File.WriteAllText(Path.Combine(outDir, "preview.txt"), log.ToString(), new UTF8Encoding(false)); } catch { }
            return 1;
        }
    }

    static void Layer(DeckForm f, Control over, string dir, string name, StringBuilder log)
    {
        Control top = over ?? f.PreviewTourLayer;
        if (over == null && top != null)
        {
            using (var b = new Bitmap(top.Width, top.Height)) { top.DrawToBitmap(b, new Rectangle(0, 0, top.Width, top.Height)); b.Save(Path.Combine(dir, name), System.Drawing.Imaging.ImageFormat.Png); }
            log.AppendLine(name); return;
        }
        Shot(f, dir, name, log);
        if (top == null) return;
        string p = Path.Combine(dir, name);
        Bitmap baseImg; using (var fs = File.OpenRead(p)) baseImg = new Bitmap(Image.FromStream(fs));
        using (baseImg)
        using (var g = Graphics.FromImage(baseImg))
        using (var b = new Bitmap(top.Width, top.Height))
        {
            top.DrawToBitmap(b, new Rectangle(0, 0, top.Width, top.Height));
            g.DrawImage(b, top.Left, top.Top);
            baseImg.Save(p, System.Drawing.Imaging.ImageFormat.Png);
        }
    }

    static void Dialog(Form d, string dir, string name, StringBuilder log)
    {
        d.StartPosition = FormStartPosition.Manual; d.ShowInTaskbar = false; d.Location = new Point(-20000, -20000);
        d.Show(); Pump(d); Shot(d, dir, name, log);
        d.Close(); d.Dispose();
    }

    static void Pump(Form f)
    {
        for (int i = 0; i < 5; i++) Application.DoEvents();
        f.PerformLayout(); f.Refresh();
        Application.DoEvents();
    }

    static void Shot(Form f, string dir, string name, StringBuilder log)
    {
        using (var whole = new Bitmap(f.Width, f.Height))
        {
            f.DrawToBitmap(whole, new Rectangle(0, 0, f.Width, f.Height));
            Point c = f.PointToScreen(Point.Empty);
            var r = new Rectangle(c.X - f.Left, c.Y - f.Top, f.ClientSize.Width, f.ClientSize.Height);   // 제목 띠 빼고 안쪽만
            r.Intersect(new Rectangle(0, 0, whole.Width, whole.Height));
            using (var inner = whole.Clone(r, whole.PixelFormat)) inner.Save(Path.Combine(dir, name), System.Drawing.Imaging.ImageFormat.Png);
        }
        log.AppendLine(name);
    }
}
