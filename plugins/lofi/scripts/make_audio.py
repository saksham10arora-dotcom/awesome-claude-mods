"""Synthesise lofi's loops and cues from scratch (numpy only), so every sound
the mod plays is original. Writes audio/*.mp3 next to this folder.

  python3 scripts/make_audio.py
"""
import subprocess, wave
from pathlib import Path
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 44100
OUT = Path(__file__).resolve().parent.parent / "audio"
rng = np.random.default_rng(10)

def hz(midi): return 440.0 * 2 ** ((midi - 69) / 12)

def lowpass(x, f, order=4): return sosfilt(butter(order, f, "low", fs=SR, output="sos"), x)
def highpass(x, f, order=4): return sosfilt(butter(order, f, "high", fs=SR, output="sos"), x)

def rhodes(f, dur, vel=0.5):
    t = np.arange(int(dur * SR)) / SR
    env = (1 - np.exp(-t * 60)) * np.exp(-t * 1.6)
    tone = (np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t) * np.exp(-t * 4)
            + 0.12 * np.sin(2 * np.pi * 3.01 * f * t) * np.exp(-t * 7)
            + 0.5 * np.sin(2 * np.pi * f * 1.003 * t))
    trem = 1 + 0.18 * np.sin(2 * np.pi * 4.6 * t)
    return vel * env * trem * tone / 2.0

def bass(f, dur, vel=0.6):
    t = np.arange(int(dur * SR)) / SR
    env = (1 - np.exp(-t * 80)) * np.exp(-t * 1.2)
    return vel * np.tanh(1.6 * np.sin(2 * np.pi * f * t)) * env * 0.5

def kick(vel=0.9):
    t = np.arange(int(0.45 * SR)) / SR
    f = 45 + 75 * np.exp(-t * 28)
    return vel * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 9)

def snare(vel=0.45):
    t = np.arange(int(0.3 * SR)) / SR
    noise = highpass(rng.standard_normal(t.size), 1200) * np.exp(-t * 18)
    body = np.sin(2 * np.pi * 190 * t) * np.exp(-t * 25)
    return vel * lowpass(0.6 * noise + 0.5 * body, 6000)

def hat(vel=0.12, open_=False):
    t = np.arange(int((0.18 if open_ else 0.06) * SR)) / SR
    return vel * highpass(rng.standard_normal(t.size), 7000) * np.exp(-t * (14 if open_ else 70))

def bell(f, dur=1.6, vel=0.35):
    t = np.arange(int(dur * SR)) / SR
    return vel * np.exp(-t * 3.2) * (np.sin(2 * np.pi * f * t) + 0.4 * np.sin(2 * np.pi * 2.76 * f * t) * np.exp(-t * 6))

def place(buf, x, at):
    i = int(at * SR)
    if i >= len(buf): return
    n = min(len(x), len(buf) - i)
    buf[i:i + n] += x[:n]

def reverb(x, seconds=1.4, mix=0.22):
    n = int(seconds * SR)
    ir = rng.standard_normal(n) * np.exp(-np.arange(n) / SR * 4.5)
    ir = lowpass(ir, 4000)
    wet = fftconvolve(x, ir)
    wet = np.pad(wet, (0, max(0, len(x) + n - len(wet))))[: len(x) + n]
    wet /= np.max(np.abs(wet)) + 1e-9
    dry = np.concatenate([x, np.zeros(n)])
    return (1 - mix) * dry + mix * wet * np.max(np.abs(x))

def crackle(n, level):
    c = np.zeros(n)
    pops = rng.integers(0, n, int(n / SR * 9))
    c[pops] = rng.uniform(-1, 1, pops.size)
    c = lowpass(c, 5000) * 3 + lowpass(rng.standard_normal(n), 3000) * 0.04
    return level * c

# Dm9 - G13 - Cmaj9 - Am9, voiced low
CHORDS = [[50, 53, 57, 60, 64], [43, 53, 57, 59, 64], [48, 52, 55, 59, 62], [45, 48, 52, 55, 59]]
ROOTS = [38, 31, 36, 33]

