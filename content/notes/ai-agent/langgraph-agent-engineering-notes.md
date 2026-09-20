# LangGraph Agent 工程实践笔记

> 从状态管理、图调度到可恢复 Agent 的个人知识整理。

## LangGraph 是什么

LangGraph 是一个用于构建有状态、长流程 Agent 和工作流的编排框架。它可以理解为“状态管理器 + 流程调度器”：

- `State` 是共享状态；
- Node 是处理逻辑；
- Edge 是执行关系；
- Channel 是状态字段在运行时的存储单元；
- Reducer 决定多个更新如何合并；
- Checkpoint 保存执行过程中的状态快照；
- Pregel Runtime 负责按超级步调度整个图。

一个 Agent 的基本执行链路是：

```text
输入
  ↓
写入 State 对应的 Channel
  ↓
触发 Node
  ↓
Node 返回状态更新
  ↓
Reducer 合并更新
  ↓
根据 Edge 触发下一个 Node
  ↓
输出结果或继续循环
```

LangGraph 与普通 LLM Chain 的主要区别是：它不只负责调用模型，还负责保存状态、控制流程、调用工具、暂停恢复和故障处理。

## State、Node、Edge 与 Channel

### State 是共享白板

```python
from typing import Annotated, TypedDict
from operator import add


class AgentState(TypedDict):
    messages: list
    logs: Annotated[list[str], add]
```

可以把 State 想成团队成员共同使用的白板。节点不直接修改整个白板，而是返回自己想更新的字段：

```python
def analyst(state: AgentState) -> dict:
    return {"logs": ["分析完成"]}
```

### Node 是团队成员

Node 是一个执行函数。它读取当前状态，完成一段工作，再返回状态增量：

```python
def node(state):
    return {"field": "new value"}
```

节点通常不应该依赖隐含的进程内变量。需要跨请求、跨进程保存的数据应该放在 State 和 Checkpoint 中。

### Edge 是工作流转规则

固定边表示“执行完 A 后去 B”：

```python
builder.add_edge("retrieve", "answer")
```

条件边表示“执行完 A 后，根据状态选择下一步”：

```python
builder.add_conditional_edges(
    "model",
    should_continue,
    {"tools": "tools", END: END},
)
```

## Channel：字段的运行时存储单元

State Schema 中的字段会映射成运行时 Channel。对业务字段来说，字段名就是 Channel 名：

```python
class State(TypedDict):
    messages: list
```

运行时可以理解成：

```python
channels = {
    "messages": messages_channel,
}
```

Channel 不是节点的原型对象，也不存放节点逻辑。它主要负责：

- 保存当前值；
- 接收一批更新；
- 根据自己的合并规则更新值；
- 提供当前值读取；
- 在 Checkpoint 中序列化和恢复。

节点则负责：

- 读取哪些 Channel；
- 执行什么逻辑；
- 往哪些 Channel 写入；
- 订阅哪些路由信号。

### 常见 Channel

- `LastValue`：只允许一个有效更新，适合普通状态字段；
- `Topic`：追加多个值，适合消息流或事件列表；
- `BinaryOperatorAggregate`：使用 reducer 累积更新，例如 `add`；
- `AnyValue`：多个更新语义等价时保留一个值；
- `NamedBarrierValue`：等待多个信号后再继续；
- `EphemeralValue`：只在当前执行阶段存在，不持久化业务值。

例如：

```python
class State(TypedDict):
    total: Annotated[int, add]
```

多个节点分别返回 `{"total": 1}` 和 `{"total": 2}` 时，`BinaryOperatorAggregate` 会执行：

```text
旧值 + 1 + 2
```

如果字段使用 `LastValue`，同一个超级步收到多个更新通常会产生冲突，因为系统无法判断哪个值应该覆盖哪个值。

## 编译期：把图转换成可执行结构

调用 `compile()` 后，声明式图会被转换成 Pregel Runtime 可以执行的结构：

- State 字段转换成 Channel；
- Node 转换成 `PregelNode`；
- Edge 转换成 writers 和路由 Channel；
- 每个节点获得自己的 `branch:to:{node_name}` 专属触发 Channel；
- 编译期建立 `trigger_to_nodes` 反查索引。

可以把编译期理解成“把建筑图纸转换成工厂机器配置”。运行时不再反复阅读原始边结构，而是直接执行编译后的索引和写入指令。

### triggers、writers 与路由 Channel

每个节点都有自己的“门铃”：

```text
branch:to:model
branch:to:tools
```

目标节点的 `triggers` 订阅自己的门铃。固定边 `tools → model` 会在编译期给 `tools` 的 `writers` 添加一条指令：执行完成后写入 `branch:to:model`。

条件边则会在起点节点执行完成后运行路径函数，再根据返回值决定写入哪个目标门铃。

Channel 本身不知道谁订阅了自己。编译期会扫描所有节点的 `triggers`，建立：

```text
channel 名 → 订阅该 channel 的节点
```

这就是 `trigger_to_nodes`。

它本质上是发布订阅模式：

- `writers`：发布者；
- `triggers`：订阅关系；
- `trigger_to_nodes`：调度索引。

