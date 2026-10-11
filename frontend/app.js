/**
 * Carbon-Aware EV Depot Orchestrator - Frontend Client Application
 * Handles live telemetry, HTML5 Canvas chart rendering, Gantt matrix,
 * disruption injections, and Human-in-the-Loop approval workflows.
 */

// Global Application State
let depotState = null;
let activeTab = 'load-chart';
let hoverInterval = null;

// DOM References
const elements = {
  // Status and KPIs
  depotStatusText: document.getElementById('depot-status-text'),
  awsStatusPill: document.getElementById('aws-status-pill'),
  awsStatusText: document.getElementById('aws-status-text'),
  kpiCarbonAvoided: document.getElementById('kpi-carbon-avoided'),
  kpiCarbonPct: document.getElementById('kpi-carbon-pct'),
  kpiCarbonBase: document.getElementById('kpi-carbon-base'),
  kpiCarbonOpt: document.getElementById('kpi-carbon-opt'),
  kpiCostSaved: document.getElementById('kpi-cost-saved'),
  kpiCostPct: document.getElementById('kpi-cost-pct'),
  kpiCostBase: document.getElementById('kpi-cost-base'),
  kpiCostOpt: document.getElementById('kpi-cost-opt'),
  kpiPeakShaved: document.getElementById('kpi-peak-shaved'),
  kpiPeakPct: document.getElementById('kpi-peak-pct'),
  kpiPeakBase: document.getElementById('kpi-peak-base'),
  kpiReliability: document.getElementById('kpi-reliability'),
  kpiReadyVans: document.getElementById('kpi-ready-vans'),

  // Disruption Buttons
  btnFaultC04: document.getElementById('btn-fault-c04'),
  btnDelayV08: document.getElementById('btn-delay-v08'),
  btnCarbonSpike: document.getElementById('btn-carbon-spike'),
  btnRestoreC04: document.getElementById('btn-restore-c04'),
  btnResetDepot: document.getElementById('btn-reset-depot'),

  // Tabs (Mobbin Segmented Control)
  tabBtns: document.querySelectorAll('.segment-btn'),
  tabContents: document.querySelectorAll('.tab-pane'),

  // Canvas & Tooltip
  canvas: document.getElementById('loadChartCanvas'),
  tooltip: document.getElementById('chart-tooltip'),

  // Gantt & Chargers
  ganttHeaders: document.getElementById('gantt-time-headers'),
  ganttRows: document.getElementById('gantt-rows-container'),
  chargersGrid: document.getElementById('chargers-bays-container'),

  // Agent HITL Box
  agentCard: document.querySelector('.agent-card'),
  agentLoopStatus: document.getElementById('agent-loop-status'),
  pendingApprovalBox: document.getElementById('pending-approval-box'),
  idleAgentBox: document.getElementById('idle-agent-box'),
  agentLoadingBox: document.getElementById('agent-loading-box'),
  loadingStageText: document.getElementById('loading-stage-text'),
  loadingDetailText: document.getElementById('loading-detail-text'),
  alertTitle: document.getElementById('alert-title'),
  alertDesc: document.getElementById('alert-desc'),
  agentExplanationText: document.getElementById('agent-explanation-text'),
  propCostDelta: document.getElementById('prop-cost-delta'),
  propCarbonDelta: document.getElementById('prop-carbon-delta'),
  affectedChips: document.getElementById('affected-chips'),
  btnApproveReplan: document.getElementById('btn-approve-replan'),
  btnRejectReplan: document.getElementById('btn-reject-replan'),

  // Toast Container
  toastContainer: document.getElementById('toast-container'),

  // Audit
  auditCount: document.getElementById('audit-count'),
  auditLogList: document.getElementById('audit-log-list'),
};

// ==========================================================================
// INITIALIZATION & API SYNC
// ==========================================================================

async function fetchDepotState() {
  try {
    const res = await fetch('/api/state');
    if (!res.ok) throw new Error('Failed to fetch depot state');
    depotState = await res.json();
    renderAll();
  } catch (err) {
    console.error('API Error:', err);
  }
}

