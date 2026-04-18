const https = require('https');
const http = require('http');

const FALLBACK_WORDS = [
  { word: 'Ephemeral', meaning: 'Lasting for a very short time; transitory.', example: 'The ephemeral beauty of cherry blossoms makes them all the more precious.' },
  { word: 'Serendipity', meaning: 'The occurrence of events by chance in a happy or beneficial way.', example: 'It was pure serendipity that they met at the coffee shop.' },
  { word: 'Mellifluous', meaning: 'Sweet or musical; pleasant to hear.', example: 'Her mellifluous voice filled the room with warmth.' },
  { word: 'Perspicacious', meaning: 'Having a ready insight into things; shrewd.', example: 'A perspicacious investor can spot opportunities others miss.' },
  { word: 'Sanguine', meaning: 'Optimistic, especially in difficult situations.', example: 'Despite the setbacks, she remained sanguine about the project.' },
  { word: 'Laconic', meaning: 'Using very few words; brief and concise.', example: 'His laconic reply told her everything she needed to know.' },
  { word: 'Ubiquitous', meaning: 'Present, appearing, or found everywhere.', example: 'Smartphones have become ubiquitous in modern life.' },
  { word: 'Equanimity', meaning: 'Mental calmness, composure, especially in difficult situations.', example: 'She handled the crisis with remarkable equanimity.' },
  { word: 'Loquacious', meaning: 'Tending to talk a great deal; talkative.', example: 'The loquacious professor filled every lecture with fascinating tangents.' },
  { word: 'Alacrity', meaning: 'Brisk and cheerful readiness.', example: 'She accepted the challenge with alacrity.' },
  { word: 'Cogent', meaning: 'Clear, logical, and convincing.', example: 'He made a cogent argument for the new policy.' },
  { word: 'Effervescent', meaning: 'Vivacious and enthusiastic; bubbly.', example: 'Her effervescent personality lit up every room.' },
  { word: 'Tenacious', meaning: 'Holding firmly to something; persistent.', example: 'The tenacious climber reached the summit despite the storm.' },
  { word: 'Luminous', meaning: 'Emitting or reflecting light; glowing.', example: 'The luminous moon guided travelers through the forest.' },
  { word: 'Pensive', meaning: 'Engaged in deep or serious thought.', example: 'She sat by the window, pensive and quiet.' },
  { word: 'Resilient', meaning: 'Able to withstand or recover quickly from difficult conditions.', example: 'The resilient community rebuilt after the disaster.' },
  { word: 'Candid', meaning: 'Truthful and straightforward; frank.', example: 'His candid assessment helped the team improve.' },
  { word: 'Eloquent', meaning: 'Fluent or persuasive in speaking or writing.', example: 'The eloquent speech moved the audience to tears.' },
  { word: 'Vivacious', meaning: 'Attractively lively and animated.', example: 'Her vivacious spirit made her the heart of every gathering.' },
  { word: 'Pragmatic', meaning: 'Dealing with things sensibly and realistically.', example: 'A pragmatic approach helped them solve the problem quickly.' }
];

function fetchFromURL(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const req = protocol.get(url, { timeout: 8000 }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      });
    });
    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

async function fetchWordOfDay() {
  try {
    const data = await fetchFromURL('https://api.freeapi.app/api/v1/public/randomusers/user/random');
    // Try the actual word API endpoint
    const wordData = await fetchFromURL('https://api.freeapi.app/api/v1/public/words/word/random');

    if (wordData && wordData.data) {
      const w = wordData.data;
      return {
        word: w.word || w.title,
        meaning: w.meanings?.[0]?.definitions?.[0]?.definition || w.description || 'No definition available.',
        example: w.meanings?.[0]?.definitions?.[0]?.example || '',
        source: 'api'
      };
    }
    throw new Error('Unexpected API response shape');
  } catch (err) {
    console.warn('[WordFetcher] API failed:', err.message, '— using fallback');
    return null;
  }
}

async function getWord(wordHistory = []) {
  // Try API first
  let word = await fetchWordOfDay();

  // Fall back to local list, avoiding recent repeats
  if (!word) {
    const recentWords = wordHistory.slice(-10).map(w => w.word?.toLowerCase());
    const available = FALLBACK_WORDS.filter(w => !recentWords.includes(w.word.toLowerCase()));
    const pool = available.length > 0 ? available : FALLBACK_WORDS;
    word = { ...pool[Math.floor(Math.random() * pool.length)], source: 'fallback' };
  }

  return word;
}

module.exports = { getWord };
