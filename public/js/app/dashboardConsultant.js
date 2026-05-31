// ===== SYSTEM STATUS =====
// The live clock is owned by shell.js (timezone-aware, updates on the minute).

// System status check (can be expanded later)
function checkSystemStatus() {
    const statusElement = document.getElementById('systemStatus');
    if (statusElement) {
        statusElement.textContent = 'Online';
    }
}

checkSystemStatus();

// ===== CONSULTANT FEATURE =====

// Consultant state
let consultantData = {
    sessionId: null,
    selectedModel: null,
    behaviorInstructions: '',
    conversationHistory: [],
    messageCount: 0,
    maxMessages: 20,
    currentPhotos: [],
    totalTokens: 0
};

// ===== SQLite-backed API helpers (resilient write-through to localStorage) =====
// Each helper tries the SQLite API first and transparently falls back to the
// existing localStorage data on any failure, so the feature never breaks
// whether or not the server has data yet.

// Read a list from an API endpoint, falling back to a localStorage key.
async function apiGetListWithFallback(endpoint, storageKey, listProp) {
    try {
        const response = await fetch(endpoint);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.success && Array.isArray(data[listProp])) {
            return data[listProp];
        }
        throw new Error('Unexpected API response');
    } catch (error) {
        console.warn(`⚠️ API read failed for ${endpoint}, using localStorage:`, error);
        return JSON.parse(localStorage.getItem(storageKey) || '[]');
    }
}

