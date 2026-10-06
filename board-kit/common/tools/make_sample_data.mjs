// 교실 알림판 '샘플 자료' 만들기 — 가짜 학교, 가짜 선생님(국어A·수학A…), 가짜 학급(1학년 1반…)
//
//   node tools/make_sample_data.mjs                      → ../site/public/board/ 에 만든다
//   node tools/make_sample_data.mjs --out 다른폴더        → 다른 폴더에 만든다
//   node tools/make_sample_data.mjs --year 2026           → 학년도를 직접 정한다(기본: 오늘이 속한 학년도, 3월 시작)
//
// 외부 라이브러리가 필요 없다(Node.js 18 이상). 보드(펌웨어)가 받는 파일 모양과 똑같이 만든다.
//   board/index.json     시간표 목록(설정 화면의 '볼 시간표')
//   board/t/001.json …   시간표 한 개당 파일 한 개(학년도 전체 주차)
//   board/where.json     '선생님 찾기' 화면용(선생님 × 오늘부터 수업일 10일)
// 칸 하나는 [종류, 위 글, 아래 글, 꼬리표]. 자세한 설명은 tools/data-format.md 를 본다.
//   종류: n 수업 · d 당겨옴 · j 공강지도/보강 · x 결강 · c 창체 · e 시험 · f 행사 · h 휴일 · '' 빈칸(공강)
//
// 내 학교 자료로 바꾸려면: 이 파일은 '모양 보여 주기'용이다. 내 시간표 프로그램/엑셀에서 같은 모양의 JSON 을 만들어 올린다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name, def) => { const i = argv.indexOf(name); return i >= 0 && argv[i + 1] ? argv[i + 1] : def; };
const OUT = path.resolve(opt('--out', path.join(HERE, '..', 'site', 'public', 'board')));

// ── 날짜 도구(UTC 로만 계산해서 PC 의 시간대·여름시간에 흔들리지 않게) ──
const utc = (y, m, d) => new Date(Date.UTC(y, m - 1, d));
const addDays = (d, n) => new Date(d.getTime() + n * 86400000);
const iso = d => d.toISOString().slice(0, 10);
const mondayOf = d => addDays(d, -((d.getUTCDay() + 6) % 7));
const nowKst = new Date(Date.now() + 9 * 3600 * 1000);
const today = utc(nowKst.getUTCFullYear(), nowKst.getUTCMonth() + 1, nowKst.getUTCDate());
const YEAR = Number(opt('--year', today.getUTCMonth() + 1 >= 3 ? today.getUTCFullYear() : today.getUTCFullYear() - 1));
const yearOf = m => (m >= 3 ? YEAR : YEAR + 1);          // 학년도: 3월 ~ 다음 해 2월
const DOW = ['월', '화', '수', '목', '금'];
const PERIODS = ['08:40', '09:40', '10:40', '11:40', '13:30', '14:40', '15:40'];   // 펌웨어 main.cpp 의 PERIOD_START 와 같게

// ── 가짜 학교 ──
const SUBJECTS = ['국어', '수학', '영어', '과학', '사회', '체육', '음악', '미술', '기술', '정보', '역사', '도덕'];
const TEACHERS = SUBJECTS.map(s => s + 'A');               // 국어A, 수학A, … (가짜 이름. 실제 사람이 아니다)
const CLASSES = ['1학년1반', '1학년2반', '2학년1반', '2학년2반', '3학년1반', '3학년2반'];
const ROOMS = ['101', '102', '201', '202', '301', '302'];  // 학급 교실 번호(가짜)

// ── 쉬는 날(고정 날짜만. 대체공휴일·음력 명절은 넣지 않았다) ──
const HOLIDAYS = {
  '03-01': '삼일절', '05-05': '어린이날', '05-20': '개교기념일(샘플)', '06-06': '현충일', '08-15': '광복절',
  '10-03': '개천절', '10-09': '한글날', '12-25': '성탄절', '01-01': '신정',
};
// ── 학교 행사(샘플): 그 날짜가 든 주의 지정한 요일(0=월). type 은 exam(시험) / festival(행사) ──
const EVENTS = [
  { m: 4, d: 20, days: [0, 1, 2], type: 'exam', title: '1학기 중간고사' },
  { m: 5, d: 15, days: [4], type: 'festival', title: '체육대회' },
  { m: 7, d: 6, days: [0, 1, 2], type: 'exam', title: '1학기 기말고사' },
  { m: 10, d: 19, days: [0, 1, 2], type: 'exam', title: '2학기 중간고사' },
  { m: 12, d: 7, days: [0, 1, 2], type: 'exam', title: '2학기 기말고사' },
];
const eventByDate = new Map();
for (const e of EVENTS) {
  const mon = mondayOf(utc(yearOf(e.m), e.m, e.d));
  for (const dd of e.days) eventByDate.set(iso(addDays(mon, dd)), e);
}

