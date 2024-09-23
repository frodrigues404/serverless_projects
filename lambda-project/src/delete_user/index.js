import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, DeleteCommand } from "@aws-sdk/lib-dynamodb";
import AWSXRay from "aws-xray-sdk-core";

const client = new DynamoDBClient();
const ddb = AWSXRay.captureAWSv3Client(client);
const docClient = DynamoDBDocumentClient.from(ddb);

const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
  const { username } = event.pathParameters || {};
  
  const segment = AWSXRay.getSegment();

  const validationSubsegment = segment.addNewSubsegment("Input Validation");
  
  if (!username || typeof username !== 'string' || username.length === 0) {
    validationSubsegment.addError(new Error("Invalid username"));
    validationSubsegment.close();
    
    return {
      statusCode: 400,
      body: JSON.stringify({ message: "Invalid username" }),
    };
  }
  validationSubsegment.close();

  const subsegment = segment.addNewSubsegment("DynamoDB Delete");

  subsegment.addAnnotation('Username', username);
  
  const command = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: {
      USERNAME: username,
    },
  });

  try {
    const response = await docClient.send(command);
    subsegment.addMetadata('DynamoDBCommand', command);
    
    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'User deleted successfully' }),
    };
  } catch (err) {
    subsegment.addError(err);
    console.error('Error deleting user:', err);
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: "Error deleting user",
        error: err.message,
      }),
    };
  } finally {
    subsegment.close();
  }
};
