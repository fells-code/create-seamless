import {
  DeployEnvVar,
  DeployManifest,
} from "../../../../core/deployManifest.js";

function tf(value: string): string {
  return value.replace(/"/g, '\\"');
}

function escapeTfString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n");
}

function renderEnvEntries(
  vars: Array<{ name: string; value: string }>,
): string {
  return vars
    .map(
      (envVar) =>
        `{ name = "${escapeTfString(envVar.name)}", value = "${escapeTfString(envVar.value)}" }`,
    )
    .join(",\n        ");
}

function renderUserEnvVars(
  vars: DeployEnvVar[],
): Array<{ name: string; value: string }> {
  return vars
    .filter((envVar) => envVar.target === "task_definition")
    .map((envVar) => ({
      name: envVar.key,
      value: envVar.value,
    }));
}

export function renderMainTf(): string {
  return `
terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }

    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region  = var.aws_region
  profile = var.aws_profile
}
`.trimStart();
}

export function renderVariablesTf(manifest: DeployManifest): string {
  return `
variable "project_name" {
  type    = string
  default = "${tf(manifest.projectName)}"
}

variable "aws_region" {
  type    = string
  default = "${tf(manifest.region)}"
}

variable "aws_profile" {
  type    = string
  default = "${tf(manifest.awsProfile)}"
}

variable "root_domain" {
  type    = string
  default = "${tf(manifest.domain.root)}"
}

variable "hosted_zone_domain" {
  type    = string
  default = "${tf(manifest.domain.hostedZoneDomain ?? manifest.domain.root)}"
}

variable "web_host" {
  type    = string
  default = "${tf(manifest.domain.webHost)}"
}

variable "api_host" {
  type    = string
  default = "${tf(manifest.domain.apiHost)}"
}

variable "auth_host" {
  type    = string
  default = "${tf(manifest.domain.authHost)}"
}

variable "admin_host" {
  type    = string
  default = "${tf(manifest.domain.adminHost)}"
}

variable "backup_enabled" {
  type    = bool
  default = ${manifest.backup.enabled ? "true" : "false"}
}

variable "backup_retention_days" {
  type    = number
  default = ${manifest.backup.retentionDays}
}

variable "web_image" {
  type    = string
  default = "REPLACE_WEB_IMAGE_URI"
}

variable "api_image" {
  type    = string
  default = "REPLACE_API_IMAGE_URI"
}

variable "auth_image" {
  type    = string
  default = "REPLACE_AUTH_IMAGE_URI"
}

variable "admin_image" {
  type    = string
  default = "REPLACE_ADMIN_IMAGE_URI"
}

variable "postgres_image" {
  type    = string
  default = "REPLACE_POSTGRES_IMAGE_URI"
}

variable "ecs_instance_type" {
  type    = string
  default = "t3.large"
}

variable "desired_capacity" {
  type    = number
  default = 1
}

variable "api_origin" {
  type = string
}

variable "auth_issuer" {
  type = string
}

variable "web_origin" {
  type = string
}

variable "admin_origin" {
  type = string
}

variable "rpid" {
  type = string
}

variable "api_service_token" {
  type      = string
  sensitive = true
}

variable "cookie_signing_key" {
  type      = string
  sensitive = true
}

variable "bootstrap_secret" {
  type      = string
  sensitive = true
}

variable "auth_db_user" {
  type = string
}

variable "auth_db_password" {
  type      = string
  sensitive = true
}

variable "auth_db_name" {
  type = string
}

variable "api_db_user" {
  type = string
}

variable "api_db_password" {
  type      = string
  sensitive = true
}

variable "api_db_name" {
  type = string
}

variable "jwks_active_kid" {
  type = string
}

variable "seamless_jwks_active_kid" {
  type = string
}

variable "jwks_private_key" {
  type      = string
  sensitive = true
}

variable "jwks_public_keys" {
  type      = string
  sensitive = true
}

locals {
  app_slug = replace(lower(var.project_name), " ", "-")
  common_tags = {
    Project = var.project_name
    Tier    = "dev"
    Managed = "seamless-cli"
  }
}
`.trimStart();
}

