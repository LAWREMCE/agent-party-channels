import * as lark from '@larksuiteoapi/node-sdk';
import { openPop3 } from './pop3.mjs';

export async function startFeishu({ appId, appSecret, botOpenId, chatIds, senderIds }, onMessage) {
  if (!appId || !appSecret || !botOpenId || !Array.isArray(chatIds) || !chatIds.length ||
      !Array.isArray(senderIds) || !senderIds.length || typeof onMessage !== 'function') {
    throw new Error('Missing Feishu credentials, allowlists or handler');
  }
  const options = { appId, appSecret, loggerLevel: lark.LoggerLevel.error };
  const client = new lark.Client(options);
  const ws = new lark.WSClient(options);
  const handle = async ({ message, sender }) => {
    if (message?.chat_type !== 'group' || message.message_type !== 'text' ||
        sender?.sender_type !== 'user' || !senderIds.includes(sender.sender_id?.open_id) ||
        !chatIds.includes(message.chat_id) || !message.mentions?.some(m => m.id?.open_id === botOpenId)) return;
    const { text } = JSON.parse(message.content);
    if (typeof text !== 'string') return;
    const reply = await onMessage({ channel: 'feishu', id: message.message_id, text,
      senderId: sender.sender_id.open_id, chatId: message.chat_id });
    if (typeof reply === 'string' && reply.trim()) {
      const response = await client.im.message.reply({ path: { message_id: message.message_id },
        data: { msg_type: 'text', content: JSON.stringify({ text: reply }), reply_in_thread: true } });
      if (response.code) throw new Error('Feishu reply failed: ' + response.code);
    }
  };
  await ws.start({ eventDispatcher: new lark.EventDispatcher({}).register({ 'im.message.receive_v1': handle }) });
  return () => ws.close({ force: true });
}

export async function pollRelay({ baseUrl, token }, onMessage) {
  const base = new URL(baseUrl);
  if (base.protocol !== 'https:' || !token) throw new Error('HTTPS relay and token required');
  const headers = { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' };
  async function request(path, options) {
    const response = await fetch(new URL(path, base), { headers, redirect: 'error',
      signal: AbortSignal.timeout(20000), ...options });
    if (!response.ok) throw new Error('Relay HTTP ' + response.status);
    return response.json();
  }
  const { items } = await request('/v1/messages?after=0');
  for (const item of items) {
    if (!Number.isSafeInteger(item.id) || item.id <= 0 || !['sms','wechat'].includes(item.kind))
      throw new Error('Invalid relay message');
    await onMessage({ channel: item.kind, id: String(item.id), data: item.data, receivedAt: item.received_at });
    const ack = await request('/v1/ack', { method: 'POST', body: JSON.stringify({ ids: [item.id] }) });
    if (!ack.ok) throw new Error('Relay acknowledgement failed');
  }
  return items.length;
}

export async function pollMail(config, { hasSeen, onMessage, limit = 20 }) {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new Error('Invalid mail batch size');
  const pop = await openPop3(config);
  let count = 0;
  try {
    for (const line of await pop.command('UIDL', true)) {
      const match = /^(\d+) (\S+)$/.exec(line);
      if (!match) throw new Error('Invalid POP3 UIDL');
      const [, number, id] = match;
      if (await hasSeen(id)) continue;
      const lines = await pop.command('RETR ' + number, true);
      await onMessage({ channel: 'email', id, raw: Buffer.from(lines.join('\r\n') + '\r\n', 'latin1') });
      if (++count >= limit) break;
    }
    return count;
  } finally {
    await pop.close();
  }
}
