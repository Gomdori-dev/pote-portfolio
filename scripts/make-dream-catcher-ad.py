"""Render the single Pote Gallery Dream Catcher ad from local, unmodified artwork."""

from __future__ import annotations

import subprocess
import tempfile
import wave
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageChops


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "소셜/광고/2026-09-27-드림캐처-브랜드/dream-catcher-brand-18s.mp4"
ART = ROOT / "public/artists/jihyeseung/dream-catcher.jpg"
ROOMS = ROOT / "public/rooms"
W, H, FPS, SECONDS = 1080, 1920, 24, 18.5
FOREST_DEEP = "#071d18"
FOREST = "#0b2d25"
CORAL = "#985216"
PAPER = "#f3eee4"
FONT_DIR = Path("C:/Windows/Fonts")
SERIF = FONT_DIR / "NotoSerifKR-VF.ttf"
SANS = FONT_DIR / "malgun.ttf"
GEORGIA = FONT_DIR / "georgiai.ttf"


def font(path: Path, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(path), size)


def text(draw: ImageDraw.ImageDraw, xy: tuple[int, int], value: str, size: int,
         color: str = PAPER, face: Path = SERIF, anchor: str | None = None,
         stroke_width: int = 0, stroke_fill: str | None = None) -> None:
    draw.text(xy, value, font=font(face, size), fill=color, anchor=anchor,
              stroke_width=stroke_width, stroke_fill=stroke_fill)


def base(color: str = FOREST_DEEP) -> Image.Image:
    im = Image.new("RGB", (W, H), color)
    d = ImageDraw.Draw(im)
    d.rectangle((65, 268, 1015, 1248), outline=CORAL, width=2)
    # The thin rules keep all visual information aligned with the Meta safe zone.
    d.rectangle((65, 268, 1015, 1248), fill=color)
    d.line((80, 280, 1000, 280), fill=CORAL, width=3)
    return im


def stamp(draw: ImageDraw.ImageDraw, y: int, size: int = 48) -> None:
    text(draw, (82, y), "Pote", size, PAPER, GEORGIA)
    text(draw, (250, y + 11), "GALLERY", 21, PAPER, SANS)
    draw.line((82, y + size + 8, 998, y + size + 8), fill=CORAL, width=2)


def interp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def ease(t: float) -> float:
    t = min(1.0, max(0.0, t))
    return t * t * (3 - 2 * t)


def room_panel(day: Image.Image, night: Image.Image, work: Image.Image,
               foreground: Image.Image, mix: float, with_art: bool) -> Image.Image:
    # 5:4 photo at 920x736. The artwork geometry exactly follows room-scene.ts:
    # min(100/340, 62/55, (58*.8)/84) * 55/84, with height / .8.
    stage = Image.blend(day, night, mix) if mix else day.copy()
    stage.paste(foreground, (0, 0), foreground)
    if with_art:
        scale_w = min(100 / 340, 62 / 55, (58 * .8) / 84)
        wpct = 55 * scale_w
        hpct = 84 * scale_w / .8
        x = round((100 - wpct) / 200 * stage.width)
        y = round((40 - hpct / 2) / 100 * stage.height)
        aw = round(wpct / 100 * stage.width)
        ah = round(hpct / 100 * stage.height)
        resized = work.resize((aw, ah), Image.Resampling.LANCZOS)
        stage.paste(resized, (x, y))
        # An exterior frame, never painted over the artwork.
        dr = ImageDraw.Draw(stage)
        dr.rectangle((x - 7, y - 7, x + aw + 6, y + ah + 6), outline=CORAL, width=7)
        # Re-paste to guarantee no edge pixels of the work were covered.
        stage.paste(resized, (x, y))
        assert ImageChops.difference(stage.crop((x, y, x + aw, y + ah)), resized).getbbox() is None
        assert ImageChops.difference(resized, Image.open(ART).convert("RGB").resize((aw, ah), Image.Resampling.LANCZOS)).getbbox() is None
    return stage


