import type { Lang } from "@/lib/i18n";
import type { ArtworkExtras } from "@/lib/artwork-extras";

export type MoodKey = "quiet" | "warm" | "vivid" | "delicate";
export const MOOD_ORDER: MoodKey[] = ["quiet", "warm", "vivid", "delicate"];
export const MOOD_DICT_KEY: Record<MoodKey, "moodQuiet" | "moodWarm" | "moodVivid" | "moodDelicate"> = {
  quiet: "moodQuiet",
  warm: "moodWarm",
  vivid: "moodVivid",
  delicate: "moodDelicate",
};
export type StatusKey = "available" | "sold" | "pending";
export type ArtistSlug = "jihyeseung" | "hoohoo" | "haerang" | "hedon139" | "kyunghoonmin" | "seunghojang" | "eunyeollee" | "luxx" | "myungheejung" | "yulhwi" | "cheongunsim" | "pita" | "woon" | "qiuchichen" | "jaeheeyoon" | "sunsookhur" | "hyunkilee" | "jihunchoi" | "wonsikjeong";

type Localized = {
  title: string;
  description: string;
  details: string;
  mood: string;
  status: string;
  palette: string[];
};

export type Artwork = {
  slug: string;
  image: string;
  /** All artist-uploaded views, including the main photo. */
  images?: string[];
  artistSlug: ArtistSlug;
  moodKey: MoodKey;
  statusKey: StatusKey;
  /** Artist's own asking price, e.g. "350,000원" — shown as-is (not localized/converted) when set; omitted entirely when not, rather than guessed. */
  price?: string;
  /** 작가 포털 "액자·설치" 칸(액자 여부·두께·에디션 등). 정적 작품에는 없다. */
  extras?: ArtworkExtras;
} & Record<Lang, Localized>;

export type Artist = {
  slug: ArtistSlug;
  name: Record<Lang, string>;
  /**
   * 전자상거래법 제20조의4 ③2호: 개인 판매자와 사업자를 구분해 표시해야 한다.
   * 작가가 직접 확인해준 경우에만 설정하고, 확인되지 않았으면 비워 둔다
   * (추측해서 표기하지 않는다 — 잘못 표기하면 그 자체가 위반이다).
   */
  /**
   * The artist's own description of their work, in their words, as submitted.
   * Used to introduce them on the homepage when there is no bespoke copy for
   * them yet — better a sentence they wrote than a stand-in someone else's.
   * Never write this on an artist's behalf.
   */
  statement?: Record<Lang, string>;
  sellerType?: "individual" | "business";
  /** 판매되면 작가가 작품과 함께 만들어 보내는 것(케이스·조명 등). 작품 상세 거래 표에 보인다. */
  saleExtras?: Record<Lang, string>;
  /** 판매 뒤 파손 수리 등 작가가 약속한 사후 관리. 작품 상세 거래 표에 보인다. */
  afterCare?: Record<Lang, string>;
  /** 신청서 "주요 작업 분야"에 작가가 적은 분야. 작가 페이지 캡션 카드에 쓴다. */
  medium?: Record<Lang, string>;
  /**
   * 사업자 작가의 신원정보. 전자상거래법 제20조②는 중개의뢰자가 사업자인 경우
   * 상호·주소·전화번호 등을 청약 전에 소비자에게 제공하도록 요구하며, 제20조의2②는
   * 이를 빠뜨렸을 때 중개자에게 연대 배상 책임을 지운다. 그래서 sellerType이
   * "business"인 작가는 이 값이 채워져야 하고, 작품 페이지에 그대로 노출된다.
   * 작가가 공개에 동의한 정보만 넣는다(개인 휴대폰·개인 이메일을 임의로 쓰지 않는다).
   */
  business?: {
    name: string;
    address: string;
    contact: string;
    /** 아직 받지 못했으면 비워 둔다. 있으면 판매자 정보에 함께 표시된다. */
    regNo?: string;
  };
};

