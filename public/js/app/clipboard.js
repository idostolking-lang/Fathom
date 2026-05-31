// ===== CLIPBOARD MANAGER FEATURE =====

// Open Clipboard Manager
function openClipboardManager() {
    clipboardModal.classList.add('active');
    loadClipboardMessages();
}

// Close Clipboard Manager
function closeClipboardManager() {
    clipboardModal.classList.remove('active');
}

// Load clipboard messages
function loadClipboardMessages() {
    const savedMessages = JSON.parse(localStorage.getItem('clipboardMessages') || '[]');

    // Render the current localStorage view synchronously...
    renderClipboardMessages(savedMessages);

    // ...then hydrate from the SQLite-backed API in the background and re-render.
    // localStorage stays the sync source so index-based copy/delete keep working.
    hydrateClipboardMessages();
}

// Render clipboard messages into the DOM from the given array.
function renderClipboardMessages(savedMessages) {
    const container = document.getElementById('clipboardList');
    const noMessagesDiv = document.getElementById('noClipboardMessages');
    const countSpan = document.getElementById('clipboardCount');

    container.innerHTML = '';
    countSpan.textContent = savedMessages.length;

    if (savedMessages.length === 0) {
        noMessagesDiv.style.display = 'block';
        container.style.display = 'none';
        return;
    }

    noMessagesDiv.style.display = 'none';
    container.style.display = 'flex';

    savedMessages.forEach((msg, index) => {
        const card = document.createElement('div');
        card.style.cssText = 'background: var(--gray-light); padding: 16px; border-radius: 12px; border: 2px solid var(--gray-border);';
        
        const preview = msg.content.substring(0, 120) + (msg.content.length > 120 ? '...' : '');
        const date = new Date(msg.date).toLocaleDateString('he-IL');
        
        card.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: start; gap: 12px;">
                <div style="flex: 1;">
                    <div style="font-size: 13px; color: var(--gray); margin-bottom: 8px;">
                        📅 ${date} • ${msg.content.length} characters
                    </div>
                    <div style="font-size: 14px; color: var(--dark); line-height: 1.6; white-space: pre-wrap;">
                        ${preview}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; flex-shrink: 0;">
                    <button onclick="copyClipboardMessage(${index})" style="padding: 8px 12px; background: var(--primary); color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 4px;">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z"/>
                            <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z"/>
                        </svg>
                        Copy
                    </button>
                    <button onclick="deleteClipboardMessage(${index})" style="padding: 8px 12px; background: #ef4444; color: white; border: none; border-radius: 8px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 4px;">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                        </svg>
                        Delete
                    </button>
                </div>
            </div>
        `;
        
        container.appendChild(card);
    });
}

// Hydrate clipboard messages from the SQLite-backed API (read-through with
// localStorage fallback). On success we mirror the server's rows (including
// their numeric ids) into localStorage so index-based copy/delete operate on
// the same ids the server uses, then re-render.
async function hydrateClipboardMessages() {
    try {
        const res = await fetch('/api/clipboard');
        if (!res.ok) return;
        const json = await res.json();
        if (!json || !json.success || !Array.isArray(json.messages)) return;

        const messages = json.messages.map(m => ({
            id: m.id,
            content: m.content,
            date: m.date
        }));

        localStorage.setItem('clipboardMessages', JSON.stringify(messages));
        renderClipboardMessages(messages);
    } catch (err) {
        // API unavailable - keep the existing localStorage-rendered view.
    }
}

// Add message to clipboard
function addMessageToClipboard() {
    const textarea = document.getElementById('newClipboardMessage');
    const message = textarea.value.trim();
    
    if (!message) {
        alert('⚠️ Please enter a message first!');
        return;
    }
    
    saveMessageToClipboard(message);
    textarea.value = '';
}

// Save message to clipboard storage
function saveMessageToClipboard(message) {
    const savedMessages = JSON.parse(localStorage.getItem('clipboardMessages') || '[]');

    savedMessages.unshift({
        id: Date.now(),
        content: message,
        date: new Date().toISOString()
    });

    // Write-through mirror: keep the existing localStorage write...
    localStorage.setItem('clipboardMessages', JSON.stringify(savedMessages));

    // ...and persist to the SQLite-backed API. Re-render from the server
    // response so localStorage/ids stay in sync; fall back to local view.
    fetch('/api/clipboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: message })
    }).then(res => (res.ok ? res.json() : null)).then(json => {
        if (json && json.success) {
            hydrateClipboardMessages();
        }
    }).catch(() => {});

    alert('✅ Message saved to clipboard!');
    loadClipboardMessages();
}

// Copy clipboard message
function copyClipboardMessage(index) {
    const savedMessages = JSON.parse(localStorage.getItem('clipboardMessages') || '[]');
    const message = savedMessages[index];
    
    if (!message) return;
    
    navigator.clipboard.writeText(message.content).then(() => {
        alert('✅ Copied to clipboard!');
    }).catch(err => {
        alert('❌ Failed to copy: ' + err);
    });
}

// Delete clipboard message
function deleteClipboardMessage(index) {
    if (!confirm('Are you sure you want to delete this message?')) return;

    const savedMessages = JSON.parse(localStorage.getItem('clipboardMessages') || '[]');
    const removed = savedMessages[index];
    savedMessages.splice(index, 1);

    // Write-through mirror: keep the existing localStorage write...
    localStorage.setItem('clipboardMessages', JSON.stringify(savedMessages));

    // ...and delete from the SQLite-backed API by id (best-effort).
    if (removed && removed.id != null) {
        fetch('/api/clipboard/' + encodeURIComponent(removed.id), {
            method: 'DELETE'
        }).catch(() => {});
    }

    loadClipboardMessages();
}

// Event Listeners for Clipboard Manager
clipboardManagerBtn.addEventListener('click', openClipboardManager);
clipboardClose.addEventListener('click', closeClipboardManager);
clipboardModal.addEventListener('click', (e) => {
    if (e.target === clipboardModal) closeClipboardManager();
});

document.getElementById('addToClipboard').addEventListener('click', addMessageToClipboard);

// Make functions global for onclick
window.copyClipboardMessage = copyClipboardMessage;
window.deleteClipboardMessage = deleteClipboardMessage;
