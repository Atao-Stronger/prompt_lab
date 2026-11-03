"""First-run seed prompts. Edit freely; they are only inserted into an empty DB."""

SEED_PROMPTS = [
    {
        "title": "代码审查：只报告问题",
        "description": "逐条列出 bug 与风险，不直接改代码",
        "category": "代码审查",
        "tags": ["review", "通用"],
        "favorite": True,
        "content": (
            "你是一位严格的高级工程师。审查以下代码，只报告问题，不要重写代码。\n"
            "重点检查：正确性 bug、边界条件、异常处理、并发与资源泄漏、安全风险、可读性。\n"
            "输出格式：\n"
            "- [严重度 高/中/低] 位置：问题描述 → 建议\n"
            "- 最后给出不超过 3 条最重要的改进建议\n"
            "代码：\n{{代码}}\n语言/框架：{{语言}}"
        ),
    },
    {
        "title": "根因分析：先假设后验证",
        "description": "定位问题时先列假设和验证方法，不急着给修复代码",
        "category": "调试排错",
        "tags": ["debug", "通用"],
        "favorite": False,
        "content": (
            "我在使用 {{技术栈}} 时遇到问题：{{问题现象}}\n"
            "已知信息：{{报错或日志}}\n"
            "请按以下步骤分析，暂时不要给修复代码：\n"
            "1. 列出 3 个最可能的根因假设，按可能性排序\n"
            "2. 对每个假设给出验证方法（命令 / 日志 / 最小复现）\n"
            "3. 等我确认假设后再给修复方案"
        ),
    },
    {
        "title": "生成单元测试：边界与异常",
        "description": "覆盖正常路径、边界值、异常路径",
        "category": "测试",
        "tags": ["test", "Python"],
        "favorite": False,
        "content": (
            "为以下函数生成单元测试，使用 {{测试框架}}。\n"
            "要求：\n"
            "- 覆盖正常路径、边界值、异常路径\n"
            "- 每个用例名说明意图\n"
            "- 不修改被测函数\n"
            "- 只输出测试文件内容，不解释\n"
            "代码：\n{{代码}}"
        ),
    },
    {
        "title": "小步安全重构",
        "description": "每次只做一类改动，保持行为不变",
        "category": "重构优化",
        "tags": ["refactor", "通用"],
        "favorite": False,
        "content": (
            "对以下代码做小步重构，保持外部行为不变。\n"
            "约束：\n"
            "- 每次只做一类改动，做完等我确认\n"
            "- 现有测试必须保持通过\n"
            "- 不引入新依赖\n"
            "- 说明每一步的改动理由\n"
            "代码：\n{{代码}}\n现有测试：{{测试说明}}"
        ),
    },
    {
        "title": "需求澄清：先对齐再动手",
        "description": "复述目标、列出假设与待确认问题",
        "category": "需求澄清",
        "tags": ["需求", "通用"],
        "favorite": False,
        "content": (
            "以下是我的需求描述：{{需求}}\n"
            "在写代码前：\n"
            "1. 复述你理解的目标与成功标准\n"
            "2. 列出所有隐含假设\n"
            "3. 列出必须由我确认的问题（最多 5 个，按影响排序）\n"
            "4. 给出 2 种实现方案及取舍\n"
            "先不要写代码。"
        ),
    },
    {
        "title": "生成 Commit Message",
        "description": "按 Conventional Commits 生成提交信息",
        "category": "文档提交",
        "tags": ["git", "通用"],
        "favorite": False,
        "content": (
            "根据以下 git diff 生成提交信息，遵循 Conventional Commits。\n"
            "要求：标题不超过 72 字符；正文说明动机与影响；有破坏性变更时明确标注。\n"
            "diff：\n{{diff}}"
        ),
    },
]
