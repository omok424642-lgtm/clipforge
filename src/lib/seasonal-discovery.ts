/** Editorial planning calendar, NOT a feed of sales/search popularity. Client-safe and offline. */
export const SEASONAL_REVISION = "2026-10-27";
export const SEASONAL_SOURCE = "ClipForge 한국 시즌 기획표";
export const DISCOVERY_CATEGORIES = ["생활용품", "주방", "가전", "육아", "인테리어", "학습·야외"] as const;
export type DiscoveryCategory = (typeof DISCOVERY_CATEGORIES)[number];
export type SeasonView = "now_next" | "this_month" | "next_month" | "ahead" | "month";
export interface SeasonalItem {
  id: string;
  name: string;
  category: DiscoveryCategory;
  start: [number, number];
  end: [number, number];
  keywords: string[];
  reason: string;
  filming: string;
  timingNote?: string;
}

function item(id: string, name: string, category: DiscoveryCategory, start: [number, number], end: [number, number], keywords: string[], reason: string, filming: string, timingNote?: string): SeasonalItem {
  return { id, name, category, start, end, keywords, reason, filming, timingNote };
}
export const SEASONAL_ITEMS: SeasonalItem[] = [
  item("winter-bedding", "겨울 침구·담요", "생활용품", [11, 1], [2, 29], ["담요", "겨울이불", "극세사", "blanket", "bedding"], "추워지는 계절의 침구 교체와 실내 생활을 준비하기 좋은 품목입니다.", "두께·크기·수납 방법을 보여 주세요."),
  item("winter-sealing", "창문 틈막이·문풍지", "생활용품", [11, 1], [2, 29], ["문풍지", "틈막이", "단열필름", "weatherstrip"], "겨울 실내 환경을 준비하며 설치 방법을 소개하기 좋습니다.", "창문 규격 확인과 부착 전후 모습을 보여 주세요. 단열 수치는 근거가 필요합니다."),
  item("humidifier", "가습기·관리용품", "가전", [10, 15], [2, 29], ["가습기", "humidifier"], "건조해지는 시기의 실내 관리 주제로 준비할 수 있습니다.", "물통 분리·세척·용량을 보여 주세요. 건강 효과를 추정하지 마세요."),
  item("winter-baby", "유아 겨울 외출용품", "육아", [11, 1], [2, 29], ["유모차방한", "유아담요", "아기담요", "방한커버"], "추운 날의 유아 외출 준비에 관련된 품목입니다.", "크기·고정 방식·호환 규격과 안전 주의사항을 확인하세요."),
  item("winter-decor", "겨울 쿠션·러그", "인테리어", [11, 1], [2, 29], ["러그", "겨울쿠션", "rug"], "겨울 실내 분위기를 바꾸는 기획에 적합합니다.", "실제 색상·크기·배치와 관리 방법을 보여 주세요."),
  item("christmas", "크리스마스 장식·조명", "인테리어", [12, 1], [12, 25], ["크리스마스", "트리", "오너먼트", "christmas"], "12월 장식과 선물 포장 준비를 미리 소개할 수 있습니다.", "조립·설치·크기와 전원 방식을 보여 주세요."),
  item("year-end-kitchen", "연말 홈파티 식기", "주방", [12, 1], [12, 31], ["파티식기", "플레이팅", "와인잔", "케이크접시"], "연말 모임의 테이블 준비와 상차림 기획에 관련됩니다.", "인원별 구성과 실제 상차림 예시를 보여 주세요."),
  item("new-year-storage", "새해 정리·수납용품", "생활용품", [1, 1], [2, 29], ["수납", "정리함", "압축팩", "storage", "organizer"], "새해 생활 공간 정리와 수납 계획을 소개하기 좋습니다.", "수납 전후와 실제 치수를 보여 주세요."),
  item("seollal-kitchen", "설 명절 조리·보관용품", "주방", [1, 1], [2, 29], ["밀폐용기", "전기팬", "전팬", "찜기", "명절"], "설 명절 음식 준비와 남은 음식 보관 주제로 활용할 수 있습니다.", "조리 가능한 양과 분리 세척 방법을 보여 주세요.", "1~2월의 넓은 준비 범위입니다. 해당 연도 설날 날짜를 확정한 안내가 아니므로 실제 일정을 확인하세요."),
  item("seollal-gifts", "설 선물 포장·보자기", "생활용품", [1, 1], [2, 29], ["보자기", "선물포장", "선물상자"], "설 선물 전달을 준비하는 포장 방법 기획입니다.", "포장 순서와 크기별 활용 예시를 보여 주세요.", "설날은 매년 날짜가 달라집니다. 정확한 명절 일정을 확인하세요."),
  item("spring-school", "새 학기 필기·책상 정리용품", "학습·야외", [3, 1], [3, 31], ["필통", "책상정리", "독서대", "문구", "연필", "stationery"], "3월 새 학기 생활과 공부 공간 정리를 준비할 수 있습니다.", "책상 배치·수납·규격을 보여 주세요.", "실제 개학일은 학교별로 확인하세요."),
  item("spring-baby", "어린이집 등원 준비용품", "육아", [3, 1], [3, 31], ["등원", "낮잠이불", "이름스티커", "어린이집", "유아식판"], "새 학기 등원 준비물 확인에 관련됩니다.", "이름 표시·세척·수납 모습을 보여 주세요. 기관별 준비물은 다를 수 있습니다."),
  item("spring-clean", "봄 청소 도구", "생활용품", [3, 1], [5, 31], ["청소솔", "밀대", "청소도구", "먼지떨이", "mop"], "계절이 바뀔 때 집안을 정리하는 기획에 활용할 수 있습니다.", "도구 사용법과 닿는 범위를 보여 주세요."),
  item("spring-air", "공기청정기 필터·관리용품", "가전", [3, 1], [5, 31], ["공기청정기", "청정기필터", "airpurifier"], "봄철 실내 기기 관리와 필터 교체 방법을 소개할 수 있습니다.", "호환 모델과 교체 과정을 보여 주세요. 정화 성능은 시험 근거를 확인하세요."),
  item("spring-decor", "봄 커튼·패브릭", "인테리어", [3, 1], [5, 31], ["커튼", "패브릭", "봄쿠션", "curtain"], "봄 분위기에 맞춘 공간 배치 기획에 관련됩니다.", "채광·색상·치수와 설치 방법을 보여 주세요."),
  item("picnic", "봄 소풍·도시락 용품", "주방", [4, 1], [5, 31], ["도시락", "피크닉", "보냉백", "lunchbox"], "봄 소풍과 야외 식사 준비를 소개할 수 있습니다.", "내용물 구성·크기·휴대 모습을 보여 주세요."),
  item("childrens-day", "어린이날 만들기·놀이용품", "육아", [5, 1], [5, 5], ["만들기", "보드게임", "블록", "어린이날"], "5월 5일 어린이날의 놀이 준비와 선물 기획입니다.", "권장 연령·구성품·놀이 방법과 안전 표시를 확인하세요."),
  item("parents-day", "어버이날 꽃·포장용품", "인테리어", [5, 1], [5, 8], ["카네이션", "꽃포장", "어버이날"], "5월 8일에 맞춘 선물 전달과 장식 준비 기획입니다.", "실제 구성과 포장 과정을 보여 주세요."),
  item("summer-fan", "선풍기·서큘레이터", "가전", [5, 15], [8, 31], ["선풍기", "서큘레이터", "휴대용팬", "fan"], "더워지는 계절을 앞두고 설치·보관·사용법을 소개하기 좋습니다.", "크기·조작·분리 세척을 보여 주세요. 소음·풍량 수치는 근거가 필요합니다."),
  item("rain-gear", "장마 우산·우비·방수 커버", "생활용품", [6, 15], [7, 31], ["우산", "우비", "방수커버", "장화", "umbrella"], "장마철 외출 준비와 사용 후 보관을 소개할 수 있습니다.", "접는 방법·휴대 크기·건조 방법을 보여 주세요.", "통상적인 6~7월 준비 범위이며 실제 장마 시작 예보가 아닙니다. 지역별 날씨를 확인하세요."),
  item("rain-home", "제습기·습기 관리용품", "가전", [6, 15], [7, 31], ["제습기", "제습제", "습기", "dehumidifier"], "비가 잦은 계절의 실내 관리 주제입니다.", "물통·배수·사용 조건을 보여 주세요. 제습 성능은 확인된 자료만 사용하세요.", "지역과 해마다 습한 시기는 다릅니다."),
  item("vacation", "여름휴가 여행 정리용품", "학습·야외", [7, 1], [8, 31], ["여행파우치", "캐리어", "여행용", "여권케이스", "travel"], "여름휴가 짐 정리와 이동 준비에 관련됩니다.", "실제 수납량·치수·무게를 보여 주세요."),
  item("summer-kitchen", "얼음틀·냉장 보관용품", "주방", [6, 1], [8, 31], ["얼음틀", "아이스몰드", "물병", "텀블러", "보냉", "bottle", "tumbler"], "더운 계절의 음료 준비와 냉장고 정리 기획입니다.", "용량·세척·실제 사용 모습을 보여 주세요. 보냉 시간은 근거가 필요합니다."),
  item("summer-baby", "유아 여름 외출 준비용품", "육아", [6, 1], [8, 31], ["유모차선풍기", "유아모자", "유아물병", "유모차차양"], "여름철 유아 외출 준비를 설명할 수 있습니다.", "권장 연령·호환 규격·고정 방식과 안전 주의사항을 확인하세요."),
  item("autumn-school", "2학기 책상·학습용품", "학습·야외", [8, 15], [9, 30], ["독서대", "책상정리", "필통", "노트"], "2학기 준비와 공부 공간 점검에 관련됩니다.", "크기와 정리 전후 모습을 보여 주세요.", "2학기 시작일은 학교마다 다릅니다."),
  item("chuseok", "추석 조리·선물 포장용품", "주방", [9, 1], [10, 31], ["찜기", "밀폐용기", "보자기", "명절", "선물포장"], "추석 음식 준비와 선물 포장에 활용할 수 있습니다.", "구성·보관·포장 순서를 보여 주세요.", "9~10월의 넓은 준비 범위입니다. 해당 연도 추석 날짜를 확정한 안내가 아니므로 실제 일정을 확인하세요."),
  item("autumn-storage", "환절기 의류·침구 수납", "생활용품", [9, 1], [10, 31], ["압축팩", "옷정리", "이불정리", "수납함"], "여름 물건 정리와 가을·겨울 준비에 관련됩니다.", "실제 수납 가능한 크기와 보관 방법을 보여 주세요."),
  item("autumn-light", "가을 실내 조명·소품", "인테리어", [9, 1], [11, 30], ["무드등", "스탠드", "테이블조명", "조명", "lamp"], "해가 짧아지는 계절의 실내 배치 기획입니다.", "실제 밝기 설정·전원·크기를 보여 주세요."),
  item("exam", "수능 준비 보온·휴대용품", "학습·야외", [11, 1], [11, 30], ["보온도시락", "보온병", "방석", "수능"], "11월 시험 준비물 점검 주제로 활용할 수 있습니다.", "휴대 크기와 사용법을 보여 주세요. 시험장 반입 규정을 확인하세요.", "수능 날짜나 반입 허용을 확정한 안내가 아닙니다. 해당 연도 공식 공지와 시험장 규정을 확인하세요."),
  item("winter-kitchen", "보온병·따뜻한 음료 용품", "주방", [11, 1], [2, 29], ["보온병", "보온컵", "텀블러", "티포트", "thermos"], "추워지는 날씨에 음료 준비와 휴대 방법을 소개할 수 있습니다.", "용량·뚜껑·세척을 보여 주세요. 보온 성능은 확인된 근거만 사용하세요."),
];

