// ===== ANALYZE MESSAGES FEATURE =====

// Analyze Messages state
let messageAnalysisData = {
    messages: '',
    photos: [],
    files: [],
    behaviorInstructions: '',
    behaviorFiles: [],
    currentAnalysis: null,
    tokensUsed: 0,
    estimatedCost: 0
};

// Selected AI model for analysis (from the injected model picker).
// Defaults to the global Fathom default when config is present.
let messageAnalysisModel = (window.FATHOM && window.FATHOM.defaultModel) || 'gpt-4o';

// Inject the prompt-template and model selectors near the behavior-instructions
// textarea. Runs once; guarded against duplicates and against a missing config.
function injectMessageAnalysisControls() {
    if (!window.FATHOM) return;
    if (document.getElementById('messageAnalysisControls')) return;

    const behaviorTextarea = document.getElementById('behaviorInstructions');
    if (!behaviorTextarea || !behaviorTextarea.parentNode) return;

    const container = document.createElement('div');
    container.id = 'messageAnalysisControls';
    container.style.cssText = 'display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 16px;';

    // 1. Prompt-template selector.
    const templateSelect = document.createElement('select');
    templateSelect.id = 'messageAnalysisTemplateSelect';
    templateSelect.className = 'form-input';
    templateSelect.style.flex = '1';
    templateSelect.innerHTML = window.FATHOM.templateOptions('messageAnalysis');
    templateSelect.addEventListener('change', function () {
        const value = templateSelect.value;
        if (value === '') return;
        const template = window.FATHOM.promptTemplates.messageAnalysis[Number(value)];
        if (template) {
            behaviorTextarea.value = template.prompt;
        }
    });

    // 2. Model selector.
    const modelSelect = document.createElement('select');
    modelSelect.id = 'messageAnalysisModelSelect';
    modelSelect.className = 'form-input';
    modelSelect.style.flex = '1';
    modelSelect.innerHTML = window.FATHOM.modelOptions(messageAnalysisModel);
    modelSelect.value = messageAnalysisModel;
    modelSelect.addEventListener('change', function () {
        messageAnalysisModel = modelSelect.value;
    });

    container.appendChild(templateSelect);
    container.appendChild(modelSelect);

    behaviorTextarea.parentNode.insertBefore(container, behaviorTextarea);
}

// File size limits (in bytes)
const MAX_PHOTO_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_TOTAL_PHOTOS = 10;

// Cost tracking state
let sessionCostTracking = {
    totalTokens: 0,
    totalCost: 0,
    analyses: []
};

// Load session cost tracking from localStorage (sync source of truth)
const savedCosts = localStorage.getItem('sessionCostTracking');
if (savedCosts) {
    sessionCostTracking = JSON.parse(savedCosts);
}

// Hydrate cost tracking from the SQLite-backed API in the background.
// Falls back silently to the localStorage value already loaded above on any failure.
(async function hydrateCostTrackingFromApi() {
    try {
        const response = await fetch('/api/cost-tracking');
        if (!response.ok) return;
        const result = await response.json();
        if (!result || !result.success) return;
        sessionCostTracking = {
            totalTokens: result.totalTokens || 0,
            totalCost: result.totalCost || 0,
            analyses: result.entries || []
        };
        // Mirror back to localStorage so the sync fallback stays current.
        localStorage.setItem('sessionCostTracking', JSON.stringify(sessionCostTracking));
        // Refresh any visible totals if the cost tracker is already on screen.
        const totalCostEl = document.getElementById('totalSessionCost');
        if (totalCostEl) {
            totalCostEl.textContent = `$${sessionCostTracking.totalCost.toFixed(4)}`;
        }
    } catch (_error) {
        // Keep localStorage value; never break the feature.
    }
})();

// Analysis cache for performance
const analysisCache = new Map();

// Open Analyze Messages Modal
function openAnalyzeMessages() {
    document.getElementById('analyzeMessagesModal').classList.add('active');
    injectMessageAnalysisControls();
    goToAnalyzeStep(1);
    resetAnalyzeMessagesForm();
}

// Close Analyze Messages Modal
function closeAnalyzeMessages() {
    document.getElementById('analyzeMessagesModal').classList.remove('active');
    resetAnalyzeMessagesForm();
}

