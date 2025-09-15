const { GoogleGenerativeAI } = require('@google/generative-ai');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI('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');

/**
 * Extract Aadhar number and name from Aadhar card image using Gemini AI
 * @param {Buffer} imageBuffer - The image buffer
 * @param {string} mimeType - The MIME type of the image
 * @returns {Promise<{aadharNumber: string, name: string, confidence: number}>}
 */
async function extractAadharInfo(imageBuffer, mimeType) {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    
    // Convert buffer to base64
    const base64Image = imageBuffer.toString('base64');
    
    const prompt = `
    Analyze this Aadhar card image and extract the following information:
    1. Aadhar number (12-digit number)
    2. Full name as written on the card
    3. Provide confidence level (0-100) for the extraction
    
    Please respond in the following JSON format:
    {
      "aadharNumber": "123456789012",
      "name": "Full Name as on Card",
      "confidence": 95
    }
    
    If you cannot extract any information, set the value to null and confidence to 0.
    Only return the JSON response, no additional text.
    `;

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: base64Image,
          mimeType: mimeType
        }
      }
    ]);

    const response = await result.response;
    const text = response.text();
    
    // Parse the JSON response
    const extractedData = JSON.parse(text);
    
    return {
      aadharNumber: extractedData.aadharNumber || null,
      name: extractedData.name || null,
      confidence: extractedData.confidence || 0
    };
    
  } catch (error) {
    console.error('Error extracting Aadhar info:', error);
    throw new Error('Failed to extract Aadhar information');
  }
}

/**
 * Verify if the entered name matches the name on Aadhar card
 * @param {string} enteredName - Name entered by user
 * @param {string} aadharName - Name extracted from Aadhar card
 * @returns {boolean}
 */
function verifyNameMatch(enteredName, aadharName) {
  if (!enteredName || !aadharName) return false;
  
  // Normalize names for comparison
  const normalizeName = (name) => {
    return name.toLowerCase()
      .replace(/[^\w\s]/g, '') // Remove special characters
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  };
  
  const normalizedEntered = normalizeName(enteredName);
  const normalizedAadhar = normalizeName(aadharName);
  
  // Check for exact match
  if (normalizedEntered === normalizedAadhar) return true;
  
  // Check for partial match (at least 80% similarity)
  const similarity = calculateSimilarity(normalizedEntered, normalizedAadhar);
  return similarity >= 0.8;
}

/**
 * Calculate similarity between two strings using Levenshtein distance
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Similarity score between 0 and 1
 */
function calculateSimilarity(str1, str2) {
  const longer = str1.length > str2.length ? str1 : str2;
  const shorter = str1.length > str2.length ? str2 : str1;
  
  if (longer.length === 0) return 1.0;
  
  const distance = levenshteinDistance(longer, shorter);
  return (longer.length - distance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 * @param {string} str1 - First string
 * @param {string} str2 - Second string
 * @returns {number} Distance
 */
function levenshteinDistance(str1, str2) {
  const matrix = [];
  
  for (let i = 0; i <= str2.length; i++) {
    matrix[i] = [i];
  }
  
  for (let j = 0; j <= str1.length; j++) {
    matrix[0][j] = j;
  }
  
  for (let i = 1; i <= str2.length; i++) {
    for (let j = 1; j <= str1.length; j++) {
      if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }
  
  return matrix[str2.length][str1.length];
}

module.exports = {
  extractAadharInfo,
  verifyNameMatch
};

