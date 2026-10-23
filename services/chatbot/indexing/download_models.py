"""Download immutable, official model revisions into the project runtime."""
import os
from pathlib import Path

os.environ["HF_HUB_DISABLE_XET"] = "1"
os.environ["HF_HUB_DOWNLOAD_TIMEOUT"] = "120"
from huggingface_hub import snapshot_download

ROOT = Path(__file__).resolve().parent
MODELS = [
    ("BAAI/bge-m3", "5617a9f61b028005a4858fdac845db406aefb181", "embedding"),
    ("BAAI/bge-reranker-v2-m3", "953dc6f6f85a1b2dbfca4c34a2796e7dde08d41e", "reranker"),
    ('MoritzLaurer/mDeBERTa-v3-base-mnli-xnli','8adb042d524ecd5c26d3e3ba0e3fbcf7e2d0864c','verifier'),
    ('Qwen/Qwen2.5-7B-Instruct','a09a35458c702b33eeacc393d103063234e8bc28','generator-tokenizer'),
    ('Qwen/Qwen3-4B-Instruct-2507','cdbee75f17c01a7cc42f958dc650907174af0554','generator-tokenizer-qwen3'),
]
for model, revision, folder in MODELS:
    print(f"Downloading {model}@{revision}", flush=True)
    patterns=["config.json", "model.safetensors", "pytorch_model.bin",
                                      "tokenizer.json", "tokenizer_config.json", "sentencepiece.bpe.model",
                                      'spm.model',"special_tokens_map.json",'merges.txt','vocab.json']
    if folder.startswith('generator-tokenizer'):
        patterns=[p for p in patterns if p not in ('model.safetensors','pytorch_model.bin')]
    snapshot_download(model, revision=revision, local_dir=ROOT / "models" / folder,
                      allow_patterns=patterns, max_workers=4)
    print(f"Ready: {folder}", flush=True)