function renderAll() {
  if (!depotState) return;
  renderAWSStatus();
  renderKPIs();
  renderAgentHITL();
  renderAuditLogs();

  if (activeTab === 'load-chart') {
    renderLoadChart();
  } else if (activeTab === 'gantt-view') {
    renderGanttMatrix();
  } else if (activeTab === 'charger-bays') {
    renderChargerBays();
  }
}

function renderAWSStatus() {
  const aws = depotState.aws;
  if (!aws || !elements.awsStatusPill) return;

  if (aws.is_connected) {
    elements.awsStatusPill.className = 'status-pill status-aws-connected';
    elements.awsStatusText.textContent = `AWS LIVE (${aws.region})`;
    elements.awsStatusPill.title = aws.status_message;
  } else {
    elements.awsStatusPill.className = 'status-pill status-aws-ready';
    elements.awsStatusText.textContent = 'AWS READY';
    elements.awsStatusPill.title = 'Add AWS_ACCESS_KEY_ID & AWS_SECRET_ACCESS_KEY to .env to connect to live DynamoDB, Bedrock, and CloudWatch';
  }
}

// ==========================================================================
// KPI RENDERING
// ==========================================================================

function renderKPIs() {
  const m = depotState.impact_metrics;
  if (!m) return;

  elements.kpiCarbonAvoided.textContent = m.carbon_avoided_kg.toLocaleString();
  elements.kpiCarbonPct.textContent = `-${m.carbon_avoided_pct.toFixed(1)}%`;
  elements.kpiCarbonBase.textContent = `${m.baseline_carbon_kg.toLocaleString()}`;
  elements.kpiCarbonOpt.textContent = `${m.optimized_carbon_kg.toLocaleString()}`;

  elements.kpiCostSaved.textContent = m.cost_saved.toLocaleString();
  elements.kpiCostPct.textContent = `-${m.cost_saved_pct.toFixed(1)}%`;
  elements.kpiCostBase.textContent = `${m.baseline_cost.toLocaleString()}`;
  elements.kpiCostOpt.textContent = `${m.optimized_cost.toLocaleString()}`;

  elements.kpiPeakShaved.textContent = m.peak_shaved_kw.toFixed(1);
  elements.kpiPeakPct.textContent = `-${m.peak_reduction_pct.toFixed(1)}%`;
  elements.kpiPeakBase.textContent = `${m.baseline_peak_kw.toFixed(1)} kW`;

  elements.kpiReliability.textContent = m.optimized_reliability_pct.toFixed(1);
  const readyCount = depotState.active_schedule?.vehicle_summaries.filter(v => v.is_ready_on_time).length || 40;
  elements.kpiReadyVans.textContent = `${readyCount} / ${depotState.vehicles.length}`;
}

// ==========================================================================
// AGENT HUMAN-IN-THE-LOOP (HITL) WORKFLOW
// ==========================================================================

function renderAgentHITL() {
  const prop = depotState.pending_proposal;

  if (prop && prop.status === 'PENDING_APPROVAL') {
    // Show Pending Re-Plan Box
    elements.idleAgentBox.classList.add('hidden');
    elements.agentLoadingBox?.classList.add('hidden');
    elements.pendingApprovalBox.classList.remove('hidden');
    elements.agentLoopStatus.textContent = 'APPROVAL REQUIRED';
    elements.agentLoopStatus.className = 'badge-pill badge-popular';

    elements.alertTitle.textContent = prop.trigger_event.title.toUpperCase();
    elements.alertDesc.textContent = prop.trigger_event.description;
    elements.agentExplanationText.innerHTML = prop.agent_explanation
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

    elements.propCostDelta.textContent = `${prop.cost_delta >= 0 ? '+' : ''}₹${prop.cost_delta}`;
    elements.propCarbonDelta.textContent = `${prop.carbon_delta >= 0 ? '+' : ''}${prop.carbon_delta} kg`;

    // Render interactive vehicle chips
    elements.affectedChips.innerHTML = '';
    prop.affected_vehicles.forEach(vid => {
      const chip = document.createElement('span');
      chip.className = 'vehicle-chip';
      chip.textContent = vid;
      chip.title = `Click to view ${vid} in Gantt matrix`;
      chip.addEventListener('click', () => {
        // Switch to Gantt tab and highlight van
        document.querySelector('.segment-btn[data-tab="gantt-view"]')?.click();
        showToast(`Navigated to ${vid} in 40-Vehicle Gantt Matrix.`, 'info');
      });
      elements.affectedChips.appendChild(chip);
    });
  } else if (!elements.agentLoadingBox || elements.agentLoadingBox.classList.contains('hidden')) {
    // Show Nominal Idle Box
    elements.pendingApprovalBox.classList.add('hidden');
    elements.agentLoadingBox?.classList.add('hidden');
    elements.idleAgentBox.classList.remove('hidden');
    elements.agentLoopStatus.textContent = 'MONITORING';
    elements.agentLoopStatus.className = 'badge-pill badge-neutral';
  }
}

