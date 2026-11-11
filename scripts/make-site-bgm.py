"""Compose Pote's four original, seasonal instrumental songs.

The same short rising-and-falling greeting appears in a different instrument
and arrangement in every season.
Each song has an intro, a main theme, a contrasting middle and a return.

Render with GeneralUser GS (its license permits unrestricted music creation)
and FluidSynth 2.6.1. Neither tool nor the SoundFont is shipped with the site.
Set POTE_SOUNDFONT and POTE_FLUIDSYNTH to their local paths, then run:

    python scripts/make-site-bgm.py

Optional: pass spring, summer, autumn or winter to render one song.
SoundFont: https://github.com/mrbumpy409/GeneralUser-GS
License: https://github.com/mrbumpy409/GeneralUser-GS/blob/main/documentation/LICENSE.txt
Synth: https://www.fluidsynth.org/download/
"""

from __future__ import annotations

import os
from pathlib import Path
import random
import shutil
import struct
import subprocess
import sys
import tempfile

import imageio_ffmpeg


ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public" / "audio"
PPQ = 480
SEASONS = ("spring", "summer", "autumn", "winter")
PITCHES = {"C": 0, "C#": 1, "Db": 1, "D": 2, "D#": 3, "Eb": 3,
           "E": 4, "F": 5, "F#": 6, "Gb": 6, "G": 7, "G#": 8,
           "Ab": 8, "A": 9, "A#": 10, "Bb": 10, "B": 11}


def pitch(name: str) -> int:
    return 12 * (int(name[-1]) + 1) + PITCHES[name[:-1]]


def vlq(value: int) -> bytes:
    parts = [value & 0x7F]
    value >>= 7
    while value:
        parts.insert(0, (value & 0x7F) | 0x80)
        value >>= 7
    return bytes(parts)


class Song:
    def __init__(self, name: str, bpm: int, bars: int, beats_per_bar: int = 4):
        self.name, self.bpm, self.bars, self.beats_per_bar = name, bpm, bars, beats_per_bar
        self.parts: dict[str, tuple[int, int, int, int]] = {}
        self.events: dict[str, list[tuple[int, int, bytes]]] = {}
        self.rng = random.Random("pote-2026-" + name)

    def part(self, name: str, channel: int, program: int, volume: int, pan: int = 64):
        self.parts[name] = (channel, program, volume, pan)
        self.events[name] = []

    def note(self, part: str, bar: int, beat: float, name: str | int,
             length: float, velocity: int = 64, looseness: float = 0.012):
        channel = self.parts[part][0]
        number = pitch(name) if isinstance(name, str) else name
        start = (bar * self.beats_per_bar + beat + self.rng.uniform(-looseness, looseness)) * PPQ
        start = max(0, round(start))
        stop = round(start + length * PPQ)
        strength = min(127, max(1, velocity + self.rng.randrange(-3, 4)))
        self.events[part].append((start, 1, bytes((0x90 | channel, number, strength))))
        self.events[part].append((stop, 0, bytes((0x80 | channel, number, 0))))

    def chord(self, part: str, bar: int, beat: float, notes: list[str],
              length: float, velocity: int = 60, spread: float = 0.035):
        for index, name in enumerate(notes):
            self.note(part, bar, beat + index * spread, name, length,
                      velocity - index, looseness=0.006)

    def midi(self) -> bytes:
        end = round((self.bars * self.beats_per_bar + 2) * PPQ)
        tempo = round(60_000_000 / self.bpm)
        meta = [(0, 0, b"\xff\x51\x03" + tempo.to_bytes(3, "big")),
                (0, 1, bytes((0xFF, 0x58, 4, self.beats_per_bar, 2, 24, 8)))]
        chunks = [track_chunk(meta, end)]
        for name, (channel, program, volume, pan) in self.parts.items():
            setup = [(0, 0, bytes((0xC0 | channel, program))),
                     (0, 0, bytes((0xB0 | channel, 7, volume))),
                     (0, 0, bytes((0xB0 | channel, 10, pan))),
                     (0, 0, bytes((0xB0 | channel, 91, 55)))]
            chunks.append(track_chunk(setup + self.events[name], end))
        return b"MThd" + struct.pack(">IHHH", 6, 1, len(chunks), PPQ) + b"".join(chunks)


