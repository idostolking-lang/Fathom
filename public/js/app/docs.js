// In-app operating guide. Renders a thorough walkthrough into #docsRoot.
(function () {
  let inited = false;

  const HTML = `
    <div class="head">
      <div>
        <div class="crumb">Console <span class="sep">/</span> Docs</div>
        <h1>How Fathom works</h1>
        <p>A complete guide to operating the console: the workflow, every feature, Routines, the AI, and the outreach channels.</p>
      </div>
    </div>

    <div class="chips" style="margin-bottom:22px">
      <span class="chip" onclick="document.getElementById('d-model').scrollIntoView({behavior:'smooth'})">Mental model</span>
      <span class="chip" onclick="document.getElementById('d-console').scrollIntoView({behavior:'smooth'})">The console</span>
      <span class="chip" onclick="document.getElementById('d-flow').scrollIntoView({behavior:'smooth'})">Workflow</span>
      <span class="chip" onclick="document.getElementById('d-features').scrollIntoView({behavior:'smooth'})">Features</span>
      <span class="chip" onclick="document.getElementById('d-routines').scrollIntoView({behavior:'smooth'})">Routines</span>
      <span class="chip" onclick="document.getElementById('d-ai').scrollIntoView({behavior:'smooth'})">AI</span>
      <span class="chip" onclick="document.getElementById('d-channels').scrollIntoView({behavior:'smooth'})">Outreach</span>
      <span class="chip" onclick="document.getElementById('d-remote').scrollIntoView({behavior:'smooth'})">Remote control</span>
      <span class="chip" onclick="document.getElementById('d-settings').scrollIntoView({behavior:'smooth'})">Settings</span>
      <span class="chip" onclick="document.getElementById('d-start').scrollIntoView({behavior:'smooth'})">First steps</span>
    </div>

    <div class="panel" id="d-model" style="margin-bottom:18px">
      <div class="ph"><h3>The mental model</h3></div>
      <div style="padding:18px;color:var(--text-mid);line-height:1.8">
        Fathom is a <b>detection instrument</b> for finding and qualifying business leads. You sweep a market, the businesses come back as signals, you enrich and study them, then act. Everything runs on your machine and is stored locally in a SQLite database (<span class="mono">data/fathom.db</span>). The valuable work is deciding who to contact and what to say; Fathom removes the busywork around that.
      </div>
    </div>

    <div class="panel" id="d-console" style="margin-bottom:18px">
      <div class="ph"><h3>The console layout</h3></div>
      <div style="padding:18px;color:var(--text-mid);line-height:1.8">
        <ul style="margin-left:18px">
          <li><b>Top instrument bar</b>: brand plus live readouts: system status, WhatsApp link state, active-run count, and the local time. Click the time to change timezone.</li>
          <li><b>Left rail</b>: grouped navigation. <b>Console</b> (Home, Routines, Docs), <b>Collect</b> (Discover, Enrich), <b>Act</b> (Outreach, SMS, Consultant), and <b>Operations</b>.</li>
          <li><b>Work area</b>: the current screen.</li>
          <li><b>Operations dock</b> (right): live background jobs with progress and recent log lines. The Operations rail item opens the full task panel with pause, resume, cancel, and logs.</li>
        </ul>
      </div>
    </div>

    <div class="panel" id="d-flow" style="margin-bottom:18px">
      <div class="ph"><h3>The core workflow</h3></div>
      <div style="padding:18px">
        <p class="mono" style="color:var(--signal);font-size:13px;margin-bottom:14px">Discover &rarr; Tables &rarr; Enrich &rarr; Research &rarr; Outreach</p>
        <ol style="margin-left:18px;line-height:1.9;color:var(--text-mid)">
          <li><b>Discover</b>: paste a Google Maps search or place URL. Fathom scrolls the results and visits each place, extracting Name, Address, Phone, and Website.</li>
          <li><b>Save</b> the results as a Table (a reusable lead list).</li>
          <li><b>Enrich</b>: visit each saved website and pull a contact Email into the table.</li>
          <li><b>Research</b>: AI analyzes the websites into a report, or drafts a per-business outreach opener.</li>
          <li><b>Act</b>: send via Email, WhatsApp, or SMS, or work a lead in the Consultant chat.</li>
        </ol>
        <p style="color:var(--text-low);margin-top:12px;font-size:13px">Any long step (Discover, Enrich, bulk send, a full Routine) runs as a tracked background job, so the console stays responsive.</p>
      </div>
    </div>

    <div class="panel" id="d-features" style="margin-bottom:18px">
      <div class="ph"><h3>Features</h3></div>
      <table class="gtable">
        <thead><tr><th>Feature</th><th>What it does</th></tr></thead>
        <tbody>
          <tr><td class="name">Discover</td><td class="dim">Scrape Google Maps into a business table</td></tr>
          <tr><td class="name">Saved Tables</td><td class="dim">Reusable lead lists; open, export, or feed into other tools</td></tr>
          <tr><td class="name">Enrich (Email Extractor)</td><td class="dim">Visit each website and add a contact email</td></tr>
          <tr><td class="name">Specific Search</td><td class="dim">AI reads each website and answers your research question into a report</td></tr>
          <tr><td class="name">Saved Reports / Lead from Report</td><td class="dim">Keep AI reports; turn one into a tailored marketing message</td></tr>
          <tr><td class="name">Analyze Messages</td><td class="dim">AI analysis of pasted chats, photos, or files (with cost tracking)</td></tr>
          <tr><td class="name">Consultant</td><td class="dim">A saved-context AI chat; pick a model and a behavior persona</td></tr>
          <tr><td class="name">Compare Tables</td><td class="dim">Find duplicates or unique rows across two lists</td></tr>
          <tr><td class="name">Clipboard</td><td class="dim">Save and reuse message snippets</td></tr>
          <tr><td class="name">Outreach</td><td class="dim">Bulk send over WhatsApp, Email, or SMS from a saved table</td></tr>
        </tbody>
      </table>
    </div>

    <div class="panel" id="d-routines" style="margin-bottom:18px">
      <div class="ph"><h3>Routines (the automation centerpiece)</h3></div>
      <div style="padding:18px;color:var(--text-mid);line-height:1.8">
        <p>A Routine is a saved pipeline that runs the whole workflow for you. Open <b>Routines</b> in the rail, click <b>New routine</b>, then add and configure steps. Each step receives the previous step's working set of rows and passes its result to the next.</p>
        <table class="gtable" style="margin:14px 0">
          <thead><tr><th>Step</th><th>What it does</th></tr></thead>
          <tbody>
            <tr><td class="name">Discover</td><td class="dim">Scrape a Maps URL into rows</td></tr>
            <tr><td class="name">Filter</td><td class="dim">Keep only rows matching a field condition (e.g. has a website)</td></tr>
            <tr><td class="name">Enrich</td><td class="dim">Add a contact email from each website</td></tr>
            <tr><td class="name">Analyze</td><td class="dim">AI drafts a per-business message (pick a prompt template + model)</td></tr>
            <tr><td class="name">Send email / WhatsApp / SMS</td><td class="dim">Message each row, templated with {{Name}}, throttled</td></tr>
            <tr><td class="name">Save</td><td class="dim">Persist the working set as a named table</td></tr>
          </tbody>
        </table>
        <p><b>Run now</b> executes the routine as a tracked job (watch the Operations dock). <b>Schedule</b> attaches a cron preset (for example daily at 07:00); the built-in scheduler then runs it automatically. Every run is recorded with its logs, so you can review what happened. A pure research routine might be Discover &rarr; Filter &rarr; Enrich &rarr; Analyze &rarr; Save and never send anything.</p>
      </div>
    </div>

    <div class="panel" id="d-ai" style="margin-bottom:18px">
      <div class="ph"><h3>AI: models and prompt templates</h3></div>
      <div style="padding:18px;color:var(--text-mid);line-height:1.8">
        <ul style="margin-left:18px">
          <li>Set <span class="mono">OPENAI_API_KEY</span> in <span class="mono">.env</span> to enable AI features.</li>
          <li><b>Models</b>: every AI feature (Specific Search, Analyze Messages, Consultant, Lead from Report) and the Routines analyze step has a model picker. The lineup is config-driven: edit <span class="mono">public/js/config.js</span> to add or change models.</li>
          <li><b>Prompt templates</b>: ready-made prompts (also in <span class="mono">public/js/config.js</span>) appear as a dropdown in those same features. Pick one to fill the instruction field, then edit it freely.</li>
        </ul>
      </div>
    </div>

    <div class="panel" id="d-channels" style="margin-bottom:18px">
      <div class="ph"><h3>Outreach channels</h3></div>
      <table class="gtable" style="margin-bottom:14px">
        <thead><tr><th>Channel</th><th>Setup</th></tr></thead>
        <tbody>
          <tr><td class="name">Email</td><td class="dim">Set EMAIL_USER + EMAIL_PASS (a Gmail app password) in .env</td></tr>
          <tr><td class="name">WhatsApp</td><td class="dim">Click the WhatsApp readout in the top bar and scan the QR code</td></tr>
          <tr><td class="name">SMS</td><td class="dim">Open the SMS panel and configure a gateway (or set SMS_GATEWAY_URL in .env)</td></tr>
        </tbody>
      </table>
      <div style="padding:0 18px 18px;color:var(--text-mid);line-height:1.8">
        <b>SMS gateway:</b> a self-hosted SMS gateway is an app, for example an Android phone running an HTTP SMS gateway, that exposes an HTTP endpoint. In the SMS panel, set the gateway URL, an optional authorization header, and the field names it expects for the number and the text. Fathom POSTs <span class="mono">{ phone, message }</span> to that endpoint for each recipient. Any provider that accepts an HTTP POST works; there is no vendor lock-in. All sending is throttled by design.
      </div>
    </div>

    <div class="panel" id="d-remote" style="margin-bottom:18px">
      <div class="ph"><h3>WhatsApp remote control</h3></div>
      <div style="padding:18px;color:var(--text-mid);line-height:1.8">
        <p>With WhatsApp linked, run and manage routines from your phone by texting your linked number. Set the authorized phone number under Settings, then text these commands:</p>
        <table class="gtable" style="margin:12px 0">
          <thead><tr><th>Command</th><th>What it does</th></tr></thead>
          <tbody>
            <tr><td class="name mono">list</td><td class="dim">Your routines with their ids</td></tr>
            <tr><td class="name mono">run &lt;id or name&gt;</td><td class="dim">Run a routine now</td></tr>
            <tr><td class="name mono">status</td><td class="dim">Active jobs and progress</td></tr>
            <tr><td class="name mono">runs &lt;id&gt;</td><td class="dim">Recent runs of a routine</td></tr>
            <tr><td class="name mono">schedule &lt;id&gt; &lt;cron&gt;</td><td class="dim">Attach a cron schedule</td></tr>
            <tr><td class="name mono">enable / disable &lt;id&gt;</td><td class="dim">Turn a routine on or off</td></tr>
            <tr><td class="name mono">new &lt;name&gt;</td><td class="dim">Create an empty routine to fill in the app</td></tr>
            <tr><td class="name mono">help</td><td class="dim">The full command list</td></tr>
          </tbody>
        </table>
        <p>Turn on notifications in Settings to get a WhatsApp message whenever a run finishes. Only your authorized number can send commands.</p>
      </div>
    </div>

    <div class="panel" id="d-settings" style="margin-bottom:18px">
      <div class="ph"><h3>Settings and configuration</h3></div>
      <div style="padding:18px;color:var(--text-mid);line-height:1.8">
        <ul style="margin-left:18px">
          <li><b>.env</b> (project root): <span class="mono">OPENAI_API_KEY</span>, <span class="mono">OPENAI_MODEL</span>, <span class="mono">EMAIL_USER/EMAIL_PASS</span>, <span class="mono">SMS_GATEWAY_*</span>, <span class="mono">HOST/PORT</span>, <span class="mono">APP_ACCESS_TOKEN</span>.</li>
          <li><b>From the UI</b> (Settings in the rail): the AI model lineup, the SMS gateway (guided, with a test), and WhatsApp remote control. Plus timezone, by clicking the clock. UI settings are stored locally and take priority over .env.</li>
          <li><b>In code</b>: the model lineup and prompt templates in <span class="mono">public/js/config.js</span>.</li>
        </ul>
      </div>
    </div>

    <div class="panel" id="d-start" style="margin-bottom:18px">
      <div class="ph"><h3>First steps</h3></div>
      <div style="padding:18px;color:var(--text-mid);line-height:1.8">
        <ol style="margin-left:18px">
          <li>Run <span class="mono">npm start</span> and open <span class="mono">http://localhost:7000</span>.</li>
          <li>Add your <span class="mono">OPENAI_API_KEY</span> to <span class="mono">.env</span> for AI features.</li>
          <li><b>Discover</b> a market: paste a Google Maps search URL, then save the results as a Table.</li>
          <li><b>Enrich</b> the table to pull emails, or open <b>Specific Search</b> to research the businesses with AI.</li>
          <li>Automate it: build a <b>Routine</b> (Discover &rarr; Filter &rarr; Enrich &rarr; Analyze &rarr; Save), then Run or Schedule it.</li>
        </ol>
        <p style="color:var(--text-low);margin-top:10px;font-size:13px">Keep the app on localhost or a private network. The full README ships in the repository root.</p>
      </div>
    </div>`;

  function init() {
    const root = document.getElementById('docsRoot');
    if (!root || inited) return;
    root.innerHTML = HTML;
    inited = true;
  }

  window.Docs = { init };
})();
