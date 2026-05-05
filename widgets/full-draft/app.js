/**
 * SystemDeck - app.js
 *
 * @package SystemDeck
 * @since 1.1.0
 * @author G.L. Walker
 * @file wp-content/plugins/systemdeck/widgets/full-draft/app.js
 * @license GPL-2.0-or-later
 *
 * Full Draft Widget (Client-side Interaction)
 */

document.addEventListener('systemdeck:widget:mount', (e) => {
    // Only respond to our specific widget ID
    if (e.detail.widgetId !== 'core.full-draft') return;
    
    // The renderer sometimes uses root instead of element in the detail payload
    const container = e.detail.root || e.detail.element;
    
    // Strict contract: single-mount guard
    if (!container || container.dataset.sdMounted) return;
    container.dataset.sdMounted = 'true';
    
    const widgetEl = container.querySelector('.sd-full-draft-widget');
    if (!widgetEl) return;

    const adminUrl = widgetEl.dataset.adminUrl;
    const iframeContainer = widgetEl.querySelector('.sd-full-draft-iframe-container');
    const loading = widgetEl.querySelector('.sd-full-draft-loading');
    
    const iframe = document.createElement('iframe');
    iframe.className = 'sd-full-draft-iframe';
    iframe.style.opacity = '0';
    iframe.style.transition = 'opacity 0.3s ease';
    
    // Append our tunnel markers
    const startUrl = new URL(adminUrl);
    startUrl.searchParams.set('sd_full_draft', '1');
    startUrl.searchParams.set('sd_block_boot', '1');
    iframe.src = startUrl.toString();
    
    iframe.onload = () => {
        try {
            const win = iframe.contentWindow;
            const doc = win.document;
            const currentUrl = new URL(win.location.href);
            
            // 0. GUARD: WP 302 Redirect Parameter Loss Prevention
            // If the server redirected us (e.g., after a Save/Publish action), 
            // the browser natively drops our tunnel query parameters.
            // We catch it here while still hidden, and immediately bounce back to the tunneled URL.
            if (!currentUrl.searchParams.has('sd_block_boot')) {
                currentUrl.searchParams.set('sd_full_draft', '1');
                currentUrl.searchParams.set('sd_block_boot', '1');
                win.location.replace(currentUrl.toString());
                return; // Stop execution, wait for the reload
            }
            
            loading.style.display = 'none';
            iframe.style.transition = 'opacity 0.3s ease';
            iframe.style.opacity = '1';
            
            // 1. INJECT UI STRIPPER CSS & RESPONSIVE META (On Load)
            const injectCSS = (targetDoc) => {
                if (!targetDoc) return;
                if (!targetDoc.querySelector('meta[name="viewport"]')) {
                    const meta = targetDoc.createElement('meta');
                    meta.name = 'viewport';
                    meta.content = 'width=device-width, initial-scale=1.0';
                    targetDoc.head.appendChild(meta);
                }

                if (!targetDoc.getElementById('sd-full-draft-overrides')) {
                    const style = targetDoc.createElement('style');
                    
                    style.id = 'sd-full-draft-overrides';
                    style.textContent = `
                        /* Strip Admin Chrome & SystemDeck Shell */
                        #adminmenumain, #wpadminbar, #adminmenuback, #adminmenuwrap, #wpfooter, #contextual-help-link-wrap { display: none !important; }
                        #sd-app, #sd-header-bar, #sd-visual-workspace, .sd-shell-container { display: none !important; }
                        #wpcontent { margin-left: 0 !important; }
                        #wpbody { padding-top: 0 !important; padding-bottom: 0 !important; }
                        html.wp-toolbar { padding-top: 0 !important; }
                        #wpbody-content { padding-bottom: 16px !important; }
                        
                        /* Fix Native WP Mobile Breakpoint Layouts */
                        p.search-box { display: flex !important; flex-wrap: nowrap !important; align-items: center !important; margin-bottom: 12px !important; }
                        p.search-box input[name="s"] { width: 100% !important; flex: 1 !important; margin-bottom: 0 !important; }
                        p.search-box input[type="submit"] { margin-bottom: 0 !important; margin-left: 8px !important; }
                        .tablenav .actions { display: flex !important; flex-wrap: wrap !important; align-items: center !important; gap: 8px !important; }
                        .tablenav .actions select, .tablenav .actions input[type="submit"] { margin: 0 !important; display: inline-block !important; }
                        
                        /* Auto-sizing and scrollbar prevention */
                        html, body, #wpwrap { 
                            overflow: hidden !important; 
                            height: max-content !important; 
                            min-height: 0 !important;
                            background: transparent !important;
                        }
                        
                        /* Gutenberg specific overrides */
                        body.block-editor-page { background: #fff !important; }
                        .interface-interface-skeleton { top: 0 !important; left: 0 !important; }
                        .edit-post-header { top: 0 !important; }
                        
                        /* Notices and updates that break layout */
                        .update-nag, .notice { margin-left: 0 !important; }
                    `;
                    targetDoc.head.appendChild(style);
                }
            };
            
            injectCSS(doc);
            
            // 1.5. FAST-PAINT CSS INJECTION
            // The onload event waits for ALL assets (images, fonts) which takes > 1.5s!
            // We poll every 10ms to inject our CSS into any new document the nanosecond its <head> exists.
            if (!win._sd_poller_active) {
                win._sd_poller_active = true;
                let currentDoc = win.document;
                setInterval(() => {
                    try {
                        const activeDoc = iframe.contentWindow.document;
                        if (activeDoc && activeDoc !== currentDoc && activeDoc.head) {
                            currentDoc = activeDoc;
                            injectCSS(activeDoc);
                        }
                    } catch(e) {}
                }, 10);
            }
            
            // 2. AUTO-RESIZE IFRAME HEIGHT
            if (doc.defaultView.ResizeObserver) {
                const ro = new doc.defaultView.ResizeObserver(() => {
                    const wrapper = doc.getElementById('wpwrap') || doc.body;
                    const h = wrapper.scrollHeight || wrapper.offsetHeight;
                    if (h > 0 && iframe.style.height !== h + 'px') {
                        iframe.style.height = h + 'px';
                    }
                });
                
                ro.observe(doc.body);
                
                // Observe inner wrappers to catch content shrinking
                const wpwrap = doc.getElementById('wpwrap');
                if (wpwrap) ro.observe(wpwrap);
                
                const wpbody = doc.getElementById('wpbody-content');
                if (wpbody) ro.observe(wpbody);
            }
            
            // 3. TRAP ALL NAVIGATION
            const hideIframe = () => {
                iframe.style.opacity = '0';
                iframe.style.transition = 'none';
                loading.style.display = 'flex';
            };
            
            doc.body.addEventListener('click', (evt) => {
                const link = evt.target.closest('a');
                if (!link || !link.href) return;
                
                if (link.href.startsWith(window.location.origin) && !link.href.includes('wp-login.php')) {
                    evt.preventDefault();
                    hideIframe();
                    
                    const newUrl = new URL(link.href, window.location.origin);
                    newUrl.searchParams.set('sd_full_draft', '1');
                    newUrl.searchParams.set('sd_block_boot', '1');
                    iframe.src = newUrl.toString();
                }
            }, true);
            
            // 4. TRAP FORMS
            // Preemptively inject hidden inputs into all forms in case JS calls form.submit() directly
            const injectTunnelKeys = (form) => {
                const actionAttr = form.getAttribute('action') || win.location.href;
                try {
                    const newUrl = new URL(actionAttr, win.location.href);
                    if (newUrl.origin === window.location.origin) {
                        newUrl.searchParams.set('sd_full_draft', '1');
                        newUrl.searchParams.set('sd_block_boot', '1');
                        form.setAttribute('action', newUrl.toString());
                    }
                } catch(e) {
                    // Ignore malformed action URLs
                }
                
                if (!form.querySelector('input[name="sd_full_draft"]')) {
                    const input = doc.createElement('input');
                    input.type = 'hidden';
                    input.name = 'sd_full_draft';
                    input.value = '1';
                    form.appendChild(input);
                }
                
                if (!form.querySelector('input[name="sd_block_boot"]')) {
                    const blockBootInput = doc.createElement('input');
                    blockBootInput.type = 'hidden';
                    blockBootInput.name = 'sd_block_boot';
                    blockBootInput.value = '1';
                    form.appendChild(blockBootInput);
                }
                
                if (form.hasAttribute('target')) {
                    form.removeAttribute('target');
                }
            };
            
            doc.querySelectorAll('form').forEach(injectTunnelKeys);
            
            // Also trap submit events just in case forms are dynamically created
            doc.body.addEventListener('submit', (evt) => {
                injectTunnelKeys(evt.target);
                hideIframe();
            }, true);
            
            // 5. PREVENT NAVIGATION FLASHES
            // Hide the iframe instantly when the browser natively navigates away 
            // (catches programmatic JS redirects and form submissions we couldn't prevent)
            win.addEventListener('beforeunload', hideIframe);
            win.addEventListener('pagehide', hideIframe);
            win.addEventListener('unload', hideIframe);

        } catch (err) {
            console.error("[Full Draft] Frame Access Error.", err);
        }
    };
    
    iframeContainer.appendChild(iframe);
});
