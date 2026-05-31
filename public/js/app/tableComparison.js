// ===== COMPARE TABLES FUNCTIONALITY =====

// Compare Tables state
let selectedTablesForCompare = [];
let comparisonType = null;
let comparisonResults = [];

// DOM Elements for Compare Tables
const compareTablesBtn = document.getElementById('compareTablesBtn');
const compareTablesModal = document.getElementById('compareTablesModal');
const compareTablesClose = document.getElementById('compareTablesClose');

// Fetch saved tables list from the SQLite-backed API, falling back to localStorage.
// The API list endpoint returns items WITHOUT `data`; per-table `data` is hydrated
// on demand via getSavedTableById(). Mirrors the API list into localStorage so IDs
// stay consistent with the rest of the app.
async function getSavedTablesList() {
    try {
        const response = await fetch('/api/tables');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!result || !result.success || !Array.isArray(result.tables)) {
            throw new Error('Invalid /api/tables response');
        }
        // Write-through mirror so checkbox IDs and other pages match the API.
        try {
            localStorage.setItem('savedTables', JSON.stringify(result.tables));
        } catch (_storageError) { /* ignore quota/serialization issues */ }
        return result.tables;
    } catch (_error) {
        // Resilient fallback: never break if the API is unavailable.
        return JSON.parse(localStorage.getItem('savedTables') || '[]');
    }
}

