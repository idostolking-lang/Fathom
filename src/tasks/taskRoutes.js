// ===== BACKGROUND TASK API ROUTES =====
// API endpoints for managing background tasks

const express = require('express');
const router = express.Router();
const taskManager = require('./taskManager');

// Transform task for frontend (convert 'description' to 'name', 'error' status to 'failed')
function transformTask(task) {
  return {
    ...task,
    name: task.description, // Frontend expects 'name'
    status: task.status === 'error' ? 'failed' : task.status // Frontend uses 'failed' instead of 'error'
  };
}

// Get all tasks
router.get('/tasks', (req, res) => {
  try {
    const tasks = taskManager.getAllTasks().map(transformTask);
    res.json({
      success: true,
      tasks: tasks
    });
  } catch (error) {
    console.error('Error getting tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get active tasks
router.get('/tasks/active', (req, res) => {
  try {
    const tasks = taskManager.getActiveTasks().map(transformTask);
    res.json({
      success: true,
      tasks: tasks
    });
  } catch (error) {
    console.error('Error getting active tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific task
router.get('/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const task = taskManager.getTask(taskId);
    
    if (!task) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      task: transformTask(task)
    });
  } catch (error) {
    console.error('Error getting task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pause a task
router.post('/tasks/:taskId/pause', (req, res) => {
  try {
    const { taskId } = req.params;
    const success = taskManager.pauseTask(taskId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Task paused',
      task: transformTask(taskManager.getTask(taskId))
    });
  } catch (error) {
    console.error('Error pausing task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resume a task
router.post('/tasks/:taskId/resume', (req, res) => {
  try {
    const { taskId } = req.params;
    const success = taskManager.resumeTask(taskId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Task resumed',
      task: transformTask(taskManager.getTask(taskId))
    });
  } catch (error) {
    console.error('Error resuming task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete a task
router.delete('/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const success = taskManager.deleteTask(taskId);
    
    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Task not found'
      });
    }
    
    res.json({
      success: true,
      message: 'Task deleted'
    });
  } catch (error) {
    console.error('Error deleting task:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get task statistics
router.get('/tasks/stats/summary', (req, res) => {
  try {
    const stats = taskManager.getStatistics();
    res.json({
      success: true,
      statistics: stats
    });
  } catch (error) {
    console.error('Error getting statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup old tasks
router.post('/tasks/cleanup', (req, res) => {
  try {
    const cleaned = taskManager.cleanupOldTasks();
    res.json({
      success: true,
      message: `Cleaned up ${cleaned} old tasks`,
      cleaned: cleaned
    });
  } catch (error) {
    console.error('Error cleaning up tasks:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;

