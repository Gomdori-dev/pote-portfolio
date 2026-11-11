// 구매 안내(/guide)의 질문·답과 법적 고지. A plain module rather than part of
// the "use client" dictionary in i18n.tsx so the server can read it too: the
// Pote Desk AI (api/desk) answers from exactly this text, the same words the
// guide page shows, instead of a copy that could drift from it.
export const guideCopy = {
  guideQPay: { ko: "결제는 어떻게 하나요?", en: "How do I pay?" },
  guideAPay: { ko: "문의를 보내주시면 포트 갤러리가 작품 상태와 배송 일정을 확인한 뒤, 작가의 계좌를 안내합니다. 대금은 작가에게 직접 입금하시며 포트 갤러리는 대금을 보관하지 않습니다. 개인 작가는 계좌이체로만 거래하고, 사업자 작가는 카드 결제가 되는지 작가가 확인해 드립니다.", en: "Send an inquiry and Pote Gallery will confirm the work's condition and a delivery window, then share the artist's bank details. You pay the artist directly; Pote Gallery never holds your money. Individual artists take bank transfer only; for registered-business artists, the artist confirms whether card payment is possible." },
  guideQSplit: { ko: "나눠서 낼 수 있나요?", en: "Can I pay in instalments?" },
  guideASplit: { ko: "50만 원 이상인 개인 작가 작품은 구매 신청 때 \"나눠서 계좌이체 희망\"을 고를 수 있습니다. 2개월 안에 최대 3번 나눠 보내고, 다 보낸 뒤에 작품이 발송됩니다. 입금이 약속한 날보다 2주 넘게 늦으면 예약이 풀리고 작품은 다시 판매 중이 됩니다. 중간에 그만둘 때 이미 보낸 돈을 어떻게 할지는 처음에 작가와 문자나 메일로 정해 둡니다. 분할을 받아 줄지는 작가가 정합니다.", en: "For works by individual artists priced at 500,000 won or more, you can choose \"bank transfer in instalments\" when you request to buy. You send up to 3 transfers within 2 months, and the work ships once the last one arrives. If a payment is more than 2 weeks late, the reservation lapses and the work goes back on sale. Agree with the artist by text or email at the start on what happens to money already paid if you stop. The artist decides whether to accept instalments." },

  guideQShip: { ko: "배송은 누가 하나요?", en: "Who ships the work?" },
  guideAShip: { ko: "작가가 직접 포장·발송하고 포트 갤러리가 일정을 조율합니다. 대형·중량·파손 위험 작품은 일반 택배가 어려울 수 있어 화물이나 미술품 전문 운송 등을 별도로 협의합니다. 운송 방법, 포장·설치 필요 여부, 비용과 부담 주체는 입금 전에 정합니다. 무료배송 작품도 별도 운송·설치가 포함되는지는 따로 확인합니다.", en: "The artist packs and ships; Pote Gallery coordinates timing. Large, heavy or fragile works may need separately agreed freight or a fine-art carrier. Before payment, agree on transport, packing and installation needs, costs and who pays. Even for a work with free shipping, confirm whether special transport or installation is included." },

  guideQOverseas: { ko: "해외에서도 살 수 있나요?", en: "Can I buy from outside Korea?" },
  guideAOverseas: { ko: "작가님이 해외 배송을 할 수 있는 작품이면 가능합니다. 문의를 보내주시면 입금 전에 가능 여부, 배송비, 송금 방법을 확인해 드립니다. 해외 배송비는 기본적으로 구매자 부담이며, 작가가 무료배송을 선택했더라도 해외 배송에 적용되는지는 별도로 확인합니다. 관세·수입세는 구매자 부담입니다. 문의는 영어로 보내셔도 됩니다.", en: "Yes, where the artist can ship abroad. Before payment, we confirm availability, shipping cost and how to transfer payment. Buyers pay international shipping by default; even if an artist offers free shipping, confirm whether it covers the overseas destination. Import duties and taxes are paid by the buyer. You can write to us in English." },
  guideQShipFee: { ko: "배송비는 얼마인가요?", en: "How much is shipping?" },
  guideAShipFee: { ko: "배송비는 기본적으로 구매자 부담이며 작품 크기·무게·지역·운송 방법에 따라 달라집니다. 작가가 작품별로 무료배송을 선택하면 합의한 범위의 배송비를 작가가 부담합니다. 무료배송의 적용 지역과 범위는 입금 전에 확인합니다. 대형 작품의 별도 운송·포장·설치 비용은 따로 협의하며, 무료배송에 자동으로 포함되지 않습니다. 최종 비용과 누가 부담하는지 확인한 뒤 입금합니다.", en: "Buyers pay shipping by default; cost depends on size, weight, destination and transport. An artist may offer free shipping for a work and cover costs within the agreed scope. Confirm eligible destinations and coverage before payment. Special transport, packing or installation for large works is agreed separately and is not automatically included in free shipping. Confirm the final costs and who pays before transferring money." },

  guideQFrame: { ko: "액자는 포함되나요?", en: "Is a frame included?" },
  guideAFrame: { ko: "기본적으로 액자는 포함되지 않습니다. 작품에 따라 이미 액자에 들어 있는 경우도 있으니 문의 때 확인해 드리고, 액자가 필요하시면 어떤 방식이 어울릴지 함께 상담합니다.", en: "Frames are not included by default. Some works already come framed — we'll confirm when you inquire — and if you want one, we'll talk through what suits the piece." },
  guideQAuth: { ko: "진품이라는 걸 어떻게 알 수 있나요?", en: "How do I know it's authentic?" },
  guideAAuth: { ko: "서명과 작품 확인서·보증서 제공 여부는 작품별로 다릅니다. 작품 정보의 확인된 내용을 먼저 확인해 주세요. '확인 필요'나 '구매 전 작가 확인'으로 표시된 항목은 작가에게 확인한 뒤 입금 전에 안내합니다. 필요한 경우 서명·뒷면·옆면 등 실물 사진도 요청할 수 있습니다.", en: "Signature and certificate availability vary by work. Check the confirmed artwork details first. Items marked as unknown or to be confirmed with the artist are checked before payment. You can also request photos of the signature, back or edges." },

  guideQRefund: { ko: "마음이 바뀌면 환불할 수 있나요?", en: "Can I return it if I change my mind?" },
  guideARefund: { ko: "작품을 받은 날부터 7일 안에 포트 갤러리로 연락해 주시면 됩니다. 작품이 훼손되지 않은 상태여야 하고, 왕복 배송비는 구매자 부담입니다. 반품된 작품이 도착하면 3영업일 안에 환급됩니다. 연락은 작가에게 직접 하지 않으셔도 되고, 포트 갤러리가 창구가 되어 진행합니다.", en: "Contact Pote Gallery within 7 days of receiving the work. It must come back undamaged, and return shipping both ways is the buyer's cost. Once the returned work arrives, the refund is issued within 3 business days. You never have to negotiate with the artist directly — Pote Gallery handles it as your single point of contact." },

  guideQDiffer: { ko: "사진과 실물이 다르면요?", en: "What if it looks different from the photo?" },
  guideADiffer: { ko: "표시된 내용과 실제 작품이 다른 경우에는 7일이 지나도 신청할 수 있습니다. 작품을 받은 날부터 3개월 안, 그 사실을 알게 된 날부터 30일 안이면 됩니다. 그래서 포트 갤러리는 작품 사진과 크기·재료 표기를 작가 확인을 거쳐 올리고, 확인되지 않은 정보는 만들지 않습니다.", en: "If the work differs from how it was described, the 7-day window doesn't apply: you have 3 months from delivery and 30 days from noticing. That's why Pote Gallery publishes photos, dimensions and materials only after the artist confirms them, and never invents details." },

  guideQDamage: { ko: "배송 중에 파손되면요?", en: "What if it arrives damaged?" },
  guideADamage: { ko: "포장을 연 상태 그대로 사진을 찍어 포트 갤러리로 보내주세요. 배송 중 파손으로 확인되면 전액 환급 또는 다른 작품으로 교환해 드립니다. 이 경우 배송비도 구매자가 부담하지 않습니다.", en: "Photograph it exactly as you opened it and send the photos to Pote Gallery. If it's confirmed as shipping damage, you get a full refund or an exchange for another work — and you don't pay the shipping either." },

  guideQPrice: { ko: "가격은 누가 정하나요?", en: "Who sets the price?" },
  guideAPrice: { ko: "작가가 정한 실제 판매가를 그대로 표시합니다. 포트 갤러리가 임의로 올리거나 내리지 않고, 수수료를 얹지도 않습니다. 표시된 금액이 지불하실 금액입니다(배송비 별도).", en: "We show the price the artist actually set. Pote Gallery never marks it up or down, and adds no fee on top. What you see is what you pay, plus shipping." },

  guideLegalHeading: { ko: "법적으로 밝혀야 하는 것", en: "What we're required to disclose" },
  guideLegal1: { ko: "포트 갤러리는 통신판매중개자이며, 작품 매매의 당사자가 아닙니다. 매매 계약은 구매자와 작가 사이에 성립합니다.", en: "Pote Gallery is an intermediary platform, not a party to the sale. The contract of sale is between the buyer and the artist." },
  guideLegal2: { ko: "대금은 작가에게 직접 지급되며 포트 갤러리는 대금을 보관하지 않습니다. 그래서 포트 갤러리는 결제대금예치(에스크로) 서비스를 아직 제공하지 않습니다.", en: "Payment goes directly to the artist; Pote Gallery does not hold funds. For that reason we do not yet offer an escrow service." },
  guideLegal3: { ko: "판매자가 개인 작가인지 사업자인지 작품 페이지에 표시합니다. 분쟁이 생기면 포트 갤러리가 확인한 작가의 연락처와 거래 내역을 분쟁조정기구나 법원에 제공해 해결에 협조합니다.", en: "Each artwork page states whether the seller is a private individual or a registered business. If a dispute arises, Pote Gallery cooperates by providing the artist's verified contact details and transaction records to a dispute-resolution body or a court." },
} as const;
