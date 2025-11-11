// 监听标签页的更新事件
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // 确保页面加载完成，并且 URL 是 x.com 或 twitter.com
  if (changeInfo.status === 'complete' && tab.url && (tab.url.includes('x.com') || tab.url.includes('twitter.com'))) {
    
    // 注入 CSS 文件
    chrome.scripting.insertCSS({
      target: { tabId: tabId },
      files: ['style.css']
    });

    // 按顺序注入 JavaScript 文件
    // html2canvas 会先被注入，然后才是 content.js
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      files: ['lib/html2canvas.min.js', 'content.js']
    });
  }
});