// ===== INSTAGRAM AUTOMATION WITH MANUAL CONNECTION =====

let instagramProgressInterval = null;
let instagramConnected = false;

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Check Instagram Status
function checkInstagramStatus() {
    fetch('/api/instagram/status')
        .then(res => res.json())
        .then(data => {
            const statusText = document.getElementById('instagramStatusText');
            const connectBtn = document.getElementById('connectInstagramBtn');
            const disconnectBtn = document.getElementById('disconnectInstagramBtn');
            const connectionSection = document.getElementById('instagramConnectionSection');
            
            if (data.isReady) {
                statusText.innerHTML = `✅ Connected as <strong>@${escapeHtml(data.username)}</strong>`;
                statusText.style.color = '#10b981';
                instagramConnected = true;
                
                // Hide connection form, show disconnect button
                connectionSection.style.display = 'none';
                connectBtn.style.display = 'none';
                disconnectBtn.style.display = 'block';
            } else {
                statusText.innerHTML = '❌ Not connected';
                statusText.style.color = '#ef4444';
                instagramConnected = false;
                
                // Show connect button, hide disconnect
                connectBtn.style.display = 'block';
                disconnectBtn.style.display = 'none';
            }
        })
        .catch(err => {
            console.error('Instagram status check failed:', err);
            const statusText = document.getElementById('instagramStatusText');
            statusText.textContent = '❌ Server error';
            statusText.style.color = '#ef4444';
        });
}

// Toggle Instagram Connection Form
function toggleInstagramConnection() {
    const connectionSection = document.getElementById('instagramConnectionSection');
    const connectBtn = document.getElementById('connectInstagramBtn');
    
    if (connectionSection.style.display === 'none') {
        // Show connection form
        connectionSection.style.display = 'block';
        connectBtn.textContent = '🚀 Connect Now';
        connectBtn.onclick = connectToInstagram;
    } else {
        // Attempt connection
        connectToInstagram();
    }
}

// Connect to Instagram
async function connectToInstagram() {
    const username = document.getElementById('instagramUsernameInput').value.trim();
    const password = document.getElementById('instagramPasswordInput').value.trim();
    const connectBtn = document.getElementById('connectInstagramBtn');
    const statusText = document.getElementById('instagramStatusText');
    
    if (!username || !password) {
        alert('⚠️ Please enter both username and password!');
        return;
    }
    
    // Show loading state
    connectBtn.disabled = true;
    connectBtn.innerHTML = '<div class="loader" style="width: 16px; height: 16px; margin: 0 auto;"></div>';
    statusText.textContent = '🔄 Connecting...';
    statusText.style.color = '#3b82f6';
    
    try {
        const response = await fetch('/api/instagram/connect', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusText.innerHTML = `✅ Connected as <strong>@${escapeHtml(result.username)}</strong>`;
            statusText.style.color = '#10b981';
            
            // Clear password field
            document.getElementById('instagramPasswordInput').value = '';
            
            // Hide connection form
            document.getElementById('instagramConnectionSection').style.display = 'none';
            
            // Update buttons
            connectBtn.style.display = 'none';
            document.getElementById('disconnectInstagramBtn').style.display = 'block';
            
            instagramConnected = true;
            
            alert('✅ Successfully connected to Instagram!\n\n🔐 Connection secured with enhanced anti-detection measures.');
        } else {
            throw new Error(result.error || 'Connection failed');
        }
    } catch (error) {
        console.error('Instagram connection error:', error);
        statusText.textContent = '❌ Connection failed';
        statusText.style.color = '#ef4444';
        alert(`❌ Connection failed:\n\n${error.message}\n\nPlease check your credentials and try again.`);
        
        // Reset button
        connectBtn.disabled = false;
        connectBtn.innerHTML = '🚀 Try Again';
        connectBtn.onclick = connectToInstagram;
    }
}

