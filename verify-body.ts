
import { Readable } from 'stream';
import { request, FormData } from 'undici';
import http from 'http';

async function test() {
  const server = http.createServer((req, res) => {
    console.log('Got request headers:', req.headers);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Got request body length:', body.length);
      console.log('Body contains "hello from stream":', body.includes('hello from stream'));
      res.end('ok');
      server.close();
    });
  });

  server.listen(9998);

  const fileStream = Readable.from([Buffer.from('hello from stream')]);
  const fd = new FormData();
  
  fd.append('file', {
    [Symbol.toStringTag]: 'File',
    size: 17, // must match
    type: 'text/plain',
    name: 'test.txt',
    stream: () => Readable.toWeb(fileStream),
  } as any);

  try {
    await request('http://localhost:9998', {
      method: 'POST',
      body: fd,
    });
  } catch (e) {
    console.error(e);
  }
}

test();