// Read a single record by id from an API endpoint, falling back to a
// localStorage lookup by id. Returns the record object or null.
async function apiGetByIdWithFallback(endpoint, storageKey, recordProp, id) {
    try {
        const response = await fetch(`${endpoint}/${id}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.success && data[recordProp]) {
            return data[recordProp];
        }
        throw new Error('Unexpected API response');
    } catch (error) {
        console.warn(`⚠️ API read failed for ${endpoint}/${id}, using localStorage:`, error);
        const list = JSON.parse(localStorage.getItem(storageKey) || '[]');
        return list.find(item => item.id === id) || null;
    }
}

// POST a record to the API. Returns the server-created object (with its
// numeric id/date) on success, or null on failure. The caller always keeps
// its existing localStorage write so the data is mirrored regardless.
async function apiPost(endpoint, payload, recordProp) {
    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (data && data.success && data[recordProp]) {
            return data[recordProp];
        }
        throw new Error('Unexpected API response');
    } catch (error) {
        console.warn(`⚠️ API write failed for ${endpoint}, kept localStorage only:`, error);
        return null;
    }
}

// DELETE a record from the API. The caller always keeps its existing
// localStorage write so the deletion is mirrored regardless of API result.
async function apiDelete(endpoint, id) {
    try {
        const response = await fetch(`${endpoint}/${id}`, { method: 'DELETE' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return true;
    } catch (error) {
        console.warn(`⚠️ API delete failed for ${endpoint}/${id}, kept localStorage only:`, error);
        return false;
    }
}

// Open Consultant Modal
function openConsultant() {
    document.getElementById('consultantModal').classList.add('active');
    goToConsultantStep(1);
    // Only clear behavior if opening for the first time (no behavior set)
    const hasBehavior = document.getElementById('consultantBehaviorInstructions').value.trim().length > 0;
    resetConsultantData(!hasBehavior);
}

// Close Consultant Modal
function closeConsultant() {
    // Check if there's an active session with messages
    if (consultantData.sessionId && consultantData.messageCount > 0) {
        endConsultantChat();
    } else {
        // Just close without confirmation if no messages sent
        document.getElementById('consultantModal').classList.remove('active');
        resetConsultantData();
    }
}

// Reset consultant data (but preserve behavior if it exists)
function resetConsultantData(clearBehavior = false) {
    const currentBehavior = document.getElementById('consultantBehaviorInstructions').value;
    
    consultantData = {
        sessionId: `session_${Date.now()}_${Math.random().toString(36).substring(7)}`,
        selectedModel: null,
        behaviorInstructions: clearBehavior ? '' : currentBehavior,
        conversationHistory: [],
        messageCount: 0,
        maxMessages: 20,
        currentPhotos: [],
        totalTokens: 0
    };
    
    // Only clear behavior input if explicitly requested
    if (clearBehavior) {
        document.getElementById('consultantBehaviorInstructions').value = '';
    }
    
    document.getElementById('consultantMessageInput').value = '';
    document.getElementById('consultantChatMessages').innerHTML = `
        <div style="text-align: center; color: var(--gray); padding: 40px 20px;">
            <svg width="64" height="64" viewBox="0 0 24 24" fill="currentColor" style="margin: 0 auto 16px; opacity: 0.5;">
                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
            </svg>
            <p style="font-size: 16px; margin: 0;">Start your consultation by sending a message below</p>
        </div>
    `;
    
    // Clear model selection
    document.querySelectorAll('.model-selection-card').forEach(card => {
        card.classList.remove('selected');
    });
}

// Navigate between consultant steps
function goToConsultantStep(step) {
    // Validation
    if (step === 2 && !consultantData.selectedModel) {
        document.getElementById('modelSelectionError').style.display = 'block';
        return;
    }
    
    if (step === 3) {
        const behavior = document.getElementById('consultantBehaviorInstructions').value.trim();
        if (!behavior) {
            alert('⚠️ Please provide behavior instructions for the AI consultant!');
            return;
        }
        consultantData.behaviorInstructions = behavior;
    }
    
    document.querySelectorAll('.consultant-step').forEach(el => el.classList.remove('active'));
    document.getElementById(`consultantStep${step}`).classList.add('active');
}

// Select consultant model
function selectConsultantModel(model) {
    consultantData.selectedModel = model;
    
    // Visual feedback
    document.querySelectorAll('.model-selection-card').forEach(card => {
        card.classList.remove('selected');
    });
    
    const selectedCard = document.querySelector(`.model-selection-card[data-model="${model}"]`);
    if (selectedCard) {
        selectedCard.classList.add('selected');
    }
    
    document.getElementById('modelSelectionError').style.display = 'none';
    
    console.log(`✅ Model selected: ${model}`);
}

// Load consultant preset
async function loadConsultantPreset() {
    // READ: try the SQLite API first, fall back to localStorage on any failure.
    const savedPresets = await apiGetListWithFallback('/api/presets/consultant', 'consultantPresets', 'presets');

    if (savedPresets.length === 0) {
        alert('⚠️ No saved consultant presets found!\n\nCreate and save a preset first.');
        return;
    }
    
    // Create modal
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';
    
    let presetsHTML = savedPresets.map((preset) => `
        <div onclick="selectConsultantPreset(${preset.id})" style="padding: 16px; background: linear-gradient(135deg, rgba(16, 185, 129, 0.1), rgba(59, 130, 246, 0.1)); border: 2px solid #10b981; border-radius: 12px; cursor: pointer; transition: all 0.2s; margin-bottom: 12px;" onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 16px rgba(0,0,0,0.2)';" onmouseout="this.style.transform=''; this.style.boxShadow='';">
            <div style="font-weight: 600; font-size: 16px; color: var(--dark); margin-bottom: 4px;">${preset.name}</div>
            <div style="font-size: 13px; color: var(--gray);">📅 ${new Date(preset.date).toLocaleDateString()}</div>
            <div style="font-size: 12px; color: var(--gray); margin-top: 8px; font-style: italic;">${preset.behavior.substring(0, 100)}...</div>
        </div>
    `).join('');
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 32px; max-width: 600px; width: 100%; max-height: 80vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <h3 style="margin: 0; color: var(--dark);">📦 Load Consultant Preset</h3>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 28px; color: var(--gray); cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;" onmouseover="this.style.background='var(--gray-light)'" onmouseout="this.style.background='none'">×</button>
            </div>
            <div>${presetsHTML}</div>
        </div>
    `;
    
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    
    // Make selectConsultantPreset function available
    window.selectConsultantPreset = (presetId) => {
        const preset = savedPresets.find(p => p.id === presetId);
        if (preset) {
            document.getElementById('consultantBehaviorInstructions').value = preset.behavior;
            modal.remove();
            alert(`✅ Loaded preset: "${preset.name}"`);
        }
    };
    
    document.body.appendChild(modal);
}

// Save consultant preset
async function saveConsultantPreset() {
    const behaviorText = document.getElementById('consultantBehaviorInstructions').value.trim();

    if (!behaviorText) {
        alert('⚠️ Please enter behavior instructions first!');
        return;
    }

    const presetName = prompt('Enter a name for this consultant preset:', 'My Consultant Behavior');
    if (!presetName) return;

    // WRITE: send to the SQLite API, then mirror to localStorage (write-through).
    const created = await apiPost('/api/presets/consultant', {
        name: presetName,
        behavior: behaviorText
    }, 'preset');

    const savedPresets = JSON.parse(localStorage.getItem('consultantPresets') || '[]');

    savedPresets.push({
        id: created && created.id != null ? created.id : Date.now(),
        name: presetName,
        behavior: behaviorText,
        date: created && created.date ? created.date : new Date().toISOString()
    });

    localStorage.setItem('consultantPresets', JSON.stringify(savedPresets));

    alert(`✅ Consultant preset "${presetName}" saved successfully!`);
}

// Handle consultant behavior file upload
function handleConsultantBehaviorUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
        try {
            const content = e.target.result;
            let behaviorText = '';
            
            if (file.name.endsWith('.json')) {
                const json = JSON.parse(content);
                behaviorText = json.behavior || json.instructions || JSON.stringify(json, null, 2);
            } else {
                behaviorText = content;
            }
            
            document.getElementById('consultantBehaviorInstructions').value = behaviorText;
            document.getElementById('consultantBehaviorFilesDisplay').style.display = 'block';
            document.getElementById('consultantBehaviorFileName').textContent = `📄 ${file.name}`;
            
            alert(`✅ Loaded behavior from ${file.name}!`);
        } catch (error) {
            alert(`❌ Error loading file: ${error.message}`);
        }
    };
    reader.readAsText(file);
}