// Disconnect from Instagram
async function disconnectInstagram() {
    if (!confirm('🔌 Disconnect from Instagram?\n\nYou will need to reconnect to send messages.')) {
        return;
    }
    
    const statusText = document.getElementById('instagramStatusText');
    statusText.textContent = '🔄 Disconnecting...';
    statusText.style.color = '#3b82f6';
    
    try {
        const response = await fetch('/api/instagram/disconnect', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            statusText.textContent = '❌ Not connected';
            statusText.style.color = '#ef4444';
            
            // Reset form
            document.getElementById('instagramUsernameInput').value = '';
            document.getElementById('instagramPasswordInput').value = '';
            document.getElementById('instagramConnectionSection').style.display = 'none';
            
            // Update buttons
            document.getElementById('connectInstagramBtn').style.display = 'block';
            document.getElementById('connectInstagramBtn').textContent = '🔗 Connect to Instagram';
            document.getElementById('connectInstagramBtn').onclick = toggleInstagramConnection;
            document.getElementById('disconnectInstagramBtn').style.display = 'none';
            
            instagramConnected = false;
            
            alert('✅ Disconnected successfully!');
        }
    } catch (error) {
        console.error('Instagram disconnection error:', error);
        alert('❌ Error disconnecting: ' + error.message);
    }
}

// Open Instagram Modal
function openInstagramModal() {
    document.getElementById('instagramModal').classList.add('active');
    checkInstagramStatus();
}

// Close Instagram Modal
function closeInstagramModal() {
    document.getElementById('instagramModal').classList.remove('active');
    if (instagramProgressInterval) {
        clearInterval(instagramProgressInterval);
        instagramProgressInterval = null;
    }
}

// Reset Modal to Initial State
function resetInstagramModal() {
    document.getElementById('instagramConfigSection').style.display = 'block';
    document.getElementById('instagramProgressSection').style.display = 'none';
    document.getElementById('instagramResultsSection').style.display = 'none';
    
    // Clear inputs
    document.getElementById('instagramSearchQuery').value = '';
    document.getElementById('instagramMaxAccounts').value = '10';
    document.getElementById('instagramSpecificAccounts').value = '';
    document.getElementById('instagramMessage').value = '';
    
    // Clear logs
    document.getElementById('instagramLogs').innerHTML = '';
}