// Reset form
function resetAnalyzeMessagesForm() {
    messageAnalysisData = {
        messages: '',
        photos: [],
        files: [],
        behaviorInstructions: '',
        behaviorFiles: [],
        currentAnalysis: null
    };
    
    document.getElementById('messagesTextInput').value = '';
    document.getElementById('behaviorInstructions').value = '';
    document.getElementById('textInputArea').style.display = 'none';
    document.getElementById('uploadedFilesDisplay').style.display = 'none';
    document.getElementById('behaviorFilesDisplay').style.display = 'none';
    document.getElementById('filesList').innerHTML = '';
    document.getElementById('behaviorFilesList').innerHTML = '';
}

// Navigate between steps
function goToAnalyzeStep(step) {
    document.querySelectorAll('.analyze-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`analyzeStep${step}`).classList.add('active');
}

// Show text input area
function showTextInput() {
    const textArea = document.getElementById('textInputArea');
    textArea.style.display = 'block';
    document.getElementById('messagesTextInput').focus();
}

// Handle photo upload with validation and preview
async function handlePhotoUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Check total photo limit
    if (messageAnalysisData.photos.length + files.length > MAX_TOTAL_PHOTOS) {
        alert(`⚠️ Maximum ${MAX_TOTAL_PHOTOS} photos allowed!\n\nYou currently have ${messageAnalysisData.photos.length} photos. You can only add ${MAX_TOTAL_PHOTOS - messageAnalysisData.photos.length} more.`);
        return;
    }
    
    console.log(`📸 Uploading ${files.length} photos for analysis`);
    
    let skipped = 0;
    let uploaded = 0;
    
    // Validate and store photos
    for (const file of files) {
        // Check file size
        if (file.size > MAX_PHOTO_SIZE) {
            console.warn(`⚠️ Skipping ${file.name} - size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds limit`);
            skipped++;
            continue;
        }
        
        // Check file type
        if (!file.type.startsWith('image/')) {
            console.warn(`⚠️ Skipping ${file.name} - not an image file`);
            skipped++;
            continue;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            messageAnalysisData.photos.push({
                name: file.name,
                data: e.target.result,
                size: file.size
            });
            displayUploadedFiles();
            displayPhotoPreview();
        };
        reader.readAsDataURL(file);
        uploaded++;
    }
    
    if (skipped > 0) {
        alert(`⚠️ Uploaded ${uploaded} photo(s), skipped ${skipped}.\n\nSkipped files exceeded 10MB or were not images.`);
    } else {
        alert(`✅ Uploaded ${uploaded} photo(s) successfully!`);
    }
}

// Handle file upload with validation
async function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    console.log(`📁 Uploading ${files.length} file(s) for analysis`);
    
    let skipped = 0;
    let uploaded = 0;
    
    for (const file of files) {
        // Check file size
        if (file.size > MAX_FILE_SIZE) {
            console.warn(`⚠️ Skipping ${file.name} - size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds 5MB limit`);
            skipped++;
            continue;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            messageAnalysisData.files.push({
                name: file.name,
                content: e.target.result,
                type: file.type,
                size: file.size
            });
            displayUploadedFiles();
        };
        reader.readAsText(file);
        uploaded++;
    }
    
    if (skipped > 0) {
        alert(`⚠️ Uploaded ${uploaded} file(s), skipped ${skipped} (exceeded 5MB).`);
    } else {
        alert(`✅ Uploaded ${uploaded} file(s) successfully!`);
    }
}

// Display uploaded files
function displayUploadedFiles() {
    const display = document.getElementById('uploadedFilesDisplay');
    const filesList = document.getElementById('filesList');
    
    filesList.innerHTML = '';
    
    // Photos
    messageAnalysisData.photos.forEach((photo, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 12px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1)); border: 2px solid #8b5cf6; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;';
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#8b5cf6">
                    <path d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                </svg>
                <span style="font-weight: 600; color: var(--dark);">${photo.name}</span>
            </div>
            <button onclick="removeUploadedFile('photo', ${index})" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">Remove</button>
        `;
        filesList.appendChild(div);
    });
    
    // Files
    messageAnalysisData.files.forEach((file, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'padding: 12px; background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(239, 68, 68, 0.1)); border: 2px solid #f59e0b; border-radius: 8px; display: flex; align-items: center; justify-content: space-between;';
        div.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px;">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="#f59e0b">
                    <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                </svg>
                <span style="font-weight: 600; color: var(--dark);">${file.name}</span>
            </div>
            <button onclick="removeUploadedFile('file', ${index})" style="padding: 6px 12px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px;">Remove</button>
        `;
        filesList.appendChild(div);
    });
    
    display.style.display = messageAnalysisData.photos.length + messageAnalysisData.files.length > 0 ? 'block' : 'none';
}

