---
name: "cloud-gpu-vllm-uncensored"
description: >-
  Rent a cloud GPU and serve a large uncensored or abliterated open LLM via vLLM using an OpenAI-compatible server, then connect it to a chat GUI such as Cherry Studio. Use when choosing a model and GPU, writing the vLLM start command, or debugging a RunPod/vLLM pod that will not start, loads slowly, or runs slowly.
---

# Cloud GPU + vLLM for big uncensored LLMs

Goal: rent a GPU, serve an uncensored open model with vLLM, connect a chat GUI. User is RU-speaking, cares about **Russian quality**, runs **Cherry Studio**, pays RunPod with foreign USD/EUR cards. Local memory: see `cloud_gpu_inference.md`. Redeploy recipes: `~/Documents/billynotes/runpod-vllm-uncensored.md` and `runpod-gpt-oss-120b-h100.md`.

## 0. THE most important rule: GPU arch ↔ quant kernel

A model's quant format must have a kernel for the GPU's compute capability. This is the #1 cause of "won't start".

| Arch | Cards | cap | Quant kernels that work in vLLM |
|---|---|---|---|
| **Ampere** | A100, A40, A6000, RTX 3090 | 8.0 / 8.6 | AWQ (asymmetric / `uint4b8`), GPTQ, **compressed-tensors** via **Marlin**; FP8(W8). **group_size must divide layer dims (128/64/-1).** |
| **Hopper** | H100, H200, GH200 | 9.0 | all Ampere + **MXFP4** + **Machete/Cutlass W4** (handle odd dims, e.g. vision towers) |
| **Blackwell** | B200, GB200, RTX 50xx, RTX PRO 6000 | 10.0 / 12.0 | all + **NVFP4 W4A4** native |

Derived rules (each cost hours to learn):
- **MXFP4 = Hopper+ only.** gpt-oss-120b (MXFP4) runs on H100, **NOT A100** (no Ampere MXFP4 kernel).
- **NVFP4: W4A16 runs Ampere/Hopper via Marlin** (`float4_e2m1f` is supported even sm_86); **W4A4 = Blackwell-only** (needs HW FP4 activations). Check the model card for W4A16 vs W4A4.
- **Marlin rejects symmetric AWQ `uint4` with `zero_point=false`** (AutoRound quants) on Ampere → `Marlin does not support weight_bits=uint4 ... zp=False`. Use a **compressed-tensors** quant of the same model instead (sym int4 → maps to supported `uint4b8`).
- **Marlin needs layer dims divisible by 128.** Multimodal models (Qwen3.5/3.6 with vision towers) sometimes quantize a vision-MLP layer with a non-divisible dim (e.g. 4304) → `Failed to find a kernel for WNA16` on Ampere → **needs Hopper** (Machete/Cutlass). Text-only models avoid this entirely.
- **AWQ quant_method requires `--dtype float16`** (bf16 rejected at config validation). compressed-tensors accepts bf16 (but `--dtype float16` is harmless/safe).

## 1. Quant format → engine

- **vLLM serves:** AWQ, GPTQ, compressed-tensors, FP8, MXFP4, (NVFP4). Look for `.safetensors`.
- **vLLM does NOT serve:** **GGUF** (→ llama.cpp) or **MLX** (→ Apple Silicon only). Big abliterated MoEs (Qwen3-235B, GLM-4.6/4.7-355B, DeepSeek-V3) are mostly **GGUF-only → not runnable in vLLM** on these cards.
- Trap: `numen-tech/*w4a16` = OmniQuant for the Private-LLM app, not vLLM.

## 2. Verified WORKING model + config recipes (2026-05)

All on `vllm/vllm-openai:latest`, HTTP port `8000`, env `HF_TOKEN=<token>` (faster/unthrottled download). API key `--api-key sk-...`.