// Start Instagram Automation
async function startInstagramAutomation(runInBackground = false) {
    // Check if connected first
    if (!instagramConnected) {
        alert('⚠️ Please connect to Instagram first!\n\nClick the "Connect to Instagram" button above.');
        return;
    }
    
    const searchType = document.getElementById('instagramSearchType').value;
    const searchQuery = document.getElementById('instagramSearchQuery').value.trim();
    const maxAccounts = parseInt(document.getElementById('instagramMaxAccounts').value);
    const specificAccountsText = document.getElementById('instagramSpecificAccounts').value.trim();
    const messageTemplate = document.getElementById('instagramMessage').value.trim();
    
    // Validation
    if (!specificAccountsText && !searchQuery) {
        alert('⚠️ Please enter a search query or specific accounts!');
        return;
    }
    
    if (!messageTemplate) {
        alert('⚠️ Please write a message to send!');
        return;
    }
    
    // Parse specific accounts if provided
    let specificAccounts = null;
    if (specificAccountsText) {
        specificAccounts = specificAccountsText
            .split(/[\s,;]+/)
            .map(u => u.trim().replace(/^https?:\/\/(www\.)?instagram\.com\//i, '').split(/[/?#]/)[0].replace(/^@+/, ''))
            .filter(u => /^[A-Za-z0-9._]+$/.test(u));
        specificAccounts = [...new Set(specificAccounts.map(u => u.toLowerCase()))];
        if (specificAccounts.length === 0) {
            specificAccounts = null;
        }
    }
    
    // Confirm
    const confirmMessage = specificAccounts 
        ? `Send messages to ${specificAccounts.length} specific accounts?`
        : `Search "${searchQuery}" and send messages to up to ${maxAccounts} accounts?`;
    
    if (!confirm(`⚠️ ${confirmMessage}\n\nThis will start automatically. Continue?`)) {
        return;
    }
    
    if (runInBackground) {
        // Background mode - start task and close modal
        try {
            const response = await fetch('/api/instagram/search-and-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    searchQuery: searchQuery || undefined,
                    searchType: searchType,
                    maxAccounts: maxAccounts,
                    specificAccounts: specificAccounts,
                    messageTemplate: messageTemplate,
                    runInBackground: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Instagram automation started in background!\n\n📋 Task ID: ${result.taskId}\n\n👉 You can continue working. Click the tasks button (bottom-right) to monitor progress.`);
                // DO NOT close modal or show background tasks - let user stay on current screen
                // closeInstagramModal();
                // backgroundTasksUI.show();
            } else {
                alert('❌ Error: ' + result.error);
            }
            
        } catch (error) {
            console.error('Instagram automation error:', error);
            alert('❌ Error: ' + error.message);
        }
        
        return;
    }
    
    // Normal foreground mode - show progress
    document.getElementById('instagramConfigSection').style.display = 'none';
    document.getElementById('instagramProgressSection').style.display = 'block';
    document.getElementById('instagramResultsSection').style.display = 'none';
    
    // Reset progress
    document.getElementById('progressCount').textContent = '0 / 0';
    document.getElementById('sentCount').textContent = '0';
    document.getElementById('failedCount').textContent = '0';
    document.getElementById('currentUsername').textContent = '-';
    document.getElementById('instagramProgressBar').style.width = '0%';
    document.getElementById('instagramLogs').innerHTML = '';
    
    try {
        // Start polling before the long request so progress updates while it runs
        startProgressPolling();

        // Send request (this will take a long time)
        const response = await fetch('/api/instagram/search-and-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                searchQuery: searchQuery || undefined,
                searchType: searchType,
                maxAccounts: maxAccounts,
                specificAccounts: specificAccounts,
                messageTemplate: messageTemplate,
                runInBackground: false
            })
        });

        const result = await response.json();
        
        // Stop polling
        if (instagramProgressInterval) {
            clearInterval(instagramProgressInterval);
            instagramProgressInterval = null;
        }
        
        if (result.success) {
            // Show final results
            showInstagramResults(result);
        } else {
            alert('❌ Error: ' + result.error);
            // Show logs if available
            if (result.logs && result.logs.length > 0) {
                displayLogs(result.logs);
            }
            document.getElementById('closeProgressBtn').style.display = 'inline-block';
        }
        
    } catch (error) {
        if (instagramProgressInterval) {
            clearInterval(instagramProgressInterval);
            instagramProgressInterval = null;
        }
        console.error('Instagram automation error:', error);
        alert('❌ Error: ' + error.message);
        document.getElementById('closeProgressBtn').style.display = 'inline-block';
    }
}

// Start Polling Progress
function startProgressPolling() {
    // Poll every 2 seconds
    instagramProgressInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/instagram/progress');
            const data = await response.json();
            
            if (data.operation) {
                updateProgress(data.operation);
            }
        } catch (error) {
            console.error('Progress polling error:', error);
        }
    }, 2000);
}

// Update Progress Display
function updateProgress(operation) {
    if (!operation) return;
    
    // Update stats
    document.getElementById('progressCount').textContent = `${operation.progress} / ${operation.total}`;
    document.getElementById('sentCount').textContent = operation.sent || 0;
    document.getElementById('failedCount').textContent = operation.failed || 0;
    
    // Update current username
    if (operation.current) {
        document.getElementById('currentUsername').textContent = `@${operation.current}`;
    }
    
    // Update progress bar
    const percentage = operation.total > 0 ? (operation.progress / operation.total) * 100 : 0;
    document.getElementById('instagramProgressBar').style.width = `${percentage}%`;
    
    // Display logs
    if (operation.logs && operation.logs.length > 0) {
        displayLogs(operation.logs);
    }
}

// Display Logs
function displayLogs(logs) {
    const logsContainer = document.getElementById('instagramLogs');
    logsContainer.innerHTML = '';
    
    logs.forEach(log => {
        const logLine = document.createElement('div');
        logLine.style.marginBottom = '4px';
        
        // Color based on type
        let color;
        let icon;
        switch (log.type) {
            case 'success':
                color = '#10b981';
                icon = '✅';
                break;
            case 'error':
                color = '#ef4444';
                icon = '❌';
                break;
            case 'warning':
                color = '#f59e0b';
                icon = '⚠️';
                break;
            default:
                color = '#06b6d4';
                icon = '📝';
        }
        
        logLine.style.color = color;
        logLine.textContent = `${icon} ${log.message}`;
        
        logsContainer.appendChild(logLine);
    });
    
    // Auto-scroll to bottom
    logsContainer.scrollTop = logsContainer.scrollHeight;
}

// Show Instagram Results
function showInstagramResults(result) {
    document.getElementById('instagramProgressSection').style.display = 'none';
    document.getElementById('instagramResultsSection').style.display = 'block';
    
    // Show summary
    const summary = document.getElementById('finalSummary');
    summary.innerHTML = `
        <div style="font-size: 18px; font-weight: 700; color: var(--dark); margin-bottom: 8px;">
            📊 Automation Complete!
        </div>
        <div style="font-size: 15px; color: var(--gray);">
            ✅ <strong style="color: #10b981;">${result.sent}</strong> messages sent<br>
            ❌ <strong style="color: #ef4444;">${result.failed}</strong> failed<br>
            📊 Total: <strong>${result.totalFound}</strong> accounts found
        </div>
    `;
    
    // Display results list
    const resultsList = document.getElementById('instagramResultsList');
    resultsList.innerHTML = '';
    
    if (result.results && result.results.length > 0) {
        result.results.forEach(account => {
            const card = document.createElement('div');
            card.style.cssText = 'background: var(--gray-light); padding: 16px; border-radius: 12px; margin-bottom: 12px; border-left: 4px solid ' + (account.messageSent ? '#10b981' : '#ef4444');
            
            const statusIcon = account.messageSent ? '✅' : '❌';
            const statusText = account.messageSent ? 'Message Sent' : (account.reason || account.error || 'Failed');
            const statusColor = account.messageSent ? '#10b981' : '#ef4444';
            const safeUsername = escapeHtml(account.username);
            const safeFullName = escapeHtml(account.fullName);
            const safeBiography = escapeHtml((account.biography || '').substring(0, 100));
            const safeStatusText = escapeHtml(statusText);
            const hasFullName = Boolean(account.fullName);
            const hasBiography = Boolean(account.biography);
            const biographyLength = String(account.biography || '').length;
            
            card.innerHTML = `
                <div style="display: flex; justify-content: space-between; align-items: start; gap: 16px;">
                    <div style="flex: 1;">
                        <div style="font-size: 16px; font-weight: 600; color: var(--dark); margin-bottom: 4px;">
                            @${safeUsername} ${account.isVerified ? '✓' : ''}
                        </div>
                        ${hasFullName ? `<div style="font-size: 13px; color: var(--gray); margin-bottom: 4px;">${safeFullName}</div>` : ''}
                        ${account.followerCount ? `<div style="font-size: 13px; color: var(--gray);">👥 ${account.followerCount.toLocaleString()} followers</div>` : ''}
                        ${hasBiography ? `<div style="font-size: 12px; color: var(--gray); margin-top: 8px; font-style: italic;">"${safeBiography}${biographyLength > 100 ? '...' : ''}"</div>` : ''}
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 14px; font-weight: 600; color: ${statusColor};">
                            ${statusIcon} ${safeStatusText}
                        </div>
                        ${account.isPrivate ? '<div style="font-size: 12px; color: var(--gray); margin-top: 4px;">🔒 Private</div>' : ''}
                    </div>
                </div>
            `;
            
            resultsList.appendChild(card);
        });
    } else {
        resultsList.innerHTML = '<p style="text-align: center; color: var(--gray); padding: 40px;">No results to display</p>';
    }
}

// Event Listeners
document.getElementById('instagramAutomationBtn').addEventListener('click', openInstagramModal);
document.getElementById('instagramClose').addEventListener('click', closeInstagramModal);
document.getElementById('closeInstagramModal').addEventListener('click', closeInstagramModal);
document.getElementById('startInstagramAutomation').addEventListener('click', () => startInstagramAutomation(false));

// Make functions global
window.openInstagramModal = openInstagramModal;
window.closeInstagramModal = closeInstagramModal;
window.resetInstagramModal = resetInstagramModal;
window.startInstagramAutomation = startInstagramAutomation;
window.toggleInstagramConnection = toggleInstagramConnection;
window.connectToInstagram = connectToInstagram;
window.disconnectInstagram = disconnectInstagram;