这样运行时不需要每次枚举全部节点，只需要根据被更新的 Channel 直接查找目标节点。这是“编译期付出一次成本，换运行期每一步查询效率”的设计，和数据库索引类似。

## Pregel 与 BSP 超级步

LangGraph 的运行可以理解为一轮一轮的超级步：

```text
plan → execute → apply
```

### plan

`prepare_next_tasks` 根据当前 Channel 版本、节点触发关系和待处理任务，计算本轮要执行的任务。

### execute

执行器调度这些任务。同步执行器使用线程池，异步执行器使用事件循环，并支持并发上限。底层硬件和 GIL 细节不是 Agent 开发的重点，核心只需记住：同一个超级步里的多个任务可以被并发调度。

### apply

`after_tick` 汇总本轮所有任务的写入，`apply_writes` 按 Channel 分组，然后调用各个 Channel 的 `update(values)`：

```text
任务 A 写 (messages, msg_a)
任务 B 写 (messages, msg_b)
        ↓
按 channel 分组
        ↓
messages.update([msg_a, msg_b])
        ↓
reducer 合并成新的 messages 值
```

任务完成顺序可能不同，但写入会在同步屏障之后统一应用。这就是 BSP（Bulk Synchronous Parallel）：

- Bulk：一次准备一批任务；
- Parallel：同批任务可以并发执行；
- Synchronous：等整批任务完成后统一合并写入。

同步的价值是让状态边界清晰、结果更确定，并且能在每个超级步结束时保存完整 Checkpoint。代价是本轮最慢的任务会拖慢整个超级步。

## 输入与输出

输入会被转换成 Channel 写入：

```python
graph.invoke({"messages": [human_message]})
```

如果是多字段 State，输入字典会按字段名拆分：

```text
{"messages": [...], "user_id": "u1"}
        ↓
(messages, [...])
(user_id, "u1")
```

这里的字段名、属性名和业务 Channel 名是同一个字符串。

单根类型 State 则不会拆分，整个输入值会写入 `__root__` Channel。

输出有两种重要视角：

- `values`：读取 Channel 当前合并后的完整值；
- `updates`：读取本轮每个节点产生的原始增量。

可以把它们类比成：`values` 是“当前完整账本”，`updates` 是“这一轮发生了哪些交易”。

## ReAct Agent：模型与工具循环

手写的最小 ReAct Agent 结构是：

```text
model
  ↓
有 tool_calls？
  ├── 否 → END
  └── 是 → tools → model
```

模型通过 `bind_tools` 获得工具描述，但模型只负责决定：

- 是否调用工具；
- 调用哪个工具；
- 传入什么参数。

模型返回的是 `AIMessage`，工具请求保存在 `tool_calls` 中，不是字符串：

```python
AIMessage(
    content="",
    tool_calls=[
        {
            "name": "add_numbers",
            "args": {"a": 1, "b": 2},
            "id": "call_123",
        }
    ],
)
```

真正执行工具的是工具节点：

```python
selected.invoke(call["args"])
```

`call["args"]` 是字典，按参数名匹配函数参数，效果类似：

```python
add_numbers(a=1, b=2)
```

最终模型直接回答时，文本位于 `AIMessage.content`。

## ToolNode：工具层的产品化实现

手写 `tools` 节点可以帮助理解原理，但实际项目通常使用 `ToolNode`。它负责：

- 查找模型请求的工具；
- 校验和传递参数；
- 执行一个或多个工具；
- 把结果封装成 `ToolMessage`；
- 处理工具异常；
- 将工具结果写回消息历史。

可以把 LLM 想成调度员，把 ToolNode 想成工具车间。调度员决定用哪台机器，车间负责真正执行。

工具设计需要考虑：

- 超时和重试；
- 权限校验；
- 幂等性；
- 敏感操作审批；
- 错误是否反馈给 LLM；
- 多工具调用之间是否可以并发。

## RetryPolicy 与错误处理

不是所有错误都值得重试：

- 网络超时、临时限流：通常可以重试；
- API Key 缺失、参数错误、权限错误：通常不应该重试。

```python
from langgraph.types import RetryPolicy

retry_policy = RetryPolicy(
    initial_interval=1,
    backoff_factor=2,
    max_interval=30,
    max_attempts=3,
    retry_on=(TimeoutError, ConnectionError),
)
```

重试逻辑可以理解成：

```text
节点执行
  ↓
抛出异常
  ↓
异常类型允许重试？
  ├── 否 → 直接失败
  └── 是
        ↓
      超过最大次数？
        ├── 是 → 失败
        └── 否 → 退避等待后重新执行
```

每次重试前会清理上一次尝试的写入，避免失败尝试的半成品状态污染下一次执行。`GraphBubbleUp` 代表 interrupt 等控制信号，不应被当成普通错误重试。

## Checkpoint：让 Agent 记住并恢复

Checkpoint 是 Agent 的存档。它至少包含三类信息：

- `channel_values`：各 Channel 的数据快照；
- `channel_versions`：各 Channel 的版本号；
- `versions_seen`：节点最后见过的 Channel 版本。

