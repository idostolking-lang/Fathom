// ===== EMAIL EXTRACTOR FEATURE =====

let emailExtractionData = {
    selectedTable: null,
    results: [],
    businessesWithWebsites: []
};

// Open Email Extractor Modal
function openEmailExtractor() {
    document.getElementById('emailExtractorModal').classList.add('active');
    showEmailStep(1);
    loadTablesForEmailExtraction();
}

// Fetch saved tables: try SQLite-backed API first, fall back to localStorage.
// API list omits row data, so hydrate each table's full record (with data) individually.
async function fetchSavedTables() {
    try {
        const listResponse = await fetch('/api/tables');
        if (!listResponse.ok) throw new Error('Failed to load tables');
        const listResult = await listResponse.json();
        if (!listResult || !listResult.success || !Array.isArray(listResult.tables)) {
            throw new Error('Invalid tables response');
        }

        const tables = await Promise.all(listResult.tables.map(async (summary) => {
            try {
                const detailResponse = await fetch(`/api/tables/${summary.id}`);
                if (!detailResponse.ok) throw new Error('Failed to load table');
                const detailResult = await detailResponse.json();
                if (detailResult && detailResult.success && detailResult.table) {
                    return detailResult.table;
                }
            } catch (_error) {
                // fall through to summary (without data) below
            }
            return { ...summary, data: Array.isArray(summary.data) ? summary.data : [] };
        }));

        // Merge with localStorage so a table saved only on this device is never dropped.
        return window.FATHOM.mergeSavedTables(tables);
    } catch (_error) {
        return JSON.parse(localStorage.getItem('savedTables') || '[]');
    }
}

// Close Email Extractor Modal
function closeEmailExtractor() {
    document.getElementById('emailExtractorModal').classList.remove('active');
    emailExtractionData = {
        selectedTable: null,
        results: [],
        businessesWithWebsites: []
    };
}

// Show specific email extraction step
function showEmailStep(step) {
    document.querySelectorAll('.email-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`emailStep${step}`).classList.add('active');
}

// Load tables for email extraction
async function loadTablesForEmailExtraction() {
    const container = document.getElementById('emailTablesList');
    const noTablesMsg = document.getElementById('noEmailTablesMessage');
    const savedTables = await fetchSavedTables();

    container.innerHTML = '';
    
    if (savedTables.length === 0) {
        noTablesMsg.style.display = 'block';
        return;
    }
    
    noTablesMsg.style.display = 'none';
    
    savedTables.forEach(table => {
        // Count businesses with websites
        const withWebsites = table.data.filter(b => {
            const website = b.Website || b.website || '';
            return website && website.trim() !== '';
        }).length;
        
        const card = document.createElement('div');
        card.className = 'table-select-card';
        card.style.cursor = withWebsites > 0 ? 'pointer' : 'not-allowed';
        card.style.opacity = withWebsites > 0 ? '1' : '0.5';
        
        card.innerHTML = `
            <div style="flex: 1;">
                <div style="font-size: 18px; font-weight: 700; color: var(--dark); margin-bottom: 12px;">${table.name}</div>
                <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 16px;">
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--gray);">
                        <span style="font-weight: 600; color: var(--dark);">${table.count}</span>
                        <span>📊 Total</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: ${withWebsites > 0 ? '#10b981' : 'var(--gray)'};">
                        <span style="font-weight: 700;">${withWebsites}</span>
                        <span>🌐 Websites</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 6px; font-size: 13px; color: var(--gray);">
                        <span>📅</span>
                        <span>${new Date(table.date).toLocaleDateString()}</span>
                    </div>
                </div>
                ${withWebsites > 0 ? `
                    <div style="display: flex; gap: 8px;">
                        <button class="btn-primary" style="flex: 1; font-size: 13px; padding: 10px;" onclick="event.stopPropagation(); selectTableForEmailExtraction(${JSON.stringify(table).replace(/"/g, '&quot;')}, false)">
                            Extract Now
                        </button>
                        <button class="btn-run-background" style="flex: 1; font-size: 11px; padding: 10px;" onclick="event.stopPropagation(); selectTableForEmailExtraction(${JSON.stringify(table).replace(/"/g, '&quot;')}, true)">
                            <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                            </svg>
                            Background
                        </button>
                    </div>
                ` : '<div style="text-align: center; color: var(--gray); font-size: 13px;">No websites available</div>'}
            </div>
        `;
        
        card.onclick = null; // Remove card click since we have buttons now
        
        container.appendChild(card);
    });
}

