import type { Lang } from "@/lib/i18n";
import { SOCIAL_HOLD_SLUGS } from "@/lib/social-holds";
import { formatDuration, formatEntry, worksByTime, type Visit } from "@/lib/visit-log";

/**
 * Draws this visit's admission ticket (design "A", approved 2026-09-27): a
 * forest-green ticket with gold-foil type, the longest-viewed work hung in a
 * gold frame over a blur of its own colours, up to four more works, a
 * perforated stub with ADMIT ONE, a barcode and a terracotta entry stamp.
 *
 * Canvas rather than a DOM screenshot so it renders the same on every phone
 * and saves as an ordinary image. Photos go through the same-origin image
 * optimiser, so blob-hosted submissions don't taint the canvas, and every
 * photo is drawn whole (contain) — never cropped.
 */

export type TicketFonts = { display: string; serif: string };

const W = 1080;
const H = 1350;
const TW = 720; // ticket width
const POSTER = 500;
const BODY = 456;
const STUB = 132;
const TH = POSTER + BODY + STUB;
const GOLD_STOPS: [number, string][] = [[0, "#b98a4a"], [0.22, "#f6dcae"], [0.45, "#caa062"], [0.62, "#fbe7c2"], [0.85, "#b98a4a"], [1, "#e9c890"]];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

const COPY = {
  ko: { title: "오늘의 관람", longest: "가장 오래 머문 작품", seen: "함께 본 작품", entry: "입장", time: "관람", works: "작품", artists: "작가", worksUnit: "점", artistsUnit: "명", alone: "한 작품과 오래 머문 관람이었어요", stamp: "입장" },
  en: { title: "Today's Visit", longest: "Longest look", seen: "Also seen", entry: "ENTRY", time: "TIME", works: "WORKS", artists: "ARTISTS", worksUnit: "", artistsUnit: "", alone: "One work, one long look.", stamp: "ADMIT" },
} as const;

function optimised(src: string, width: number) {
  return `/api/display-image?url=${encodeURIComponent(src)}&w=${width}&q=75`;
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function gold(ctx: CanvasRenderingContext2D, x0: number, x1: number) {
  const g = ctx.createLinearGradient(x0, 0, x1, 0);
  for (const [at, color] of GOLD_STOPS) g.addColorStop(at, color);
  return g;
}

/** Text with letter-spacing, drawn glyph by glyph (ctx.letterSpacing is not everywhere yet). */
function spaced(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, spacing: number, align: "left" | "center" | "right" = "left") {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * Math.max(0, chars.length - 1);
  let cx = align === "center" ? x - total / 2 : align === "right" ? x - total : x;
  const saved = ctx.textAlign;
  ctx.textAlign = "left";
  chars.forEach((ch, i) => { ctx.fillText(ch, cx, y); cx += widths[i] + spacing; });
  ctx.textAlign = saved;
  return total;
}

/** Shrinks the font until the text fits, then ellipsises as a last resort. */
function fitText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number, font: (size: number) => string, size: number, min: number) {
  let s = size;
  ctx.font = font(s);
  while (s > min && ctx.measureText(text).width > maxWidth) { s -= 1; ctx.font = font(s); }
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut.length > 1 && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return `${cut}…`;
}