// ==========================================================================
// AUDIT LOG RENDERING
// ==========================================================================

function renderAuditLogs() {
  const events = depotState.recent_events || [];
  elements.auditCount.textContent = events.length;
  elements.auditLogList.innerHTML = '';

  if (events.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'log-entry info';
    empty.innerHTML = `<span class="log-time">16:00</span><span class="log-text">System initialized nominal dispatch. All 10 chargers operational.</span>`;
    elements.auditLogList.appendChild(empty);
    return;
  }

  events.slice().reverse().forEach(evt => {
    const entry = document.createElement('div');
    const isFault = evt.event_type.includes('FAULT') || evt.event_type.includes('DELAY');
    entry.className = `log-entry ${isFault ? 'fault' : 'info'}`;
    entry.innerHTML = `
      <span class="log-time">${evt.timestamp}</span>
      <span class="log-text"><strong>${evt.title}:</strong> ${evt.description}</span>
    `;
    elements.auditLogList.appendChild(entry);
  });
}

// ==========================================================================
// HIGH RESOLUTION CANVAS LOAD ENVELOPE CHART
// ==========================================================================

function setupCanvasDPI(canvas) {
  const dpr = window.devicePixelRatio || 1;
  const rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  return { ctx, width: rect.width, height: rect.height };
}

