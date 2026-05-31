let leadsData = [];
let selectedTableForLeads = null;

// ===== SQLite-backed API helpers (resilient write-through) =====
// Each helper returns the parsed payload on success, or null on any failure
// so callers can fall back to the existing localStorage behavior.
async function apiGetTables() {
    try {
        const response = await fetch('/api/tables');
        if (!response.ok) return null;
        const result = await response.json();
        if (!result || !result.success || !Array.isArray(result.tables)) return null;
        return result.tables;
    } catch (_error) {
        return null;
    }
}

async function apiGetTable(id) {
    try {
        const response = await fetch(`/api/tables/${id}`);
        if (!response.ok) return null;
        const result = await response.json();
        if (!result || !result.success || !result.table) return null;
        return result.table;
    } catch (_error) {
        return null;
    }
}

async function apiSaveTable(table) {
    try {
        const response = await fetch('/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: table.name,
                url: table.url,
                count: table.count,
                data: table.data
            })
        });
        if (!response.ok) return null;
        const result = await response.json();
        if (!result || !result.success) return null;
        return result.table || null;
    } catch (_error) {
        return null;
    }
}

function openLeadSender() {
    leadSenderModal.classList.add('active');
    showLeadStep(1);
    loadTablesForLeads();
}

function closeLeadSender() {
    leadSenderModal.classList.remove('active');
    leadsData = [];
    selectedTableForLeads = null;
}

