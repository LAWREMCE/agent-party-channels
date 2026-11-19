import { createHash, randomUUID } from 'node:crypto';
import { access, link, mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';

export function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error('请配置 ' + name);
  return value;
}

export function openInbox(scope, root = '.runtime/example-inbox') {
  const file = id => path.join(root, createHash('sha256')
    .update(JSON.stringify([scope, id])).digest('hex'));
  return {
    async has(id) {
      try { await access(file(id)); return true; }
      catch (error) { if (error.code === 'ENOENT') return false; throw error; }
    },
    async save(id, body) {
      await mkdir(root, { recursive: true, mode: 0o700 });
      const temp = path.join(root, randomUUID() + '.tmp');
      try {
        await writeFile(temp, body, { flag: 'wx', mode: 0o600 });
        try { await link(temp, file(id)); return true; }
        catch (error) { if (error.code === 'EEXIST') return false; throw error; }
      } finally {
        await unlink(temp).catch(error => { if (error.code !== 'ENOENT') throw error; });
      }
    }
  };
}
