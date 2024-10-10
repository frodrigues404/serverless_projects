import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";
import AWSXRay from "aws-xray-sdk-core";

const ddbClient = new DynamoDBClient();
const ddb = AWSXRay.captureAWSv3Client(ddbClient);
const docClient = DynamoDBDocumentClient.from(ddb);

const s3Client = new S3Client();
const s3 = AWSXRay.captureAWSv3Client(s3Client);

const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (event) => {
  const { username } = event.pathParameters || {};

  const segment = AWSXRay.getSegment();

  // Subsegmento para validação de entrada
  const validationSubsegment = segment.addNewSubsegment("Input Validation");
  if (!username || typeof username !== 'string' || username.trim().length === 0) {
    validationSubsegment.addError(new Error("Invalid username"));
    validationSubsegment.close();
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid username" }),
    };
  }
  validationSubsegment.close();

  // Subsegmento para deletar usuário no DynamoDB com ConditionExpression
  const dynamoSubsegment = segment.addNewSubsegment("DynamoDB Delete");
  dynamoSubsegment.addAnnotation('Username', username);

  const deleteCommand = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { USERNAME: username },
    ConditionExpression: 'attribute_exists(USERNAME)',  // Condição para garantir que o usuário exista
  });

  try {
    await docClient.send(deleteCommand);
    dynamoSubsegment.addMetadata('DynamoDBCommand', deleteCommand);
  } catch (err) {
    if (err.name === 'ConditionalCheckFailedException') {
      dynamoSubsegment.addError(new Error("User not found"));
      return {
        statusCode: 404,
        body: JSON.stringify({ message: "User not found" }),
      };
    }
    dynamoSubsegment.addError(err);
    console.error('Error deleting user:', err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error deleting user",
        error: err.message,
      }),
    };
  } finally {
    dynamoSubsegment.close();
  }

  // Subsegmento para deletar imagem do usuário no S3
  const s3Subsegment = segment.addNewSubsegment("S3 Delete");
  try {
    const deleteObjectCommand = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: `${username}`,
    });

    await s3.send(deleteObjectCommand);
    s3Subsegment.addMetadata('S3Command', deleteObjectCommand);
  } catch (err) {
    s3Subsegment.addError(err);
    console.error('Error deleting user image:', err);

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "User deleted, but error deleting user image",
        error: err.message,
      }),
    };
  } finally {
    s3Subsegment.close();
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ message: 'User and image deleted successfully' }),
  };
};