function showLeadStep(step) {
    document.querySelectorAll('.lead-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`leadStep${step}`).classList.add('active');
}

async function loadTablesForLeads() {
    // READ: try the API first, fall back to localStorage on any failure.
    // The list endpoint omits `data`; the full row (with `data`) is lazy-loaded
    // in processTableForLeads when a card is clicked.
    const apiTables = await apiGetTables();
    const savedTables = apiTables || JSON.parse(localStorage.getItem('savedTables') || '[]');
    const tablesList = document.getElementById('leadTablesList');
    const noTablesMsg = document.getElementById('noTablesMessage');

    tablesList.innerHTML = '';

    if (savedTables.length === 0) {
        noTablesMsg.style.display = 'block';
        return;
    }

    noTablesMsg.style.display = 'none';

    savedTables.forEach(table => {
        const card = document.createElement('div');
        card.className = 'table-select-card';

        const date = new Date(table.date);
        const formattedDate = date.toLocaleDateString();

        card.innerHTML = `
            <div class="table-select-info">
                <div class="table-select-title">${table.name}</div>
                <div class="table-select-meta">
                    <span>📅 ${formattedDate}</span>
                    <span>📊 ${table.count} businesses</span>
                </div>
            </div>
            <div class="table-select-badge">${table.count} rows</div>
        `;

        card.addEventListener('click', () => processTableForLeads(table));
        tablesList.appendChild(card);
    });
}

async function processTableForLeads(table) {
    // Rows coming from the API list view have no `data`; hydrate the full row.
    if (!Array.isArray(table.data)) {
        const fullTable = await apiGetTable(table.id);
        if (fullTable && Array.isArray(fullTable.data)) {
            table = fullTable;
        } else {
            // Fall back to the localStorage copy of this table.
            const local = JSON.parse(localStorage.getItem('savedTables') || '[]');
            const match = local.find(t => t.id === table.id);
            table = match || { ...table, data: [] };
        }
    }

    selectedTableForLeads = table;
    showLeadStep('1b'); // Show extraction options step
    
    // Count businesses with and without websites
    const businessesWithoutWebsite = table.data.filter(business => {
        const website = business.Website || business.website || '';
        return !website || website.trim() === '';
    });
    
    // Update the counts in the UI
    document.getElementById('noWebsiteCount').textContent = businessesWithoutWebsite.length;
    document.getElementById('allBusinessesCount').textContent = table.count;
}

function extractBusinessesWithOption(option) {
    showLeadStep(2);
    
    // Show processing
    document.getElementById('processingSection').style.display = 'block';
    document.getElementById('leadResultsSection').style.display = 'none';
    
    // Simulate processing delay
    setTimeout(() => {
        if (option === 'no-website') {
            // Filter businesses without websites
            const businessesWithoutWebsite = selectedTableForLeads.data.filter(business => {
                const website = business.Website || business.website || '';
                return !website || website.trim() === '';
            });
            
            leadsData = businessesWithoutWebsite;
            
            // Show results
            document.getElementById('processingSection').style.display = 'none';
            document.getElementById('leadResultsSection').style.display = 'block';
            
            const leadsCount = document.getElementById('leadsCount');
            leadsCount.textContent = `Found ${leadsData.length} businesses without websites out of ${selectedTableForLeads.count} total`;
        } else if (option === 'all') {
            // Extract all businesses
            leadsData = selectedTableForLeads.data;
            
            // Show results
            document.getElementById('processingSection').style.display = 'none';
            document.getElementById('leadResultsSection').style.display = 'block';
            
            const leadsCount = document.getElementById('leadsCount');
            leadsCount.textContent = `Extracted all ${leadsData.length} businesses from the table`;
        }
        
        displayLeadsTable();
    }, 1500);
}

function displayLeadsTable() {
    const leadsTable = document.getElementById('leadsTable');
    
    if (leadsData.length === 0) {
        leadsTable.innerHTML = '<tr><td colspan="3" style="text-align: center; padding: 40px; color: var(--gray);">No businesses found without websites! 🎉</td></tr>';
        return;
    }
    
    // Build table with Name, Address, Phone
    let tableHtml = '<thead><tr>';
    tableHtml += '<th>Name</th>';
    tableHtml += '<th>Address</th>';
    tableHtml += '<th>Phone</th>';
    tableHtml += '</tr></thead><tbody>';
    
    leadsData.forEach(lead => {
        tableHtml += '<tr>';
        tableHtml += `<td>${lead.Name || lead.name || '-'}</td>`;
        tableHtml += `<td>${lead.Address || lead.address || '-'}</td>`;
        tableHtml += `<td>${lead.Phone || lead.phone || '-'}</td>`;
        tableHtml += '</tr>';
    });
    
    tableHtml += '</tbody>';
    leadsTable.innerHTML = tableHtml;
}

// Save leads table
document.getElementById('saveLeadsBtn').addEventListener('click', async () => {
    if (leadsData.length === 0) {
        alert('No leads to save!');
        return;
    }

    const tableName = prompt('Enter a name for this leads table:', `Leads - ${selectedTableForLeads.name}`);
    if (!tableName) return;

    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');

    const newTable = {
        id: Date.now(),
        name: tableName,
        url: selectedTableForLeads.url,
        data: leadsData,
        date: new Date().toISOString(),
        count: leadsData.length
    };

    // WRITE-THROUGH: keep the localStorage mirror AND post to the API.
    savedTables.push(newTable);
    localStorage.setItem('savedTables', JSON.stringify(savedTables));
    await apiSaveTable(newTable);

    alert(`✅ Leads table "${tableName}" saved successfully!`);
});

// Export leads as CSV
document.getElementById('exportLeadsCsvBtn').addEventListener('click', () => {
    if (leadsData.length === 0) return;
    
    let csv = 'Name,Address,Phone\n';
    
    leadsData.forEach(lead => {
        const name = (lead.Name || lead.name || '').replace(/,/g, ';');
        const address = (lead.Address || lead.address || '').replace(/,/g, ';');
        const phone = (lead.Phone || lead.phone || '').replace(/,/g, ';');
        csv += `"${name}","${address}","${phone}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `leads-${Date.now()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});

// Close leads modal
document.getElementById('closeLeadsBtn').addEventListener('click', closeLeadSender);
document.getElementById('leadSenderBtn').addEventListener('click', openLeadSender);
document.getElementById('leadSenderClose').addEventListener('click', closeLeadSender);
document.getElementById('leadSenderModal').addEventListener('click', (e) => {
    if (e.target === document.getElementById('leadSenderModal')) closeLeadSender();
});

// Expose functions globally for HTML onclick handlers
window.extractBusinessesWithOption = extractBusinessesWithOption;
window.showLeadStep = showLeadStep;

// ===== WHATSAPP MESSAGING =====

// Next to WhatsApp button
document.getElementById('nextToWhatsAppBtn').addEventListener('click', () => {
    showLeadStep(3);
});

// Back to leads
document.getElementById('backToLeadsBtn').addEventListener('click', () => {
    showLeadStep(2);
});

// Select Option 1 - General Message
document.getElementById('selectOption1').addEventListener('click', () => {
    showLeadStep('4General');
    const leadsWithPhone = leadsData.filter(lead => {
        const phone = lead.Phone || lead.phone || '';
        return phone && phone.trim() !== '';
    });
    document.getElementById('generalLeadsCount').textContent = `${leadsWithPhone.length}`;
});

// Select Option 2 - Custom Messages
document.getElementById('selectOption2').addEventListener('click', () => {
    showLeadStep('5Custom');
    loadBusinessesForSelection();
});

// Back to options buttons
document.getElementById('backToOptions1').addEventListener('click', () => showLeadStep(3));
document.getElementById('backToOptions2').addEventListener('click', () => showLeadStep(3));

// General message preview
document.getElementById('generalMessage').addEventListener('input', (e) => {
    const preview = document.getElementById('generalMessagePreview');
    preview.textContent = e.target.value || 'Type a message to see preview...';
    preview.style.fontStyle = e.target.value ? 'normal' : 'italic';
});

// Send general messages
document.getElementById('sendGeneralMessagesBtn').addEventListener('click', sendGeneralMessages);

// Send custom messages
document.getElementById('sendCustomMessagesBtn').addEventListener('click', sendCustomMessages);

function loadBusinessesForSelection() {
    const container = document.getElementById('businessesSelection');
    container.innerHTML = '';
    
    const leadsWithPhone = leadsData.filter(lead => {
        const phone = lead.Phone || lead.phone || '';
        return phone && phone.trim() !== '';
    });
    
    if (leadsWithPhone.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: var(--gray);">No businesses with phone numbers found</div>';
        return;
    }
    
    leadsWithPhone.forEach((lead, index) => {
        const div = document.createElement('div');
        div.className = 'business-checkbox-wrapper';
        
        const name = lead.Name || lead.name || 'Unknown';
        const phone = lead.Phone || lead.phone || '';
        
        div.innerHTML = `
            <label class="business-checkbox">
                <input type="checkbox" value="${index}" onchange="updateSelectedCount()">
                <div class="business-checkbox-info">
                    <div class="business-checkbox-name">${name}</div>
                    <div class="business-checkbox-phone">📞 ${phone}</div>
                </div>
            </label>
            <button class="btn-generate-ai" onclick="generateAIMessage('${name.replace(/'/g, "\\'")}')">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L15.09 8.26L22 9.27L17 14.14L18.18 21.02L12 17.77L5.82 21.02L7 14.14L2 9.27L8.91 8.26L12 2Z"/>
                </svg>
                💡 Generate
            </button>
        `;
        
        container.appendChild(div);
    });
}

function updateSelectedCount() {
    const checkboxes = document.querySelectorAll('#businessesSelection input[type="checkbox"]:checked');
    document.getElementById('selectedCount').textContent = checkboxes.length;
}

async function generateAIMessage(businessName) {
    const textarea = document.getElementById('customMessage');
    const originalText = textarea.value;
    
    // Show loading state
    textarea.value = 'Generating a personalized message...';
    textarea.disabled = true;
    
    try {
        const response = await fetch('/api/generate-message', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ businessName })
        });
        
        const result = await response.json();
        
        if (result.success) {
            textarea.value = result.suggestion;
            console.log(`✅ Generated message for ${businessName}`);
        } else {
            textarea.value = originalText;
            alert('❌ Failed to generate message: ' + result.error);
        }
    } catch (error) {
        textarea.value = originalText;
        alert('❌ Error generating message: ' + error.message);
        console.error('Error:', error);
    } finally {
        textarea.disabled = false;
    }
}

// Make it globally accessible
window.generateAIMessage = generateAIMessage;

async function sendGeneralMessages() {
    const message = document.getElementById('generalMessage').value.trim();
    
    if (!message) {
        alert('Please write a message first!');
        return;
    }

    if (!isWhatsAppReady) {
        alert('❌ WhatsApp is not connected!\n\nPlease click on the WhatsApp status and scan the QR code first.');
        return;
    }
    
    const leadsWithPhone = leadsData.filter(lead => {
        const phone = lead.Phone || lead.phone || '';
        return phone && phone.trim() !== '';
    });
    
    if (leadsWithPhone.length === 0) {
        alert('No businesses with phone numbers found!');
        return;
    }
    
    if (!confirm(`Are you sure you want to send this message to ${leadsWithPhone.length} businesses?\n\nMessages will be sent automatically via WhatsApp.`)) {
        return;
    }
    
    let sent = 0;
    let failed = 0;
    const results = [];
    
    alert(`⏳ Sending messages...\n\nThis will take about ${leadsWithPhone.length * 3} seconds.\nPlease don't close this window.`);
    
    for (let i = 0; i < leadsWithPhone.length; i++) {
        const lead = leadsWithPhone[i];
        const phone = lead.Phone || lead.phone || '';
        const businessName = lead.Name || lead.name || 'Business';
        const address = lead.Address || lead.address || '';
        
        let status = '';
        let errorMessage = '';
        
        try {
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message })
            });
            
            const result = await response.json();
            
            if (result.success) {
                sent++;
                status = '✅ Sent';
                console.log(`✅ Sent to ${businessName} (${i + 1}/${leadsWithPhone.length})`);
            } else {
                failed++;
                status = '❌ Failed';
                errorMessage = result.error || 'Unknown error';
                console.error(`❌ Failed to send to ${businessName}:`, result.error);
            }
        } catch (error) {
            failed++;
            status = '❌ Failed';
            errorMessage = error.message || 'Network error';
            console.error(`❌ Error sending to ${businessName}:`, error);
        }
        
        // Track result
        results.push({
            Name: businessName,
            Phone: phone,
            Address: address,
            Status: status,
            Error: errorMessage
        });
        
        // Wait 3 seconds between messages
        if (i < leadsWithPhone.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    // Create and save results table
    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
    const timestamp = new Date().toLocaleString('he-IL');
    const tableName = `WhatsApp Send Results - All Businesses - ${timestamp}`;

    const newTable = {
        id: Date.now(),
        name: tableName,
        url: 'WhatsApp Lead Sender',
        data: results,
        date: new Date().toISOString(),
        count: results.length
    };

    // WRITE-THROUGH: keep the localStorage mirror AND post to the API.
    savedTables.push(newTable);
    localStorage.setItem('savedTables', JSON.stringify(savedTables));
    await apiSaveTable(newTable);

    alert(`✅ Process complete!\n\n✓ Sent: ${sent}\n${failed > 0 ? `✗ Failed: ${failed}` : ''}\n\n📊 Results table "${tableName}" has been saved to Saved Tables!`);
}

