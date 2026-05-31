# Background Tasks System - Complete Guide 📋

**Date:** October 28, 2025

---

## 🎯 What is This?

The Background Tasks System allows you to run multiple operations simultaneously without being stuck on one screen. You can:
- Run tasks in the background
- Monitor progress in real-time
- Return to the main screen while tasks run
- Multitask across different features
- View all active tasks in one place

---

## 📁 System Files

### 1. `src/tasks/taskManager.js` (Server-Side)
Manages background tasks on the server:
- Creates and tracks tasks
- Updates progress
- Handles task completion/failure
- Auto-cleanup of old tasks

### 2. `src/tasks/taskRoutes.js` (Server-Side API)
API endpoints for task management:
```
GET    /api/tasks              - Get all tasks
GET    /api/tasks/active       - Get active tasks only
GET    /api/tasks/:taskId      - Get specific task
POST   /api/tasks/:taskId/pause   - Pause a task
POST   /api/tasks/:taskId/resume  - Resume a task
DELETE /api/tasks/:taskId      - Delete a task
GET    /api/tasks/stats/summary   - Get statistics
POST   /api/tasks/cleanup      - Cleanup old tasks
```

### 3. `public/js/backgroundTasks.js` (Client-Side)
UI manager for background tasks popup:
- Creates and manages popup
- Polls server for updates
- Displays task progress
- Handles user interactions

### 4. `backgroundTasks.css`
Styles for the background tasks popup and related UI elements.

---

## 🚀 How to Use

### For Users:

#### 1. Starting a Background Task:

1. Open any feature (e.g., Instagram Automation)
2. Configure your task as usual
3. Click **"Run in Background"** button instead of normal start
4. Task will start and you'll return to main screen
5. Task continues running in background

#### 2. Monitoring Tasks:

- Click the floating **Tasks button** (bottom-right corner)
- See all active tasks with real-time progress
- Each task shows:
  - Progress bar (0-100%)
  - Elapsed time
  - Current status (Running/Paused/Completed)
  - Task type icon

#### 3. Task Controls:

- **Pause ⏸️** - Temporarily pause the task
- **Resume ▶️** - Continue paused task
- **View Details 👁️** - See full task logs and details

---

## 👨‍💻 For Developers

### Adding Background Task Support to a Feature:

#### Step 1: Create Task on Server

In your server endpoint, wrap the operation with task manager:

```javascript
const taskManager = require('./src/tasks/taskManager');

app.post('/api/your-feature/run', async (req, res) => {
  const { runInBackground, ...otherParams } = req.body;
  
  if (runInBackground) {
    // Create background task
    const task = taskManager.createTask(
      'your-feature-type',  // e.g., 'instagram', 'scraping', 'email'
      'Task description here',
      { ...otherParams }    // Store task parameters
    );
    
    // Return task ID immediately
    res.json({
      success: true,
      taskId: task.id,
      message: 'Task started in background'
    });
    
    // Continue processing asynchronously
    processYourFeature(task.id, otherParams);
    
  } else {
    // Normal synchronous processing
    const result = await processYourFeature(null, otherParams);
    res.json(result);
  }
});

// Async processing function
async function processYourFeature(taskId, params) {
  try {
    // Update progress
    if (taskId) {
      taskManager.updateTaskProgress(taskId, 10, 'Starting...');
    }
    
    // Your processing logic here
    // ...
    
    // Update progress as you go
    if (taskId) {
      taskManager.updateTaskProgress(taskId, 50, 'Halfway done...');
    }
    
    // More processing
    // ...
    
    // Complete task
    if (taskId) {
      taskManager.completeTask(taskId, result);
    }
    
    return result;
    
  } catch (error) {
    // Mark task as failed
    if (taskId) {
      taskManager.failTask(taskId, error.message);
    }
    throw error;
  }
}
```

#### Step 2: Add "Run in Background" Button

In your modal/feature UI:

```html
<div style="display: flex; gap: 12px;">
    <!-- Normal button -->
    <button class="btn-primary" onclick="startYourFeature(false)">
        Start Now
    </button>
    
    <!-- Background button -->
    <button class="btn-run-background" onclick="startYourFeature(true)">
        <svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor">
            <path d="M9 2a1 1 0 000 2h2a1 1 0 100-2H9z"/>
            <path fill-rule="evenodd" d="M4 5a2 2 0 012-2 3 3 0 003 3h2a3 3 0 003-3 2 2 0 012 2v11a2 2 0 01-2 2H6a2 2 0 01-2-2V5zm3 4a1 1 0 000 2h.01a1 1 0 100-2H7zm3 0a1 1 0 000 2h3a1 1 0 100-2h-3zm-3 4a1 1 0 100 2h.01a1 1 0 100-2H7zm3 0a1 1 0 100 2h3a1 1 0 100-2h-3z" clip-rule="evenodd"/>
        </svg>
        Run in Background
    </button>
</div>
```