def track_chunk(events: list[tuple[int, int, bytes]], end: int) -> bytes:
    events = sorted(events, key=lambda event: (event[0], event[1]))
    result = bytearray()
    previous = 0
    for tick, _, data in events:
        result.extend(vlq(tick - previous))
        result.extend(data)
        previous = tick
    result.extend(vlq(max(0, end - previous)))
    result.extend(b"\xff\x2f\x00")
    return b"MTrk" + struct.pack(">I", len(result)) + bytes(result)


def harmony(song: Song, bar: int, a: list[tuple[str, list[str]]],
            b: list[tuple[str, list[str]]]) -> tuple[str, list[str], str]:
    if bar < 4:
        section, index, chords = "intro", bar, a
    elif bar < 12:
        section, index, chords = "theme", bar - 4, a
    elif bar < 20:
        section, index, chords = "middle", bar - 12, b
    else:
        section, index, chords = "return", bar - 20, a
    # Let the last chord land at home instead of restarting a hanging turnaround.
    if bar == song.bars - 1:
        index, chords = 0, a
    return *chords[index], section


def sing(song: Song, part: str, bar: int, names: list[str], pattern: int,
         velocity: int, meter: int = 4):
    rhythms = (
        ((0.5, 0.65), (1.45, 0.55), (2.15, 0.65), (3.05, 0.8)),
        ((0.25, 0.9), (1.7, 0.65), (2.8, 0.85)),
        ((0.7, 0.5), (1.35, 0.65), (2.25, 1.15)),
        ((0.0, 1.1), (1.5, 0.8), (2.65, 1.2)),
    ) if meter == 4 else (
        ((0.35, 0.7), (1.15, 0.65), (2.05, 0.85)),
        ((0.0, 1.05), (1.55, 1.1)),
        ((0.6, 0.75), (1.5, 0.6), (2.2, 0.7)),
        ((0.1, 1.2), (1.75, 0.9)),
    )
    for name, (beat, length) in zip(names, rhythms[pattern % len(rhythms)]):
        song.note(part, bar, beat, name, length, velocity)


def spring() -> Song:
    # A quiet F-major classical miniature for nylon guitar and acoustic piano.
    # Triads and chord-tone melody prevent the seconds/elevenths that clashed
    # in the former neo-soul arrangement.
    song = Song("spring", 68, 28, 3)
    song.part("guitar", 0, 24, 72, 51)
    song.part("piano", 1, 0, 72, 69)
    a = [("F2", ["F3", "A3", "C4"]), ("E2", ["E3", "G3", "C4"]),
         ("D2", ["D3", "F3", "A3"]), ("Bb1", ["Bb2", "D3", "F3"]),
         ("G2", ["G3", "Bb3", "D4"]), ("C2", ["C3", "E3", "G3"]),
         ("A2", ["A3", "C4", "F4"]), ("C2", ["C3", "E3", "G3"])]
    b = [a[2], ("A2", ["A3", "C4", "E4"]), a[3], a[6], a[4], a[5], a[0], a[7]]
    theme = [["A4", "C5", "A4", "F4"], ["G4", "C5", "E5"],
             ["A4", "F4", "D4"], ["F4", "D4", "Bb3"],
             ["Bb4", "G4", "D4"], ["G4", "E4", "C4"],
             ["A4", "C5", "A4", "F4"], ["G4", "E4", "C4"]]
    middle = [["A4", "F4", "D4"], ["C5", "A4", "E4"],
              ["D5", "Bb4", "F4"], ["C5", "A4", "F4"],
              ["Bb4", "G4", "D4"], ["G4", "E4", "C4"],
              ["A4", "C5", "F5"], ["G4", "E4", "C4"]]
    for bar in range(song.bars):
        bass, voices, section = harmony(song, bar, a, b)
        soft = section == "intro" or bar >= 26
        picking = ((0.03, bass), (0.7, voices[0]), (1.4, voices[1]), (2.12, voices[2])) if bar % 2 == 0 else (
            (0.08, bass), (0.85, voices[1]), (1.65, voices[2]), (2.38, voices[0]))
        for step, (beat, name) in enumerate(picking):
            song.note("guitar", bar, beat, name, min(0.65 if step else 1.35, 2.94 - beat),
                      (45 if soft else 52) + (3 if step == 0 else -step), looseness=0.035)
        if section == "intro" and bar < 2:
            continue
        index = (bar - (12 if section == "middle" else 4)) % 8
        phrase = (middle if section == "middle" else theme)[index]
        if section == "intro":
            phrase = ["A4", "F4", "D4"] if bar == 2 else ["F4", "D4", "Bb3"]
        elif bar == song.bars - 1:
            phrase = ["C5", "A4", "F4"]
        rhythm = (((0.28, 0.65), (1.05, 0.64), (1.82, 0.65), (2.52, 0.64)) if bar % 2 == 0 else
                  ((0.38, 0.82), (1.4, 0.74), (2.38, 0.54)))
        if bar == song.bars - 1:
            rhythm = ((0.28, 0.8), (1.25, 0.7), (2.08, 1.8))
        for step, (name, (beat, length)) in enumerate(zip(phrase, rhythm)):
            song.note("piano", bar, beat, name, length,
                      (49 if soft else 58) + (3 if step == 0 else -2 * step), looseness=0.025)
    return song


