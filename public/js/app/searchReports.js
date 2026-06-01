function openSpecificSearch() {
    specificSearchModal.classList.add('active');
    injectSpecificSearchControls();
    loadSearchTables();
    showSearchStep(1);
}

// Inject the prompt-template and model selectors (config-driven) once, just
// before the search-instructions textarea. Guarded so re-opening the modal
// never duplicates the controls. No-ops gracefully if config is unavailable.
function injectSpecificSearchControls() {
    if (!window.FATHOM) return;

    const textarea = document.getElementById('searchInstructions');
    if (!textarea) return;

    // One-time guard: bail if the template selector already exists.
    if (document.getElementById('searchTemplateSelect')) return;

    // Prompt-template selector. Choosing a non-empty option fills the textarea
    // with the matching template prompt from config.
    const templateSelect = document.createElement('select');
    templateSelect.id = 'searchTemplateSelect';
    templateSelect.className = 'form-input';
    templateSelect.style.marginBottom = '12px';
    templateSelect.innerHTML = window.FATHOM.templateOptions('websiteAnalysis');
    templateSelect.addEventListener('change', () => {
        const value = templateSelect.value;
        if (value === '') return;
        const template = window.FATHOM.promptTemplates.websiteAnalysis[parseInt(value, 10)];
        if (template) {
            textarea.value = template.prompt;
        }
    });

    // Model selector. Defaults to the configured default model.
    const modelSelect = document.createElement('select');
    modelSelect.id = 'searchModelSelect';
    modelSelect.className = 'form-input';
    modelSelect.style.marginBottom = '12px';
    modelSelect.innerHTML = window.FATHOM.modelOptions();

    textarea.parentNode.insertBefore(templateSelect, textarea);
    textarea.parentNode.insertBefore(modelSelect, textarea);
}

// Read the currently selected model for Specific Search, falling back to the
// configured default (or undefined if config is unavailable).
function getSelectedSearchModel() {
    const modelSelect = document.getElementById('searchModelSelect');
    if (modelSelect && modelSelect.value) return modelSelect.value;
    return window.FATHOM ? window.FATHOM.defaultModel : undefined;
}

// Close Specific Search Modal
function closeSpecificSearch() {
    specificSearchModal.classList.remove('active');
}

