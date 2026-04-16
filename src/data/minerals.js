export const MINERALS = [
  {
    id: 'quartz',
    name: '석영',
    colorLabel: '무색',
    color: 0xd4f1f9,
    streakColor: 'none',
    hardness: 'high',
    acidReaction: false,
    magnetic: false,
    description: '육각 기둥 형태의 무색투명 광물로, 굳기가 매우 높다.',
  },
  {
    id: 'feldspar',
    name: '장석',
    colorLabel: '흰색이나 분홍색',
    color: 0xffd6d6,
    streakColor: 'white',
    hardness: 'medium',
    acidReaction: false,
    magnetic: false,
    description: '불투명한 흰색 또는 연분홍색으로, 지각에서 가장 흔한 광물이다.',
  },
  {
    id: 'biotite',
    name: '흑운모',
    colorLabel: '검은색',
    color: 0x2c2c2c,
    streakColor: 'white',
    hardness: 'medium',
    acidReaction: false,
    magnetic: false,
    description: '검은색 얇은 판상 구조로, 쉽게 층층이 벗겨지는 특성이 있다.',
  },
  {
    id: 'calcite',
    name: '방해석',
    colorLabel: '무색',
    color: 0xfafafa,
    streakColor: 'white',
    hardness: 'low',
    acidReaction: true,
    magnetic: false,
    description: '묽은 염산과 반응하여 거품(CO₂)을 발생시키는 탄산칼슘 광물이다.',
  },
  {
    id: 'magnetite',
    name: '자철석',
    colorLabel: '검은색',
    color: 0x1a1a1a,
    streakColor: 'black',
    hardness: 'medium',
    acidReaction: false,
    magnetic: true,
    description: '강한 자성을 띠며 검은색 금속 광택을 가진 철 산화 광물이다.',
  },
];

export const KEY_PAIRING_RULES = {
  pairA: ['quartz', 'calcite'],    // 석영 또는 방해석 중 1종 필수
  pairB: ['biotite', 'magnetite'], // 흑운모 또는 자철석 중 1종 필수
  // third: 나머지 풀에서 랜덤 1종
};

export function getMineralById(id) {
  return MINERALS.find(m => m.id === id) ?? null;
}
