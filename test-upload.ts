
import { Readable } from 'stream';
import { request, FormData } from 'undici';

async function testUpload() {
  const serviceUrl = 'http://localhost:8083/api/v1';
  const appId = 'gran-publicador';
  
  const fileStream = Readable.from([Buffer.from('test image content')]);
  const filename = 'test.png';
  const mimetype = 'image/png';

  const formData = new FormData();
  formData.append('appId', appId);
  
  // Using the same pattern as in MediaService
  formData.append('file', {
    type: mimetype,
    name: filename,
    [Symbol.for('undici.util.stream')]: fileStream,
  } as any);

  try {
    console.log(`Sending request to ${serviceUrl}/files...`);
    const response = await request(`${serviceUrl}/files`, {
      method: 'POST',
      body: formData,
    });

    console.log(`Response status: ${response.statusCode}`);
    const body = await response.body.json();
    console.log('Response body:', JSON.stringify(body, null, 2));
  } catch (error) {
    console.error('Request failed:', error);
  }
}

testUpload();
