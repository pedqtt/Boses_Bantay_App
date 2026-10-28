export type HomeGreeting = { period: "morning" | "afternoon" | "evening" | "night"; text: string };
const GREETINGS = {
  morning: [
    "Magandang umaga po,",
    "Maaliwalas na umaga,",
    "Isang masiglang umaga,",
    "Kumusta po ngayong umaga,",
    "Bagong umaga, bagong simula,",
  ],
  afternoon: [
    "Magandang hapon po,",
    "Kumusta po ngayong hapon,",
    "Isang maaliwalas na hapon,",
    "Sana'y magaan ang hapon ninyo,",
  ],
  evening: [
    "Magandang gabi po,",
    "Isang payapang gabi,",
    "Kumusta ang gabi ninyo,",
    "Sana'y maganda ang gabi ninyo,",
  ],
  night: [
    "Magandang gabi po,",
    "Isang tahimik na gabi,",
    "Kumusta po ngayong gabi,",
    "Sana'y payapa ang gabi ninyo,",
  ],
} as const;
export function getGreetingPeriod(now = new Date()): HomeGreeting["period"] {
  const hour = Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Manila", hour: "2-digit", hourCycle: "h23",
  }).format(now));
  return hour >= 5 && hour < 12 ? "morning" : hour >= 12 && hour < 18 ? "afternoon" : hour >= 18 && hour < 22 ? "evening" : "night";
}
export function pickHomeGreeting(now = new Date(), previous?: HomeGreeting, random = Math.random): HomeGreeting {
  const period = getGreetingPeriod(now);
  const choices = GREETINGS[period].filter(text => text !== previous?.text);
  const index = Math.min(choices.length - 1, Math.max(0, Math.floor(random() * choices.length)));
  return { period, text: choices[index] };
}