// Start consultant chat
function startConsultantChat() {
    // Validate behavior instructions
    const behavior = document.getElementById('consultantBehaviorInstructions').value.trim();
    if (!behavior) {
        alert('⚠️ Please configure the AI behavior before starting the chat!');
        goToConsultantStep(2);
        return;
    }
    
    consultantData.behaviorInstructions = behavior;
    
    // Update display
    document.getElementById('consultantSelectedModel').textContent = consultantData.selectedModel;
    document.getElementById('consultantMessageCount').textContent = `${consultantData.messageCount} / ${consultantData.maxMessages}`;
    
    goToConsultantStep(4);
    
    console.log(`🤖 Consultant chat started - Session: ${consultantData.sessionId}, Model: ${consultantData.selectedModel}`);
}

// Handle consultant photo upload
function handleConsultantPhotoUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;
    
    // Check if model supports vision
    const visionModels = (window.FATHOM && window.FATHOM.models.map(function (m) { return m.id; })) || ['gpt-4o', 'gpt-4o-mini'];
    if (!visionModels.includes(consultantData.selectedModel)) {
        alert(`⚠️ The selected model (${consultantData.selectedModel}) does not support image analysis.\n\nPlease use GPT-4o or GPT-4o-mini for photo uploads.`);
        return;
    }
    
    // Check photo limit
    if (consultantData.currentPhotos.length + files.length > 5) {
        alert('⚠️ Maximum 5 photos per message!');
        return;
    }
    
    console.log(`📸 Uploading ${files.length} photos for consultant chat`);
    
    files.forEach(file => {
        if (file.size > 10 * 1024 * 1024) {
            alert(`⚠️ ${file.name} is too large (max 10MB)`);
            return;
        }
        
        const reader = new FileReader();
        reader.onload = (e) => {
            consultantData.currentPhotos.push({
                name: file.name,
                data: e.target.result,
                size: file.size
            });
            displayConsultantPhotos();
        };
        reader.readAsDataURL(file);
    });
}

// Display consultant photos
function displayConsultantPhotos() {
    const preview = document.getElementById('consultantPhotosPreview');
    const grid = document.getElementById('consultantPhotosGrid');
    
    if (consultantData.currentPhotos.length === 0) {
        preview.style.display = 'none';
        return;
    }
    
    preview.style.display = 'block';
    grid.innerHTML = '';
    
    consultantData.currentPhotos.forEach((photo, index) => {
        const div = document.createElement('div');
        div.style.cssText = 'position: relative; width: 80px; height: 80px; border-radius: 8px; overflow: hidden; border: 2px solid #10b981;';
        div.innerHTML = `
            <img src="${photo.data}" style="width: 100%; height: 100%; object-fit: cover;">
            <button onclick="removeConsultantPhoto(${index})" style="position: absolute; top: 2px; right: 2px; background: #ef4444; color: white; border: none; border-radius: 50%; width: 20px; height: 20px; cursor: pointer; font-size: 12px; display: flex; align-items: center; justify-content: center;">×</button>
        `;
        grid.appendChild(div);
    });
}

// Remove consultant photo
function removeConsultantPhoto(index) {
    consultantData.currentPhotos.splice(index, 1);
    displayConsultantPhotos();
}

// Clear consultant input
function clearConsultantInput() {
    document.getElementById('consultantMessageInput').value = '';
    consultantData.currentPhotos = [];
    displayConsultantPhotos();
}

