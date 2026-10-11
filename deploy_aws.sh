#!/usr/bin/env bash
set -e

echo "================================================================="
echo "⚡ CARBON-AWARE EV DEPOT ORCHESTRATOR - AWS DEPLOYMENT"
echo "================================================================="

# 1. Source .env if present
if [ -f ".env" ]; then
  echo "Loading environment variables from .env..."
  set -a
  source .env
  set +a
fi

# 2. Check AWS Credentials
echo "Checking AWS caller identity..."
if ! aws sts get-caller-identity > /dev/null 2>&1; then
  echo ""
  echo "❌ Error: AWS credentials not found or invalid!"
  echo "Please edit the '.env' file in this directory and enter:"
  echo "  AWS_ACCESS_KEY_ID=your_key"
  echo "  AWS_SECRET_ACCESS_KEY=your_secret"
  echo "  AWS_DEFAULT_REGION=us-east-1"
  echo "Or run: 'aws configure'"
  exit 1
fi

ACCOUNT_ID=$(aws sts get-caller-identity --query "Account" --output text)
USER_ARN=$(aws sts get-caller-identity --query "Arn" --output text)
REGION=${AWS_DEFAULT_REGION:-us-east-1}

echo "✅ Authenticated as: $USER_ARN"
echo "✅ Target AWS Account: $ACCOUNT_ID"
echo "✅ Target Region: $REGION"
echo ""

# 3. CDK Bootstrap (if required)
echo "Bootstrapping AWS CDK environment..."
export JSII_SILENCE_WARNING_UNTESTED_NODE_VERSION=1
npx --yes aws-cdk bootstrap aws://$ACCOUNT_ID/$REGION || true

# 4. Deploy CDK Stack
echo "Deploying EV Depot Infrastructure to AWS..."
npx --yes aws-cdk deploy EVDepotStack \
  --app "./.venv/bin/python3 cdk/app.py" \
  --require-approval never

echo ""
echo "5. Bootstrapping initial Fleet & Charger state into live Amazon DynamoDB..."
./.venv/bin/python3 -c "
from backend.aws_client import aws_manager
from backend.simulator import depot_simulator
print('Creating DynamoDB tables if needed...')
res = aws_manager.ensure_dynamodb_tables()
print('DynamoDB Table setup:', res)
print('Writing 40 vehicles and 10 chargers...')
depot_simulator.reset()
print('Initial fleet state synchronized successfully to AWS!')
"

echo ""
echo "================================================================="
echo "🎉 AWS DEPLOYMENT COMPLETE!"
echo "================================================================="
echo "Live CloudWatch Dashboard:"
echo "https://$REGION.console.aws.amazon.com/cloudwatch/home?region=$REGION#dashboards:name=EVDepot-Operational-Orchestration"
echo ""
echo "Amazon DynamoDB Tables:"
echo "https://$REGION.console.aws.amazon.com/dynamodbv2/home?region=$REGION#tables"
echo ""
echo "To launch the operations console with live AWS integration:"
echo "  ./.venv/bin/python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000"
echo "================================================================="
