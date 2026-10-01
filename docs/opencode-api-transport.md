# OpenCode 请求传输

玩家继续填写 `https://opencode.ai/zen/go/v1`，使用现有供应商与 API 档案设置。

`services/ai/apiTransport.ts` 用 `new URL()` 检查最终目标的 hostname。只有精确等于 `opencode.ai` 的 HTTPS 请求会转发到 `https://simc-llm-proxy.gordonfang1988.workers.dev/proxy`，并加入 `X-LLM-Target-URL` 与 `x-opencode-session`。OpenCode HTTP 地址会报错；代理故障不会直连上游。其他目标继续使用原 fetch 参数。

传输函数保留 method、body、请求头、AbortSignal 及其他 RequestInit 字段，直接返回上游 Response，不读取响应体。状态码处理、取消、流式解析、temperature、输出上限和重试继续由现有调用方负责。没有全局替换 fetch，也没有修改 Worker、代理白名单或其他项目。

主剧情、开局、世界演变、变量生成、规划分析、回忆、总结、润色、小说分解、词组转化与 PNG 提炼共用文本客户端。11 个设置组件的模型列表共用 `modelList.ts`；图片生成 API 和 ComfyUI API 也接入传输函数。图片文件下载、存档和 GitHub 请求保持原路径。

OpenCode Go 基础地址先于 GLM 模型名的智谱启发规则处理，生成地址为 `/zen/go/v1/chat/completions`，模型地址为 `/zen/go/v1/models`。显式填写的 OpenCode `/responses`、`/messages` 和 `/models/<model>` 原生端点保留地址；此改造没有增加新的原生协议实现。

## 会话标识

当前文本客户端收到的是 API 档案配置，没有贯穿开局、主剧情、辅助请求与设置页的存档会话 ID。默认使用本机、本站、每个 API 档案独立生成的 UUID v4，保存为 `localStorage` 的 `mrjh-opencode-api-session:v1:<档案ID>`。辅助配置沿用所属 API 档案 ID；不使用 Key、IP、模型名或每次请求的新 UUID。Web Locks 可用时，首次创建在不同标签页之间串行执行。

这是 API 档案级身份，**不是存档级会话**。同一档案在重试和刷新后继续使用该 UUID。清除本站数据、换浏览器或首次在另一个设备导入档案，会生成新的本机 UUID；不会改写旧 API 配置的导入导出格式。调用上下文提供 `sessionId` 时优先使用它，其次保留已有 `x-opencode-session` 请求头。本地存储不可用时明确报错，不发送无法稳定标识会话的请求。

## 验证

`node scripts/apiTransportRegression.mjs` 使用合成请求和离线 fetch，验证精确 hostname、Go GLM/DeepSeek 端点、原生端点保留、其他供应商直连、Headers 和 RequestInit 保留、原 Response、会话在模块重载与重试后稳定、模型列表、401/429/5xx、取消、SSE 首段在响应结束前交给现有解析器，以及主剧情、辅助和连接测试的统一入口。测试不使用真实 Key，也不修改玩家存档。

真实网页联调应只记录目标地址、method、状态码、会话是否稳定及成功/失败标记；不记录 Key、Authorization、完整提示词或完整响应。此改造保证代理接入一致，不保证提速。

2026-10-02 网页验收：将现有设置组件及本次代码加载到生产站点 origin 的本地验收镜像，浏览器到 Worker 的 API 请求未拦截。用户在页面内存中填写 Key 后，`GET /zen/go/v1/models` 返回 200 且列表显示成功，现有连接测试的 DeepSeek V4 Flash 生成请求返回 200 且组件确认成功；两次请求使用相同会话标识。另以浏览器响应夹具覆盖 11 个设置组件的 14 个模型列表入口、刷新后的会话保留与错误展示。该验收证明浏览器代理链路可用，不代表生产站点已经部署本次改动。

v1.0.8 最终检查在最新已提交基线加本次修改的隔离副本中执行：25 个回归／存档往返脚本通过，10 个压力测试回合与 8 项提示词链路检查通过，`tsc --noEmit`、版本检查与生产构建通过。压力测试的一项旧字面匹配已更新以识别现有 `fandomEnabled` 局部变量及参数简写；规划逻辑与提示词未改动。
