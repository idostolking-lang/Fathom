// Global state
let currentStep = 1;
let analyzedUrl = '';
let selectedSuggestion = null;
let scrapedData = [];
let isWhatsAppReady = false;
let whatsappCheckInterval = null;

// Initialize window.scrapedData for background tasks access
window.scrapedData = scrapedData;

// Specific Search state
let selectedSearchTable = null;
let websiteBusinesses = [];
let searchInstructions = '';
let searchType = 'all'; // 'all' or 'custom'
let selectedSearchBusinesses = [];
let currentReport = null; // Store current report for saving

// DOM Elements
const modalOverlay = document.getElementById('modalOverlay');
const startScrapeBtn = document.getElementById('startScrapeBtn');
const modalClose = document.getElementById('modalClose');
const analyzeBtn = document.getElementById('analyzeBtn');
const websiteUrlInput = document.getElementById('websiteUrl');
const viewResultsBtn = document.getElementById('viewResultsBtn');
const newScrapeBtn = document.getElementById('newScrapeBtn');
const savedTablesBtn = document.getElementById('savedTablesBtn');
const savedReportsBtn = document.getElementById('savedReportsBtn');
const leadSenderBtn = document.getElementById('leadSenderBtn');
const leadSenderModal = document.getElementById('leadSenderModal');
const leadSenderClose = document.getElementById('leadSenderClose');

// Specific Search DOM Elements
const specificSearchBtn = document.getElementById('specificSearchBtn');
const specificSearchModal = document.getElementById('specificSearchModal');
const specificSearchClose = document.getElementById('specificSearchClose');

// Lead Based on Report DOM Elements
const leadBasedReportBtn = document.getElementById('leadBasedReportBtn');
const leadReportModal = document.getElementById('leadReportModal');
const leadReportClose = document.getElementById('leadReportClose');

// Lead Based on Report state
let selectedReportForMessage = null;

// Clipboard Manager DOM Elements
const clipboardManagerBtn = document.getElementById('clipboardManagerBtn');
const clipboardModal = document.getElementById('clipboardModal');
const clipboardClose = document.getElementById('clipboardClose');

// Event Listeners
startScrapeBtn.addEventListener('click', openModal);
modalClose.addEventListener('click', closeModal);
modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) closeModal();
});
analyzeBtn.addEventListener('click', analyzeWebsite);
viewResultsBtn.addEventListener('click', viewResults);
newScrapeBtn.addEventListener('click', startNewScrape);
savedTablesBtn.addEventListener('click', () => window.location.href = 'saved-tables.html');
savedReportsBtn.addEventListener('click', () => window.location.href = 'saved-reports.html');
document.getElementById('pastAnalysesBtn').addEventListener('click', () => window.location.href = 'past-analyses.html');
// Allow Enter key to submit URL
websiteUrlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        analyzeWebsite();
    }
});

// WhatsApp Status Checker
function checkWhatsAppStatus() {
    fetch('/api/whatsapp/status')
        .then(res => res.json())
        .then(data => {
            isWhatsAppReady = data.isReady;
            const statusText = document.getElementById('whatsappStatusText');
            const statusDiv = document.getElementById('whatsappStatus');
            
            // Get modal sections
            const qrSection = document.getElementById('whatsappQRSection');
            const connectedSection = document.getElementById('whatsappConnectedSection');
            
            if (data.isReady) {
                // WhatsApp is connected
                statusText.textContent = '✅ Connected';
                statusText.style.color = '#10b981';
                statusDiv.style.borderColor = '#10b981';
                
                // Show connected section in modal, hide QR section
                if (connectedSection) connectedSection.style.display = 'block';
                if (qrSection) qrSection.style.display = 'none';
            } else if (data.qrCode) {
                // QR code available
                statusText.textContent = '📱 Scan QR';
                statusText.style.color = '#f59e0b';
                statusDiv.style.borderColor = '#f59e0b';
                
                // Show QR code in modal
                const qrContainer = document.getElementById('qrCodeContainer');
                qrContainer.innerHTML = `<img src="${data.qrCode}" alt="QR Code" style="max-width: 300px; border-radius: 12px; box-shadow: var(--shadow-lg);">`;
                
                // Show QR section in modal, hide connected section
                if (qrSection) qrSection.style.display = 'block';
                if (connectedSection) connectedSection.style.display = 'none';
            } else {
                // Connecting...
                statusText.textContent = '🔄 Connecting...';
                statusText.style.color = '#0ea5e9';
                
                // Show QR section (even if no QR yet), hide connected section
                if (qrSection) qrSection.style.display = 'block';
                if (connectedSection) connectedSection.style.display = 'none';
            }
        })
        .catch(err => {
            console.error('WhatsApp status check failed:', err);
            document.getElementById('whatsappStatusText').textContent = '❌ Offline';
        });
}

// Check WhatsApp status on page load and periodically
checkWhatsAppStatus();
whatsappCheckInterval = setInterval(checkWhatsAppStatus, 3000);

// WhatsApp status click handler
document.getElementById('whatsappStatus').addEventListener('click', () => {
    // Always open modal - if connected, they can disconnect, if not, they can scan QR
    document.getElementById('whatsappQRModal').classList.add('active');
});

// WhatsApp QR Modal close
document.getElementById('whatsappQRClose').addEventListener('click', () => {
    document.getElementById('whatsappQRModal').classList.remove('active');
});

