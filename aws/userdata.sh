#!/bin/bash
exec > /var/log/user-data.log 2>&1
set -e

echo "=== 1. System packages update ==="
dnf update -y
dnf install -y python3.11 python3.11-pip tar gzip

echo "=== 2. Fetch and extract application bundle ==="
mkdir -p /opt/evdepot
aws s3 cp s3://cdk-hnb659fds-assets-600558611810-us-east-1/deploy/ev-depot-app.tar.gz /tmp/app.tar.gz --region us-east-1
tar -xzf /tmp/app.tar.gz -C /opt/evdepot

echo "=== 3. Setup Python virtual environment & dependencies ==="
cd /opt/evdepot
python3.11 -m venv /opt/evdepot/venv
/opt/evdepot/venv/bin/pip install --upgrade pip
/opt/evdepot/venv/bin/pip install -r /opt/evdepot/requirements.txt

echo "=== 4. Configure systemd service ==="
cat << 'EOF' > /etc/systemd/system/evdepot.service
[Unit]
Description=Carbon-Aware EV Depot Orchestrator
After=network.target

[Service]
User=root
WorkingDirectory=/opt/evdepot
EnvironmentFile=/opt/evdepot/.env
ExecStart=/opt/evdepot/venv/bin/python3 -m uvicorn backend.main:app --host 0.0.0.0 --port 80
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable evdepot
systemctl start evdepot

echo "=== 5. Initialize live DynamoDB tables if needed ==="
/opt/evdepot/venv/bin/python3 -c "
import os
os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'
from backend.aws_client import aws_manager
from backend.simulator import depot_simulator
try:
    aws_manager.ensure_dynamodb_tables()
    depot_simulator.reset()
    print('DynamoDB sync completed successfully')
except Exception as e:
    print('DynamoDB sync note:', e)
"

echo "=== 6. EV Depot Orchestrator Deployment Finished successfully ==="
