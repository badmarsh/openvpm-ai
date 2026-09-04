import { uploadManagedFile, readPrimaryObject } from '../lib/s3';

async function main() {
  console.log('S3 Endpoint from env:', process.env.S3_ENDPOINT);
  console.log('S3 Bucket from env:', process.env.S3_BUCKET);
  const testKey = '5c4ebbbc-90e1-457a-87a7-7895f560317d/documents/test.txt';
  const testBody = Buffer.from('Hello OpenVPM S3 storage!');
  console.log('Testing upload to MinIO...');
  const res = await uploadManagedFile(testKey, testBody, 'text/plain', 'testsha256');
  console.log('Upload result:', res);

  console.log('Testing read back from MinIO...');
  const readRes = await readPrimaryObject(testKey);
  console.log('Read result status:', readRes.status);
  if (readRes.status === 'available') {
    console.log('Read content:', Buffer.from(readRes.body).toString('utf8'));
  }
}

main().catch(console.error);
