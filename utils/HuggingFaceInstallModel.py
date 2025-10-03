"""
HuggingFaceInstallModel: Download a Hugging Face model locally for use with TGI.

Usage examples
- Basic:         python utils/HuggingFaceInstallModel.py --model-id defog/sqlcoder-8b-2
- With dest dir: python utils/HuggingFaceInstallModel.py --model-id defog/sqlcoder-8b-2 --dest /models/sqlcoder-8b-2
- With token:    HF_TOKEN=xxxx python utils/HuggingFaceInstallModel.py --model-id defog/sqlcoder-8b-2

Notes
- If the model is gated, accept its terms on the Hub and use a valid token
  (via env var HF_TOKEN or --token).
- This script uses snapshot_download to create a local, non-symlinked copy
  under --dest. If --dest is omitted, it defaults to ./models/<model-id>.
- After download, you can serve it with TGI:
  docker run --gpus all --shm-size 1g -p 8080:80 \
    -v /models/sqlcoder-8b-2:/data \
    ghcr.io/huggingface/text-generation-inference:2.1.0 \
    --model-id /data
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Download a Hugging Face model locally (no symlinks) for use with TGI.",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter,
    )
    p.add_argument("--model-id", required=True, help="Model ID on Hugging Face Hub, e.g., defog/sqlcoder-8b-2")
    p.add_argument("--dest", default=None, help="Destination directory to place the model files")
    p.add_argument("--token", default=None, help="Hugging Face token (falls back to HF_TOKEN env var)")
    p.add_argument("--revision", default=None, help="Specific revision (branch/tag/commit) to download")
    p.add_argument(
        "--use-symlinks",
        action="store_true",
        help="Use symlinks instead of copying files into dest (not recommended for Docker volume mounts)",
    )
    return p.parse_args()


def snapshot_download_compat(repo_id: str, *, token: str | None, local_dir: str, local_dir_use_symlinks: bool, revision: str | None) -> str:
    try:
        from huggingface_hub import snapshot_download  # type: ignore
    except Exception as e:
        raise RuntimeError(
            "huggingface_hub is not installed. Install with: pip install --upgrade huggingface_hub"
        ) from e

    try:
        path = snapshot_download(
            repo_id=repo_id,
            token=token,
            local_dir=local_dir,
            local_dir_use_symlinks=local_dir_use_symlinks,
            revision=revision,
        )
        return path
    except TypeError:
        # Older huggingface_hub versions use use_auth_token
        path = snapshot_download(
            repo_id=repo_id,
            use_auth_token=token,  # type: ignore[arg-type]
            local_dir=local_dir,
            local_dir_use_symlinks=local_dir_use_symlinks,
            revision=revision,
        )
        return path


def main() -> int:
    args = parse_args()

    model_id = args["model_id"] if isinstance(args, dict) else args.model_id
    token = args["token"] if isinstance(args, dict) else args.token
    revision = args["revision"] if isinstance(args, dict) else args.revision
    use_symlinks = args["use_symlinks"] if isinstance(args, dict) else args.use_symlinks

    if not token:
        token = os.environ.get("HF_TOKEN")

    if args.dest:
        dest_dir = Path(args.dest)
    else:
        safe_model_id = model_id.replace("/", os.sep)
        dest_dir = Path("./models") / safe_model_id

    try:
        dest_dir.mkdir(parents=True, exist_ok=True)
    except Exception as e:
        print(f"[ERROR] Could not create destination directory '{dest_dir}': {e}", file=sys.stderr)
        return 1

    print(f"[INFO] Downloading model '{model_id}' → '{dest_dir}' (symlinks={'on' if use_symlinks else 'off'})")
    if token:
        print("[INFO] Using authentication token (HF_TOKEN).")
    else:
        print("[WARN] No token provided. Public models will work; gated models will fail.")

    try:
        local_path = snapshot_download_compat(
            repo_id=model_id,
            token=token,
            local_dir=str(dest_dir),
            local_dir_use_symlinks=use_symlinks,
            revision=revision,
        )
    except Exception as e:
        print(f"[ERROR] Download failed: {e}", file=sys.stderr)
        print("\nTroubleshooting:\n- Ensure you accepted the model's terms on the Hub.\n- Provide a valid token via --token or HF_TOKEN env var.\n- If behind a proxy, configure your environment accordingly.")
        return 1

    print(f"\n[SUCCESS] Model downloaded to: {local_path}")
    print(
        "\nNext steps (serve with TGI):\n"
        "  docker run --gpus all --shm-size 1g -p 8080:80 \\\n+\n    -v {lp}:/data \\\n+\n    ghcr.io/huggingface/text-generation-inference:2.1.0 \\\n+\n    --model-id /data\n".format(lp=str(dest_dir.resolve()))
    )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

