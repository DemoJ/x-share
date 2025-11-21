if (typeof window.xShareScriptInjected === 'undefined') {
    window.xShareScriptInjected = true;

    console.log("X-Share content script loaded! (Ultimate UI V4)");

    const observer = new MutationObserver((mutationsList, observer) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === 1) {
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

        shareButton.addEventListener('click', async (event) => {
            event.stopPropagation();
            event.preventDefault();

            const showMoreBtn = tweetElement.querySelector('[data-testid="tweet-text-show-more-link"]');
            if (showMoreBtn) {
                showMoreBtn.click();
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            const authorAvatar = tweetElement.querySelector('div[data-testid="Tweet-User-Avatar"] img[alt][draggable="true"]')?.src;
            
            const userInfoContainer = tweetElement.querySelector('div[data-testid="User-Name"]');
            let authorName = '';
            let authorHandle = '';

            if (userInfoContainer) {
                const textParts = userInfoContainer.innerText.split('\n');
                if (textParts.length >= 1) {
                    authorName = textParts[0];
                    const handlePart = textParts.find(t => t.startsWith('@'));
                    if (handlePart) {
                        authorHandle = handlePart;
                    }
                }
            }
            
            if (!authorName) {
                authorName = tweetElement.querySelector('div[data-testid="User-Name"] span')?.innerText || 'Unknown';
            }

            const tweetContent = tweetElement.querySelector('div[data-testid="tweetText"]')?.innerText;
            const timeElement = tweetElement.querySelector('time[datetime]');
            let tweetDate = '';
            let tweetTimeFull = ''; 

            if (timeElement) {
                const date = new Date(timeElement.getAttribute('datetime'));
                tweetDate = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                tweetTimeFull = `${hours}:${minutes}`;
            }

            if (authorAvatar && authorName && tweetContent) {
                generateShareImage({ authorAvatar, authorName, authorHandle, tweetContent, tweetDate, tweetTimeFull });
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
        iframe.style.width = '600px'; // 宽度增加到 600px，更舒展
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument;
        iframeDoc.open();
        const stylesheetUrl = chrome.runtime.getURL('style.css');
        
        // X Logo SVG (小巧精致版)
        const xLogoSvg = `<svg width="16" height="16" viewBox="0 0 24 24" class="x-logo-icon"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>`;

        iframeDoc.write(`
            <html>
            <head>
                <link rel="stylesheet" href="${stylesheetUrl}">
                <style>
                    body { margin: 0; padding: 0; background: transparent; }
                </style>
            </head>
            <body>
                <div class="x-share-container">
                    <div class="x-share-card">
                        <div class="x-share-header">
                            <div class="x-share-user">
                                <img src="${data.authorAvatar}" class="x-share-avatar" crossorigin="anonymous" />
                                <div class="x-share-meta">
                                    <div class="x-share-name">${data.authorName}</div>
                                    <div class="x-share-handle">${data.authorHandle}</div>
                                </div>
                            </div>
                            <div class="x-share-platform">
                                ${xLogoSvg}
                            </div>
                        </div>
                        
                        <div class="x-share-body">
                            <div class="x-share-text">${data.tweetContent.replace(/\n/g, '<br>')}</div>
                        </div>

                        <div class="x-share-footer">
                            <div class="x-share-time">${data.tweetDate} · ${data.tweetTimeFull}</div>
                            <div class="x-share-brand-tag">X-Share</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `);
        iframeDoc.close();

        const avatarImg = iframeDoc.querySelector('.x-share-avatar');

        const renderCanvas = () => {
            const container = iframeDoc.querySelector('.x-share-container');
            iframe.style.height = `${container.offsetHeight}px`;

            html2canvas(container, {
                useCORS: true,
                scale: 2, // 2x 渲染保证高清
                backgroundColor: null, // 保证背景透明
                logging: false
            }).then(canvas => {
                document.body.removeChild(iframe);
                showImageModal(canvas, data.authorName);
            }).catch(err => {
                console.error("渲染失败:", err);
                document.body.removeChild(iframe);
            });
        };

        if (avatarImg.complete) {
            setTimeout(renderCanvas, 100);
        } else {
            avatarImg.onload = renderCanvas;
            avatarImg.onerror = renderCanvas;
        }
    }

    function showImageModal(canvas, authorName) {
        const imageUrl = canvas.toDataURL('image/png');
        const modalOverlay = document.createElement('div');
        modalOverlay.className = 'x-share-modal-overlay';

        const modalContent = document.createElement('div');
        modalContent.className = 'x-share-modal-content';

        const closeButton = document.createElement('button');
        closeButton.innerHTML = '×';
        closeButton.className = 'x-share-close-button';
        closeButton.onclick = () => document.body.removeChild(modalOverlay);

        const generatedImage = document.createElement('img');
        generatedImage.src = imageUrl;
        generatedImage.className = 'x-share-preview-img';

        const actionsWrapper = document.createElement('div');
        actionsWrapper.className = 'x-share-modal-actions';

        const copyButton = document.createElement('button');
        copyButton.innerText = '复制图片';
        copyButton.className = 'x-share-action-button x-share-copy-button';
        copyButton.onclick = () => copyImageToClipboard(canvas, copyButton);

        const downloadButton = document.createElement('a');
        downloadButton.href = imageUrl;
        downloadButton.download = `X-Share_${authorName}.png`;
        downloadButton.innerText = '保存图片';
        downloadButton.className = 'x-share-action-button x-share-download-button';

        modalOverlay.onclick = (e) => {
            if (e.target === modalOverlay) document.body.removeChild(modalOverlay);
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
            await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
            const originalText = button.innerText;
            button.innerText = '已复制';
            button.style.background = '#10B981';
            button.style.color = '#fff';
            setTimeout(() => { 
                button.innerText = originalText; 
                button.style.background = '';
                button.style.color = '';
            }, 2000);
        } catch (err) {
            console.error('复制失败: ', err);
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