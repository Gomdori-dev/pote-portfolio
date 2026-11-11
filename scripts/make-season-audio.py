"""
Seasonal exhibition background sound for /event — real field recordings only.

Each season's exhibition is named after a sound (새들 지저귀는 소리, 파도 치는
소리, 낙엽 밟는 소리, 눈 밟는 소리) and its page can play that sound. The
first version (2026-09-25) synthesised music plus the sounds; the user asked
for no music at all and for the footsteps to be real and slow. So this builds
each loop from recordings on Wikimedia Commons (licences below; the CC BY
ones are credited on the /event page).

The footsteps are real steps cut out one by one and re-spaced to a slow
stroll (about 1.5 s apart) — slowing the recording itself would drop the
pitch and smear it. A walk fades in and out as if someone passes by, over
the season's real background (falling leaves, distant wind).

    python scripts/make-season-audio.py [cache_dir]

downloads the sources into cache_dir (default .audio-sources/, gitignored)
and writes public/audio/season-{spring,summer,autumn,winter}.mp3, each a
seamless ~64 s loop. Needs numpy, scipy and imageio-ffmpeg.
"""

import json
import subprocess
import sys
import urllib.request
from pathlib import Path

import imageio_ffmpeg
import numpy as np
from scipy.ndimage import uniform_filter1d
from scipy.signal import butter, find_peaks, sosfiltfilt

SR = 44100
LOOP = 64.0
FADE = 4.0
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "audio"
COMMONS = "https://upload.wikimedia.org/wikipedia/commons/"

# name: (path under COMMONS, licence, author)
SOURCES = {
    "autumn_bed.wav": ("1/1b/Leaves_falling_from_the_trees_during_autumn_in_the_forest.wav", "CC0", "Wilfredor"),
    "leaves1.wav": ("a/a3/Walking_through_leaves_%28Gravity_Sound%29.wav", "CC BY 4.0", "Gravity Sound"),
    "leaves2.wav": ("9/9f/Walking_through_leaves_and_sticks_%28Gravity_Sound%29.wav", "CC BY 4.0", "Gravity Sound"),
    "snow1.mp3": ("e/e7/Walking_through_snow.mp3", "CC BY 4.0", "Lukas Beck"),
    "snow2.opus": ("f/f8/Crunchy_Snow_Walking_Sound_Effect_-_Human_Sounds.opus", "CC BY 3.0", "Spanac"),
    "wind.ogg": ("6/63/Killiney_Hill_Storm_Floris_20250804_1537.ogg", "CC0", "Karlunun"),
    "spring_birds.ogg": ("0/0a/20090610_0_ambience.ogg", "Public domain", "nille"),
    "waves.ogg": ("6/64/Ocean_Waves_on_a_Tropical_Beach.ogg", "CC0", "Jarrod Stanley"),
}

rng = np.random.default_rng(20260925)

# The first step confirms playback immediately. Three short passes keep the
# field recording alive without making the feet march at a fixed tempo.
AUTUMN_WALKS = ((0.4, 7), (21.0, 5), (41.0, 6))
WINTER_WALKS = ((0.4, 6), (22.0, 5), (42.0, 6))
FFMPEG = imageio_ffmpeg.get_ffmpeg_exe()


def fetch(cache: Path):
    cache.mkdir(parents=True, exist_ok=True)
    for name, (path, _, _) in SOURCES.items():
        target = cache / name
        if not target.exists():
            request = urllib.request.Request(COMMONS + path, headers={"User-Agent": "PoteGallery-audio/1.0 (https://potegallery.com)"})
            target.write_bytes(urllib.request.urlopen(request).read())


def load(path: Path) -> np.ndarray:
    raw = subprocess.run([FFMPEG, "-loglevel", "error", "-i", str(path), "-f", "f32le", "-ac", "2", "-ar", str(SR), "-"],
                         capture_output=True, check=True).stdout
    return np.clip(np.frombuffer(raw, dtype="<f4").reshape(-1, 2).astype(np.float64), -1, 1)


def n(seconds: float) -> int:
    return int(round(seconds * SR))


def rms(x: np.ndarray) -> float:
    return float(np.sqrt((x ** 2).mean()) + 1e-12)


def filt(x, kind, cutoff, order=2):
    return sosfiltfilt(butter(order, cutoff, btype=kind, fs=SR, output="sos"), x, axis=0)


def calmest(x: np.ndarray, length: float) -> np.ndarray:
    """The stretch of a long recording with the steadiest level — no gusts,
    bumps or handling noise to jump out every time the loop comes round."""
    win = n(1.0)
    k = len(x) // win
    level = 20 * np.log10(np.sqrt((x[: k * win].mean(1).reshape(k, win) ** 2).mean(1)) + 1e-9)
    span = int(np.ceil(length))
    best = min(range(0, k - span), key=lambda i: np.std(level[i : i + span]))
    return x[best * win : best * win + n(length)]


def loop_bed(x: np.ndarray) -> np.ndarray:
    """Equal-power crossfade of the FADE-second overrun into the start."""
    body, tail = x[: n(LOOP)].copy(), x[n(LOOP) : n(LOOP + FADE)]
    ramp = np.linspace(0, np.pi / 2, len(tail))[:, None]
    body[: len(tail)] = body[: len(tail)] * np.sin(ramp) + tail * np.cos(ramp)
    return body