function noise(alpha: number, tint = 255) {
  const c = document.createElement("canvas");
  c.width = c.height = 160;
  const g = c.getContext("2d")!;
  const data = g.createImageData(160, 160);
  for (let i = 0; i < data.data.length; i += 4) {
    data.data[i] = data.data[i + 1] = data.data[i + 2] = tint;
    data.data[i + 3] = Math.random() * 255 * alpha;
  }
  g.putImageData(data, 0, 0);
  return c;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** A photo in a gold frame, drawn whole inside a box of its own proportions. */
function framed(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, cx: number, top: number, maxW: number, maxH: number, pad: number, shadow = true) {
  const ratio = img ? img.naturalWidth / img.naturalHeight : 1;
  let w = maxW;
  let h = w / ratio;
  if (h > maxH) { h = maxH; w = h * ratio; }
  const x = cx - w / 2;
  const y = top + (maxH - h) / 2;
  ctx.save();
  if (shadow) { ctx.shadowColor = "rgba(0,0,0,.7)"; ctx.shadowBlur = 34; ctx.shadowOffsetY = 20; }
  const g = ctx.createLinearGradient(x, y, x + w, y + h);
  g.addColorStop(0, "#2a2016");
  g.addColorStop(1, "#120d08");
  ctx.fillStyle = g;
  ctx.fillRect(x - pad, y - pad, w + pad * 2, h + pad * 2);
  ctx.restore();
  ctx.strokeStyle = "rgba(233,200,144,.55)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x - pad + 0.5, y - pad + 0.5, w + pad * 2 - 1, h + pad * 2 - 1);
  ctx.fillStyle = "#0d0a07";
  ctx.fillRect(x, y, w, h);
  if (img) ctx.drawImage(img, x, y, w, h);
  return { x, y, w, h };
}

function barcode(ctx: CanvasRenderingContext2D, seed: string, x: number, y: number, w: number, h: number) {
  let n = [...seed].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7);
  let cx = x;
  while (cx < x + w) {
    n = (n * 1103515245 + 12345) >>> 0;
    const bar = 1 + (n % 3);
    const gap = 1 + ((n >> 3) % 3);
    ctx.fillRect(cx, y, Math.min(bar, x + w - cx), h);
    cx += bar + gap;
  }
}