// Send consultant message
async function sendConsultantMessage() {
    const messageInput = document.getElementById('consultantMessageInput');
    const message = messageInput.value.trim();
    
    if (!message && consultantData.currentPhotos.length === 0) {
        alert('⚠️ Please enter a message or upload photos!');
        return;
    }
    
    // Check message limit
    if (consultantData.messageCount >= consultantData.maxMessages) {
        alert(`⚠️ Maximum ${consultantData.maxMessages} messages reached!\n\nPlease end this session and start a new one.`);
        return;
    }
    
    // Disable send button
    const sendBtn = document.getElementById('consultantSendBtn');
    sendBtn.disabled = true;
    sendBtn.textContent = 'Sending...';
    
    try {
        // Add user message to chat
        addConsultantMessage('user', message, consultantData.currentPhotos);
        
        // Show loading
        document.getElementById('consultantLoadingIndicator').style.display = 'block';
        
        // Prepare conversation history for API
        const apiConversationHistory = [];
        consultantData.conversationHistory.forEach(msg => {
            if (msg.role === 'user') {
                // For user messages, just send text (photos are sent in current message only)
                apiConversationHistory.push({
                    role: 'user',
                    content: msg.text
                });
            } else {
                apiConversationHistory.push({
                    role: 'assistant',
                    content: msg.text
                });
            }
        });
        
        // Call API
        const response = await fetch('/api/consultant-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: consultantData.sessionId,
                message: message,
                photos: consultantData.currentPhotos,
                model: consultantData.selectedModel,
                behaviorInstructions: consultantData.behaviorInstructions,
                conversationHistory: apiConversationHistory
            })
        });
        
        const data = await response.json();
        
        if (!data.success) {
            throw new Error(data.error || 'Failed to get response from consultant');
        }
        
        // Add AI response to chat
        addConsultantMessage('assistant', data.reply);
        
        // Update stats
        consultantData.messageCount = data.messageCount;
        consultantData.totalTokens = data.sessionStats.totalTokens;
        document.getElementById('consultantMessageCount').textContent = `${consultantData.messageCount} / ${consultantData.maxMessages}`;
        
        console.log(`✅ Consultant response received - Tokens: ${data.tokensUsed}, Total messages: ${consultantData.messageCount}`);
        
        // Clear input
        messageInput.value = '';
        consultantData.currentPhotos = [];
        displayConsultantPhotos();
        
    } catch (error) {
        console.error('Error sending consultant message:', error);
        alert(`❌ Error: ${error.message}`);
    } finally {
        // Hide loading
        document.getElementById('consultantLoadingIndicator').style.display = 'none';
        
        // Re-enable send button
        sendBtn.disabled = false;
        sendBtn.innerHTML = `
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
            </svg>
            Send Message
        `;
    }
}

// Add message to chat
function addConsultantMessage(role, text, photos = []) {
    const chatContainer = document.getElementById('consultantChatMessages');
    
    // Clear placeholder if this is the first message
    if (consultantData.conversationHistory.length === 0) {
        chatContainer.innerHTML = '';
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = `consultant-message ${role}`;
    
    let messageContent = `
        <div class="consultant-message-bubble">
            ${text.replace(/\n/g, '<br>')}
        </div>
    `;
    
    // Add photos if present (only for user messages)
    if (role === 'user' && photos && photos.length > 0) {
        photos.forEach(photo => {
            messageContent += `
                <div style="margin-top: 8px; text-align: ${role === 'user' ? 'right' : 'left'};">
                    <img src="${photo.data}" class="consultant-message-image" style="max-width: 200px; border-radius: 12px;" onclick="enlargeImage('${photo.data}')">
                </div>
            `;
        });
    }
    
    messageDiv.innerHTML = messageContent;
    chatContainer.appendChild(messageDiv);
    
    // Scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    // Add to conversation history
    consultantData.conversationHistory.push({
        role: role,
        text: text,
        photos: photos,
        timestamp: new Date()
    });
}

// Enlarge image
function enlargeImage(imageSrc) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.9); display: flex; align-items: center; justify-content: center; z-index: 10000; padding: 20px;';
    modal.innerHTML = `
        <div style="position: relative; max-width: 90%; max-height: 90%;">
            <img src="${imageSrc}" style="max-width: 100%; max-height: 90vh; border-radius: 12px;">
            <button onclick="this.parentElement.parentElement.remove()" style="position: absolute; top: 10px; right: 10px; background: white; color: #ef4444; border: none; border-radius: 50%; width: 40px; height: 40px; cursor: pointer; font-size: 20px; font-weight: 700;">×</button>
        </div>
    `;
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

