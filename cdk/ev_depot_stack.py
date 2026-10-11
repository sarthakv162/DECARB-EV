"""
AWS CDK Stack for Carbon-Aware EV Depot Orchestrator.
Deploys:
- 4x DynamoDB Tables (Fleet, Chargers, Schedules, Disruptions)
- EventBridge Custom Event Bus (ev-depot-bus)
- Bedrock & Step Functions IAM Execution Roles
- CloudWatch Operational Monitoring Dashboard & Alarms
- Step Functions State Machine
"""

import os
from constructs import Construct
from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_dynamodb as dynamodb,
    aws_events as events,
    aws_iam as iam,
    aws_cloudwatch as cloudwatch,
    aws_stepfunctions as sfn,
    aws_stepfunctions_tasks as tasks,
)


class EVDepotStack(Stack):
    def __init__(self, scope: Construct, construct_id: str, **kwargs) -> None:
        super().__init__(scope, construct_id, **kwargs)

        # 1. Amazon DynamoDB Tables
        self.fleet_table = dynamodb.Table(
            self,
            "EVDepotFleetTable",
            table_name="EVDepotFleetState",
            partition_key=dynamodb.Attribute(name="VehicleId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            point_in_time_recovery=True,
            removal_policy=RemovalPolicy.DESTROY,
        )

        self.charger_table = dynamodb.Table(
            self,
            "EVDepotChargerTable",
            table_name="EVDepotChargerState",
            partition_key=dynamodb.Attribute(name="ChargerId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        self.schedules_table = dynamodb.Table(
            self,
            "EVDepotSchedulesTable",
            table_name="EVDepotActiveSchedules",
            partition_key=dynamodb.Attribute(name="ScheduleId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        self.disruptions_table = dynamodb.Table(
            self,
            "EVDepotDisruptionsTable",
            table_name="EVDepotDisruptions",
            partition_key=dynamodb.Attribute(name="EventId", type=dynamodb.AttributeType.STRING),
            billing_mode=dynamodb.BillingMode.PAY_PER_REQUEST,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # 2. Amazon EventBridge Custom Event Bus
        self.event_bus = events.EventBus(
            self,
            "EVDepotEventBus",
            event_bus_name="ev-depot-bus",
        )

        # 3. IAM Role for Bedrock & Agent Execution
        self.agent_role = iam.Role(
            self,
            "EVDepotAgentRole",
            assumed_by=iam.ServicePrincipal("lambda.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AWSLambdaBasicExecutionRole"),
            ],
        )

        self.agent_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "bedrock:InvokeModel",
                    "bedrock:InvokeModelWithResponseStream",
                ],
                resources=["*"],
            )
        )

        self.fleet_table.grant_read_write_data(self.agent_role)
        self.charger_table.grant_read_write_data(self.agent_role)
        self.schedules_table.grant_read_write_data(self.agent_role)
        self.disruptions_table.grant_read_write_data(self.agent_role)
        self.event_bus.grant_put_events_to(self.agent_role)

        # 4. Amazon CloudWatch Operational Dashboard
        self.dashboard = cloudwatch.Dashboard(
            self,
            "EVDepotDashboard",
            dashboard_name="EVDepot-Operational-Orchestration",
        )

        carbon_metric = cloudwatch.Metric(
            namespace="EVDepot/Orchestration",
            metric_name="CarbonAvoidedKg",
            statistic="Maximum",
            period=Duration.minutes(5),
            label="Carbon Avoided (kg CO2e)",
        )

        cost_metric = cloudwatch.Metric(
            namespace="EVDepot/Orchestration",
            metric_name="CostSavedRupees",
            statistic="Maximum",
            period=Duration.minutes(5),
            label="Cost Saved (₹)",
        )

        peak_metric = cloudwatch.Metric(
            namespace="EVDepot/Orchestration",
            metric_name="PeakDemandKW",
            statistic="Maximum",
            period=Duration.minutes(5),
            label="Peak Power Demand (kW)",
        )

        self.dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="Environmental & Financial Impact",
                left=[carbon_metric],
                right=[cost_metric],
                width=12,
            ),
            cloudwatch.GraphWidget(
                title="Depot Transformer Demand vs 250 kW Limit",
                left=[peak_metric],
                left_annotations=[
                    cloudwatch.HorizontalAnnotation(value=250.0, label="250 kW Transformer Ceiling", color="#f43f5e")
                ],
                width=12,
            ),
        )

        # 5. CloudWatch Alarm for Transformer Peak Overload
        self.peak_alarm = cloudwatch.Alarm(
            self,
            "TransformerOverloadAlarm",
            alarm_name="EVDepot-TransformerOverloadRisk",
            metric=peak_metric,
            threshold=250.0,
            evaluation_periods=1,
            datapoints_to_alarm=1,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
        )

        # CloudFormation Outputs
        CfnOutput(self, "EventBusArn", value=self.event_bus.event_bus_arn)
        CfnOutput(self, "FleetTableName", value=self.fleet_table.table_name)
        CfnOutput(self, "SchedulesTableName", value=self.schedules_table.table_name)
        CfnOutput(self, "CloudWatchDashboardName", value=self.dashboard.dashboard_name)