// ── 기본 시간표(한 주): 학급 c · 요일 d · 교시 p → 과목 번호 ──
// 같은 (요일, 교시)에서 학급마다 다른 과목이 되게 해서(= 선생님이 한꺼번에 두 반에 있을 수 없게) 겹침이 없다.
// 수요일 6·7교시는 창체(동아리) 시간이다.
const isChangche = (d, p) => d === 2 && p >= 5;
const subjOf = (c, d, p) => (c + d * 5 + p * 7) % 12;
// 선생님 t(=과목 번호) 가 (d, p) 에 가르치는 학급 번호, 없으면 -1
const classOfTeacher = (t, d, p) => { if (isChangche(d, p)) return -1; const c = (((t - (d * 5 + p * 7)) % 12) + 12) % 12; return c < CLASSES.length ? c : -1; };

const baseTeacherCells = t => DOW.map((_, d) => PERIODS.map((_, p) => {
  if (isChangche(d, p)) return ['c', '창체', '', ''];   // 모든 선생님이 동아리(창체)를 지도한다고 가정
  const c = classOfTeacher(t, d, p);
  return c < 0 ? ['', '', '', ''] : ['n', SUBJECTS[t], ROOMS[c], ''];
}));
const baseClassCells = c => DOW.map((_, d) => PERIODS.map((_, p) => {
  if (isChangche(d, p)) return ['c', '창체', '', ''];
  const s = subjOf(c, d, p);
  return ['n', SUBJECTS[s], TEACHERS[s], ''];          // 학급 시간표: 위 = 과목, 아래 = 선생님
}));
const baseT = TEACHERS.map((_, t) => baseTeacherCells(t));
const baseC = CLASSES.map((_, c) => baseClassCells(c));
const hoursOf = t => baseT[t].flat().filter(x => x[0] === 'n').length;

// ── 주차 목록: 학년도의 첫 월요일 ~ 다음 해 2월 말 ──
const firstMon = mondayOf(utc(YEAR, 3, 2));
const lastDay = utc(YEAR + 1, 2, 28);
const mondays = [];
for (let m = firstMon; m <= lastDay; m = addDays(m, 7)) mondays.push(m);
const wkNow = Math.max(0, mondays.findLastIndex(m => m <= today));   // 오늘이 든 주

// 급식지도(점심 12:30)와 야자 감독(18:30): 돌아가며 맡는다
const lunchDuty = (wk, d) => [TEACHERS[(wk * 5 + d * 2) % 12], TEACHERS[(wk * 5 + d * 2 + 1) % 12]];
const nightDuty = (wk, d) => (d <= 3 ? TEACHERS[(wk * 4 + d) % 12] : '');   // 월~목만

// 공강 첫 칸 찾기
const firstFree = cells => cells.findIndex(x => x[0] === '');
const firstLesson = cells => cells.findIndex(x => x[0] === 'n');
// 이번 주·다음 주에 보여 줄 예외(교체 수업) 예시. [선생님 번호, 주 번호(오늘 기준), 요일, 종류]
const EXCEPTIONS = [
  [0, 0, 1, 'jido'],     // 국어A: 공강지도(꼬리표 '지도')
  [1, 0, 3, 'bogang'],   // 수학A: 보강(다른 선생님 대신 수업)
  [2, 0, 4, 'gyeolgang'], // 영어A: 결강(대강 선생님이 들어옴)
  [3, 1, 0, 'danggyeo'], // 과학A: 다음 주 월요일에 당겨온 수업
];
function applyException(cells, t, ex) {
  const [, , , kind] = ex;
  if (kind === 'jido') { const i = firstFree(cells); if (i >= 0) cells[i] = ['j', '공강지도', '도서관', '지도']; }
  else if (kind === 'bogang') { const i = firstFree(cells); if (i >= 0) cells[i] = ['j', '영어', `${ROOMS[2]} · ${TEACHERS[2]} 대신`, '보강']; }
  else if (kind === 'gyeolgang') { const i = firstLesson(cells); if (i >= 0) cells[i] = ['x', cells[i][1], `대강 ${TEACHERS[4]}`, '결강']; }
  else if (kind === 'danggyeo') { const i = firstFree(cells); if (i >= 0) cells[i] = ['d', SUBJECTS[t], ROOMS[1], '당겨옴 금3']; }
}

