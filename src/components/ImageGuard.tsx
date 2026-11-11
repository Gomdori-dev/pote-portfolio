"use client";

import { useEffect } from "react";

// 작품 사진을 우클릭 → "이미지를 다른 이름으로 저장"이나 끌어다 놓기로 쉽게
// 가져가지 못하게 막는다. 캡처·개발자 도구까지 막을 방법은 없으므로 가벼운
// 억제용이다. 작가 포털·관리자 화면은 자기 사진을 다루는 곳이라 막지 않는다.
const OPEN_PATHS = ["/admin", "/artist-portal", "/artist-studio"];

function isImageElement(element: Element) {
  if (element.closest("img, picture, canvas, video, svg image")) return true;
  const bg = getComputedStyle(element).backgroundImage;
  return !!bg && bg !== "none" && bg.includes("url(");
}

// 사진 위에 투명한 버튼(결 확대)이나 장식 층이 덮여 있으면 이벤트 대상이 사진이 아니다.
// 그래서 누른 자리 아래에 겹쳐 있는 요소를 모두 본다.
function isOverImage(event: Event) {
  const target = event.target;
  if (target instanceof Element && isImageElement(target)) return true;
  if (!(event instanceof MouseEvent)) return false;
  return document.elementsFromPoint(event.clientX, event.clientY).some(isImageElement);
}

function isOpenPath() {
  const path = window.location.pathname;
  return OPEN_PATHS.some((open) => path === open || path.startsWith(`${open}/`));
}

export function ImageGuard() {
  useEffect(() => {
    const block = (event: Event) => {
      if (isOpenPath() || !isOverImage(event)) return;
      event.preventDefault();
    };
    // Ctrl+S(맥은 Cmd+S) "페이지 저장"은 사진 파일까지 함께 저장하므로 막는다.
    const blockSave = (event: KeyboardEvent) => {
      if (isOpenPath() || !(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== "s") return;
      event.preventDefault();
    };
    document.addEventListener("contextmenu", block);
    document.addEventListener("dragstart", block);
    document.addEventListener("keydown", blockSave);
    return () => {
      document.removeEventListener("contextmenu", block);
      document.removeEventListener("dragstart", block);
      document.removeEventListener("keydown", blockSave);
    };
  }, []);
  return null;
}
