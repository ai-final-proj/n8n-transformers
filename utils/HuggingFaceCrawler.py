"""
Robust Hugging Face model crawler that avoids hard failures.

- get_text_generation_models(): returns a list of model IDs suitable for
  text generation, using multiple strategies and safe fallbacks.
- Internally may try InferenceClient.list_deployed_models when available,
  then fall back to HfApi.list_models (grouped by pipeline_tag).
- Handles missing package, network failures, and API changes gracefully.

When executed as a script, prints discovered text generation models.
"""

from __future__ import annotations

from typing import Dict, List, Optional


def get_models_grouped_by_task(frameworks: Optional[str] = None) -> Dict[str, List[str]]:
    """Return a mapping of task -> list of model IDs.

    Prefers InferenceClient.list_deployed_models when available. If that
    isn't available or fails (e.g., due to API changes or missing auth),
    falls back to HfApi.list_models and groups by each model's pipeline_tag.

    Always returns a dict (possibly empty) instead of raising.
    """

    # Try using InferenceClient if available
    try:
        from huggingface_hub import InferenceClient  # type: ignore

        client = InferenceClient()
        if hasattr(client, "list_deployed_models"):
            try:
                if frameworks is None:
                    models_by_task = client.list_deployed_models()  # type: ignore[attr-defined]
                else:
                    models_by_task = client.list_deployed_models(frameworks=frameworks)  # type: ignore[attr-defined]

                # Ensure the structure is a dict[str, list[str]]
                if isinstance(models_by_task, dict):
                    normalized: Dict[str, List[str]] = {}
                    for task, model_list in models_by_task.items():
                        if not isinstance(model_list, list):
                            continue
                        normalized[str(task)] = [str(m) for m in model_list]
                    return normalized
            except Exception:
                # Fall back below
                pass
    except Exception:
        # huggingface_hub not installed or import failed; fall back below
        pass

    # Fallback: use HfApi and group by pipeline_tag
    try:
        from huggingface_hub import HfApi  # type: ignore

        api = HfApi()
        # Limit for safety; adjust if you need more coverage.
        # This avoids very long network calls and keeps memory bounded.
        models = api.list_models(limit=1000)

        grouped: Dict[str, List[str]] = {}
        for info in models:
            try:
                task = getattr(info, "pipeline_tag", None)
                model_id = getattr(info, "modelId", None)
                if not task or not model_id:
                    continue
                grouped.setdefault(task, []).append(model_id)
            except Exception:
                continue
        return grouped
    except Exception:
        # Final safety net: return empty mapping on any failure
        return {}


def get_text_generation_models(limit: int = 1000) -> List[str]:
    """Return a list of text-generation-capable model IDs.

    Strategy:
    1) Try InferenceClient.list_deployed_models(frameworks="text-generation-inference")
       and gather models under tasks like "text-generation"/"text2text-generation".
    2) Fallback to HfApi.list_models with ModelFilter if available, otherwise
       list_models() and filter by `pipeline_tag`.

    Always returns a list (possibly empty) instead of raising.
    """

    # Acceptable pipeline tags for text generation tasks
    text_gen_tasks = {
        "text-generation",
        "text2text-generation",
        "chat-completion",
        "conversational",
    }

    # 1) Try InferenceClient on the text-generation-inference framework
    try:
        from huggingface_hub import InferenceClient  # type: ignore

        client = InferenceClient()
        if hasattr(client, "list_deployed_models"):
            try:
                models_by_task = client.list_deployed_models(frameworks="text-generation-inference")  # type: ignore[attr-defined]
                if isinstance(models_by_task, dict):
                    candidates: List[str] = []
                    for task, model_list in models_by_task.items():
                        if str(task) in text_gen_tasks and isinstance(model_list, list):
                            candidates.extend(str(m) for m in model_list)
                    if candidates:
                        # Deduplicate preserving order
                        seen = set()
                        uniq = []
                        for m in candidates:
                            if m not in seen:
                                seen.add(m)
                                uniq.append(m)
                        return uniq[:limit]
            except Exception:
                pass
    except Exception:
        pass

    # 2) Fallback to HfApi
    try:
        from huggingface_hub import HfApi  # type: ignore
        api = HfApi()

        # Prefer ModelFilter if available to query specific tasks
        try:
            from huggingface_hub import ModelFilter  # type: ignore

            candidates: List[str] = []
            for t in ("text-generation", "text2text-generation"):
                try:
                    filt = ModelFilter(task=t)
                    for info in api.list_models(filter=filt, limit=limit):
                        mid = getattr(info, "modelId", None)
                        if mid:
                            candidates.append(mid)
                except Exception:
                    continue

            # Deduplicate preserving order
            seen = set()
            uniq = []
            for m in candidates:
                if m not in seen:
                    seen.add(m)
                    uniq.append(m)
            if uniq:
                return uniq[:limit]
        except Exception:
            # Fallback when ModelFilter is unavailable
            pass

        # Last resort: list a broader set and filter by pipeline_tag locally
        try:
            models = api.list_models(limit=limit)
            filtered: List[str] = []
            for info in models:
                try:
                    task = getattr(info, "pipeline_tag", None)
                    mid = getattr(info, "modelId", None)
                    if mid and task in text_gen_tasks:
                        filtered.append(mid)
                except Exception:
                    continue
            # Deduplicate preserving order
            seen = set()
            uniq = []
            for m in filtered:
                if m not in seen:
                    seen.add(m)
                    uniq.append(m)
            return uniq
        except Exception:
            return []
    except Exception:
        return []


def main() -> None:
    models = get_text_generation_models()
    if models:
        print("Text generation models:")
        for m in models:
            print(f"- {m}")
    else:
        print("No text generation models found or unable to fetch models.")


if __name__ == "__main__":
    main()