export function renderNetworkingTf(): string {
  return `
resource "aws_vpc" "main" {
  cidr_block           = "10.40.0.0/16"
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(local.common_tags, {
    Name = "\${local.app_slug}-vpc"
  })
}

resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "\${local.app_slug}-igw"
  })
}

resource "aws_subnet" "public_a" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.40.1.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "\${var.aws_region}a"

  tags = merge(local.common_tags, {
    Name = "\${local.app_slug}-public-a"
  })
}

resource "aws_subnet" "public_b" {
  vpc_id                  = aws_vpc.main.id
  cidr_block              = "10.40.2.0/24"
  map_public_ip_on_launch = true
  availability_zone       = "\${var.aws_region}b"

  tags = merge(local.common_tags, {
    Name = "\${local.app_slug}-public-b"
  })
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  tags = merge(local.common_tags, {
    Name = "\${local.app_slug}-public-rt"
  })
}

resource "aws_route" "internet_access" {
  route_table_id         = aws_route_table.public.id
  destination_cidr_block = "0.0.0.0/0"
  gateway_id             = aws_internet_gateway.main.id
}

resource "aws_route_table_association" "public_a" {
  subnet_id      = aws_subnet.public_a.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_b" {
  subnet_id      = aws_subnet.public_b.id
  route_table_id = aws_route_table.public.id
}
`.trimStart();
}

export function renderRoute53Tf(): string {
  return `
data "aws_route53_zone" "main" {
  name         = var.hosted_zone_domain
  private_zone = false
}

resource "aws_route53_record" "web" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.web_host
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "api" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.api_host
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "auth" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.auth_host
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}

resource "aws_route53_record" "admin" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = var.admin_host
  type    = "A"

  alias {
    name                   = aws_lb.main.dns_name
    zone_id                = aws_lb.main.zone_id
    evaluate_target_health = true
  }
}
`.trimStart();
}

export function renderAcmTf(): string {
  return `
variable "acm_certificate_arn" {
  type = string
}
`.trimStart();
}

export function renderAlbTf(): string {
  return `
resource "aws_security_group" "alb" {
  name        = "\${local.app_slug}-alb-sg"
  description = "ALB security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 80
    to_port     = 80
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_lb" "main" {
  name               = substr("\${local.app_slug}-alb", 0, 32)
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = [aws_subnet.public_a.id, aws_subnet.public_b.id]

  tags = local.common_tags
}

resource "aws_lb_target_group" "web" {
  name        = substr("\${local.app_slug}-web", 0, 32)
  port        = 80
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = aws_vpc.main.id

  health_check {
    path = "/"
  }

  tags = local.common_tags
}

resource "aws_lb_target_group" "api" {
  name        = substr("\${local.app_slug}-api", 0, 32)
  port        = 3000
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = aws_vpc.main.id

  health_check {
    path = "/health"
  }

  tags = local.common_tags
}

resource "aws_lb_target_group" "admin" {
  name        = substr("\${local.app_slug}-admin", 0, 32)
  port        = 80
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = aws_vpc.main.id

  health_check {
    path = "/"
  }

  tags = local.common_tags
}

resource "aws_lb_target_group" "auth" {
  name        = substr("\${local.app_slug}-auth", 0, 32)
  port        = 5312
  protocol    = "HTTP"
  target_type = "instance"
  vpc_id      = aws_vpc.main.id

  health_check {
    path = "/health/status"
  }

  tags = local.common_tags
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"

    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  certificate_arn   = var.acm_certificate_arn
  ssl_policy        = "ELBSecurityPolicy-2016-08"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.web.arn
  }
}

resource "aws_lb_listener_rule" "api" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 10

  condition {
    host_header {
      values = [var.api_host]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.api.arn
  }
}

resource "aws_lb_listener_rule" "auth" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 20

  condition {
    host_header {
      values = [var.auth_host]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.auth.arn
  }
}

resource "aws_lb_listener_rule" "admin" {
  listener_arn = aws_lb_listener.https.arn
  priority     = 30

  condition {
    host_header {
      values = [var.admin_host]
    }
  }

  action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.admin.arn
  }
}
`.trimStart();
}