def cut_steps(x: np.ndarray) -> list:
    """Split a walking recording into single footsteps."""
    hop = n(0.01)
    level = np.sqrt(uniform_filter1d(x.mean(1) ** 2, n(0.12)))[::hop]
    db = 20 * np.log10(level + 1e-9)
    peaks, props = find_peaks(db, distance=35, prominence=6)
    steps = []
    for i, p in enumerate(peaks):
        if props["prominences"][i] > 40:  # a digital dropout before it, not a step
            continue
        centre = p * hop
        prev_mid = (peaks[i - 1] * hop + centre) // 2 if i else 0
        next_mid = (centre + peaks[i + 1] * hop) // 2 if i + 1 < len(peaks) else len(x)
        start, end = max(prev_mid, centre - n(0.16)), min(next_mid, centre + n(0.42))
        clip = x[start:end].copy()
        if len(clip) < n(0.2) or np.abs(clip).max() > 0.97:  # too short, or clipped
            continue
        fade_in, fade_out = n(0.012), n(0.08)
        clip[:fade_in] *= np.linspace(0, 1, fade_in)[:, None]
        clip[-fade_out:] *= np.linspace(1, 0, fade_out)[:, None] ** 2
        steps.append(clip / rms(clip))
    return steps


def walk(track: np.ndarray, steps: list, start: float, count: int, level: float, pace=(1.35, 1.6)):
    """Someone strolling past: slow steps that swell and fade, drifting across."""
    time = start
    order = rng.permutation(len(steps))
    for k in range(count):
        step = steps[order[k % len(order)]]
        closeness = np.sin(np.pi * (k + 0.5) / count)  # approach, pass, leave
        gain = level * (0.6 + 0.4 * closeness) * rng.uniform(0.85, 1.05)
        pan = -0.5 + k / max(1, count - 1)  # left to right
        stereo = step * gain * np.array([np.sqrt(0.5 - pan / 2), np.sqrt(0.5 + pan / 2)]) * np.sqrt(2)
        i = n(time)
        track[i : i + len(stereo)] += stereo[: len(track) - i]
        time += rng.uniform(*pace)


def quiet_crunches(track: np.ndarray, steps: list, times: tuple, level: float):
    """Only the recorded leaf/snow crumble after a foot lands, heard at a distance."""
    for k, time in enumerate(times):
        step = steps[(k * 7 + 3) % len(steps)]
        tail = step[n(0.10):]
        gain = level * rng.uniform(0.7, 1.0)
        pan = -0.25 if k % 2 else 0.25
        stereo = tail * gain * np.array([np.sqrt(0.5 - pan / 2), np.sqrt(0.5 + pan / 2)]) * np.sqrt(2)
        i = n(time)
        track[i : i + len(stereo)] += stereo[: len(track) - i]


def autumn(cache):
    bed = loop_bed(calmest(load(cache / "autumn_bed.wav"), LOOP + FADE))
    steps = cut_steps(load(cache / "leaves1.wav")) + cut_steps(load(cache / "leaves2.wav"))
    track = bed.copy()
    level = rms(bed) * 2.4
    for start, count in AUTUMN_WALKS:
        walk(track, steps, start, count, level, pace=(1.45, 1.7))
    quiet_crunches(track, steps, (13.0, 17.0, 31.5, 36.5, 54.0, 59.0), level * 0.22)
    return track


def winter(cache):
    # A far-off wind, low and soft: winter quiet, not a storm. The recording's
    # last seconds hold a gust peak, so only the first 58 s are used, played
    # forward then back to be long enough for the window.
    raw = load(cache / "wind.ogg")[: n(58)]
    raw = np.concatenate([raw, raw[::-1]])
    bed = loop_bed(filt(filt(calmest(raw, LOOP + FADE), "low", 450), "high", 60)) * 0.35
    steps = cut_steps(load(cache / "snow1.mp3")) + cut_steps(load(cache / "snow2.opus"))
    track = bed.copy()
    level = rms(bed) * 5.0
    for start, count in WINTER_WALKS:
        walk(track, steps, start, count, level, pace=(1.6, 1.9))
    quiet_crunches(track, steps, (14.0, 18.0, 33.0, 37.0, 55.0, 59.0), level * 0.18)
    return track


def spring(cache):
    return loop_bed(calmest(load(cache / "spring_birds.ogg"), LOOP + FADE))


def summer(cache):
    return loop_bed(calmest(load(cache / "waves.ogg"), LOOP + FADE))


def encode(season: str, track: np.ndarray, out_dir: Path):
    out_dir.mkdir(parents=True, exist_ok=True)
    track = track * (0.5 / (np.abs(track).max() + 1e-9))
    pcm = (np.clip(track, -1, 1) * 32767).astype("<i2").tobytes()
    base = [FFMPEG, "-hide_banner", "-f", "s16le", "-ar", str(SR), "-ac", "2", "-i", "-"]
    # Two-pass loudnorm, linear: every season lands at the same quiet level
    # (-24 LUFS) with the recording's own dynamics left alone.
    probe = subprocess.run(base + ["-af", "loudnorm=I=-24:TP=-2:LRA=15:print_format=json", "-f", "null", "-"],
                           input=pcm, capture_output=True, check=True).stderr.decode()
    m = json.loads(probe[probe.rindex("{") : probe.rindex("}") + 1])
    chain = (f"loudnorm=I=-24:TP=-2:LRA=15:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
             f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
    target = out_dir / f"season-{season}.mp3"
    subprocess.run(base + ["-loglevel", "error", "-af", chain, "-ar", str(SR), "-c:a", "libmp3lame", "-b:a", "96k", "-y", str(target)],
                   input=pcm, check=True)
    print(target.name, f"{target.stat().st_size / 1024:.0f} KB")


if __name__ == "__main__":
    cache = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / ".audio-sources"
    out_dir = Path(sys.argv[2]) if len(sys.argv) > 2 else OUT
    fetch(cache)
    for name, build in {"spring": spring, "summer": summer, "autumn": autumn, "winter": winter}.items():
        encode(name, build(cache), out_dir)
