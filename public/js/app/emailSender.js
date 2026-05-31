// ===== EMAIL LEAD SENDER FEATURE =====

let emailLeadSenderData = {
    selectedTable: null,
    sendOption: null, // 'all' or 'specific'
    selectedEmails: [],
    allEmails: []
};

// Open Email Lead Sender Modal
function openEmailLeadSender() {
    document.getElementById('emailLeadSenderModal').classList.add('active');
    showEmailSenderStep(1);
    loadEmailTablesForSender();
}

// Close Email Lead Sender Modal
function closeEmailLeadSender() {
    document.getElementById('emailLeadSenderModal').classList.remove('active');
    emailLeadSenderData = {
        selectedTable: null,
        sendOption: null,
        selectedEmails: [],
        allEmails: []
    };
}

// Show email sender step
function showEmailSenderStep(step) {
    document.querySelectorAll('.email-sender-step').forEach(s => s.classList.remove('active'));
    const stepId = typeof step === 'string' ? `emailSenderStep${step}` : `emailSenderStep${step}`;
    document.getElementById(stepId).classList.add('active');
}

// Fetch saved tables from the SQLite-backed API, hydrating each table's
// `data` array (the list endpoint omits it, so fetch each table by id).
// Returns the same shape as the localStorage `savedTables` value.
async function fetchSavedTablesFromApi() {
    const listResp = await fetch('/api/tables');
    if (!listResp.ok) throw new Error('Failed to load tables');
    const listJson = await listResp.json();
    if (!listJson || !listJson.success || !Array.isArray(listJson.tables)) {
        throw new Error('Invalid tables response');
    }

    return Promise.all(listJson.tables.map(async (summary) => {
        try {
            const detailResp = await fetch(`/api/tables/${summary.id}`);
            if (detailResp.ok) {
                const detailJson = await detailResp.json();
                if (detailJson && detailJson.success && detailJson.table) {
                    return { ...summary, ...detailJson.table };
                }
            }
        } catch (_error) {
            // fall through to summary-only below
        }
        // Keep the row usable even if detail fetch fails; default data to [].
        return { ...summary, data: Array.isArray(summary.data) ? summary.data : [] };
    }));
}

// Load email tables (name contains "email")
function loadEmailTablesForSender() {
    // Sync source of truth: render immediately from localStorage so the UI
    // never blocks or breaks if the API is unavailable.
    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
    renderEmailTablesForSender(savedTables);

    // Background hydration: prefer the API; on any failure keep the localStorage render.
    fetchSavedTablesFromApi()
        .then(apiTables => {
            if (Array.isArray(apiTables) && apiTables.length > 0) {
                renderEmailTablesForSender(apiTables);
            }
        })
        .catch(() => { /* keep localStorage render */ });
}

// Render the email-eligible tables into the picker (shared by the localStorage
// and API code paths so behavior stays identical).
function renderEmailTablesForSender(savedTables) {
    const container = document.getElementById('emailTablesListForSender');
    const noTablesMsg = document.getElementById('noEmailTablesForSender');

    container.innerHTML = '';

    // Filter tables whose name contains "email"
    const emailTables = savedTables.filter(table => {
        const nameLower = table.name.toLowerCase();
        return nameLower.includes('email');
    });
    
    if (emailTables.length === 0) {
        noTablesMsg.style.display = 'block';
        return;
    }
    
    noTablesMsg.style.display = 'none';
    
    emailTables.forEach(table => {
        // Count entries with valid emails
        const withEmails = (table.data || []).filter(entry => {
            const email = entry.Email || entry.email || '';
            return email && email.trim() !== '' && email.includes('@');
        }).length;
        
        const card = document.createElement('div');
        card.className = 'table-select-card';
        card.style.cursor = withEmails > 0 ? 'pointer' : 'not-allowed';
        card.style.opacity = withEmails > 0 ? '1' : '0.5';
        
        card.innerHTML = `
            <div style="flex: 1;">
                <div style="font-size: 18px; font-weight: 700; color: var(--dark); margin-bottom: 12px;">${table.name}</div>
                <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--gray);">
                        <span style="font-weight: 600; color: var(--dark);">${table.count}</span>
                        <span>📊 Total</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: ${withEmails > 0 ? '#f59e0b' : 'var(--gray)'};">
                        <span style="font-weight: 700;">${withEmails}</span>
                        <span>📧 Emails</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--gray);">
                        <span>📅</span>
                        <span>${new Date(table.date).toLocaleDateString()}</span>
                    </div>
                </div>
            </div>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" style="color: #f59e0b; stroke-width: 3;">
                <path d="M9 5l7 7-7 7"/>
            </svg>
        `;
        
        if (withEmails > 0) {
            card.onclick = () => selectTableForEmailSending(table);
        }
        
        container.appendChild(card);
    });
}