export const artists: Record<ArtistSlug, Artist> = {
  jihyeseung: {
    slug: "jihyeseung",
    name: {
      ko: "지혜승",
      en: "Ji Hye Seung",
    },
    // 2026-09-08 작가 본인 확인: 사업자 등록 없음.
    sellerType: "individual",
  },
  hoohoo: {
    slug: "hoohoo",
    name: {
      ko: "후후/HooHoo",
      en: "HooHoo",
    },
    // 2026-09-10 작가 본인 확인: 보유한 사업자 등록("방콕 아트페어")은 Pote를
    // 통한 개인 작품 판매와 무관한 별개 사업이라, 여기서는 개인 판매자로 표시.
    // 2026-09-09에 기재했던 "히즈아트" 사업자 정보는 착오였으므로 제거.
    sellerType: "individual",
  },
  hedon139: {
    slug: "hedon139",
    name: {
      ko: "Hedon139", en: "Hedon139",
    },
    // 2026-09-14 작가 본인 확인: 사업자 등록 없음.
    sellerType: "individual",
    // 작가가 포트폴리오 About Me에 직접 쓴 문장을 본인 허락을 받아 옮겼다
    // (2026-09-14 메일). 요약하거나 대신 쓰지 않는다.
    statement: {
      ko: "내 작업에는 아기 천사 '헨젤'과 아기 악마 '헤빌'이 등장한다. 이 둘은 선과 악을 나누기 위한 존재가 아니다. 모든 것은 이면성을 가진다. 사랑도 그렇고, 인간도 그렇다.",
      en: "My work has a baby angel, Hensel, and a baby devil, Hevil. They are not there to divide good from evil. Everything has two sides — love does, and so do people.",
    },
  },
  haerang: {
    slug: "haerang",
    name: {
      ko: "해랑이유미",
      en: "Haerang Yumi Lee",
    },
    // 2026-09-10 작가 본인 확인: 사업자 등록 없음.
    sellerType: "individual",
  },
  kyunghoonmin: {
    slug: "kyunghoonmin",
    name: {
      ko: "민경훈",
      en: "KYUNG HOON MIN",
    },
    // 2026-09-17 작가 본인 확인(작가 참여 신청서): 사업자 등록 없음.
    sellerType: "individual",
    // 작가 포트폴리오(artifera.co.kr/mkh3536)의 "작품 해설" 문구를 그대로 옮겼다
    // (2026-09-19 확인). 요약하거나 대신 쓰지 않는다.
    statement: {
      ko: "민경훈의 회화는 흩어진 색채의 파편과 넓은 여백이 공존하는 화면을 통해 혼돈 속에서 생성되는 질서를 보여준다. 화면 곳곳에 자리한 노랑은 빛과 희망의 조각처럼 발광하며, 붉은 흔적은 시간과 감정의 잔여를 드러낸다. 청록과 검정은 이들 사이에서 긴장을 조율하며, 파편적 이미지들이 하나의 리듬을 이루게 한다. 이 작품은 구체적 형상을 제시하지 않는다. 그러나 바로 그 부재가 오히려 관람객으로 하여금 자신의 기억과 경험을 투영하도록 유도한다. 민경훈은 파편을 통해 삶의 단절과 연결, 부재와 생성의 과정을 시각화하며, 회화의 공간을 의미가 새롭게 태어나는 장소로 확장한다.",
      en: "KYUNG HOON MIN's paintings show an order generated within chaos, through a surface where scattered fragments of color coexist with wide open space. The yellows placed throughout the canvas glow like fragments of light and hope, while traces of red reveal the residue of time and emotion. Teal and black mediate the tension between them, drawing the fragmentary images into a single rhythm. These works offer no concrete form — and it is precisely that absence that invites viewers to project their own memories and experiences onto the canvas. Through fragments, KYUNG HOON MIN visualizes the rupture and connection, the absence and generation, that run through a life, expanding the space of painting into a place where meaning is newly born.",
    },
  },
  seunghojang: {
    slug: "seunghojang",
    name: {
      ko: "장승호",
      en: "Seungho Jang",
    },
    // 2026-09-21 작가 참여 신청서 본인 확인: 사업자 등록 없음(개인 작가).
    sellerType: "individual",
    // 작가가 참여 신청서 "작업 소개"란에 직접 쓴 문장을 그대로 옮겼다(2026-09-21).
    // 요약하거나 대신 쓰지 않는다.
    statement: {
      ko: "저에게 회화는 주어진 목적과 통념, 그리고 그 구조에 길들여져 타성적으로 받아들이는 대신, 추상이라는 자연 안에서 스스로를 의심하고 성찰하며 세계와 관계하고, 그 과정 속에서 나 자신을 다시 형성해가는 일입니다.",
      en: "For me, painting means questioning and reflecting on myself within the nature of abstraction — relating to the world through that process and reshaping myself along the way — rather than passively accepting a given purpose, convention, or structure out of habit.",
    },
  },
  eunyeollee: {
    slug: "eunyeollee",
    medium: { ko: "회화", en: "Painting" },
    name: {
      ko: "이은열",
      en: "Eunyeol Lee",
    },
    // 2026-09-22 작가 본인 확인(사용자 전달): 작업자 본인이 직접 판매, 사업자 등록 없음(개인 작가).
    sellerType: "individual",
    // 작가가 직접 전달한 "작업소개" 문장을 그대로 옮겼다(2026-09-22, 사용자 전달).
    // 요약하거나 대신 쓰지 않는다.
    statement: {
      ko: "나의 작업은 눈에 보이는 외부의 현상을 기록하는 인상주의적 태도에서 본질적 의미를 표현주의적 과정에 나를 이야기를 합니다",
      en: "My work moves from an impressionistic attitude of recording visible, external phenomena toward essential meaning — telling my own story through an expressionistic process.",
    },
  },
  luxx: {
    slug: "luxx",
    medium: { ko: "일러스트 · 회화", en: "Illustration · Painting" },
    name: {
      ko: "럭스",
      en: "Luxx",
    },
    // 2026-09-24 신청서에서 작가 본인이 "사업자 (사업자 등록 있음)"을 선택하고
    // 상호·대표자·등록번호·주소를 직접 보내줬다(사용자 전달).
    sellerType: "business",
    // 연락처는 작가가 신청서에 적은 이메일. 전화번호 공개는 작가 확인 전이라 넣지 않았다.
    business: {
      name: "(공개 저장소에서는 비움)",
      address: "(공개 저장소에서는 비움)",
      contact: "",
      regNo: "",
    },
    // 작가가 보내준 작가소개글을 그대로 옮겼다(2026-09-24, 사용자 전달). 표기(씨리즈 등)도 원문대로.
    statement: {
      ko: "일러스트와 회화작업을 동시에 하는 작가 럭스입니다. 오리를 의인화 하여 작업한 동반자 씨리즈와 소품으로 오일파스텔화와 드로잉 작업을 같이 병행합니다.",
      en: "I'm Luxx, an artist working in both illustration and painting. Alongside my Companion series of anthropomorphised ducks, I make small oil-pastel paintings and drawings.",
    },
  },
  myungheejung: {
    slug: "myungheejung",
    medium: { ko: "회화", en: "Painting" },
    name: {
      ko: "정명희",
      en: "Myunghee Jung",
    },
    // 2026-09-25 작가 참여 신청서 본인 선택: 개인 (사업자 등록 없음).
    sellerType: "individual",
    // 신청서 "작업 소개"란의 작가 문장을 그대로 옮겼다(2026-09-25). 요약하거나 대신 쓰지 않는다.
    statement: {
      ko: "저는 여러 색을 겹쳐 칠하면서 자연스럽게 생기는 색감과 질감을 살려 작업하고 있습니다. 작은 집이나 나무, 꽃처럼 평범하지만 마음이 편안해지는 풍경을 주로 그립니다. 그림을 그리면서 잠시라도 마음이 편해지는 시간을 느꼈고, 그 순간을 다른 사람과도 나누고 싶어 작업을 시작하게 되었습니다.",
      en: "I work by layering many colours and letting the tones and textures that form along the way come through. I mostly paint ordinary, calming scenes: small houses, trees and flowers. Painting gave me moments of ease, even brief ones, and I began this work wanting to share those moments with others.",
    },
  },
  yulhwi: {
    slug: "yulhwi",
    medium: { ko: "회화 (서양화)", en: "Painting (Western)" },
    name: {
      ko: "율휘",
      en: "Yulhwi",
    },
    // 2026-09-25 작가 참여 신청서 본인 선택: 개인 (사업자 등록 없음).
    // 신청서 포트폴리오 PDF에 본명이 있지만 작가명(율휘)만 공개한다.
    sellerType: "individual",
    // 같은 날 신청서를 두 번 보냈다. 나중(11:23) 신청서의 "작업 소개"를 원문 그대로 옮겼다.
    statement: {
      ko: "왕관을 주제로 작업을 하고있습니다 왕관은 부귀,명예,권력을 의미하지만 우리가 살아가면서 그무게감에 휘청일때도 있는데 잠시 의자에 그무게를 내려놓고 휴식하면서 내자신을 돌아보자는 의미에서 작업을하고있습니다",
      en: "My work takes the crown as its subject. A crown stands for wealth, honour and power, but in life we sometimes stagger under that weight. I paint it set down on a chair for a moment, as a chance to rest and look back at oneself.",
    },
  },
  cheongunsim: {
    slug: "cheongunsim",
    medium: { ko: "자연경관 디오라마 공예", en: "Landscape diorama craft" },
    name: {
      ko: "심청운",
      en: "Cheongun Sim",
    },
    // 2026-09-25 작가 참여 신청서 본인 선택: 개인 (사업자 등록 없음).
    sellerType: "individual",
    // 2026-09-28 작가가 사용자에게 직접 알려 줌: 판매되면 5mm 아크릴 케이스와 조명을 만들어 보낸다.
    saleExtras: {
      ko: "판매되면 작가가 5mm 아크릴 케이스와 조명을 직접 만들어 함께 보냅니다",
      en: "Once sold, the artist makes a 5mm acrylic case and lighting for the piece and ships them with it",
    },
    // 같은 날 작가가 알려 줌: 판매 뒤 관리 중 파손되면 A/S, 고의 파손은 책임지지 않는다. 비용은 아직 모름.
    afterCare: {
      ko: "판매 뒤 관리 중 파손되면 작가가 수리해 드립니다(고의 파손 제외). 비용과 방법은 작가와 상의해 정합니다",
      en: "If the piece is damaged in normal care after purchase, the artist will repair it (deliberate damage excluded). Cost and method are agreed with the artist",
    },
    // 신청서 "작업 소개"란의 첫 줄과 작업 내용 줄을 그대로 옮겼다(2026-09-25).
    // 나머지 줄(수상·강사·공방)은 작가 페이지 이력란에 넣었다.
    statement: {
      ko: "자연경관이나 사물등을 축소하여 만드는 3차원입체예술가 (입체예술 & 동양화). 3차원 자연경관 및 조형·공예 작품 제작.",
      en: "A three-dimensional artist who recreates natural landscapes and objects in miniature (dimensional art & Korean painting), making dioramas of natural scenery as well as sculptural and craft pieces.",
    },
  },
  pita: {
    slug: "pita",
    medium: { ko: "혼합매체 · 한지조형", en: "Mixed media · Hanji" },
    name: {
      ko: "피타",
      en: "Pita",
    },
    // 2026-09-25 작가 참여 신청서 본인 선택: 개인 (사업자 등록 없음).
    sellerType: "individual",
    // 신청서 "작업 소개"란의 작가 문장을 그대로 옮겼다(2026-09-25).
    statement: {
      ko: "한지를 주재료로 사용하여 손으로 찢고 겹쳐 붙이는 방식으로 작업합니다. 한지의 색과 질감, 겹침에서 생기는 우연한 형태를 활용하며, 필요에 따라 아크릴 물감과 모델링 페이스트 등 다양한 재료를 함께 사용합니다. 정해진 형태를 그대로 재현하기보다는 작업 과정에서 생기는 질감과 형태를 살려 화면을 구성합니다.",
      en: "I work mainly with hanji, tearing it by hand and layering it. I use the colour and texture of the paper and the chance shapes that appear where layers overlap, adding acrylic paint, modelling paste and other materials when needed. Rather than reproducing a fixed form, I build the surface from the textures and shapes that emerge while working.",
    },
  },
  woon: {
    slug: "woon",
    medium: { ko: "회화 · 도자", en: "Painting · Ceramics" },
    name: {
      ko: "운",
      en: "Woon",
    },
    // 2026-09-29 작가 참여 신청서 본인 선택: 개인 (사업자 등록 없음).
    sellerType: "individual",
    // 신청서 "작업 소개"란의 작가 문장을 그대로 옮겼다(2026-09-29). 요약하거나 대신 쓰지 않는다.
    statement: {
      ko: "제게 아픔이 찾아 올 때, 흙과 다시 만나고 도자동물 운우가 우연히 태어났습니다. 운우는 한결같이 마주 볼 수 있었고, 한 손에 폭 안기며 치유의 시간을 제게 주었습니다. 그리고 운우의 세계도 만날 수 있습니다. 오늘날 토우와 닮은 운우와 그 세계, 함께 하는 삶 어떨까요.",
      en: "When pain came to me, I met clay again, and the ceramic animal Unwoo was born by chance. Unwoo could always be faced steadily, and nestled into one hand, giving me time to heal. You can meet Unwoo's world too. Unwoo resembles the earthen figures of old — what would a life lived alongside them be like?",
    },
  },
  jaeheeyoon: {
    slug: "jaeheeyoon",
    medium: { ko: "회화", en: "Painting" },
    name: { ko: "윤재희", en: "Jaehee Yoon" },
    // 2026-10-02 참여 신청서 본인 선택: 개인 (사업자 등록 없음). 해외 배송 불가.
    sellerType: "individual",
    // 신청서 작업 소개 원문을 유지한다. 작품은 작가가 포털에서 직접 등록한다.
    statement: {
      ko: "1. 작업 방식 : 처음에는 주제라는 것을 알지 못해서 그냥 눈앞에 영감이 보이거나 하고 싶은 말이 머릿속에 그려지면 그대로 그렸었습니다. 그러다 최근에는, 주제를 하나 잡고 그 주제에 대해 파생된 `내가 이 주제에 대해 정말로 하고 싶은 말`을 그림으로 그리는 중입니다.\n\n2. 즐겨 그리는 소재 : 분위기(어두움, 시들시들, 메마른 등등), 사물(나무, 꽃,표정 등등)\n\n3. 작업을 시작한 계기 : 어려서 초등학교 때 까지 그림을 재밋게 그리다가 학업 때문에 그림을 중단해야 했습니다. 그 시절 많은 학생들이 그렇게 꿈을 접었는데요. 저는 그 꿈을 다시 이루기 위해 그리고 `화가`가 되기 위해 도전하고 있습니다.",
      en: "1. Working process: At first, I did not know what a theme was, so whenever inspiration appeared before me or something I wanted to say took shape in my mind, I painted it as it was. Recently, I have been choosing a theme and painting what grows out of it: `what I really want to say about this theme`.\n\n2. Subjects I enjoy painting: Atmospheres (dark, withered, dry, and so on), and things (trees, flowers, facial expressions, and so on).\n\n3. How I began: I enjoyed drawing as a child until elementary school, but had to stop because of my studies. Many students gave up their dreams that way at the time. I am taking on the challenge of pursuing that dream again and becoming a `painter`.",
    },
  },
  sunsookhur: {
    slug: "sunsookhur",
    medium: { ko: "회화", en: "Painting" },
    name: { ko: "허선숙", en: "Sunsook Hur" },
    // 2026-10-06 참여 신청서: 개인 판매자, 해외 배송 가능. 작품은 포털에서 직접 등록한다.
    sellerType: "individual",
    // 신청서 작업 소개 원문을 유지한다.
    statement: {
      ko: "인간의 감정과 삶의 이야기를 따뜻한 시선으로 담아내는 평면회화 작가이며. 일상 속 관계와 기억을 통해 인간의 내면과 감성을 표현하고 있습니다.",
      en: "I am a painter who portrays human emotions and stories of life with a warm perspective. Through everyday relationships and memories, I express people’s inner lives and feelings.",
    },
  },
  hyunkilee: {
    slug: "hyunkilee",
    medium: { ko: "회화", en: "Painting" },
    // 영문 이름을 받지 않았으므로 신청서의 이름 표기를 두 언어에서 유지한다.
    name: { ko: "이현기", en: "이현기" },
    // 2026-10-17 신청서 본인 선택. 해외 배송은 미정이며 별도 확정하지 않는다.
    sellerType: "individual",
    statement: {
      ko: "석회가루와 색소 재료의 우연성과  의도적 개입을 결합하여, 돌의 침묵 속에 감춰진 시간과 생명의 이야기를 표현하고자 한다.",
      en: "By combining the chance effects of lime powder and pigments with deliberate intervention, I seek to express stories of time and life hidden within the silence of stone.",
    },
  },
  jihunchoi: {
    slug: "jihunchoi",
    medium: { ko: "조각·부조", en: "Sculpture · Relief" },
    name: { ko: "최지훈", en: "Jihun Choi" },
    // 2026-10-20 신청서: 개인 판매자, 직접 제작한 공예·입체. 해외 배송은 미정이며 별도 확정하지 않는다.
    sellerType: "individual",
    // 신청서 작업 소개 원문을 유지한다.
    statement: {
      ko: "부조. 강화수지로 작업한 진주귀걸이를 한 돼지 1. 진주귀걸이를 한 돼지 2",
      en: "Relief. Works in reinforced resin: a pig wearing a pearl earring 1, and a pig wearing a pearl earring 2.",
    },
  },
  wonsikjeong: {
    slug: "wonsikjeong",
    medium: { ko: "판화", en: "Printmaking" },
    // 영문 이름을 받지 않았으므로 신청서 표기를 두 언어에서 유지한다.
    name: { ko: "원식 정", en: "원식 정" },
    // 2026-10-22 신청서: 개인 판매자·번호가 매겨진 한정 에디션·해외 배송 가능.
    sellerType: "individual",
    statement: {
      ko: "돌판하기법중메조틴트기법으로2판2~3색으로제작하며,자연에대한것을주제로합니다",
      en: "I work with mezzotint using two plates and two to three colors, taking nature as my subject.",
    },
  },
  qiuchichen: {
    slug: "qiuchichen",
    medium: { ko: "회화", en: "Painting" },
    name: {
      ko: "Qiuchi Chen",
      en: "Qiuchi Chen",
    },
    // 2026-09-29 작가 참여 신청서 본인 선택: 개인 (사업자 등록 없음). 해외 배송 가능이라고 답함.
    sellerType: "individual",
    // 신청서 "작업 소개"란의 작가 문장을 옮겼다(2026-09-29). 영어 원문 그대로가 en.
    statement: {
      ko: "저는 인문주의 예술가 천추치입니다. 제 그림은 사람의 얼굴과 여러 사물을 결합해 전쟁, 평화, 환경 보호 같은 인간 사회의 문제를 표현합니다.",
      en: "Hello, my name is Chen Qiuchi, and I am a humanistic artist. My painting is a combination of human faces and various things to express some problems of human society! Such as: war, peace, environmental protection, etc.",
    },
  },
};

export function getArtist(slug: ArtistSlug): Artist {
  return artists[slug];
}