def make_music(path: Path) -> None:
    sr = 48000
    n = int(SECONDS * sr)
    t = np.arange(n, dtype=np.float64) / sr
    audio = np.zeros(n, dtype=np.float64)
    # Original, quiet felt-piano/chime motif made entirely from oscillators.
    events = [(0.0, 220.0, .12), (.8, 329.63, .12), (1.6, 440.0, .12),
              (3.2, 293.66, .13), (4.45, 440.0, .18), (5.2, 554.37, .12),
              (6.7, 329.63, .11), (8.0, 440.0, .12), (9.4, 659.25, .15),
              (10.6, 554.37, .12), (12.2, 440.0, .11), (13.8, 329.63, .13),
              (16.5, 440.0, .14)]
    for at, hz, amp in events:
        start = round(at * sr)
        length = min(n - start, round(2.6 * sr))
        tt = np.arange(length) / sr
        env = (1 - np.exp(-tt * 90)) * np.exp(-tt * 1.7)
        tone = (np.sin(2 * np.pi * hz * tt) + .22 * np.sin(2 * np.pi * hz * 2 * tt))
        audio[start:start + length] += amp * env * tone
    for hz in (110, 164.81, 220):
        audio += .014 * np.sin(2 * np.pi * hz * t) * (1 - np.exp(-t * 1.2))
    audio *= np.minimum(1, t / .35) * np.minimum(1, (SECONDS - t) / .75)
    stereo = np.column_stack((audio * .96, audio)).clip(-.95, .95)
    with wave.open(str(path), "wb") as wav:
        wav.setnchannels(2)
        wav.setsampwidth(2)
        wav.setframerate(sr)
        wav.writeframes((stereo * 32767).astype("<i2").tobytes())