export function renderLogsTf(manifest: DeployManifest): string {
  return `
resource "aws_cloudwatch_log_group" "web" {
  name              = "/${tf(manifest.projectName)}/dev/web"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "api" {
  name              = "/${tf(manifest.projectName)}/dev/api"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "auth" {
  name              = "/${tf(manifest.projectName)}/dev/auth"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "admin" {
  name              = "/${tf(manifest.projectName)}/dev/admin"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "postgres" {
  name              = "/${tf(manifest.projectName)}/dev/postgres"
  retention_in_days = 14
  tags              = local.common_tags
}

resource "aws_cloudwatch_log_group" "backup" {
  name              = "/${tf(manifest.projectName)}/dev/backup"
  retention_in_days = 14
  tags              = local.common_tags
}
`.trimStart();
}

export function renderS3Tf(): string {
  return `
resource "random_id" "bucket_suffix" {
  byte_length = 4
}

resource "aws_s3_bucket" "backups" {
  bucket = "\${local.app_slug}-db-backups-\${random_id.bucket_suffix.hex}"

  tags = local.common_tags
}

resource "aws_s3_bucket_versioning" "backups" {
  bucket = aws_s3_bucket.backups.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "backups" {
  bucket = aws_s3_bucket.backups.id

  rule {
    id     = "expire-old-backups"
    status = "Enabled"

    filter {}

    expiration {
      days = var.backup_retention_days
    }
  }
}
`.trimStart();
}

export function renderIamTf(): string {
  return `
resource "aws_iam_role" "ecs_task_execution" {
  name = "\${local.app_slug}-ecs-task-execution-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution_default" {
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
}

resource "aws_iam_role" "ecs_task_role" {
  name = "\${local.app_slug}-ecs-task-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "ecs-tasks.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_policy" "backup_s3" {
  name = "\${local.app_slug}-backup-s3-policy"

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = [
          "s3:PutObject",
          "s3:ListBucket"
        ],
        Resource = [
          aws_s3_bucket.backups.arn,
          "\${aws_s3_bucket.backups.arn}/*"
        ]
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_backup_s3" {
  role       = aws_iam_role.ecs_task_role.name
  policy_arn = aws_iam_policy.backup_s3.arn
}

resource "aws_iam_role" "ecs_instance_role" {
  name = "\${local.app_slug}-ecs-instance-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Action = "sts:AssumeRole",
      Effect = "Allow",
      Principal = {
        Service = "ec2.amazonaws.com"
      }
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy_attachment" "ecs_instance_ec2_container" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AmazonEC2ContainerServiceforEC2Role"
}

resource "aws_iam_role_policy_attachment" "ecs_instance_ssm" {
  role       = aws_iam_role.ecs_instance_role.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ecs" {
  name = "\${local.app_slug}-ecs-instance-profile"
  role = aws_iam_role.ecs_instance_role.name
}
`.trimStart();
}

export function renderEc2Tf(): string {
  return `
data "aws_ssm_parameter" "ecs_optimized_ami" {
  name = "/aws/service/ecs/optimized-ami/amazon-linux-2/recommended/image_id"
}

resource "aws_security_group" "ecs_host" {
  name        = "\${local.app_slug}-ecs-host-sg"
  description = "ECS host security group"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 32768
    to_port         = 65535
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 80
    to_port         = 80
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 3001
    to_port         = 3001
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 4173
    to_port         = 4173
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  ingress {
    from_port       = 5312
    to_port         = 5312
    protocol        = "tcp"
    security_groups = [aws_security_group.alb.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = local.common_tags
}

resource "aws_launch_template" "ecs" {
  name_prefix   = "\${local.app_slug}-ecs-"
  image_id      = data.aws_ssm_parameter.ecs_optimized_ami.value
  instance_type = var.ecs_instance_type

  iam_instance_profile {
    arn = aws_iam_instance_profile.ecs.arn
  }

  network_interfaces {
    associate_public_ip_address = true
    security_groups             = [aws_security_group.ecs_host.id]
  }

  user_data = base64encode(<<-EOF
    #!/bin/bash
    echo ECS_CLUSTER=\${aws_ecs_cluster.main.name} >> /etc/ecs/ecs.config
  EOF
  )

  tag_specifications {
    resource_type = "instance"

    tags = merge(local.common_tags, {
      Name = "\${local.app_slug}-ecs-instance"
    })
  }

  tags = local.common_tags
}

resource "aws_autoscaling_group" "ecs" {
  name                = "\${local.app_slug}-ecs-asg"
  vpc_zone_identifier = [aws_subnet.public_a.id]
  desired_capacity    = var.desired_capacity
  min_size            = 1
  max_size            = 1
  health_check_type   = "EC2"

  launch_template {
    id      = aws_launch_template.ecs.id
    version = "$Latest"
  }

  tag {
    key                 = "Name"
    value               = "\${local.app_slug}-ecs-instance"
    propagate_at_launch = true
  }

  tag {
    key                 = "Project"
    value               = var.project_name
    propagate_at_launch = true
  }
}
`.trimStart();
}

