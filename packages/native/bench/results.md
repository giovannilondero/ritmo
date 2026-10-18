# Native movement benchmark

2026-10-18T05:40:34.350Z — AMD EPYC 9V74 80-Core Processor, linux, Node v24.19.0.

Minimum of 15 timed batches after 5 warm-up batches; 20 simulation ticks per batch. Setup, rendering and snapshots are excluded. Node and interpreted QuickJS use the original object-storage bundle; the native run must execute C kernels. This measures numeric movement, not the entire top-down game.

| Entities | Node JIT ms/frame | QuickJS interpreted ms/frame | Native C ms/frame |
| --- | ---: | ---: | ---: |
| 1000 | 0.0489 | 1.2370 | 0.0344 |
| 5000 | 0.2712 | 6.7541 | 0.0817 |
| 10000 | 0.4263 | 17.4527 | 0.1416 |

Reproduce: `node --import tsx scripts/native-bench.ts`. Results compare only on this machine.
