module "dynamodb_users_table" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.1.0"

  name     = "users"
  hash_key = "USERNAME"

  attributes = [
    {
      name = "USERNAME"
      type = "S"
    }
  ]

  tags = local.common_tags
}

module "dynamodb_image_table" {
  source  = "terraform-aws-modules/dynamodb-table/aws"
  version = "4.1.0"

  name     = "image_metadata"
  hash_key = "ID"

  attributes = [
    {
      name = "ID"
      type = "S"
    }
  ]

  tags = local.common_tags
}

module "user_images" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "4.2.0"

  bucket = "serverless-project-user-images"
  acl    = "private"

  control_object_ownership = true
  object_ownership         = "ObjectWriter"

  versioning = {
    enabled = false
  }
}

module "sqs" {
  source  = "terraform-aws-modules/sqs/aws"
  version = "4.2.0"

  for_each = {
    userinfo  = "userinfo"
    userimage = "userimage"
  }

  name       = each.value
  fifo_queue = false

  tags = local.common_tags
}

module "lambda_authorizer" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.9.0"

  function_name                           = "lambda_authorizer"
  description                             = "Authorizer for API Gateway"
  handler                                 = "index.handler"
  runtime                                 = "nodejs20.x"
  attach_policy_json                      = true
  tracing_mode                            = "Active"
  attach_tracing_policy                   = true
  create_current_version_allowed_triggers = false

  environment_variables = {
    TOKEN = var.authorization_token
  }


  allowed_triggers = {
    APIGateway = {
      service    = "apigateway"
      source_arn = "${module.api_gateway.api_execution_arn}/*"
    },
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
            "Resource": "${module.dynamodb_users_table.dynamodb_table_arn}"
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

  source_path = "./src/authorizer"

  tags = local.common_tags
}

module "lambda_get_user" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.9.0"

  function_name                           = "lambda_get_user"
  description                             = "Get items from DynamoDB"
  handler                                 = "index.handler"
  runtime                                 = "nodejs20.x"
  attach_policy_json                      = true
  tracing_mode                            = "Active"
  attach_tracing_policy                   = true
  create_current_version_allowed_triggers = false

  environment_variables = {
    TABLE_NAME = module.dynamodb_users_table.dynamodb_table_id
    REGION     = var.region
  }

  allowed_triggers = {
    APIGateway = {
      service    = "apigateway"
      source_arn = "${module.api_gateway.api_execution_arn}/*"
    },
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
            "Resource": "${module.dynamodb_users_table.dynamodb_table_arn}"
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

module "lambda_create_random_user" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.9.0"

  function_name                           = "lambda_create_random_user"
  description                             = "Return a random user"
  handler                                 = "index.handler"
  runtime                                 = "nodejs20.x"
  attach_policy_json                      = true
  tracing_mode                            = "Active"
  attach_tracing_policy                   = true
  create_current_version_allowed_triggers = false

  timeout = 5 // Depends on the external API response time

  authorization_type = "CUSTOM"

  environment_variables = {
    REGION              = var.region
    SQS_QUEUE_URL       = module.sqs.userinfo.queue_url
    SQS_QUEUE_URL_IMAGE = module.sqs.userimage.queue_url
  }

  allowed_triggers = {
    APIGateway = {
      service    = "apigateway"
      source_arn = "${module.api_gateway.api_execution_arn}/*"
    },
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
            "Resource": "${module.dynamodb_users_table.dynamodb_table_arn}"
        },
        {
            "Effect": "Allow",
            "Action": [
                "sqs:SendMessage"
            ],
            "Resource": [
              "${module.sqs.userinfo.queue_arn}",
              "${module.sqs.userimage.queue_arn}"
            ]
        }
    ]
}
EOF

  source_path = "./src/random_user"

  tags = local.common_tags
}

module "lambda_register_random_user" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.9.0"

  function_name                           = "lambda_register_random_user"
  description                             = "Register a random user"
  handler                                 = "index.handler"
  runtime                                 = "nodejs20.x"
  attach_policy_json                      = true
  create_current_version_allowed_triggers = false
  tracing_mode                            = "Active"
  attach_tracing_policy                   = true

  environment_variables = {
    REGION        = var.region
    SQS_QUEUE_URL = module.sqs.userinfo.queue_url
    TABLE_NAME    = module.dynamodb_users_table.dynamodb_table_id
  }

  allowed_triggers = {
    ScanAmiRule = {
      principal  = "sqs.amazonaws.com"
      source_arn = module.sqs.userinfo.queue_arn
    }
  }

  event_source_mapping = {
    sqs = {
      event_source_arn = module.sqs.userinfo.queue_arn
    }
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
            "Resource": "${module.dynamodb_users_table.dynamodb_table_arn}"
        },
        {
            "Effect": "Allow",
            "Action": [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes"
            ],
            "Resource": "${module.sqs.userinfo.queue_arn}"
        }
    ]
}
EOF

  source_path = "./src/register_random_user"
  tags        = local.common_tags
}