// Select table and start extraction
async function selectTableForEmailExtraction(table, runInBackground = false) {
    emailExtractionData.selectedTable = table;
    
    // Filter businesses with websites
    emailExtractionData.businessesWithWebsites = table.data.filter(business => {
        const website = business.Website || business.website || '';
        return website && website.trim() !== '';
    });
    
    if (emailExtractionData.businessesWithWebsites.length === 0) {
        alert('⚠️ No businesses with websites found in this table!');
        return;
    }
    
    if (runInBackground) {
        // Background mode
        try {
            const response = await fetch('/api/extract-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    businesses: emailExtractionData.businessesWithWebsites,
                    runInBackground: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Email extraction started in background!\n\n📋 Task ID: ${result.taskId}\n📊 ${emailExtractionData.businessesWithWebsites.length} websites to process\n\n👉 You can continue working. Click the tasks button (bottom-right) to monitor progress.`);
                // DO NOT close modal or show background tasks - let user stay on current screen
                // closeEmailExtractor();
                // backgroundTasksUI.show();
            } else {
                alert('❌ Error: ' + result.error);
            }
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
        return;
    }
    
    // Go to processing step
    showEmailStep(2);
    
    const total = emailExtractionData.businessesWithWebsites.length;
    let completed = 0;
    
    // Update progress
    document.getElementById('emailProgressText').textContent = `0 / ${total}`;
    document.getElementById('emailProgressBar').style.width = '0%';
    document.getElementById('currentWebsite').textContent = 'Starting extraction...';
    
    console.log(`📧 Starting email extraction for ${total} businesses`);
    
    try {
        // Call backend API to extract emails
        const response = await fetch('/api/extract-emails', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                businesses: emailExtractionData.businessesWithWebsites
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Simulate progress animation
            for (let i = 0; i < total; i++) {
                completed++;
                const progress = (completed / total) * 100;
                document.getElementById('emailProgressBar').style.width = `${progress}%`;
                document.getElementById('emailProgressText').textContent = `${completed} / ${total}`;
                await new Promise(resolve => setTimeout(resolve, 100));
            }
            
            // Store results
            emailExtractionData.results = result.results;
            
            // Show results
            displayEmailResults();
            showEmailStep(3);
            
            console.log(`✅ Email extraction complete! Found ${result.emailsFound} emails out of ${total} businesses`);
        } else {
            alert('❌ Failed to extract emails: ' + result.error);
            closeEmailExtractor();
        }
        
    } catch (error) {
        console.error('Email extraction error:', error);
        alert('❌ Error: ' + error.message);
        closeEmailExtractor();
    }
}

// Display email extraction results
function displayEmailResults() {
    const results = emailExtractionData.results;
    const emailsFound = results.filter(r => r.email && r.email !== '').length;
    
    // Update summary
    const summary = document.getElementById('emailResultsSummary');
    summary.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; text-align: center;">
            <div style="padding: 16px; background: var(--gray-light); border-radius: 12px; border: 2px solid #10b981;">
                <div style="font-size: 32px; font-weight: 800; color: #10b981; margin-bottom: 4px;">${emailsFound}</div>
                <div style="font-size: 13px; color: var(--gray); font-weight: 600;">✅ Emails Found</div>
            </div>
            <div style="padding: 16px; background: var(--gray-light); border-radius: 12px; border: 2px solid var(--gray-border);">
                <div style="font-size: 32px; font-weight: 800; color: var(--gray); margin-bottom: 4px;">${results.length - emailsFound}</div>
                <div style="font-size: 13px; color: var(--gray); font-weight: 600;">❌ Not Found</div>
            </div>
            <div style="padding: 16px; background: var(--gray-light); border-radius: 12px; border: 2px solid var(--primary);">
                <div style="font-size: 32px; font-weight: 800; color: var(--primary); margin-bottom: 4px;">${results.length}</div>
                <div style="font-size: 13px; color: var(--gray); font-weight: 600;">🌐 Total Websites</div>
            </div>
        </div>
    `;
    
    // Build results table
    const table = document.getElementById('extractedEmailsTable');
    
    let tableHTML = `
        <thead>
            <tr style="background: white; border-bottom: 3px solid var(--gray-border);">
                <th style="padding: 16px 12px; text-align: left; font-weight: 700; color: var(--dark); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Business Name</th>
                <th style="padding: 16px 12px; text-align: left; font-weight: 700; color: var(--dark); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Website</th>
                <th style="padding: 16px 12px; text-align: left; font-weight: 700; color: var(--dark); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Email</th>
                <th style="padding: 16px 12px; text-align: center; font-weight: 700; color: var(--dark); font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px;">Status</th>
            </tr>
        </thead>
        <tbody>
    `;
    
    results.forEach((result, index) => {
        const hasEmail = result.email && result.email !== '';
        const statusIcon = hasEmail ? '✅' : '❌';
        const statusText = hasEmail ? 'Found' : 'Not found';
        const statusColor = hasEmail ? '#10b981' : '#ef4444';
        const rowBg = index % 2 === 0 ? 'white' : 'var(--gray-light)';
        
        tableHTML += `
            <tr style="background: ${rowBg}; border-bottom: 1px solid var(--gray-border); transition: all 0.2s;">
                <td style="padding: 14px 12px; color: var(--dark); font-weight: 500;">${result.name}</td>
                <td style="padding: 14px 12px;">
                    <a href="${result.website}" target="_blank" style="color: var(--primary); text-decoration: none; font-size: 13px; font-weight: 500;" title="${result.website}">
                        ${result.website.substring(0, 35)}${result.website.length > 35 ? '...' : ''}
                    </a>
                </td>
                <td style="padding: 14px 12px; color: ${hasEmail ? '#10b981' : 'var(--gray)'}; font-weight: ${hasEmail ? '600' : '500'}; font-family: monospace; font-size: 13px;">
                    ${hasEmail ? result.email : '-'}
                </td>
                <td style="padding: 14px 12px; text-align: center;">
                    <span style="display: inline-block; padding: 4px 12px; background: ${hasEmail ? '#10b981' : 'var(--gray)'}; color: white; border-radius: 20px; font-size: 11px; font-weight: 700;">
                        ${statusIcon} ${statusText}
                    </span>
                </td>
            </tr>
        `;
    });
    
    tableHTML += '</tbody>';
    table.innerHTML = tableHTML;
}

// Save emails table
async function saveEmailsTable() {
    if (emailExtractionData.results.length === 0) {
        alert('⚠️ No results to save!');
        return;
    }

    const tableName = prompt('Enter a name for this email table:', `Emails - ${emailExtractionData.selectedTable.name}`);
    if (!tableName) return;

    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');

    // Prepare data with emails
    const tableData = emailExtractionData.results.map(r => ({
        Name: r.name,
        Website: r.website,
        Email: r.email || '',
        Phone: r.phone || '',
        Address: r.address || ''
    }));

    const newTable = {
        id: Date.now(),
        name: tableName,
        url: emailExtractionData.selectedTable.url || 'Email Extraction',
        data: tableData,
        date: new Date().toISOString(),
        count: tableData.length
    };

    // Write-through to SQLite-backed API; adopt server id/date on success.
    try {
        const response = await fetch('/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: newTable.name,
                url: newTable.url,
                count: newTable.count,
                data: newTable.data
            })
        });
        if (response.ok) {
            const result = await response.json();
            if (result && result.success && result.table) {
                if (result.table.id != null) newTable.id = result.table.id;
                if (result.table.date) newTable.date = result.table.date;
            }
        }
    } catch (_error) {
        // Ignore API failure; localStorage mirror below keeps the feature working.
    }

    // Keep the existing localStorage write (write-through mirror).
    savedTables.push(newTable);
    localStorage.setItem('savedTables', JSON.stringify(savedTables));

    alert(`✅ Table "${tableName}" saved successfully with ${tableData.filter(d => d.Email).length} emails!`);
}