export function renderEcsTf(manifest: DeployManifest): string {
  const webEnv = [
    { name: "API_URL", value: "${var.api_origin}" },
    ...renderUserEnvVars(manifest.env.web),
  ];

  const apiEnv = [
    { name: "AUTH_SERVER_URL", value: "http://127.0.0.1:5312" },
    { name: "APP_ORIGINS", value: "${var.api_origin}" },
    { name: "UI_ORIGINS", value: "${var.web_origin},${var.admin_origin}" },
    { name: "COOKIE_SIGNING_KEY", value: "${var.cookie_signing_key}" },
    { name: "API_SERVICE_TOKEN", value: "${var.api_service_token}" },
    { name: "JWKS_KID", value: "${var.jwks_active_kid}" },
    { name: "DB_HOST", value: "127.0.0.1" },
    { name: "DB_PORT", value: "5432" },
    { name: "DB_USER", value: "${var.api_db_user}" },
    { name: "DB_PASSWORD", value: "${var.api_db_password}" },
    { name: "DB_NAME", value: "${var.api_db_name}" },
    { name: "SQL_LOGGING", value: "false" },
    ...renderUserEnvVars(manifest.env.api),
  ];

  const authEnv = [
    { name: "NODE_ENV", value: "production" },
    { name: "APP_NAME", value: "${var.project_name}" },
    { name: "APP_ID", value: "${local.app_slug}-dev" },
    { name: "APP_ORIGINS", value: "${var.api_origin}" },
    { name: "ISSUER", value: "${var.auth_issuer}" },
    { name: "AUTH_MODE", value: "server" },
    { name: "DEMO", value: "false" },
    { name: "DEFAULT_ROLES", value: "user,betaUser" },
    { name: "AVAILABLE_ROLES", value: "user,admin,betaUser,team" },
    { name: "DB_LOGGING", value: "false" },
    { name: "DB_HOST", value: "127.0.0.1" },
    { name: "DB_PORT", value: "5432" },
    { name: "DB_NAME", value: "${var.auth_db_name}" },
    { name: "DB_USER", value: "${var.auth_db_user}" },
    { name: "DB_PASSWORD", value: "${var.auth_db_password}" },
    { name: "ACCESS_TOKEN_TTL", value: "30m" },
    { name: "REFRESH_TOKEN_TTL", value: "1h" },
    { name: "RATE_LIMIT", value: "100" },
    { name: "DELAY_AFTER", value: "50" },
    { name: "API_SERVICE_TOKEN", value: "${var.api_service_token}" },
    { name: "JWKS_ACTIVE_KID", value: "${var.jwks_active_kid}" },
    {
      name: "SEAMLESS_JWKS_ACTIVE_KID",
      value: "${var.seamless_jwks_active_kid}",
    },
    {
      name: "SEAMLESS_JWKS_KEY_main_PRIVATE",
      value: "${var.jwks_private_key}",
    },
    { name: "JWKS_PUBLIC_KEYS", value: "${var.jwks_public_keys}" },
    { name: "RPID", value: "${var.rpid}" },
    { name: "ORIGINS", value: "${var.web_origin},${var.admin_origin}" },
    { name: "SEAMLESS_BOOTSTRAP_ENABLED", value: "true" },
    { name: "SEAMLESS_BOOTSTRAP_SECRET", value: "${var.bootstrap_secret}" },
    ...renderUserEnvVars(manifest.env.auth),
  ];

  const adminEnv = [
    { name: "API_URL", value: "${var.api_origin}" },
    { name: "AUTH_MODE", value: "server" },
    ...renderUserEnvVars(manifest.env.admin),
  ];

  return `
resource "aws_ecs_cluster" "main" {
  name = "\${local.app_slug}-cluster"
  tags = local.common_tags
}

resource "aws_ecs_task_definition" "app" {
  family                   = "\${local.app_slug}-app"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = "1024"
  memory                   = "3584"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name      = "web"
      image     = var.web_image
      essential = true
      memoryReservation = 128
      environment = [
        ${renderEnvEntries(webEnv)}
      ]
      portMappings = [
        {
          containerPort = 80
          hostPort      = 0
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.web.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "web"
        }
      }
    },
    {
      name      = "api"
      image     = var.api_image
      essential = true
      memoryReservation = 512
      environment = [
        ${renderEnvEntries(apiEnv)}
      ]
      portMappings = [
        {
          containerPort = 3000
          hostPort      = 0
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.api.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "api"
        }
      }
    },
    {
      name      = "auth"
      image     = var.auth_image
      essential = true
      memoryReservation = 512
      environment = [
        ${renderEnvEntries(authEnv)}
      ]
      portMappings = [
        {
          containerPort = 5312
          hostPort      = 0
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.auth.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "auth"
        }
      }
    },
    {
      name      = "admin"
      image     = var.admin_image
      essential = true
      memoryReservation = 128
      environment = [
        ${renderEnvEntries(adminEnv)}
      ]
      portMappings = [
        {
          containerPort = 80
          hostPort      = 0
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.admin.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "admin"
        }
      }
    },
    {
      name      = "postgres"
      image     = var.postgres_image
      essential = true
      memoryReservation = 1024
      environment = [
        { name = "POSTGRES_USER", value = "postgres" },
        { name = "POSTGRES_PASSWORD", value = "postgres-dev-root-password" }
      ]
      portMappings = [
        {
          containerPort = 5432
          hostPort      = 5432
          protocol      = "tcp"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.postgres.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "postgres"
        }
      }
      mountPoints = [
        {
          sourceVolume  = "postgres_data"
          containerPath = "/var/lib/postgresql/data"
          readOnly      = false
        }
      ]
    }
  ])

  volume {
    name = "postgres_data"
  }

  tags = local.common_tags
}

resource "aws_ecs_service" "app" {
  name            = "\${local.app_slug}-service"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.app.arn
  desired_count   = 1
  launch_type     = "EC2"

  load_balancer {
    target_group_arn = aws_lb_target_group.web.arn
    container_name   = "web"
    container_port   = 80
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.api.arn
    container_name   = "api"
    container_port   = 3000
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.auth.arn
    container_name   = "auth"
    container_port   = 5312
  }

  load_balancer {
    target_group_arn = aws_lb_target_group.admin.arn
    container_name   = "admin"
    container_port   = 80
  }

  depends_on = [
    aws_lb_listener.https,
    aws_autoscaling_group.ecs
  ]
}
`.trimStart();
}

