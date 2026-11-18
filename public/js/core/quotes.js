// 철학자 명언 (era: ancient 고대 / modern 근대 / contemporary 현대, side: west 서양 / east 동양)
export const QUOTES = [
  // 서양 고대
  { q: '너 자신을 알라.', who: '소크라테스', era: 'ancient', side: 'west' },
  { q: '성찰하지 않는 삶은 살 가치가 없다.', who: '소크라테스', era: 'ancient', side: 'west' },
  { q: '가장 위대한 승리는 자기 자신을 이기는 것이다.', who: '플라톤', era: 'ancient', side: 'west' },
  { q: '인간은 본성적으로 앎을 욕구한다.', who: '아리스토텔레스', era: 'ancient', side: 'west' },
  { q: '인간은 본성적으로 정치적 동물이다.', who: '아리스토텔레스', era: 'ancient', side: 'west' },
  { q: '사람을 괴롭히는 것은 사물이 아니라 사물에 대한 생각이다.', who: '에픽테토스', era: 'ancient', side: 'west' },
  { q: '네 마음이 곧 네 삶이다. 생각의 빛깔대로 영혼이 물든다.', who: '마르쿠스 아우렐리우스', era: 'ancient', side: 'west' },
  { q: '우리가 고통받는 것은 현실보다 상상 속에서 더 많다.', who: '세네카', era: 'ancient', side: 'west' },
  { q: '만물은 흐른다.', who: '헤라클레이토스', era: 'ancient', side: 'west' },
  // 동양 고대
  { q: '배우고 때때로 익히면 또한 기쁘지 아니한가.', who: '공자', era: 'ancient', side: 'east' },
  { q: '세 사람이 걸어가면 반드시 그중에 나의 스승이 있다.', who: '공자', era: 'ancient', side: 'east' },
  { q: '천 리 길도 한 걸음부터 시작된다.', who: '노자', era: 'ancient', side: 'east' },
  { q: '가장 좋은 것은 물과 같다.', who: '노자', era: 'ancient', side: 'east' },
  { q: '남을 아는 사람은 지혜롭고, 자기를 아는 사람은 밝다.', who: '노자', era: 'ancient', side: 'east' },
  { q: '사람이 배우지 않으면 도를 알지 못한다.', who: '맹자', era: 'ancient', side: 'east' },
  { q: '배움은 그쳐서는 안 된다. 푸른색은 쪽에서 나왔으나 쪽보다 푸르다.', who: '순자', era: 'ancient', side: 'east' },
  { q: '나비가 나인지, 내가 나비인지 알 수 없다.', who: '장자', era: 'ancient', side: 'east' },
  { q: '스스로를 등불로 삼고, 스스로를 의지처로 삼아라.', who: '붓다', era: 'ancient', side: 'east' },
  // 근대
  { q: '나는 생각한다, 고로 존재한다.', who: '르네 데카르트', era: 'modern', side: 'west' },
  { q: '모든 고귀한 것은 드문 만큼 어렵다.', who: '스피노자', era: 'modern', side: 'west' },
  { q: '감히 알려고 하라. 네 자신의 이성을 사용할 용기를 가져라.', who: '임마누엘 칸트', era: 'modern', side: 'west' },
  { q: '내용 없는 사유는 공허하고, 개념 없는 직관은 맹목이다.', who: '임마누엘 칸트', era: 'modern', side: 'west' },
  { q: '이성은 열정의 노예이며 그래야만 한다.', who: '데이비드 흄', era: 'modern', side: 'west' },
  { q: '인간은 자유롭게 태어났으나 어디에서나 쇠사슬에 묶여 있다.', who: '장 자크 루소', era: 'modern', side: 'west' },
  { q: '왜 살아야 하는지 아는 사람은 거의 모든 어떻게도 견딘다.', who: '프리드리히 니체', era: 'modern', side: 'west' },
  { q: '인생은 뒤돌아보며 이해되고, 앞을 향해 살아가야 한다.', who: '쇠렌 키르케고르', era: 'modern', side: 'west' },
  { q: '인간은 하고 싶은 것을 할 수 있으나, 원하는 것을 원할 수는 없다.', who: '아르투어 쇼펜하우어', era: 'modern', side: 'west' },
  { q: '모든 것은 마음이 짓는다.', who: '원효', era: 'modern', side: 'east' },
  { q: '배움에 뜻을 세우지 않으면 아무것도 이루지 못한다.', who: '이이', era: 'modern', side: 'east' },
  { q: '아는 것은 행하는 것의 시작이고, 행하는 것은 아는 것의 완성이다.', who: '왕양명', era: 'modern', side: 'east' },
  { q: '젊을 때 배움을 쉽게 여기지 말라. 한 순간의 시간도 가벼이 보내지 말라.', who: '주희', era: 'modern', side: 'east' },
  // 현대
  { q: '말할 수 없는 것에 대해서는 침묵해야 한다.', who: '루트비히 비트겐슈타인', era: 'contemporary', side: 'west' },
  { q: '내 언어의 한계가 내 세계의 한계이다.', who: '루트비히 비트겐슈타인', era: 'contemporary', side: 'west' },
  { q: '인간은 자유롭도록 선고받았다.', who: '장폴 사르트르', era: 'contemporary', side: 'west' },
  { q: '산 정상을 향한 투쟁만으로도 인간의 가슴을 채우기에 충분하다.', who: '알베르 카뮈', era: 'contemporary', side: 'west' },
  { q: '생각하지 않음이 가장 큰 악을 낳는다.', who: '한나 아렌트', era: 'contemporary', side: 'west' },
  { q: '사람은 여성으로 태어나는 것이 아니라 여성이 되는 것이다.', who: '시몬 드 보부아르', era: 'contemporary', side: 'west' },
  { q: '문제는 세상이 어리석은 자들로 가득하고 현명한 이들은 의심으로 가득하다는 것이다.', who: '버트런드 러셀', era: 'contemporary', side: 'west' },
  { q: '인간은 존재의 목자이다.', who: '마르틴 하이데거', era: 'contemporary', side: 'west' },
  { q: '순수 경험이 유일한 실재이다.', who: '니시다 기타로', era: 'contemporary', side: 'east' },
  { q: '하늘은 사람 위에 사람을 만들지 않고, 사람 아래 사람을 만들지 않았다.', who: '후쿠자와 유키치', era: 'contemporary', side: 'east' },
];

// 직전에 보여준 것(prev)과 다른 명언을 무작위로 고른다.
export function randomQuote(prev, rand = Math.random) {
  const pool = prev ? QUOTES.filter((x) => x !== prev) : QUOTES;
  return pool[Math.floor(rand() * pool.length)];
}
