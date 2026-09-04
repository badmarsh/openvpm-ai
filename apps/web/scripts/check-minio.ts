import { readPrimaryObject } from '../lib/s3';

async function main() {
  const key = '5c4ebbbc-90e1-457a-87a7-7895f560317d/documents/v2_48_malusova.JPG';
  console.log('Testing readPrimaryObject for key:', key);
  try {
    const res = await readPrimaryObject(key);
    console.log('Result status:', res.status);
    if (res.status === 'available') {
      console.log('Available bytes:', res.body.byteLength, 'ContentType:', res.contentType);
    }
  } catch (err) {
    console.error('Error reading from MinIO:', err);
  }
}

main().catch(console.error);