// Export emails as CSV
function exportEmailsCSV() {
    if (emailExtractionData.results.length === 0) {
        alert('⚠️ No results to export!');
        return;
    }
    
    let csv = 'Business Name,Website,Email,Phone,Address\n';
    
    emailExtractionData.results.forEach(result => {
        const name = (result.name || '').replace(/,/g, ';').replace(/"/g, '""');
        const website = (result.website || '').replace(/,/g, ';');
        const email = (result.email || '').replace(/,/g, ';');
        const phone = (result.phone || '').replace(/,/g, ';');
        const address = (result.address || '').replace(/,/g, ';').replace(/"/g, '""');
        
        csv += `"${name}","${website}","${email}","${phone}","${address}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `emails-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    console.log('📥 Emails exported to CSV');
}

// Event Listeners
document.getElementById('emailExtractorBtn').addEventListener('click', openEmailExtractor);
document.getElementById('emailExtractorClose').addEventListener('click', closeEmailExtractor);
document.getElementById('emailExtractorModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('emailExtractorModal')) closeEmailExtractor();
});

// Make functions global
window.openEmailExtractor = openEmailExtractor;
window.closeEmailExtractor = closeEmailExtractor;
window.showEmailStep = showEmailStep;
window.displayEmailResults = displayEmailResults;
window.emailExtractionData = emailExtractionData;
window.saveEmailsTable = saveEmailsTable;
window.exportEmailsCSV = exportEmailsCSV;