def summer() -> Song:
    song = Song("summer", 94, 28)
    song.part("nylon", 0, 24, 79, 46)
    song.part("rhodes", 1, 4, 61, 78)
    song.part("lead", 2, 24, 76, 70)
    song.part("bass", 3, 32, 66)
    song.part("kit", 9, 0, 49)
    a = [("A2", ["C#4", "E4", "G#4", "B4"]), ("G#2", ["B3", "D4", "E4", "G#4"]),
         ("F#2", ["A3", "C#4", "E4", "A4"]), ("D2", ["F#3", "A3", "C#4", "E4"]),
         ("B2", ["D4", "F#4", "A4", "B4"]), ("E2", ["G#3", "D4", "E4", "B4"]),
         ("C#3", ["E4", "G#4", "B4", "C#5"]), ("E2", ["G#3", "D4", "E4", "B4"])]
    b = [a[3], a[4], a[0], a[2], a[3], a[5], a[6], a[7]]
    theme = [["C#5", "E5", "D5", "B4"], ["E4", "F#4", "G#4"],
             ["A4", "C#5", "B4"], ["F#4", "E4", "D4"],
             ["F#4", "A4", "B4"], ["G#4", "F#4", "E4"],
             ["G#4", "B4", "A4"], ["E4", "F#4"]]
    middle = [["F#4", "A4", "C#5"], ["B4", "A4", "F#4"],
              ["E4", "G#4", "B4"], ["A4", "C#5", "A4"],
              ["F#4", "E4", "D4"], ["G#4", "B4", "A4"],
              ["C#5", "E5", "D5", "B4"], ["B4", "A4"]]
    for bar in range(song.bars):
        bass, voices, section = harmony(song, bar, a, b)
        quiet = section == "intro" or bar >= 26
        for beat in (0.45, 1.45, 2.45, 3.45):
            song.chord("nylon", bar, beat, voices[1:], 0.42, 47 if quiet else 55, 0.017)
        if bar % 2 == 0 and not quiet:
            song.chord("rhodes", bar, 0.02, voices, 2.8, 43)
        song.note("bass", bar, 0, bass, 0.9, 48 if quiet else 57)
        song.note("bass", bar, 2.5, bass, 0.8, 43 if quiet else 51)
        if not quiet:
            for beat in (0, 2.5):
                song.note("kit", bar, beat, 35, 0.18, 30)
            for beat in (1, 3):
                song.note("kit", bar, beat, 37, 0.13, 34)
            for beat in (0.5, 1.5, 2.5, 3.5):
                song.note("kit", bar, beat, 70, 0.1, 31)
        if section != "intro" or bar >= 2:
            index = (bar - (12 if section == "middle" else 4)) % 8
            sing(song, "lead", bar, (middle if section == "middle" else theme)[index],
                 bar % 4, 57 if quiet else 64)
    return song