// ── 하루 만들기 ──
function makeDay(isClass, idx, wk, d) {
  const date = iso(addDays(mondays[wk], d));
  const md = date.slice(5);
  let type = 'normal', tag = '', cells;
  const holiday = HOLIDAYS[md], ev = eventByDate.get(date);
  if (holiday) {
    type = 'holiday'; tag = holiday;
    cells = PERIODS.map((_, p) => ['h', p === 0 ? holiday : '', '', '']);       // 제목은 첫 칸에만
  } else if (ev) {
    type = ev.type; tag = ev.title;
    const k = ev.type === 'exam' ? 'e' : 'f';
    cells = PERIODS.map((_, p) => [k, p === 0 ? ev.title : '', '', '']);
  } else {
    cells = (isClass ? baseC[idx] : baseT[idx])[d].map(x => x.slice());
    if (!isClass) for (const ex of EXCEPTIONS) if (ex[0] === idx && wkNow + ex[1] === wk && ex[2] === d) applyException(cells, idx, ex);
  }
  const off = !!holiday || !!ev;
  const duty = lunchDuty(wk, d);
  const lunch = off ? '' : isClass ? duty.join(' · ') : (duty.includes(TEACHERS[idx]) ? '급식지도' : '');
  return { date, dow: DOW[d], type, tag, lunch, night: off ? '' : nightDuty(wk, d), cells };
}

// ── 파일로 쓰기 ──
const generated = new Date().toISOString();
fs.rmSync(path.join(OUT, 't'), { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 't'), { recursive: true });
const index = { generated, mods: 0, periods: PERIODS, items: [] };
const entries = [
  ...TEACHERS.map((n, i) => ({ name: n, kind: 'teacher', label: `${n} 선생님`, isClass: false, idx: i })),
  ...CLASSES.map((n, i) => ({ name: n, kind: 'class', label: n.replace(/^(\d)학년(\d+)반$/, '$1학년 $2반'), isClass: true, idx: i })),
];
entries.forEach((e, i) => {
  const file = `t/${String(i + 1).padStart(3, '0')}.json`;
  const weeks = mondays.map((_, wk) => ({ n: wk + 1, days: DOW.map((_, d) => makeDay(e.isClass, e.idx, wk, d)) }));
  const doc = {
    name: e.name, kind: e.kind,
    hours: e.isClass ? '' : String(hoursOf(e.idx)),
    home: e.isClass ? '' : (e.idx < CLASSES.length ? CLASSES[e.idx] : ''),     // 담임 반(앞의 6명이 담임)
    generated, mods: 0, periods: PERIODS, weeks,
  };
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(doc));
  index.items.push({ name: e.name, label: e.label, kind: e.kind, file });
});
fs.writeFileSync(path.join(OUT, 'index.json'), JSON.stringify(index));

// ── 선생님 찾기 where.json: 오늘부터 수업일 10일. 칸 문자열은 '종류:글' (빈칸 = 공강) ──
const dates = [];
for (let wk = Math.max(0, wkNow); wk < mondays.length && dates.length < 10; wk++)
  for (let d = 0; d < 5 && dates.length < 10; d++) {
    const dt = addDays(mondays[wk], d);
    if (dt >= today) dates.push({ wk, d, iso: iso(dt) });
  }
const where = { generated, dates: dates.map(x => x.iso), teachers: [] };
TEACHERS.forEach((n, t) => {
  const days = dates.map(({ wk, d }) => makeDay(false, t, wk, d).cells.map(([k, a, b]) => {
    if (!k) return '';
    if (k === 'n' || k === 'd') return `${k}:${[b, a].filter(Boolean).join(' ')}`;    // 수업은 '교실 과목'
    return `${k}:${[a, b].filter(Boolean).join(' ')}`;
  }));
  where.teachers.push({ n, h: t < CLASSES.length ? CLASSES[t] : '', d: days });
});
fs.writeFileSync(path.join(OUT, 'where.json'), JSON.stringify(where));

const kb = f => (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(1) + 'KB';
console.log(`학년도 ${YEAR} · 주차 ${mondays.length}개(${iso(mondays[0])} ~ ${iso(addDays(mondays.at(-1), 4))}) · 오늘은 ${wkNow + 1}주차`);
console.log(`시간표 ${index.items.length}개 → ${path.join(OUT, 't')} (예: t/001.json ${kb('t/001.json')})`);
console.log(`목록 index.json ${kb('index.json')} · 선생님 찾기 where.json ${kb('where.json')} (${where.teachers.length}명 × ${dates.length}일)`);
console.log('가짜 이름(국어A·1학년1반 …)입니다. 내 학교 자료는 data-format.md 의 모양대로 만들어 올리세요.');