// Display photo preview
function displayPhotoPreview() {
    const previewSection = document.getElementById('photoPreviewSection');
    const previewGrid = document.getElementById('photoPreviewGrid');
    
    previewGrid.innerHTML = '';
    
    if (messageAnalysisData.photos.length === 0) {
        previewSection.style.display = 'none';
        return;
    }
    
    previewSection.style.display = 'block';
    
    messageAnalysisData.photos.forEach((photo, index) => {
        const card = document.createElement('div');
        card.style.cssText = 'position: relative; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1); transition: all 0.3s; cursor: pointer;';
        
        const sizeKB = (photo.size / 1024).toFixed(1);
        
        card.innerHTML = `
            <img src="${photo.data}" alt="${photo.name}" style="width: 100%; height: 200px; object-fit: cover;">
            <div style="position: absolute; top: 8px; right: 8px; background: rgba(0,0,0,0.7); color: white; padding: 4px 8px; border-radius: 6px; font-size: 11px;">
                ${sizeKB} KB
            </div>
            <div style="padding: 12px; background: white;">
                <div style="font-size: 13px; font-weight: 600; color: var(--dark); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${photo.name}</div>
                <button onclick="removeUploadedFile('photo', ${index}); event.stopPropagation();" style="margin-top: 8px; width: 100%; padding: 6px; background: #ef4444; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 12px; font-weight: 600;">Remove</button>
            </div>
        `;
        
        // Click to enlarge
        card.onclick = (e) => {
            if (e.target.tagName === 'BUTTON') return;
            const modal = document.createElement('div');
            modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';
            modal.innerHTML = `
                <div style="position: relative; max-width: 90%; max-height: 90%;">
                    <img src="${photo.data}" alt="${photo.name}" style="max-width: 100%; max-height: 90vh; border-radius: 12px;">
                    <button onclick="this.parentElement.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: white; color: #ef4444; border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; font-size: 20px; font-weight: 700;">×</button>
                </div>
            `;
            modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
            document.body.appendChild(modal);
        };
        
        previewGrid.appendChild(card);
    });
}

// Remove uploaded file
function removeUploadedFile(type, index) {
    if (type === 'photo') {
        messageAnalysisData.photos.splice(index, 1);
        displayPhotoPreview();
    } else {
        messageAnalysisData.files.splice(index, 1);
    }
    displayUploadedFiles();
}

// Handle behavior file upload
async function handleBehaviorFileUpload(event, type) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    for (const file of files) {
        const reader = new FileReader();
        reader.onload = (e) => {
            messageAnalysisData.behaviorFiles.push({
                name: file.name,
                content: e.target.result,
                type: type
            });
            displayBehaviorFiles();
        };
        reader.readAsText(file);
    }
    
    alert(`✅ Uploaded ${files.length} behavior file(s)!`);
}

// Display behavior files
function displayBehaviorFiles() {
    const display = document.getElementById('behaviorFilesDisplay');
    const filesList = document.getElementById('behaviorFilesList');
    
    filesList.innerHTML = '';
    
    messageAnalysisData.behaviorFiles.forEach((file, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'display: flex; align-items: center; justify-content: space-between; padding: 8px; background: white; border-radius: 6px; margin-top: 6px;';
        div.innerHTML = `
            <span style="font-size: 13px; color: var(--dark);">📎 ${file.name} (${file.type})</span>
            <button onclick="removeBehaviorFile(${index})" style="padding: 4px 8px; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 11px;">Remove</button>
        `;
        filesList.appendChild(div);
    });
    
    display.style.display = messageAnalysisData.behaviorFiles.length > 0 ? 'block' : 'none';
}

// Remove behavior file
function removeBehaviorFile(index) {
    messageAnalysisData.behaviorFiles.splice(index, 1);
    displayBehaviorFiles();
}

