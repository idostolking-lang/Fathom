const express = require('express');
const { extractWebsiteFrontend, formatWebsiteContext } = require('../../lib/websiteExtractor');

function createAiRoutes({ openai }) {
  const router = express.Router();

  router.post('/generate-message', async (req, res) => {
    try {
      const { businessName } = req.body;

      if (!businessName) {
        return res.status(400).json({ 
          success: false, 
          error: 'Business name is required' 
        });
      }

      console.log(`🤖 Generating message suggestion for: ${businessName}`);

      const completion = await openai.chat.completions.create({
        model: req.body.model || process.env.OPENAI_MODEL || "gpt-4o",
        messages: [
          {
            role: "system",
            content: "You write professional marketing messages for small businesses. Your messages should be business-like, friendly, polite, short (2-3 sentences), and persuasive. The goal is to offer them a website build. Use a warm, professional tone."
          },
          {
            role: "user",
            content: `Write a short marketing message for a business named "${businessName}" offering to build them a website. The message should be direct, professional, and friendly.`
          }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const suggestion = completion.choices[0].message.content;
      console.log(`✅ Generated suggestion for ${businessName}`);

      res.json({ 
        success: true, 
        suggestion: suggestion 
      });

    } catch (error) {
      console.error('Error generating message:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // WhatsApp Status Endpoint

  router.post('/analyze-websites', async (req, res) => {
    try {
      const { businesses, instructions, customMode } = req.body;

      if (!businesses || businesses.length === 0) {
        return res.status(400).json({ 
          success: false, 
          error: 'No businesses provided' 
        });
      }

      if (!instructions) {
        return res.status(400).json({ 
          success: false, 
          error: 'Search instructions are required' 
        });
      }

      console.log(`🔍 Starting website analysis for ${businesses.length} businesses...`);
      console.log(`🔓 Custom Mode: ${customMode ? 'ENABLED (Full user control)' : 'Disabled (AI guidelines active)'}`);

      try {
        const results = [];
        
        // Analyze each website
        for (let i = 0; i < businesses.length; i++) {
          const business = businesses[i];
          const businessName = business.Name || business.name || 'Unknown Business';
          const website = business.Website || business.website || '';

          if (!website) {
            results.push({
              name: businessName,
              website: 'N/A',
              analysis: 'No website available'
            });
            continue;
          }

          console.log(`📄 Analyzing ${i + 1}/${businesses.length}: ${businessName} - ${website}`);

          try {
            const frontendSnapshot = await extractWebsiteFrontend(website);
            const pageContent = formatWebsiteContext(frontendSnapshot);

            console.log(`📄 Extracted ${pageContent.length} characters of rendered frontend and JS context from ${businessName}`);

            // Prepare messages based on customMode
            let messages;
            if (customMode) {
              // Custom Mode: User instructions become the system prompt
              messages = [
                {
                  role: "system",
                  content: instructions
                },
                {
                  role: "user",
                  content: `Business: ${businessName}
  Website: ${website}

  Website Content:
  ${pageContent}

  Now, analyze the website exactly according to the instructions you received in the system. Write a complete and detailed report.`
                }
              ];
            } else {
              // Normal Mode: AI guidelines + user instructions
              messages = [
                {
                  role: "system",
                  content: "You are a professional business analyst. Analyze website content based on specific instructions and provide detailed, comprehensive insights in English. Write complete analyses without cutting off mid-sentence."
                },
                {
                  role: "user",
                  content: `Business: ${businessName}
  Website: ${website}

  Instructions: ${instructions}

  Website Content:
  ${pageContent}

  Please analyze the website content according to the instructions above and provide a COMPLETE and detailed report in English. Be specific, professional, and thorough. Make sure to finish all your thoughts and sentences - do not cut off in the middle.`
                }
              ];
            }

            // Use GPT-4o to analyze the content
            const completion = await openai.chat.completions.create({
              model: req.body.model || process.env.OPENAI_MODEL || "gpt-4o",
              messages: messages,
              temperature: 0.7,
              max_tokens: 2500
            });

            const analysis = completion.choices[0].message.content;
            const tokensUsed = completion.usage;
            
            results.push({
              name: businessName,
              website: website,
              analysis: analysis,
              extraction: frontendSnapshot.diagnostics
            });

            console.log(`✅ Analyzed ${businessName}`);
            console.log(`   📊 Tokens: ${tokensUsed.prompt_tokens} prompt + ${tokensUsed.completion_tokens} completion = ${tokensUsed.total_tokens} total`);
            console.log(`   📝 Analysis length: ${analysis.length} characters`);

          } catch (error) {
            console.error(`❌ Error analyzing ${businessName}:`, error.message);
            results.push({
              name: businessName,
              website: website,
              analysis: `Analysis error: ${error.message}`
            });
          }

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Compile comprehensive report
        let report = `📊 Website Analysis Report - ${businesses.length} businesses\n`;
        report += `📅 Date: ${new Date().toLocaleDateString('en-US')}\n`;
        report += `🔍 Search instructions: ${instructions}\n\n`;
        report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;

        results.forEach((result, index) => {
          report += `${index + 1}. ${result.name}\n`;
          report += `🌐 ${result.website}\n\n`;
          report += `${result.analysis}\n\n`;
          report += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n`;
        });

        // Add GPT summary and suggestions
        try {
          console.log(`📊 Generating comprehensive summary for ${businesses.length} businesses...`);
          
          let summaryMessages;
          if (customMode) {
            // Custom Mode: User instructions for summary as well
            summaryMessages = [
              {
                role: "system",
                content: instructions
              },
              {
                role: "user",
                content: `Based on the analyses of ${businesses.length} businesses, here are the individual results:

  ${results.map(r => `${r.name}: ${r.analysis}`).join('\n\n')}

  Now, write a general summary according to the instructions you received in the system. Write a complete and comprehensive summary.`
              }
            ];
          } else {
            // Normal Mode
            summaryMessages = [
              {
                role: "system",
                content: "You are a professional business consultant. Provide detailed, high-level insights and actionable recommendations based on website analysis in English. Write complete, comprehensive summaries without cutting off."
              },
              {
                role: "user",
                content: `Based on the analysis of ${businesses.length} businesses with these instructions: "${instructions}", here are the individual results:

  ${results.map(r => `${r.name}: ${r.analysis}`).join('\n\n')}

  Please provide a COMPLETE and DETAILED summary including:
  1. Key insights and patterns from ALL businesses
  2. Specific actionable recommendations
  3. Overall summary and conclusions

  Write in English, be professional, specific, and thorough. Make sure to complete all your thoughts - do not cut off in the middle.`
              }
            ];
          }
          
          const summaryCompletion = await openai.chat.completions.create({
            model: req.body.model || process.env.OPENAI_MODEL || "gpt-4o",
            messages: summaryMessages,
            temperature: 0.7,
            max_tokens: 3500
          });

          const summaryText = summaryCompletion.choices[0].message.content;
          const summaryTokens = summaryCompletion.usage;
          
          report += `\n\n📝 General Summary and Recommendations:\n\n`;
          report += summaryText;

          console.log(`✅ Summary generated`);
          console.log(`   📊 Tokens: ${summaryTokens.prompt_tokens} prompt + ${summaryTokens.completion_tokens} completion = ${summaryTokens.total_tokens} total`);
          console.log(`   📝 Summary length: ${summaryText.length} characters`);

        } catch (summaryError) {
          console.error('Error generating summary:', summaryError.message);
        }

        console.log(`✅ Website analysis complete for ${businesses.length} businesses`);
        console.log(`📄 Final report length: ${report.length} characters`);

        res.json({ 
          success: true, 
          report: report,
          details: results
        });

      } catch (error) {
        throw error;
      }

    } catch (error) {
      console.error('Error in website analysis:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Generate Marketing Message from Report
  router.post('/generate-marketing-message', async (req, res) => {
    try {
      const { report, reportInstructions, messageInstructions, customMode } = req.body;

      if (!report) {
        return res.status(400).json({ 
          success: false, 
          error: 'Report is required' 
        });
      }

      if (!messageInstructions) {
        return res.status(400).json({ 
          success: false, 
          error: 'Message instructions are required' 
        });
      }

      console.log(`📝 Generating marketing message from report...`);
      console.log(`📊 Report length: ${report.length} characters`);
      console.log(`🔍 Report instructions: ${reportInstructions ? reportInstructions.substring(0, 100) : 'N/A'}...`);
      console.log(`✍️ Message instructions: ${messageInstructions.substring(0, 100)}...`);
      console.log(`🔓 Custom Mode: ${customMode ? 'ENABLED (Full user control)' : 'Disabled (AI guidelines active)'}`);

      let messages;

      if (customMode) {
        // Custom Mode: User has FULL control - their instructions become the system prompt
        console.log('🔓 Custom Mode Active - Using user instructions as core behavior');
        messages = [
          {
            role: "system",
            content: messageInstructions // User instructions are now the ONLY instructions
          },
          {
            role: "user",
            content: `Based on the following detailed report:

  ${reportInstructions ? `The original search instructions that created the report: ${reportInstructions}\n\n` : ''}Full research report:
  ${report}

  Now, write the message exactly according to the instructions you received in the system.`
          }
        ];
      } else {
        // Normal Mode: AI guidelines + user instructions
        messages = [
          {
            role: "system",
            content: `You are a professional marketing expert. Your task is to analyze business research reports and write marketing messages according to specific instructions in English.

  Key principles:
  - Business-like and professional
  - Pleasant and warm in tone
  - Clear and direct to the point
  - Persuasive and engaging
  - Detailed and comprehensive
  - Written in proper, professional English
  - Personalized based on all the findings in the report
  - Covering all the important points from the report

  Always follow the specific instructions you receive from the user regarding tone, length, and content.
  Do not write a title or subject line - only the full content of the message itself.`
          },
          {
            role: "user",
            content: `Based on the following detailed report, write a marketing message in English.

  ${reportInstructions ? `The original search instructions that created the report: ${reportInstructions}\n\n` : ''}Full research report:
  ${report}

  ====================
  Instructions for writing the message (very important!):
  ${messageInstructions}
  ====================

  Write a marketing message that meets all the instructions above, references the findings in the report, and is ready to send directly. Do not shorten or cut off in the middle - make sure the message is whole and complete.`
          }
        ];
      }

      // Use GPT-4o to create a marketing message
      const completion = await openai.chat.completions.create({
        model: req.body.model || process.env.OPENAI_MODEL || "gpt-4o",
        messages: messages,
        temperature: 0.8,
        max_tokens: 3000
      });

      const marketingMessage = completion.choices[0].message.content;
      const tokensUsed = completion.usage;
      
      console.log(`✅ Marketing message generated successfully`);
      console.log(`📈 Tokens used: ${tokensUsed.prompt_tokens} prompt + ${tokensUsed.completion_tokens} completion = ${tokensUsed.total_tokens} total`);
      console.log(`📝 Message length: ${marketingMessage.length} characters`);

      res.json({ 
        success: true, 
        message: marketingMessage
      });

    } catch (error) {
      console.error('Error generating marketing message:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Analyze Messages with AI (Advanced Chat Analysis)
  router.post('/analyze-messages', async (req, res) => {
    try {
      const { messages, photos, behaviorInstructions } = req.body;

      if (!messages && (!photos || photos.length === 0)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Messages or photos are required' 
        });
      }

      // Behavior instructions are optional for photos (preset behavior), but required for text/files
      if (!behaviorInstructions && (!photos || photos.length === 0)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Behavior instructions are required for text/file analysis' 
        });
      }

      console.log(`💬 Starting message analysis...`);
      console.log(`📝 Messages length: ${messages ? messages.length : 0} characters`);
      console.log(`📸 Photos: ${photos ? photos.length : 0}`);
      console.log(`🧠 Behavior instructions length: ${behaviorInstructions ? behaviorInstructions.length : 0} characters`);

      // Prepare messages array for GPT-4o with vision
      const messagesList = [];

      // Different behavior based on input type
      let systemPrompt = '';
      
      if (photos && photos.length > 0) {
        // PHOTOS MODE: Use preset behavior for image analysis
        systemPrompt = `You are an advanced AI with vision capabilities. You can see, read, and analyze images perfectly.

  Your task:
  1. Carefully examine all images provided
  2. Transcribe ALL visible text from the images accurately
  3. Analyze the messages/conversations shown in the images
  4. Provide a comprehensive, detailed analysis

  You MUST read the images. You have full vision capabilities. Analyze the content thoroughly and professionally.`;
        
        console.log('📸 Using PRESET PHOTO ANALYSIS behavior');
      } else {
        // TEXT/FILES MODE: User instructions are the ONLY instructions
        // Strengthen the prompt to ensure AI follows instructions precisely
        systemPrompt = `${behaviorInstructions}

  CRITICAL: You MUST embody the personality, tone, and style described above COMPLETELY. This is not a suggestion - it is your ONLY way of operating. Respond EXACTLY as instructed. Do not revert to generic AI responses. Stay in character and follow the instructions with absolute precision.`;
        
        console.log('📝 Using USER CUSTOM behavior (text/files mode) - ENFORCED');
      }
      
      messagesList.push({
        role: "system",
        content: systemPrompt
      });

      // Build user message content
      const userContent = [];

      // Add text messages if available
      if (messages && messages.trim()) {
        let textPrompt = `Here are the messages to analyze:\n\n${messages}\n\n`;
        
        // For text/files mode, reinforce the custom behavior
        if (!photos || photos.length === 0) {
          textPrompt += `Now analyze these messages EXACTLY as you were instructed. Stay completely in character. Use the exact tone, style, and approach you were given. Do not break character. Respond as the personality you were assigned.`;
        } else {
          textPrompt += `Please analyze the messages thoroughly according to your instructions.`;
        }
        
        userContent.push({
          type: "text",
          text: textPrompt
        });
      }

      // Add photos if available (GPT-4o Vision capability)
      if (photos && photos.length > 0) {
        photos.forEach((photo, index) => {
          userContent.push({
            type: "image_url",
            image_url: {
              url: photo.data,
              detail: "high" // Use high detail for better OCR and analysis
            }
          });
        });
        
        // Add instruction for photos
        let photoPrompt = '';
        if (!messages || !messages.trim()) {
          photoPrompt = `I've uploaded ${photos.length} photo(s) containing messages or conversations.\n\nPlease read all visible text from the images and provide a detailed analysis.`;
        } else {
          photoPrompt = `Additionally, I've provided ${photos.length} image(s). Please analyze both the text messages and the images.`;
        }
        
        // Add user's behavior instructions as additional guidance if provided
        if (behaviorInstructions && behaviorInstructions.trim()) {
          photoPrompt += `\n\nAdditional instructions from user:\n${behaviorInstructions}`;
        }
        
        userContent.push({
          type: "text",
          text: photoPrompt
        });
      }

      messagesList.push({
        role: "user",
        content: userContent
      });

      console.log('🚀 Sending request to GPT-4o...');
      console.log(`📊 Using model: gpt-4o (with vision and extended context)`);

      // Adjust temperature based on mode
      // Text/Files mode: Higher temperature for more personality and creativity
      // Photos mode: Lower temperature for more accurate transcription
      const temperature = (photos && photos.length > 0) ? 0.7 : 0.9;
      const presencePenalty = (photos && photos.length > 0) ? 0.1 : 0.3;
      
      console.log(`🌡️ Temperature: ${temperature} | Presence Penalty: ${presencePenalty}`);

      // Use GPT-4o for advanced analysis with huge context window
      const completion = await openai.chat.completions.create({
        model: req.body.model || process.env.OPENAI_MODEL || "gpt-4o", // Latest model with vision, huge context, and advanced reasoning
        messages: messagesList,
        temperature: temperature,
        max_tokens: 16000, // Huge response for comprehensive analysis
        presence_penalty: presencePenalty,
        frequency_penalty: 0.1
      });

      const analysis = completion.choices[0].message.content;
      const tokensUsed = completion.usage;
      
      console.log(`✅ Message analysis complete!`);
      console.log(`📈 Tokens used: ${tokensUsed.prompt_tokens} prompt + ${tokensUsed.completion_tokens} completion = ${tokensUsed.total_tokens} total`);
      console.log(`📝 Analysis length: ${analysis.length} characters`);
      console.log(`💡 Finish reason: ${completion.choices[0].finish_reason}`);

      res.json({ 
        success: true, 
        analysis: analysis,
        tokensUsed: tokensUsed.total_tokens
      });

    } catch (error) {
      console.error('Error analyzing messages:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // ===== INSTAGRAM AUTOMATION WITH ENHANCED SECURITY =====

  // Instagram Client

  // Store active consultant sessions (in-memory, could be moved to database)
  const consultantSessions = new Map();

  // Consultant Chat Endpoint with Conversation History
  router.post('/consultant-chat', async (req, res) => {
    try {
      const { sessionId, message, photos, model, behaviorInstructions, conversationHistory } = req.body;

      if (!sessionId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Session ID is required' 
        });
      }

      if (!message && (!photos || photos.length === 0)) {
        return res.status(400).json({ 
          success: false, 
          error: 'Message or photos are required' 
        });
      }

      if (!model) {
        return res.status(400).json({ 
          success: false, 
          error: 'Model selection is required' 
        });
      }

      console.log(`💬 Consultant chat request - Session: ${sessionId}, Model: ${model}`);
      console.log(`📝 Message length: ${message ? message.length : 0} characters`);
      console.log(`📸 Photos: ${photos ? photos.length : 0}`);
      console.log(`📜 Conversation history: ${conversationHistory ? conversationHistory.length : 0} messages`);

      // Prepare messages array for GPT
      const messages = [];

      // Add system message with behavior instructions
      if (behaviorInstructions && behaviorInstructions.trim()) {
        messages.push({
          role: "system",
          content: behaviorInstructions
        });
      } else {
        // Default behavior if none provided
        messages.push({
          role: "system",
          content: "You are a helpful AI consultant. Provide thoughtful, detailed, and actionable advice. Be professional, clear, and supportive."
        });
      }

      // Add conversation history
      if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach(msg => {
          messages.push({
            role: msg.role,
            content: msg.content
          });
        });
      }

      // Build current user message content
      const userContent = [];

      // Add text message if available
      if (message && message.trim()) {
        userContent.push({
          type: "text",
          text: message
        });
      }

      // Add photos if available (for vision-capable models)
      if (photos && photos.length > 0) {
        photos.forEach(photo => {
          userContent.push({
            type: "image_url",
            image_url: {
              url: photo.data,
              detail: "high"
            }
          });
        });
      }

      // Add current user message
      messages.push({
        role: "user",
        content: userContent
      });

      console.log(`🚀 Sending request to ${model}...`);

      // Check if model supports vision
      const visionModels = ['gpt-4o', 'gpt-4o-mini'];
      const supportsVision = visionModels.includes(model);

      if (!supportsVision && photos && photos.length > 0) {
        return res.status(400).json({ 
          success: false, 
          error: `Model ${model} does not support image analysis. Please use gpt-4o or gpt-4o-mini for photo uploads.` 
        });
      }

      // Call OpenAI API
      const completion = await openai.chat.completions.create({
        model: model,
        messages: messages,
        temperature: 0.8,
        max_tokens: 4000,
        presence_penalty: 0.3,
        frequency_penalty: 0.1
      });

      const reply = completion.choices[0].message.content;
      const tokensUsed = completion.usage;
      
      console.log(`✅ Consultant response generated`);
      console.log(`📊 Tokens: ${tokensUsed.prompt_tokens} prompt + ${tokensUsed.completion_tokens} completion = ${tokensUsed.total_tokens} total`);
      console.log(`📝 Reply length: ${reply.length} characters`);

      // Store session (optional, for tracking)
      if (!consultantSessions.has(sessionId)) {
        consultantSessions.set(sessionId, {
          startTime: new Date(),
          messageCount: 0,
          totalTokens: 0,
          model: model
        });
      }
      
      const session = consultantSessions.get(sessionId);
      session.messageCount++;
      session.totalTokens += tokensUsed.total_tokens;
      session.lastActivity = new Date();

      res.json({ 
        success: true, 
        reply: reply,
        tokensUsed: tokensUsed.total_tokens,
        messageCount: session.messageCount,
        sessionStats: {
          totalMessages: session.messageCount,
          totalTokens: session.totalTokens,
          model: session.model
        }
      });

    } catch (error) {
      console.error('Error in consultant chat:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // End Consultant Session
  router.post('/consultant-chat/end-session', async (req, res) => {
    try {
      const { sessionId } = req.body;

      if (!sessionId) {
        return res.status(400).json({ 
          success: false, 
          error: 'Session ID is required' 
        });
      }

      if (consultantSessions.has(sessionId)) {
        const session = consultantSessions.get(sessionId);
        console.log(`🔚 Ending consultant session ${sessionId}`);
        console.log(`📊 Session stats: ${session.messageCount} messages, ${session.totalTokens} tokens`);
        consultantSessions.delete(sessionId);
      }

      res.json({ 
        success: true, 
        message: 'Session ended successfully' 
      });

    } catch (error) {
      console.error('Error ending consultant session:', error.message);
      res.status(500).json({ 
        success: false, 
        error: error.message 
      });
    }
  });

  // Start server


  return router;
}

module.exports = { createAiRoutes };