// Show specific search step
function showSearchStep(step) {
    document.querySelectorAll('.search-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`searchStep${step}`).classList.add('active');
    
    // Update title
    const titles = {
        1: 'Select Table',
        2: 'Businesses with Websites',
        3: 'Write Instructions',
        4: 'Choose Search Type',
        '5Custom': 'Select Businesses',
        '6Results': 'Search Results'
    };
    document.getElementById('specificSearchTitle').textContent = titles[step] || 'Specific Search';
}

// Load tables for search
async function loadSearchTables() {
    const container = document.getElementById('searchTablesList');
    const noTablesMsg = document.getElementById('noSearchTablesMessage');

    // READ: try the SQLite-backed API first, fall back to localStorage on any failure.
    let savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
    try {
        const response = await fetch('/api/tables');
        if (response.ok) {
            const result = await response.json();
            if (result && result.success && Array.isArray(result.tables)) {
                savedTables = window.FATHOM.mergeSavedTables(result.tables);
            }
        }
    } catch (error) {
        console.warn('Falling back to localStorage for savedTables:', error);
    }

    container.innerHTML = '';

    if (savedTables.length === 0) {
        noTablesMsg.style.display = 'block';
        return;
    }

    noTablesMsg.style.display = 'none';

    savedTables.forEach(table => {
        const card = document.createElement('div');
        card.className = 'table-select-card';
        card.innerHTML = `
            <div>
                <strong style="font-size: 16px; color: var(--dark);">${table.name}</strong>
                <div style="margin-top: 8px; font-size: 13px; color: var(--gray);">
                    📊 ${table.count} businesses
                    <span style="margin-left: 16px;">📅 ${new Date(table.date).toLocaleDateString()}</span>
                </div>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: var(--primary);">
                <path d="M9 5l7 7-7 7"/>
            </svg>
        `;
        card.onclick = () => selectSearchTable(table);
        container.appendChild(card);
    });
}

// Select table and filter businesses with websites
async function selectSearchTable(table) {
    selectedSearchTable = table;
    showSearchStep(2);

    // Show processing
    document.getElementById('searchProcessingSection').style.display = 'block';
    document.getElementById('searchBusinessesSection').style.display = 'none';

    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // The /api/tables list does not include row data, so hydrate it from the
    // detail endpoint when missing. Fall back to localStorage, then to [].
    if (!Array.isArray(table.data)) {
        let rows = null;
        try {
            const response = await fetch(`/api/tables/${table.id}`);
            if (response.ok) {
                const result = await response.json();
                if (result && result.success && result.table && Array.isArray(result.table.data)) {
                    rows = result.table.data;
                }
            }
        } catch (error) {
            console.warn('Falling back to localStorage for table data:', error);
        }
        if (!rows) {
            const localTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
            const match = localTables.find(t => t.id === table.id);
            rows = (match && Array.isArray(match.data)) ? match.data : [];
        }
        table.data = rows;
    }

    // Filter businesses WITH websites
    websiteBusinesses = table.data.filter(business => {
        const website = business.Website || business.website || '';
        return website && website.trim() !== '';
    });
    
    // Hide processing, show results
    document.getElementById('searchProcessingSection').style.display = 'none';
    document.getElementById('searchBusinessesSection').style.display = 'block';
    
    // Display count
    document.getElementById('websitesCount').textContent = `${websiteBusinesses.length} businesses with websites found`;
    
    // Display table
    displayWebsitesTable();
}

// Display businesses with websites in a table
function displayWebsitesTable() {
    const table = document.getElementById('websitesTable');
    
    if (websiteBusinesses.length === 0) {
        table.innerHTML = '<p style="text-align: center; padding: 20px; color: var(--gray);">No businesses with websites found</p>';
        return;
    }
    
    let html = '<thead><tr><th>Name</th><th>Website</th><th>Phone</th></tr></thead><tbody>';
    
    websiteBusinesses.forEach(business => {
        const name = business.Name || business.name || 'N/A';
        const website = business.Website || business.website || 'N/A';
        const phone = business.Phone || business.phone || 'N/A';
        
        html += `
            <tr>
                <td>${name}</td>
                <td><a href="${website}" target="_blank" style="color: var(--primary);">${website}</a></td>
                <td>${phone}</td>
            </tr>
        `;
    });
    
    html += '</tbody>';
    table.innerHTML = html;
}

// Load businesses for custom selection
function loadCustomSearchBusinesses() {
    const container = document.getElementById('customSearchBusinesses');
    container.innerHTML = '';
    
    websiteBusinesses.forEach((business, index) => {
        const label = document.createElement('label');
        label.className = 'business-checkbox';
        
        const name = business.Name || business.name || 'Unknown';
        const website = business.Website || business.website || '';
        
        label.innerHTML = `
            <input type="checkbox" value="${index}" onchange="updateCustomSearchCount()">
            <div class="business-checkbox-info">
                <div class="business-checkbox-name">${name}</div>
                <div class="business-checkbox-phone">🌐 ${website}</div>
            </div>
        `;
        
        container.appendChild(label);
    });
}

// Update custom search count
function updateCustomSearchCount() {
    const checkboxes = document.querySelectorAll('#customSearchBusinesses input[type="checkbox"]:checked');
    selectedSearchBusinesses = Array.from(checkboxes).map(cb => parseInt(cb.value));
}

// Start search (all or custom)
async function startSearch(type) {
    showSearchStep('6Results');
    
    // Show searching section
    document.getElementById('searchingSection').style.display = 'block';
    document.getElementById('finalSearchResults').style.display = 'none';
    
    // Get custom mode state
    const customMode = document.getElementById('searchCustomModeToggle').checked;
    
    // Determine which businesses to search
    let businessesToSearch = [];
    if (type === 'all') {
        businessesToSearch = websiteBusinesses;
    } else {
        businessesToSearch = selectedSearchBusinesses.map(index => websiteBusinesses[index]);
    }
    
    const total = businessesToSearch.length;
    let completed = 0;
    
    // Update progress
    document.getElementById('searchProgressText').textContent = `${completed} / ${total} completed`;
    document.getElementById('searchProgressBar').style.width = '0%';
    
    console.log(`🔍 Starting search with Custom Mode: ${customMode ? 'ENABLED' : 'Disabled'}`);
    
    // Call backend API to analyze websites
    try {
        const response = await fetch('/api/analyze-websites', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                businesses: businessesToSearch,
                instructions: searchInstructions,
                customMode: customMode,
                model: getSelectedSearchModel()
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Simulate progress for each business
            for (let i = 0; i < total; i++) {
                completed++;
                const progress = (completed / total) * 100;
                document.getElementById('searchProgressBar').style.width = `${progress}%`;
                document.getElementById('searchProgressText').textContent = `${completed} / ${total} completed`;
                await new Promise(resolve => setTimeout(resolve, 200));
            }
            
            // Hide searching, show results
            document.getElementById('searchingSection').style.display = 'none';
            document.getElementById('finalSearchResults').style.display = 'block';
            
            // Display report
            displaySearchReport(result.report);
        } else {
            alert('❌ Search failed: ' + result.error);
            closeSpecificSearch();
        }
        
    } catch (error) {
        console.error('Search error:', error);
        alert('❌ Error: ' + error.message);
        closeSpecificSearch();
    }
}

// Display search report
function displaySearchReport(report) {
    currentReport = report; // Store for saving
    const container = document.getElementById('searchReportContainer');
    container.innerHTML = `
        <h3 style="margin-bottom: 16px; color: var(--dark);">📊 Analysis Report</h3>
        <div style="white-space: pre-wrap; line-height: 1.8; color: var(--dark);">${report}</div>
    `;
}

// Save report (write-through: SQLite-backed API + localStorage mirror)
async function saveReport() {
    if (!currentReport) {
        alert('No report to save!');
        return;
    }

    const reportName = prompt('Enter a name for this report:', `Report - ${new Date().toLocaleDateString()}`);
    if (!reportName) return;

    const newReport = {
        id: Date.now(),
        name: reportName,
        report: currentReport,
        instructions: searchInstructions,
        businessCount: websiteBusinesses.length,
        date: new Date().toISOString()
    };

    // WRITE-THROUGH MIRROR: always keep the existing localStorage copy so the
    // feature never breaks even if the API is unavailable.
    const savedReports = JSON.parse(localStorage.getItem('savedReports') || '[]');
    savedReports.push(newReport);
    localStorage.setItem('savedReports', JSON.stringify(savedReports));

    // Also persist to the SQLite-backed API (best effort).
    try {
        await fetch('/api/reports', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: reportName,
                report: currentReport,
                instructions: searchInstructions,
                businessCount: websiteBusinesses.length
            })
        });
    } catch (error) {
        console.warn('Failed to save report to API, kept localStorage copy:', error);
    }

    alert('✅ Report saved successfully!');
}