// End consultant chat
async function endConsultantChat() {
    const confirmEnd = confirm(`🔚 End Consultation Session?\n\nMessages: ${consultantData.messageCount}\nTokens used: ${consultantData.totalTokens}\n\nAre you sure you want to end this session?`);
    
    if (!confirmEnd) return;
    
    const messageCount = consultantData.messageCount;
    const totalTokens = consultantData.totalTokens;
    
    try {
        // Call API to end session
        await fetch('/api/consultant-chat/end-session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                sessionId: consultantData.sessionId
            })
        });
        
        console.log(`✅ Consultant session ended - Total messages: ${messageCount}, Total tokens: ${totalTokens}`);
        
        // Close modal and reset WITHOUT triggering another endConsultantChat call
        document.getElementById('consultantModal').classList.remove('active');
        resetConsultantData();
        
        alert(`✅ Session ended!\n\nMessages sent: ${messageCount}\nTotal tokens: ${totalTokens}`);
        
    } catch (error) {
        console.error('Error ending session:', error);
        // Close modal and reset WITHOUT triggering another endConsultantChat call
        document.getElementById('consultantModal').classList.remove('active');
        resetConsultantData();
    }
}

// ===== FATHOM CONFIG INJECTION (model lineup + prompt templates) =====
// Pulls the shared model list and prompt-template library from window.FATHOM
// (public/js/config.js) into the existing consultant UI. Injects once and only
// when FATHOM is present, leaving all existing chat behavior/IDs/logic intact.
function injectFathomConsultantConfig() {
    if (!window.FATHOM) return;

    // --- Task 1: prompt-template <select> beside the behavior field ---
    const behaviorField = document.getElementById('consultantBehaviorInstructions');
    if (behaviorField && !document.getElementById('consultantTemplateSelect')) {
        const templateSelect = document.createElement('select');
        templateSelect.id = 'consultantTemplateSelect';
        templateSelect.className = 'form-input';
        templateSelect.style.marginBottom = '16px';
        templateSelect.innerHTML = window.FATHOM.templateOptions('consultant');
        templateSelect.addEventListener('change', function () {
            if (this.value === '') return;
            const tpl = window.FATHOM.promptTemplates.consultant[Number(this.value)];
            if (tpl) behaviorField.value = tpl.prompt;
        });
        behaviorField.parentNode.insertBefore(templateSelect, behaviorField);
    }

    // --- Task 2: rebuild the model-selection cards from window.FATHOM.models ---
    // The existing UI uses .model-selection-card divs with data-model + an
    // onclick to selectConsultantModel(). We regenerate that same grid (single
    // control, no duplicate) so the newer models from config appear.
    const grid = document.getElementById('consultantModelGrid');
    if (grid && !grid.dataset.fathomModels) {
        grid.dataset.fathomModels = 'true';
        grid.innerHTML = window.FATHOM.models.map(function (m) {
            const isDefault = m.id === window.FATHOM.defaultModel;
            return `
                <div class="model-selection-card" data-model="${m.id}" onclick="selectConsultantModel('${m.id}')" style="border: 1px solid var(--hairline-2); border-radius: 11px; padding: 20px; cursor: pointer; transition: all 0.2s;">
                    <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 10px;">
                        <h4 style="margin: 0; color: var(--text-hi); font-size: 16px;">${m.label}</h4>
                        ${isDefault ? '<span class="status run" style="font-size:10px">DEFAULT</span>' : ''}
                    </div>
                    <div style="font-family: var(--mono); font-size: 11px; color: var(--text-low);">${m.id}</div>
                </div>
            `;
        }).join('');
    }
}

injectFathomConsultantConfig();

// Event Listeners for Consultant
const consultantBtn = document.getElementById('consultantBtn');
const consultantClose = document.getElementById('consultantClose');
const consultantModal = document.getElementById('consultantModal');

consultantBtn.addEventListener('click', openConsultant);
consultantClose.addEventListener('click', closeConsultant);
consultantModal.addEventListener('click', (e) => {
    if (e.target === consultantModal) closeConsultant();
});

// Allow Enter key to send message (Shift+Enter for new line)
document.getElementById('consultantMessageInput').addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendConsultantMessage();
    }
});

console.log('🤖 Consultant feature initialized');

// ===== SAVED CHATS FEATURE =====

