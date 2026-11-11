// 포트 갤러리 소개(/about). A plain module like guide-copy.ts so the server
// can read the same words. Written with Pote Gallery itself as the subject —
// the owner asked (2026-09-28) for no "운영자/운영하는 사람" wording, and the
// real name stays in the footer only (HANDOFF 09-28). Every claim here must
// match /guide: no buyer fee, payment goes straight to the artist.
export const aboutCopy = {
  aboutEyebrow: { ko: "ABOUT POTE GALLERY", en: "ABOUT POTE GALLERY" },
  aboutHeading: { ko: "그림 한 점이\n평생의 단짝이 되도록.", en: "So that one painting\nbecomes a lifelong friend." },
  aboutIntro: {
    ko: "포트 갤러리는 지금 이 순간에도 작업하는 작가들의 원화를 소개하는 온라인 갤러리입니다. 이름이나 경력보다 작품이 건네는 감정을 먼저 보고, 한 점 한 점 직접 골라 소개합니다.",
    en: "Pote Gallery is an online gallery presenting original works by artists who are making art right now. We look first at the feeling a work gives you, not the name or résumé behind it, and select every piece by hand.",
  },

  aboutNameLabel: { ko: "THE NAME", en: "THE NAME" },
  aboutNameHeading: { ko: "Pote, 프랑스어로 ‘단짝’", en: "Pote — French for “close friend”" },
  aboutNameBody: {
    ko: "Pote는 프랑스어로 가장 가까운 친구를 부르는 말입니다. 그 소리를 한글로 옮겨 ‘포트 갤러리’라 부릅니다. 작가에게는 처음 곁을 지키는 갤러리 친구가, 그림을 사는 분에게는 처음 미술을 안내하는 친구가 되겠다는 뜻을 담았습니다.",
    en: "Pote is what the French call their closest friend; in Korean its sound becomes 포트 갤러리. The name holds a promise: to be the first gallery friend an artist has, and the first art guide for the people who buy their work.",
  },

  aboutValuesLabel: { ko: "WHAT WE KEEP", en: "WHAT WE KEEP" },
  aboutValuesHeading: { ko: "포트 갤러리가 지키는 세 가지", en: "Three things we hold to" },
  aboutValue1Title: { ko: "이름보다 작품", en: "The work before the name" },
  aboutValue1Body: {
    ko: "유명해서가 아니라, 마음에 남아서 선택하는 그림. 작가의 이력이나 학력이 아니라 작품 그 자체로 소개합니다.",
    en: "Not because it's famous, but because it stays with you. We present each piece on its own merit, not on the artist's CV or schooling.",
  },
  aboutValue2Title: { ko: "처음이어도 어렵지 않게", en: "Easy, even the first time" },
  aboutValue2Body: {
    ko: "크기와 재료, 배송과 액자처럼 처음 사는 분이 궁금한 것부터 정리합니다. 확인하지 않은 내용은 확인된 것처럼 쓰지 않습니다.",
    en: "Size, materials, delivery, framing: we answer what a first-time buyer wants to know first, and never present anything unconfirmed as fact.",
  },
  aboutValue3Title: { ko: "작가에게 곧바로", en: "Straight to the artist" },
  aboutValue3Body: {
    ko: "작품 대금은 포트 갤러리를 거치지 않고 작가에게 바로 전달됩니다. 표시된 가격에 수수료를 얹지 않습니다.",
    en: "Payment goes directly to the artist, never through Pote Gallery, and we add no fee on top of the listed price.",
  },

  aboutStepsLabel: { ko: "HOW IT WORKS", en: "HOW IT WORKS" },
  aboutStepsHeading: { ko: "작품을 만나는 과정", en: "How a work comes home" },
  aboutStep1Title: { ko: "고르기", en: "Choose" },
  aboutStep1Body: {
    ko: "작품 페이지에서 크기와 가격을 보고, 공간 미리보기로 내 방에 걸린 모습을 먼저 확인합니다.",
    en: "Check the size and price on the artwork page, and see it on your own wall first with the room preview.",
  },
  aboutStep2Title: { ko: "확인", en: "Confirm" },
  aboutStep2Body: {
    ko: "구매 신청이나 문의를 남기시면 포트 갤러리가 작가와 함께 작품 상태와 배송 조건을 확인해, 보통 48시간 안에 답변드립니다.",
    en: "Send a purchase request or inquiry. Pote Gallery confirms the work's condition and delivery with the artist and usually replies within 48 hours.",
  },
  aboutStep3Title: { ko: "소장", en: "Collect" },
  aboutStep3Body: {
    ko: "합의한 조건대로 작가에게 직접 결제하시면, 작가가 정성껏 포장해 보내 드립니다.",
    en: "Pay the artist directly on the agreed terms, and the artist packs and sends the work to you.",
  },

  aboutArtistLabel: { ko: "FOR ARTISTS", en: "FOR ARTISTS" },
  aboutArtistHeading: { ko: "작품이 먼저 보이는 자리", en: "A place where the work comes first" },
  aboutArtistBody: {
    ko: "심사비 없이 연중 상시로 접수합니다. 이력보다 작품을 보고, 작가님의 작품이 가장 잘 보이도록 소개합니다.",
    en: "No submission fee, open all year. We look at the work rather than the CV, and present it in its best light.",
  },

  aboutContactHeading: { ko: "궁금한 점이 있으시면", en: "If you have a question" },
  aboutContactBody: {
    ko: "작품 한 점에 대한 작은 질문도 괜찮습니다. 보통 48시간 안에 답변드립니다.",
    en: "Even a small question about a single work is welcome. We usually reply within 48 hours.",
  },
  aboutGuideLink: { ko: "구매 안내 보기", en: "Read the buying guide" },
  menuAbout: { ko: "포트 갤러리 소개", en: "About Pote" },
} as const;
