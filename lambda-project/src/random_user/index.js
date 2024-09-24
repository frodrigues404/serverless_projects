import axios from "axios";
import AWSXRay from "aws-xray-sdk-core";
import AWS from "aws-sdk";
import http from "http";
import https from "https";

const axiosInstance = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

export const handler = async () => {
  const apiUrl = "https://randomuser.me/api/";
  const { SQS_QUEUE_URL, SQS_QUEUE_URL_IMAGE } = process.env;
  AWSXRay.captureHTTPsGlobal(http);
  AWSXRay.captureHTTPsGlobal(https);
  AWSXRay.capturePromise();

  const sqs = AWSXRay.captureAWSClient(new AWS.SQS({ apiVersion: "2012-11-05" }));
  const segment = AWSXRay.getSegment();

  if (!segment) {
    console.error("Failed to get X-Ray segment");
    return;
  }

  let randomUser;
  const apiSubsegment = segment.addNewSubsegment("External API: randomuser.me");
  try {
    const response = await axiosInstance.get(apiUrl);
    apiSubsegment.addAnnotation("HTTP Status", response.status);
    randomUser = response.data.results[0];
  } catch (error) {
    apiSubsegment.addError(error);
    console.log("Error fetching random user:", error);
    throw error;
  } finally {
    apiSubsegment.close();
  }

  // Extract required user data
  const result = {
    username: randomUser.login.username,
    name: randomUser.name.first,
    email: randomUser.email,
    phone: randomUser.phone,
    age: randomUser.dob.age,
    picture: randomUser.picture.large,
  };

  const traceId = segment.trace_id;

  // Common message attributes
  const commonMessageAttributes = {
    TraceId: {
      DataType: "String",
      StringValue: traceId,
    },
  };

  // Prepare SQS message parameters
  const imageParams = {
    DelaySeconds: 10,
    MessageAttributes: {
      ...commonMessageAttributes,
      Title: {
        DataType: "String",
        StringValue: "Random User Image",
      },
    },
    MessageBody: JSON.stringify({
      username: result.username,
      picture: result.picture,
    }),
    QueueUrl: SQS_QUEUE_URL_IMAGE,
  };

  const userParams = {
    DelaySeconds: 10,
    MessageAttributes: {
      ...commonMessageAttributes,
      Title: {
        DataType: "String",
        StringValue: "Random User",
      },
    },
    MessageBody: JSON.stringify(result),
    QueueUrl: SQS_QUEUE_URL,
  };

  // Function to send SQS messages with X-Ray subsegment
  const sendSQSMessage = async (params, subsegmentName) => {
    const sqsSubsegment = segment.addNewSubsegment(subsegmentName);
    try {
      await sqs.sendMessage(params).promise();
    } catch (error) {
      sqsSubsegment.addError(error);
      console.error(`Error sending SQS message to ${params.QueueUrl}:`, error);
      throw error;
    } finally {
      sqsSubsegment.close();
    }
  };

  // Send SQS messages in parallel
  try {
    await Promise.all([
      sendSQSMessage(imageParams, "SQS SendMessage Image"),
      sendSQSMessage(userParams, "SQS SendMessage"),
    ]);
  } catch (error) {
    console.error("Error sending SQS messages:", error);
    throw error;
  }
};