// Event Listeners for Specific Search
specificSearchBtn.addEventListener('click', openSpecificSearch);
specificSearchClose.addEventListener('click', closeSpecificSearch);
specificSearchModal.addEventListener('click', (e) => {
    if (e.target === specificSearchModal) closeSpecificSearch();
});

// Step navigation
document.getElementById('nextToInstructionsBtn').addEventListener('click', () => {
    showSearchStep(3);
});

document.getElementById('backToWebsitesBtn').addEventListener('click', () => {
    showSearchStep(2);
});

document.getElementById('nextToSearchTypeBtn').addEventListener('click', () => {
    searchInstructions = document.getElementById('searchInstructions').value.trim();
    if (!searchInstructions) {
        alert('Please write search instructions!');
        return;
    }
    showSearchStep(4);
});

document.getElementById('backToInstructionsBtn').addEventListener('click', () => {
    showSearchStep(3);
});

document.getElementById('selectSearchAll').addEventListener('click', () => {
    searchType = 'all';
    startSearch('all');
});

document.getElementById('selectSearchCustom').addEventListener('click', () => {
    searchType = 'custom';
    showSearchStep('5Custom');
    loadCustomSearchBusinesses();
});

document.getElementById('backToSearchTypeBtn').addEventListener('click', () => {
    showSearchStep(4);
});

document.getElementById('startCustomSearchBtn').addEventListener('click', () => {
    if (selectedSearchBusinesses.length === 0) {
        alert('Please select at least one business!');
        return;
    }
    startSearch('custom');
});

document.getElementById('closeSearchStep2').addEventListener('click', closeSpecificSearch);
document.getElementById('closeSearchResultsBtn').addEventListener('click', closeSpecificSearch);
document.getElementById('saveSearchReportBtn').addEventListener('click', saveReport);

