"""First-run seed prompts. Edit freely; they are only inserted into an empty DB."""

SEED_PROMPTS = [
    {
        "title": "代码审查：只报告问题",
        "description": "逐条列出 bug 与风险，不直接改代码",
        "category": "代码审查",
        "tags": [],
        "favorite": True,
        "content": (
            "请审查我接下来贴的代码，只报告问题，不要重写。\n\n"
            "重点检查：\n"
            "- 正确性 bug\n"
            "- 边界条件与异常处理\n"
            "- 并发与资源泄漏\n"
            "- 安全风险\n"
            "- 可读性\n\n"
            "输出格式：`[严重度 高/中/低] 位置：问题描述 → 建议`，"
            "最后给不超过 3 条最重要的改进建议。"
        ),
    },
    {
        "title": "根因分析：先假设后验证",
        "description": "定位问题时先列假设和验证方法，不急着给修复代码",
        "category": "调试排错",
        "tags": [],
        "favorite": False,
        "content": (
            "我遇到一个问题，稍后补充现象、报错和相关代码。\n\n"
            "先不要给修复代码，请：\n"
            "1. 列出 3 个最可能的根因假设，按可能性排序\n"
            "2. 对每个假设给出验证方法（命令 / 日志 / 最小复现）\n"
            "3. 等我确认假设后再给修复方案"
        ),
    },
    {
        "title": "生成单元测试：边界与异常",
        "description": "覆盖正常路径、边界值、异常路径",
        "category": "测试",
        "tags": [],
        "favorite": False,
        "content": (
            "为下面这个函数生成单元测试。\n\n"
            "要求：\n"
            "- 覆盖正常路径、边界值、异常路径\n"
            "- 每个用例名说明意图\n"
            "- 不修改被测函数\n"
            "- 只输出测试文件内容，不解释"
        ),
    },
    {
        "title": "小步安全重构",
        "description": "每次只做一类改动，保持行为不变",
        "category": "重构优化",
        "tags": [],
        "favorite": False,
        "content": (
            "对下面的代码做小步重构，保持外部行为不变。\n\n"
            "约束：\n"
            "- 每次只做一类改动，做完等我确认\n"
            "- 现有测试必须保持通过\n"
            "- 不引入新依赖\n"
            "- 说明每一步的改动理由"
        ),
    },
    {
        "title": "需求澄清：先对齐再动手",
        "description": "复述目标、列出假设与待确认问题",
        "category": "需求澄清",
        "tags": [],
        "favorite": False,
        "content": (
            "我接下来描述一个需求。在写代码前：\n"
            "1. 复述你理解的目标与成功标准\n"
            "2. 列出所有隐含假设\n"
            "3. 列出必须由我确认的问题（最多 5 个，按影响排序）\n"
            "4. 给出 2 种实现方案及取舍\n\n"
            "先不要写代码。"
        ),
    },
    {
        "title": "生成 Commit Message",
        "description": "按 Conventional Commits 生成提交信息",
        "category": "文档提交",
        "tags": [],
        "favorite": False,
        "content": (
            "根据我贴的 git diff 生成提交信息，遵循 Conventional Commits。\n\n"
            "要求：标题不超过 72 字符；正文说明动机与影响；有破坏性变更时明确标注。"
        ),
    },
]
