// 단축키 칸 설정(deck.json) 읽기·쓰기와 보드로 보내는 cfg.json 만들기 — C# 5 문법만
using System;
using System.Collections.Generic;
using System.Drawing;
using System.Globalization;
using System.Text;

class DeckCell
{
    public string Name = "";
    public string Kind = "none";      // app url keys text builtin none
    public string Target = "";
    public string IconMode = "builtin"; // auto favicon letter file builtin
    public string IconSrc = "";
    public string IconCrc = "";
    public Bitmap Tile;               // 72x72 미리보기(파일에 쓰지 않음, 바뀌면 저장 때 .bin 을 새로 만든다)

    public DeckCell Clone()
    {
        var c = (DeckCell)MemberwiseClone();
        if (Tile != null) c.Tile = new Bitmap(Tile);
        return c;
    }
}

class DeckConfig
{
    public bool IsDefault;            // [기본값으로] 뒤: 보드로 보내지 않는다
    public bool Exists;               // deck.json 이 있었나
    public DeckCell[] Cells = new DeckCell[16];

    public static readonly string[] Keys = { "explorer", "claude", "gemini", "gpt", "cmd", "powershell", "neis", "naver",
        "youtube", "coolmsg", "kakao", "excel", "ppt", "close", "hwp", "desktop" };
    public static readonly string[] KeyNames = { "탐색기", "Claude", "제미나이", "GPT", "CMD", "파워셸", "나이스", "네이버",
        "유튜브", "쿨메신저", "카카오톡", "엑셀", "PPT", "창닫기", "한글", "바탕화면" };

    public DeckConfig Clone()
    {
        var d = new DeckConfig { IsDefault = IsDefault, Exists = Exists };
        for (int i = 0; i < 16; i++) d.Cells[i] = Cells[i].Clone();
        return d;
    }

    // 기본 16칸(보드 내장과 같은 이름·그림, 여는 것은 DefaultApps)
    public static DeckConfig Default(Func<string, string> appFor)
    {
        var d = new DeckConfig();
        for (int i = 0; i < 16; i++)
        {
            string t = appFor(Keys[i]) ?? "";
            var c = new DeckCell { Name = KeyNames[i], Target = t, IconMode = "builtin", IconSrc = Keys[i] };
            if (t.StartsWith("#")) c.Kind = "builtin";
            else if (t.StartsWith("http://") || t.StartsWith("https://")) c.Kind = "url";
            else c.Kind = "app";
            d.Cells[i] = c;
        }
        return d;
    }

    public static DeckCell Empty() { return new DeckCell(); }

    // ── deck.json 읽기 ──
    public static DeckConfig Parse(string json)
    {
        var root = new Json(json).Value() as Dictionary<string, object>;
        if (root == null) throw new FormatException("deck.json 형식이 아님");
        var d = new DeckConfig { Exists = true };
        object o;
        if (root.TryGetValue("default", out o) && o is bool) d.IsDefault = (bool)o;
        var cells = root.TryGetValue("cells", out o) ? o as List<object> : null;
        for (int i = 0; i < 16; i++)
        {
            var c = new DeckCell();
            var m = cells != null && i < cells.Count ? cells[i] as Dictionary<string, object> : null;
            if (m != null)
            {
                c.Name = Str(m, "name"); c.Kind = Str(m, "kind"); c.Target = Str(m, "target");
                if (c.Kind == "") c.Kind = "none";
                var ic = m.TryGetValue("icon", out o) ? o as Dictionary<string, object> : null;
                if (ic != null) { c.IconMode = Str(ic, "mode"); c.IconSrc = Str(ic, "src"); c.IconCrc = Str(ic, "crc"); }
                if (c.IconMode == "") c.IconMode = "builtin";
            }
            d.Cells[i] = c;
        }
        return d;
    }

    static string Str(Dictionary<string, object> m, string k)
    {
        object o;
        return m.TryGetValue(k, out o) && o != null ? Convert.ToString(o, CultureInfo.InvariantCulture) : "";
    }

    // ── deck.json 쓰기(사람이 읽기 좋게) ──
    public string ToJson()
    {
        var sb = new StringBuilder();
        sb.Append("{\n  \"v\": 1,\n");
        if (IsDefault) sb.Append("  \"default\": true,\n");
        sb.Append("  \"cells\": [\n");
        for (int i = 0; i < 16; i++)
        {
            var c = Cells[i];
            sb.Append("    { \"name\": ").Append(Q(c.Name)).Append(", \"kind\": ").Append(Q(c.Kind)).Append(", \"target\": ").Append(Q(c.Target))
              .Append(",\n      \"icon\": { \"mode\": ").Append(Q(c.IconMode)).Append(", \"src\": ").Append(Q(c.IconSrc))
              .Append(", \"crc\": ").Append(Q(c.IconCrc)).Append(" } }").Append(i < 15 ? ",\n" : "\n");
        }
        sb.Append("  ]\n}\n");
        return sb.ToString();
    }