// Save current chat
async function saveCurrentChat() {
    if (consultantData.conversationHistory.length === 0) {
        alert('⚠️ No messages to save!\n\nStart a conversation before saving.');
        return;
    }

    const chatName = prompt('Enter a name for this chat:', `Consultant Chat - ${new Date().toLocaleDateString()}`);
    if (!chatName) return;

    // WRITE: send to the SQLite API, then mirror to localStorage (write-through).
    const created = await apiPost('/api/chats', {
        name: chatName,
        model: consultantData.selectedModel,
        behaviorInstructions: consultantData.behaviorInstructions,
        conversationHistory: consultantData.conversationHistory,
        messageCount: consultantData.messageCount,
        totalTokens: consultantData.totalTokens
    }, 'chat');

    const savedChats = JSON.parse(localStorage.getItem('consultantSavedChats') || '[]');

    const chatData = {
        id: created && created.id != null ? created.id : Date.now(),
        name: chatName,
        model: consultantData.selectedModel,
        behaviorInstructions: consultantData.behaviorInstructions,
        conversationHistory: consultantData.conversationHistory,
        messageCount: consultantData.messageCount,
        totalTokens: consultantData.totalTokens,
        date: created && created.date ? created.date : new Date().toISOString()
    };

    savedChats.unshift(chatData); // Add to beginning
    localStorage.setItem('consultantSavedChats', JSON.stringify(savedChats));

    console.log(`✅ Chat saved: ${chatName}`);
    alert(`✅ Chat saved successfully!\n\n"${chatName}"\n\nMessages: ${consultantData.messageCount}\nTokens: ${consultantData.totalTokens}`);
}

// Open saved chats modal
async function openSavedChats() {
    document.getElementById('savedChatsModal').classList.add('active');
    await displaySavedChats();
}

// Close saved chats modal
function closeSavedChats() {
    document.getElementById('savedChatsModal').classList.remove('active');
}

