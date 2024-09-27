import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as download from 'image-downloader';
import axios from 'axios';
import * as fs from 'fs/promises';
import exifParser from 'exif-parser';
import AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const client = new S3Client({});
const bucketName = process.env.BUCKET_NAME;
const AWS_REGION = process.env.REGION;
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const ddb = AWSXRay.captureAWSv3Client(dynamoClient);
const docClient = DynamoDBDocumentClient.from(ddb);
const TABLE_NAME = process.env.TABLE_NAME;


export const handler = async (event) => {
  const traceId = event.Records[0].messageAttributes.TraceId.stringValue;
  const body = JSON.parse(event.Records[0].body);
  const imageUrl = body.picture;
  const username = body.username;

  console.log("Event received:", event);
  console.log("Image URL:", imageUrl);

  try {
    const headResponse = await axios.head(imageUrl);
    const contentType = headResponse.headers['content-type'];

    if (!contentType.startsWith('image/')) {
      throw new Error(`URL não contém uma imagem. Tipo de conteúdo: ${contentType}`);
    }

    console.log(`Imagem válida detectada: ${contentType}`);

    const options = {
      url: imageUrl,
      dest: '/tmp/',
    };
    
    const { filename } = await download.image(options);

    const fileExists = await fs.access(filename).then(() => true).catch(() => false);

    if (!fileExists) {
      throw new Error(`File not found after download: ${filename}`);
    }

    const fileContent = await fs.readFile(filename);

    const parser = exifParser.create(fileContent);
    const exifData = parser.parse(); 
    
    const imageHeight = exifData.imageSize.height;
    const imageWidth = exifData.imageSize.width;

    const s3Command = new PutObjectCommand({
      Bucket: bucketName,
      Key: username,
      Body: fileContent,
      ContentType: contentType
    });

    const dynamoCommand = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        IMAGE: username,
        HEIGHT: imageHeight,
        WIDTH: imageWidth,
      },
      ConditionExpression: "attribute_not_exists(USERNAME)",
    });

    try{
    const response = await client.send(s3Command);
    console.log("S3 upload response:", response);
    } catch (err) {
      console.error("Error during S3 upload:", err.message);
    }

    try {
      await docClient.send(dynamoCommand);
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        console.log("Username já está em uso");
      }
    }
    
  } catch (err) {
    console.error("Error during image download or S3 upload:", err.message);
  }
};