// Custom Mode toggle listener for Specific Search
document.getElementById('searchCustomModeToggle').addEventListener('change', (e) => {
    const warning = document.getElementById('searchCustomModeWarning');
    if (e.target.checked) {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }
});

// Make functions global for onclick
window.updateCustomSearchCount = updateCustomSearchCount;

// ===== LEAD BASED ON REPORT FEATURE =====

// Open Lead Based on Report Modal
function openLeadReport() {
    leadReportModal.classList.add('active');
    injectLeadReportControls();
    loadSavedReports();
    showLeadReportStep(1);
}

// Inject the outreach prompt-template and model selectors once, before the
// lead-report message-instructions textarea. Mirrors injectSpecificSearchControls.
function injectLeadReportControls() {
    if (!window.FATHOM) return;
    const textarea = document.getElementById('leadMessageInstructions');
    if (!textarea || document.getElementById('leadTemplateSelect')) return;

    const templateSelect = document.createElement('select');
    templateSelect.id = 'leadTemplateSelect';
    templateSelect.className = 'form-input';
    templateSelect.style.marginBottom = '12px';
    templateSelect.innerHTML = window.FATHOM.templateOptions('outreach');
    templateSelect.addEventListener('change', () => {
        if (templateSelect.value === '') return;
        const t = window.FATHOM.promptTemplates.outreach[parseInt(templateSelect.value, 10)];
        if (t) textarea.value = t.prompt;
    });

    const modelSelect = document.createElement('select');
    modelSelect.id = 'leadModelSelect';
    modelSelect.className = 'form-input';
    modelSelect.style.marginBottom = '12px';
    modelSelect.innerHTML = window.FATHOM.modelOptions();

    textarea.parentNode.insertBefore(templateSelect, textarea);
    textarea.parentNode.insertBefore(modelSelect, textarea);
}

function getSelectedLeadModel() {
    const s = document.getElementById('leadModelSelect');
    if (s && s.value) return s.value;
    return window.FATHOM ? window.FATHOM.defaultModel : undefined;
}

// Close Lead Based on Report Modal
function closeLeadReport() {
    leadReportModal.classList.remove('active');
}

// Show lead report step
function showLeadReportStep(step) {
    document.querySelectorAll('.lead-report-step').forEach(s => s.classList.remove('active'));
    document.getElementById(`leadReportStep${step}`).classList.add('active');
}

