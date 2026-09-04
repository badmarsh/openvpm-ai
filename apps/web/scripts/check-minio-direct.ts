import { S3Client, GetObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: process.env.S3_ENDPOINT || "http://localhost:9000",
  region: process.env.S3_REGION || "us-east-1",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "openpims",
    secretAccessKey: process.env.S3_SECRET_KEY || "openpims123",
  },
  forcePathStyle: true,
});

async function main() {
  console.log("Listing objects in bucket 'openpims'...");
  try {
    const list = await s3.send(new ListObjectsV2Command({ Bucket: "openpims" }));
    console.log("Object count in MinIO bucket:", list.KeyCount);
    if (list.Contents) {
      console.log("First 10 objects:");
      for (const obj of list.Contents.slice(0, 10)) {
        console.log(`  - ${obj.Key} (${obj.Size} bytes)`);
      }
    } else {
      console.log("Bucket is EMPTY!");
    }
  } catch (err: any) {
    console.error("MinIO error:", err.message);
  }
}

main().catch(console.error);