export function renderBackupTf(): string {
  return `
locals {
  backup_schedule_expression = (
    var.backup_enabled == false ? null :
    "cron(0 5 * * ? *)"
  )

  backup_command = "export PGPASSWORD=postgres-dev-root-password && mkdir -p /tmp/backups && pg_dump -h 127.0.0.1 -U postgres -d postgres | gzip > /tmp/backups/backup.sql.gz && apt-get update >/dev/null 2>&1 && apt-get install -y awscli >/dev/null 2>&1 && aws s3 cp /tmp/backups/backup.sql.gz s3://\${aws_s3_bucket.backups.bucket}/postgres/dev/backup-$(date +%Y%m%d%H%M%S).sql.gz"
}

resource "aws_ecs_task_definition" "backup" {
  count                    = var.backup_enabled ? 1 : 0
  family                   = "\${local.app_slug}-backup"
  network_mode             = "bridge"
  requires_compatibilities = ["EC2"]
  cpu                      = "128"
  memory                   = "256"
  execution_role_arn       = aws_iam_role.ecs_task_execution.arn
  task_role_arn            = aws_iam_role.ecs_task_role.arn

  container_definitions = jsonencode([
    {
      name       = "backup"
      image      = "postgres:16"
      essential  = true
      entryPoint = ["/bin/sh", "-lc"]
      command    = [local.backup_command]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = aws_cloudwatch_log_group.backup.name
          awslogs-region        = var.aws_region
          awslogs-stream-prefix = "backup"
        }
      }
    }
  ])

  tags = local.common_tags
}

resource "aws_cloudwatch_event_rule" "backup" {
  count               = var.backup_enabled ? 1 : 0
  name                = "\${local.app_slug}-backup-schedule"
  schedule_expression = local.backup_schedule_expression
}

resource "aws_iam_role" "events_invoke_ecs" {
  count = var.backup_enabled ? 1 : 0
  name  = "\${local.app_slug}-events-invoke-ecs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17",
    Statement = [{
      Effect = "Allow",
      Principal = { Service = "events.amazonaws.com" },
      Action = "sts:AssumeRole"
    }]
  })

  tags = local.common_tags
}

resource "aws_iam_role_policy" "events_invoke_ecs" {
  count = var.backup_enabled ? 1 : 0
  name  = "\${local.app_slug}-events-invoke-ecs-policy"
  role  = aws_iam_role.events_invoke_ecs[0].id

  policy = jsonencode({
    Version = "2012-10-17",
    Statement = [
      {
        Effect = "Allow",
        Action = ["ecs:RunTask"],
        Resource = [aws_ecs_task_definition.backup[0].arn]
      },
      {
        Effect = "Allow",
        Action = ["iam:PassRole"],
        Resource = [
          aws_iam_role.ecs_task_execution.arn,
          aws_iam_role.ecs_task_role.arn
        ]
      }
    ]
  })
}

resource "aws_cloudwatch_event_target" "backup" {
  count    = var.backup_enabled ? 1 : 0
  rule     = aws_cloudwatch_event_rule.backup[0].name
  arn      = aws_ecs_cluster.main.arn
  role_arn = aws_iam_role.events_invoke_ecs[0].arn

  ecs_target {
    launch_type         = "EC2"
    task_definition_arn = aws_ecs_task_definition.backup[0].arn
    task_count          = 1
  }
}
`.trimStart();
}

