import { pollRelay } from '../index.mjs';
import { required, openInbox } from './inbox.mjs';

const baseUrl = required('RELAY_URL');
const token = required('RELAY_READ_TOKEN');
const count = await pollRelay({ baseUrl, token }, async message => {
  const inbox = openInbox([message.channel, new URL(baseUrl).origin]);
  await inbox.save(message.id, JSON.stringify(message));
});
console.log('本轮中继已确认条数', count);