### Big on 1× H100 80GB (~$3.29/h) — reasoning/code, weak RU
`justinjja/gpt-oss-120b-Derestricted-MXFP4` (62GB MXFP4, 120B/5.1B-act, native 128K, gpt_oss arch). Disk 80GB.
```
--host 0.0.0.0 --port 8000 --model justinjja/gpt-oss-120b-Derestricted-MXFP4 --max-model-len 131072 --gpu-memory-utilization 0.95 --kv-cache-dtype fp8 --api-key sk-...
```
No `--trust-remote-code`/`--dtype`/allow-long (all native). If fp8 errors on gpt-oss "sinks" attention → drop `--kv-cache-dtype fp8`.

### Biggest on 2× A100 80GB (~$2.98/h) — ~230B
`lhca521/MiniMax-M2.7-abliterated-heretic-ara-AWQ` (119.8GB, ~230B/10B-act, compressed-tensors, native 192K, minimax_m2 custom_code). Disk 140GB. **DO NOT add `--enforce-eager`** (it's ~2× slower; compile works fine).
```
--host 0.0.0.0 --port 8000 --model lhca521/MiniMax-M2.7-abliterated-heretic-ara-AWQ --tensor-parallel-size 2 --max-model-len 131072 --gpu-memory-utilization 0.92 --kv-cache-dtype fp8 --trust-remote-code --api-key sk-...
```

### Best on 1× A100 80GB (~$1.49/h) — best Russian, fast, proven
`ArtusDev/nbeerbower_EVA-abliterated-TIES-Qwen2.5-72B-AWQ` (41.5GB, dense 72B, AWQ zero_point=true, native 128K; EVA = creative/RP, very uncensored, top RU). Disk 60GB.
```
--host 0.0.0.0 --port 8000 --model ArtusDev/nbeerbower_EVA-abliterated-TIES-Qwen2.5-72B-AWQ --dtype float16 --max-model-len 131072 --gpu-memory-utilization 0.95 --kv-cache-dtype fp8 --trust-remote-code --api-key sk-...
```
Cleaner instruct alt (less flowery, better instruction-following): `ibrahimkettaneh/Qwen2.5-72B-Instruct-abliterated-AWQ`.

### Bigger MoE on 1× A100 80GB — 106B, weak RU, ≤128K tight
`cyankiwi/GLM-4.5-Air-Derestricted-AWQ-4bit` (63.4GB, glm4_moe 106B/12B-act, compressed-tensors sym g32, native 128K). Disk 90GB.
```
--host 0.0.0.0 --port 8000 --model cyankiwi/GLM-4.5-Air-Derestricted-AWQ-4bit --dtype float16 --max-model-len 131072 --gpu-memory-utilization 0.97 --kv-cache-dtype fp8 --enforce-eager --trust-remote-code --api-key sk-...
```
(here enforce-eager frees ~1.4GiB so full 128K fits the tight 80GB; drop it for speed at ~110K.) The 79GB `ArliAI/GLM-4.5-Air-Derestricted-GPTQ-W4A16` only does ≤8K — prefer this 4-bit.

### Cheap daily drivers on a 48GB card (A40 $0.44 / A6000 $0.49) — ~32B, full ctx, fast load
- `t-tech/T-pro-it-2.0-AWQ` — best pure Russian (T-Bank Qwen3-32B tune), ~19GB
- `noneUsername/Qwen3-32B-abliterated-awq` — hard abliteration / 0 refusals, ~19GB
- `abhishekchohan/Qwen3.6-35B-A3B-Abliterated-AWQ` — newest MoE, compressed-tensors, native 256K, ~21GB (worked on A40)
```
--host 0.0.0.0 --port 8000 --model <repo> --dtype float16 --max-model-len 65536 --gpu-memory-utilization 0.95 --kv-cache-dtype fp8 --trust-remote-code --api-key sk-...
```

### KNOWN-DEAD (don't waste time)
- `lhca521/Qwen3.5-122B-A10B-abliterated-AWQ` & `bjk110/...` — **dead on A100** (vision-MLP dim 4304 quantized at g128 → no Ampere kernel). Runs only on **H100**. Also native 32K (needs `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` for 128K).
- `genevera/Qwen3.6-35B-A3B-Abliterated-Heretic-AWQ-4bit` — AutoRound sym AWQ → Marlin rejects on Ampere. Use `abhishekchohan` (compressed-tensors) instead.
- `RadicalNotionAI/GLM-4.7-heretic-nvfp4` — W4A4 = Blackwell-only, 205GB, gated.
- Qwen3-235B abliterated — no AWQ/compressed-tensors exists (GGUF-only). huihui paywalled the GGUF.

## 3. RunPod deploy steps

1. **Deploy → pick GPU** (count = 1 or 2). Match VRAM to model (see §4). Watch availability (High/Medium/Low/Unavailable).
2. **Template:** edit a Pod → image `vllm/vllm-openai:latest`. (For ComfyUI/image-gen instead, pick a ComfyUI template, port 8188.)
3. **Container disk** = model size + ~15-25GB headroom (local NVMe = fast load). **Network Volume** persists weights across Terminate but **cold FUSE reads are slow** — prefer container disk unless re-download cost matters.
4. **Expose HTTP port `8000`.**
5. **Env:** `HF_TOKEN=hf_...` (always — kills anonymous rate-limit). Add `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` only if forcing ctx > model's native.
6. **Container Start Command** = the vLLM args (the image entrypoint is `vllm serve`).
7. **Connect:** the proxy URL is `https://<podid>-8000.proxy.runpod.net`. Closing the browser tab does NOT stop the pod. **Stop** to pause GPU billing; **Terminate** to wipe.

### Cherry Studio
Provider type OpenAI · API Host `https://<podid>-8000.proxy.runpod.net/v1` (if 404, try with/without `/v1`) · API key = the `--api-key` value · Model = the exact repo id (served_model_name). Quick liveness: open `.../health` (200 = up) or `.../v1/models` (401 without key = also "up").

## 4. VRAM / KV / context math

- **HF file sizes are SI GB; GPU memory is GiB.** Loaded size ≈ file_GB ÷ 1.073 (e.g. 70.7GB → ~65.9GiB; 41.5GB EVA → vLLM reported 38.79GiB). A100/H100 80GB ≈ **79.3 GiB** usable.
- 4-bit weights ≈ params × ~0.55 GB.
- **KV cache per token (fp16)** = `2 × num_hidden_layers × num_key_value_heads × head_dim × 2 bytes`. **fp8 halves it.** Models with few KV-heads (e.g. 2) have tiny KV → huge ctx cheap.
- Budget: `util × 79.3 GiB − weights − ~1.5GiB(graphs, unless --enforce-eager) − ~1-2GiB activation` = KV pool. Divide by per-token KV → max tokens.
- `--kv-cache-dtype fp8` ≈ 2× context. `--tensor-parallel-size 2` splits weights+KV across 2 cards AND ~2× memory bandwidth (faster decode).
- **Context:** check config `max_position_embeddings`. If you ask more than native → vLLM errors unless `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` (high rope_theta Qwen usually tolerates; else YaRN via `--hf-overrides '{"rope_scaling":{"rope_type":"yarn","factor":N,"original_max_position_embeddings":M}}'`, quality softens past native).
- Rule of thumb: **a 4-bit ~120B fits 1×80GB at ≤128K (fp8 KV); 256K needs 2 cards.** 230B needs 2 cards.

## 5. Debugging playbook (the hours-savers)

- **"It's stuck/hung" on load is usually NOT a hang.** vLLM's shard-download progress (`Time spent downloading weights: Ns`) and the tqdm `Loading safetensors shards` bar don't stream to RunPod logs until done. A ~120GB anonymous download takes **~12 min**; cold FUSE-volume reads are slow too. Telltale of *real* progress: VRAM climbing in `nvidia-smi` / Telemetry. **Fixes:** set `HF_TOKEN`; create a **fresh pod from scratch** (often loads chunks much faster); `--safetensors-load-strategy=prefetch` for FUSE volumes.
- **`--enforce-eager` is a speed trap** (~2× slower — disables CUDA graphs). Don't add it by default. Only use it if torch.compile/graph-capture genuinely hangs (rare; most "compile hangs" were actually slow loads). It IS legit to squeeze a tight 80GB fit (frees ~1.4GiB).
- **`RuntimeError: Engine core initialization failed. See root cause above`** = wrapper. The REAL error is higher up — scroll/grep for the `(EngineCore ...) ERROR ... <ExceptionType>:` line.
- **`ValueError: Free memory on device cuda:0 (X/79 GiB) < desired`** = a stale process from a previous crash still holds VRAM. Fix: full **Stop** (not a command re-run) then Start, or in terminal `pkill -9 -f vllm; sleep 3; nvidia-smi` (expect ~0 MiB).
- **`torch.bfloat16 is not supported for quantization method awq`** → add `--dtype float16`.
- **`max_model_len > derived max`** → `VLLM_ALLOW_LONG_MAX_MODEL_LEN=1` env (or lower `--max-model-len`).
- **`Failed to find a kernel ... WNA16` / `Marlin ... not divisible` / `requires capability 90`** → quant/arch incompatible with this GPU (see §0). Switch quant uploader (compressed-tensors), switch model, or move to Hopper.
- **Diagnostics (RunPod → Connect → Web Terminal):**
  - `nvidia-smi` (run 2-3×: VRAM climbing = loading; util/PIDs)
  - `curl -s http://localhost:8000/health` (up?) / `.../v1/models`
  - `pip install py-spy -q && py-spy dump --pid <Worker PID>` → stack shows where stuck: `safetensors`/`_read`=loading, `marlin`/`process_weights`=repack, `nccl`/`barrier`=TP deadlock, `inductor`/`compile`=compiling
  - `find /workspace -name "*.incomplete"` → interrupted download

## 6. Finding models (HF)

- **Web filter:** Other tab → app **`vLLM`** + **`4-bit precision`**; keyword `abliterated`/`heretic`/`uncensored`. Avoid `gguf`/`mlx` tags.
- **Decensor quality:** Heretic (lowest-damage, automated) ≈ norm-preserving biprojected > classic abliteration (huihui) > Dolphin fine-tune. UGI Leaderboard (DontPlanToEnd) for willingness ranking.
- **HF MCP** (if configured): `hub_repo_search` (query + sort trendingScore/createdAt) → `hub_repo_details` for params/tags → fetch `config.json` for `max_position_embeddings`, `num_key_value_heads`, `head_dim`, and `quantization_config` (`quant_method`, `group_size`, `symmetric`/`zero_point`). Always verify file **tree** for real GB + gated status before recommending.

## 7. RunPod pricing (May 2026, on-demand $/h)

A40 48GB 0.44 · A6000 48GB 0.49 · L40S 48GB 0.86 · RTX 4090 24GB 0.69 · RTX 5090 32GB 0.99 · **A100 PCIe 80GB 1.39 · A100 SXM 80GB 1.49** · **H100 PCIe 80GB 2.89 · H100 NVL 94GB 3.19 · H100 SXM 80GB 3.29** · H200 SXM 141GB 4.39 · B200 180GB 5.89 · MI300X 192GB 1.99. Per-second billing.
Value note: 1× H100 ($3.29) costs MORE than 2× A100 ($2.98) — only pick H100 when you specifically need MXFP4/Machete (gpt-oss, Qwen3.5-122B vision). Payment from Russia: foreign card works on RunPod; otherwise USDT/crypto on Vast/Akash.

## 8. Quick chooser

- Cheapest decent uncensored + great RU → **T-pro-it-2.0-AWQ or Qwen3-32B-abliterated-awq on A40 48GB**.
- Best 1-card all-rounder + top RU → **EVA-Qwen2.5-72B on 1× A100**.
- Biggest that runs → **MiniMax-M2.7 230B on 2× A100** (no enforce-eager).
- Reasoning/code, RU doesn't matter → **gpt-oss-120b MXFP4 on 1× H100**.
- Don't chase >230B uncensored for vLLM — it doesn't exist (GGUF/Blackwell only). MoE with low active params (e.g. 3B) feels "dumb"; prefer dense or higher-active.
