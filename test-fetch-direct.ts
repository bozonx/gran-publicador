
import { Readable } from 'stream';
import http from 'http';

async function test() {
  const server = http.createServer((req, res) => {
    console.log('Got request headers:', req.headers);
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      console.log('Got request body length:', body.length);
      console.log('Body snippet:', body.slice(0, 500));
      console.log('Body contains "hello from stream":', body.includes('hello from stream'));
      res.end('ok');
      server.close();
    });
  });

  server.listen(9998);

  const fileStream = Readable.from([Buffer.from('hello from stream')]);
  const webStream = Readable.toWeb(fileStream);
  
  const fd = new FormData();
  // Using direct ReadableStream as a Blob part
  // NOTE: This is NOT standard but many implementations support it
  fd.append('file', webStream as any, 'test.txt');

  try {
    await fetch('http://localhost:9998', {
      method: 'POST',
      body: fd,
    });
  } catch (e) {
    console.error(e);
  }
}

test();