// Select table for email sending
function selectTableForEmailSending(table) {
    emailLeadSenderData.selectedTable = table;
    
    // Filter entries with valid emails
    emailLeadSenderData.allEmails = (table.data || []).filter(entry => {
        const email = entry.Email || entry.email || '';
        return email && email.trim() !== '' && email.includes('@');
    });
    
    // Show table info
    const infoDiv = document.getElementById('selectedTableInfo');
    infoDiv.innerHTML = `
        <div style="font-size: 16px; font-weight: 700; color: var(--dark); margin-bottom: 8px;">${table.name}</div>
        <div style="font-size: 14px; color: var(--gray);">
            📧 ${emailLeadSenderData.allEmails.length} valid email addresses
        </div>
    `;
    
    showEmailSenderStep(2);
}

// Back to table selection
function backToEmailTableSelection() {
    showEmailSenderStep(1);
    emailLeadSenderData.selectedTable = null;
    emailLeadSenderData.sendOption = null;
}

// Choose send option (all or specific)
function chooseEmailSendOption(option) {
    emailLeadSenderData.sendOption = option;
    
    if (option === 'all') {
        document.getElementById('allRecipientsCount').textContent = emailLeadSenderData.allEmails.length;
        showEmailSenderStep('3All');
    } else {
        loadSpecificEmailsList();
        showEmailSenderStep('3Specific');
    }
}

// Back to send options
function backToEmailSendOptions() {
    showEmailSenderStep(2);
}

// Load specific emails list with checkboxes
function loadSpecificEmailsList() {
    const container = document.getElementById('specificEmailsList');
    container.innerHTML = '';
    
    emailLeadSenderData.allEmails.forEach((entry, index) => {
        const name = entry.Name || entry.name || 'Unknown';
        const email = entry.Email || entry.email || '';
        
        const label = document.createElement('label');
        label.style.cssText = 'display: flex; align-items: center; gap: 12px; padding: 12px; background: var(--gray-light); border-radius: 8px; margin-bottom: 8px; cursor: pointer; transition: all 0.2s;';
        label.onmouseover = () => label.style.background = 'rgba(245, 158, 11, 0.1)';
        label.onmouseout = () => label.style.background = 'var(--gray-light)';
        
        label.innerHTML = `
            <input type="checkbox" value="${index}" onchange="updateSelectedEmailsCount()" style="width: 18px; height: 18px; cursor: pointer;">
            <div style="flex: 1;">
                <div style="font-weight: 600; color: var(--dark); font-size: 14px;">${name}</div>
                <div style="font-size: 12px; color: var(--gray); font-family: monospace;">${email}</div>
            </div>
        `;
        
        container.appendChild(label);
    });
}

// Update selected emails count
function updateSelectedEmailsCount() {
    const checkboxes = document.querySelectorAll('#specificEmailsList input[type="checkbox"]:checked');
    document.getElementById('selectedEmailsCount').textContent = checkboxes.length;
}

// Proceed to compose for specific
function proceedToComposeSpecific() {
    const checkboxes = document.querySelectorAll('#specificEmailsList input[type="checkbox"]:checked');
    
    if (checkboxes.length === 0) {
        alert('⚠️ Please select at least one recipient!');
        return;
    }
    
    emailLeadSenderData.selectedEmails = Array.from(checkboxes).map(cb => {
        const index = parseInt(cb.value);
        return emailLeadSenderData.allEmails[index];
    });
    
    document.getElementById('specificRecipientsCount').textContent = emailLeadSenderData.selectedEmails.length;
    showEmailSenderStep(4);
}

// Back to specific selection
function backToSpecificSelection() {
    showEmailSenderStep('3Specific');
}

// Send emails to all
async function sendEmailsToAll(runInBackground = false) {
    const subject = document.getElementById('emailSubjectAll').value.trim();
    const message = document.getElementById('emailMessageAll').value.trim();
    
    if (!subject) {
        alert('⚠️ Please enter an email subject!');
        return;
    }
    
    if (!message) {
        alert('⚠️ Please write a message!');
        return;
    }
    
    if (!confirm(`Send email to ${emailLeadSenderData.allEmails.length} recipients?\n\nSubject: ${subject}`)) {
        return;
    }
    
    if (runInBackground) {
        // Background mode
        try {
            const response = await fetch('/api/email/send-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients: emailLeadSenderData.allEmails,
                    subject: subject,
                    message: message,
                    runInBackground: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Email campaign started in background!\n\n📋 Task ID: ${result.taskId}\n📧 ${emailLeadSenderData.allEmails.length} emails to send\n\n👉 You can continue working. Click the tasks button (bottom-right) to monitor progress.`);
                // DO NOT close modal or show background tasks - let user stay on current screen
                // closeEmailLeadSender();
                // backgroundTasksUI.show();
            } else {
                alert('❌ Error: ' + result.error);
            }
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
        return;
    }
    
    showEmailSenderStep(5);
    await sendEmails(emailLeadSenderData.allEmails, subject, message);
}

// Send emails to specific
async function sendEmailsToSpecific(runInBackground = false) {
    const subject = document.getElementById('emailSubjectSpecific').value.trim();
    const message = document.getElementById('emailMessageSpecific').value.trim();
    
    if (!subject) {
        alert('⚠️ Please enter an email subject!');
        return;
    }
    
    if (!message) {
        alert('⚠️ Please write a message!');
        return;
    }
    
    if (!confirm(`Send email to ${emailLeadSenderData.selectedEmails.length} selected recipients?\n\nSubject: ${subject}`)) {
        return;
    }
    
    if (runInBackground) {
        // Background mode
        try {
            const response = await fetch('/api/email/send-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    recipients: emailLeadSenderData.selectedEmails,
                    subject: subject,
                    message: message,
                    runInBackground: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Email campaign started in background!\n\n📋 Task ID: ${result.taskId}\n📧 ${emailLeadSenderData.selectedEmails.length} emails to send\n\n👉 You can continue working. Click the tasks button (bottom-right) to monitor progress.`);
                // DO NOT close modal or show background tasks - let user stay on current screen
                // closeEmailLeadSender();
                // backgroundTasksUI.show();
            } else {
                alert('❌ Error: ' + result.error);
            }
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
        return;
    }
    
    showEmailSenderStep(5);
    await sendEmails(emailLeadSenderData.selectedEmails, subject, message);
}

