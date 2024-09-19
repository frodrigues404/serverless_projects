resource "aws_lambda_permission" "allow_apigateway_invoke" {
  statement_id   = "AllowAPIGatewayInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = module.get_user.lambda_function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${module.api_gateway.api_execution_arn}/*"
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_lambda_permission" "post_allow_apigateway_invoke" {
  statement_id   = "AllowAPIGatewayInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = module.create_user.lambda_function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${module.api_gateway.api_execution_arn}/*"
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_lambda_permission" "get_by_id_allow_apigateway_invoke" {
  statement_id   = "AllowAPIGatewayInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = module.get_user_by_id.lambda_function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${module.api_gateway.api_execution_arn}/*"
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_lambda_permission" "delete_by_id_allow_apigateway_invoke" {
  statement_id   = "AllowAPIGatewayInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = module.delete_user_by_id.lambda_function_name
  principal      = "apigateway.amazonaws.com"
  source_arn     = "${module.api_gateway.api_execution_arn}/*"
  source_account = data.aws_caller_identity.current.account_id
}

resource "aws_lambda_permission" "post_allow_get_by_id_invoke" {
  statement_id   = "AllowLambdaInvoke"
  action         = "lambda:InvokeFunction"
  function_name  = module.get_user_by_id.lambda_function_arn
  principal      = "lambda.amazonaws.com"
  source_arn     = "arn:aws:sts::${data.aws_caller_identity.current.account_id}:assumed-role/${module.create_user.lambda_function_name}/${module.create_user.lambda_function_name}"
  source_account = data.aws_caller_identity.current.account_id
}