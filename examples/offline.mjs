import assert from 'node:assert/strict';
import { openInbox } from './inbox.mjs';

const inbox = openInbox('offline-demo');
const id = 'example-001';
const first = await inbox.save(id, JSON.stringify({ id, text: '离线示例消息' }));
assert.equal(await inbox.save(id, 'duplicate'), false);
assert.equal(await openInbox('offline-demo').has(id), true);
console.log(first ? '首次写入成功' : '已识别上次运行的记录');
console.log('重复投递已跳过；重新打开收件箱后仍可识别同一消息。');
