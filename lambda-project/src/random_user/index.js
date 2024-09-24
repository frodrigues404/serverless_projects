import axios from "axios";
import AWSXRay from "aws-xray-sdk-core";
import AWS from "aws-sdk";
import http from "http";
import https from "https";

const instance = axios.create({
  httpAgent: new http.Agent({ keepAlive: true }),
  httpsAgent: new https.Agent({ keepAlive: true }),
});

const randomUser = async (apiUrl) => {
  const response = await instance.get(apiUrl);
  return response.data.results[0];
}

export const handler = async () => {
  const apiUrl = "https://randomuser.me/api/";
  const sqs = AWSXRay.captureAWSClient(new AWS.SQS({ apiVersion: "2012-11-05" }));
  const SQS_QUEUE_URL = process.env.SQS_QUEUE_URL;
  const SQS_QUEUE_URL_IMAGE = process.env.SQS_QUEUE_URL_IMAGE;
  
  AWSXRay.captureHTTPsGlobal(http);
  AWSXRay.captureHTTPsGlobal(https);
  AWSXRay.capturePromise();
  

  const segment = AWSXRay.getSegment();
  const subsegment = segment.addNewSubsegment("External API: randomuser.me");
  const randomUser = await randomUser(apiUrl).promise();
  // const response = await instance.get(apiUrl);
  // const randomUser = response.data.results[0];
  subsegment.addAnnotation("HTTP Status", response.status);
  subsegment.close();
  
  const result = {
    username: randomUser.login.username,
    name: randomUser.name.first,
    email: randomUser.email,
    phone: randomUser.phone,
    age: randomUser.dob.age,
    picture: randomUser.picture.large,
  };

  const subsegmentSQSImage = segment.addNewSubsegment("SQS SendMessage Image");
  const imageParams = {
    DelaySeconds: 10,
    MessageAttributes: {
      Title: {
        DataType: "String",
        StringValue: "Random User Image",
      },
      TraceId: {
        DataType: "String",
        StringValue: AWSXRay.getSegment().trace_id,
      },
    },
    MessageBody: JSON.stringify({ username: result.username, picture: result.picture }),
    QueueUrl: SQS_QUEUE_URL_IMAGE,
  };
  try {
    await sqs.sendMessage(imageParams).promise();
    subsegmentSQSImage.close();
  } catch (error) {
    subsegmentSQSImage.addError(error);
    subsegmentSQSImage.close();
  }
  const subsegmentSQS = segment.addNewSubsegment("SQS SendMessage");

  var params = {
    DelaySeconds: 10,
    MessageAttributes: {
      Title: {
        DataType: "String",
        StringValue: "Random User",
      },
      TraceId: {
        DataType: "String",
        StringValue: AWSXRay.getSegment().trace_id,
      },
    },
    MessageBody: JSON.stringify(result),
    QueueUrl: SQS_QUEUE_URL,
  };

  try {
    await sqs.sendMessage(params).promise();
    subsegmentSQS.close();
  } catch (error) {
    subsegmentSQS.addError(error);
    subsegmentSQS.close();
  } 
};
