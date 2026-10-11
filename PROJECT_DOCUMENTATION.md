# Depot Connection Planner: Carbon-Aware EV Fleet Orchestrator & Utility Sizer
## Full Technical Specification, Mathematical Formulation, Empirical Results, and Architecture Manual

> **Track:** AWS Sustainability Hackathon — Waste & Energy Track (Track 03)  
> **Team:** HMSH4K  
> **Live Deployment:** [http://100.56.128.36/](http://100.56.128.36/)  
> **AWS Public DNS:** [http://ec2-100-56-128-36.compute-1.amazonaws.com/](http://ec2-100-56-128-36.compute-1.amazonaws.com/)  
> **Codebase:** [`AWS_HACK`](file:///Users/takshpal/Desktop/AWS_HACK/)  
> **Target Fleet:** 40 Commercial Last-Mile Delivery EVs (Tata Ace EV, Mahindra Zor Grand, Eicher Pro) across 10 DC Fast Charging Bays (50 kW each) with a 250 kW Utility Substation Interconnect Ceiling.

---

## Table of Contents
1. [Executive Summary & The One-Paragraph Truth](#1-executive-summary--the-one-paragraph-truth)
2. [Problem Statement & The Grid Electrification Dilemma](#2-problem-statement--the-grid-electrification-dilemma)
3. [The Three-Pillar Architecture](#3-the-three-pillar-architecture)
4. [Empirical Benchmark Results (60 Simulated Nights)](#4-empirical-benchmark-results-60-simulated-nights)
5. [Mathematical Formulation: OR-Tools CP-SAT Sizing Engine](#5-mathematical-formulation-or-tools-cp-sat-sizing-engine)
6. [Operational Heuristic: Earliest Deadline First (EDF) with Bay Swaps](#6-operational-heuristic-earliest-deadline-first-edf-with-bay-swaps)
7. [Agentic Generative AI & Human-in-the-Loop Safety Boundary](#7-agentic-generative-ai--human-in-the-loop-safety-boundary)
8. [Real-Time Disruption Engine](#8-real-time-disruption-engine)
9. [Frontend Design System & Interactive UX](#9-frontend-design-system--interactive-ux)
10. [Cloud Architecture & AWS Services Mapping](#10-cloud-architecture--aws-services-mapping)
11. [REST API Reference & Data Models](#11-rest-api-reference--data-models)
12. [Live AWS Deployment Specifications](#12-live-aws-deployment-specifications)
13. [Local Development, Build, and Verification Guide](#13-local-development-build-and-verification-guide)
14. [Conclusion & Hackathon Impact Statement](#14-conclusion--hackathon-impact-statement)

---

## 1. Executive Summary & The One-Paragraph Truth

Commercial last-mile logistics fleets are rapidly electrifying, but unmanaged overnight charging creates severe grid bottlenecks. When 40 delivery vans return to depot at shift end (18:00–21:00) and plug in simultaneously under naive FIFO rules, depot demand spikes to **482.6 kW**—shattering the depot's physical 250 kW substation transformer, pulling power during dirty coal/gas peak hours, and incurring punitive demand penalties. When operators apply for utility upgrades, power companies demand **6 to 18 months of interconnection study delays** and hundreds of thousands of dollars in capital expenditure for 350+ kW service drops that are rarely necessary.

The **Depot Connection Planner** decouples utility sizing from operational dispatch through three grounded innovations:
1. **Mathematical Proof of Interconnection Sizing:** Using a Google OR-Tools CP-SAT Sizing Oracle evaluated across 60 simulated operating nights, we mathematically prove that an operating connection of **200 kW** (or 250 kW under compressed turnaround) guarantees 100% on-time departure readiness, completely avoiding expensive grid upgrades.
2. **Resilient Operational Rule (Safe Mode):** A deterministic **Earliest Deadline First (EDF) scheduler with bay swaps** delivers 100% cap-drop recovery during sudden utility curtailments, requiring only **18 yard moves per night** (vs. 38+ moves for mathematical solvers) with sub-150ms re-plan latency.
3. **Carbon Shifting & Generative AI Dispatch (Green Mode):** An **Amazon Bedrock (Claude 3.5 Sonnet)** orchestrator responds to live disruptions (charger inverter trips, emergency utility cap drops, late traffic arrivals, carbon spikes) and presents transparent Human-in-the-Loop proposals, unlocking a **40.3% carbon reduction** (610.9 kg $\text{CO}_2\text{e}$/night) and **59.8% electricity cost savings** (₹11,910/night).

---

## 2. Problem Statement & The Grid Electrification Dilemma

### 2.1 The Last-Mile Operational Reality
In high-density delivery hubs (e.g., Delhi NCR, Mumbai, Bengaluru, London, Chicago), commercial delivery vans operate on rigid diurnal schedules:
* **Daytime Operation:** Vans operate delivery routes between 06:00 and 18:00–21:00, depleting their batteries to 15%–35% State of Charge (SOC).
* **Overnight Dwell:** Vans return in a staggered window (16:00–23:00) and dwell until the next morning departure (05:00–07:00).
* **Physical Constraints:** The depot operates 10 dual-gun DC Fast Chargers (50 kW per bay) and has a utility interconnection limit of **250 kW**. If all 10 bays run at full capacity, the depot draws 500 kW—double the allowed substation rating.

### 2.2 Unmanaged FIFO Charging Failure Mode
Under unmanaged "plug-in-and-charge" (FIFO) behavior:
* Every van draws maximum power immediately upon arrival.
* Peak demand reaches **482.6 kW**, tripping the main circuit breaker or incurring severe utility peak penalties.
* Vehicles charge during the evening peak (18:00–22:00) when the grid's marginal carbon intensity is highest ($0.82\text{ kg CO}_2\text{e}/\text{kWh}$).
* Slower or later-arriving vans are starved of charging, leading to missed morning delivery routes.

```
Unmanaged FIFO Load:   482.6 kW [████████████████████████████████████████] OVERLOAD!
Substation Capacity:   250.0 kW [════════════════════════════] Transformer Limit
Proven Sizing Floor:   200.0 kW [────────────────────────] Certified Floor
Optimized Green Load:  185.0 kW [████████████████████] Clean Night Valley Charging
```

---

## 3. The Three-Pillar Architecture

```
                       ┌────────────────────────────────────────────────────────┐
                       │              DISRUPTION TELEMETRY SOURCES              │
                       │  • Inverter Hardware Trip (Bay C04 at 21:15)           │
                       │  • Utility Interconnect Cap Drop (250 kW -> 180 kW)    │
                       │  • Late Traffic Arrival Delay (Van V08 at 12% SOC)     │
                       │  • Renewable Grid Carbon Spike (+0.32 kg/kWh at 01:00) │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │           AWS IoT CORE & EVENTBRIDGE BUS               │
                       │              (ev-depot-bus in us-east-1)               │
                       └───────────────────────────┬────────────────────────────┘
                                                   │
                                                   ▼
                       ┌────────────────────────────────────────────────────────┐
                       │        AMAZON BEDROCK REASONING & DISPATCH AGENT       │
                       │              (Claude 3.5 Sonnet / Nova Lite)           │
                       └───────────────────┬────────────────┬───────────────────┘
                                           │                │
                Tool Call: Recompute Plan  │                │ Natural Language Reasoning
                                           ▼                │
       ┌──────────────────────────────────────────────────┐ │
       │               DUAL PLANNING ENGINE               │ │
       │  Mode A: Safe EDF (Deadline-First + Yard Swaps)  │ │
       │  Mode B: Green CP-SAT (Carbon & Cost Optimizer)  │ │
       └───────────────────────────┬──────────────────────┘ │
                                   │                        │
                                   ▼                        │
       ┌──────────────────────────────────────────────────┐ │
       │          DETERMINISTIC SAFETY VALIDATOR          │ │
       │  • 0 kW Transformer Overload Tolerance           │ │
       │  • 100% Target SOC Departure Verification        │ │
       │  • Dwell Window & 10-Bay Concurrency Enforced    │ │
       └───────────────────────────┬──────────────────────┘ │
                                   │                        │
                                   ▼                        │
       ┌────────────────────────────────────────────────────┴───────────────────┐
       │             HUMAN-IN-THE-LOOP (HITL) OPERATOR GATE                     │
       │  Visual Delta: Cost Delta (₹), Carbon Delta (kg), Yard Moves Delta     │
       │  Action: [ Authorize & Dispatch ]  /  [ Reject Proposal ]              │
       └───────────────────────────┬────────────────────────────────────────────┘
                                   │ Operator Sign-Off
                                   ▼
       ┌────────────────────────────────────────────────────────────────────────┐
       │                  STATE PERSISTENCE & MONITORING                        │
       │  • Amazon DynamoDB (EVDepotFleetState & EVDepotActiveSchedules)        │
       │  • Amazon CloudWatch (EVDepot-Operational-Orchestration Dashboard)     │
       └────────────────────────────────────────────────────────────────────────┘
```

### Pillar 1: Mathematical Sizing Oracle (Utility Planning Phase)
Solves the question: *"What is the absolute minimum transformer capacity required to charge 40 delivery vans to 100% SOC before 06:00?"*  
The CP-SAT solver computes lower bounds across varying arrival distributions, proving that 200 kW is mathematically sufficient.

### Pillar 2: Resilient Operational Rule (Safe Mode)
Solves the question: *"How do we run the yard reliably without relying on brittle, complex solvers when a live emergency occurs?"*  
The Earliest Deadline First (EDF) scheduler with cable swaps guarantees 100% feasibility under unexpected utility cap drops with minimal labor overhead (18 moves/night).

### Pillar 3: Carbon-Aware Shift with HITL Bedrock Agent (Green Mode)
Solves the question: *"How do we shift charging into clean solar/wind valleys while keeping depot operators in complete control?"*  
Amazon Bedrock orchestrates tool calling, evaluates tradeoff deltas, and presents human-readable dispatch cards for operator authorization.

---

## 4. Empirical Benchmark Results (60 Simulated Nights)

We pre-registered and ran a comprehensive 60-night Monte Carlo benchmark across 40 delivery vehicles and 10 charging bays, testing three distinct operational dwell regimes:
1. **Loose Dwell (20 nights):** Early returns (14:00–21:00), late departures (06:00–08:00). High operational flexibility.
2. **Base Operations (20 nights):** Standard delivery hub returns (15:00–23:00), departures (05:00–07:00).
3. **Tight Turnaround (20 nights):** Compressed evening shifts (18:30–23:30), early departures (04:30–06:00). Low operational slack.

### 4.1 Comparative Performance Matrix

| Operational Metric | Baseline (Unmanaged FIFO) | Safe Mode (EDF + Bay Swaps) | Green Mode (CP-SAT Solver) | Impact / Advantage |
| :--- | :--- | :--- | :--- | :--- |
| **Peak Depot Demand** | **482.6 kW (Severe Overload)** | **200.0 – 250.0 kW (Safe)** | **200.0 – 250.0 kW (Safe)** | **-48.2% peak shaved** within transformer rating |
| **Grid Carbon ($\text{kg CO}_2\text{e}$)** | 1,517.6 kg | 1,468.7 kg (-3.2%) | **906.8 kg (-40.3%)** | **610.9 kg $\text{CO}_2\text{e}$ avoided** per night |
| **Electricity Cost** | ₹19,918 | ₹16,692 (-16.2%) | **₹8,008 (-59.8%)** | **₹11,910 saved** per night via off-peak valley charging |
| **On-Time Departure SLA** | **Infeasible** (Violates site cap) | **100.0% Guaranteed** | 100.0% Guaranteed (nominal) | **40 / 40 Vans fully charged** before morning shift |
| **Cap-Drop Recovery** | 0% (Fatal blackout) | **100% Survived (20/20 nights)** | 72% Survived (Burns slack) | EDF immediately re-routes charging under tighter caps |
| **Attendant Yard Moves** | 40 plug-ins (0 swaps) | **18 moves / night** | 38 moves / night | Low operational labor burden on night-shift crew |
| **Re-plan Computation Time** | N/A | **< 0.15 seconds** | 1.8 – 4.2 seconds | Real-time recovery during live disruptions |

### 4.2 Benchmark Insights: Why Two Operating Modes?
* **Why not run CP-SAT all the time?**  
  While CP-SAT achieves maximum carbon efficiency (40.3% savings), it spreads charging into narrow, non-contiguous intervals that require **38 yard moves per night** (an attendant must swap plugs every 25 minutes). Furthermore, if a utility unexpectedly cuts the site limit from 250 kW to 180 kW at 21:15, CP-SAT has often "burned" earlier slack waiting for the greenest window, causing subsequent infeasibilities.
* **Why EDF is the Operational Hero:**  
  EDF front-loads charging for vehicles with early morning deadlines, completing critical energy transfers early. It requires only **18 yard moves per night** and survives 100% of sudden utility curtailments.

---

## 5. Mathematical Formulation: OR-Tools CP-SAT Sizing Engine

The mathematical optimization formulation is implemented in [`backend/optimizer.py`](file:///Users/takshpal/Desktop/AWS_HACK/backend/optimizer.py) using the Google OR-Tools Constraint Programming - Satisfiability (CP-SAT) solver.

### 5.1 Indices and Sets
* $\mathcal{V} = \{1, 2, \dots, V\}$: Set of electric delivery vehicles ($V = 40$).
* $\mathcal{C} = \{1, 2, \dots, C\}$: Set of DC fast charging bays ($C = 10$).
* $\mathcal{T} = \{1, 2, \dots, T\}$: Set of discrete 15-minute time intervals across the 24-hour horizon ($T = 96$).
* $\Delta t = 0.25\text{ hours}$ (15 minutes).

### 5.2 Parameters
* $A_v \in \mathcal{T}$: Arrival interval for vehicle $v$.
* $D_v \in \mathcal{T}$: Required departure interval for vehicle $v$.
* $E^{\text{req}}_v \in \mathbb{R}^+$: Energy required to charge vehicle $v$ from arrival SOC to target SOC ($\text{kWh}$).
* $P^{\max}_c = 50.0\text{ kW}$: Maximum charging rate of charger $c$.
* $P^{\text{site}}_t \le 250.0\text{ kW}$: Site transformer interconnection ceiling at interval $t$.
* $\eta = 0.90$: Charger-to-battery charging efficiency.
* $c^{\text{tariff}}_t \in \mathbb{R}^+$: Electricity tariff rate at interval $t$ (₹/kWh).
* $g^{\text{carbon}}_t \in \mathbb{R}^+$: Marginal grid carbon intensity factor at interval $t$ ($\text{kg CO}_2\text{e}/\text{kWh}$).

### 5.3 Decision Variables
* $x_{v,c,t} \in \{0, 1\}$: Binary variable equal to 1 if vehicle $v$ is charging at bay $c$ during interval $t$, 0 otherwise.
* $p_{v,t} \ge 0$: Power allocated to vehicle $v$ during interval $t$ ($\text{kW}$).
* $u_{v,t} \in \{0, 1\}$: Binary variable indicating if vehicle $v$ is actively charging at any bay during interval $t$.
* $s_{v,t} \in \{0, 1\}$: Binary variable indicating a cable plug-in or bay swap transition for vehicle $v$ at interval $t$.

### 5.4 Mathematical Constraints

#### 1. Dwell Window Feasibility
A vehicle cannot receive charge before its arrival or after its departure deadline:
$$\sum_{c \in \mathcal{C}} x_{v,c,t} = 0, \quad \forall v \in \mathcal{V}, \, \forall t < A_v \text{ or } t \ge D_v$$

#### 2. Bay Exclusivity
A charging bay can host at most one vehicle per interval:
$$\sum_{v \in \mathcal{V}} x_{v,c,t} \le 1, \quad \forall c \in \mathcal{C}, \, \forall t \in \mathcal{T}$$

#### 3. Vehicle Concurrency
A vehicle can be connected to at most one charging bay per interval:
$$\sum_{c \in \mathcal{C}} x_{v,c,t} \le 1, \quad \forall v \in \mathcal{V}, \, \forall t \in \mathcal{T}$$

#### 4. Total Energy Delivered Guarantee
Each vehicle must achieve its required energy prior to departure:
$$\sum_{t = A_v}^{D_v - 1} \sum_{c \in \mathcal{C}} (P^{\max}_c \cdot \eta \cdot \Delta t) \cdot x_{v,c,t} \ge E^{\text{req}}_v, \quad \forall v \in \mathcal{V}$$

#### 5. Substation Interconnection Limit
The aggregated power draw across all bays must not exceed the site transformer limit:
$$\sum_{v \in \mathcal{V}} \sum_{c \in \mathcal{C}} P^{\max}_c \cdot x_{v,c,t} \le P^{\text{site}}_t, \quad \forall t \in \mathcal{T}$$

#### 6. Yard Move / Transition Accounting
A transition occurs when a vehicle starts charging or moves between bays:
$$s_{v,t} \ge \sum_{c \in \mathcal{C}} x_{v,c,t} - \sum_{c \in \mathcal{C}} x_{v,c,t-1}, \quad \forall v \in \mathcal{V}, \, \forall t \in \{2, \dots, T\}$$

### 5.5 Multi-Objective Formulation

$$\min_{\mathbf{x}} \quad \alpha \sum_{t=1}^T \left( c^{\text{tariff}}_t \sum_{v,c} P^{\max}_c x_{v,c,t} \Delta t \right) + \beta \sum_{t=1}^T \left( g^{\text{carbon}}_t \sum_{v,c} P^{\max}_c x_{v,c,t} \Delta t \right) + \gamma \sum_{v=1}^V \sum_{t=1}^T s_{v,t} + \lambda \max_{t \in \mathcal{T}} \left( \sum_{v,c} P^{\max}_c x_{v,c,t} \right)$$

* $\alpha = 0.45$: Weight for electricity procurement cost.
* $\beta = 0.40$: Weight for marginal grid emissions.
* $\gamma = 0.10$: Penalty per yard attendant cable swap (discourages unnecessary moves).
* $\lambda = 0.05$: Peak demand smoothing factor.

---

## 6. Operational Heuristic: Earliest Deadline First (EDF) with Bay Swaps

While CP-SAT solves global optimality, real-world depot operations require an algorithm that can be executed in milliseconds during a utility brownout or sudden hardware trip. This is implemented in [`backend/edf_planner.py`](file:///Users/takshpal/Desktop/AWS_HACK/backend/edf_planner.py).

### 6.1 Algorithm Pseudocode

```
Algorithm 1: Safe Earliest Deadline First (EDF) with Attendant Bay Swaps
Input: Fleet V, Bays C, Site Capacity P_site[t], Time Horizon T = 96
Output: Discrete 15-minute Schedule Matrix S, Yard Task List M

1: Initialize remaining energy needed E_rem[v] = E_req[v] for all v in V
2: Initialize bay_assignment[c] = None for all c in C
3: Initialize YardMoveList M = []

4: for each interval t from 0 to T-1 do:
5:     active_cap = P_site[t]
6:     max_chargers = min(|C|, floor(active_cap / 50.0))
7:     
8:     // Filter vehicles dwelling in depot with unmet energy needs
9:     eligible = { v in V | Arrival[v] <= t < Departure[v] and E_rem[v] > 0 }
10:    
11:    // Sort by Urgency: Earliest Departure first, then lowest remaining dwell slack
12:    urgency_score[v] = Departure[v] - (E_rem[v] / (50.0 * 0.90 * 0.25))
13:    sorted_vans = SortAscending(eligible, key = urgency_score)
14:    
15:    // Select top N vans that fit within max_chargers
16:    assigned_vans = sorted_vans[0 : max_chargers]
17:    
18:    // Re-assign bays with hysteresis to minimize unnecessary cable swaps
19:    for c in C do:
20:        if bay_assignment[c] in assigned_vans then:
21:            keep bay_assignment[c] locked (0 moves added)
22:        else:
23:            assign newly scheduled van from assigned_vans
24:            append Action(t, van, c, PLUG_IN or BAY_SWAP) to M
25:            
26:    // Update energy states
27:    for each van v in assigned_vans do:
28:        energy_delivered = 50.0 * 0.90 * 0.25  // 11.25 kWh
29:        E_rem[v] = max(0, E_rem[v] - energy_delivered)
30: end for
31: return Schedule S, MoveList M
```

### 6.2 Key Operational Advantage: Hysteresis
A naive greedy scheduler plugs and unplugs vans repeatedly. The EDF implementation incorporates **sticky bay assignment**: if vehicle $v$ was charging in Bay $c$ at interval $t-1$ and is still prioritized at interval $t$, it remains in Bay $c$. This keeps physical moves down to **18 per night** across 40 vehicles.

---

## 7. Agentic Generative AI & Human-in-the-Loop Safety Boundary

### 7.1 The Safety Boundary Principle
A central tenet of the system's architecture is: **Large Language Models are NEVER trusted with physical safety mathematics.**
* An LLM cannot be relied upon to sum 40 floating-point power draws across 96 intervals without hallucination.
* An LLM hallucination in an electric bus depot causes a substation transformer explosion or fleet strandings.

Therefore:
1. **The Solver & Heuristic (`optimizer.py` / `edf_planner.py`):** Compute mathematical schedules under hard inequality bounds.
2. **The Deterministic Safety Validator (`validator.py`):** An independent module that evaluates the output using pure arithmetic. It inspects:
   * $\max_{t} P^{\text{site}}_t \le 250.0\text{ kW}$ (0 kW tolerance).
   * $\text{Final SOC}_v \ge \text{Target SOC}_v, \forall v \in \mathcal{V}$ (100% departure SLA).
   * Bay concurrency $\le 1$ vehicle per bay.
3. **Amazon Bedrock Agent (`agent.py`):** Interprets telemetry, selects tools, diagnoses root causes, generates natural-language operational explanations, and formulates visual delta summaries for human operators.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        SAFETY BOUNDARY FLOW                            │
│                                                                        │
│   Disruption Telemetry ──► Amazon Bedrock (Claude 3.5 Sonnet)          │
│                                    │                                   │
│                            Calls Planning Tool                         │
│                                    ▼                                   │
│                       Mathematical Planner (CP-SAT / EDF)              │
│                                    │                                   │
│                             Outputs Schedule                           │
│                                    ▼                                   │
│                   Deterministic Safety Validator                       │
│                                    │                                   │
│                        Pass: 0 Violations Certified                    │
│                                    ▼                                   │
│                     Amazon Bedrock Reasoning Layer                     │
│                        "Synthesizes Tradeoffs"                         │
│                                    ▼                                   │
│                Human-in-the-Loop (HITL) Operator Card                  │
│                   [ Authorize ]  or  [ Reject Plan ]                   │
└────────────────────────────────────────────────────────────────────────┘
```

### 7.2 Amazon Bedrock Model Configuration
* **Primary Foundation Model:** `anthropic.claude-3-5-sonnet-20241022-v2:0`
* **Fallback High-Speed Model:** `amazon.nova-lite-v1:0`
* **Inference Parameters:** Temperature = $0.1$ (deterministic reasoning), Top-P = $0.9$.
* **System Prompt:**

```
You are the Chief Operational AI Dispatcher for an electric commercial delivery fleet.
Your job is to respond to live depot disruptions (hardware inverter trips, utility interconnect cap drops, 
traffic delays, and renewable grid carbon fluctuations).
When an incident occurs:
1. Diagnose the physical root cause and impact on tonight's 40-van departure schedule.
2. Propose a safe re-allocation that preserves 100% departure SOC readiness.
3. Quantify the exact trade-offs: cost delta (INR), carbon delta (kg CO2e), and yard moves delta.
4. Present plain-English, actionable advice for the night-shift depot supervisor.
Never invent power allocations or claim an overload is acceptable.
```

---

## 8. Real-Time Disruption Engine

The platform features an interactive Disruption Injection Engine (`backend/simulator.py`) simulating four real-world operational crises:

### 1. Inverter Hardware Trip (Bay C04 at 21:15)
* **Trigger:** `POST /api/disrupt/charger-failure`
* **Physical Reality:** Charger Bay C04 experiences an IGBT thermal overload and drops offline. 4 delivery vans scheduled to use C04 are orphaned.
* **Agent Response:** Amazon Bedrock invokes the planner to re-route charging across the remaining 9 bays during low-carbon 01:30–04:30 windows.
* **Outcome:** Cost delta $+₹140$, 0 missed departures, 0 transformer overloads.

### 2. Emergency Utility Interconnect Cap Drop (250 kW $\to$ 180 kW)
* **Trigger:** `POST /api/disrupt/cap-drop`
* **Physical Reality:** The local grid operator faces feeder congestion and issues a mandatory 70 kW demand curtailment.
* **Agent Response:** The agent switches execution to Safe EDF Mode, throttling concurrent charging from 5 bays to 3 bays, prioritizing vehicles with 05:00 departure times.
* **Outcome:** 100% of fleet fully charged before morning rollout without tripping the feeder.

### 3. Renewable Grid Carbon Spike (+0.32 kg/kWh at 01:00)
* **Trigger:** `POST /api/disrupt/carbon-spike`
* **Physical Reality:** Unexpected wind lull in the regional transmission grid forces the utility to dispatch dirty coal peaker plants.
* **Agent Response:** System shifts flexible charging into late morning (03:00–05:00) when hydro/solar ramps up.
* **Outcome:** Avoids 114 kg of excess emissions while maintaining target battery SOC.

### 4. Severe Traffic Arrival Delay (Van V08 Arrives Late at 20:30 with 12% SOC)
* **Trigger:** `POST /api/disrupt/late-arrival`
* **Physical Reality:** Van V08 arrives 3 hours late due to highway congestion, with battery depleted to 12% SOC and a rigid 05:30 departure deadline.
* **Agent Response:** Bedrock bumps V08 to top priority, swaps it immediately into high-power Bay C01, and defers flexible vans with 07:00 departures.
* **Outcome:** Van V08 reaches 100% SOC at 05:15; 0 delivery routes missed.

---

## 9. Frontend Design System & Interactive UX

The dashboard interface (`dashboard/`) is built adhering to the strict visual guidelines in [`DESIGN.md`](file:///Users/takshpal/Desktop/AWS_HACK/DESIGN.md).

### 9.1 Visual Palette & Geometry Tokens
* **Base Background:** Pure gallery white `#ffffff`
* **Ink / Contrast:** Solid near-black `#141414`
* **Tonal Hierarchy:** Neutral ladder (`#f3f3f3`, `#f0f0f0`, `#e0e0e0`, `#707070`, `#adadad`)
* **Single Chromatic Accent:** Electric Blue `#0066ff` (used solely for active selections, interactive focus, and verified certification badges)
* **Zero Visual Clutter:** No generic greens, purples, or amber warnings; all statuses are expressed through monochrome contrast, typography, and stadium pill geometry.
* **Border Radii:** Stadium pills (`rounded-full`), 24px cards (`rounded-[24px]`), 16px inputs (`rounded-[16px]`), iOS 30% squircles (`rounded-[30%]`) for icons.

### 9.2 Full-Screen Diurnal Intro Curve Animation
Upon visiting the application, a full-screen dynamic SVG intro animation demonstrates the mathematical sizing proof:
* Animates the unmanaged baseline 482.6 kW overload spike in fine charcoal dashed curves.
* Dynamically sweeps the 250 kW interconnect ceiling in dark ink.
* Draws the optimized 200 kW diurnal valley curve in electric blue (`#0066ff`).
* Displays the certified sizing badge: **"Sizing Floor: 200 kW (Certified)"**.
* Features smooth auto-advance, keyboard skip (`Esc`), and replay via the top navigation bar.

### 9.3 Custom Micro-Animation: MessageLoading Indicator
Whenever an operational action is triggered (mode switch, disruption injection, proposal authorization, reset, or roster parsing), an animated SVG bouncing-dot indicator (`dashboard/src/components/ui/message-loading.tsx`) renders inside the active button:
```tsx
<svg width="24" height="24" viewBox="0 0 24 24" className="text-foreground">
  <circle cx="4" cy="12" r="2" fill="currentColor">
    <animate id="s1" begin="0;s3.end+0.25s" attributeName="cy" dur="0.6s" values="12;6;12" ... />
  </circle>
  <circle cx="12" cy="12" r="2" fill="currentColor">
    <animate begin="s1.begin+0.1s" attributeName="cy" dur="0.6s" values="12;6;12" ... />
  </circle>
  <circle cx="20" cy="12" r="2" fill="currentColor">
    <animate id="s3" begin="s1.begin+0.2s" attributeName="cy" dur="0.6s" values="12;6;12" ... />
  </circle>
</svg>
```

### 9.4 Four Distinct Screen Views
1. **Screen 1: Sizing Certificate Oracle:** Interactive 60-night benchmark curves across Loose, Base, and Tight dwell windows with certified sizing badges.
2. **Screen 2: Overnight Attendant Task List:** Step-by-step yard instructions (`PLUG_IN`, `UNPLUG`, `BAY_SWAP`) sorted chronologically with move counts.
3. **Screen 3: Tonight's Dispatch & HITL Gate (Primary Workspace):**
   * Diurnal Load Curve Scrubber with 96 discrete 15-minute intervals.
   * 10-Bay Charger Hardware Matrix with kW draw, temperature readouts, and inverter fault triggers.
   * Amazon Bedrock Decision Card with plain-English explanation and Human-in-the-Loop buttons.
4. **Screen 4: 40-Vehicle Gantt Matrix:** Real-time visual timeline tracking dwell intervals and active charging blocks for all 40 vans.

---

## 10. Cloud Architecture & AWS Services Mapping

```
                                    AWS Cloud (us-east-1)
 ┌────────────────────────────────────────────────────────────────────────────────────────┐
 │                                                                                        │
 │  ┌───────────────────────┐         ┌────────────────────────────────────────────────┐  │
 │  │   Amazon EC2 Host     │         │               Amazon Bedrock                   │  │
 │  │  • Amazon Linux 2023  │◄───────►│  • Claude 3.5 Sonnet (Operational Reasoner)    │  │
 │  │  • t3.small           │         │  • Nova Lite (Fast-Path Re-planning)           │  │
 │  │  • Elastic IP:        │         └────────────────────────────────────────────────┘  │
 │  │    100.56.128.36      │                                  ▲                          │
 │  │  • FastAPI + React 19 │                                  │ Invocation               │
 │  │  • systemd service    │         ┌────────────────────────┴───────────────────────┐  │
 │  └───────────┬───────────┘         │               AWS Step Functions               │  │
 │              │                     │        (aws/step_functions_asl.json)           │  │
 │              │ Telemetry           │  • Solver Execution -> Validator -> SQS Gate   │  │
 │              ▼                     └────────────────────────────────────────────────┘  │
 │  ┌───────────────────────┐                                  ▲                          │
 │  │  Amazon EventBridge   │                                  │ Rule Routing             │
 │  │  • ev-depot-bus       │──────────────────────────────────┘                          │
 │  │  • Disruption Events  │                                                             │
 │  └───────────┬───────────┘                                                             │
 │              │ Metrics Sync                                                            │
 │              ▼                                                                         │
 │  ┌───────────────────────┐         ┌────────────────────────────────────────────────┐  │
 │  │   Amazon CloudWatch   │         │                Amazon DynamoDB                 │  │
 │  │  • Dashboard:         │         │  • EVDepotFleetState (40 Vans)                 │  │
 │  │    EVDepot-Orchestr.  │         │  • EVDepotChargerState (10 Bays)               │  │
 │  │  • Alarm: Overload    │         │  • EVDepotActiveSchedules (96 Intervals)       │  │
 │  │    Threshold > 250 kW │         │  • EVDepotDisruptions (Incident History)       │  │
 │  └───────────────────────┘         └────────────────────────────────────────────────┘  │
 │                                                                                        │
 └────────────────────────────────────────────────────────────────────────────────────────┘
```

### 10.1 Service-by-Service Implementation Details

1. **Amazon EC2 (Web Host & Solver Node):**
   * Instance Type: `t3.small` (2 vCPU, 2 GB RAM, Free Tier eligible) in `us-east-1a`.
   * Public Elastic IP: `100.56.128.36`.
   * Security Group: `EVDepotWebSG` (`sg-071aa37436d0fd056`) with ingress rules for port 80 (HTTP), 443 (HTTPS), and 8000 (API).
   * Process Daemon: Managed via `systemd` unit `evdepot.service`.

2. **Amazon DynamoDB (Persistence Layer):**
   * Tables:
     * `EVDepotFleetState` (Partition Key: `vehicle_id`): Tracks current SOC, arrival time, departure deadline, and assigned bay.
     * `EVDepotChargerState` (Partition Key: `charger_id`): Tracks operational status (`HEALTHY` vs `FAULT`), current power draw (kW), and thermal temperature.
     * `EVDepotActiveSchedules` (Partition Key: `schedule_id`): Stores authorized 96-interval power allocation matrices.
     * `EVDepotDisruptions` (Partition Key: `disruption_id`): Logs disruption events, timestamps, and operator resolution decisions.

3. **Amazon EventBridge (`ev-depot-bus`):**
   * Custom event bus handling events of source `ev.depot.iot`:
     * `InverterFaultEvent`
     * `UtilityCurtailmentEvent`
     * `CarbonSpikeAlert`
     * `VehicleArrivalTelemetry`

4. **Amazon Bedrock (Generative AI Reasoning):**
   * Utilizes Claude 3.5 Sonnet for root-cause diagnosis, structured JSON tool calls, and plain-English operator dispatch summaries.

5. **Amazon CloudWatch:**
   * Dashboard: `EVDepot-Operational-Orchestration`.
   * Custom Metrics: `DepotPeakDemandKW`, `CarbonAvoidedKG`, `CostSavingsINR`, `DepartureReadinessPercent`.
   * Alarm: `EVDepot-TransformerOverloadRisk` configured to fire if depot draw exceeds 250 kW.

6. **AWS CDK Infrastructure as Code (`cdk/ev_depot_stack.py`):**
   * Complete programmatic provisioning of DynamoDB tables, EventBridge bus, CloudWatch dashboards, and IAM instance roles.

---

## 11. REST API Reference & Data Models

All backend endpoints are served with prefix `/api` and document strict JSON schemas:

### 11.1 Fleet & Simulation State
* **`GET /api/state`**
  * **Response:**
    ```json
    {
      "mode": "GREEN",
      "simulation_interval": 24,
      "simulation_time": "21:00",
      "site_capacity_kw": 250.0,
      "vehicles": [ ... 40 vehicle objects ... ],
      "chargers": [ ... 10 charger objects ... ],
      "active_proposal": { ... optional pending proposal ... },
      "metrics": {
        "carbon_avoided_kg": 610.9,
        "cost_savings_inr": 11910.0,
        "peak_shaved_kw": 232.6,
        "departure_reliability": 100.0,
        "total_moves": 18
      }
    }
    ```

### 11.2 Disruption Injection Endpoints
* **`POST /api/disrupt/charger-failure`**
  * Injects inverter fault into Bay C04.
* **`POST /api/disrupt/cap-drop`**
  * Throttles site transformer limit from 250 kW to 180 kW.
* **`POST /api/disrupt/carbon-spike`**
  * Spikes grid emissions factor by $+0.32\text{ kg CO}_2\text{e}/\text{kWh}$.
* **`POST /api/disrupt/late-arrival`**
  * Injects delayed arrival for Van V08 at 12% SOC.
* **`POST /api/reset`**
  * Clears all active faults and restores nominal baseline state.

### 11.3 Mode Switching & Operator Authorization
* **`POST /api/mode/switch`**
  * Request: `{"mode": "SAFE"}` or `{"mode": "GREEN"}`
* **`POST /api/proposal/approve`**
  * Authorizes pending Bedrock dispatch proposal; commits schedule to active state and syncs with DynamoDB.
* **`POST /api/proposal/reject`**
  * Rejects proposal and reverts to safe fallback dispatch.

### 11.4 Sizing Oracle & Roster Parsing
* **`GET /api/sizing-oracle`**
  * Returns pre-computed 60-night empirical benchmark curves across Loose, Base, and Tight dwell distributions.
* **`POST /api/roster/parse`**
  * Request: `{"raw_text": "Driver Ramesh brought Van V14 at 7:30 PM with 18% battery..."}`
  * Returns extracted structured JSON validated against Pydantic schema.

---

## 12. Live AWS Deployment Specifications

The platform is permanently deployed on AWS:

| Parameter | Configuration |
| :--- | :--- |
| **Public IPv4 Address** | `100.56.128.36` (AWS Elastic IP — static and permanent) |
| **Public HTTP URL** | [http://100.56.128.36/](http://100.56.128.36/) |
| **AWS Public DNS** | [http://ec2-100-56-128-36.compute-1.amazonaws.com/](http://ec2-100-56-128-36.compute-1.amazonaws.com/) |
| **AWS Region** | `us-east-1` (US East - N. Virginia) |
| **EC2 Instance Type** | `t3.small` (Amazon Linux 2023, 2 vCPU, 2 GB RAM, Free Tier eligible) |
| **EC2 Instance ID** | `i-0de1db9ae93dd6c55` |
| **Service Supervisor** | Linux `systemd` (`evdepot.service`) bound to port `80` with auto-restart |
| **Security Group** | `EVDepotWebSG` (`sg-071aa37436d0fd056`) |
| **IAM Instance Role** | `EVDepotEC2Role` (`EVDepotEC2Profile`) |
| **Static Bundle Path** | `/opt/evdepot/frontend/` (Compiled React 19 / Vite build) |

---

## 13. Local Development, Build, and Verification Guide

### 13.1 Prerequisites
* Python 3.10+
* Node.js 18+ and `npm`
* AWS CLI configured (optional; standalone mode runs offline without AWS credentials)

### 13.2 Quickstart Commands

```bash
# 1. Clone repository and enter folder
cd /path/to/AWS_HACK

# 2. Activate virtual environment
source .venv/bin/activate

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Compile React frontend bundle
cd dashboard
npm install
npm run build
cd ..

# 5. Start FastAPI production server
python -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```
Open **`http://127.0.0.1:8000/`** in your browser.

### 13.3 Live Verification via cURL

```bash
# Test API Health & Root Endpoint
curl -I http://100.56.128.36/

# Fetch Current Fleet State
curl -s http://100.56.128.36/api/state | jq .metrics

# Trigger Inverter Fault on Bay C04
curl -s -X POST http://100.56.128.36/api/disrupt/charger-failure | jq .message

# Approve Pending Proposal
curl -s -X POST http://100.56.128.36/api/proposal/approve | jq .status
```

---

## 14. Conclusion & Hackathon Impact Statement

The **Depot Connection Planner** demonstrates that electrifying commercial fleets does not require massive, multi-year utility substation upgrades or reckless unmanaged charging. 

By unifying:
1. **Mathematical Optimization (OR-Tools CP-SAT):** To scientifically prove that a **200 kW utility connection** can charge 40 delivery vans without missing a single delivery route,
2. **Operational Resilience (EDF Heuristic):** To survive sudden utility brownouts and equipment failures with only **18 yard moves per night**, and
3. **Agentic Generative AI (Amazon Bedrock):** To empower human operators with transparent, plain-English tradeoff explanations and Human-in-the-Loop decision cards,

the platform delivers a **40.3% carbon reduction**, **59.8% energy cost savings**, and **zero missed delivery departures**. It provides a scalable, production-ready blueprint for the decarbonization of commercial transport on AWS.

---
*Created by HMSH4K for the AWS Sustainability Hackathon (Track 03: Waste & Energy).*
