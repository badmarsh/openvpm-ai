import pathlib, re

p = pathlib.Path(r"C:\Users\marek\Documents\Vet\openvpm-ai\.agents\agno\pipeline_team_os.py")
content = p.read_text(encoding="utf-8")

# 1. Add urllib.request import
content = content.replace(
    "import subprocess\nimport sys",
    "import subprocess\nimport urllib.request\nimport sys"
)

# 2. Change default model IDs to AliProxy
content = content.replace(
    'os.getenv("OPENVPM_ORCHESTRATOR_MODEL", "google-antigravity/gemini-3.8-flash")',
    'os.getenv("OPENVPM_ORCHESTRATOR_MODEL", "qwen3-max")'
)
content = content.replace(
    'os.getenv("OPENVPM_LEARNING_MODEL", "google-antigravity/gemini-3.8-flash")',
    'os.getenv("OPENVPM_LEARNING_MODEL", "qwen3-max")'
)

# 3. Rewrite make_orchestrator_model
old_orch = """def make_orchestrator_model():
    if _looks_real(os.getenv("OPENAI_API_KEY", "")):
        return OpenAIChat(id=ORCHESTRATOR_MODEL_ID)
    resolved_id = _resolve_proxy_model(ORCHESTRATOR_MODEL_ID)
    return OpenAILike(
        id=resolved_id,
        name=resolved_id,
        provider="Antigravity Proxy",
        base_url=ANTIGRAVITY_BASE,
        api_key=ANTIGRAVITY_KEY,
        timeout=90.0,
    )"""

new_orch = """def make_orchestrator_model():
    if _looks_real(os.getenv("OPENAI_API_KEY", "")):
        return OpenAIChat(id=ORCHESTRATOR_MODEL_ID)
    return OpenAILike(
        id=ORCHESTRATOR_MODEL_ID,
        name="AliProxy Orchestrator",
        provider="AliProxy",
        base_url=ALIPROXY_BASE,
        api_key=ALIPROXY_KEY,
        timeout=90.0,
    )"""
content = content.replace(old_orch, new_orch)

# 4. Rewrite make_learning_model
old_learn = """def make_learning_model():
    if _looks_real(os.getenv("OPENAI_API_KEY", "")):
        return OpenAIChat(id=LEARNING_MODEL_ID)
    resolved_id = _resolve_proxy_model(LEARNING_MODEL_ID)
    return OpenAILike(
        id=resolved_id,
        name=resolved_id,
        provider="Antigravity Proxy",
        base_url=ANTIGRAVITY_BASE,
        api_key=ANTIGRAVITY_KEY,
        timeout=90.0,
    )"""

new_learn = """def make_learning_model():
    if _looks_real(os.getenv("OPENAI_API_KEY", "")):
        return OpenAIChat(id=LEARNING_MODEL_ID)
    return OpenAILike(
        id=LEARNING_MODEL_ID,
        name="AliProxy Learning",
        provider="AliProxy",
        base_url=ALIPROXY_BASE,
        api_key=ALIPROXY_KEY,
        timeout=90.0,
    )"""
content = content.replace(old_learn, new_learn)

# 5. Rewrite make_qwen_model - remove Antigravity fallback
old_qwen = """def make_qwen_model():
    if _looks_real(os.getenv("DASHSCOPE_API_KEY", "")) and not os.getenv("ALIPROXY_BASE_URL"):
        return OpenAIChat(
            id=QWEN_CODER_MODEL_ID,
            base_url=os.getenv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            api_key=os.getenv("DASHSCOPE_API_KEY"),
        )
    if _looks_real(ANTIGRAVITY_KEY):
        resolved_id = _resolve_proxy_model(QWEN_CODER_MODEL_ID)
        return OpenAILike(
            id=resolved_id,
            name=resolved_id,
            provider="Antigravity Proxy",
            base_url=ANTIGRAVITY_BASE,
            api_key=ANTIGRAVITY_KEY,
            timeout=90.0,
        )
    return OpenAILike(
        id="qwen-coder-plus",
        name="AliProxy Qwen Coder Plus",
        provider="AliProxy",
        base_url=ALIPROXY_BASE,
        api_key=ALIPROXY_KEY,
    )"""

new_qwen = """def make_qwen_model():
    if _looks_real(os.getenv("DASHSCOPE_API_KEY", "")) and not os.getenv("ALIPROXY_BASE_URL"):
        return OpenAIChat(
            id=QWEN_CODER_MODEL_ID,
            base_url=os.getenv("QWEN_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1"),
            api_key=os.getenv("DASHSCOPE_API_KEY"),
        )
    return OpenAILike(
        id=QWEN_CODER_MODEL_ID,
        name="AliProxy Qwen Coder Plus",
        provider="AliProxy",
        base_url=ALIPROXY_BASE,
        api_key=ALIPROXY_KEY,
        timeout=90.0,
    )"""
content = content.replace(old_qwen, new_qwen)

p.write_text(content, encoding="utf-8")
print("DONE - all replacements applied")