def loop(bpm, name, drums, hats_per_beat, arp, bright):
    beat = 60 / bpm
    bar = 4 * beat
    bars = 8
    total = bars * bar
    tail = 2.0
    buf = np.zeros(int((total + tail) * SR))
    swing = 0.58
    for b in range(bars):
        ch = CHORDS[b % 4]
        t0 = b * bar
        for k, m in enumerate(ch):  # a slightly rolled chord
            place(buf, rhodes(hz(m + 12), bar * 1.1, 0.32), t0 + k * 0.018)
        place(buf, rhodes(hz(ch[2] + 12), beat * 1.4, 0.18), t0 + 2.5 * beat)
        if arp:
            for i, m in enumerate([ch[1], ch[3], ch[4], ch[3]] * 2):
                at = t0 + i * beat / 2 + (beat / 2 * (swing - 0.5) * 2 if i % 2 else 0)
                place(buf, rhodes(hz(m + 24), beat * 0.6, 0.10), at)
        place(buf, bass(hz(ROOTS[b % 4]), beat * 2.6), t0)
        place(buf, bass(hz(ROOTS[b % 4] + 7), beat * 1.2, 0.4), t0 + 2.75 * beat)
        for q in range(4):
            at = t0 + q * beat
            if drums >= 1 and q in (0,):
                place(buf, kick(0.85), at)
            if drums >= 2 and q == 2:
                place(buf, kick(0.6), at + beat * 0.5)
            if drums >= 1 and q in (1, 3):
                place(buf, snare(0.38 if drums >= 2 else 0.2), at)
            for h in range(hats_per_beat):
                off = h / hats_per_beat * beat
                if h % 2 == 1: off += (swing - 0.5) * beat / hats_per_beat * 2
                place(buf, hat(0.10 if h % 2 else 0.14), at + off)
    mix = reverb(buf, mix=0.2)
    n = int(total * SR)
    out = mix[:n].copy()
    out[: len(mix) - n] += mix[n:]  # wrap the tail onto the start: a seamless loop
    out += crackle(n, 0.05)
    out = lowpass(out, bright)
    out = np.tanh(out * 1.4) / np.tanh(1.4)
    out /= np.max(np.abs(out)) + 1e-9
    stereo = np.stack([out, np.roll(out, int(0.012 * SR))], 1) * 0.85
    write(name, stereo)

def cue(name, notes, step, vel=0.35, kind="bell"):
    buf = np.zeros(int((len(notes) * step + 2.2) * SR))
    for i, m in enumerate(notes):
        x = bell(hz(m), vel=vel) if kind == "bell" else rhodes(hz(m), 1.8, vel)
        place(buf, x, i * step)
    buf = reverb(buf, mix=0.25)
    buf = lowpass(buf, 7000)
    buf /= np.max(np.abs(buf)) + 1e-9
    write(name, np.stack([buf, np.roll(buf, int(0.01 * SR))], 1) * 0.8)

def write(name, stereo):
    OUT.mkdir(exist_ok=True)
    wav = OUT / f"{name}.wav"
    pcm = (np.clip(stereo, -1, 1) * 32767).astype(np.int16)
    with wave.open(str(wav), "wb") as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(wav), "-b:a", "128k", str(OUT / f"{name}.mp3")], check=True)
    wav.unlink()
    print(f"{name}.mp3  {len(stereo) / SR:.1f}s")

loop(70, "calm", drums=1, hats_per_beat=0, arp=False, bright=3200)
loop(80, "focus", drums=2, hats_per_beat=2, arp=False, bright=4500)
loop(90, "flow", drums=2, hats_per_beat=4, arp=True, bright=6000)
cue("pass", [72, 76, 79, 84], 0.11)
cue("fail", [51, 48], 0.28, vel=0.45, kind="rhodes")
cue("done", [60, 64, 67, 71, 74], 0.03, vel=0.3, kind="rhodes")
