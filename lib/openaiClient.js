const OpenAI = require('openai');
const { requireConfigValue } = require('./config');

function createDisabledOpenAIClient(errorMessage) {
  const create = async () => {
    throw new Error(errorMessage);
  };

  return {
    chat: {
      completions: {
        create
      }
    }
  };
}

function createOpenAIClient(config, OpenAIClient = OpenAI) {
  try {
    const apiKey = requireConfigValue(
      config,
      'OPENAI_API_KEY',
      'OpenAI API key is required. Set OPENAI_API_KEY in .env to use AI features.'
    );

    return new OpenAIClient({ apiKey });
  } catch (error) {
    console.warn(`OpenAI disabled: ${error.message}`);
    return createDisabledOpenAIClient(error.message);
  }
}

module.exports = {
  createOpenAIClient,
  createDisabledOpenAIClient
};
