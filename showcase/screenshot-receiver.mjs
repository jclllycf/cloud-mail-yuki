import {createServer} from 'node:http';
import {mkdir, writeFile} from 'node:fs/promises';
import {resolve, dirname} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = dirname(fileURLToPath(import.meta.url));
const allowed = new Set(['inbox','analytics','reader','compose','settings-themes','mobile']);
const server = createServer(async (request, response) => {
  const name = request.url?.slice(1);
  if (request.method !== 'POST' || !allowed.has(name) || request.headers['content-type'] !== 'image/jpeg') {
    response.writeHead(404).end();
    return;
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 5_000_000) { response.writeHead(413).end(); return; }
    chunks.push(chunk);
  }
  const target = resolve(root, 'assets', `${name}.jpg`);
  await mkdir(dirname(target), {recursive: true});
  await writeFile(target, Buffer.concat(chunks));
  response.writeHead(201, {'content-type':'text/plain'}).end('saved');
});
server.listen(8795, '127.0.0.1');
