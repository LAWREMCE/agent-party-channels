import test from 'node:test';
import assert from 'node:assert/strict';
import { pollRelay, startFeishu, pollMail } from './index.mjs';

test('incomplete configuration fails before connecting', async () => {
  await assert.rejects(startFeishu({}, () => {}), /Missing Feishu/);
  await assert.rejects(pollMail({}, {limit: 0}), /batch size/);
  await assert.rejects(pollRelay({baseUrl: 'http://example.invalid', token: 'fixture'}), /HTTPS/);
});

test('relay acknowledges only after host delivery', async t => {
  const calls = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    calls.push(url.pathname);
    if (options.method === 'POST') assert.deepEqual(JSON.parse(options.body), {ids:[7]});
    return Response.json(options.method === 'POST' ? {ok:true} : {items:[{id:7,kind:'sms',data:{}}]});
  });
  const config = {baseUrl:'https://example.invalid', token:'fixture'};
  await assert.rejects(pollRelay(config, async () => {throw Error('busy')}), /busy/);
  assert.deepEqual(calls, ['/v1/messages']);
  assert.equal(await pollRelay(config, async event => {assert.equal(event.id,'7'); calls.push('stored')}), 1);
  assert.deepEqual(calls.slice(1), ['/v1/messages','stored','/v1/ack']);
});