    // 칸 i 의 cfg 아이콘 값: crc 8자리 / "" (내장 i) / "builtin:<키>"
    public string CfgIcon(int i)
    {
        var c = Cells[i];
        if (c.IconMode == "builtin") return c.IconSrc == "" ? "" : "builtin:" + c.IconSrc;
        return c.IconCrc;
    }

    // ── 보드로 보내는 cfg.json 바이트(같은 설정이면 언제나 같은 바이트: 키 차례 고정·공백 없음·UTF-8 BOM 없음) ──
    public byte[] CfgBytes()
    {
        var sb = new StringBuilder();
        sb.Append("{\"v\":1,\"n\":[");
        for (int i = 0; i < 16; i++) { if (i > 0) sb.Append(','); sb.Append(Q(Cells[i].Kind == "none" ? "" : Cells[i].Name)); }
        sb.Append("],\"ic\":[");
        for (int i = 0; i < 16; i++) { if (i > 0) sb.Append(','); sb.Append(Q(CfgIcon(i))); }
        sb.Append("]}");
        return new UTF8Encoding(false).GetBytes(sb.ToString());
    }

    // JSON 문자열: " \ 만 바꾸고 0x00~0x1F 는 \uXXXX, 한글·/ 는 그대로
    public static string Q(string s)
    {
        var sb = new StringBuilder("\"");
        foreach (char ch in s ?? "")
        {
            if (ch == '"') sb.Append("\\\"");
            else if (ch == '\\') sb.Append("\\\\");
            else if (ch < 0x20) sb.Append("\\u").Append(((int)ch).ToString("x4"));
            else sb.Append(ch);
        }
        return sb.Append('"').ToString();
    }
}

// 아주 작은 JSON 읽개(.NET 4 에는 기본 JSON 이 없다)
class Json
{
    readonly string s; int p;
    public Json(string text) { s = text ?? ""; if (s.Length > 0 && s[0] == '﻿') p = 1; }

    bool At(string w) { return string.CompareOrdinal(s, p, w, 0, w.Length) == 0; }
    void Ws() { while (p < s.Length && char.IsWhiteSpace(s[p])) p++; }

    public object Value()
    {
        Ws();
        if (p >= s.Length) throw new FormatException("끝");
        char c = s[p];
        if (c == '{')
        {
            p++; var m = new Dictionary<string, object>();
            Ws(); if (s[p] == '}') { p++; return m; }
            while (true)
            {
                Ws(); string k = (string)Value(); Ws();
                if (s[p] != ':') throw new FormatException(":");
                p++; m[k] = Value(); Ws();
                if (s[p] == ',') { p++; continue; }
                if (s[p] == '}') { p++; return m; }
                throw new FormatException("}");
            }
        }
        if (c == '[')
        {
            p++; var l = new List<object>();
            Ws(); if (s[p] == ']') { p++; return l; }
            while (true)
            {
                l.Add(Value()); Ws();
                if (s[p] == ',') { p++; continue; }
                if (s[p] == ']') { p++; return l; }
                throw new FormatException("]");
            }
        }
        if (c == '"')
        {
            p++; var sb = new StringBuilder();
            while (s[p] != '"')
            {
                if (s[p] == '\\')
                {
                    p++; char e = s[p];
                    if (e == 'n') sb.Append('\n'); else if (e == 't') sb.Append('\t'); else if (e == 'r') sb.Append('\r');
                    else if (e == 'b') sb.Append('\b'); else if (e == 'f') sb.Append('\f');
                    else if (e == 'u') { sb.Append((char)Convert.ToInt32(s.Substring(p + 1, 4), 16)); p += 4; }
                    else sb.Append(e);
                    p++;
                }
                else sb.Append(s[p++]);
            }
            p++; return sb.ToString();
        }
        if (At("true")) { p += 4; return true; }
        if (At("false")) { p += 5; return false; }
        if (At("null")) { p += 4; return null; }
        int st = p;
        while (p < s.Length && "+-0123456789.eE".IndexOf(s[p]) >= 0) p++;
        if (p == st) throw new FormatException("모르는 글자");
        return double.Parse(s.Substring(st, p - st), CultureInfo.InvariantCulture);
    }
}
