module "dynamodb_table" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.1.0"

  name     = "user"
  hash_key = "USERNAME"

  attributes = [
    {
      name = "USERNAME"
      type = "S"
    }
  ]

  tags = local.common_tags
}

module "get_user" {
  source             = "terraform-aws-modules/lambda/aws"
  version            = "7.9.0"
  function_name      = "lambda_get_user"
  description        = "Get items from DynamoDB"
  handler            = "index.handler"
  runtime            = "nodejs20.x"
  attach_policy_json = true

  environment_variables = {
    TABLE_NAME = module.dynamodb_table.dynamodb_table_id
  }

  # allowed_triggers = {
  #   APIGatewayAny = {
  #     service    = "apigateway"
  #     source_arn = "arn:aws:execute-api:${var.region}:${data.aws_caller_identity.current.account_id}:aqnku8akd0/*/*/*"
  #   }
  # }

  policy_json = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:Scan"
            ],
            "Resource": "${module.dynamodb_table.dynamodb_table_arn}"
        },
        {
            "Effect": "Allow",
            "Action": [
                "secretsmanager:GetSecretValue",
                "secretsmanager:DescribeSecret",
                "secretsmanager:ListSecrets"
            ],
            "Resource": "*"
        }
    ]
}
EOF

  source_path = "./src/get_user"

  tags = local.common_tags
}

module "get_user_by_id" {
  source             = "terraform-aws-modules/lambda/aws"
  version            = "7.9.0"
  function_name      = "lambda_get_user_by_id"
  description        = "Get items By ID from DynamoDB"
  handler            = "index.handler"
  runtime            = "nodejs20.x"
  attach_policy_json = true

  environment_variables = {
    TABLE_NAME = module.dynamodb_table.dynamodb_table_id
    KEY_NAME   = "id"
  }

  policy_json = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:Scan"
            ],
            "Resource": "${module.dynamodb_table.dynamodb_table_arn}"
        }
    ]
}
EOF

  source_path = "./src/get_user_by_id"

  tags = local.common_tags
}

module "delete_user_by_id" {
  source             = "terraform-aws-modules/lambda/aws"
  version            = "7.9.0"
  function_name      = "lambda_delete_user_by_id"
  description        = "Delete items By ID from DynamoDB"
  handler            = "index.handler"
  runtime            = "nodejs20.x"
  attach_policy_json = true

  environment_variables = {
    TABLE_NAME = module.dynamodb_table.dynamodb_table_id
    KEY_NAME   = "id"
  }

  policy_json = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:DeleteItem"
            ],
            "Resource": "${module.dynamodb_table.dynamodb_table_arn}"
        }
    ]
}
EOF

  source_path = "./src/delete_user"

  tags = local.common_tags
}

module "create_user" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.9.0"

  function_name      = "lambda_create_user"
  description        = "Post items from DynamoDB"
  handler            = "index.handler"
  runtime            = "nodejs20.x"
  attach_policy_json = true

  environment_variables = {
    TABLE_NAME            = module.dynamodb_table.dynamodb_table_id
    LAMBDA_GET_USER_BY_ID = module.get_user_by_id.lambda_function_name
  }

  policy_json = <<EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Effect": "Allow",
            "Action": [
                "dynamodb:GetItem",
                "dynamodb:PutItem",
                "dynamodb:Scan",
                "dynamodb:UpdateItem"
            ],
            "Resource": "${module.dynamodb_table.dynamodb_table_arn}"
        }
    ]
}
EOF

  source_path = "./src/create_user"

  tags = local.common_tags
}

module "api_gateway" {
  source        = "terraform-aws-modules/apigateway-v2/aws"
  version       = "5.2.0"
  name          = "lambda-crud"
  description   = "Serveless CRUD project"
  protocol_type = "HTTP"
  # hosted_zone_name      = keys(module.route53_zones.route53_zone_zone_id)[0]
  # domain_name           = var.domain_name
  create_certificate    = false
  create_domain_name    = false
  create_domain_records = false
  routes = {
    "GET /" = {
      integration = {
        uri = module.get_user.lambda_function_arn
      }
    },
    "GET /{id}" = {
      integration = {
        uri = module.get_user_by_id.lambda_function_arn
      }
    },
    "POST /" = {
      integration = {
        uri = module.create_user.lambda_function_arn
      }
    },
    "DELETE /{id}" = {
      integration = {
        uri = module.create_user.lambda_function_arn
      }
    }
  }

  tags = local.common_tags
}