export function renderOutputsTf(): string {
  return `
output "web_url" {
  value = "https://\${var.web_host}"
}

output "api_url" {
  value = "https://\${var.api_host}"
}

output "auth_url" {
  value = "https://\${var.auth_host}"
}

output "admin_url" {
  value = "https://\${var.admin_host}"
}

output "backup_bucket_name" {
  value = aws_s3_bucket.backups.bucket
}
`.trimStart();
}

export function renderPostgresInitSql(manifest: DeployManifest): string {
  const authUser = manifest.runtime.secrets.authDbUser.replace(/'/g, "''");
  const authPassword = manifest.runtime.secrets.authDbPassword.replace(
    /'/g,
    "''",
  );
  const authDbName = manifest.runtime.secrets.authDbName.replace(/'/g, "''");

  const apiUser = manifest.runtime.secrets.apiDbUser.replace(/'/g, "''");
  const apiPassword = manifest.runtime.secrets.apiDbPassword.replace(
    /'/g,
    "''",
  );
  const apiDbName = manifest.runtime.secrets.apiDbName.replace(/'/g, "''");

  return `
DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${authUser}') THEN
      CREATE ROLE ${authUser} LOGIN PASSWORD '${authPassword}';
   END IF;
END
$$;

DO
$$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = '${apiUser}') THEN
      CREATE ROLE ${apiUser} LOGIN PASSWORD '${apiPassword}';
   END IF;
END
$$;

CREATE DATABASE ${authDbName} OWNER ${authUser};
CREATE DATABASE ${apiDbName} OWNER ${apiUser};

GRANT ALL PRIVILEGES ON DATABASE ${authDbName} TO ${authUser};
GRANT ALL PRIVILEGES ON DATABASE ${apiDbName} TO ${apiUser};
`.trimStart();
}

export function renderPostgresDockerfile(): string {
  return `
FROM postgres:16
COPY init.sql /docker-entrypoint-initdb.d/001-init.sql
`.trimStart();
}
