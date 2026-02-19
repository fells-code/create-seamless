/* =========================
   Base Reset
========================= */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html, body, #root {
  height: 100%;
  font-family: Inter, system-ui, -apple-system, sans-serif;
  background: #0b0f14;
  color: #e6edf3;
  overflow: hidden;
}

/* =========================
   Animated Grid Background
========================= */
.grid-bg {
  position: fixed;
  inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px);
  background-size: 60px 60px;
  animation: gridDrift 80s linear infinite;
  mask-image: radial-gradient(circle at 35% 25%, black 40%, transparent 75%);
  z-index: 0;
}

@keyframes gridDrift {
  from { background-position: 0 0, 0 0; }
  to { background-position: 120px 60px, 60px 120px; }
}

/* =========================
   Layout
========================= */
.app-container {
  position: relative;
  display: flex;
  height: 100%;
  z-index: 1;
}

.left-panel,
.right-panel {
  flex: 1;
  display: flex;
  padding: 5rem;
}

.left-panel {
  align-items: center;
  justify-content: center;
  border-right: 1px solid rgba(255,255,255,0.035);
}

.right-panel {
  flex-direction: column;
  justify-content: center;
  align-items: flex-start;
  max-width: 640px;
  opacity: 0.92; /* subtle tone difference */
}


/* =========================
   Auth Card
========================= */
.auth-card {
  width: 100%;
  max-width: 420px;
  padding: 2.25rem;
  border-radius: 10px;
  background: #11161d;
  border: 1px solid rgba(255,255,255,0.06);
}

.auth-card h2 {
  margin-bottom: 1.75rem;
  font-weight: 600;
  font-size: 1.4rem;
}

/* Inputs */
.auth-input {
  width: 100%;
  padding: 0.85rem;
  margin-bottom: 1rem;
  border-radius: 6px;
  border: 1px solid rgba(255,255,255,0.08);
  background: #151b23;
  color: #e6edf3;
  outline: none;
}

.auth-input:focus {
  border-color: #00e0a4;
}

/* Buttons */
.auth-button {
  width: 100%;
  padding: 0.85rem;
  border-radius: 6px;
  border: none;
  background: #00e0a4;
  color: #0b0f14;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s ease;
}

.auth-button:hover {
  background: #00c28e;
}

/* =========================
   Brand Section
========================= */
.brand-title {
  font-size: 2.6rem;
  font-weight: 700;
  margin-bottom: 1.25rem;
  letter-spacing: -0.5px;
}

.brand-subtitle {
  opacity: 0.65;
  line-height: 1.6;
  margin-bottom: 2rem;
  max-width: 520px;
}

.docs-link {
  color: #00e0a4;
  text-decoration: none;
  font-weight: 500;
}

.docs-link:hover {
  text-decoration: underline;
}

/* =========================
   Micro Label
========================= */
.micro-label {
  margin-top: 3rem;
  font-size: 0.75rem;
  letter-spacing: 1px;
  text-transform: uppercase;
  opacity: 0.35;
}