// Fetch a single saved table (including its `data` array) from the API,
// falling back to the localStorage record (which may already include `data`).
async function getSavedTableById(tableId) {
    try {
        const response = await fetch(`/api/tables/${tableId}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const result = await response.json();
        if (!result || !result.success || !result.table) {
            throw new Error('Invalid /api/tables/:id response');
        }
        return result.table;
    } catch (_error) {
        const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');
        return savedTables.find(t => t.id === tableId);
    }
}

// Open compare tables modal
async function openCompareTablesModal() {
    // Reset state
    selectedTablesForCompare = [];
    comparisonType = null;
    comparisonResults = [];

    // Load saved tables (API-first, localStorage fallback)
    const savedTables = await getSavedTablesList();
    const compareTablesSelection = document.getElementById('compareTablesSelection');
    const noTablesDiv = document.getElementById('noTablesForCompare');
    
    if (savedTables.length < 2) {
        compareTablesSelection.style.display = 'none';
        noTablesDiv.style.display = 'block';
    } else {
        compareTablesSelection.style.display = 'block';
        noTablesDiv.style.display = 'none';
        
        // Render table checkboxes
        compareTablesSelection.innerHTML = '';
        savedTables.forEach(table => {
            const card = document.createElement('div');
            card.style.cssText = 'padding: 16px; background: white; border: 2px solid var(--gray-border); border-radius: 12px; margin-bottom: 12px; cursor: pointer; transition: all 0.2s;';
            card.innerHTML = `
                <label style="display: flex; align-items: center; gap: 12px; cursor: pointer;">
                    <input type="checkbox" class="compare-table-checkbox" value="${table.id}" style="width: 20px; height: 20px; cursor: pointer;">
                    <div style="flex: 1;">
                        <div style="font-weight: 700; color: var(--dark); margin-bottom: 4px;">${table.name}</div>
                        <div style="font-size: 13px; color: var(--gray);">
                            ${table.count} rows • ${new Date(table.date).toLocaleDateString()}
                        </div>
                    </div>
                </label>
            `;
            
            // Add click handler
            const checkbox = card.querySelector('.compare-table-checkbox');
            checkbox.addEventListener('change', updateSelectedTablesCount);
            
            compareTablesSelection.appendChild(card);
        });
    }
    
    // Reset to step 1
    goToCompareStep1();
    
    // Show modal
    compareTablesModal.classList.add('active');
}

// Close compare tables modal
function closeCompareTablesModal() {
    compareTablesModal.classList.remove('active');
}

// Update selected tables count
function updateSelectedTablesCount() {
    const checkboxes = document.querySelectorAll('.compare-table-checkbox:checked');
    const count = checkboxes.length;
    document.getElementById('selectedTablesCount').textContent = count;
    
    // Enable/disable next button
    const nextBtn = document.getElementById('compareNextBtn');
    nextBtn.disabled = count < 2;
}

// Navigate to step 1
function goToCompareStep1() {
    document.querySelectorAll('.compare-step').forEach(s => s.classList.remove('active'));
    document.getElementById('compareStep1').classList.add('active');
    updateSelectedTablesCount();
}

// Navigate to step 2
async function goToCompareStep2() {
    const checkboxes = document.querySelectorAll('.compare-table-checkbox:checked');
    if (checkboxes.length < 2) {
        alert('⚠️ Please select at least 2 tables to compare!');
        return;
    }

    // Get selected tables, hydrating each table's `data` from the API
    // (with a localStorage fallback) since the list endpoint omits `data`.
    selectedTablesForCompare = await Promise.all(
        Array.from(checkboxes).map(cb => {
            const tableId = parseInt(cb.value);
            return getSavedTableById(tableId);
        })
    );

    // Show selected tables info
    const infoDiv = document.getElementById('selectedTablesInfo');
    infoDiv.innerHTML = `
        <h4 style="margin: 0 0 12px 0; color: var(--dark); font-weight: 700;">Selected Tables:</h4>
        ${selectedTablesForCompare.map(table => `
            <div style="padding: 8px 12px; background: white; border-radius: 8px; margin-bottom: 8px; border: 2px solid var(--gray-border);">
                <strong>${table.name}</strong> - ${table.count} rows
            </div>
        `).join('')}
    `;
    
    // Reset comparison type
    comparisonType = null;
    document.querySelectorAll('.comparison-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.style.borderColor = 'var(--gray-border)';
        opt.style.background = 'white';
    });
    document.getElementById('compareExecuteBtn').disabled = true;
    
    // Show step 2
    document.querySelectorAll('.compare-step').forEach(s => s.classList.remove('active'));
    document.getElementById('compareStep2').classList.add('active');
}

// Select comparison type
function selectComparisonType(type) {
    comparisonType = type;
    
    // Update UI
    document.querySelectorAll('.comparison-option').forEach(opt => {
        opt.classList.remove('selected');
        opt.style.borderColor = 'var(--gray-border)';
        opt.style.background = 'white';
    });
    
    const selectedOption = document.querySelector(`.comparison-option[data-type="${type}"]`);
    selectedOption.classList.add('selected');
    selectedOption.style.borderColor = '#f97316';
    selectedOption.style.background = 'linear-gradient(135deg, rgba(249, 115, 22, 0.1), rgba(251, 146, 60, 0.1))';
    
    // Enable compare button
    document.getElementById('compareExecuteBtn').disabled = false;
}

// Execute comparison
function executeComparison() {
    if (!comparisonType || selectedTablesForCompare.length < 2) {
        alert('⚠️ Please select comparison type and tables!');
        return;
    }
    
    // Perform comparison based on type
    if (comparisonType === 'duplicates') {
        comparisonResults = findDuplicates(selectedTablesForCompare);
    } else if (comparisonType === 'unique') {
        comparisonResults = findUnique(selectedTablesForCompare);
    }
    
    // Show results
    displayComparisonResults();
}

// Find duplicates (entries that exist in ALL selected tables)
function findDuplicates(tables) {
    if (tables.length === 0) return [];
    
    const duplicates = [];
    const firstTable = tables[0];
    
    // For each entry in the first table
    firstTable.data.forEach(entry => {
        const businessName = (entry.Name || '').trim().toLowerCase();
        
        // Skip entries without a business name
        if (!businessName) return;
        
        // Check if this business name exists in ALL other tables
        const existsInAll = tables.slice(1).every(table => {
            return table.data.some(otherEntry => {
                const otherBusinessName = (otherEntry.Name || '').trim().toLowerCase();
                // Compare based on business name only (case insensitive)
                return businessName === otherBusinessName;
            });
        });
        
        if (existsInAll) {
            // Check if we already added this business name
            const alreadyAdded = duplicates.some(dup => {
                const dupBusinessName = (dup.Name || '').trim().toLowerCase();
                return businessName === dupBusinessName;
            });
            
            if (!alreadyAdded) {
                duplicates.push({ ...entry });
            }
        }
    });
    
    return duplicates;
}

// Find unique entries (entries that appear in ONLY ONE table, not in multiple)
function findUnique(tables) {
    if (tables.length === 0) return [];
    
    // Map to track: businessName -> { count: number, entry: object, tableIndices: Set }
    const businessNameMap = new Map();
    
    // Collect all entries and track which tables they appear in
    tables.forEach((table, tableIndex) => {
        table.data.forEach(entry => {
            const businessName = (entry.Name || '').trim().toLowerCase();
            
            // Skip entries without a business name
            if (!businessName) return;
            
            if (!businessNameMap.has(businessName)) {
                businessNameMap.set(businessName, {
                    count: 0,
                    entry: entry,
                    tableIndices: new Set()
                });
            }
            
            const info = businessNameMap.get(businessName);
            // Only count once per table (if same name appears multiple times in same table)
            if (!info.tableIndices.has(tableIndex)) {
                info.tableIndices.add(tableIndex);
                info.count++;
            }
        });
    });
    
    // Filter to keep only entries that appear in exactly ONE table
    const uniqueEntries = [];
    businessNameMap.forEach((info, businessName) => {
        if (info.count === 1) {
            uniqueEntries.push(info.entry);
        }
    });
    
    return uniqueEntries;
}

// Display comparison results
function displayComparisonResults() {
    // Update stats
    document.getElementById('compareResultsTotal').textContent = comparisonResults.length;
    document.getElementById('compareResultsType').textContent = 
        comparisonType === 'duplicates' ? '🔗 Duplicates' : '✨ Unique Only';
    document.getElementById('compareResultsTablesCount').textContent = selectedTablesForCompare.length;
    
    // Render results table
    const tbody = document.getElementById('compareResultsTableBody');
    tbody.innerHTML = '';
    
    if (comparisonResults.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" style="padding: 40px; text-align: center; color: var(--gray);">
                    ${comparisonType === 'duplicates' ? 
                        '🔍 No duplicates found across the selected tables.' : 
                        '🔍 No unique entries found.'}
                </td>
            </tr>
        `;
    } else {
        comparisonResults.forEach((row, index) => {
            const tr = document.createElement('tr');
            tr.style.cssText = 'border-bottom: 1px solid var(--gray-border);';
            if (index % 2 === 0) {
                tr.style.background = 'var(--gray-light)';
            }
            
            tr.innerHTML = `
                <td style="padding: 12px;">${row.Name || '-'}</td>
                <td style="padding: 12px;">${row.Website || '-'}</td>
                <td style="padding: 12px;">${row.Email || '-'}</td>
                <td style="padding: 12px;">${row.Phone || '-'}</td>
                <td style="padding: 12px;">${row.Address || '-'}</td>
            `;
            
            tbody.appendChild(tr);
        });
    }
    
    // Show step 3
    document.querySelectorAll('.compare-step').forEach(s => s.classList.remove('active'));
    document.getElementById('compareStep3').classList.add('active');
}

// Start new comparison
function startNewComparison() {
    goToCompareStep1();
}

// Save comparison table
async function saveComparisonTable() {
    if (comparisonResults.length === 0) {
        alert('⚠️ No results to save!');
        return;
    }

    const defaultName = comparisonType === 'duplicates' ?
        'Duplicates Comparison' : 'Unique Entries';
    const tableName = prompt('Enter a name for this comparison table:', defaultName);

    if (!tableName) return;

    const tableUrl = `Comparison: ${selectedTablesForCompare.map(t => t.name).join(', ')}`;

    // Persist to the SQLite-backed API. On success, use the server-returned
    // record (with its numeric id/date) for the localStorage mirror.
    let savedRecord = null;
    try {
        const response = await fetch('/api/tables', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: tableName,
                url: tableUrl,
                count: comparisonResults.length,
                data: comparisonResults
            })
        });
        if (response.ok) {
            const result = await response.json();
            if (result && result.success && result.table) {
                savedRecord = result.table;
            }
        }
    } catch (_error) {
        // Ignore; fall through to the localStorage-only write below.
    }

    // Write-through mirror: keep the existing localStorage write so the feature
    // never breaks whether or not the server accepted the write.
    const savedTables = JSON.parse(localStorage.getItem('savedTables') || '[]');

    const newTable = savedRecord || {
        id: Date.now(),
        name: tableName,
        url: tableUrl,
        data: comparisonResults,
        date: new Date().toISOString(),
        count: comparisonResults.length
    };

    savedTables.push(newTable);
    localStorage.setItem('savedTables', JSON.stringify(savedTables));

    alert(`✅ Table "${tableName}" saved successfully with ${comparisonResults.length} rows!`);
}

// Export comparison to CSV
function exportComparisonCSV() {
    if (comparisonResults.length === 0) {
        alert('⚠️ No results to export!');
        return;
    }
    
    // Get headers
    const headers = ['Name', 'Website', 'Email', 'Phone', 'Address'];
    
    // Build CSV content
    let csv = headers.join(',') + '\n';
    
    comparisonResults.forEach(row => {
        const values = headers.map(header => {
            const value = row[header] || '';
            // Escape quotes and wrap in quotes if contains comma
            return value.includes(',') || value.includes('"') ? 
                `"${value.replace(/"/g, '""')}"` : value;
        });
        csv += values.join(',') + '\n';
    });
    
    // Download CSV
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `comparison_${comparisonType}_${Date.now()}.csv`);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

// Event listeners for compare tables
compareTablesBtn.addEventListener('click', openCompareTablesModal);
compareTablesClose.addEventListener('click', closeCompareTablesModal);
compareTablesModal.addEventListener('click', (e) => {
    if (e.target === compareTablesModal) closeCompareTablesModal();
});

console.log('🔄 Compare Tables feature initialized');