function renderLoadChart() {
  if (!depotState || !elements.canvas) return;
  const { ctx, width, height } = setupCanvasDPI(elements.canvas);

  const baseLoad = depotState.baseline_schedule?.depot_load_kw || [];
  const optLoad = depotState.active_schedule?.depot_load_kw || [];
  const carbon = depotState.grid?.carbon_intensities || [];
  const timestamps = depotState.grid?.timestamps || [];
  const count = 96;

  const padLeft = 55;
  const padRight = 55;
  const padTop = 30;
  const padBottom = 40;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const maxPower = 520; // kW scale max
  const maxCarbon = 1.0; // kg/kWh scale max

  ctx.clearRect(0, 0, width, height);

  // 1. Grid Lines & Left Axis (Power kW)
  ctx.strokeStyle = '#f0f0f0';
  ctx.lineWidth = 1;
  ctx.fillStyle = '#707070';
  ctx.font = '11px Inter, sans-serif';
  ctx.textAlign = 'right';

  const powerSteps = [0, 100, 200, 250, 300, 400, 500];
  powerSteps.forEach(kw => {
    const y = padTop + chartH - (kw / maxPower) * chartH;
    ctx.beginPath();
    ctx.moveTo(padLeft, y);
    ctx.lineTo(padLeft + chartW, y);
    ctx.stroke();

    ctx.fillText(`${kw} kW`, padLeft - 8, y + 4);
  });

  // 2. Right Axis (Carbon Intensity kg/kWh - Mobbin Electric Blue)
  ctx.fillStyle = '#0066ff';
  ctx.textAlign = 'left';
  [0.2, 0.4, 0.6, 0.8, 1.0].forEach(cVal => {
    const y = padTop + chartH - (cVal / maxCarbon) * chartH;
    ctx.fillText(`${cVal.toFixed(1)}`, padLeft + chartW + 8, y + 4);
  });

  // 3. Time Ticks (Horizontal Axis)
  ctx.fillStyle = '#707070';
  ctx.textAlign = 'center';
  for (let i = 0; i < count; i += 8) { // Every 2 hours
    const x = padLeft + (i / (count - 1)) * chartW;
    ctx.fillText(timestamps[i] || '', x, padTop + chartH + 18);
  }

  // 4. Draw Transformer Limit Line (250 kW - Crisp Dashed Hairline)
  const yLimit = padTop + chartH - (250 / maxPower) * chartH;
  ctx.save();
  ctx.strokeStyle = '#dc2626';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(padLeft, yLimit);
  ctx.lineTo(padLeft + chartW, yLimit);
  ctx.stroke();
  ctx.restore();

  // 5. Draw Baseline Unmanaged Load Area (Soft Tint Wash)
  if (baseLoad.length > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + chartH);

    for (let i = 0; i < count; i++) {
      const x = padLeft + (i / (count - 1)) * chartW;
      const y = padTop + chartH - (baseLoad[i] / maxPower) * chartH;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(padLeft + chartW, padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(220, 38, 38, 0.08)';
    ctx.fill();

    // Baseline Line
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();
  }

  // 6. Draw Optimized Load Area (Mobbin Ink #141414)
  if (optLoad.length > 0) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(padLeft, padTop + chartH);

    for (let i = 0; i < count; i++) {
      const x = padLeft + (i / (count - 1)) * chartW;
      const y = padTop + chartH - (optLoad[i] / maxPower) * chartH;
      ctx.lineTo(x, y);
    }

    ctx.lineTo(padLeft + chartW, padTop + chartH);
    ctx.closePath();
    ctx.fillStyle = 'rgba(20, 20, 20, 0.06)';
    ctx.fill();

    // Optimized Line - Solid Black Ink
    ctx.strokeStyle = '#141414';
    ctx.lineWidth = 2.2;
    ctx.stroke();
    ctx.restore();
  }

  // 7. Draw Carbon Intensity Curve (Mobbin Electric Blue #0066ff)
  if (carbon.length > 0) {
    ctx.save();
    ctx.strokeStyle = '#0066ff';
    ctx.lineWidth = 2;
    ctx.beginPath();

    for (let i = 0; i < count; i++) {
      const x = padLeft + (i / (count - 1)) * chartW;
      const y = padTop + chartH - (carbon[i] / maxCarbon) * chartH;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
    ctx.restore();
  }

  // 8. Draw Hover Crosshair
  if (hoverInterval !== null && hoverInterval >= 0 && hoverInterval < count) {
    const hx = padLeft + (hoverInterval / (count - 1)) * chartW;
    ctx.save();
    ctx.strokeStyle = 'rgba(20, 20, 20, 0.2)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(hx, padTop);
    ctx.lineTo(hx, padTop + chartH);
    ctx.stroke();
    ctx.restore();
  }
}

// Chart Hover Events
elements.canvas.addEventListener('mousemove', (e) => {
  const rect = elements.canvas.getBoundingClientRect();
  const mouseX = e.clientX - rect.left;
  const padLeft = 55;
  const padRight = 55;
  const chartW = rect.width - padLeft - padRight;

  if (mouseX >= padLeft && mouseX <= padLeft + chartW) {
    const fraction = (mouseX - padLeft) / chartW;
    hoverInterval = Math.round(fraction * 95);

    // Update Tooltip
    const timeStr = depotState.grid?.timestamps[hoverInterval] || '';
    const baseVal = depotState.baseline_schedule?.depot_load_kw[hoverInterval] || 0;
    const optVal = depotState.active_schedule?.depot_load_kw[hoverInterval] || 0;
    const carbVal = depotState.grid?.carbon_intensities[hoverInterval] || 0;
    const tariffVal = depotState.grid?.tariffs[hoverInterval] || 0;

    elements.tooltip.innerHTML = `
      <div style="font-weight:650; margin-bottom:4px; color:#ffffff;">Time: ${timeStr}</div>
      <div style="color:#adadad;">Baseline Load: <strong style="color:#ffffff;">${baseVal.toFixed(1)} kW</strong></div>
      <div style="color:#adadad;">Optimized Load: <strong style="color:#ffffff;">${optVal.toFixed(1)} kW</strong></div>
      <div style="color:#60a5fa;">Grid Carbon: <strong style="color:#ffffff;">${carbVal.toFixed(3)} kg/kWh</strong></div>
      <div style="color:#adadad;">TOU Tariff: <strong style="color:#ffffff;">₹${tariffVal.toFixed(2)}/kWh</strong></div>
    `;
    elements.tooltip.classList.remove('hidden');
    elements.tooltip.style.left = `${Math.min(rect.width - 200, Math.max(10, mouseX + 15))}px`;
    elements.tooltip.style.top = `${Math.max(10, e.clientY - rect.top - 60)}px`;

    renderLoadChart();
  } else {
    hoverInterval = null;
    elements.tooltip.classList.add('hidden');
    renderLoadChart();
  }
});

elements.canvas.addEventListener('mouseleave', () => {
  hoverInterval = null;
  elements.tooltip.classList.add('hidden');
  renderLoadChart();
});

// ==========================================================================
// 40-VEHICLE GANTT MATRIX RENDERING
// ==========================================================================

function renderGanttMatrix() {
  if (!depotState || !elements.ganttRows) return;

  const timestamps = depotState.grid?.timestamps || [];
  const vehicles = depotState.vehicles || [];
  const slots = depotState.active_schedule?.slots || [];

  // Build slot lookup: (vehicle_id, interval) -> slot
  const slotMap = new Map();
  slots.forEach(s => slotMap.set(`${s.vehicle_id}_${s.interval}`, s));

  // Render Time Headers
  elements.ganttHeaders.innerHTML = '<div class="gantt-v-label">Vehicle</div>';
  for (let i = 0; i < 96; i += 4) { // Every hour
    const header = document.createElement('div');
    header.className = 'gantt-time-slot';
    header.style.flex = '4';
    header.textContent = timestamps[i] || '';
    elements.ganttHeaders.appendChild(header);
  }

  // Render Vehicle Rows
  elements.ganttRows.innerHTML = '';
  vehicles.forEach(v => {
    const row = document.createElement('div');
    row.className = 'gantt-row';

    // Label
    const label = document.createElement('div');
    label.className = 'gantt-row-label';
    label.innerHTML = `<span>${v.id}</span><span style="font-size:0.65rem; color:#64748b;">${v.arrival_clock}</span>`;
    row.appendChild(label);

    // Track
    const track = document.createElement('div');
    track.className = 'gantt-cells-track';

    for (let t = 0; t < 96; t++) {
      const cell = document.createElement('div');
      cell.className = 'gantt-cell';

      const isDwell = t >= v.arrival_interval && t < v.departure_interval;
      const slot = slotMap.get(`${v.id}_${t}`);

      if (slot && slot.power_kw > 0) {
        cell.className += ' cell-charging';
        cell.title = `${v.id} @ ${timestamps[t]}: ${slot.power_kw} kW on ${slot.charger_id} (SOC: ${(slot.soc_after*100).toFixed(0)}%)`;
      } else if (isDwell) {
        cell.className += ' cell-dwell';
        cell.title = `${v.id} parked (Dwell window)`;
      }

      track.appendChild(cell);
    }

    row.appendChild(track);
    elements.ganttRows.appendChild(row);
  });
}

// ==========================================================================
// 10 CHARGER BAYS TELEMETRY RENDERING
// ==========================================================================

function renderChargerBays() {
  if (!depotState || !elements.chargersGrid) return;

  const chargers = depotState.chargers || [];
  const slots = depotState.active_schedule?.slots || [];

  // Find active charging sessions at current interval or peak interval
  // Let's inspect sessions around interval 36 (01:00 AM off-peak window)
  const currentT = depotState.current_interval || 36;
  const currentSlots = slots.filter(s => s.interval === currentT);
  const occupancyMap = new Map();
  currentSlots.forEach(s => occupancyMap.set(s.charger_id, s));

  elements.chargersGrid.innerHTML = '';
  chargers.forEach(c => {
    const card = document.createElement('div');
    const isFaulted = c.status === 'FAULTED';
    card.className = `charger-bay-card ${isFaulted ? 'faulted' : ''}`;

    const session = occupancyMap.get(c.id);
    const power = session ? session.power_kw : 0.0;
    const vehicleText = session ? `Charging ${session.vehicle_id}` : (isFaulted ? 'FAULT: Offline' : 'Idle / Standby');

    card.innerHTML = `
      <div class="bay-header">
        <span class="bay-id">${c.id}</span>
        <span class="bay-status ${isFaulted ? 'faulted' : 'online'}">${c.status}</span>
      </div>
      <div class="bay-power ${power === 0 ? 'zero' : ''}">${power > 0 ? power.toFixed(1) : '0.0'} <span style="font-size:0.75rem;">kW</span></div>
      <div class="bay-details">${vehicleText}</div>
    `;

    elements.chargersGrid.appendChild(card);
  });
}

// ==========================================================================
// TAB SWITCHING
// ==========================================================================

elements.tabBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    elements.tabBtns.forEach(b => b.classList.remove('active'));
    elements.tabContents.forEach(c => c.classList.remove('active'));

    btn.classList.add('active');
    activeTab = btn.getAttribute('data-tab');
    document.getElementById(`tab-${activeTab}`).classList.add('active');

    renderAll();
  });
});