可以把它类比成游戏存档：不仅要保存角色当前装备，还要保存任务进度和已经触发过的事件，否则恢复后可能重复执行任务。

`thread_id` 是 Checkpoint 的主键：

```python
config = {"configurable": {"thread_id": "user-001"}}
graph.invoke(input_data, config)
```

存储实现的选择：

- `InMemorySaver`：临时记忆，适合 demo；
- SQLite：单机持久化，适合开发和简单服务；
- Postgres：共享持久化，适合多实例生产部署。

图对象本身可以重新创建，状态只要还在 Checkpoint 中就能恢复。也就是：节点无状态，Channel 和 Checkpoint 有状态。

## 序列化与时间旅行

Checkpoint 需要 serde 把 Python 状态编码成可存储格式，再在恢复时解码。重点不在于记住 msgpack 的实现，而在于意识到：复杂自定义对象可能需要额外的类型支持，不能假设任何对象都能直接持久化。

时间旅行提供三种能力：

- 查看历史状态；
- 从旧状态 fork 出新分支；
- 修改历史状态后重新执行。

它很像 Git：Checkpoint 是 commit，fork 是 branch，replay 是重新运行某个分支。常用于 Agent 调试、人工修正和审计。

## Interrupt：人机协同审批

普通异常表示任务失败，`interrupt` 表示任务主动暂停等待人类决策：

```python
from langgraph.types import interrupt


def transfer_money(state):
    approved = interrupt("是否允许转账？")
    if approved:
        return {"status": "transferred"}
    return {"status": "rejected"}
```

用户确认后恢复：

```python
from langgraph.types import Command

graph.invoke(Command(resume=True), config)
```

典型场景：转账、发邮件、删除数据、修改生产配置和高风险工具调用。Interrupt 的前提是配置 Checkpoint 和稳定的 `thread_id`。

## Command：动态控制流

固定边像提前画好的路线，`Command` 像运行时的调度单。节点可以同时更新状态并决定下一步：

```python
from langgraph.types import Command


def router(state):
    if state["risk"] == "high":
        return Command(
            update={"status": "pending_approval"},
            goto="human_review",
        )
    return Command(goto="execute")
```

- `goto`：动态跳转；
- `update`：更新状态；
- `resume`：恢复中断。

条件边适合在图定义阶段声明路由，Command 适合节点根据运行时结果动态决定流程。

## Subgraph：分层 Agent

复杂 Agent 不应该全部塞进一张大图。可以拆成专业子图：

```text
主 Agent
├── Research Subgraph
├── Analysis Subgraph
├── Review Subgraph
└── Report Subgraph
```

父图负责总流程，子图负责一个领域。设计重点是定义清楚输入、输出和状态边界：哪些信息传入子图，哪些结果返回父图，哪些内部状态必须隔离。

Subgraph 适合复用、测试和团队协作，也适合在简历中体现分层 Agent 架构能力。

## Send：动态 Map-Reduce

静态分支的目标通常在编译期确定，`Send` 则允许运行时动态创建任务：

```text
100 篇文档
    ↓ Send(document_i)
100 个分析任务
    ↓
Reducer 汇总结果
    ↓
总体报告
```

适合批量文档分析、多网页检索、多文件代码审查和多子问题分解。使用时要设计好 reducer，并考虑任务数量上限、失败任务、结果顺序和部分成功策略。

## Stream：实时反馈

`invoke()` 像等整桌菜全部做好后一次上菜，`stream()` 像边做边上菜。常见模式：

- `values`：每一步完整状态；
- `updates`：每一步状态增量；
- `messages`：模型 token；
- `custom`：业务自定义进度事件。

实际服务通常通过 SSE 或 WebSocket 将这些事件传给前端。应明确区分用户可见的 token 流、节点进度事件和系统内部状态更新。

## Agent 的完整生产链路

```text
用户请求
  ↓
输入映射到 State/Channel
  ↓
Pregel 按超级步调度节点
  ↓
模型决定回答、调用工具、动态跳转或暂停审批
  ↓
ToolNode / Subgraph / Send 执行工作
  ↓
Reducer 合并状态
  ↓
Stream 输出过程
  ↓
Checkpoint 持久化结果
  ↓
成功返回、失败重试，或从历史状态恢复
```

一个具有工程价值的 Agent 项目，通常至少应该覆盖：

- ReAct 与 ToolNode；
- Checkpoint 与会话隔离；
- SQLite 或 Postgres 持久化；
- SSE 流式输出；
- Interrupt 人工审批；
- RetryPolicy 错误恢复；
- Send 批量处理；
- Subgraph 分层编排。

## 最终理解

LangGraph 不是“让模型自己聊天”的库，而是给模型接上状态、工具、流程、审批、持久化和恢复能力的运行时。

模型负责局部决策，图负责全局可控执行；Channel 负责承载状态，Reducer 负责合并更新；Edge 和 Command 负责控制路线；Checkpoint 负责记住进度；Stream 负责实时反馈；Interrupt 负责把关键决策交给人。

这套组合让一个 Agent 从一次性的脚本，变成可以长期运行、可观察、可恢复、可审计的工程系统。