def render() -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    work = Image.open(ART).convert("RGB")
    day = Image.open(ROOMS / "living.webp").convert("RGB").resize((920, 736), Image.Resampling.LANCZOS)
    night = Image.open(ROOMS / "living-night-v2.webp").convert("RGB").resize((920, 736), Image.Resampling.LANCZOS)
    front = Image.open(ROOMS / "living-foreground.webp").convert("RGBA").resize((920, 736), Image.Resampling.LANCZOS)
    room_empty = room_panel(day, night, work, front, 0, False)
    rooms = [room_panel(day, night, work, front, k / 16, True) for k in range(17)]
    hero_work = work.resize((570, 859), Image.Resampling.LANCZOS)
    info_work = work.resize((370, 558), Image.Resampling.LANCZOS)
    assert ImageChops.difference(hero_work, Image.open(ART).convert("RGB").resize((570, 859), Image.Resampling.LANCZOS)).getbbox() is None
    assert ImageChops.difference(info_work, Image.open(ART).convert("RGB").resize((370, 558), Image.Resampling.LANCZOS)).getbbox() is None

    intro = base()
    d = ImageDraw.Draw(intro)
    d.rectangle((80, 470, 1000, 1000), fill=FOREST)
    d.line((185, 546, 895, 546), fill=CORAL, width=4)
    text(d, (540, 595), "Pote", 151, PAPER, GEORGIA, "mt")
    text(d, (540, 807), "G A L L E R Y", 30, PAPER, SANS, "mt")
    text(d, (540, 930), "예술이 머무는 자리", 32, PAPER, SERIF, "mt")

    empty = base()
    d = ImageDraw.Draw(empty)
    stamp(d, 302)
    text(d, (80, 385), "하나의 그림,", 75)
    text(d, (80, 483), "달라지는 공간.", 75, PAPER)
    d.rectangle((70, 598, 1010, 1186), fill=CORAL)
    # The panoramic room photo is allowed a crop; the artwork photo is not.
    empty.paste(room_empty.crop((0, 74, 920, 662)), (80, 598))
    text(d, (82, 1204), "01  /  BEFORE", 19, CORAL, SANS)

    reveal = base()
    d = ImageDraw.Draw(reveal)
    stamp(d, 302)
    text(d, (80, 385), "그림 한 점이", 75)
    text(d, (80, 483), "공간의 표정을 바꿉니다.", 56)
    # Stage is pasted per frame to animate only the room lighting.
    text(d, (82, 1204), "02  /  WITH ART", 19, CORAL, SANS)

    hero = base()
    d = ImageDraw.Draw(hero)
    stamp(d, 302)
    hero.paste(hero_work, (255, 351))
    d.rectangle((249, 345, 830, 1216), outline=CORAL, width=6)
    hero.paste(hero_work, (255, 351))
    text(d, (85, 1110), "지혜승", 25, PAPER, SERIF)
    text(d, (85, 1150), "Dream Catcher", 22, PAPER, GEORGIA)
    assert ImageChops.difference(hero.crop((255, 351, 825, 1210)), hero_work).getbbox() is None

    info = base(FOREST)
    d = ImageDraw.Draw(info)
    stamp(d, 302)
    text(d, (80, 405), "Dream Catcher", 65, PAPER, GEORGIA)
    text(d, (82, 495), "지혜승  ·  원화", 29, PAPER)
    info.paste(info_work, (80, 580))
    d.rectangle((74, 574, 456, 1144), outline=CORAL, width=6)
    info.paste(info_work, (80, 580))
    d.line((505, 700, 996, 700), fill=CORAL, width=3)
    text(d, (505, 720), "SIZE", 20, CORAL, SANS)
    text(d, (505, 761), "55 × 84 cm", 38, PAPER, GEORGIA)
    d.line((505, 855, 996, 855), fill=CORAL, width=3)
    text(d, (505, 877), "PRICE", 20, CORAL, SANS)
    text(d, (505, 920), "800,000원", 39, PAPER, SERIF)
    text(d, (505, 1065), "문의 가능", 30, PAPER)
    text(d, (82, 1170), "공간은 연출 이미지 · 작품은 실제 사진", 22, PAPER, SANS)
    assert ImageChops.difference(info.crop((80, 580, 450, 1138)), info_work).getbbox() is None

    outro = base()
    d = ImageDraw.Draw(outro)
    d.rectangle((80, 440, 1000, 1070), fill=FOREST)
    d.line((155, 500, 925, 500), fill=CORAL, width=4)
    text(d, (540, 548), "Pote", 143, PAPER, GEORGIA, "mt")
    text(d, (540, 745), "G A L L E R Y", 28, PAPER, SANS, "mt")
    text(d, (540, 865), "당신의 공간에, 한 점의 예술", 38, PAPER, SERIF, "mt")
    d.rectangle((235, 960, 845, 1030), fill=CORAL)
    text(d, (540, 975), "potegallery.com", 37, PAPER, GEORGIA, "mt")

    ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
    with tempfile.TemporaryDirectory(prefix="pote-ad-") as td:
        wav = Path(td) / "score.wav"
        make_music(wav)
        cmd = [ffmpeg, "-hide_banner", "-loglevel", "error", "-y",
               "-f", "rawvideo", "-pix_fmt", "rgb24", "-s", f"{W}x{H}",
               "-r", str(FPS), "-i", "pipe:0", "-i", str(wav),
               "-c:v", "libx264", "-preset", "veryfast", "-crf", "19",
               "-pix_fmt", "yuv420p", "-r", str(FPS),
               "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2",
               "-t", str(SECONDS), "-movflags", "+faststart",
               "-use_editlist", "0", str(OUT)]
        proc = subprocess.Popen(cmd, stdin=subprocess.PIPE)
        assert proc.stdin is not None
        for i in range(round(SECONDS * FPS)):
            t = i / FPS
            if t < 1.6:
                frame = Image.blend(base(), intro, ease(t / .45))
            elif t < 4.4:
                frame = empty.copy()
            elif t < 9.4:
                frame = reveal.copy()
                mix = 0 if t < 6.9 else ease((t - 6.9) / 1.7)
                idx = round(mix * 16)
                frame.paste(rooms[idx].crop((0, 74, 920, 662)), (80, 598))
            elif t < 13.8:
                frame = hero.copy()
            elif t < 16.5:
                frame = info.copy()
            else:
                frame = Image.blend(base(), outro, ease((t - 16.5) / .35))
            proc.stdin.write(frame.tobytes())
            if i % 96 == 0:
                print(f"rendered {i}/{round(SECONDS * FPS)} frames", flush=True)
        proc.stdin.close()
        if proc.wait() != 0:
            raise RuntimeError("ffmpeg failed")
    print(f"Artwork integrity: identical to fresh LANCZOS-only resize at room, hero and info sizes.\nOutput: {OUT}")


if __name__ == "__main__":
    render()