const DAY = 86400000;
export function koreanDateKey(now = new Date()): string {
  if (!Number.isFinite(now.getTime())) throw new Error("날짜를 확인할 수 없습니다.");
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part("year")}-${part("month")}-${part("day")}`;
}
function keyDay(key: string) { return Date.parse(`${key}T00:00:00Z`); }
const dayKey = (day: number) => new Date(day).toISOString().slice(0, 10);
function windowFor(item: SeasonalItem, year: number) {
  const start = Date.UTC(year, item.start[0] - 1, item.start[1]);
  const wraps = item.end[0] < item.start[0] || (item.end[0] === item.start[0] && item.end[1] < item.start[1]);
  const endYear = year + Number(wraps);
  const end = Date.UTC(endYear, item.end[0] - 1, Math.min(item.end[1], new Date(Date.UTC(endYear, item.end[0], 0)).getUTCDate()));
  return { start, end, prepStart: start - 56 * DAY, prepEnd: start - 14 * DAY };
}
export interface SeasonRecommendation {
  item: SeasonalItem;
  demandStart: string;
  demandEnd: string;
  prepStart: string;
  prepEnd: string;
  phase: "prepare" | "season" | "soon" | "browse";
}
export function getSeasonRecommendations(input: { now?: Date; view?: SeasonView; month?: number; year?: number; category?: string } = {}): SeasonRecommendation[] {
  const today = keyDay(koreanDateKey(input.now));
  const current = new Date(today), currentYear = current.getUTCFullYear(), currentMonth = current.getUTCMonth();
  const view = input.view ?? "now_next";
  const month = input.month ?? currentMonth + 1, year = input.year ?? currentYear;
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year) || year < 2000 || year > 2100) throw new Error("조회할 연도와 월을 확인해 주세요.");
  const offset = view === "next_month" ? 1 : 0;
  const from = view === "month" ? Date.UTC(year, month - 1, 1) : Date.UTC(currentYear, currentMonth + offset, 1);
  const until = view === "month" ? Date.UTC(year, month, 0) : Date.UTC(currentYear, currentMonth + (view === "now_next" ? 2 : 1) + offset, 0);
  const overlap = (start: number, end: number) => start <= until && end >= from;
  const result: SeasonRecommendation[] = [];
  for (const item of SEASONAL_ITEMS) {
    if (input.category && input.category !== "전체" && item.category !== input.category) continue;
    const baseYear = view === "month" ? year : currentYear;
    const candidates = [baseYear - 1, baseYear, baseYear + 1].map((y) => windowFor(item, y)).filter((w) => view === "ahead"
      ? w.start - today >= 14 * DAY && w.start - today <= 56 * DAY
      : (view !== "now_next" || w.end >= today) && (overlap(w.start, w.end) || overlap(w.prepStart, w.prepEnd)));
    // A cross-year season appears once, even if both its prep and season match the filter.
    candidates.sort((a, b) => Math.abs(a.start - today) - Math.abs(b.start - today));
    const w = candidates[0]; if (!w) continue;
    result.push({ item, demandStart: dayKey(w.start), demandEnd: dayKey(w.end), prepStart: dayKey(w.prepStart), prepEnd: dayKey(w.prepEnd), phase: today >= w.start && today <= w.end ? "season" : today >= w.prepStart && today <= w.prepEnd ? "prepare" : w.start > today && w.start - today < 14 * DAY ? "soon" : "browse" });
  }
  return result; // Editorial catalogue order, not a popularity rank.
}