def autumn() -> Song:
    song = Song("autumn", 76, 24)
    song.part("piano", 0, 0, 74, 59)
    song.part("guitar", 1, 24, 62, 78)
    song.part("bass", 2, 32, 69)
    song.part("kit", 9, 0, 38)
    a = [("D2", ["F3", "A3", "C4", "E4"]), ("G2", ["F3", "B3", "D4", "E4"]),
         ("C2", ["E3", "G3", "B3", "D4"]), ("A2", ["G3", "C4", "E4", "A4"]),
         ("F2", ["A3", "C4", "E4", "G4"]), ("E2", ["G3", "B3", "D4", "F4"]),
         ("D2", ["F3", "A3", "C4", "E4"]), ("G2", ["F3", "B3", "D4", "G4"])]
    b = [a[4], a[5], a[3], a[0], a[4], a[1], a[2], a[7]]
    theme = [["E4", "G4", "F4", "D4"], ["D4", "B3", "D4"],
             ["E4", "G4", "B4"], ["A4", "G4", "E4"],
             ["G4", "A4", "C5"], ["B4", "G4", "F4"],
             ["E4", "G4", "F4", "D4"], ["D4", "C4"]]
    middle = [["A4", "C5", "B4"], ["G4", "F4", "E4"],
              ["E4", "G4", "A4"], ["F4", "E4", "D4"],
              ["A4", "G4", "E4"], ["F4", "D4", "B3"],
              ["E4", "G4", "F4", "D4"], ["D4", "C4"]]
    for bar in range(song.bars):
        bass, voices, section = harmony(song, bar, a, b)
        soft = section == "intro" or section == "return"
        song.chord("piano", bar, 0.05, voices, 2.65, 48 if soft else 56)
        if bar % 2 == 1:
            song.chord("guitar", bar, 2.55, voices[1:], 1.2, 45, 0.025)
        if section != "intro" or bar >= 2:
            song.note("bass", bar, 0, bass, 1.4, 48)
            song.note("bass", bar, 2.15, bass, 0.9, 41)
        if section in ("theme", "middle"):
            song.note("kit", bar, 0, 35, 0.16, 25)
            for beat in (1, 3):
                song.note("kit", bar, beat, 37, 0.12, 27)
            for beat in (0.5, 1.5, 2.5, 3.5):
                song.note("kit", bar, beat, 42, 0.09, 21)
        if section != "intro" or bar == 3:
            index = (bar - (12 if section == "middle" else 4)) % 8
            sing(song, "piano", bar, (middle if section == "middle" else theme)[index],
                 (bar + 1) % 4, 57 if soft else 64)
    return song


