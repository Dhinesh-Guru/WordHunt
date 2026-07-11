let wordLists = {};

// Fetch words list dynamically from server on load
async function fetchWords() {
  try {
    const res = await fetch('/api/words');
    if (res.ok) {
      wordLists = await res.json();
    }
  } catch (error) {
    console.error('Failed to load words list from server:', error);
  }
}
fetchWords();

// Return true if word is in list of specific length
function isValidWord(word, length) {
  const cleanWord = word.trim().toLowerCase();
  if (cleanWord.length !== length) return false;
  
  const list = wordLists[length.toString()];
  return list ? list.includes(cleanWord) : false;
}