module "lambda_register_random_user_image" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.9.0"

  function_name                           = "lambda_register_random_user_image"
  description                             = "Register a random user image in S3 and DynamoDB"
  handler                                 = "index.handler"
  runtime                                 = "nodejs20.x"
  attach_policy_json                      = true
  create_current_version_allowed_triggers = false
  tracing_mode                            = "Active"
  attach_tracing_policy                   = true

  environment_variables = {
    REGION        = var.region
    SQS_QUEUE_URL = module.sqs.userimage.queue_url
    TABLE_NAME    = module.dynamodb_image_table.dynamodb_table_id
    BUCKET_NAME   = module.user_images.s3_bucket_id
  }

  allowed_triggers = {
    ScanAmiRule = {
      principal  = "sqs.amazonaws.com"
      source_arn = module.sqs.userimage.queue_arn
    }
  }

  event_source_mapping = {
    sqs = {
      event_source_arn = module.sqs.userimage.queue_arn
    }
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
            "Resource": "${module.dynamodb_image_table.dynamodb_table_arn}"
        },
        {
            "Effect": "Allow",
            "Action": [
                "sqs:ReceiveMessage",
                "sqs:DeleteMessage",
                "sqs:GetQueueAttributes"
            ],
            "Resource": "${module.sqs.userimage.queue_arn}"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:PutObject"
            ],
            "Resource": "${module.user_images.s3_bucket_arn}/*"
        }
    ]
}
EOF

  source_path = "./src/process_image"
  tags        = local.common_tags
}

module "lambda_delete_user_by_id" {
  source  = "terraform-aws-modules/lambda/aws"
  version = "7.9.0"

  function_name                           = "lambda_delete_user_by_id"
  description                             = "Delete items By ID from DynamoDB"
  handler                                 = "index.handler"
  runtime                                 = "nodejs20.x"
  attach_policy_json                      = true
  tracing_mode                            = "Active"
  attach_tracing_policy                   = true
  create_current_version_allowed_triggers = false

  environment_variables = {
    TABLE_NAME  = module.dynamodb_users_table.dynamodb_table_id
    BUCKET_NAME = module.user_images.s3_bucket_id
    KEY_NAME    = "id"
  }

  allowed_triggers = {
    APIGateway = {
      service    = "apigateway"
      source_arn = "${module.api_gateway.api_execution_arn}/*"
    },
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
            "Resource": "${module.dynamodb_users_table.dynamodb_table_arn}"
        },
        {
            "Effect": "Allow",
            "Action": [
                "s3:DeleteObject"
            ],
            "Resource": "${module.user_images.s3_bucket_arn}/*"
        }
    ]
}
EOF

  source_path = "./src/delete_user"

  tags = local.common_tags
}

module "api_gateway" {
  source  = "terraform-aws-modules/apigateway-v2/aws"
  version = "5.2.0"

  name                  = "random-user"
  description           = "Serveless CRUD project"
  protocol_type         = "HTTP"
  create_certificate    = false
  create_domain_name    = false
  create_domain_records = false

  authorizers = {
    lambda = {
      authorizer_type                   = "REQUEST"
      authorizer_payload_format_version = "2.0"
      identity_sources                  = ["$request.header.Authorization"]
      name                              = "lambda_authorizer"
      authorizer_uri                    = module.lambda_authorizer.lambda_function_invoke_arn
    }
  }

  routes = {
    "GET /" = {
      integration = {
        uri = module.lambda_get_user.lambda_function_arn
      }
      authorizer_key     = "lambda"
      authorization_type = "CUSTOM"
    },
    "GET /random" = {
      integration = {
        uri = module.lambda_create_random_user.lambda_function_arn
      }
      authorizer_key     = "lambda"
      authorization_type = "CUSTOM"

    },
    "DELETE /{username}" = {
      integration = {
        uri = module.lambda_delete_user_by_id.lambda_function_arn
      }
      authorizer_key     = "lambda"
      authorization_type = "CUSTOM"
    }
  }

  tags = local.common_tags
}