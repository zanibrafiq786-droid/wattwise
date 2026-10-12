# Accuracy

**Not generated yet -- this needs the real ESP32 running in the actual room.** No numbers are
invented here; this file is overwritten automatically once real trials are run.

Run this with the firmware live and `brain/chat_worker.py` (or at least the ESP32 -> Firebase
path) working:

```
cd brain
python accuracy.py              # 20 trials, CLAUDE.md's minimum
```

It will walk you through 20 labelled setups (empty / sitting / walking, fan on/off), read what
`/room1/state` actually reports after each one, and overwrite this file with the real accuracy
percentage and a confusion matrix -- see `accuracy.py`'s docstring for exactly how it works and
why presence is tested end-to-end (the firmware decides presence itself; there's no separate
Python classifier in this architecture to unit-test in isolation).