// Load behavior preset
async function loadBehaviorPreset() {
    // READ: try the SQLite-backed API first, fall back to localStorage on any failure.
    let savedPresets;
    try {
        const response = await fetch('/api/presets/behavior');
        if (!response.ok) throw new Error('Request failed');
        const result = await response.json();
        if (!result || !result.success || !Array.isArray(result.presets)) {
            throw new Error('Invalid response');
        }
        savedPresets = result.presets;
        // Mirror to localStorage so the offline fallback stays current.
        localStorage.setItem('behaviorPresets', JSON.stringify(savedPresets));
    } catch (_error) {
        savedPresets = JSON.parse(localStorage.getItem('behaviorPresets') || '[]');
    }

    if (savedPresets.length === 0) {
        alert('⚠️ No saved behavior presets found!\n\nCreate and save a preset first.');
        return;
    }
    
    // Create selection modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';
    
    let presetsHTML = savedPresets.map((preset, index) => `
        <div onclick="selectPreset(${preset.id})" style="padding: 16px; background: linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(6, 182, 212, 0.1)); border: 2px solid #8b5cf6; border-radius: 12px; cursor: pointer; transition: all 0.2s; margin-bottom: 12px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.2)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
            <div style="font-weight: 600; font-size: 16px; color: var(--dark); margin-bottom: 4px;">${preset.name}</div>
            <div style="font-size: 13px; color: var(--gray);">📅 ${new Date(preset.date).toLocaleDateString()}</div>
            <div style="font-size: 12px; color: var(--gray); margin-top: 8px; font-style: italic;">${preset.behavior.substring(0, 100)}...</div>
        </div>
    `).join('');
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 32px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h3 style="margin: 0; color: var(--dark);">📦 Load Behavior Preset</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 28px; color: var(--gray); cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;" onmouseover="this.style.background='var(--gray-light)'" onmouseout="this.style.background='none'">×</button>
            </div>
            <div>${presetsHTML}</div>
        </div>
    `;
    
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    // Make selectPreset function available
    window.selectPreset = (presetId) => {
        const preset = savedPresets.find(p => p.id === presetId);
        if (preset) {
            document.getElementById('behaviorInstructions').value = preset.behavior;
            messageAnalysisData.behaviorFiles = preset.files || [];
            displayBehaviorFiles();
            modal.remove();
            alert(`✅ Loaded preset: "${preset.name}"`);
        }
    };
    
    document.body.appendChild(modal);
}

// Save behavior preset
async function saveBehaviorPreset() {
    const behaviorText = document.getElementById('behaviorInstructions').value.trim();

    if (!behaviorText && messageAnalysisData.behaviorFiles.length === 0) {
        alert('⚠️ Please enter behavior instructions or upload files first!');
        return;
    }

    const presetName = prompt('Enter a name for this behavior preset:', 'My Analysis Behavior');
    if (!presetName) return;

    const newPreset = {
        id: Date.now(),
        name: presetName,
        behavior: behaviorText,
        files: messageAnalysisData.behaviorFiles,
        date: new Date().toISOString()
    };

    // WRITE-THROUGH: persist to the SQLite-backed API, then mirror to localStorage.
    try {
        const response = await fetch('/api/presets/behavior', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: presetName,
                behavior: behaviorText,
                files: messageAnalysisData.behaviorFiles
            })
        });
        const result = await response.json();
        if (result && result.success && result.preset) {
            // Adopt server-assigned id/date so the mirror matches the backend.
            newPreset.id = result.preset.id != null ? result.preset.id : newPreset.id;
            newPreset.date = result.preset.date || newPreset.date;
        }
    } catch (_error) {
        // Ignore API failure; localStorage mirror below keeps the feature working.
    }

    const savedPresets = JSON.parse(localStorage.getItem('behaviorPresets') || '[]');
    savedPresets.push(newPreset);
    localStorage.setItem('behaviorPresets', JSON.stringify(savedPresets));

    alert(`✅ Behavior preset "${presetName}" saved successfully!`);
}

// Calculate cost based on tokens and model
function calculateCost(tokensUsed, hasPhotos = false) {
    // GPT-4o pricing (as of 2024)
    // Input: $5 per 1M tokens ($0.005 per 1K)
    // Output: $15 per 1M tokens ($0.015 per 1K)
    // With vision: Additional $0.01275 per image (high detail)
    
    const inputCost = (tokensUsed.prompt * 0.005) / 1000;
    const outputCost = (tokensUsed.completion * 0.015) / 1000;
    const photoCost = hasPhotos ? (messageAnalysisData.photos.length * 0.01275) : 0;
    
    return inputCost + outputCost + photoCost;
}

// Update cost tracking display
function updateCostTracking(tokensUsed, cost) {
    sessionCostTracking.totalTokens += tokensUsed.total;
    sessionCostTracking.totalCost += cost;
    sessionCostTracking.analyses.push({
        tokens: tokensUsed.total,
        cost: cost,
        date: new Date().toISOString()
    });
    
    // Save to localStorage (sync mirror)
    localStorage.setItem('sessionCostTracking', JSON.stringify(sessionCostTracking));

    // WRITE-THROUGH: increment the SQLite-backed total in the background.
    // Fire-and-forget so this sync function keeps working even if the API is unreachable.
    fetch('/api/cost-tracking', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tokens: tokensUsed.total, cost: cost })
    }).catch(() => { /* localStorage mirror above keeps the feature working */ });

    // Update display
    document.getElementById('tokensUsed').textContent = tokensUsed.total.toLocaleString();
    document.getElementById('estimatedCost').textContent = `$${cost.toFixed(4)}`;
    document.getElementById('totalSessionCost').textContent = `$${sessionCostTracking.totalCost.toFixed(4)}`;
    document.getElementById('costTrackerDisplay').style.display = 'block';
}

// Reset cost tracking
function resetCostTracking() {
    if (confirm('Reset cost tracking for this session?')) {
        sessionCostTracking = { totalTokens: 0, totalCost: 0, analyses: [] };
        localStorage.setItem('sessionCostTracking', JSON.stringify(sessionCostTracking));

        // WRITE-THROUGH: reset the SQLite-backed total in the background.
        // Fire-and-forget so the reset never fails if the API is unreachable.
        fetch('/api/cost-tracking/reset', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        }).catch(() => { /* localStorage mirror above keeps the feature working */ });

        document.getElementById('totalSessionCost').textContent = '$0.00';
        alert('✅ Session cost tracking reset!');
    }
}

// Start message analysis with retry, caching, and cost tracking
async function startMessageAnalysis() {
    // Collect messages from all sources
    let messages = '';
    
    // Text input
    const textInput = document.getElementById('messagesTextInput').value.trim();
    if (textInput) {
        messages += textInput + '\n\n';
    }
    
    // Files
    messageAnalysisData.files.forEach(file => {
        messages += `--- Content from ${file.name} ---\n${file.content}\n\n`;
    });
    
    // Check if we have messages
    if (!messages && messageAnalysisData.photos.length === 0) {
        alert('⚠️ Please provide messages to analyze!\n\nYou can:\n- Type or paste messages\n- Upload chat files\n- Upload photos of messages');
        return;
    }
    
    // Get behavior instructions
    const behaviorInstructions = document.getElementById('behaviorInstructions').value.trim();
    
    // Behavior instructions are optional for photos (preset behavior), but required for text/files
    if (!behaviorInstructions && messageAnalysisData.photos.length === 0) {
        alert('⚠️ Please provide behavior instructions!\n\nFor text and files, behavior instructions are required.\n\n(Photos have automatic preset behavior, so instructions are optional)');
        return;
    }
    
    // Store in state
    messageAnalysisData.messages = messages;
    messageAnalysisData.behaviorInstructions = behaviorInstructions;
    
    // Check cache first
    const cacheKey = `${messages.substring(0, 100)}_${behaviorInstructions.substring(0, 100)}`;
    if (analysisCache.has(cacheKey)) {
        console.log('✅ Using cached analysis');
        const cached = analysisCache.get(cacheKey);
        messageAnalysisData.currentAnalysis = cached.analysis;
        document.getElementById('analysisResult').textContent = cached.analysis;
        goToAnalyzeStep(4);
        return;
    }
    
    // Go to processing step
    goToAnalyzeStep(3);
    
    console.log('🤖 Starting message analysis...');
    console.log(`📝 Messages length: ${messages.length} characters`);
    console.log(`📸 Photos: ${messageAnalysisData.photos.length}`);
    console.log(`📁 Files: ${messageAnalysisData.files.length}`);
    console.log(`🎯 Behavior files: ${messageAnalysisData.behaviorFiles.length}`);
    
    // Prepare behavior context
    let behaviorContext = behaviorInstructions || '';
    
    // Add behavior files
    messageAnalysisData.behaviorFiles.forEach(file => {
        behaviorContext += `\n\n--- Reference from ${file.name} ---\n${file.content}\n`;
    });
    
    const requestBody = {
        messages: messages,
        photos: messageAnalysisData.photos,
        behaviorInstructions: behaviorContext,
        model: messageAnalysisModel
    };
    
    // Retry mechanism
    const maxRetries = 3;
    let retryCount = 0;
    let lastError = null;
    
    while (retryCount < maxRetries) {
        try {
            if (retryCount > 0) {
                document.getElementById('analysisProgressText').textContent = `Retrying... Attempt ${retryCount + 1}/${maxRetries}`;
                await new Promise(resolve => setTimeout(resolve, 2000 * retryCount)); // Exponential backoff
            }
            
            // Call backend API
            const response = await fetch('/api/analyze-messages', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestBody)
            });
            
            const result = await response.json();
            
            if (result.success) {
                // Store the analysis
                messageAnalysisData.currentAnalysis = result.analysis;
                messageAnalysisData.tokensUsed = result.tokensUsed || 0;
                
                // Calculate and track cost
                if (result.tokensUsed) {
                    const cost = calculateCost({
                        prompt: Math.floor(result.tokensUsed * 0.4), // Estimate 40% prompt
                        completion: Math.floor(result.tokensUsed * 0.6), // 60% completion
                        total: result.tokensUsed
                    }, messageAnalysisData.photos.length > 0);
                    
                    messageAnalysisData.estimatedCost = cost;
                    updateCostTracking({
                        prompt: Math.floor(result.tokensUsed * 0.4),
                        completion: Math.floor(result.tokensUsed * 0.6),
                        total: result.tokensUsed
                    }, cost);
                }
                
                // Cache the result
                analysisCache.set(cacheKey, {
                    analysis: result.analysis,
                    timestamp: Date.now()
                });
                
                // Display result
                document.getElementById('analysisResult').textContent = result.analysis;
                
                // Go to results step
                goToAnalyzeStep(4);
                
                console.log('✅ Analysis complete!');
                console.log(`📊 Analysis length: ${result.analysis.length} characters`);
                console.log(`💰 Tokens used: ${result.tokensUsed || 'N/A'}`);
                console.log(`💵 Estimated cost: $${messageAnalysisData.estimatedCost.toFixed(4)}`);
                
                return; // Success, exit retry loop
            } else {
                throw new Error(result.error || 'Analysis failed');
            }
            
        } catch (error) {
            lastError = error;
            retryCount++;
            console.error(`❌ Attempt ${retryCount} failed:`, error.message);
            
            if (retryCount >= maxRetries) {
                alert(`❌ Analysis failed after ${maxRetries} attempts:\n\n${error.message}\n\nPlease try again or check your internet connection.`);
                goToAnalyzeStep(2);
                return;
            }
        }
    }
}

// Save analysis
async function saveAnalysis() {
    if (!messageAnalysisData.currentAnalysis) {
        alert('⚠️ No analysis to save!');
        return;
    }

    const analysisName = prompt('Enter a name for this analysis:', `Analysis - ${new Date().toLocaleDateString()}`);
    if (!analysisName) return;

    const messagesPreview = messageAnalysisData.messages.substring(0, 200) + '...';
    const newAnalysis = {
        id: Date.now(),
        name: analysisName,
        analysis: messageAnalysisData.currentAnalysis,
        behaviorInstructions: messageAnalysisData.behaviorInstructions,
        messagesPreview: messagesPreview,
        date: new Date().toISOString()
    };

    // WRITE-THROUGH: persist to the SQLite-backed API, then mirror to localStorage.
    try {
        const response = await fetch('/api/analyses', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: analysisName,
                analysis: messageAnalysisData.currentAnalysis,
                behaviorInstructions: messageAnalysisData.behaviorInstructions,
                messagesPreview: messagesPreview
            })
        });
        const result = await response.json();
        if (result && result.success && result.analysis) {
            // Adopt server-assigned id/date so the mirror matches the backend.
            newAnalysis.id = result.analysis.id != null ? result.analysis.id : newAnalysis.id;
            newAnalysis.date = result.analysis.date || newAnalysis.date;
        }
    } catch (_error) {
        // Ignore API failure; localStorage mirror below keeps the feature working.
    }

    const savedAnalyses = JSON.parse(localStorage.getItem('savedAnalyses') || '[]');
    savedAnalyses.push(newAnalysis);
    localStorage.setItem('savedAnalyses', JSON.stringify(savedAnalyses));

    alert(`✅ Analysis "${analysisName}" saved successfully!`);
}

// Copy analysis result
function copyAnalysisResult() {
    const content = document.getElementById('analysisResult').textContent;
    
    navigator.clipboard.writeText(content).then(() => {
        alert('✅ Analysis copied to clipboard!');
    }).catch(err => {
        alert('❌ Failed to copy: ' + err);
    });
}

// View past analyses
function viewPastAnalyses() {
    window.location.href = 'past-analyses.html';
}

// Start new analysis
function startNewAnalysis() {
    goToAnalyzeStep(1);
    resetAnalyzeMessagesForm();
}

// Event Listeners for Analyze Messages
const analyzeMessagesBtn = document.getElementById('analyzeMessagesBtn');
const analyzeMessagesClose = document.getElementById('analyzeMessagesClose');
const analyzeMessagesModal = document.getElementById('analyzeMessagesModal');

analyzeMessagesBtn.addEventListener('click', openAnalyzeMessages);
analyzeMessagesClose.addEventListener('click', closeAnalyzeMessages);
analyzeMessagesModal.addEventListener('click', (e) => {
    if (e.target === analyzeMessagesModal) closeAnalyzeMessages();
});

// Export analysis to PDF
function exportAnalysisToPDF() {
    if (!messageAnalysisData.currentAnalysis) {
        alert('⚠️ No analysis to export!');
        return;
    }
    
    // Create PDF content as text (simple implementation)
    const content = `MESSAGE ANALYSIS REPORT
Generated: ${new Date().toLocaleString()}

BEHAVIOR INSTRUCTIONS:
${messageAnalysisData.behaviorInstructions || 'None'}

ANALYSIS RESULT:
${messageAnalysisData.currentAnalysis}

---
Cost: $${messageAnalysisData.estimatedCost?.toFixed(4) || 'N/A'}
Tokens: ${messageAnalysisData.tokensUsed || 'N/A'}
`;
    
    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${Date.now()}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('✅ Analysis exported as TXT!\n\n(Full PDF export requires additional library)');
}

// Export analysis to Word format
function exportAnalysisToWord() {
    if (!messageAnalysisData.currentAnalysis) {
        alert('⚠️ No analysis to export!');
        return;
    }
    
    // Create DOC content (RTF format for compatibility)
    const rtfContent = `{\\rtf1\\ansi\\deff0
{\\fonttbl{\\f0\\froman\\fcharset0 Times New Roman;}}
{\\colortbl;\\red0\\green0\\blue0;\\red0\\green0\\blue255;}
\\f0\\fs24

{\\b\\fs32 MESSAGE ANALYSIS REPORT}\\par
\\par
{\\i Generated: ${new Date().toLocaleString()}}\\par
\\par
{\\b BEHAVIOR INSTRUCTIONS:}\\par
${messageAnalysisData.behaviorInstructions || 'None'}\\par
\\par
{\\b ANALYSIS RESULT:}\\par
${messageAnalysisData.currentAnalysis}\\par
\\par
{\\b ---}\\par
Cost: $${messageAnalysisData.estimatedCost?.toFixed(4) || 'N/A'}\\par
Tokens: ${messageAnalysisData.tokensUsed || 'N/A'}\\par
}`;
    
    // Create blob and download
    const blob = new Blob([rtfContent], { type: 'application/rtf' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analysis-${Date.now()}.rtf`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    alert('✅ Analysis exported as RTF!\n\n(Can be opened in Microsoft Word)');
}

// Make functions global for onclick
window.goToAnalyzeStep = goToAnalyzeStep;
window.showTextInput = showTextInput;
window.handlePhotoUpload = handlePhotoUpload;
window.handleFileUpload = handleFileUpload;
window.handleBehaviorFileUpload = handleBehaviorFileUpload;
window.removeUploadedFile = removeUploadedFile;
window.removeBehaviorFile = removeBehaviorFile;
window.loadBehaviorPreset = loadBehaviorPreset;
window.saveBehaviorPreset = saveBehaviorPreset;
window.startMessageAnalysis = startMessageAnalysis;
window.saveAnalysis = saveAnalysis;
window.copyAnalysisResult = copyAnalysisResult;
window.viewPastAnalyses = viewPastAnalyses;
window.startNewAnalysis = startNewAnalysis;
window.exportAnalysisToPDF = exportAnalysisToPDF;
window.exportAnalysisToWord = exportAnalysisToWord;
window.resetCostTracking = resetCostTracking;