async function sendCustomMessages() {
    const message = document.getElementById('customMessage').value.trim();
    const checkboxes = document.querySelectorAll('#businessesSelection input[type="checkbox"]:checked');
    
    if (!message) {
        alert('Please write a message first!');
        return;
    }

    if (!isWhatsAppReady) {
        alert('❌ WhatsApp is not connected!\n\nPlease click on the WhatsApp status and scan the QR code first.');
        return;
    }
    
    if (checkboxes.length === 0) {
        alert('Please select at least one business!');
        return;
    }
    
    if (!confirm(`Send this message to ${checkboxes.length} selected businesses?`)) {
        return;
    }
    
    const leadsWithPhone = leadsData.filter(lead => {
        const phone = lead.Phone || lead.phone || '';
        return phone && phone.trim() !== '';
    });
    
    const selectedLeads = Array.from(checkboxes).map(checkbox => {
        const index = parseInt(checkbox.value);
        return leadsWithPhone[index];
    }).filter(lead => lead);
    
    let sent = 0;
    let failed = 0;
    const results = [];
    
    alert(`⏳ Sending messages...\n\nThis will take about ${checkboxes.length * 3} seconds.\nPlease don't close this window.`);
    
    for (let i = 0; i < checkboxes.length; i++) {
        const checkbox = checkboxes[i];
        const leadIndex = parseInt(checkbox.value);
        const lead = leadsWithPhone[leadIndex];
        const phone = lead.Phone || lead.phone || '';
        const businessName = lead.Name || lead.name || 'Business';
        const address = lead.Address || lead.address || '';
        
        let status = '';
        let errorMessage = '';
        
        try {
            const response = await fetch('/api/whatsapp/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ phone, message })
            });
            
            const result = await response.json();
            
            if (result.success) {
                sent++;
                status = '✅ Sent';
                console.log(`✅ Sent to ${businessName} (${i + 1}/${checkboxes.length})`);
            } else {
                failed++;
                status = '❌ Failed';
                errorMessage = result.error || 'Unknown error';
                console.error(`❌ Failed to send to ${businessName}:`, result.error);
            }
        } catch (error) {
            failed++;
            status = '❌ Failed';
            errorMessage = error.message || 'Network error';
            console.error(`❌ Error sending to ${businessName}:`, error);
        }
        
        // Track result
        results.push({
            Name: businessName,
            Phone: phone,
            Address: address,
            Status: status,
            Error: errorMessage
        });
        
        // Wait 3 seconds between messages
        if (i < checkboxes.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }
    
    // Create and save results table
    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
    const timestamp = new Date().toLocaleString('he-IL');
    const tableName = `WhatsApp Send Results - Selected Businesses - ${timestamp}`;

    const newTable = {
        id: Date.now(),
        name: tableName,
        url: 'WhatsApp Lead Sender',
        data: results,
        date: new Date().toISOString(),
        count: results.length
    };

    // WRITE-THROUGH: keep the localStorage mirror AND post to the API.
    savedTables.push(newTable);
    localStorage.setItem('savedTables', JSON.stringify(savedTables));
    await apiSaveTable(newTable);

    alert(`✅ Process complete!\n\n✓ Sent: ${sent}\n${failed > 0 ? `✗ Failed: ${failed}` : ''}\n\n📊 Results table "${tableName}" has been saved to Saved Tables!`);
}

// Make updateSelectedCount global for HTML onclick
window.updateSelectedCount = updateSelectedCount;

// ===== SPECIFIC SEARCH FEATURE =====

// Open Specific Search Modal
