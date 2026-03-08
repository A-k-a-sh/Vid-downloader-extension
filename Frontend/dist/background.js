chrome.runtime.onMessage.addListener((e,u,r)=>{if(e.action==="getTabUrl")return chrome.tabs.query({active:!0,currentWindow:!0},t=>{r({url:t[0].url})}),!0});
