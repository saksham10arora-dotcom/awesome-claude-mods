#!/bin/bash
# Recreates demos/work/ (the files the recordings start from).
set -euo pipefail
cd "$(dirname "$0")"
mkdir -p work
printf 'async function getUser(id) {\n  return fetchUser(id)\n}\n' > work/api.js
python3 - <<'PY'
events = {
  1500: "2026-10-05 02:15:00 WARN worker-3 heap at 71% after loading shard 9",
  2700: "2026-10-05 02:45:00 WARN worker-3 heap at 84%, GC pauses 380ms",
  3600: "2026-10-05 03:30:00 WARN worker-3 heap at 93%, shard 17 queued (9.2 GiB)",
  4210: "2026-10-05 03:42:10 ERROR worker-3 OOMKilled while loading shard 17 (requested 9.2 GiB, limit 8 GiB)",
  4212: "2026-10-05 03:42:40 INFO supervisor restarted worker-3 (attempt 1)",
  4300: "2026-10-05 03:55:00 WARN queue backlog 1,840 batches",
  4700: "2026-10-05 04:10:00 INFO queue backlog cleared",
  5300: "2026-10-05 05:15:00 WARN db p99 latency 2.4s (normal 120ms) on orders query",
  5330: "2026-10-05 05:21:00 INFO db latency back to normal after index rebuild",
}
lines = [events.get(i, f"2026-10-05 {1 + i * 5 // 1000:02d}:{(i // 10) % 60:02d}:{i % 60:02d} INFO worker-{i % 8} processed batch {i}") for i in range(6000)]
open("work/server.log", "w").write("\n".join(lines) + "\n")
PY
echo "demos/work ready"