// Disconnect WhatsApp button
document.getElementById('disconnectWhatsAppBtn').addEventListener('click', async () => {
    if (!confirm('⚠️ Are you sure you want to disconnect WhatsApp?\n\nYou will need to scan the QR code again with a different device.')) {
        return;
    }
    
    try {
        const response = await fetch('/api/whatsapp/restart', {
            method: 'POST'
        });
        
        const result = await response.json();
        
        if (result.success) {
            alert('✅ WhatsApp disconnected successfully!\n\nPlease scan the QR code with your new device.');
            
            // Reset status
            isWhatsAppReady = false;
            document.getElementById('whatsappStatusText').textContent = '🔄 Connecting...';
            document.getElementById('whatsappStatusText').style.color = '#0ea5e9';
            
            // Hide connected section, show QR section
            document.getElementById('whatsappConnectedSection').style.display = 'none';
            document.getElementById('whatsappQRSection').style.display = 'block';
            
            // Force a status check to get new QR
            setTimeout(() => {
                checkWhatsAppStatus();
            }, 1000);
        } else {
            alert('❌ Failed to disconnect: ' + result.message);
        }
    } catch (error) {
        console.error('Error disconnecting WhatsApp:', error);
        alert('❌ Error disconnecting WhatsApp: ' + error.message);
    }
});

// Modal Functions
function openModal() {
    modalOverlay.classList.add('active');
    goToStep(1);
}

function closeModal() {
    modalOverlay.classList.remove('active');
    resetModal();
}

function resetModal() {
    goToStep(1);
    websiteUrlInput.value = '';
    const suggestionsContainer = document.getElementById('suggestionsContainer');
    if (suggestionsContainer) {
        suggestionsContainer.innerHTML = '';
    }

    const customConfig = document.getElementById('customConfig');
    if (customConfig) {
        customConfig.style.display = 'none';
    }
    selectedSuggestion = null;
}

// Step Navigation
function goToStep(step) {
    currentStep = step;
    
    // Update step indicator
    document.querySelectorAll('.step').forEach((el, index) => {
        el.classList.remove('active', 'completed');
        if (index + 1 < step) {
            el.classList.add('completed');
        } else if (index + 1 === step) {
            el.classList.add('active');
        }
    });
    
    // Update step content
    document.querySelectorAll('.step-content').forEach((el) => {
        el.classList.remove('active');
    });
    document.getElementById(`step${step}`).classList.add('active');
}

// Make goToStep globally accessible for background tasks
window.goToStep = goToStep;

// Analyze Website and Start Scraping
async function analyzeWebsite(runInBackground = false) {
    const url = websiteUrlInput.value.trim();
    const duration = parseInt(document.getElementById('durationSelect').value);
    
    if (!url) {
        alert('Please enter a valid URL');
        return;
    }
    
    // Validate URL format
    try {
        new URL(url);
    } catch (e) {
        alert('Please enter a valid URL (including http:// or https://)');
        return;
    }
    
    analyzedUrl = url;
    
    if (runInBackground) {
        // Background mode
        try {
            const response = await fetch('/api/scrape', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    url, 
                    duration,
                    runInBackground: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                alert(`✅ Google Maps scraping started in background!\n\n📋 Task ID: ${result.taskId}\n\n👉 You can continue working. Click the tasks button (bottom-right) to monitor progress.`);
                // DO NOT close modal or show background tasks - let user stay on current screen
                // closeModal();
                // backgroundTasksUI.show();
            } else {
                alert('❌ Error: ' + result.error);
            }
        } catch (error) {
            alert('❌ Error: ' + error.message);
        }
        return;
    }
    
    // Show loading state
    const btnText = analyzeBtn.querySelector('.btn-text');
    const btnLoader = analyzeBtn.querySelector('.btn-loader');
    btnText.style.display = 'none';
    btnLoader.style.display = 'block';
    analyzeBtn.disabled = true;
    
    try {
        // First analyze
        const analyzeResponse = await fetch('/api/analyze', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url }),
        });
        
        const analyzeData = await analyzeResponse.json();
        
        if (!analyzeData.success) {
            alert('Failed to analyze website: ' + analyzeData.error);
            btnText.style.display = 'inline';
            btnLoader.style.display = 'none';
            analyzeBtn.disabled = false;
            return;
        }
        
        // Go to scraping step
        goToStep(3);
        document.getElementById('progressMessage').textContent = `Extracting data for ${duration} minutes...`;
        document.getElementById('progressDetails').textContent = 'Loading Google Maps...';
        
        // Start scraping immediately
        const scrapeResponse = await fetch('/api/scrape', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ url, duration }),
        });
        
        const scrapeData = await scrapeResponse.json();
        
        if (scrapeData.success) {
            scrapedData = scrapeData.data;
            window.scrapedData = scrapeData.data; // Make accessible globally
            
            document.getElementById('resultMessage').textContent = 
                `Successfully extracted data from the website!`;
            
            goToStep(4);
        } else {
            alert('Failed to scrape website: ' + scrapeData.error);
            goToStep(1);
        }
        
    } catch (error) {
        alert('Error: ' + error.message + '. Make sure the server is running.');
        console.error(error);
        goToStep(1);
    } finally {
        btnText.style.display = 'inline';
        btnLoader.style.display = 'none';
        analyzeBtn.disabled = false;
    }
}


// View Results
function viewResults() {
    // Store data in localStorage
    localStorage.setItem('scrapedData', JSON.stringify(scrapedData));
    localStorage.setItem('scrapedUrl', analyzedUrl);
    
    // Navigate to results page
    window.location.href = 'results.html';
}

// Start New Scrape
function startNewScrape() {
    resetModal();
    goToStep(1);
}

// ===== LEAD SENDER FUNCTIONALITY =====
