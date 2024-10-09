import AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const AWS_REGION = process.env.REGION;
const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = AWSXRay.captureAWSv3Client(client);
const docClient = DynamoDBDocumentClient.from(ddb);
const TABLE_NAME = process.env.TABLE_NAME;

const putItemInDynamoDB = async (messageBody, subsegment) => {
  const command = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      USERNAME: messageBody.username,
      CUSTOMER_FIRST_NAME: messageBody.name,
      CUSTOMER_EMAIL: messageBody.email,
      CUSTOMER_PHONE: messageBody.phone,
      CUSTOMER_AGE: messageBody.age,
      CUSTOMER_PICTURE: messageBody.picture,
    },
    ConditionExpression: "attribute_not_exists(USERNAME)",
  });

  try {
    await docClient.send(command);
    console.log(`User ${messageBody.username} successfully added.`);
    subsegment.close(); // Closing the subsegment on success
  } catch (err) {
    subsegment.addError(err); // Adding error details to the subsegment
    subsegment.close();
    if (err.name === "ConditionalCheckFailedException") {
      console.log("Username already exists.");
    } else {
      console.error("Error inserting into DynamoDB:", err);
    }
    throw err;
  }
};

export const handler = async (event) => {
  const traceId = event.Records[0].messageAttributes.TraceId.stringValue;
  const messageBody = JSON.parse(event.Records[0].body);

  const segment = new AWSXRay.Segment("SQSConsumer", traceId);
  AWSXRay.setSegment(segment);
  const subsegment = segment.addNewSubsegment("DynamoDB Register");

  try {
    await putItemInDynamoDB(messageBody, subsegment);
  } catch (error) {
    subsegment.addError(error); // Ensure the error is captured
    console.error("Failed to process event:", error);
  } finally {
    segment.close(); // Ensure the segment is closed, even in case of errors
  }
};
