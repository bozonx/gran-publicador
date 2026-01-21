
import { Readable } from 'stream';
import { request, FormData } from 'undici';

async function test() {
  const serviceUrl = 'http://localhost:9999';
  const fileStream = Readable.from([Buffer.from('hello from stream')]);
  
  const fd = new FormData();
  // In undici, we can append a stream directly if we use this specific trick
  // OR we can use the undici.File if it exists
  
  fd.append('file', {
    [Symbol.toStringTag]: 'File',
    size: -1, // undici trick for unknown size
    type: 'text/plain',
    name: 'test.txt',
    stream: () => Readable.toWeb(fileStream),
  } as any);

  try {
    console.log('Sending request...');
    await request(serviceUrl, {
      method: 'POST',
      body: fd,
    });
  } catch (e) {
    // We expect ECONNREFUSED but let's see if it errors before that
    console.log('Result:', e.code || e.message);
  }
}

test();