function stamp(ctx: CanvasRenderingContext2D, fonts: TicketFonts, cx: number, cy: number, date: string, word: string, serifWord: boolean) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((-14 * Math.PI) / 180);
  const ink = "rgba(224,109,59,.9)";
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(0, 0, 64, 0, Math.PI * 2); ctx.stroke();
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.stroke();
  ctx.textBaseline = "middle";
  ctx.font = `600 13px ${fonts.display}`;
  spaced(ctx, "POTE", 0, -26, 4, "center");
  ctx.font = `600 27px ${fonts.display}`;
  ctx.textAlign = "center";
  ctx.fillText(date, 0, 2);
  ctx.font = serifWord ? `500 12px ${fonts.serif}` : `600 12px ${fonts.display}`;
  spaced(ctx, word, 0, 29, serifWord ? 5 : 3, "center");
  // Worn ink: knock random specks out of the stamp.
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 420; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 68;
    ctx.globalAlpha = 0.25 + Math.random() * 0.6;
    ctx.beginPath(); ctx.arc(Math.cos(a) * r, Math.sin(a) * r, Math.random() * 1.8, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export async function drawVisitTicket(visit: Visit, lang: Lang, fonts: TicketFonts, now = Date.now()): Promise<Blob> {
  const copy = COPY[lang];
  // The ticket is made to be shared, so works on social hold are left off it
  // entirely (and out of its counts).
  const shareable = { ...visit, works: visit.works.filter((work) => !SOCIAL_HOLD_SLUGS.has(work.slug)) };
  visit = shareable;
  const ordered = worksByTime(visit);
  const featured = ordered[0];
  const others = ordered.slice(1, 5);
  const artists = new Set(visit.works.map((work) => work.artist.ko)).size;

  // Load the fonts with the text they will draw (Korean faces arrive in slices).
  const sample = `${copy.title}${copy.longest}${copy.seen}${copy.entry}${copy.time}${copy.works}${copy.artists}분초점명입장${ordered.map((w) => `${w.title[lang]}${w.artist[lang]}`).join("")}`;
  await Promise.all([
    document.fonts.load(`500 54px ${fonts.serif}`, sample),
    document.fonts.load(`400 12px ${fonts.serif}`, sample),
    document.fonts.load(`600 30px ${fonts.display}`, "POTE GALLERY ADMISSION ADMIT ONE 0123456789.·′″"),
  ]).catch(() => undefined);

  const [featuredImg, ...otherImgs] = await Promise.all([
    featured ? loadImage(optimised(featured.image, 828)) : Promise.resolve(null),
    ...others.map((work) => loadImage(optimised(work.image, 384))),
  ]);

  // ---- The ticket, drawn on its own canvas so the shadow follows the notches.
  const t = document.createElement("canvas");
  t.width = TW;
  t.height = TH;
  const c = t.getContext("2d")!;
  c.save();
  roundRect(c, 0, 0, TW, TH, 18);
  c.clip();

  // Poster band: a blur of the featured work's own colours behind it.
  c.fillStyle = "#101a14";
  c.fillRect(0, 0, TW, POSTER);
  if (featuredImg) {
    const tiny = document.createElement("canvas");
    tiny.width = 24;
    tiny.height = Math.round((24 * POSTER) / TW);
    const tc = tiny.getContext("2d")!;
    const r = featuredImg.naturalWidth / featuredImg.naturalHeight;
    const coverW = Math.max(tiny.width, tiny.height * r);
    const coverH = coverW / r;
    tc.drawImage(featuredImg, (tiny.width - coverW) / 2, (tiny.height - coverH) / 2, coverW, coverH);
    c.imageSmoothingEnabled = true;
    c.imageSmoothingQuality = "high";
    c.globalAlpha = 0.62;
    c.drawImage(tiny, -60, -60, TW + 120, POSTER + 120);
    c.globalAlpha = 1;
  }
  let g = c.createRadialGradient(TW / 2, POSTER * 0.45, 60, TW / 2, POSTER * 0.45, TW * 0.62);
  g.addColorStop(0, "rgba(6,14,10,0)");
  g.addColorStop(1, "rgba(6,14,10,.6)");
  c.fillStyle = g;
  c.fillRect(0, 0, TW, POSTER);
  g = c.createLinearGradient(0, 0, 0, POSTER);
  g.addColorStop(0, "rgba(6,14,10,.45)");
  g.addColorStop(0.3, "rgba(6,14,10,.05)");
  g.addColorStop(0.68, "rgba(6,14,10,.1)");
  g.addColorStop(1, "rgba(14,42,30,.97)");
  c.fillStyle = g;
  c.fillRect(0, 0, TW, POSTER);

  // Wordmark and ticket number.
  c.textBaseline = "alphabetic";
  c.fillStyle = gold(c, 40, 280);
  c.font = `600 25px ${fonts.display}`;
  const poteW = spaced(c, "POTE", 40, 66, 5);
  const galleryX = 40 + poteW + 14;
  spaced(c, "GALLERY", galleryX, 66, 5);
  c.fillStyle = "#e9c890";
  c.font = `500 15px ${fonts.display}`;
  spaced(c, `No. ${visit.no}`, TW - 40, 56, 3.5, "right");
  c.font = `500 11px ${fonts.display}`;
  c.fillStyle = "rgba(233,200,144,.8)";
  spaced(c, "ONLINE EXHIBITION", TW - 40, 74, 3.8, "right");

  // The longest-viewed work, whole, in a gold frame.
  if (featured) {
    framed(c, featuredImg, TW / 2, 100, 400, 286, 9);
    c.textAlign = "center";
    c.fillStyle = "#f6e6c8";
    const title = fitText(c, `「${featured.title[lang]}」`, TW - 90, (s) => `500 ${s}px ${fonts.serif}`, 21, 14);
    c.fillText(title, TW / 2, POSTER - 50);
    c.fillStyle = "#e9c890";
    c.font = `500 17px ${fonts.display}`;
    const secs = Math.round(featured.ms / 1000);
    const line = `${featured.artist[lang]} · ${copy.longest} ${Math.floor(secs / 60)}′${String(secs % 60).padStart(2, "0")}″`;
    c.font = `500 16px ${fonts.serif}`;
    c.fillText(fitText(c, line, TW - 90, (s) => `500 ${s}px ${fonts.serif}`, 16, 12), TW / 2, POSTER - 22);
    c.textAlign = "left";
  }

  // Body: forest-green paper with gold foil.
  let y0 = POSTER;
  g = c.createLinearGradient(0, y0, 0, TH);
  g.addColorStop(0, "#0e2a1e");
  g.addColorStop(1, "#12352a");
  c.fillStyle = g;
  c.fillRect(0, y0, TW, BODY + STUB);
  c.fillStyle = c.createPattern(noise(0.05), "repeat")!;
  c.fillRect(0, y0, TW, BODY + STUB);
  c.strokeStyle = "rgba(233,200,144,.35)";
  c.lineWidth = 1;
  c.beginPath(); c.moveTo(18.5, y0); c.lineTo(18.5, y0 + BODY - 26); c.moveTo(TW - 18.5, y0); c.lineTo(TW - 18.5, y0 + BODY - 26); c.stroke();

  c.fillStyle = gold(c, 200, 520);
  c.font = `500 13px ${fonts.display}`;
  spaced(c, "◆   ADMISSION   ◆", TW / 2, y0 + 40, 5, "center");
  c.textAlign = "center";
  c.fillStyle = gold(c, 180, 540);
  c.font = `500 52px ${fonts.serif}`;
  c.fillText(copy.title, TW / 2, y0 + 104);
  c.textAlign = "left";
  const day = new Date(visit.start);
  c.fillStyle = "#d7b980";
  c.font = `500 19px ${fonts.display}`;
  spaced(c, `${day.getFullYear()} · ${String(day.getMonth() + 1).padStart(2, "0")} · ${String(day.getDate()).padStart(2, "0")} · ${WEEKDAYS[day.getDay()]}`, TW / 2, y0 + 138, 5.5, "center");

  // Facts: entry, time, works, artists.
  const fy = y0 + 160;
  const fh = 84;
  c.strokeStyle = "rgba(233,200,144,.45)";
  c.beginPath(); c.moveTo(46, fy + 0.5); c.lineTo(TW - 46, fy + 0.5); c.moveTo(46, fy + fh + 0.5); c.lineTo(TW - 46, fy + fh + 0.5); c.stroke();
  c.strokeStyle = "rgba(233,200,144,.2)";
  c.beginPath(); c.moveTo(46, fy + 4.5); c.lineTo(TW - 46, fy + 4.5); c.moveTo(46, fy + fh - 3.5); c.lineTo(TW - 46, fy + fh - 3.5); c.stroke();
  const cellW = (TW - 92) / 4;
  const duration = formatDuration(now - visit.start, lang).split(" ");
  const facts: { label: string; parts: [string, string][] }[] = [
    { label: copy.entry, parts: [[formatEntry(visit.start), ""]] },
    { label: copy.time, parts: duration.map((part) => [part.replace(/\D+$/, ""), part.replace(/^\d+/, "")] as [string, string]) },
    { label: copy.works, parts: [[String(visit.works.length), copy.worksUnit]] },
    { label: copy.artists, parts: [[String(artists), copy.artistsUnit]] },
  ];
  facts.forEach((fact, i) => {
    const cx = 46 + cellW * i + cellW / 2;
    if (i > 0) { c.strokeStyle = "rgba(233,200,144,.22)"; c.beginPath(); c.moveTo(46 + cellW * i + 0.5, fy + 12); c.lineTo(46 + cellW * i + 0.5, fy + fh - 10); c.stroke(); }
    c.fillStyle = "#b99a66";
    c.font = lang === "ko" ? `400 11px ${fonts.serif}` : `600 11px ${fonts.display}`;
    spaced(c, fact.label, cx, fy + 30, 3.5, "center");
    // Number in the display face, unit smaller in the serif, centred as one run.
    const runs = fact.parts.flatMap(([num, unit]) => [{ text: num, font: `600 28px ${fonts.display}` }, ...(unit ? [{ text: unit, font: `400 14px ${fonts.serif}` }] : []), { text: " ", font: `600 12px ${fonts.display}` }]).slice(0, -1);
    const widths = runs.map((run) => { c.font = run.font; return c.measureText(run.text).width; });
    let x = cx - widths.reduce((a, b) => a + b, 0) / 2;
    c.fillStyle = gold(c, cx - 50, cx + 50);
    runs.forEach((run, k) => { c.font = run.font; c.fillText(run.text, x, fy + 66); x += widths[k]; });
  });

  // Also seen.
  const sy = fy + fh + 30;
  c.fillStyle = "#b99a66";
  c.font = lang === "ko" ? `400 11.5px ${fonts.serif}` : `600 11.5px ${fonts.display}`;
  spaced(c, copy.seen, TW / 2, sy, 4, "center");
  if (others.length) {
    const gap = 12;
    const boxW = (TW - 92 - gap * 3) / 4;
    const rowW = boxW * others.length + gap * (others.length - 1);
    others.forEach((work, i) => {
      const bx = TW / 2 - rowW / 2 + i * (boxW + gap);
      const by = sy + 16;
      const fg = c.createLinearGradient(bx, by, bx + boxW, by + 100);
      fg.addColorStop(0, "#2a2016");
      fg.addColorStop(1, "#120d08");
      c.save();
      c.shadowColor = "rgba(0,0,0,.6)"; c.shadowBlur = 12; c.shadowOffsetY = 6;
      c.fillStyle = fg;
      c.fillRect(bx, by, boxW, 100);
      c.restore();
      c.strokeStyle = "rgba(233,200,144,.4)";
      c.strokeRect(bx + 0.5, by + 0.5, boxW - 1, 99);
      c.fillStyle = "#0a1f16";
      c.fillRect(bx + 4, by + 4, boxW - 8, 92);
      const img = otherImgs[i];
      if (img) {
        const r = img.naturalWidth / img.naturalHeight;
        let w = boxW - 8;
        let h = w / r;
        if (h > 92) { h = 92; w = h * r; }
        c.drawImage(img, bx + 4 + (boxW - 8 - w) / 2, by + 4 + (92 - h) / 2, w, h);
      }
      c.textAlign = "center";
      c.fillStyle = "#cdb07a";
      c.fillText(fitText(c, work.artist[lang], boxW, (s) => `400 ${s}px ${fonts.serif}`, 12, 9), bx + boxW / 2, by + 120);
      c.textAlign = "left";
    });
  } else {
    c.textAlign = "center";
    c.fillStyle = "#d7b980";
    c.font = `400 17px ${fonts.serif}`;
    c.fillText(copy.alone, TW / 2, sy + 62);
    c.textAlign = "left";
  }

  // Perforation: punched holes and side notches.
  y0 = POSTER + BODY;
  c.globalCompositeOperation = "destination-out";
  for (let x = 40; x <= TW - 40; x += 15) { c.beginPath(); c.arc(x, y0, 3.2, 0, Math.PI * 2); c.fill(); }
  c.beginPath(); c.arc(0, y0, 20, 0, Math.PI * 2); c.fill();
  c.beginPath(); c.arc(TW, y0, 20, 0, Math.PI * 2); c.fill();
  c.globalCompositeOperation = "source-over";

  // Stub.
  c.fillStyle = gold(c, 46, 340);
  c.font = `600 30px ${fonts.display}`;
  spaced(c, "ADMIT ONE", 46, y0 + 78, 10);
  c.fillStyle = "rgba(233,200,144,.82)";
  barcode(c, visit.no, TW - 256, y0 + 36, 210, 50);
  c.fillStyle = gold(c, TW - 256, TW - 46);
  c.font = `500 15px ${fonts.display}`;
  spaced(c, "potegallery.com", TW - 46, y0 + 106, 3, "right");
  stamp(c, fonts, TW - 330, y0 + 68, `${String(day.getMonth() + 1).padStart(2, "0")}.${String(day.getDate()).padStart(2, "0")}`, copy.stamp, lang === "ko");
  c.restore();

  // ---- The scene: a dark table under a warm light, the ticket tilted on it.
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const o = out.getContext("2d")!;
  g = o.createRadialGradient(W / 2, H * 0.22, 40, W / 2, H * 0.22, W * 0.95);
  g.addColorStop(0, "#2a2a22");
  g.addColorStop(0.55, "#16150f");
  g.addColorStop(1, "#0b0a07");
  o.fillStyle = g;
  o.fillRect(0, 0, W, H);
  o.fillStyle = o.createPattern(noise(0.05), "repeat")!;
  o.fillRect(0, 0, W, H);
  o.save();
  o.translate(W / 2, H / 2 - 10);
  o.rotate((-3 * Math.PI) / 180);
  // The ticket fills most of the image (it is what people share).
  o.scale(1.14, 1.14);
  o.shadowColor = "rgba(0,0,0,.62)";
  o.shadowBlur = 70;
  o.shadowOffsetY = 44;
  o.drawImage(t, -TW / 2, -TH / 2);
  o.restore();

  return new Promise((resolve, reject) => out.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("ticket"))), "image/jpeg", 0.92));
}