// Send emails (main function)
async function sendEmails(recipients, subject, message) {
    const total = recipients.length;
    let sent = 0;
    let failed = 0;
    
    document.getElementById('emailSendingProgress').textContent = `0 / ${total}`;
    document.getElementById('emailSendingProgressBar').style.width = '0%';
    
    for (let i = 0; i < recipients.length; i++) {
        const recipient = recipients[i];
        const name = recipient.Name || recipient.name || 'Unknown';
        const email = recipient.Email || recipient.email || '';
        
        document.getElementById('currentEmailRecipient').textContent = `Sending to ${name} (${email})...`;
        
        try {
            const response = await fetch('/api/send-email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    to: email,
                    subject: subject,
                    message: message,
                    recipientName: name
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                sent++;
                console.log(`✅ Email sent to ${name} (${email})`);
            } else {
                failed++;
                console.error(`❌ Failed to send to ${name}:`, result.error);
            }
        } catch (error) {
            failed++;
            console.error(`❌ Error sending to ${name}:`, error);
        }
        
        // Update progress
        const progress = ((i + 1) / total) * 100;
        document.getElementById('emailSendingProgressBar').style.width = `${progress}%`;
        document.getElementById('emailSendingProgress').textContent = `${i + 1} / ${total}`;
        
        // Small delay between emails
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    // Show results
    displayEmailSendResults(sent, failed, total);
    showEmailSenderStep(6);
}

// Display email send results
function displayEmailSendResults(sent, failed, total) {
    const resultsDiv = document.getElementById('emailSendResults');
    
    resultsDiv.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center;">
            <div style="padding: 16px; background: var(--gray-light); border-radius: 12px; border: 2px solid #10b981;">
                <div style="font-size: 32px; font-weight: 800; color: #10b981; margin-bottom: 4px;">${sent}</div>
                <div style="font-size: 13px; color: var(--gray); font-weight: 600;">✅ Sent</div>
            </div>
            <div style="padding: 16px; background: var(--gray-light); border-radius: 12px; border: 2px solid var(--gray-border);">
                <div style="font-size: 32px; font-weight: 800; color: ${failed > 0 ? '#ef4444' : 'var(--gray)'}; margin-bottom: 4px;">${failed}</div>
                <div style="font-size: 13px; color: var(--gray); font-weight: 600;">❌ Failed</div>
            </div>
            <div style="padding: 16px; background: var(--gray-light); border-radius: 12px; border: 2px solid var(--primary);">
                <div style="font-size: 32px; font-weight: 800; color: var(--primary); margin-bottom: 4px;">${total}</div>
                <div style="font-size: 13px; color: var(--gray); font-weight: 600;">📊 Total</div>
            </div>
        </div>
        <div style="margin-top: 20px; padding: 16px; background: var(--gray-light); border-radius: 12px; text-align: center;">
            <p style="font-size: 14px; color: var(--dark); line-height: 1.6;">
                ${sent === total ? '🎉 All emails sent successfully!' : 
                  failed > 0 ? `⚠️ ${sent} emails sent, ${failed} failed. Check console for details.` : 
                  'Process complete!'}
            </p>
        </div>
    `;
}

// Event Listeners
document.getElementById('emailLeadSenderBtn').addEventListener('click', openEmailLeadSender);
document.getElementById('emailLeadSenderClose').addEventListener('click', closeEmailLeadSender);
document.getElementById('emailLeadSenderModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('emailLeadSenderModal')) closeEmailLeadSender();
});

// Make functions global
window.openEmailLeadSender = openEmailLeadSender;
window.closeEmailLeadSender = closeEmailLeadSender;
window.chooseEmailSendOption = chooseEmailSendOption;
window.backToEmailTableSelection = backToEmailTableSelection;
window.backToEmailSendOptions = backToEmailSendOptions;
window.proceedToComposeSpecific = proceedToComposeSpecific;
window.backToSpecificSelection = backToSpecificSelection;
window.sendEmailsToAll = sendEmailsToAll;
window.sendEmailsToSpecific = sendEmailsToSpecific;
window.updateSelectedEmailsCount = updateSelectedEmailsCount;
