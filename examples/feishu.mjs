import { startFeishu } from '../index.mjs';
import { required, openInbox } from './inbox.mjs';

const appId = required('FEISHU_APP_ID');
const inbox = openInbox(['feishu', appId]);
const list = name => required(name).split(',').map(id => id.trim()).filter(Boolean);
const stop = await startFeishu({
  appId, appSecret: required('FEISHU_APP_SECRET'), botOpenId: required('FEISHU_BOT_OPEN_ID'),
  chatIds: list('FEISHU_CHAT_IDS'), senderIds: list('FEISHU_SENDER_IDS')
}, async message => {
  const inserted = await inbox.save(message.id, JSON.stringify(message));
  if (inserted) return '消息已存入收件箱。';
});
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