def winter() -> Song:
    song = Song("winter", 68, 24)
    song.part("piano", 0, 0, 68, 56)
    song.part("lead", 1, 0, 72, 70)
    a = [("G2", ["B3", "D4", "F#4", "A4"]), ("D2", ["A3", "D4", "F#4", "A4"]),
         ("E2", ["G3", "B3", "D4", "F#4"]), ("C2", ["G3", "B3", "E4", "G4"]),
         ("A2", ["G3", "C4", "E4", "A4"]), ("D2", ["A3", "C4", "F#4", "A4"]),
         ("G2", ["B3", "D4", "F#4", "A4"]), ("D2", ["A3", "C4", "F#4", "A4"])]
    b = [a[2], a[3], a[4], a[1], a[2], a[5], a[0], a[7]]
    theme = [["B4", "D5", "B4", "G4"], ["A4", "F#4"],
             ["G4", "B4", "D5"], ["E5", "G4"],
             ["C5", "A4", "E4"], ["A4", "F#4"],
             ["B4", "D5", "B4", "G4"], ["A4", "F#4"]]
    middle = [["G4", "B4", "D5"], ["E5", "G4"],
              ["C5", "E5", "A4"], ["A4", "F#4"],
              ["B4", "D5", "E5"], ["C5", "A4"],
              ["B4", "D5", "B4", "G4"], ["A4", "F#4"]]
    for bar in range(song.bars):
        bass, voices, section = harmony(song, bar, a, b)
        soft = section in ("intro", "return")
        # One piano, two hands. The fifth and chord arrive slightly after the
        # bass instead of repeating a quantized waltz figure in every bar.
        song.note("piano", bar, 0.04, bass, 2.8, 39 if soft else 45, looseness=0.035)
        if bar % 2 == 1 or section == "middle":
            song.note("piano", bar, 2.45, pitch(bass) + 7, 1.28,
                      34 if soft else 39, looseness=0.045)
        if bar % 2 == 0 or section == "middle":
            song.chord("piano", bar, 0.94 if bar % 2 else 1.16, voices[:3],
                       2.4, 39 if soft else 44, 0.065)
        else:
            song.note("piano", bar, 1.25, voices[1], 1.85, 41, looseness=0.055)
        if section != "intro" or bar >= 2:
            index = (bar - (12 if section == "middle" else 4)) % 8
            phrase = (middle if section == "middle" else theme)[index]
            if section == "intro":
                phrase = ["G4", "B4", "D5"] if bar == 2 else ["E5", "G4"]
            elif bar == song.bars - 1:
                phrase = ["D5", "B4", "G4"]
            rhythm = (
                ((0.58, 0.72), (1.46, 0.7), (2.28, 0.7), (3.12, 0.86)),
                ((0.38, 1.45), (2.4, 1.28)),
                ((0.83, 0.82), (1.85, 0.74), (2.91, 0.98)),
                ((0.28, 1.68), (2.6, 1.15)),
            )[bar % 4]
            if bar == song.bars - 1:
                rhythm = ((0.3, 1.0), (1.55, 0.9), (2.75, 1.65))
            for step, (name, (beat, length)) in enumerate(zip(phrase, rhythm)):
                velocity = (47 if soft else 55) + (3 if step == 0 else -2 * step)
                song.note("lead", bar, beat, name, length, velocity, looseness=0.05)
    return song


def render(song: Song, sf2: Path, fluidsynth: Path):
    OUT.mkdir(parents=True, exist_ok=True)
    target = OUT / f"pote-{song.name}.mp3"
    duration = song.bars * song.beats_per_bar * 60 / song.bpm + 2.8
    with tempfile.TemporaryDirectory(prefix="pote-music-") as directory:
        midi = Path(directory) / f"{song.name}.mid"
        wav = Path(directory) / f"{song.name}.wav"
        midi.write_bytes(song.midi())
        subprocess.run([str(fluidsynth), "-ni", "-C", "0", "-R", "1", "-g", "0.32",
                        "-r", "44100", "-F", str(wav), str(sf2), str(midi)], check=True,
                       stdout=subprocess.DEVNULL)
        ffmpeg = imageio_ffmpeg.get_ffmpeg_exe()
        fade = f"afade=t=in:st=0:d=0.7,afade=t=out:st={duration-3.1:.2f}:d=3.1,loudnorm=I=-23:TP=-3:LRA=12"
        subprocess.run([ffmpeg, "-v", "error", "-y", "-i", str(wav), "-t", f"{duration:.2f}",
                        "-af", fade, "-c:a", "libmp3lame", "-b:a", "160k", str(target)], check=True)
    print(f"{song.name}: {target.name}, {duration:.1f}s, {target.stat().st_size // 1024} KiB")


def main():
    requested = sys.argv[1:] or list(SEASONS)
    if any(name not in SEASONS for name in requested):
        raise SystemExit(f"Choose any of: {', '.join(SEASONS)}")
    sf2 = Path(os.environ.get("POTE_SOUNDFONT", "")).expanduser()
    synth = Path(os.environ.get("POTE_FLUIDSYNTH", "")).expanduser()
    if not sf2.is_file():
        raise SystemExit("Set POTE_SOUNDFONT to a local GeneralUser-GS.sf2 file")
    if not synth.is_file():
        on_path = shutil.which("fluidsynth")
        if not on_path:
            raise SystemExit("Set POTE_FLUIDSYNTH to a local fluidsynth executable")
        synth = Path(on_path)
    makers = {"spring": spring, "summer": summer, "autumn": autumn, "winter": winter}
    for name in requested:
        render(makers[name](), sf2, synth)


if __name__ == "__main__":
    main()
