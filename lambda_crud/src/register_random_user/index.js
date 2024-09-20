import AWSXRay from "aws-xray-sdk-core";
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { PutCommand, DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const AWS_REGION = process.env.REGION;
const client = new DynamoDBClient({ region: AWS_REGION });
const ddb = AWSXRay.captureAWSv3Client(client);
const docClient = DynamoDBDocumentClient.from(ddb);
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
  let subsegment;
  const traceId = event.Records[0].messageAttributes.TraceId.stringValue;

  try {
    const segment = new AWSXRay.Segment("SQSConsumer", traceId);
    AWSXRay.setSegment(segment);
    subsegment = segment.addNewSubsegment("DynamoDB Register");

    const messageBody = JSON.parse(event.Records[0].body);  
    console.log("Username: ", messageBody.username);
    const command = new PutCommand({
      TableName: TABLE_NAME,
      Item: {
        USERNAME: messageBody.username,
        CUSTOMER_FIRST_NAME: messageBody.name,
        CUSTOMER_EMAIL: messageBody.email,
        CUSTOMER_PHONE: messageBody.phone,
        CUSTOMER_PICTURE: messageBody.picture,
      },
      ConditionExpression: "attribute_not_exists(USERNAME)",
    });

    try {
      await docClient.send(command);  
      subsegment.close();
    } catch (err) {
      if (err.name === "ConditionalCheckFailedException") {
        console.log("Username já está em uso");
      }
      subsegment.addError(err);
      subsegment.close();
    }

    segment.close();  
  } catch (error) {
    if (subsegment) {
      subsegment.addError(error);
    }
    console.log(error);
  }
};
