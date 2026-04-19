if (typeof window.xShareScriptInjected === 'undefined') {
    window.xShareScriptInjected = true;

    console.log("X-Share content script loaded! (Ultimate UI V4 + Article Rich Media Support)");

    const observer = new MutationObserver((mutationsList, observer) => {
        let shouldCheck = false;
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                shouldCheck = true;
                break;
            }
        }
        if (shouldCheck) {
            checkAndAddButtons();
        }
    });

    function startObserver() {
        const targetNode = document.querySelector('main') || document.body;
        if (targetNode) {
            observer.observe(targetNode, { childList: true, subtree: true });
            checkAndAddButtons();
        } else {
            setTimeout(startObserver, 500);
        }
    }

    function checkAndAddButtons() {
        // Find both tweet containers and article content containers
        const nodes = [
            ...document.querySelectorAll('article'),
            ...document.querySelectorAll('[data-testid="twitter-article-title"]')
        ];

        nodes.forEach(node => {
            let container = node;
            if (node.tagName.toLowerCase() !== 'article') {
                container = node.closest('.css-175oi2r.r-vmopo1') || node.parentElement?.parentElement;
            }
            if (container && !container.dataset.xshareBound) {
                addShareButton(container);
                container.dataset.xshareBound = 'true';
            }
        });
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

            // Handle fallback case where it is an article but wrapped in an <article> node
            const isArticle = !!tweetElement.querySelector('[data-testid="twitterArticleRichTextView"]') || !!tweetElement.querySelector('[data-testid="twitter-article-title"]');

            // Expand long text on normal tweets
            if (!isArticle) {
                const showMoreBtn = tweetElement.querySelector('[data-testid="tweet-text-show-more-link"]');
                if (showMoreBtn) {
                    showMoreBtn.click();
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            // Extract Author Context
            let authorAvatar = tweetElement.querySelector('div[data-testid="Tweet-User-Avatar"] img[alt][draggable="true"]')?.src;
            let userInfoContainer = tweetElement.querySelector('div[data-testid="User-Name"]');
            
            // For articles, author info might be outside the main text container (e.g. at the top of the page)
            if (isArticle && !authorAvatar) {
                authorAvatar = document.querySelector('div[data-testid="Tweet-User-Avatar"] img[alt][draggable="true"]')?.src || document.querySelector('img.css-9pa8cd[alt=""]')?.src;
            }
            if (isArticle && !userInfoContainer) {
                userInfoContainer = document.querySelector('div[data-testid="User-Name"]');
            }
            
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
                authorName = tweetElement.querySelector('div[data-testid="User-Name"] span')?.innerText || document.querySelector('div[data-testid="User-Name"] span')?.innerText || 'Unknown';
            }

            // Extract Content
            let tweetContent = '';
            
            if (isArticle) {
                const titleNode = tweetElement.querySelector('[data-testid="twitter-article-title"]');
                const contentNode = tweetElement.querySelector('[data-testid="twitterArticleRichTextView"]');
                
                let blocksHTML = '';
                const title = titleNode ? titleNode.innerText : '';
                if (title) {
                    blocksHTML += `<h1 style="font-size: 24px; font-weight: 800; margin-bottom: 24px; line-height: 1.4; color: inherit;">${title}</h1>`;
                }

                if (contentNode) {
                    const blocks = contentNode.querySelectorAll('[data-block="true"], section[data-block="true"]');
                    blocks.forEach(block => {
                        // Check for inline images
                        const imgElement = block.querySelector('img[src*="pbs.twimg.com/media/"]');
                        if (imgElement) {
                            let imgSrc = imgElement.src;
                            imgSrc = imgSrc.replace(/name=small|name=medium/, 'name=large');
                            blocksHTML += `<div style="margin: 20px 0; border-radius: 16px; overflow: hidden; border: 1px solid #e1e8ed;"><img src="${imgSrc}" crossorigin="anonymous" style="width: 100%; display: block;" /></div>`;
                            return;
                        }
                        
                        // Check for separators
                        const separator = block.querySelector('div[role="separator"]');
                        if (separator) {
                            blocksHTML += `<div style="display: flex; justify-content: center; margin: 30px 0;"><div style="width: 40px; height: 4px; background-color: #e1e8ed; border-radius: 2px;"></div></div>`;
                            return;
                        }

                        // Extract text with minimal styling preserved
                        let paragraphHTML = '';
                        const textSpans = block.querySelectorAll('span[data-text="true"]');
                        textSpans.forEach(span => {
                            let text = span.textContent;
                            if (!text) return;
                            
                            // Safe escape
                            text = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');

                            const parentSpan = span.parentElement;
                            if (parentSpan && parentSpan.tagName === 'SPAN') {
                                if (parentSpan.style.fontWeight === 'bold' || parseInt(parentSpan.style.fontWeight) >= 700) {
                                    text = `<strong>${text}</strong>`;
                                }
                            }
                            
                            const link = span.closest('a');
                            if (link) {
                                text = `<span style="color: #1d9bf0;">${text}</span>`;
                            }
                            
                            paragraphHTML += text;
                        });

                        if (paragraphHTML) {
                            if (block.tagName.toLowerCase() === 'h2' || block.classList.contains('longform-header-two')) {
                                blocksHTML += `<h2 style="font-size: 20px; font-weight: 700; margin: 28px 0 12px 0;">${paragraphHTML}</h2>`;
                            } else if (block.tagName.toLowerCase() === 'blockquote' || block.classList.contains('longform-blockquote')) {
                                blocksHTML += `<blockquote style="border-left: 4px solid #1d9bf0; padding-left: 16px; margin: 20px 0; color: #536471; font-style: italic; font-size: 16px;">${paragraphHTML}</blockquote>`;
                            } else if (block.tagName.toLowerCase() === 'li' || block.classList.contains('public-DraftStyleDefault-unorderedListItem')) {
                                blocksHTML += `<div style="margin: 8px 0 8px 8px; padding-left: 16px; position: relative; line-height: 1.6;"><span style="position: absolute; left: 0; color: #536471;">•</span>${paragraphHTML}</div>`;
                            } else {
                                blocksHTML += `<p style="margin: 16px 0; line-height: 1.6; color: inherit; font-size: 15px;">${paragraphHTML}</p>`;
                            }
                        }
                    });
                }
                tweetContent = blocksHTML;
            } else {
                let rawText = tweetElement.querySelector('div[data-testid="tweetText"]')?.innerText || '';
                tweetContent = rawText.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>');
                
                // Allow sharing images from normal tweets as well!
                const tweetImages = tweetElement.querySelectorAll('div[data-testid="tweetPhoto"] img');
                if (tweetImages.length > 0) {
                    let imagesHTML = `<div style="display: flex; gap: 8px; flex-wrap: wrap; margin-top: 16px;">`;
                    tweetImages.forEach(img => {
                         let imgSrc = img.src.replace(/name=small|name=medium/, 'name=large');
                         imagesHTML += `<img src="${imgSrc}" crossorigin="anonymous" style="width: ${tweetImages.length === 1 ? '100%' : 'calc(50% - 4px)'}; border-radius: 12px; display: block;" />`;
                    });
                    imagesHTML += `</div>`;
                    tweetContent += imagesHTML;
                }
            }

            // Extract Time Context
            let timeElement = tweetElement.querySelector('time[datetime]');
            if (!timeElement && isArticle) {
                timeElement = document.querySelector('time[datetime]');
            }

            let tweetDate = '';
            let tweetTimeFull = ''; 

            if (timeElement) {
                const date = new Date(timeElement.getAttribute('datetime'));
                tweetDate = `${date.getFullYear()}/${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
                const hours = date.getHours().toString().padStart(2, '0');
                const minutes = date.getMinutes().toString().padStart(2, '0');
                tweetTimeFull = `${hours}:${minutes}`;
            } else {
                // Fallback to current time if time is missing
                const now = new Date();
                tweetDate = `${now.getFullYear()}/${(now.getMonth() + 1).toString().padStart(2, '0')}/${now.getDate().toString().padStart(2, '0')}`;
                tweetTimeFull = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
            }

            if (authorName && tweetContent) {
                generateShareImage({ authorAvatar, authorName, authorHandle, tweetContent, tweetDate, tweetTimeFull });
            } else {
                alert("无法抓取帖子或文章内容，请重试。");
            }
        });

        // Add the button to action bar
        let actionBar = tweetElement.querySelector('div[role="group"]');
        
        let isArticleBinding = !!tweetElement.querySelector('[data-testid="twitterArticleRichTextView"]') || !!tweetElement.querySelector('[data-testid="twitter-article-title"]');
        // Use more specific match for article if standard group is absent
        if (isArticleBinding && !actionBar) {
             actionBar = tweetElement.querySelector('[data-testid="reply"]')?.closest('div[role="group"]') || tweetElement.parentElement?.querySelector('div[role="group"]');
        }

        if (actionBar) {
            actionBar.appendChild(shareButton);
        } else if (isArticleBinding) {
             // Deep fallback for article
             const titleEl = tweetElement.querySelector('[data-testid="twitter-article-title"]');
             if (titleEl && titleEl.parentElement) {
                 titleEl.parentElement.appendChild(shareButton);
             }
        }
    }

    function generateShareImage(data) {
        const iframe = document.createElement('iframe');
        iframe.style.position = 'absolute';
        iframe.style.left = '-9999px';
        iframe.style.width = '480px'; // Consistent width scale
        document.body.appendChild(iframe);

        const iframeDoc = iframe.contentDocument;
        iframeDoc.open();
        const stylesheetUrl = chrome.runtime.getURL('style.css');
        
        // X Logo SVG
        const xLogoSvg = `<svg width="16" height="16" viewBox="0 0 24 24" class="x-logo-icon"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"></path></svg>`;

        // Construct HTML for Canvas
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
                                ${data.authorAvatar ? `<img src="${data.authorAvatar}" class="x-share-avatar" crossorigin="anonymous" />` : `<div class="x-share-avatar" style="background:#444;"></div>`}
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
                            <div class="x-share-text">${data.tweetContent}</div>
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

        const renderCanvas = () => {
            const container = iframeDoc.querySelector('.x-share-container');
            iframe.style.height = `${container.offsetHeight}px`;

            html2canvas(container, {
                useCORS: true,
                scale: 2, // Retain 2x high resolution
                backgroundColor: null,
                logging: false,
                allowTaint: false
            }).then(canvas => {
                document.body.removeChild(iframe);
                showImageModal(canvas, data.authorName);
            }).catch(err => {
                console.error("渲染失败:", err);
                document.body.removeChild(iframe);
            });
        };

        // Wait for all images in the document to load before rendering the canvas
        const images = Array.from(iframeDoc.querySelectorAll('img'));
        if (images.length === 0) {
            setTimeout(renderCanvas, 100);
        } else {
            const promises = images.map(img => {
                if (img.complete) return Promise.resolve();
                return new Promise(resolve => {
                    img.onload = resolve;
                    img.onerror = resolve; // Ignore errors to proceed
                });
            });
            Promise.all(promises).then(() => {
                // Add a tiny buffer to allow browser painting step
                setTimeout(renderCanvas, 200);
            });
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

        const imgWrapper = document.createElement('div');
        imgWrapper.className = 'x-share-preview-img-wrapper';

        const generatedImage = document.createElement('img');
        generatedImage.src = imageUrl;
        generatedImage.className = 'x-share-preview-img';
        imgWrapper.appendChild(generatedImage);

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
        modalContent.appendChild(imgWrapper);
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