// ===== BACKGROUND TASKS UI MANAGER =====

class BackgroundTasksUI {
    constructor() {
        this.tasks = new Map();
        this.updateInterval = null;
        this.isMinimized = false;
        this.completedTasks = new Set(); // Track completed tasks to show notifications
        this.init();
    }

    init() {
        this.createPopup();
        this.startPolling();
        this.requestNotificationPermission();
    }

    requestNotificationPermission() {
        // Request notification permission if supported and not already granted
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission().then(permission => {
                console.log(`Notification permission: ${permission}`);
            });
        }
    }

    createPopup() {
        // Create popup HTML
        const popup = document.createElement('div');
        popup.id = 'backgroundTasksPopup';
        popup.className = 'background-tasks-popup';
        popup.innerHTML = `
            <div class="bg-tasks-header">
                <div class="bg-tasks-title">
                    <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
                    </svg>
                    <span>Background Tasks</span>
                    <span class="bg-tasks-count">0</span>
                </div>
                <div class="bg-tasks-controls">
                    <button class="bg-task-btn" onclick="backgroundTasksUI.toggleMinimize()" title="Minimize">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 10a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                    <button class="bg-task-btn" onclick="backgroundTasksUI.hide()" title="Hide">
                        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
                            <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="bg-tasks-body">
                <div id="bgTasksList" class="bg-tasks-list"></div>
                <div id="bgTasksEmpty" class="bg-tasks-empty">
                    <svg width="48" height="48" viewBox="0 0 20 20" fill="currentColor" style="opacity: 0.3;">
                        <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                        <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                    </svg>
                    <p>No background tasks</p>
                </div>
            </div>
        `;
        
        document.body.appendChild(popup);
        this.popup = popup;
        this.hide(); // Hidden by default
        
        // Create detailed task modal
        this.createDetailedModal();
    }

    createDetailedModal() {
        const modal = document.createElement('div');
        modal.id = 'taskDetailsModal';
        modal.className = 'task-details-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: oklch(0.1 0.01 95 / 0.7);
            display: none;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            backdrop-filter: blur(4px);
        `;
        
        modal.innerHTML = `
            <div style="background: var(--surface-1); border-radius: 24px; max-width: 800px; width: 90%; max-height: 90vh; overflow: auto; box-shadow: 0 20px 60px oklch(0.1 0.01 95 / 0.6);">
                <div style="padding: 32px; border-bottom: 1px solid var(--hairline);">
                    <div style="display: flex; justify-content: space-between; align-items: start;">
                        <div style="flex: 1;">
                            <h2 id="taskModalTitle" style="font-size: 24px; font-weight: 800; color: var(--text-hi); margin-bottom: 8px;">Task Details</h2>
                            <p id="taskModalStatus" style="font-size: 14px; color: var(--text-mid);"></p>
                        </div>
                        <button onclick="backgroundTasksUI.closeDetailedModal()" style="background: none; border: none; cursor: pointer; padding: 8px; border-radius: 8px; transition: all 0.2s;">
                            <svg width="24" height="24" viewBox="0 0 20 20" fill="var(--text-mid)">
                                <path fill-rule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                    </div>
                </div>
                
                <div style="padding: 32px;">
                    <div id="taskModalContent"></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        this.detailedModal = modal;
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                this.closeDetailedModal();
            }
        });
    }

    closeDetailedModal() {
        if (this.detailedModal) {
            this.detailedModal.style.display = 'none';
        }
    }

    show() {
        this.popup.classList.add('show');
        // Immediately fetch tasks when showing
        this.fetchTasks();
    }

    hide() {
        this.popup.classList.remove('show');
    }

    toggleMinimize() {
        this.isMinimized = !this.isMinimized;
        this.popup.classList.toggle('minimized', this.isMinimized);
    }

    async fetchTasks() {
        try {
            // Fetch ALL tasks, not just active ones (includes completed)
            const response = await fetch('/api/tasks');
            const data = await response.json();
            
            if (data.success && Array.isArray(data.tasks)) {
                this.updateTasksList(data.tasks);
                // Update toggle button badge
                this.updateToggleBadge(data.tasks.length);
            } else {
                console.error('Invalid response format:', data);
                this.updateTasksList([]);
            }
        } catch (error) {
            console.error('Error fetching background tasks:', error);
            this.updateTasksList([]);
        }
    }

    updateTasksList(tasks) {
        // Ensure tasks is an array
        if (!Array.isArray(tasks)) {
            console.error('Tasks is not an array:', tasks);
            tasks = [];
        }
        
        const tasksList = document.getElementById('bgTasksList');
        const emptyState = document.getElementById('bgTasksEmpty');
        const countBadge = this.popup && this.popup.querySelector('.bg-tasks-count');
        
        // Safety checks - return early if elements don't exist
        if (!tasksList) {
            console.error('bgTasksList element not found');
            return;
        }
        
        if (!emptyState) {
            console.error('bgTasksEmpty element not found');
            return;
        }
        
        if (!countBadge) {
            console.error('bg-tasks-count element not found');
            return;
        }
        
        // Check for newly completed tasks
        tasks.forEach(task => {
            if (task && task.status === 'completed' && !this.completedTasks.has(task.id)) {
                this.completedTasks.add(task.id);
                this.notifyTaskCompleted(task);
            }
        });
        
        // Update count
        countBadge.textContent = tasks.length;
        
        if (tasks.length === 0) {
            tasksList.style.display = 'none';
            emptyState.style.display = 'flex';
            return;
        }
        
        tasksList.style.display = 'block';
        emptyState.style.display = 'none';
        
        // Clear and rebuild list - wrap in try/catch to prevent errors
        try {
            // Create task cards safely
            const cardsHtml = tasks.map(task => {
                if (!task || !task.id) {
                    console.error('Invalid task:', task);
                    return '';
                }
                return this.createTaskCard(task);
            }).filter(html => html !== '').join('');
            
            // Use textContent first to clear, then set innerHTML
            tasksList.textContent = '';
            if (cardsHtml) {
                tasksList.innerHTML = cardsHtml;
            }
        } catch (error) {
            console.error('Error updating tasks list:', error);
            tasksList.textContent = '';
            const errorDiv = document.createElement('div');
            errorDiv.style.cssText = 'padding: 20px; text-align: center; color: var(--alert);';
            errorDiv.textContent = 'Error loading tasks';
            tasksList.appendChild(errorDiv);
        }
    }

    notifyTaskCompleted(task) {
        // Show browser notification if supported
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('✅ Task Completed!', {
                body: `${task.description}\nFound ${task.result ? task.result.length : 0} results`,
                icon: '/favicon.ico'
            });
        }
        
        // Show visual notification
        console.log(`✅ Task completed: ${task.description}`);
        
        // Automatically show the popup if not already visible
        if (!this.popup.classList.contains('show')) {
            this.show();
        }
    }

    createTaskCard(task) {
        const statusIcon = this.getStatusIcon(task.status);
        const statusColor = this.getStatusColor(task.status);
        const elapsed = this.getElapsedTime(task.startTime);
        
        return `
            <div class="bg-task-card" data-task-id="${task.id}">
                <div class="bg-task-header">
                    <div class="bg-task-icon ${statusColor}">
                        ${statusIcon}
                    </div>
                    <div class="bg-task-info">
                        <div class="bg-task-title">${this.escapeHtml(task.description)}</div>
                        <div class="bg-task-meta">
                            <span class="bg-task-type">${this.getTaskTypeIcon(task.type)} ${task.type}</span>
                            <span class="bg-task-time">⏱️ ${elapsed}</span>
                        </div>
                    </div>
                    <div class="bg-task-actions">
                        ${task.status === 'running' ? `
                            <button class="bg-task-btn-sm" onclick="backgroundTasksUI.pauseTask('${task.id}')" title="Pause">
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                        ` : ''}
                        ${task.status === 'paused' ? `
                            <button class="bg-task-btn-sm" onclick="backgroundTasksUI.resumeTask('${task.id}')" title="Resume">
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                        ` : ''}
                        ${task.status === 'completed' ? `
                            <button class="bg-task-btn-sm" onclick="backgroundTasksUI.viewTaskResults('${task.id}')" title="View Results" style="background: var(--live); color: var(--ground);">
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
                                    <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm9.707 5.707a1 1 0 00-1.414-1.414L9 12.586l-1.293-1.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                        ` : ''}
                        <button class="bg-task-btn-sm" onclick="backgroundTasksUI.viewTaskDetails('${task.id}')" title="View Details">
                            <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 12a2 2 0 100-4 2 2 0 000 4z"/>
                                <path fill-rule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clip-rule="evenodd"/>
                            </svg>
                        </button>
                        ${task.status === 'running' || task.status === 'paused' ? `
                            <button class="bg-task-btn-sm" onclick="backgroundTasksUI.terminateTask('${task.id}')" title="Stop & Delete" style="background: var(--alert); color: var(--text-hi);">
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                        ` : ''}
                        ${task.status === 'completed' || task.status === 'error' ? `
                            <button class="bg-task-btn-sm" onclick="backgroundTasksUI.deleteTask('${task.id}')" title="Remove" style="color: var(--alert);">
                                <svg width="12" height="12" viewBox="0 0 20 20" fill="currentColor">
                                    <path fill-rule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/>
                                </svg>
                            </button>
                        ` : ''}
                    </div>
                </div>
                <div class="bg-task-progress">
                    <div class="bg-task-progress-bar">
                        <div class="bg-task-progress-fill ${statusColor}" style="width: ${task.progress}%"></div>
                    </div>
                    <div class="bg-task-progress-text">${task.progress}%</div>
                </div>
            </div>
        `;
    }

    getStatusIcon(status) {
        const icons = {
            running: '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"/></svg>',
            paused: '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clip-rule="evenodd"/></svg>',
            completed: '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
            error: '<svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>'
        };
        return icons[status] || icons.running;
    }

    getStatusColor(status) {
        const colors = {
            running: 'status-running',
            paused: 'status-paused',
            completed: 'status-completed',
            error: 'status-error'
        };
        return colors[status] || 'status-running';
    }

    getTaskTypeIcon(type) {
        const icons = {
            scraping: '🔍',
            instagram: '📸',
            whatsapp: '💬',
            email: '📧',
            analysis: '📊'
        };
        return icons[type] || '📋';
    }


    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    updateToggleBadge(count) {
        const toggleBadge = document.querySelector('.bg-tasks-toggle-badge');
        if (toggleBadge) {
            if (count > 0) {
                toggleBadge.textContent = count;
                toggleBadge.style.display = 'block';
            } else {
                toggleBadge.style.display = 'none';
            }
        }
    }

    async pauseTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/pause`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                await this.fetchTasks();
            }
        } catch (error) {
            console.error('Error pausing task:', error);
        }
    }

    async resumeTask(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}/resume`, {
                method: 'POST'
            });
            const data = await response.json();
            
            if (data.success) {
                await this.fetchTasks();
            }
        } catch (error) {
            console.error('Error resuming task:', error);
        }
    }

    async viewTaskResults(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`);
            const data = await response.json();
            
            if (data.success && data.task) {
                const task = data.task;
                
                // If task is completed and has results, show them
                if (task.status === 'completed' && task.result) {
                    // Handle different task types differently
                    if (task.type === 'email') {
                        // Email extraction - redirect to email results page
                        // Handle both array format and object format
                        const emailResults = Array.isArray(task.result) ? task.result : (task.result.results || []);
                        const emailsFound = task.result.emailsFound || emailResults.filter(r => r.email && r.email !== '').length;
                        
                        localStorage.setItem('emailResults', JSON.stringify(emailResults));
                        
                        alert(
                            `✅ Email Extraction Completed!\n\n` +
                            `📋 ${task.description}\n` +
                            `📧 Found ${emailsFound} emails out of ${emailResults.length} websites\n\n` +
                            `Redirecting to results page...`
                        );
                        
                        window.location.href = 'email-results.html';
                    } else if (task.type === 'scraping') {
                        // Google Maps scraping - redirect to results page
                        localStorage.setItem('scrapedData', JSON.stringify(task.result));
                        
                        alert(
                            `✅ Task Completed!\n\n` +
                            `📋 ${task.description}\n` +
                            `📊 Found ${task.result.length} results\n\n` +
                            `Redirecting to results page...`
                        );
                        
                        window.location.href = 'results.html';
                    } else {
                        // Other task types - show generic results
                        alert(
                            `✅ Task Completed!\n\n` +
                            `📋 ${task.description}\n` +
                            `📊 Results: ${JSON.stringify(task.result).substring(0, 100)}...`
                        );
                    }
                } else {
                    alert('❌ Task has not completed yet or has no results');
                }
            } else {
                alert('❌ Could not load task results');
            }
        } catch (error) {
            console.error('Error loading task results:', error);
            alert('❌ Error loading task results');
        }
    }


    async viewTaskDetails(taskId) {
        try {
            const response = await fetch(`/api/tasks/${taskId}`);
            const data = await response.json();
            
            if (data.success && data.task) {
                const task = data.task;
                this.showDetailedModal(task);
            } else {
                alert('❌ Could not load task details');
            }
        } catch (error) {
            console.error('Error loading task details:', error);
            alert('❌ Error loading task details');
        }
    }

    showDetailedModal(task) {
        if (!this.detailedModal) return;
        
        const title = document.getElementById('taskModalTitle');
        const status = document.getElementById('taskModalStatus');
        const content = document.getElementById('taskModalContent');
        
        if (!title || !status || !content) return;
        
        title.textContent = task.description || 'Task Details';
        
        const statusIcons = {
            running: '▶️ Running',
            paused: '⏸️ Paused',
            completed: '✅ Completed',
            error: '❌ Failed'
        };
        
        status.textContent = statusIcons[task.status] || task.status;
        
        const elapsed = this.getElapsedTime(task.startTime);
        const duration = task.endTime ? 
            this.getElapsedTime(task.startTime, task.endTime) : 
            elapsed;
        
        content.innerHTML = `
            <div style="display: grid; gap: 24px;">
                <!-- Progress Section -->
                <div style="background: var(--surface-2); padding: 24px; border-radius: 16px; border: 1px solid var(--hairline);">
                    <h3 style="font-size: 16px; font-weight: 700; color: var(--text-hi); margin-bottom: 16px;">Progress</h3>
                    <div style="background: var(--surface-1); border-radius: 100px; height: 24px; margin-bottom: 12px; overflow: hidden; border: 1px solid var(--hairline);">
                        <div style="height: 100%; background: var(--signal); width: ${task.progress}%; transition: width 0.3s; display: flex; align-items: center; justify-content: center; color: var(--signal-ink); font-weight: 700; font-size: 12px;">
                            ${task.progress}%
                        </div>
                    </div>
                    <p style="text-align: center; color: var(--text-mid); font-size: 14px; font-weight: 600;">${task.progress === 100 ? 'Complete!' : `${task.progress}% completed`}</p>
                </div>
                
                <!-- Info Section -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
                    <div style="background: var(--surface-2); padding: 16px; border-radius: 12px; border: 1px solid var(--hairline);">
                        <div style="color: var(--text-low); font-size: 12px; font-weight: 600; margin-bottom: 4px;">Task ID</div>
                        <div style="color: var(--text-hi); font-size: 14px; font-weight: 700; font-family: monospace;">${task.id.substring(0, 20)}...</div>
                    </div>
                    
                    <div style="background: var(--surface-2); padding: 16px; border-radius: 12px; border: 1px solid var(--hairline);">
                        <div style="color: var(--text-low); font-size: 12px; font-weight: 600; margin-bottom: 4px;">Type</div>
                        <div style="color: var(--text-hi); font-size: 14px; font-weight: 700;">${this.getTaskTypeIcon(task.type)} ${task.type}</div>
                    </div>
                    
                    <div style="background: var(--surface-2); padding: 16px; border-radius: 12px; border: 1px solid var(--hairline);">
                        <div style="color: var(--text-low); font-size: 12px; font-weight: 600; margin-bottom: 4px;">Started</div>
                        <div style="color: var(--text-hi); font-size: 14px; font-weight: 700;">${new Date(task.startTime).toLocaleTimeString()}</div>
                    </div>
                    
                    <div style="background: var(--surface-2); padding: 16px; border-radius: 12px; border: 1px solid var(--hairline);">
                        <div style="color: var(--text-low); font-size: 12px; font-weight: 600; margin-bottom: 4px;">Duration</div>
                        <div style="color: var(--text-hi); font-size: 14px; font-weight: 700;">⏱️ ${duration}</div>
                    </div>
                </div>
                
                ${task.result && Array.isArray(task.result) ? `
                    <div style="background: var(--surface-2); padding: 24px; border-radius: 16px; border: 1px solid var(--hairline);">
                        <h3 style="font-size: 16px; font-weight: 700; color: var(--live); margin-bottom: 12px;">📊 Results</h3>
                        <div style="font-size: 32px; font-weight: 800; color: var(--live); margin-bottom: 8px;">${task.result.length}</div>
                        <p style="color: var(--text-mid); font-size: 14px;">businesses found</p>
                        <button onclick="backgroundTasksUI.viewTaskResults('${task.id}')" style="margin-top: 16px; padding: 12px 24px; background: var(--live); color: var(--ground); border: none; border-radius: 12px; font-weight: 700; cursor: pointer; width: 100%; transition: all 0.2s;">
                            View Results Page
                        </button>
                    </div>
                ` : ''}
                
                ${task.error ? `
                    <div style="background: var(--alert-soft); padding: 24px; border-radius: 16px; border: 1px solid var(--alert);">
                        <h3 style="font-size: 16px; font-weight: 700; color: var(--alert); margin-bottom: 12px;">❌ Error</h3>
                        <p style="color: var(--text-mid); font-size: 14px; font-family: monospace;">${task.error}</p>
                    </div>
                ` : ''}
                
                <!-- Action Buttons -->
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 12px; margin-top: 8px;">
                    ${task.status === 'running' ? `
                        <button onclick="backgroundTasksUI.pauseTask('${task.id}'); setTimeout(() => backgroundTasksUI.viewTaskDetails('${task.id}'), 500);" style="padding: 12px 20px; background: var(--signal); color: var(--signal-ink); border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            ⏸️ Pause Task
                        </button>
                    ` : ''}
                    
                    ${task.status === 'paused' ? `
                        <button onclick="backgroundTasksUI.resumeTask('${task.id}'); setTimeout(() => backgroundTasksUI.viewTaskDetails('${task.id}'), 500);" style="padding: 12px 20px; background: var(--live); color: var(--ground); border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            ▶️ Resume Task
                        </button>
                    ` : ''}
                    
                    ${task.status === 'running' || task.status === 'paused' ? `
                        <button onclick="backgroundTasksUI.terminateTask('${task.id}')" style="padding: 12px 20px; background: var(--alert); color: var(--text-hi); border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            🛑 Stop & Delete
                        </button>
                    ` : ''}
                    
                    <button onclick="backgroundTasksUI.goToTaskScreen('${task.type}', '${task.id}')" style="padding: 12px 20px; background: var(--signal); color: var(--signal-ink); border: none; border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                        🔍 Go to Task Screen
                    </button>
                    
                    ${task.status === 'completed' || task.status === 'error' ? `
                        <button onclick="backgroundTasksUI.deleteTask('${task.id}')" style="padding: 12px 20px; background: var(--surface-3); color: var(--text-hi); border: 1px solid var(--hairline); border-radius: 12px; font-weight: 700; cursor: pointer; transition: all 0.2s;">
                            🗑️ Delete Task
                        </button>
                    ` : ''}
                </div>
            </div>
        `;
        
        this.detailedModal.style.display = 'flex';
    }

    getElapsedTime(startTime, endTime = null) {
        const start = new Date(startTime).getTime();
        const end = endTime ? new Date(endTime).getTime() : Date.now();
        const elapsed = end - start;
        const seconds = Math.floor(elapsed / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else if (minutes > 0) {
            return `${minutes}m ${seconds % 60}s`;
        } else {
            return `${seconds}s`;
        }
    }

    async terminateTask(taskId) {
        const confirmed = confirm('⚠️ Stop and delete this task?\n\nThis will stop the scraping immediately and delete the task.');
        
        if (!confirmed) return;
        
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                await this.fetchTasks();
            } else {
                alert('❌ Failed to terminate task');
            }
        } catch (error) {
            console.error('Error terminating task:', error);
            alert('❌ Error terminating task');
        }
    }

    async deleteTask(taskId) {
        const confirmed = confirm('🗑️ Delete this task?\n\nThis will remove the task from the list.');
        
        if (!confirmed) return;
        
        try {
            const response = await fetch(`/api/tasks/${taskId}`, {
                method: 'DELETE'
            });
            const data = await response.json();
            
            if (data.success) {
                // Close the detailed modal if open
                this.closeDetailedModal();
                await this.fetchTasks();
            } else {
                alert('❌ Failed to delete task');
            }
        } catch (error) {
            console.error('Error deleting task:', error);
            alert('❌ Error deleting task');
        }
    }

    async goToTaskScreen(taskType, taskId = null) {
        // Close the detailed modal
        this.closeDetailedModal();
        
        // Hide background tasks panel
        this.hide();
        
        // Get task details if taskId provided
        let task = null;
        if (taskId) {
            try {
                const response = await fetch(`/api/tasks/${taskId}`);
                const data = await response.json();
                if (data.success && data.task) {
                    task = data.task;
                }
            } catch (error) {
                console.error('Error fetching task:', error);
            }
        }
        
        // Navigate to the appropriate modal based on task type
        switch(taskType) {
            case 'scraping':
                // Open Google Maps scraping modal
                const modalOverlay = document.getElementById('modalOverlay');
                const startScrapeBtn = document.getElementById('startScrapeBtn');
                
                if (modalOverlay && startScrapeBtn) {
                    // Open the modal
                    startScrapeBtn.click();
                    
                    // Show appropriate screen based on task status
                    setTimeout(() => {
                        if (task) {
                            if (task.status === 'running' || task.status === 'paused') {
                                // Show progress screen with real-time updates
                                if (typeof goToStep === 'function') {
                                    goToStep(3);
                                    document.getElementById('progressMessage').textContent = `Extracting data... (${task.progress}% complete)`;
                                    document.getElementById('progressDetails').textContent = 'Task running in background - progress updates automatically';
                                    
                                    // Start polling for this specific task to show live progress
                                    this.startTaskProgressPolling(task.id);
                                }
                            } else if (task.status === 'completed') {
                                // Show results screen
                                if (typeof goToStep === 'function') {
                                    goToStep(4);
                                    document.getElementById('resultMessage').textContent = 'Task completed! Click "View Results" to see the data.';
                                    
                                    // Store results so user can view them
                                    if (task.result && window.scrapedData !== undefined) {
                                        window.scrapedData = task.result;
                                    }
                                }
                            }
                        }
                    }, 100);
                } else {
                    alert('⚠️ Could not find Google Maps button');
                }
                break;
                
            case 'instagram':
                // Open Instagram modal
                const instagramBtn = document.getElementById('instagramAutomationBtn');
                if (instagramBtn) {
                    instagramBtn.click();
                    
                    // If task exists and is running/completed, show appropriate screen
                    if (task) {
                        setTimeout(() => {
                            if (task.status === 'running' || task.status === 'paused') {
                                // Show progress/logs section
                                document.getElementById('instagramLogs')?.scrollIntoView({ behavior: 'smooth' });
                            } else if (task.status === 'completed') {
                                alert('✅ Instagram automation completed! Check the logs for details.');
                            }
                        }, 100);
                    }
                } else {
                    alert('⚠️ Could not find Instagram button');
                }
                break;
                
            case 'whatsapp':
                // Open WhatsApp/Lead Sender modal
                const leadSenderBtn = document.getElementById('leadSenderBtn');
                if (leadSenderBtn) {
                    leadSenderBtn.click();
                    
                    if (task && task.status === 'completed') {
                        setTimeout(() => {
                            alert('✅ WhatsApp messages sent successfully!');
                        }, 100);
                    }
                } else {
                    alert('⚠️ Could not find WhatsApp button');
                }
                break;
                
            case 'email':
                // Open Email Extractor modal or redirect to results
                if (task && task.status === 'completed') {
                    // If task is completed, redirect to results page
                    this.viewTaskResults(task.id);
                } else {
                    // If task is running/paused, open modal with progress
                    const emailBtn = document.getElementById('emailExtractorBtn');
                    if (emailBtn) {
                        emailBtn.click();
                        
                        // If task exists, show appropriate screen
                        if (task) {
                            setTimeout(() => {
                                if (task.status === 'running' || task.status === 'paused') {
                                    // Show processing screen with progress
                                    if (typeof showEmailStep === 'function') {
                                        showEmailStep(2);
                                        const total = task.data?.total || 100;
                                        const completed = Math.floor((task.progress / 100) * total);
                                        document.getElementById('emailProgressText').textContent = `${completed} / ${total}`;
                                        document.getElementById('emailProgressBar').style.width = `${task.progress}%`;
                                        document.getElementById('currentWebsite').textContent = 'Processing in background...';
                                        
                                        // Start polling for this specific task
                                        this.startTaskProgressPolling(task.id, 'email');
                                    }
                                }
                            }, 100);
                        }
                    } else {
                        alert('⚠️ Could not find Email button');
                    }
                }
                break;
                
            default:
                console.log('Unknown task type:', taskType);
                alert('⚠️ Cannot navigate to task screen - unknown task type: ' + taskType);
        }
    }

    startTaskProgressPolling(taskId, taskType = 'scraping') {
        // Clear any existing polling
        if (this.taskProgressInterval) {
            clearInterval(this.taskProgressInterval);
        }
        
        // Poll every 2 seconds to update progress in the modal
        this.taskProgressInterval = setInterval(async () => {
            try {
                const response = await fetch(`/api/tasks/${taskId}`);
                const data = await response.json();
                
                if (data.success && data.task) {
                    const task = data.task;
                    
                    if (taskType === 'scraping') {
                        // Update Google Maps scraping progress
                        const progressMessage = document.getElementById('progressMessage');
                        const progressDetails = document.getElementById('progressDetails');
                        
                        if (progressMessage) {
                            progressMessage.textContent = `Extracting data... (${task.progress}% complete)`;
                        }
                        
                        if (progressDetails && task.logs && task.logs.length > 0) {
                            const lastLog = task.logs[task.logs.length - 1];
                            progressDetails.textContent = lastLog.message || 'Processing...';
                        }
                        
                        // If completed, show results screen
                        if (task.status === 'completed') {
                            clearInterval(this.taskProgressInterval);
                            if (typeof goToStep === 'function') {
                                goToStep(4);
                                if (task.result && window.scrapedData !== undefined) {
                                    window.scrapedData = task.result;
                                }
                                document.getElementById('resultMessage').textContent = 'Successfully extracted data from the website!';
                            }
                        }
                        
                        // If error, show error
                        if (task.status === 'error') {
                            clearInterval(this.taskProgressInterval);
                            alert('❌ Task failed: ' + (task.error || 'Unknown error'));
                            if (typeof goToStep === 'function') {
                                goToStep(1);
                            }
                        }
                    } else if (taskType === 'email') {
                        // Update email extraction progress
                        const total = task.data?.total || task.data?.businesses?.length || 100;
                        const completed = Math.floor((task.progress / 100) * total);
                        
                        const progressText = document.getElementById('emailProgressText');
                        const progressBar = document.getElementById('emailProgressBar');
                        const currentWebsite = document.getElementById('currentWebsite');
                        
                        if (progressText) progressText.textContent = `${completed} / ${total}`;
                        if (progressBar) progressBar.style.width = `${task.progress}%`;
                        if (currentWebsite && task.logs && task.logs.length > 0) {
                            const lastLog = task.logs[task.logs.length - 1];
                            currentWebsite.textContent = lastLog.message || 'Processing...';
                        }
                        
                        // If completed, redirect to results page
                        if (task.status === 'completed') {
                            clearInterval(this.taskProgressInterval);
                            
                            // Handle both array format and object format
                            const emailResults = Array.isArray(task.result) ? task.result : (task.result.results || []);
                            const emailsFound = task.result.emailsFound || emailResults.filter(r => r.email && r.email !== '').length;
                            
                            // Store results and redirect
                            localStorage.setItem('emailResults', JSON.stringify(emailResults));
                            
                            // Close modal if open
                            if (typeof closeEmailExtractor === 'function') {
                                closeEmailExtractor();
                            }
                            
                            alert(
                                `✅ Email Extraction Completed!\n\n` +
                                `📧 Found ${emailsFound} emails out of ${emailResults.length} websites\n\n` +
                                `Redirecting to results page...`
                            );
                            
                            window.location.href = 'email-results.html';
                        }
                        
                        // If error, show error
                        if (task.status === 'error') {
                            clearInterval(this.taskProgressInterval);
                            alert('❌ Task failed: ' + (task.error || 'Unknown error'));
                            if (typeof closeEmailExtractor === 'function') {
                                closeEmailExtractor();
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Error polling task progress:', error);
            }
        }, 2000);
    }

    startPolling() {
        // Fetch tasks immediately on startup
        this.fetchTasks();
        
        // Poll every 2 seconds
        this.updateInterval = setInterval(() => {
                this.fetchTasks();
        }, 2000);
    }

    stopPolling() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
}

// Initialize background tasks UI
const backgroundTasksUI = new BackgroundTasksUI();

// Make it globally accessible
window.backgroundTasksUI = backgroundTasksUI;

