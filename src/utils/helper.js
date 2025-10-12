
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Parses JSON from a string that may contain extra symbols before or after it.
 * Example: "some text {'key1': 'value1', 'key2': 'value2'} more text"
 */
export function extractAndParseJson(inputString) {
  // Look for content between curly braces (including the braces)
  const jsonPattern = /(\{.*?\})/s; // 's' flag = dot matches newlines
  const match = inputString.match(jsonPattern);

  if (match) {
    let jsonStr = match[1];

    // Convert Python-style single quotes to JSON-compatible double quotes
    jsonStr = jsonStr.replace(/'/g, '"');

    try {
      const parsedJson = JSON.parse(jsonStr);
      return parsedJson;
    } catch (e) {
      throw new Error(`Error parsing JSON: ${e.message}`);
    }
  } else {
    throw new Error('No JSON object found in the string');
  }
}