#### Step 3: Update JavaScript Function

```javascript
async function startYourFeature(runInBackground = false) {
    const params = {
        // Your parameters
        runInBackground: runInBackground
    };
    
    const response = await fetch('/api/your-feature/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (runInBackground) {
        // Show success message
        alert(`✅ Task started in background!\n\nTask ID: ${result.taskId}\n\nYou can monitor progress in the Background Tasks popup.`);
        
        // Close modal and show tasks popup
        closeYourModal();
        backgroundTasksUI.show();
        
    } else {
        // Handle normal result
        handleNormalResult(result);
    }
}
```

---

## 📊 Task Types

| Type | Icon | Description |
|------|------|-------------|
| `scraping` | 🔍 | Web scraping operations |
| `instagram` | 📸 | Instagram automation |
| `whatsapp` | 💬 | WhatsApp messaging |
| `email` | 📧 | Email operations |
| `analysis` | 📊 | Data analysis |

---

## 🎨 UI Components

### Task Card Structure:
```
┌─────────────────────────────────┐
│ 📸 Instagram Automation         │ ← Icon + Title
│    Type: instagram  ⏱️ 2m 30s    │ ← Metadata
│    ⏸️ 👁️                         │ ← Action buttons
│ ████████░░░░░ 65%               │ ← Progress bar
└─────────────────────────────────┘
```

### Popup States:
1. **Hidden** - Not visible
2. **Shown** - Full popup visible
3. **Minimized** - Only header visible

---

## 🔔 Notifications

### Auto-Notifications (Planned):
- Task completed successfully
- Task failed with error
- Task paused automatically (rate limits)
- Task taking longer than expected

---

## 🐛 Troubleshooting

### Problem: Tasks not showing in popup
**Solution:**
- Make sure `public/js/backgroundTasks.js` is loaded
- Check browser console for errors
- Verify server is running
- Check `/api/tasks/active` endpoint

### Problem: Task stuck at 0%
**Solution:**
- Check server logs for errors
- Verify task manager is updating progress
- Restart server if needed

### Problem: Too many old tasks
**Solution:**
- Tasks auto-cleanup after 1 hour
- Manual cleanup: POST to `/api/tasks/cleanup`

---

## 📈 Performance

### Polling Interval:
- Updates every 2 seconds when popup is visible
- No polling when popup is hidden (saves resources)

### Task Retention:
- Active tasks: Kept until completed/failed
- Completed tasks: Auto-deleted after 1 hour
- Manual cleanup available via API

---

## 🚦 Example: Instagram Background Task

### Client Code:
```javascript
async function startInstagramAutomation(runInBackground = false) {
    const params = {
        searchQuery: document.getElementById('instagramSearchQuery').value,
        maxAccounts: document.getElementById('instagramMaxAccounts').value,
        messageTemplate: document.getElementById('instagramMessage').value,
        runInBackground: runInBackground
    };
    
    const response = await fetch('/api/instagram/search-and-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params)
    });
    
    const result = await response.json();
    
    if (runInBackground) {
        alert('✅ Instagram automation started in background!');
        closeInstagramModal();
        backgroundTasksUI.show();
    } else {
        // Show results normally
        showInstagramResults(result);
    }
}
```

### Server Code:
```javascript
app.post('/api/instagram/search-and-message', async (req, res) => {
    const { runInBackground, ...params } = req.body;
    
    if (runInBackground) {
        const task = taskManager.createTask(
            'instagram',
            `Instagram: ${params.searchQuery} (${params.maxAccounts} accounts)`,
            params
        );
        
        res.json({
            success: true,
            taskId: task.id
        });
        
        // Run asynchronously
        runInstagramAutomation(task.id, params);
        
    } else {
        // Synchronous execution
        const result = await runInstagramAutomation(null, params);
        res.json(result);
    }
});
```

---

## ✅ Benefits

- ✅ **Multitasking** - Run multiple operations simultaneously
- ✅ **Better UX** - Don't get stuck on one screen
- ✅ **Progress Tracking** - Monitor all tasks in one place
- ✅ **Time Efficiency** - Start next task while first is running
- ✅ **Pause/Resume** - Control over long-running tasks

---

## 🎯 Next Steps

To add background task support to your feature:

1. Modify server endpoint to accept `runInBackground` parameter
2. Wrap operation with task manager
3. Add "Run in Background" button to UI
4. Update JavaScript to handle both modes
5. Test with actual operations

---

**Last Updated:** October 28, 2025
**Version:** 1.0.0 - Initial Release