// Load saved reports
async function loadSavedReports() {
    const container = document.getElementById('savedReportsList');
    const noReportsMsg = document.getElementById('noReportsMessage');

    // READ: try the SQLite-backed API first, fall back to localStorage on any failure.
    let savedReports = JSON.parse(localStorage.getItem('savedReports') || '[]');
    try {
        const response = await fetch('/api/reports');
        if (response.ok) {
            const result = await response.json();
            if (result && result.success && Array.isArray(result.reports)) {
                savedReports = result.reports;
            }
        }
    } catch (error) {
        console.warn('Falling back to localStorage for savedReports:', error);
    }

    container.innerHTML = '';

    if (savedReports.length === 0) {
        noReportsMsg.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    noReportsMsg.style.display = 'none';
    container.style.display = 'grid';

    savedReports.forEach(report => {
        const instructions = report.instructions || '';
        const card = document.createElement('div');
        card.className = 'table-select-card';
        card.innerHTML = `
            <div>
                <strong style="font-size: 16px; color: var(--dark);">${report.name}</strong>
                <div style="margin-top: 8px; font-size: 13px; color: var(--gray);">
                    📊 ${report.businessCount} businesses analyzed
                    <span style="margin-left: 16px;">📅 ${new Date(report.date).toLocaleDateString()}</span>
                </div>
                <div style="margin-top: 6px; font-size: 12px; color: var(--gray); font-style: italic;">
                    ${instructions.substring(0, 60)}${instructions.length > 60 ? '...' : ''}
                </div>
            </div>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="color: var(--primary);">
                <path d="M9 5l7 7-7 7"/>
            </svg>
        `;
        card.onclick = () => selectReport(report);
        container.appendChild(card);
    });
}

// Select report and go to instructions step
function selectReport(report) {
    selectedReportForMessage = report;
    showLeadReportStep(2);
}

// Generate marketing message with instructions
async function generateMessageFromReport() {
    const instructions = document.getElementById('leadMessageInstructions').value.trim();
    const customMode = document.getElementById('customModeToggle').checked;
    
    if (!instructions) {
        alert('⚠️ Please provide instructions for the message!');
        return;
    }
    
    if (!selectedReportForMessage) {
        alert('⚠️ No report selected!');
        return;
    }
    
    showLeadReportStep(3);
    
    // Show processing
    document.getElementById('leadReportProcessing').style.display = 'block';
    document.getElementById('leadReportResult').style.display = 'none';
    
    try {
        // Call backend API to generate marketing message
        const response = await fetch('/api/generate-marketing-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                report: selectedReportForMessage.report,
                reportInstructions: selectedReportForMessage.instructions,
                messageInstructions: instructions,
                customMode: customMode,
                model: getSelectedLeadModel()
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            // Hide processing, show result
            document.getElementById('leadReportProcessing').style.display = 'none';
            document.getElementById('leadReportResult').style.display = 'block';
            
            // Display marketing message
            const messageContent = document.getElementById('marketingMessageContent');
            messageContent.textContent = result.message;
            
            // Show message stats
            const wordCount = result.message.split(/\s+/).filter(w => w.length > 0).length;
            const charCount = result.message.length;
            console.log(`📊 Generated message: ${charCount} characters, ${wordCount} words`);
            console.log(`🔓 Custom Mode: ${customMode ? 'Enabled' : 'Disabled'}`);
        } else {
            alert('❌ Failed to generate message: ' + result.error);
            closeLeadReport();
        }
        
    } catch (error) {
        console.error('Error generating marketing message:', error);
        alert('❌ Error: ' + error.message);
        closeLeadReport();
    }
}

// Copy marketing message to clipboard
function copyMarketingMessage() {
    const content = document.getElementById('marketingMessageContent').textContent;
    
    navigator.clipboard.writeText(content).then(() => {
        // Show success feedback
        const btn = document.getElementById('copyMarketingMessage');
        const originalHTML = btn.innerHTML;
        btn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"/>
            </svg>
            Copied!
        `;
        btn.style.background = 'linear-gradient(135deg, #10b981, #059669)';
        
        setTimeout(() => {
            btn.innerHTML = originalHTML;
            btn.style.background = '';
        }, 2000);
    }).catch(err => {
        alert('Failed to copy: ' + err);
    });
}

// Event Listeners for Lead Based on Report
leadBasedReportBtn.addEventListener('click', openLeadReport);
leadReportClose.addEventListener('click', closeLeadReport);
leadReportModal.addEventListener('click', (e) => {
    if (e.target === leadReportModal) closeLeadReport();
});

document.getElementById('backToReportSelection').addEventListener('click', () => {
    showLeadReportStep(1);
    selectedReportForMessage = null;
    document.getElementById('leadMessageInstructions').value = ''; // Clear instructions
});

document.getElementById('backToReportSelectionFromInstructions').addEventListener('click', () => {
    showLeadReportStep(1);
    selectedReportForMessage = null;
    document.getElementById('leadMessageInstructions').value = ''; // Clear instructions
});

document.getElementById('tryDifferentInstructions').addEventListener('click', () => {
    // Go back to instructions step without clearing the selected report
    showLeadReportStep(2);
    // Optionally scroll to textarea
    setTimeout(() => {
        const textarea = document.getElementById('leadMessageInstructions');
        textarea.focus();
        textarea.select(); // Select all text for easy replacement
    }, 100);
});

document.getElementById('generateMarketingMessage').addEventListener('click', generateMessageFromReport);
document.getElementById('closeLeadReport').addEventListener('click', closeLeadReport);
document.getElementById('copyMarketingMessage').addEventListener('click', copyMarketingMessage);
document.getElementById('saveToClipboardManager').addEventListener('click', () => {
    const message = document.getElementById('marketingMessageContent').textContent;
    saveMessageToClipboard(message);
});

// Custom Mode toggle listener
document.getElementById('customModeToggle').addEventListener('change', (e) => {
    const warning = document.getElementById('customModeWarning');
    if (e.target.checked) {
        warning.style.display = 'block';
    } else {
        warning.style.display = 'none';
    }
});
