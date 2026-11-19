# Agent Party 消息渠道插件

把飞书群聊、短信、微信通知和电子邮件接入自己的 Node.js 服务。插件导出三个独立入口，宿主可以只启用需要的渠道。消息通过异步回调交付给宿主。部署只需要渠道账号和对应服务，无需安装 DS 或配置模型。

| 入口 | 来源 | 回调收到的内容 | 交付后的行为 |
| --- | --- | --- | --- |
| startFeishu | 飞书群聊长连接 | 消息 ID、文本、群 ID、发送人 Open ID | 回调返回非空字符串时回复原话题 |
| pollRelay | 已部署的兼容中继 | 短信或微信通知的 ID、原始数据、接收时间 | 逐条确认，服务端可删除已确认的正文 |
| pollMail | 支持 UIDL 的 POP3 邮箱 | 邮箱内唯一 ID、含邮件头的原始 MIME Buffer | 保留服务器上的邮件，由宿主记录已处理 ID |

## 安装与离线检查

使用 Node.js 20 或更高版本，在有私库读取权限的环境中克隆仓库。进入项目目录执行：

~~~sh
npm ci
npm test
~~~

宿主也可以将检出的目录作为本地依赖安装，再通过包名导入三个函数：

~~~sh
npm install /path/to/agent-party-channels
~~~

## 飞书群聊

在飞书开放平台创建企业自建应用，启用机器人、长连接事件订阅和接收消息事件 im.message.receive_v1，授予接收群内 @ 消息和以应用身份发消息的权限，发布应用并将机器人加入目标群。准备应用凭据、机器人 Open ID、目标群 ID 和获准发送人的 Open ID。Open ID 应属于同一个应用。

~~~js
import { startFeishu } from 'agent-party-channels';

const stop = await startFeishu({
  appId: process.env.FEISHU_APP_ID,
  appSecret: process.env.FEISHU_APP_SECRET,
  botOpenId: process.env.FEISHU_BOT_OPEN_ID,
  chatIds: [process.env.FEISHU_CHAT_ID],
  senderIds: [process.env.FEISHU_SENDER_OPEN_ID]
}, async message => {
  // 在此接入宿主自己的收件或处理逻辑。
  return '已收到消息 ' + message.id;
});
process.once('SIGINT', stop);
~~~

在允许的群里用飞书的 @ 选择器点选机器人并发送一条文本，即可检查话题回复。回调返回 undefined 可静默接收。机器人消息、私聊、非文本内容和未命中名单的事件会被跳过。若没有回调，先核对应用发布版本、事件订阅以及机器人和发送人的 Open ID。

## 短信与微信通知

此入口连接已有 HTTPS 中继。手机端转发规则和中继部署由使用方提供。中继须支持 Bearer 鉴权，提供 GET /v1/messages?after=0 及 POST /v1/ack。前者返回 items 数组，字段包括 id、kind（sms 或 wechat）、data、received_at，后者接收 ids 数组并返回 ok。

~~~js
import { pollRelay } from 'agent-party-channels';

await pollRelay({
  baseUrl: process.env.RELAY_URL,
  token: process.env.RELAY_READ_TOKEN
}, async event => {
  await inbox.storeOnce(event.channel, event.id, event.data);
});
~~~

示例中的 inbox 是宿主提供的持久化收件箱。storeOnce 应按渠道和 ID 幂等写入，写入失败应抛出异常。每次调用消费一页，成功返回条数。回调成功后插件立即确认该条消息。若确认失败，下次可能再次收到同一条。每个中继使用一个消费者，等待本轮结束再轮询；空队列或网络故障时延迟下一次请求。

## 电子邮件

邮箱需启用 POP3 over TLS 和 UIDL。将服务器、端口、用户名和邮箱授权密码注入运行进程。示例每次最多读取 20 封尚未登记的邮件。

~~~js
import { pollMail } from 'agent-party-channels';

await pollMail({
  host: process.env.MAIL_HOST,
  port: Number(process.env.MAIL_PORT || 995),
  username: process.env.MAIL_USER,
  password: process.env.MAIL_PASSWORD
}, {
  limit: 20,
  hasSeen: id => inbox.has('work-mail', id),
  onMessage: mail => inbox.storeOnce('work-mail', mail.id, mail.raw)
});
~~~

首次运行会从邮箱中已有的邮件开始。多个邮箱各用独立的去重空间。宿主负责 MIME 解码和附件处理，保存正文与登记 ID 应在同一事务中完成。服务器须提供受信任的 TLS 证书，单封邮件的读取上限为 25 MiB。

## 数据和运行边界

所有示例配置均从进程环境读取。插件交付消息时会在内存中接触原文；由宿主控制持久化、日志和保留时间。对重复投递，使用渠道、账号和消息 ID 作为幂等键。此包仅提供消息传输，宿主自行决定是否回复、如何授权以及如何处理消息。离线测试检查基础配置和中继确认顺序；部署后的账号权限与实际送达需要分别实测。
