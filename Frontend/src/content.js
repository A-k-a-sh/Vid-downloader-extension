// Extract video URLs or metadata if needed
const videos = Array.from(document.querySelectorAll('video')).map(v => v.src);
chrome.runtime.sendMessage({ action: 'videoUrls', urls: videos });