// ==========================================================================
// TOAST NOTIFICATION COMPONENT (DESIGN.md ex-toast)
// ==========================================================================

function showToast(message, type = 'info') {
  if (!elements.toastContainer) return;
  const toast = document.createElement('div');
  toast.className = 'mobbin-toast';
  const iconChar = type === 'success' ? '✓' : (type === 'alert' ? '!' : '⚡');
  toast.innerHTML = `
    <span class="toast-icon ${type}">${iconChar}</span>
    <span>${message}</span>
  `;
  elements.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-hiding');
    setTimeout(() => toast.remove(), 260);
  }, 4200);
}

// ==========================================================================
// INTERACTIVE DISRUPTION FLOW & STEPPER
// ==========================================================================

async function executeDisruptionFlow(btnElement, apiEndpoint, payload, disruptionName) {
  const originalHtml = btnElement.innerHTML;
  btnElement.classList.add('btn-loading');
  btnElement.disabled = true;
  btnElement.innerHTML = `<span class="btn-spinner"></span> Re-planning...`;

  // 1. Show loading stepper in Agent card
  elements.idleAgentBox?.classList.add('hidden');
  elements.pendingApprovalBox?.classList.add('hidden');
  elements.agentLoadingBox?.classList.remove('hidden');
  elements.agentLoopStatus.textContent = 'RE-PLANNING';
  elements.agentLoopStatus.className = 'badge-pill badge-popular';

  // 2. Smoothly scroll screen to the Agent card
  if (elements.agentCard) {
    elements.agentCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  // Stepper stages
  const steps = [
    { id: 'step-1', main: '1. Ingesting EventBridge alert...', detail: 'EventBridge received hardware anomaly from IoT Core.' },
    { id: 'step-2', main: '2. Solving CP-SAT constraints...', detail: 'OR-Tools calculating optimal 96-interval schedule.' },
    { id: 'step-3', main: '3. Certifying safety validation...', detail: 'Independent validator checking transformer limit (250 kW).' },
    { id: 'step-4', main: '4. Synthesizing Bedrock reasoning...', detail: 'Claude 3.5 Sonnet formulating operational justification.' },
  ];

  function setStep(index) {
    for (let i = 0; i < steps.length; i++) {
      const el = document.getElementById(steps[i].id);
      if (!el) continue;
      if (i < index) {
        el.className = 'step-pill done';
      } else if (i === index) {
        el.className = 'step-pill active';
        if (elements.loadingStageText) elements.loadingStageText.textContent = steps[i].main;
        if (elements.loadingDetailText) elements.loadingDetailText.textContent = steps[i].detail;
      } else {
        el.className = 'step-pill';
      }
    }
  }

  setStep(0);

  // Animate stepper steps visually while backend runs
  const stepInterval = setInterval(() => {
    const currentActive = steps.findIndex((_, idx) => document.getElementById(`step-${idx+1}`)?.classList.contains('active'));
    if (currentActive < steps.length - 1) {
      setStep(currentActive + 1);
    }
  }, 400);

  try {
    const res = await fetch(apiEndpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload ? JSON.stringify(payload) : undefined,
    });
    clearInterval(stepInterval);
    setStep(3);
    await new Promise(r => setTimeout(r, 250)); // Brief pause on final step for smooth UX

    await fetchDepotState();

    // Trigger attention pulse on agent card
    if (elements.agentCard) {
      elements.agentCard.classList.remove('card-highlight-pulse');
      void elements.agentCard.offsetWidth; // force DOM reflow
      elements.agentCard.classList.add('card-highlight-pulse');
    }

    showToast(`${disruptionName}: Re-plan ready for operator review.`, 'info');
  } catch (err) {
    clearInterval(stepInterval);
    console.error(err);
    showToast(`Failed to trigger ${disruptionName}`, 'alert');
  } finally {
    btnElement.classList.remove('btn-loading');
    btnElement.innerHTML = originalHtml;
    btnElement.disabled = false;
  }
}

