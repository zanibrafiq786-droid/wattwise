"""Synthesises a 45 s music bed for the WattWise ad (no external service:
the music APIs were unavailable). Warm electronic at 110 BPM: soft kick,
off-beat hats, sub bass, detuned pad chords with sidechain pumping, a riser
into the brand reveal and a resolved ending. Writes ../assets/music.wav."""
from pathlib import Path

import numpy as np

SR = 44100
DUR = 45.0
BPM = 110.0
BEAT = 60.0 / BPM
N = int(SR * DUR)
t_all = np.arange(N) / SR
rng = np.random.default_rng(7)


def env_adsr(n, a, d, s, r):
    e = np.ones(n) * s
    na, nd, nr = int(a * SR), int(d * SR), int(r * SR)
    na = min(na, n)
    e[:na] = np.linspace(0, 1, na, endpoint=False)
    e[na:na + nd] = np.linspace(1, s, max(0, min(nd, n - na)), endpoint=False)[: max(0, min(nd, n - na))]
    if nr:
        e[-nr:] *= np.linspace(1, 0, nr)
    return e


def lowpass(x, cutoff):
    # one-pole low-pass, run twice for a softer slope
    a = np.exp(-2 * np.pi * cutoff / SR)
    for _ in range(2):
        y = np.empty_like(x)
        acc = 0.0
        for i in range(len(x)):
            acc = (1 - a) * x[i] + a * acc
            y[i] = acc
        x = y
    return x


def saw(freq, n, detune=0.0, phase=0.0):
    t = np.arange(n) / SR
    f = freq * (1 + detune)
    return 2 * ((t * f + phase) % 1.0) - 1


def note(midi):
    return 440.0 * 2 ** ((midi - 69) / 12)


mix = np.zeros(N)
pad = np.zeros(N)
bass = np.zeros(N)
drums = np.zeros(N)

# Sections (seconds): intro 0-5.9 (hook: pad + ticking), riser into 5.9,
# drop 5.9-38.7 (full groove, small lift at 22.7), outro 38.7-45 (pad resolve).
HOOK_END, OUTRO = 5.9, 38.7

# Chords Am - F - C - G, one bar (4 beats) each.
CHORDS = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]
ROOTS = [33, 29, 36, 31]
bar = 4 * BEAT
n_bars = int(np.ceil(DUR / bar))
for b in range(n_bars):
    start = int(b * bar * SR)
    n = min(int(bar * SR), N - start)
    if n <= 0:
        break
    chord = CHORDS[b % 4]
    seg = np.zeros(n)
    for m in chord:
        for det in (-0.004, 0.0, 0.005):
            seg += saw(note(m), n, det, rng.random())
    seg *= env_adsr(n, 0.25, 0.4, 0.8, 0.35) / 9
    pad[start:start + n] += seg
    # sub bass, eighth-note pulse after the hook
    if b * bar >= HOOK_END - 0.01 and b * bar < OUTRO:
        for k in range(8):
            s = start + int(k * BEAT / 2 * SR)
            ln = int(BEAT / 2 * 0.9 * SR)
            if s + ln > N:
                break
            tt = np.arange(ln) / SR
            f = note(ROOTS[b % 4])
            wave = np.sin(2 * np.pi * f * tt) + 0.3 * np.sin(2 * np.pi * 2 * f * tt)
            bass[s:s + ln] += wave * env_adsr(ln, 0.005, 0.12, 0.6, 0.05) * 0.5

pad = lowpass(pad, 1400)

# Drums
n_beats = int(DUR / BEAT)
sidechain = np.ones(N)
for k in range(n_beats):
    tb = k * BEAT
    s = int(tb * SR)
    in_groove = HOOK_END <= tb < OUTRO
    # hook: soft heartbeat tick every beat
    if tb < HOOK_END:
        ln = int(0.05 * SR)
        tick = rng.standard_normal(ln) * np.exp(-np.linspace(0, 12, ln)) * 0.12
        drums[s:s + ln] += tick
    if in_groove:
        # kick
        ln = int(0.35 * SR)
        tt = np.arange(ln) / SR
        f = 45 + 90 * np.exp(-tt * 30)
        kick = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt * 9)
        drums[s:s + ln] += kick * 0.9
        # sidechain pump on pad
        ln2 = min(int(BEAT * SR), N - s)
        sidechain[s:s + ln2] = np.minimum(sidechain[s:s + ln2], 0.35 + 0.65 * (1 - np.exp(-np.arange(ln2) / SR * 9)))
        # off-beat hat
        hs = int((tb + BEAT / 2) * SR)
        ln = int(0.06 * SR)
        if hs + ln < N:
            hat = rng.standard_normal(ln)
            hat = hat - lowpass(hat, 6000)
            drums[hs:hs + ln] += hat * np.exp(-np.linspace(0, 10, ln)) * 0.25
        # clap on 2 and 4 after the lift
        if tb >= 22.7 and k % 2 == 1:
            ln = int(0.18 * SR)
            clap = rng.standard_normal(ln) * np.exp(-np.linspace(0, 14, ln))
            drums[s:s + ln] += (clap - lowpass(clap, 1200)) * 0.25

# Riser into the brand reveal (noise sweep 3.9 -> 5.9 s) and a soft impact.
rs, re_ = int(3.9 * SR), int(HOOK_END * SR)
noise = rng.standard_normal(re_ - rs)
noise = noise - lowpass(noise, 800)
riser = noise * np.linspace(0, 1, re_ - rs) ** 2 * 0.35
drums[rs:re_] += riser
imp_len = int(1.2 * SR)
tt = np.arange(imp_len) / SR
impact = np.sin(2 * np.pi * (40 + 60 * np.exp(-tt * 8)) * tt) * np.exp(-tt * 3.5) * 0.8
drums[re_:re_ + imp_len] += impact

pad_level = np.interp(t_all, [0, HOOK_END, 22.7, OUTRO, DUR - 1.5, DUR], [0.55, 0.8, 0.9, 0.9, 0.7, 0.0])
mix = pad * sidechain * pad_level + bass * 0.55 + drums * 0.7

# gentle fades
mix *= np.interp(t_all, [0, 0.4, DUR - 2.0, DUR], [0, 1, 1, 0])
mix = np.tanh(mix * 1.4) / np.tanh(1.4)
mix = mix / np.max(np.abs(mix)) * 0.85

out = Path(__file__).resolve().parent.parent / "assets" / "music.wav"
pcm = (mix * 32767).astype(np.int16)
stereo = np.stack([pcm, pcm], axis=1)
import wave

with wave.open(str(out), "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(stereo.tobytes())
print("music written", out, f"{DUR}s")
