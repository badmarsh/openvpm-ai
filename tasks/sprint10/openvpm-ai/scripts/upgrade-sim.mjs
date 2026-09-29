import fs from 'fs';

let html = fs.readFileSync('apps/web/public/demo/simulation.html', 'utf8');

// 1. Stepper layout responsiveness: remove min-width 960px so all 9 nodes fit on 100% width
html = html.replace('min-width: 960px;', 'width: 100%;');

// 2. Adjust circle size from 48px to 42px
html = html.replace('width: 48px;\n      height: 48px;', 'width: 42px;\n      height: 42px;');
html = html.replace('font-size: 1.25rem;\n      margin-bottom: 8px;', 'font-size: 1.12rem;\n      margin-bottom: 4px;');

// 3. Labels: max width and compact font
html = html.replace(
  'font-size: 0.74rem;\n      font-weight: 700;\n      color: var(--text-muted);',
  'font-size: 0.70rem;\n      font-weight: 700;\n      color: var(--text-muted);\n      max-width: 96px;'
);

// 4. Highlight GAP 404 node even when inactive
const gapInactiveCss = `    .ov-step-node.gap-node .ov-step-circle {
      border-color: #f87171;
      border-style: dashed;
      background: #fef2f2;
      animation: ovGapPulse 2s infinite ease-in-out;
    }
    @keyframes ovGapPulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
      50% { box-shadow: 0 0 0 5px rgba(239, 68, 68, 0.15); }
    }
    .ov-step-node.gap-node.active .ov-step-circle {`;

html = html.replace('.ov-step-node.gap-node.active .ov-step-circle {', gapInactiveCss);

// 5. Timeline component CSS
const timelineCss = `    /* Day Timeline Bar */
    .ov-timeline-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 7px 16px;
      margin-bottom: 12px;
      font-size: 0.76rem;
      font-weight: 700;
    }
    .ov-timeline-point {
      display: flex;
      align-items: center;
      gap: 5px;
      color: var(--text-muted);
      transition: all 0.2s ease;
    }
    .ov-timeline-point.active {
      color: var(--primary);
      font-weight: 800;
    }
    .ov-timeline-point.active span {
      background: var(--primary-light);
      padding: 2px 8px;
      border-radius: 12px;
      color: var(--primary);
    }
    .ov-timeline-arrow {
      color: var(--border-strong);
      font-size: 0.7rem;
    }

    /* Pipeline 9 Stations Stepper */`;

html = html.replace('/* Pipeline 9 Stations Stepper */', timelineCss);

// 6. Timeline HTML markup
const timelineHtml = `      <div class="ov-timeline-bar">
        <div class="ov-timeline-point active" id="ov-time-1">🕒 <span>08:02 Príjem</span></div>
        <div class="ov-timeline-arrow">➔</div>
        <div class="ov-timeline-point" id="ov-time-2">🕒 <span>08:15 Čakáreň</span></div>
        <div class="ov-timeline-arrow">➔</div>
        <div class="ov-timeline-point" id="ov-time-3">🕒 <span>08:18 Ambulancia</span></div>
        <div class="ov-timeline-arrow">➔</div>
        <div class="ov-timeline-point" id="ov-time-4">🕒 <span>08:24 Vyšetrenie</span></div>
        <div class="ov-timeline-arrow">➔</div>
        <div class="ov-timeline-point" id="ov-time-5">🕒 <span>08:32 Diagnostika</span></div>
        <div class="ov-timeline-arrow">➔</div>
        <div class="ov-timeline-point" id="ov-time-6">🕒 <span>08:40 e-Kasa & Odchod</span></div>
      </div>

      <div class="ov-pipeline-container">`;

html = html.replace('<div class="ov-pipeline-container">', timelineHtml);

// 7. Auto-start and timeline sync in JavaScript
const initOld = 'updatePatientHUD();\n    renderStep(0);\n    ovCalcUpdate();\n  })();';
const initNew = `    function updateTimeline(step) {
      const times = [
        { el: "ov-time-1", active: step === 0 },
        { el: "ov-time-2", active: step === 1 },
        { el: "ov-time-3", active: step === 2 || step === 3 },
        { el: "ov-time-4", active: step === 4 },
        { el: "ov-time-5", active: step === 5 },
        { el: "ov-time-6", active: step >= 6 }
      ];
      times.forEach(t => {
        const el = document.getElementById(t.el);
        if (!el) return;
        if (t.active) el.classList.add("active");
        else el.classList.remove("active");
      });
    }

    const _origRenderStep = renderStep;
    renderStep = function(idx) {
      _origRenderStep(idx);
      updateTimeline(idx);
    };

    updatePatientHUD();
    renderStep(0);
    ovCalcUpdate();

    // Auto-play trigger after 1.2s
    setTimeout(() => {
      if (!isPlaying) {
        ovStartPlay();
      }
    }, 1200);
  })();`;

html = html.replace(initOld, initNew);

fs.writeFileSync('apps/web/public/demo/simulation.html', html, 'utf8');
fs.writeFileSync('apps/web/public/simulation.html', html, 'utf8');
fs.writeFileSync('docs/product-discovery/simulation.html', html, 'utf8');
console.log('Upgraded simulation files successfully!');
