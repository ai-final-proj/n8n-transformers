// n8n Function Node - OpenAI/HuggingFace API Call
// Input: JSON with 'content' or 'prompt' field containing the message
// Output: Chat completion response

const OpenAI = require('openai');

const client = new OpenAI({
    baseURL: "https://router.huggingface.co/v1",
    apiKey: "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",
});

async function generateCompletion(content) {
    try {
        console.log('Calling OpenAI API with content:', content.substring(0, 100) + '...');

        const chatCompletion = await client.chat.completions.create({
            model: "openai/gpt-oss-20b:fireworks-ai",
            messages: [
                {
                    role: "user",
                    content,
                },
            ],
            // Optional parameters you might want to add:
            temperature: 0.7,
            max_tokens: 1000,
        });

        console.log('API call successful');

        return {
            success: true,
            content: chatCompletion.choices[0].message.content,
            usage: chatCompletion.usage,
            model: chatCompletion.model,
            fullResponse: chatCompletion
        };

    } catch (error) {
        console.error('API call failed:', error);

        return {
            success: false,
            error: error.message,
            code: error.code,
            type: error.type,
            details: error
        };
    }
}

// Main n8n function
return (async () => {
    const inputData = $input.all();

    if (!inputData || inputData.length === 0) {
        return [{
            json: {
                success: false,
                error: 'No input data provided'
            }
        }];
    }

    // Extract content from input - try multiple possible field names
    const firstItem = inputData[0].json;
    const content = firstItem.content || firstItem.prompt || firstItem.message || firstItem.text;

    if (!content) {
        return [{
            json: {
                success: false,
                error: 'No content, prompt, message, or text field found in input'
            }
        }];
    }

    const result = await generateCompletion(content);

    return [{ json: result }];
})();

