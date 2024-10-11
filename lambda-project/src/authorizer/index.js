const authorizationToken = process.env.TOKEN;

const generatePolicy = (principalId, effect, resource) => {
  const authResponse = {};
  authResponse.principalId = principalId;
  if (effect && resource) {
    const policyDocument = {
      Version: "2012-10-17",
      Statement: [
        {
          Action: "execute-api:Invoke",
          Effect: effect,
          Resource: resource,
        },
      ],
    };
    authResponse.policyDocument = policyDocument;
  }
  return authResponse;
};

export const handler = async (event) => {
    const token = event.authorizationToken;
    const methodArn = event.methodArn;
    
    try {
        if (token === authorizationToken) {
            return generatePolicyauthorizationToken("user", "Allow", methodArn);
        } else {
            return generatePolicy("user", "Deny", methodArn);
        }
    }
    catch (error) {
        console.log(error);
        return generatePolicy("user", "Deny", methodArn);
    }
}