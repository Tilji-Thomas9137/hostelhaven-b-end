const { GoogleGenerativeAI } = require('@google/generative-ai');
const Tesseract = require('tesseract.js');

// Initialize Gemini AI using env var; don't hardcode keys
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GEMINI_API_KEY;
let genAI = null;
if (GEMINI_API_KEY && typeof GEMINI_API_KEY === 'string' && GEMINI_API_KEY.trim().length > 0) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY.trim());
}

// OpenRouter fallback provider
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY; // allow common var
const OPENROUTER_MODEL = process.env.OPENROUTER_MODEL || 'meta-llama/llama-4-maverick:free';

/**
 * Extract Aadhar number and name from Aadhar card image using Gemini AI
 * @param {Buffer} imageBuffer - The image buffer
 * @param {string} mimeType - The MIME type of the image
 * @returns {Promise<{aadharNumber: string, name: string, confidence: number}>}
 */
async function extractAadharInfo(imageBuffer, mimeType) {
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

  const parseJsonStrict = (text) => {
    const cleaned = String(text)
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim();
    try {
      return JSON.parse(cleaned);
    } catch (_) {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]);
      }
      const parseErr = new Error('AI response was not valid JSON');
      parseErr.code = 'AI_JSON_PARSE_FAILED';
      throw parseErr;
    }
  };

  // Decide provider order. Prefer OpenRouter by default; allow forcing via AI_PROVIDER
  const providers = [];
  const providerPref = (process.env.AI_PROVIDER || '').toLowerCase();
  if (providerPref === 'openrouter') {
    if (OPENROUTER_API_KEY) providers.push('openrouter');
  } else if (providerPref === 'gemini') {
    if (genAI) providers.push('gemini');
  } else {
    // Default preference: OpenRouter first, then Gemini
    if (OPENROUTER_API_KEY) providers.push('openrouter');
    if (genAI) providers.push('gemini');
  }
  if (providers.length === 0) {
    const err = new Error('No AI provider configured. Set GEMINI_API_KEY or OPENROUTER_API_KEY');
    err.code = 'NO_AI_PROVIDER';
    throw err;
  }

  let lastError = null;
  for (const provider of providers) {
    try {
      if (provider === 'gemini') {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent([
          prompt,
          { inlineData: { data: base64Image, mimeType } }
        ]);
        const response = await result.response;
        const text = response.text();
        const extractedData = parseJsonStrict(text);
        return {
          aadharNumber: extractedData.aadharNumber || null,
          name: extractedData.name || null,
          confidence: extractedData.confidence || 0
        };
      }

      if (provider === 'openrouter') {
        const dataUrl = `data:${mimeType};base64,${base64Image}`;
        const system = 'You extract structured data from Indian Aadhar card images. Return ONLY strict JSON with keys: aadharNumber (12 digits as string), name (string), confidence (0-100). If unsure, set missing fields to null and confidence to 0.';
        const userPrompt = `Analyze this Aadhar card image and extract JSON. Image (data URL): ${dataUrl}`;

        const resp = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
            'HTTP-Referer': 'http://localhost',
            'X-Title': 'HostelHaven Aadhar Verification'
          },
          body: JSON.stringify({
            model: OPENROUTER_MODEL,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: userPrompt }
            ],
            temperature: 0
          })
        });
        if (!resp.ok) {
          const text = await resp.text();
          const e = new Error(`OpenRouter request failed: ${resp.status} ${text}`);
          e.code = 'OPENROUTER_REQUEST_FAILED';
          throw e;
        }
        const json = await resp.json();
        const content = json?.choices?.[0]?.message?.content || '';
        const extracted = parseJsonStrict(content);
        return {
          aadharNumber: extracted.aadharNumber || null,
          name: extracted.name || null,
          confidence: extracted.confidence || 0
        };
      }
    } catch (error) {
      lastError = error;
      // If Gemini key invalid/missing, try next provider if available
      if (
        provider === 'gemini' &&
        (error.code === 'GEMINI_API_KEY_MISSING' ||
         error.code === 'GEMINI_API_KEY_INVALID' ||
         (error.status === 400 && /API key not valid/i.test(error.message || '')))
      ) {
        continue;
      }
      // On JSON parse failure, do not try next as content likely unusable for this provider
      if (error.code === 'AI_JSON_PARSE_FAILED') {
        throw error;
      }
      // Otherwise try next provider
      continue;
    }
  }

  // If all providers failed
  // OCR fallback using Tesseract
  try {
    // Pass 1: general OCR
    const { data: { text } } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: () => {},
    });
    // Pass 2: digits-focused OCR to improve number capture
    const { data: { text: digitsText } } = await Tesseract.recognize(imageBuffer, 'eng', {
      logger: () => {},
      tessedit_char_whitelist: '0123456789',
      classify_bln_numeric_mode: 1
    });

    const onlyDigits = (s) => (s || '').replace(/\D/g, '');
    const combinedDigits = onlyDigits(`${text}\n${digitsText}`);
    const aadharMatch = combinedDigits.match(/\d{12}/);

    // Name heuristic: look for lines near keywords
    const lines = String(text).split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    let nameCandidate = null;
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i];
      if (/name\b/i.test(l)) {
        // Try the part after ':' or the next line
        const after = l.split(':')[1]?.trim();
        if (after && after.length >= 3) { nameCandidate = after; break; }
        if (lines[i+1] && lines[i+1].length >= 3) { nameCandidate = lines[i+1]; break; }
      }
    }
    // Fallback: pick the longest uppercase-like line
    if (!nameCandidate) {
      const upperish = lines.filter(l => /^(?:[A-Z][A-Z\s\.]*)$/.test(l) && l.length >= 5);
      if (upperish.length) {
        nameCandidate = upperish.sort((a,b)=>b.length-a.length)[0];
      }
    }
    if (aadharMatch) {
      return {
        aadharNumber: aadharMatch[0],
        name: nameCandidate || null,
        confidence: nameCandidate ? 60 : 40
      };
    }
    const generic = new Error('Failed to extract Aadhar information');
    generic.cause = lastError;
    throw generic;
  } catch (ocrErr) {
    const generic = new Error('Failed to extract Aadhar information');
    generic.cause = ocrErr;
    throw generic;
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