// ==========================================================================
// DISRUPTION & ACTION HANDLERS
// ==========================================================================

elements.btnFaultC04.addEventListener('click', () => {
  executeDisruptionFlow(
    elements.btnFaultC04,
    '/api/disrupt/charger-fault',
    { charger_id: 'C04', interval: 21 },
    'Inverter Fault (C04)'
  );
});

elements.btnDelayV08.addEventListener('click', () => {
  executeDisruptionFlow(
    elements.btnDelayV08,
    '/api/disrupt/vehicle-delay',
    { vehicle_id: 'V08', new_interval: 24, new_soc: 0.12 },
    'Van Delay & Low SOC (V08)'
  );
});

elements.btnCarbonSpike.addEventListener('click', () => {
  executeDisruptionFlow(
    elements.btnCarbonSpike,
    '/api/disrupt/carbon-spike',
    null,
    'Grid Carbon Intensity Alert'
  );
});

elements.btnRestoreC04.addEventListener('click', () => {
  executeDisruptionFlow(
    elements.btnRestoreC04,
    '/api/disrupt/restore-charger',
    { charger_id: 'C04', interval: 32 },
    'Charger C04 Restored'
  );
});

elements.btnResetDepot.addEventListener('click', async () => {
  try {
    elements.btnResetDepot.disabled = true;
    await fetch('/api/reset', { method: 'POST' });
    await fetchDepotState();
    showToast('Simulation reset to nominal 16:00 state.', 'info');
  } catch (err) {
    console.error(err);
  } finally {
    elements.btnResetDepot.disabled = false;
  }
});

