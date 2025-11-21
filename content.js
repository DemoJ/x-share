if (typeof window.xShareScriptInjected === 'undefined') {
    window.xShareScriptInjected = true;

    console.log("X-Share content script loaded!");

    // X.com 是一个单页应用，所以我们需要观察 DOM 的变化
    // 来检测新的推文何时被添加到页面上。
    const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) { // 确保是元素节点
                        if (node.matches('article')) {
                            addShareButton(node);
                        }
                        node.querySelectorAll('article').forEach(addShareButton);
                    }
                });
            }
        }
    });

    function startObserver() {
        const targetNode = document.querySelector('main');
        if (targetNode) {
            observer.observe(targetNode, { childList: true, subtree: true });
            document.querySelectorAll('article').forEach(addShareButton);
        } else {
            setTimeout(startObserver, 500);
        }
    }

    function addShareButton(tweetElement) {
        if (tweetElement.querySelector('.x-share-button')) {
            return;
        }

        const shareButton = document.createElement('button');
        shareButton.innerText = '分享';
        shareButton.className = 'x-share-button';

        // 修改：使用 async 函数以支持等待操作
        shareButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            event.preventDefault();

            // --- 新增逻辑开始 ---
            // 检查是否有“显示更多”按钮
            const showMoreBtn = tweetElement.querySelector('[data-testid="tweet-text-show-more-link"]');
            if (showMoreBtn) {
                console.log("检测到内容折叠，正在自动展开...");
                showMoreBtn.click();
                // 等待 500ms 让 React 完成渲染和文本展开
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            // --- 新增逻辑结束 ---

            const authorAvatar = tweetElement.querySelector('div[data-testid="Tweet-User-Avatar"] img[alt][draggable="true"]')?.src;
            const authorName = tweetElement.querySelector('div[data-testid="User-Name"] span').innerText;
            // 此时获取的 innerText 应该是展开后的全文
            const tweetContent = tweetElement.querySelector('div[data-testid="tweetText"]')?.innerText;
            const timeElement = tweetElement.querySelector('time[datetime]');
            let tweetDate = '';
            if (timeElement) {
                const date = new Date(timeElement.getAttribute('datetime'));
                // 将日期格式化为 月-日
                tweetDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
            }

            if (authorAvatar && authorName && tweetContent) {
                generateShareImage({ authorAvatar, authorName, tweetContent, tweetDate });
            } else {
                alert("无法抓取帖子内容，请重试。");
            }
        });

        const actionBar = tweetElement.querySelector('div[role="group"]');
        if (actionBar) {
            actionBar.appendChild(shareButton);
        }
    }

    function generateShareImage(data) {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.width = '480px';
        // 移除固定的高度，让 iframe 自适应内容
        // iframe.style.height = '640px';
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument;
        iframeDoc.open();
        const stylesheetUrl = chrome.runtime.getURL('style.css');
        iframeDoc.write(`
            <html>
            <head>
                <link rel="stylesheet" href="${stylesheetUrl}">
            </head>
            <body>
                <div class="x-share-card">
                    <div class="x-share-card-header">
                        <img src="${data.authorAvatar}" class="x-share-card-avatar" />
                        <span class="x-share-card-author">${data.authorName}</span>
                    </div>
                    <div class="x-share-card-content">${data.tweetContent.replace(/\n/g, '<br>')}</div>
                    <div class="x-share-card-footer">
                        <span>${data.tweetDate ? `${data.tweetDate} · ` : ''}来自 x.com</span>
                        <span>分享自 X-Share</span>
                    </div>
                </div>
            </body>
            </html>
        `);
        iframeDoc.close();

        const avatarImg = iframeDoc.querySelector('.x-share-card-avatar');

        const renderCanvas = () => {
            const shareCard = iframeDoc.querySelector('.x-share-card');
            // 动态设置 iframe 的高度以匹配其内容
            iframe.style.height = `${shareCard.scrollHeight}px`;

            html2canvas(shareCard, {
                useCORS: true,
                scale: 2,
                // 使用 scrollHeight 来确保 canvas 捕捉到所有内容
                windowWidth: shareCard.scrollWidth,
                windowHeight: shareCard.scrollHeight,
                allowTaint: true
            }).then(canvas => {
                document.body.removeChild(iframe);
                showImageModal(canvas, data.authorName);
            }).catch(err => {
                console.error("html2canvas 渲染失败:", err);
                document.body.removeChild(iframe);
                alert("图片生成失败，请查看控制台获取更多信息。");
            });
        };

        // 监听图片加载事件
        avatarImg.onload = renderCanvas;
        // 如果图片加载失败，也继续尝试渲染（可能会显示一个破碎的图片图标）
        avatarImg.onerror = () => {
            console.warn("头像图片加载失败，但仍将尝试生成分享图。");
            renderCanvas();
        };
        
        // 安全措施：如果图片已经加载完成（从缓存中），onload 可能不会触发
        if (avatarImg.complete) {
            renderCanvas();
        }
    }

    function showImageModal(canvas, authorName) {
        const imageUrl = canvas.toDataURL('image/png');
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'x-share-modal-overlay';

        const modalContent = document.createElement('div');
        modalContent.className = 'x-share-modal-content';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '&times;'; // 使用 '×' 符号
        closeButton.className = 'x-share-close-button';
        closeButton.onclick = () => document.body.removeChild(modalOverlay);

        const generatedImage = document.createElement('img');
        generatedImage.src = imageUrl;

        const actionsWrapper = document.createElement('div');
        actionsWrapper.className = 'x-share-modal-actions';

        const copyButton = document.createElement('button');
        copyButton.innerText = '复制图片';
        copyButton.className = 'x-share-action-button x-share-copy-button';
        copyButton.onclick = () => copyImageToClipboard(canvas, copyButton);

        const downloadButton = document.createElement('a');
        downloadButton.href = imageUrl;
        downloadButton.download = `x-share-${authorName}.png`;
        downloadButton.innerText = '下载图片';
        downloadButton.className = 'x-share-action-button x-share-download-button';

        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) {
                document.body.removeChild(modalOverlay);
            }
        };

        actionsWrapper.appendChild(copyButton);
        actionsWrapper.appendChild(downloadButton);
        modalContent.appendChild(closeButton);
        modalContent.appendChild(generatedImage);
        modalContent.appendChild(actionsWrapper);
        modalOverlay.appendChild(modalContent);
        document.body.appendChild(modalOverlay);
    }

    async function copyImageToClipboard(canvas, button) {
        try {
            const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
            await navigator.clipboard.write([
                new ClipboardItem({ 'image/png': blob })
            ]);
            button.innerText = '已复制!';
            setTimeout(() => { button.innerText = '复制图片'; }, 2000);
        } catch (err) {
            console.error('无法复制图片: ', err);
            button.innerText = '复制失败';
            setTimeout(() => { button.innerText = '复制图片'; }, 2000);
        }
    }

    function main() {
        if (document.body) {
            startObserver();
        } else {
            setTimeout(main, 100);
        }
    }

    main();
}