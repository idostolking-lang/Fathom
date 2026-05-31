// ===== BACKGROUND TASK MANAGER =====
// This module handles background task execution and monitoring

class BackgroundTaskManager {
  constructor() {
    this.tasks = new Map(); // taskId -> task object
    this.nextTaskId = 1;
  }

  // Create a new background task
  createTask(type, description, data = {}) {
    const taskId = `task_${this.nextTaskId++}_${Date.now()}`;
    
    const task = {
      id: taskId,
      type: type, // 'scraping', 'instagram', 'whatsapp', 'email', 'analysis'
      description: description,
      status: 'running', // 'running', 'paused', 'completed', 'error'
      progress: 0,
      startTime: new Date(),
      endTime: null,
      data: data, // Task-specific data
      logs: [],
      result: null,
      error: null
    };
    
    this.tasks.set(taskId, task);
    console.log(`📋 Created background task: ${taskId} - ${description}`);
    
    return task;
  }

  // Update task progress
  updateTaskProgress(taskId, progress, message = null) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.progress = Math.min(100, Math.max(0, progress));
    
    if (message) {
      task.logs.push({
        timestamp: new Date(),
        message: message
      });
    }
    
    return true;
  }

  // Update task status
  updateTaskStatus(taskId, status, message = null) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.status = status; // 'running', 'paused', 'completed', 'error'
    
    if (message) {
      task.logs.push({
        timestamp: new Date(),
        message: message
      });
    }
    
    console.log(`📊 Task ${taskId} status: ${status}`);
    return true;
  }

  // Add log to task
  addTaskLog(taskId, message, type = 'info') {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.logs.push({
      timestamp: new Date(),
      message: message,
      type: type // 'info', 'success', 'warning', 'error'
    });
    
    return true;
  }

  // Mark task as completed
  completeTask(taskId, result = null) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.status = 'completed';
    task.progress = 100;
    task.endTime = new Date();
    task.result = result;
    
    console.log(`✅ Task completed: ${taskId}`);
    return true;
  }

  // Mark task as failed
  failTask(taskId, error) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.status = 'error';
    task.endTime = new Date();
    task.error = error;
    
    console.log(`❌ Task failed: ${taskId} - ${error}`);
    return true;
  }

  // Pause a task
  pauseTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.status = 'paused';
    console.log(`⏸️ Task paused: ${taskId}`);
    return true;
  }

  // Resume a task
  resumeTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) return false;
    
    task.status = 'running';
    console.log(`▶️ Task resumed: ${taskId}`);
    return true;
  }

  async waitIfPausedOrCancelled(taskId, intervalMs = 1000) {
    if (!taskId) return null;

    while (true) {
      const task = this.tasks.get(taskId);
      if (!task) {
        throw new Error(`Task ${taskId} was cancelled`);
      }

      if (task.status !== 'paused') {
        return task;
      }

      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }

  async controlledDelay(taskId, delayMs, intervalMs = 1000) {
    const deadline = Date.now() + delayMs;

    while (Date.now() < deadline) {
      await this.waitIfPausedOrCancelled(taskId, intervalMs);
      const remaining = deadline - Date.now();
      await new Promise(resolve => setTimeout(resolve, Math.min(intervalMs, Math.max(0, remaining))));
    }

    await this.waitIfPausedOrCancelled(taskId, intervalMs);
  }

  // Get task details
  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  // Get all tasks
  getAllTasks() {
    return Array.from(this.tasks.values());
  }

  // Get active tasks (running or paused)
  getActiveTasks() {
    return Array.from(this.tasks.values()).filter(
      task => task.status === 'running' || task.status === 'paused'
    );
  }

  // Get completed tasks
  getCompletedTasks() {
    return Array.from(this.tasks.values()).filter(
      task => task.status === 'completed' || task.status === 'error'
    );
  }

  // Delete a task
  deleteTask(taskId) {
    const deleted = this.tasks.delete(taskId);
    if (deleted) {
      console.log(`🗑️ Task deleted: ${taskId}`);
    }
    return deleted;
  }

  // Clean up old completed tasks (older than 1 hour)
  cleanupOldTasks() {
    const oneHourAgo = Date.now() - (60 * 60 * 1000);
    let cleaned = 0;
    
    for (const [taskId, task] of this.tasks.entries()) {
      if (
        (task.status === 'completed' || task.status === 'error') &&
        task.endTime &&
        new Date(task.endTime).getTime() < oneHourAgo
      ) {
        this.tasks.delete(taskId);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`🧹 Cleaned up ${cleaned} old tasks`);
    }
    
    return cleaned;
  }

  // Get task statistics
  getStatistics() {
    const allTasks = this.getAllTasks();
    
    return {
      total: allTasks.length,
      running: allTasks.filter(t => t.status === 'running').length,
      paused: allTasks.filter(t => t.status === 'paused').length,
      completed: allTasks.filter(t => t.status === 'completed').length,
      errors: allTasks.filter(t => t.status === 'error').length
    };
  }
}

// Export singleton instance
const taskManager = new BackgroundTaskManager();

// Auto cleanup every 30 minutes
const cleanupInterval = setInterval(() => {
  taskManager.cleanupOldTasks();
}, 30 * 60 * 1000);
cleanupInterval.unref?.();

module.exports = taskManager;
module.exports.BackgroundTaskManager = BackgroundTaskManager;

