import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as download from 'image-downloader';

const client = new S3Client({});
const bucketName = process.env.BUCKET_NAME;
export const handler = async (event) => {
    const traceId = event.Records[0].messageAttributes.TraceId.stringValue;
    const imageUrl = JSON.parse(event.Records[0].body).picture;
    console.log(event);
    console.log(imageUrl);
    const options = {
        url: imageUrl,
        dest: '/tmp',
    };
    console.log(`${options.dest}${options.imageUrl}`);
    download.image(options)
    .then(({ filename }) => {
      console.log('Saved to', filename);
    })
    .catch((err) => console.error(err));

    const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: options.dest + options.dest,
        Body: "Hello S3!",
      });
    
      try {
        const response = await client.send(command);
        console.log(response);
      } catch (err) {
        console.error(err);
      }
};
