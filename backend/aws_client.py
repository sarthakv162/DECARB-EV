"""
Live AWS Services Client Layer for Carbon-Aware EV Depot Orchestrator.
Directly interfaces with:
- Amazon DynamoDB (Fleet, Charger, Schedule, and Disruption state)
- Amazon Bedrock (Claude 3.5 Sonnet agent reasoning & HITL explanation)
- Amazon EventBridge (Custom disruption and tariff event bus)
- Amazon CloudWatch (Real operational metrics for CO2e, cost, and peak kW)
- AWS IoT Core (Simulated MQTT telemetry dispatch)
"""

import os
import json
import time
from typing import List, Dict, Optional, Any
from dotenv import load_dotenv

# Load local .env if present
load_dotenv()


class AWSIntegrationManager:
    def __init__(self):
        self.region = os.getenv("AWS_DEFAULT_REGION", os.getenv("AWS_REGION", "us-east-1"))
        self.access_key = os.getenv("AWS_ACCESS_KEY_ID")
        self.secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        self.session_token = os.getenv("AWS_SESSION_TOKEN")

        self.bedrock_model_id = os.getenv(
            "BEDROCK_MODEL_ID", "anthropic.claude-3-5-sonnet-20241022-v2:0"
        )
        self.eventbridge_bus = os.getenv("EVENTBRIDGE_BUS_NAME", "default")
        self.table_prefix = os.getenv("DYNAMODB_TABLE_PREFIX", "EVDepot")

        self.boto_session = None
        self.dynamodb = None
        self.dynamodb_client = None
        self.bedrock_runtime = None
        self.eventbridge = None
        self.cloudwatch = None
        self.iot_data = None

        self.is_connected = False
        self.connection_status_message = "AWS credentials not detected in .env"

        self._initialize_clients()

    def _initialize_clients(self):
        """Attempts to initialize Boto3 AWS service clients."""
        try:
            import boto3

            # Check if credentials exist in environment or ~/.aws
            if self.access_key and self.secret_key:
                self.boto_session = boto3.Session(
                    aws_access_key_id=self.access_key,
                    aws_secret_access_key=self.secret_key,
                    aws_session_token=self.session_token,
                    region_name=self.region,
                )
            else:
                self.boto_session = boto3.Session(region_name=self.region)

            # Test STS identity
            sts = self.boto_session.client("sts")
            identity = sts.get_caller_identity()
            account_id = identity.get("Account")
            arn = identity.get("Arn")

            self.dynamodb = self.boto_session.resource("dynamodb")
            self.dynamodb_client = self.boto_session.client("dynamodb")
            self.bedrock_runtime = self.boto_session.client("bedrock-runtime")
            self.eventbridge = self.boto_session.client("events")
            self.cloudwatch = self.boto_session.client("cloudwatch")

            try:
                self.iot_data = self.boto_session.client("iot-data")
            except Exception:
                pass

            self.is_connected = True
            self.connection_status_message = (
                f"Connected to AWS Account {account_id} ({self.region}) as {arn.split('/')[-1]}"
            )
            print(f"[AWS Live] {self.connection_status_message}")

        except Exception as e:
            self.is_connected = False
            self.connection_status_message = f"AWS Live Mode Offline: {str(e)}"
            print(f"[AWS Local Mode] {self.connection_status_message}")

    # =========================================================================
    # DYNAMODB OPERATIONS
    # =========================================================================

    def ensure_dynamodb_tables(self) -> Dict[str, str]:
        """
        Creates required DynamoDB tables in the AWS account if they do not exist.
        Uses PAY_PER_REQUEST (On-Demand billing).
        """
        if not self.is_connected or not self.dynamodb_client:
            return {"status": "SKIPPED", "reason": "AWS not connected"}

        table_configs = [
            {
                "name": f"{self.table_prefix}FleetState",
                "key_schema": [{"AttributeName": "VehicleId", "KeyType": "HASH"}],
                "attr_defs": [{"AttributeName": "VehicleId", "AttributeType": "S"}],
            },
            {
                "name": f"{self.table_prefix}ChargerState",
                "key_schema": [{"AttributeName": "ChargerId", "KeyType": "HASH"}],
                "attr_defs": [{"AttributeName": "ChargerId", "AttributeType": "S"}],
            },
            {
                "name": f"{self.table_prefix}ActiveSchedules",
                "key_schema": [{"AttributeName": "ScheduleId", "KeyType": "HASH"}],
                "attr_defs": [{"AttributeName": "ScheduleId", "AttributeType": "S"}],
            },
            {
                "name": f"{self.table_prefix}Disruptions",
                "key_schema": [{"AttributeName": "EventId", "KeyType": "HASH"}],
                "attr_defs": [{"AttributeName": "EventId", "AttributeType": "S"}],
            },
        ]

        created = []
        existing = []

        try:
            existing_tables = self.dynamodb_client.list_tables().get("TableNames", [])

            for cfg in table_configs:
                t_name = cfg["name"]
                if t_name in existing_tables:
                    existing.append(t_name)
                    continue

                self.dynamodb_client.create_table(
                    TableName=t_name,
                    KeySchema=cfg["key_schema"],
                    AttributeDefinitions=cfg["attr_defs"],
                    BillingMode="PAY_PER_REQUEST",
                )
                created.append(t_name)

            return {
                "status": "SUCCESS",
                "created": created,
                "existing": existing,
            }
        except Exception as e:
            return {"status": "ERROR", "error": str(e)}

    def sync_fleet_to_dynamodb(self, vehicles: List[Any]) -> bool:
        """Writes current fleet state into DynamoDB table."""
        if not self.is_connected or not self.dynamodb:
            return False

        try:
            table = self.dynamodb.Table(f"{self.table_prefix}FleetState")
            with table.batch_writer() as batch:
                for v in vehicles:
                    curr_soc = v.current_soc if v.current_soc is not None else v.arrival_soc
                    batch.put_item(
                        Item={
                            "VehicleId": v.id,
                            "BatteryCapacityKWh": str(v.battery_capacity_kwh),
                            "ArrivalInterval": v.arrival_interval,
                            "DepartureInterval": v.departure_interval,
                            "ArrivalSOC": str(v.arrival_soc),
                            "TargetSOC": str(v.target_soc),
                            "CurrentSOC": str(curr_soc),
                            "Priority": v.priority,
                            "LastUpdated": int(time.time()),
                        }
                    )
            return True
        except Exception as e:
            print(f"[DynamoDB Error] sync_fleet: {e}")
            return False

    def sync_chargers_to_dynamodb(self, chargers: List[Any]) -> bool:
        """Writes charger statuses into DynamoDB table."""
        if not self.is_connected or not self.dynamodb:
            return False

        try:
            table = self.dynamodb.Table(f"{self.table_prefix}ChargerState")
            with table.batch_writer() as batch:
                for c in chargers:
                    batch.put_item(
                        Item={
                            "ChargerId": c.id,
                            "MaxKW": str(c.max_kw),
                            "Status": c.status,
                            "FaultStart": c.fault_start_interval or -1,
                            "LastUpdated": int(time.time()),
                        }
                    )
            return True
        except Exception as e:
            print(f"[DynamoDB Error] sync_chargers: {e}")
            return False

    def commit_schedule_to_dynamodb(self, schedule: Any) -> bool:
        """Writes active schedule metadata to DynamoDB."""
        if not self.is_connected or not self.dynamodb:
            return False

        try:
            table = self.dynamodb.Table(f"{self.table_prefix}ActiveSchedules")
            table.put_item(
                Item={
                    "ScheduleId": schedule.schedule_id,
                    "ScheduleType": schedule.schedule_type,
                    "IsFeasible": schedule.is_feasible,
                    "TotalCost": str(schedule.total_cost),
                    "TotalCarbonKg": str(schedule.total_carbon_kg),
                    "PeakLoadKW": str(schedule.peak_load_kw),
                    "DepartureReliabilityPct": str(schedule.departure_reliability_pct),
                    "TotalEnergyKWh": str(schedule.total_energy_delivered_kwh),
                    "Timestamp": int(time.time()),
                }
            )
            return True
        except Exception as e:
            print(f"[DynamoDB Error] commit_schedule: {e}")
            return False

    # =========================================================================
    # AMAZON BEDROCK AGENT REASONING
    # =========================================================================

    def invoke_bedrock_reasoning(
        self,
        event_description: str,
        affected_vehicles: List[str],
        cost_delta: float,
        carbon_delta: float,
        peak_delta: float,
        validator_summary: str,
        reliability_pct: float,
    ) -> Optional[str]:
        """
        Calls Amazon Bedrock with Anthropic Claude 3.5 Sonnet to produce
        operator-grade justification for the re-plan.
        """
        if not self.is_connected or not self.bedrock_runtime:
            return None

        prompt = (
            f"You are the autonomous Carbon-Aware EV Depot Orchestrator Agent deployed on AWS.\n"
            f"A real-world disruption occurred: {event_description}\n\n"
            f"Actions Taken by Agent:\n"
            f"1. Evaluated dwell windows and charger constraints.\n"
            f"2. Invoked OR-Tools CP-SAT deterministic mathematical solver.\n"
            f"3. Independent safety validator certified: {validator_summary}\n\n"
            f"Operational Impact:\n"
            f"- Affected vehicles: {', '.join(affected_vehicles[:8])}\n"
            f"- Cost delta: ₹{cost_delta:+0.2f}\n"
            f"- Carbon emissions delta: {carbon_delta:+0.2f} kg CO2e\n"
            f"- Peak transformer demand delta: {peak_delta:+0.1f} kW\n"
            f"- Morning departure reliability: {reliability_pct}%\n\n"
            f"Write a concise, professional 3-sentence operational explanation to the Depot Operations Manager "
            f"explaining which vehicles were re-routed, why the schedule is physically and financially sound, "
            f"and asking for their authorization to dispatch."
        )

        try:
            payload = {
                "anthropic_version": "bedrock-2023-05-31",
                "max_tokens": 400,
                "temperature": 0.2,
                "messages": [{"role": "user", "content": prompt}],
            }

            response = self.bedrock_runtime.invoke_model(
                modelId=self.bedrock_model_id,
                body=json.dumps(payload),
            )
            res_body = json.loads(response["body"].read().decode("utf-8"))
            return res_body["content"][0]["text"]
        except Exception as e:
            print(f"[Bedrock Error] invoke_model: {e}")
            return None

    # =========================================================================
    # AMAZON EVENTBRIDGE EMISSION
    # =========================================================================

    def emit_eventbridge_event(self, event_type: str, detail: Dict[str, Any]) -> bool:
        """Publishes operational disruption event to Amazon EventBridge."""
        if not self.is_connected or not self.eventbridge:
            return False

        try:
            entry = {
                "Source": "evdepot.operations",
                "DetailType": event_type,
                "Detail": json.dumps(detail),
                "EventBusName": self.eventbridge_bus,
            }
            self.eventbridge.put_events(Entries=[entry])
            return True
        except Exception as e:
            print(f"[EventBridge Error] put_events: {e}")
            return False

    def publish_disruption_event(self, event: Any) -> bool:
        """Publishes a disruption event object to Amazon EventBridge."""
        try:
            detail = event.model_dump() if hasattr(event, "model_dump") else dict(event)
            event_type = getattr(event, "event_type", "DISRUPTION")
            return self.emit_eventbridge_event(event_type=event_type, detail=detail)
        except Exception as e:
            print(f"[EventBridge Error] publish_disruption_event: {e}")
            return False

    # =========================================================================
    # AMAZON CLOUDWATCH OPERATIONAL METRICS
    # =========================================================================

    def publish_cloudwatch_metrics(self, metrics: Any) -> bool:
        """Pushes custom operational and environmental KPIs to Amazon CloudWatch."""
        if not self.is_connected or not self.cloudwatch:
            return False

        try:
            metric_data = [
                {
                    "MetricName": "CarbonAvoidedKg",
                    "Value": float(metrics.carbon_avoided_kg),
                    "Unit": "None",
                },
                {
                    "MetricName": "CostSavedRupees",
                    "Value": float(metrics.cost_saved),
                    "Unit": "None",
                },
                {
                    "MetricName": "PeakDemandKW",
                    "Value": float(metrics.optimized_peak_kw),
                    "Unit": "Kilowatts",
                },
                {
                    "MetricName": "DepartureReliabilityPct",
                    "Value": float(metrics.optimized_reliability_pct),
                    "Unit": "Percent",
                },
                {
                    "MetricName": "EnergyShiftedKWh",
                    "Value": float(metrics.energy_shifted_kwh),
                    "Unit": "None",
                },
            ]

            self.cloudwatch.put_metric_data(
                Namespace="EVDepot/Orchestration",
                MetricData=metric_data,
            )
            return True
        except Exception as e:
            print(f"[CloudWatch Error] put_metric_data: {e}")
            return False


# Global singleton instance
aws_manager = AWSIntegrationManager()
