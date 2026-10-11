#!/usr/bin/env python3
import os
import aws_cdk as cdk
from ev_depot_stack import EVDepotStack

app = cdk.App()

account = os.getenv("CDK_DEFAULT_ACCOUNT", os.getenv("AWS_ACCOUNT_ID"))
region = os.getenv("CDK_DEFAULT_REGION", os.getenv("AWS_DEFAULT_REGION", "us-east-1"))

env = cdk.Environment(account=account, region=region) if account else None

EVDepotStack(app, "EVDepotStack", env=env)

app.synth()
