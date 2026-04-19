import { VERSION } from "../index.js";

export function printHelp() {
  console.log(`
create-seamless v${VERSION}

Seamless Auth CLI — scaffold, validate, deploy, and manage full-stack authentication systems.

────────────────────────────────────────────

USAGE

  seamless init [project-name]
  seamless check
  seamless deploy
  seamless destroy
  seamless bootstrap-admin [email]
  seamless --help
  seamless --version

────────────────────────────────────────────

COMMANDS

  init [project-name]
    Scaffold a new Seamless Auth project

    Without a name:
      • Creates project in current directory

    With a name:
      • Creates new directory

  check
    Validate project setup, Docker, and running services

  deploy
    Configure and deploy a Seamless project to AWS

    Current implementation:
      • Dev tier
      • Route 53 hosted zone selection
      • ACM + HTTPS
      • ALB with subdomain routing
      • ECS on EC2
      • CloudWatch logs
      • S3 database backups
      • ECR image management
      • Generated Terraform in infra/aws/dev

    Deploys:
      • Web app
      • API server
      • Seamless Auth server
      • Admin dashboard
      • Postgres database

  destroy
    Destroy deployed infrastructure and delete managed ECR repositories

    Includes:
      • Terraform destroy for generated AWS infrastructure
      • ECR image and repository cleanup
      • Removal of generated local deploy artifacts

  bootstrap-admin [email]
    Create a bootstrap admin invite

    Automatically resolves bootstrap secret from:
      • .env
      • auth/.env
      • docker-compose.yml

    If not found, you will be prompted.

    Examples:
      seamless bootstrap-admin
      seamless bootstrap-admin admin@example.com

────────────────────────────────────────────

BEHAVIOR

  seamless <project-name>

    • Shortcut for: seamless init <project-name>

────────────────────────────────────────────

GETTING STARTED

  Local development:
    1. seamless init
    2. docker-compose up
    3. seamless bootstrap-admin

      → Complete registration to become admin

  AWS deployment:
    1. seamless init
    2. seamless deploy

      → Follow prompts for AWS, domain, and deploy settings

────────────────────────────────────────────

WHAT YOU GET

  • Web application (React starter)
  • API server (Express)
  • Seamless Auth server (Docker or local)
  • Admin dashboard (Docker or source)
  • Docker Compose setup
  • AWS deploy scaffolding
  • Terraform infrastructure generation
  • Managed ECR image flow
  • HTTPS subdomain routing for deployment

────────────────────────────────────────────

EXAMPLES

  seamless init
    → Interactive setup in current directory

  seamless init my-app
    → Create new project in ./my-app

  seamless my-app
    → Shortcut for init

  seamless check
    → Validate your project

  seamless deploy
    → Deploy your project to AWS

  seamless destroy
    → Tear down deployed infrastructure and clean up managed ECR repos

  seamless bootstrap-admin
    → Create your first admin user

────────────────────────────────────────────

DOCS

  https://docs.seamlessauth.com

`);
}