elements.btnApproveReplan.addEventListener('click', async () => {
  const originalHtml = elements.btnApproveReplan.innerHTML;
  try {
    elements.btnApproveReplan.disabled = true;
    elements.btnApproveReplan.classList.add('btn-loading');
    elements.btnApproveReplan.innerHTML = `<span class="btn-spinner"></span> Dispatching to IoT & DynamoDB...`;

    const res = await fetch('/api/proposal/approve', { method: 'POST' });
    const data = await res.json();
    await fetchDepotState();

    // Trigger momentary attention pulse
    if (elements.agentCard) {
      elements.agentCard.classList.remove('card-highlight-pulse');
      void elements.agentCard.offsetWidth;
      elements.agentCard.classList.add('card-highlight-pulse');
    }

    showToast('Plan approved. Synchronized with live Amazon DynamoDB & CloudWatch.', 'success');
  } catch (err) {
    console.error(err);
    showToast('Failed to approve plan', 'alert');
  } finally {
    elements.btnApproveReplan.classList.remove('btn-loading');
    elements.btnApproveReplan.innerHTML = originalHtml;
    elements.btnApproveReplan.disabled = false;
  }
});

elements.btnRejectReplan.addEventListener('click', async () => {
  try {
    elements.btnRejectReplan.disabled = true;
    await fetch('/api/proposal/reject', { method: 'POST' });
    await fetchDepotState();
    showToast('Re-plan proposal rejected. Maintaining current schedule.', 'info');
  } catch (err) {
    console.error(err);
  } finally {
    elements.btnRejectReplan.disabled = false;
  }
});

// Periodic Sync (Every 5 seconds)
setInterval(fetchDepotState, 5000);

// Window Resize handling
window.addEventListener('resize', () => {
  if (activeTab === 'load-chart') renderLoadChart();
});

// Initial boot
fetchDepotState();
