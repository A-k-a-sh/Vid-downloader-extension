const r=Array.from(document.querySelectorAll("video")).map(e=>e.src);chrome.runtime.sendMessage({action:"videoUrls",urls:r});
