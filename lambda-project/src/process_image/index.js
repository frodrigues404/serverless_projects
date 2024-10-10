import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import * as download from "image-downloader";
import axios from "axios";
import * as fs from "fs/promises";
import exifParser from "exif-parser";
import AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";
import http from "http";
import https from "https";

const s3 = new S3Client({});
const s3Client = AWSXRay.captureAWSv3Client(s3);
const bucketName = process.env.BUCKET_NAME;
const AWS_REGION = process.env.REGION;
const dynamoClient = new DynamoDBClient({ region: AWS_REGION });
const ddb = AWSXRay.captureAWSv3Client(dynamoClient);
const docClient = DynamoDBDocumentClient.from(ddb);
const TABLE_NAME = process.env.TABLE_NAME;

const axiosInstance = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

const validateImageType = async (imageUrl) => {
  const headResponse = await axiosInstance.head(imageUrl);
  const contentType = headResponse.headers["content-type"];
  if (!contentType.startsWith("image/")) {
    throw new Error(`Content type is not image: ${contentType}`);
  }
  return contentType;
};

const downloadImage = async (imageUrl) => {
  const options = { url: imageUrl, dest: "/tmp/" };
  const { filename } = await download.image(options);

  const fileExists = await fs.access(filename).then(() => true).catch(() => false);
  if (!fileExists) {
    throw new Error(`File not found after download: ${filename}`);
  }

  return filename;
};

const parseExifData = (fileContent) => {
  const parser = exifParser.create(fileContent);
  const exifData = parser.parse();
  return {
    imageHeight: exifData.imageSize.height,
    imageWidth: exifData.imageSize.width,
  };
};

const uploadToS3 = async (bucketName, key, fileContent, contentType) => {
  const s3Command = new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: fileContent,
    ContentType: contentType,
  });
  return await s3Client.send(s3Command);
};

const insertIntoDynamoDB = async (tableName, username, imageHeight, imageWidth) => {
  const dynamoCommand = new PutCommand({
    TableName: tableName,
    Item: {
      ID: username,
      HEIGHT: imageHeight,
      WIDTH: imageWidth,
    },
    ConditionExpression: "attribute_not_exists(ID)",
  });
  return await docClient.send(dynamoCommand);
};

export const handler = async (event) => {
  const traceId = event.Records[0].messageAttributes.TraceId.stringValue;
  const body = JSON.parse(event.Records[0].body);
  const { picture: imageUrl, username } = body;

  console.log("Event received:", event);

  const segment = new AWSXRay.Segment("ImageProcessing", traceId);
  AWSXRay.setSegment(segment);

  try {
    const imageSubsegment = segment.addNewSubsegment("Download Image");
    imageSubsegment.addMetadata("Image URL", imageUrl);

    const contentType = await validateImageType(imageUrl);
    console.log(`Valid image detected: ${contentType}`);

    const filename = await downloadImage(imageUrl);
    const fileContent = await fs.readFile(filename);

    const { imageHeight, imageWidth } = parseExifData(fileContent);

    imageSubsegment.close();

    const s3Subsegment = segment.addNewSubsegment("Upload to S3");
    await uploadToS3(bucketName, username, fileContent, contentType);
    s3Subsegment.close();
    console.log("S3 upload successful.");

    const dynamoSubsegment = segment.addNewSubsegment("Insert into DynamoDB");
    await insertIntoDynamoDB(TABLE_NAME, username, imageHeight, imageWidth);
    dynamoSubsegment.close();
    console.log("DynamoDB insert successful.");
  } catch (error) {
    segment.addError(error);
    console.error("Error processing image:", error.message);
  } finally {
    segment.close();
  }
};
