
import { Readable } from 'stream';

async function test() {
  const stream = Readable.from([Buffer.from('hello')]);
  const webStream = Readable.toWeb(stream);
  
  const file = new File([webStream as any], 'test.txt', { type: 'text/plain' });
  console.log('File size:', file.size);
  
  const reader = file.stream().getReader();
  const { value } = await reader.read();
  console.log('Content (first chunk):', new TextDecoder().decode(value));
}

test();
