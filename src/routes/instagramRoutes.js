const express = require('express');
const {
  createInitialOperation,
  isActiveInstagramOperation,
  isInstagramStopSignal,
  isTaskCancellationError,
  parseSpecificAccounts,
  resolveInstagramSafetyRules,
  startInstagramBackgroundTask
} = require('../../lib/instagramAutomation');

function createInstagramRoutes({ taskManager, port, accessToken }) {
  const router = express.Router();
  const PORT = port;
  const ACCESS_TOKEN = accessToken;


  // ===== INSTAGRAM AUTOMATION WITH ENHANCED SECURITY =====

  // Instagram Client
  let instagramClient = null;
  let isInstagramReady = false;
  let currentInstagramOperation = null; // For progress tracking
  let instagramUsername = null; // Store connected username
  let lastActivityTime = null; // Track last activity for anti-detection

  function loadInstagramApiClient() {
    if (process.env.ENABLE_INSTAGRAM_AUTOMATION !== 'true') {
      throw new Error('Instagram automation is disabled. Set ENABLE_INSTAGRAM_AUTOMATION=true to enable it.');
    }

    try {
      return require('instagram-private-api').IgApiClient;
    } catch (_error) {
      throw new Error('Instagram automation dependency is not installed. Run npm install instagram-private-api to enable it.');
    }
  }

  // ANTI-DETECTION: Random delays that mimic human behavior
  function getHumanDelay(min = 2000, max = 5000) {
    // Add some randomness with gaussian-like distribution
    const delay = Math.random() * (max - min) + min;
    const variance = (Math.random() - 0.5) * 1000; // +/- 0.5 seconds
    return Math.max(min, delay + variance);
  }

  // ANTI-DETECTION: Check if we should add cooling period
  function shouldCoolDown() {
    if (!lastActivityTime) return false;
    const timeSinceLastActivity = Date.now() - lastActivityTime;
    // If less than 30 seconds since last activity, add cooling
    return timeSinceLastActivity < 30000;
  }

  // ANTI-DETECTION: Add realistic cooling period
  async function addCoolingPeriod(taskId = null) {
    if (shouldCoolDown()) {
      const coolingTime = getHumanDelay(10000, 20000); // 10-20 seconds
      console.log(`🧊 Cooling period: ${(coolingTime / 1000).toFixed(1)}s to avoid detection`);
      await taskManager.controlledDelay(taskId, coolingTime);
    }
    lastActivityTime = Date.now();
  }

  // Manual Instagram Connect Endpoint with Enhanced Security
  router.post('/instagram/connect', async (req, res) => {
    try {
      const { username, password } = req.body;

      // Validation
      if (!username || !password) {
        return res.status(400).json({ 
          success: false, 
          error: 'Username and password are required' 
        });
      }

      if (isActiveInstagramOperation(currentInstagramOperation)) {
        return res.status(409).json({
          success: false,
          error: 'Instagram automation is already running. Wait for it to finish before changing the Instagram connection.'
        });
      }

      // If already connected, disconnect first
      if (instagramClient && isInstagramReady) {
        console.log('📸 Disconnecting existing Instagram session...');
        instagramClient = null;
        isInstagramReady = false;
        instagramUsername = null;
      }

      console.log(`📸 Connecting to Instagram as ${username}...`);

      // Initialize client with anti-detection measures
      const IgApiClient = loadInstagramApiClient();
      instagramClient = new IgApiClient();
      
      // ANTI-DETECTION: Generate realistic device fingerprint
      instagramClient.state.generateDevice(username);
      
      // ANTI-DETECTION: Set realistic user agent and device settings
      instagramClient.state.deviceString = `24/7.0; 440dpi; 1080x1920; OnePlus; ONEPLUS A6003; OnePlus6; qcom`;
      instagramClient.state.deviceId = instagramClient.state.uuid;
      instagramClient.state.phoneId = instagramClient.state.uuid;
      instagramClient.state.uuid = instagramClient.state.uuid;
      
      // ANTI-DETECTION: Simulate app pre-login requests (like real Instagram app)
      await instagramClient.simulate.preLoginFlow();
      
      // Login with credentials
      const loginResponse = await instagramClient.account.login(username, password);
      
      // ANTI-DETECTION: Simulate app post-login requests
      await instagramClient.simulate.postLoginFlow();
      
      // Store session state
      isInstagramReady = true;
      instagramUsername = username;
      lastActivityTime = Date.now();
      
      console.log('✅ Instagram connected successfully!');
      console.log(`👤 User ID: ${loginResponse.pk}`);
      console.log(`🔐 Session established with enhanced anti-detection`);

      res.json({ 
        success: true, 
        message: 'Connected successfully',
        username: username,
        userId: loginResponse.pk
      });

    } catch (error) {
      console.error('❌ Instagram connection failed:', error.message);
      isInstagramReady = false;
      instagramClient = null;
      instagramUsername = null;
      
      let errorMessage = error.message;
      
      if (error.message.includes('challenge_required')) {
        errorMessage = 'Instagram requires verification. Please login from your phone first and approve this device.';
      } else if (error.message.includes('checkpoint_required')) {
        errorMessage = 'Instagram checkpoint required. Please verify your account on Instagram mobile app.';
      } else if (error.message.includes('Please wait')) {
        errorMessage = 'Too many login attempts. Please wait a few minutes and try again.';
      } else if (error.message.includes('user') || error.message.includes('password')) {
        errorMessage = 'Invalid username or password. Please check your credentials.';
      }
      
      res.status(401).json({ 
        success: false, 
        error: errorMessage 
      });
    }
  });

  // Instagram Disconnect Endpoint
  router.post('/instagram/disconnect', async (req, res) => {
    try {
      if (isActiveInstagramOperation(currentInstagramOperation)) {
        return res.status(409).json({
          success: false,
          error: 'Instagram automation is already running. Wait for it to finish before changing the Instagram connection.'
        });
      }

      if (instagramClient) {
        console.log(`📸 Disconnecting Instagram session for ${instagramUsername}...`);
        
        // Properly logout to clean session
        try {
          await instagramClient.account.logout();
        } catch (logoutError) {
          console.log('⚠️ Logout API call failed (may already be disconnected)');
        }
        
        instagramClient = null;
        isInstagramReady = false;
        instagramUsername = null;
        lastActivityTime = null;
        
        console.log('✅ Instagram disconnected successfully');
      }

      res.json({ 
        success: true, 
        message: 'Disconnected successfully' 
      });

    } catch (error) {
      console.error('❌ Instagram disconnection error:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Instagram Status Endpoint
  router.get('/instagram/status', (req, res) => {
    res.json({
      isReady: isInstagramReady,
      username: instagramUsername || 'Not connected',
      currentOperation: currentInstagramOperation,
      lastActivity: lastActivityTime ? new Date(lastActivityTime).toISOString() : null
    });
  });

  // Instagram Search and Message Endpoint with Real-Time Progress
  router.post('/instagram/search-and-message', async (req, res) => {
    try {
      const { 
        searchQuery, 
        messageTemplate, 
        maxAccounts, 
        specificAccounts,
        searchType, // 'users', 'hashtag', or 'location'
        runInBackground,
        backgroundTaskId
      } = req.body;
      
      if (!messageTemplate) {
        return res.status(400).json({ 
          success: false, 
          error: 'Message template is required' 
        });
      }

      if (!isInstagramReady) {
        return res.status(503).json({ 
          success: false, 
          error: 'Instagram is not connected. Use "Connect to Instagram" first.' 
        });
      }

      if (isActiveInstagramOperation(currentInstagramOperation)) {
        return res.status(409).json({
          success: false,
          error: 'Instagram automation is already running. Wait for it to finish before starting another run.'
        });
      }

      const safetyRules = resolveInstagramSafetyRules({
        maxAccounts,
        minDelayMs: req.body.minDelayMs || req.body.safetyRules?.minDelayMs,
        maxDelayMs: req.body.maxDelayMs || req.body.safetyRules?.maxDelayMs,
        breakEvery: req.body.breakEvery || req.body.safetyRules?.breakEvery
      });
      const normalizedSpecificAccounts = parseSpecificAccounts(specificAccounts).slice(0, safetyRules.maxAccounts);

      if (runInBackground) {
        const backgroundParams = {
          searchQuery,
          messageTemplate,
          maxAccounts: safetyRules.maxAccounts,
          specificAccounts: normalizedSpecificAccounts,
          searchType,
          safetyRules,
          backgroundTaskId: null,
          runInBackground: false
        };

        return res.json(startInstagramBackgroundTask({
          taskManager,
          params: backgroundParams,
          runner: async ({ taskId, params }) => {
            const progressTimer = setInterval(() => {
              if (!currentInstagramOperation) return;

              const total = currentInstagramOperation.total || 1;
              const progress = Math.round((currentInstagramOperation.progress / total) * 100);
              const current = currentInstagramOperation.current ? `Current: @${currentInstagramOperation.current}` : currentInstagramOperation.status;
              taskManager.updateTaskProgress(taskId, progress, current);
            }, 2000);

            try {
              const internalParams = {
                ...params,
                backgroundTaskId: taskId
              };
              const response = await fetch(`http://127.0.0.1:${PORT}/api/instagram/search-and-message`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'X-App-Access-Token': ACCESS_TOKEN
                },
                body: JSON.stringify(internalParams)
              });
              const result = await response.json();

              if (!response.ok || !result.success) {
                throw new Error(result.error || 'Instagram background automation failed');
              }

              return result;
            } finally {
              clearInterval(progressTimer);
            }
          }
        }));
      }

      // Set current operation for progress tracking
      currentInstagramOperation = createInitialOperation({
        total: normalizedSpecificAccounts.length || safetyRules.maxAccounts
      });

      // Log function
      const addLog = (message, type = 'info') => {
        const log = {
          message,
          type, // 'info', 'success', 'error', 'warning'
          timestamp: new Date().toISOString()
        };
        currentInstagramOperation.logs.push(log);
        console.log(`[Instagram] ${message}`);
      };

      addLog(`🔍 Starting Instagram automation: "${searchQuery}"`, 'info');
      await taskManager.waitIfPausedOrCancelled(backgroundTaskId);
      
      const results = [];
      let accountsToMessage = [];

      // 1. Get accounts based on search type or specific accounts
      if (normalizedSpecificAccounts.length > 0) {
        addLog(`📋 Using ${normalizedSpecificAccounts.length} specific accounts`, 'info');
        accountsToMessage = normalizedSpecificAccounts.map(username => ({ username }));
      } else {
        currentInstagramOperation.status = 'searching';
        addLog(`🔎 Searching for: "${searchQuery}"`, 'info');

        try {
          await taskManager.waitIfPausedOrCancelled(backgroundTaskId);

          if (searchType === 'hashtag') {
            // Search by hashtag
            addLog(`#️⃣ Searching hashtag: #${searchQuery}`, 'info');
            const feed = instagramClient.feed.tag(searchQuery);
            const posts = await feed.items();
            
            addLog(`✅ Found ${posts.length} posts with #${searchQuery}`, 'success');
            
            const uniqueUsers = new Map();
            for (const post of posts) {
              if (!uniqueUsers.has(post.user.pk)) {
                uniqueUsers.set(post.user.pk, {
                  pk: post.user.pk,
                  username: post.user.username,
                  fullName: post.user.full_name
                });
              }
            }
            
            accountsToMessage = Array.from(uniqueUsers.values()).slice(0, safetyRules.maxAccounts);
            addLog(`📊 Found ${accountsToMessage.length} unique users`, 'info');
            
          } else {
            // Search users
            addLog(`👤 Searching users: "${searchQuery}"`, 'info');
            const searchResults = await instagramClient.search.search(searchQuery);
            const users = searchResults.users || [];
            
            addLog(`✅ Found ${users.length} users`, 'success');
            
            accountsToMessage = users.slice(0, safetyRules.maxAccounts).map(user => ({
              pk: user.pk,
              username: user.username,
              fullName: user.full_name
            }));
          }
        } catch (error) {
          addLog(`❌ Search failed: ${error.message}`, 'error');
          throw error;
        }
      }

      currentInstagramOperation.total = accountsToMessage.length;
      currentInstagramOperation.status = 'messaging';
      addLog(`📨 Starting to send messages to ${accountsToMessage.length} accounts`, 'info');

      // 2. Send messages to each account
      for (let i = 0; i < accountsToMessage.length; i++) {
        const account = accountsToMessage[i];
        const username = account.username;
        
        currentInstagramOperation.current = username;
        currentInstagramOperation.progress = i + 1;
        
        try {
          await taskManager.waitIfPausedOrCancelled(backgroundTaskId);
          addLog(`[${i + 1}/${accountsToMessage.length}] Processing @${username}...`, 'info');
          
          // Get user ID if not provided
          let userId = account.pk;
          if (!userId) {
            const user = await instagramClient.user.searchExact(username);
            userId = user.pk;
          }
          
          // Get user info
          const userInfo = await instagramClient.user.info(userId);
          
          // Check if private and not following
          if (userInfo.is_private && !userInfo.friendship_status.following) {
            addLog(`⚠️ Skipping @${username} (private account)`, 'warning');
            
            results.push({
              username: username,
              fullName: account.fullName || userInfo.full_name,
              messageSent: false,
              reason: 'Private account',
              skipped: true
            });
            
            continue;
          }
          
          // ANTI-DETECTION: Add cooling period if needed
          await addCoolingPeriod(backgroundTaskId);
          
          // Send message
          addLog(`💬 Sending message to @${username}...`, 'info');
          const thread = await instagramClient.entity.directThread([userId.toString()]);
          await taskManager.waitIfPausedOrCancelled(backgroundTaskId);
          await thread.broadcastText(messageTemplate);
          
          currentInstagramOperation.sent++;
          addLog(`✅ Message sent to @${username}`, 'success');
          
          results.push({
            username: username,
            fullName: account.fullName || userInfo.full_name,
            followerCount: userInfo.follower_count,
            followingCount: userInfo.following_count,
            isVerified: userInfo.is_verified,
            isPrivate: userInfo.is_private,
            biography: userInfo.biography,
            messageSent: true
          });
          
          // ANTI-DETECTION: Enhanced human-like delays
          // Vary delay based on number of messages sent (longer delays after more messages)
          const delayMs = getHumanDelay(safetyRules.minDelayMs, safetyRules.maxDelayMs);
          const delaySec = (delayMs / 1000).toFixed(1);
          
          addLog(`⏳ Human-like delay: ${delaySec}s before next message...`, 'info');
          await taskManager.controlledDelay(backgroundTaskId, delayMs);
          
          // ANTI-DETECTION: Add extra pause every few messages (simulate user checking phone)
          if (currentInstagramOperation.sent % safetyRules.breakEvery === 0 && currentInstagramOperation.sent > 0) {
            const breakTime = getHumanDelay(safetyRules.breakMinMs, safetyRules.breakMaxMs);
            addLog(`☕ Taking a natural break (${(breakTime / 1000).toFixed(0)}s) to simulate human behavior...`, 'info');
            await taskManager.controlledDelay(backgroundTaskId, breakTime);
          }
          
        } catch (error) {
          if (isTaskCancellationError(error)) {
            addLog(`Operation cancelled: ${error.message}`, 'warning');
            throw error;
          }

          currentInstagramOperation.failed++;
          addLog(`❌ Failed to message @${username}: ${error.message}`, 'error');
          
          results.push({
            username: username,
            fullName: account.fullName || '',
            messageSent: false,
            error: error.message
          });
          // Stop on platform safety signals such as rate limits, checkpoints, or challenges.
          if (safetyRules.stopOnRateLimit && isInstagramStopSignal(error)) {
            addLog('Instagram safety stop triggered. Stopping this run before sending more messages.', 'error');
            break;
          }
        }
      }

      currentInstagramOperation.status = 'completed';
      addLog(`✅ Operation completed! Sent: ${currentInstagramOperation.sent}, Failed: ${currentInstagramOperation.failed}`, 'success');
      
      res.json({ 
        success: true, 
        totalFound: accountsToMessage.length,
        sent: currentInstagramOperation.sent,
        failed: currentInstagramOperation.failed,
        results: results,
        logs: currentInstagramOperation.logs
      });
      
    } catch (error) {
      console.error('Instagram automation error:', error);
      
      if (currentInstagramOperation) {
        currentInstagramOperation.status = 'error';
        currentInstagramOperation.logs.push({
          message: `Fatal error: ${error.message}`,
          type: 'error',
          timestamp: new Date().toISOString()
        });
      }
      
      res.status(500).json({ 
        success: false, 
        error: error.message,
        logs: currentInstagramOperation?.logs || []
      });
    }
  });

  // Get current operation progress (for polling)
  router.get('/instagram/progress', (req, res) => {
    res.json({
      operation: currentInstagramOperation
    });
  });

  // Search only (no messaging)
  router.post('/instagram/search-only', async (req, res) => {
    try {
      const { searchQuery, searchType, maxAccounts } = req.body;
      const normalizedSearchQuery = typeof searchQuery === 'string' ? searchQuery.trim() : '';
      const safetyRules = resolveInstagramSafetyRules({ maxAccounts });

      if (!normalizedSearchQuery) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required'
        });
      }
      
      if (!isInstagramReady) {
        return res.status(503).json({ 
          success: false, 
          error: 'Instagram is not connected' 
        });
      }

      if (isActiveInstagramOperation(currentInstagramOperation)) {
        return res.status(409).json({
          success: false,
          error: 'Instagram automation is already running. Wait for it to finish before starting another Instagram search.'
        });
      }

      console.log(`🔍 Instagram search only: ${searchQuery}`);
      
      let accountsList = [];
      
      if (searchType === 'hashtag') {
        const feed = instagramClient.feed.tag(normalizedSearchQuery);
        const posts = await feed.items();
        
        const uniqueUsers = new Map();
        for (const post of posts) {
          if (!uniqueUsers.has(post.user.pk)) {
            uniqueUsers.set(post.user.pk, {
              pk: post.user.pk,
              username: post.user.username,
              fullName: post.user.full_name
            });
          }
        }
        
        accountsList = Array.from(uniqueUsers.values()).slice(0, safetyRules.maxAccounts);
      } else {
        const searchResults = await instagramClient.search.search(normalizedSearchQuery);
        accountsList = (searchResults.users || []).slice(0, safetyRules.maxAccounts);
      }
      
      const detailedResults = [];
      
      for (const account of accountsList) {
        try {
          const userInfo = await instagramClient.user.info(account.pk);
          
          detailedResults.push({
            username: account.username,
            fullName: account.full_name || userInfo.full_name,
            isVerified: userInfo.is_verified,
            isPrivate: userInfo.is_private,
            followerCount: userInfo.follower_count,
            followingCount: userInfo.following_count,
            biography: userInfo.biography,
            externalUrl: userInfo.external_url,
            profilePicUrl: account.profile_pic_url
          });
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          
        } catch (error) {
          console.error(`Failed to get info for @${account.username}:`, error.message);
        }
      }
      
      res.json({ 
        success: true, 
        totalFound: accountsList.length,
        results: detailedResults
      });
      
    } catch (error) {
      console.error('Instagram search error:', error);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // ===== EMAIL EXTRACTION ENDPOINT =====

  // Extract emails from business websites


  return router;
}

module.exports = { createInstagramRoutes };
