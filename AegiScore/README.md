# 🛡️ AegisCore

**Next-Generation AI Cybersecurity Command Center**

AegisCore is a highly advanced, full-stack Security Operations Center (SOC) designed to detect, analyze, and mitigate cyber threats in real-time. By combining Deep Learning (LSTM networks) with Large Language Models (LLMs), AegisCore acts as an autonomous cyber-defense platform for modern infrastructure.

---

## ✨ Core Capabilities

- **⚡ Real-Time Telemetry & SOC Dashboard**: Monitor your entire infrastructure with instant WebSocket feeds. AegisCore visualizes active threats and network anomalies the second they occur.
- **🧠 Predictive Threat Detection**: Powered by an LSTM neural network trained on the UNSW-NB15 dataset, accurately identifying complex attack vectors like DoS, Exploits, Fuzzers, and Reconnaissance.
- **🛡️ NLP Chat Guard**: An intelligent chat analyzer that intercepts and evaluates incoming communications for Social Engineering, Prompt Injection, and Impersonation.
- **🕵️ Autonomous Security Agent**: A built-in AI Copilot that can ingest raw logs, investigate incidents, and generate comprehensive, human-readable markdown audit reports.
- **🕸️ Interactive Threat Topologies**: Dynamic, force-directed graph visualizations of your network's security posture and attack surfaces.

---

## 🏗️ Architecture & Tech Stack

AegisCore is built with a decoupled Client-Server architecture for maximum scalability and performance.

### **Frontend (Client)**
- **Framework**: React 18 & Vite
- **Styling**: Tailwind CSS & Framer Motion for buttery-smooth micro-animations.
- **Data Viz**: Recharts & D3-Force for interactive security graphs.

### **Backend (Server)**
- **Framework**: Python 3.12 & Flask
- **Real-Time Layer**: Flask-SocketIO for instant duplex communication.
- **Machine Learning**: TensorFlow/Keras for anomaly detection.
- **AI Integration**: Google GenAI (Gemini 1.5) for autonomous log auditing and chat agents.
- **Database**: SQLite (Dev) / PostgreSQL (Prod ready).

---

## 🚀 Quick Start Guide (VS Code)

Get AegisCore running on your local machine in under 5 minutes. 

### 1. Prerequisites
Ensure you have the following installed:
- **Python 3.10+**
- **Node.js 18+**
- **A Google Gemini API Key**

### 2. Clone the Repository
```bash
git clone https://github.com/Hksona123/AegiScore.git
cd AegiScore
```

### 3. Start the Backend
Open an integrated terminal in VS Code and run:
```bash
cd Server
python -m venv venv

# Activate Virtual Environment
# Windows:
.\venv\Scripts\activate
# Mac/Linux:
source venv/bin/activate

# Install Core Dependencies
pip install -r requirements.txt

# Configure Environment
cp .env.example .env
# Important: Open the .env file and paste your GOOGLE_API_KEY inside!

# Launch the API
python run.py
```

### 4. Start the Frontend
Open a **second** integrated terminal in VS Code and run:
```bash
cd Frontend
npm install
npm run dev
```

The AegisCore command center is now live! Open your browser to `http://localhost:5173`.

---

## 🧪 Testing the Platform

### **Default Credentials**
- **Username**: `admin`
- **Password**: `AegisCore@2025!`

### **Running a Live Simulation**
We have included realistic simulation data so you can see the AI engines in action:
1. Navigate to the **Logs** tab in the dashboard.
2. Inside your cloned repository, locate the `Sample/` folder.
3. Upload `demo_network_attacks.csv` to trigger the LSTM threat detection engine.
4. Upload `demo_host_telemetry.csv` to watch the system identify process anomalies and reverse shell attempts.
5. Watch the **SOC** dashboard light up with real-time alerts!

---

## 🤝 Contributing
AegisCore is an open-source initiative aimed at democratizing enterprise-grade security tools. Pull requests, bug reports, and feature suggestions are always welcome.
