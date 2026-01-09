import sharp from 'sharp';
import exifReader from 'exif-reader';
import { readFile } from 'fs/promises';

async function debugExif(path: string) {
  try {
    const buffer = await readFile(path);
    console.log(`File size: ${buffer.length} bytes`);
    
    const image = sharp(buffer);
    const metadata = await image.metadata();
    
    console.log('Metadata keys:', Object.keys(metadata));
    console.log('EXIF present:', !!metadata.exif);
    
    if (metadata.exif) {
      console.log('EXIF buffer length:', metadata.exif.length);
      try {
        // @ts-ignore
        let reader = exifReader;
        if (typeof reader !== 'function' && reader.default) {
          reader = reader.default;
        }
        const exif = reader(metadata.exif);
        console.log('Parsed EXIF successfully');
        console.log(JSON.stringify(exif, null, 2).substring(0, 1000));
      } catch (e) {
        console.error('Failed to parse EXIF:', (e as Error).message);
      }
    } else {
      console.log('No EXIF found in metadata');
    }
  } catch (e) {
    console.error('Error:', (e as Error).message);
  }
}

const filePath = '/mnt/disk2/workspace/gran-publicador/test-data/media/2026/01/e975ea7e-0a0a-4261-a294-9a8ac25b2bed.jpg';
debugExif(filePath);
