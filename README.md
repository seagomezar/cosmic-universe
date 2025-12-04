# Hybrid AI Race Coach (AI Test Field)

A high-performance racing coach application that leverages a hybrid AI architecture to provide real-time and post-analysis feedback to drivers.

## 🏎️ Overview

This project demonstrates a **Hybrid AI Architecture** combining:
- **Gemini Nano (Chrome Built-in AI):** For "Hot Path" advice. This runs locally in the browser with ultra-low latency (<50ms), providing immediate, critical safety and technique commands (e.g., "STABILIZE", "TRAIL BRAKE").
- **Gemini 2.5 Flash (Cloud API):** For "Warm Path" advice. This runs in the cloud and provides deeper, persona-based coaching analysis (e.g., "Good hustle, scoot out" from Coach Tony or physics-based advice from Coach Rachel).

## ✨ Features

- **Dual-Path AI Coaching:**
  - **Hot Path:** Immediate, imperative commands for safety and critical inputs.
  - **Warm Path:** Detailed, stylistic advice based on selectable coach personas.
- **Coach Personas:**
  - **Tony:** Motivational, "feel-based" coach.
  - **Rachel:** Analytical, physics-focused coach.
  - **AJ:** Direct, hybrid engineer style.
  - **Garmin:** Robotic, delta-optimization style.
  - **Super AJ:** Dynamic switching between styles based on context.
- **Real-time Telemetry Visualization:**
  - GPS Track Map.
  - G-Force Meter (Lateral & Longitudinal).
  - Speed, Throttle, and Brake gauges.
- **Audio Feedback:** Text-to-speech synthesis for both hot and warm advice, with priority handling to prevent overlapping.
- **CSV Data Import:** Load race telemetry data from CSV files for simulation and analysis.

## 🛠️ Tech Stack

- **Framework:** React 19 + Vite
- **Language:** TypeScript
- **Styling:** Tailwind CSS v4
- **Icons:** Lucide React
- **AI:** Google Gemini Nano (Chrome Built-in AI) & Gemini API

## 🚀 Setup & Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/seagomezar/ai-test-field.git
    cd ai-test-field
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment Variables:**
    Create a `.env` file in the root directory and add your Gemini API key:
    ```env
    VITE_GEMINI_API_KEY=your_api_key_here
    ```

4.  **Run the development server:**
    ```bash
    npm run dev
    ```

## ⚙️ Browser Configuration (Gemini Nano)

To enable the local "Hot Path" AI, you need to configure Chrome:

1.  **Enable Flags:**
    Go to `chrome://flags` and enable:
    - **Prompt API for Gemini Nano**
    - **Enforce On-Device Model Availability**

2.  **Update Components:**
    Go to `chrome://components`, find **Optimization Guide On Device Model**, and click "Check for update".

3.  **Restart Chrome.**

## 📦 Deployment

This project is configured to deploy to **GitHub Pages** automatically using GitHub Actions.

- **URL:** [https://seagomezar.github.io/ai-test-field/](https://seagomezar.github.io/ai-test-field/)
- **Workflow:** Pushing to the `main` branch triggers a build and deployment to the `gh-pages` branch.

### Manual Deployment
You can also manually deploy using:
```bash
npm run deploy
```