// Display saved chats
async function displaySavedChats() {
    // READ: try the SQLite API first, fall back to localStorage on any failure.
    const savedChats = await apiGetListWithFallback('/api/chats', 'consultantSavedChats', 'chats');
    const chatsList = document.getElementById('savedChatsList');
    const noChatsMessage = document.getElementById('noSavedChatsMessage');

    if (savedChats.length === 0) {
        chatsList.style.display = 'none';
        noChatsMessage.style.display = 'block';
        return;
    }
    
    chatsList.style.display = 'grid';
    noChatsMessage.style.display = 'none';
    chatsList.innerHTML = '';
    
    savedChats.forEach((chat, index) => {
        const chatCard = document.createElement('div');
        chatCard.style.cssText = 'background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05)); border: 2px solid #10b981; border-radius: 16px; padding: 24px; transition: all 0.3s;';
        
        const history = Array.isArray(chat.conversationHistory) ? chat.conversationHistory : [];
        const firstUserMessage = history.find(msg => msg.role === 'user');
        const preview = firstUserMessage ? firstUserMessage.text.substring(0, 150) : 'No messages';
        
        chatCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
                <div style="flex: 1;">
                    <h3 style="margin: 0 0 8px 0; color: var(--dark); font-size: 18px; display: flex; align-items: center; gap: 8px;">
                        💬 ${chat.name}
                    </h3>
                    <div style="display: flex; gap: 16px; flex-wrap: wrap; margin-bottom: 12px;">
                        <span style="font-size: 13px; color: var(--gray);">
                            <strong>Model:</strong> ${chat.model}
                        </span>
                        <span style="font-size: 13px; color: var(--gray);">
                            <strong>Messages:</strong> ${chat.messageCount}
                        </span>
                        <span style="font-size: 13px; color: var(--gray);">
                            <strong>Tokens:</strong> ${chat.totalTokens}
                        </span>
                        <span style="font-size: 13px; color: var(--gray);">
                            <strong>Date:</strong> ${new Date(chat.date).toLocaleString()}
                        </span>
                    </div>
                    <p style="margin: 0; font-size: 13px; color: var(--gray); font-style: italic; line-height: 1.6;">
                        "${preview}${preview.length >= 150 ? '...' : ''}"
                    </p>
                </div>
            </div>
            
            <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                <button onclick="viewSavedChat(${chat.id})" style="padding: 8px 16px; background: linear-gradient(135deg, #10b981, #3b82f6); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                        <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                    </svg>
                    View Full Chat
                </button>
                <button onclick="loadSavedChat(${chat.id})" style="padding: 8px 16px; background: white; color: #10b981; border: 2px solid #10b981; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                    Load to Consultant
                </button>
                <button onclick="exportSavedChat(${chat.id})" style="padding: 8px 16px; background: white; color: #3b82f6; border: 2px solid #3b82f6; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M3 17a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm3.293-7.707a1 1 0 011.414 0L9 10.586V3a1 1 0 112 0v7.586l1.293-1.293a1 1 0 111.414 1.414l-3 3a1 1 0 01-1.414 0l-3-3a1 1 0 010-1.414z" clip-rule="evenodd"/>
                    </svg>
                    Export TXT
                </button>
                <button onclick="deleteSavedChat(${chat.id})" style="padding: 8px 16px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 6px;">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                    </svg>
                    Delete
                </button>
            </div>
        `;
        
        chatsList.appendChild(chatCard);
    });
}

// View saved chat in detail
async function viewSavedChat(chatId) {
    // READ: try the SQLite API first (full record incl. conversationHistory),
    // fall back to localStorage lookup by id.
    const chat = await apiGetByIdWithFallback('/api/chats', 'consultantSavedChats', 'chat', chatId);

    if (!chat) {
        alert('❌ Chat not found!');
        return;
    }

    // Create modal to display full chat
    const modal = document.createElement('div');
    modal.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; z-index: 10001; padding: 20px;';
    
    let messagesHTML = '';
    (chat.conversationHistory || []).forEach(msg => {
        const isUser = msg.role === 'user';
        const bubbleStyle = isUser
            ? 'background: linear-gradient(135deg, #10b981, #3b82f6); color: white; margin-left: auto;'
            : 'background: linear-gradient(135deg, #f1f5f9, #e2e8f0); color: var(--dark); margin-right: auto;';
        
        messagesHTML += `
            <div style="margin-bottom: 16px; text-align: ${isUser ? 'right' : 'left'};">
                <div style="display: inline-block; max-width: 80%; padding: 12px 16px; border-radius: 16px; ${bubbleStyle} ${isUser ? 'border-bottom-right-radius: 4px;' : 'border-bottom-left-radius: 4px;'}">
                    ${msg.text.replace(/\n/g, '<br>')}
                </div>
                ${msg.photos && msg.photos.length > 0 ? msg.photos.map(photo => `
                    <div style="margin-top: 8px;">
                        <img src="${photo.data}" style="max-width: 200px; border-radius: 12px; cursor: pointer;" onclick="enlargeImage('${photo.data}')">
                    </div>
                `).join('') : ''}
            </div>
        `;
    });
    
    modal.innerHTML = `
        <div style="background: white; border-radius: 20px; padding: 32px; max-width: 900px; width: 100%; max-height: 85vh; overflow-y: auto;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
                <div>
                    <h2 style="margin: 0 0 8px 0; color: var(--dark);">💬 ${chat.name}</h2>
                    <div style="display: flex; gap: 16px; flex-wrap: wrap;">
                        <span style="font-size: 13px; color: var(--gray);"><strong>Model:</strong> ${chat.model}</span>
                        <span style="font-size: 13px; color: var(--gray);"><strong>Messages:</strong> ${chat.messageCount}</span>
                        <span style="font-size: 13px; color: var(--gray);"><strong>Tokens:</strong> ${chat.totalTokens}</span>
                    </div>
                </div>
                <button onclick="this.parentElement.parentElement.parentElement.remove()" style="background: none; border: none; font-size: 28px; color: var(--gray); cursor: pointer; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%; transition: all 0.2s;" onmouseover="this.style.background='var(--gray-light)'" onmouseout="this.style.background='none'">×</button>
            </div>
            
            <div style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.05), rgba(59, 130, 246, 0.05)); border: 2px solid #10b981; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
                <strong style="color: var(--dark); font-size: 14px;">AI Behavior:</strong>
                <p style="margin: 8px 0 0 0; font-size: 13px; color: var(--gray); line-height: 1.6; white-space: pre-wrap;">${chat.behaviorInstructions}</p>
            </div>
            
            <div style="background: white; border: 2px solid #10b981; border-radius: 12px; padding: 20px; max-height: 500px; overflow-y: auto;">
                ${messagesHTML}
            </div>
        </div>
    `;
    
    modal.onclick = (e) => { if (e.target === modal) modal.remove(); };
    document.body.appendChild(modal);
}

// Load saved chat to consultant
async function loadSavedChat(chatId) {
    // READ: try the SQLite API first (full record incl. conversationHistory),
    // fall back to localStorage lookup by id.
    const chat = await apiGetByIdWithFallback('/api/chats', 'consultantSavedChats', 'chat', chatId);

    if (!chat) {
        alert('❌ Chat not found!');
        return;
    }

    const confirmLoad = confirm(`📥 Load this chat to consultant?\n\n"${chat.name}"\n\nThis will:\n- Set the model to ${chat.model}\n- Load the behavior instructions\n- Restore all ${chat.messageCount} messages\n\nCurrent chat will be replaced!`);
    
    if (!confirmLoad) return;
    
    // Close saved chats modal
    closeSavedChats();
    
    // Open consultant modal
    openConsultant();
    
    // Set model
    consultantData.selectedModel = chat.model;
    selectConsultantModel(chat.model);
    
    // Set behavior
    document.getElementById('consultantBehaviorInstructions').value = chat.behaviorInstructions;
    consultantData.behaviorInstructions = chat.behaviorInstructions;
    
    // Go to chat step
    goToConsultantStep(4);
    
    // Restore conversation
    consultantData.conversationHistory = chat.conversationHistory || [];
    consultantData.messageCount = chat.messageCount;
    consultantData.totalTokens = chat.totalTokens;

    // Display messages
    const chatContainer = document.getElementById('consultantChatMessages');
    chatContainer.innerHTML = '';

    (chat.conversationHistory || []).forEach(msg => {
        const messageDiv = document.createElement('div');
        messageDiv.className = `consultant-message ${msg.role}`;
        
        let messageContent = `
            <div class="consultant-message-bubble">
                ${msg.text.replace(/\n/g, '<br>')}
            </div>
        `;
        
        if (msg.role === 'user' && msg.photos && msg.photos.length > 0) {
            msg.photos.forEach(photo => {
                messageContent += `
                    <div style="margin-top: 8px; text-align: ${msg.role === 'user' ? 'right' : 'left'};">
                        <img src="${photo.data}" class="consultant-message-image" style="max-width: 200px; border-radius: 12px;" onclick="enlargeImage('${photo.data}')">
                    </div>
                `;
            });
        }
        
        messageDiv.innerHTML = messageContent;
        chatContainer.appendChild(messageDiv);
    });
    
    // Update display
    document.getElementById('consultantSelectedModel').textContent = chat.model;
    document.getElementById('consultantMessageCount').textContent = `${chat.messageCount} / 20`;
    
    chatContainer.scrollTop = chatContainer.scrollHeight;
    
    alert(`✅ Chat loaded successfully!\n\n"${chat.name}"\n\nYou can continue the conversation from where you left off.`);
}

// Export saved chat
async function exportSavedChat(chatId) {
    // READ: try the SQLite API first (full record incl. conversationHistory),
    // fall back to localStorage lookup by id.
    const chat = await apiGetByIdWithFallback('/api/chats', 'consultantSavedChats', 'chat', chatId);

    if (!chat) {
        alert('❌ Chat not found!');
        return;
    }

    let content = `CONSULTANT CHAT EXPORT
=====================

Chat Name: ${chat.name}
Model: ${chat.model}
Date: ${new Date(chat.date).toLocaleString()}
Messages: ${chat.messageCount}
Total Tokens: ${chat.totalTokens}

AI BEHAVIOR:
${chat.behaviorInstructions}

CONVERSATION:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
    
    (chat.conversationHistory || []).forEach((msg, index) => {
        const role = msg.role === 'user' ? 'YOU' : 'AI CONSULTANT';
        content += `[${role}]:\n${msg.text}\n\n`;
        
        if (msg.photos && msg.photos.length > 0) {
            content += `[${msg.photos.length} photo(s) attached]\n\n`;
        }
        
        content += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
    });
    
    // Download as TXT file
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${chat.name.replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    console.log(`✅ Chat exported: ${chat.name}`);
}

// Delete saved chat
async function deleteSavedChat(chatId) {
    const savedChats = JSON.parse(localStorage.getItem('consultantSavedChats') || '[]');
    let chat = savedChats.find(c => c.id === chatId);

    // If not in the localStorage mirror, resolve the name from the API for the prompt.
    if (!chat) {
        chat = await apiGetByIdWithFallback('/api/chats', 'consultantSavedChats', 'chat', chatId);
    }

    if (!chat) {
        alert('❌ Chat not found!');
        return;
    }

    const confirmDelete = confirm(`🗑️ Delete this chat?\n\n"${chat.name}"\n\nThis action cannot be undone!`);

    if (!confirmDelete) return;

    // WRITE: delete on the SQLite API, then mirror the deletion to localStorage (write-through).
    await apiDelete('/api/chats', chatId);

    const updatedChats = savedChats.filter(c => c.id !== chatId);
    localStorage.setItem('consultantSavedChats', JSON.stringify(updatedChats));

    await displaySavedChats();

    console.log(`✅ Chat deleted: ${chat.name}`);
}

// Event listeners for saved chats
const savedChatsBtn = document.getElementById('savedChatsBtn');
const savedChatsClose = document.getElementById('savedChatsClose');
const savedChatsModal = document.getElementById('savedChatsModal');

savedChatsBtn.addEventListener('click', openSavedChats);
savedChatsClose.addEventListener('click', closeSavedChats);
savedChatsModal.addEventListener('click', (e) => {
    if (e.target === savedChatsModal) closeSavedChats();
});

console.log('💾 Saved Chats feature initialized');
