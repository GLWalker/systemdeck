import { useState, useEffect, useRef } from "@wordpress/element"
import {
    Panel,
    PanelBody,
    CheckboxControl,
    Spinner,
    Notice,
    Flex,
    FlexItem
} from "@wordpress/components"
import useSystemNotice from "../components/useSystemNotice"

/**
 * Clean and format widget titles (Ported from Beta)
 */
function cleanWidgetTitle(title, widgetId) {
    if (!title) return widgetId
    title = title.replace(/Actions|Move up|Move down|Toggle panel|Configure|Settings/gi, "").trim()
    const words = title.split(/\s+/)
    const uniqueWords = []
    words.forEach((word) => { if (!uniqueWords.includes(word)) uniqueWords.push(word) })
    title = uniqueWords.join(" ")
    title = title.replace(/^(AIOSEO|Yoast|WooCommerce|Jetpack)\s+/i, "$1 - ")
    if (title === widgetId || title.length < 3) {
        title = widgetId.replace(/wpseo-|aioseo-|dashboard_|wc-/gi, "").replace(/[-_]/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()).trim()
    }
    return title || widgetId
}

function InspectorCanvas() {
    const [url, setUrl] = useState(window.SYSTEMDECK_BOOTSTRAP?.config?.siteUrl || "/")
    const [isScanning, setIsScanning] = useState(false)
    const [discoveredWidgets, setDiscoveredWidgets] = useState([])
    const [selectedWidgets, setSelectedWidgets] = useState([])
    const [message, setMessage] = useState(null)
    const [activeTab, setActiveTab] = useState('browser') // 'browser' or 'scanner'
    const { pushNotice } = useSystemNotice()

    const scannerIframeRef = useRef(null)

    // Load active proxies on mount
    useEffect(() => {
        fetchProxies()
    }, [])

    const fetchProxies = async () => {
        try {
            const response = await fetch(`${window.SYSTEMDECK_BOOTSTRAP.config.ajaxurl.replace('admin-ajax.php', '')}?sd_action=get_active_proxies&_wpnonce=${window.SYSTEMDECK_BOOTSTRAP.config.nonce}`)
            const res = await response.json()
            if (res.success) {
                setSelectedWidgets(res.data.proxies || [])
            }
        } catch (err) {
            console.error("Failed to fetch proxies", err)
        }
    }

    const startScan = () => {
        setIsScanning(true)
        setMessage({ type: 'info', text: 'Loading Dashboard for Scanning...' })

        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = 'index.php'
        document.body.appendChild(iframe)

        iframe.onload = () => {
            setMessage({ type: 'info', text: 'Dashboard loaded. Discovering widgets...' })

            setTimeout(() => {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document
                    const postboxes = Array.from(doc.querySelectorAll('.postbox'))
                    const found = []
                    const processedIds = new Set()

                    postboxes.forEach(el => {
                        const id = el.id
                        if (!id || id.startsWith('sd_') || processedIds.has(id)) return

                        // Basic filtering logic from Beta
                        const hasHeader = el.querySelector('.postbox-header, .hndle')
                        const hasInside = el.querySelector('.inside')
                        const isKnownPlugin = id.match(/^(wpseo|aioseo|woocommerce|jetpack|dashboard_)/)

                        if (!hasHeader && !hasInside && !isKnownPlugin) return

                        // Extract Title
                        let title = ""
                        const headerTitle = el.querySelector('.postbox-header h2, .postbox-header .hndle')
                        if (headerTitle) title = headerTitle.innerText.trim()

                        if (!title) {
                            const h2 = el.querySelector('h2')
                            if (h2) title = h2.innerText.trim()
                        }

                        processedIds.add(id)
                        found.push({
                            id,
                            title: cleanWidgetTitle(title || id, id)
                        })
                    })

                    const mergeWithServerFeed = async () => {
                        const merged = new Map()
                        found.forEach((widget) => merged.set(widget.id, widget))

                        try {
                            const ajaxBase = (window.SYSTEMDECK_BOOTSTRAP?.config?.ajaxurl || '/wp-admin/admin-ajax.php').replace('admin-ajax.php', '')
                            const nonce = window.SYSTEMDECK_BOOTSTRAP?.config?.nonce || ''
                            const response = await fetch(`${ajaxBase}?sd_action=get_discovered_widgets&_wpnonce=${encodeURIComponent(nonce)}`, {
                                credentials: 'same-origin'
                            })
                            const payload = await response.json()
                            if (payload?.success && Array.isArray(payload?.data?.widgets)) {
                                payload.data.widgets.forEach((row) => {
                                    const rawId = String(row?.id || '').trim()
                                    if (!rawId) return
                                    const id = rawId.replace(/^dashboard\./, '')
                                    if (!id || id.startsWith('sd_')) return
                                    if (!merged.has(id)) {
                                        merged.set(id, {
                                            id,
                                            title: cleanWidgetTitle(String(row?.title || id), id)
                                        })
                                    }
                                })
                            }
                        } catch (feedErr) {
                            console.warn('SystemDeck Inspector Scan: server discovered feed unavailable', feedErr)
                        }

                        const finalWidgets = Array.from(merged.values())
                        setDiscoveredWidgets(finalWidgets)
                        setIsScanning(false)
                        setMessage({ type: 'success', text: `Scan complete! Found ${finalWidgets.length} widgets.` })
                        pushNotice('success', `Scan complete! Found ${finalWidgets.length} widgets.`)
                        setActiveTab('scanner')
                    }

                    mergeWithServerFeed()
                } catch (err) {
                    console.error("Scan error", err)
                    setIsScanning(false)
                    setMessage({ type: 'error', text: 'Scan failed. Check console for details.' })
                    pushNotice('error', 'Scan failed. Check console for details.')
                } finally {
                    if (document.body.contains(iframe)) document.body.removeChild(iframe)
                }
            }, 2000)
        }
    }

    const saveSelection = async () => {
        setMessage({ type: 'info', text: 'Saving selection...' })
        try {
            const formData = new FormData()
            formData.append('sd_action', 'save_proxy_selection')
            formData.append('_wpnonce', window.SYSTEMDECK_BOOTSTRAP.config.nonce)
            selectedWidgets.forEach(id => formData.append('widgets[]', id))

            const response = await fetch(`${window.SYSTEMDECK_BOOTSTRAP.config.ajaxurl.replace('admin-ajax.php', '')}`, {
                method: 'POST',
                body: formData
            })
            const res = await response.json()

            if (res.success) {
                setMessage({ type: 'success', text: 'Selection saved! Refresh the Workspace to see changes.' })
                pushNotice('success', 'Selection saved! Refresh the Workspace to see changes.')
            } else {
                setMessage({ type: 'error', text: res.data?.message || 'Save failed' })
                pushNotice('error', res.data?.message || 'Save failed')
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Network error saving selection' })
            pushNotice('error', 'Network error saving selection')
        }
    }

    const toggleWidget = (id) => {
        setSelectedWidgets(prev =>
            prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
        )
    }

    return (
        <div className='sd-inspector-canvas'>
            <div className='sd-inspector-toolbar'>
                <Flex justify="space-between" align="center">
                    <FlexItem>
                        <Flex gap={4}>
                            <button type='button' className={`button button-secondary ${activeTab === 'browser' ? 'is-pressed' : ''}`} onClick={() => setActiveTab('browser')}>Browser</button>
                            <button type='button' className={`button button-secondary ${activeTab === 'scanner' ? 'is-pressed' : ''}`} onClick={() => setActiveTab('scanner')}>Scanner</button>
                        </Flex>
                    </FlexItem>
                    <FlexItem>
                        {activeTab === 'browser' && <strong>{url}</strong>}
                        {activeTab === 'scanner' && <button type='button' className='button button-primary' onClick={startScan} disabled={isScanning}>{isScanning ? <Spinner /> : 'Scan Dashboard'}</button>}
                    </FlexItem>
                </Flex>
            </div>

            {message && (
                <Notice status={message.type} onRemove={() => setMessage(null)} className='sd-inspector-notice'>
                    {message.text}
                </Notice>
            )}

            <div className='sd-inspector-body'>
                {activeTab === 'browser' ? (
                    <iframe src={url} className='sd-inspector-frame' title='Inspector Browser' />
                ) : (
                    <div className='sd-inspector-scanner'>
                        <Panel header="Dashboard Widgets">
                            <PanelBody title="Available for Proxying" initialOpen={true}>
                                {discoveredWidgets.length === 0 ? (
                                    <p>No widgets discovered yet. Run a scan to see available dashboard widgets.</p>
                                ) : (
                                    <div className='sd-inspector-widget-grid'>
                                        {discoveredWidgets.map(widget => (
                                            <div
                                                key={widget.id}
                                                className={`sd-inspector-widget-item ${selectedWidgets.includes(widget.id) ? 'is-selected' : ''}`}>
                                                <CheckboxControl
                                                    label={widget.title}
                                                    checked={selectedWidgets.includes(widget.id)}
                                                    onChange={() => toggleWidget(widget.id)}
                                                    help={widget.id}
                                                />
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {discoveredWidgets.length > 0 && (
                                    <div className='sd-inspector-actions'>
                                        <button type='button' className='button button-primary' onClick={saveSelection}>Save Selected Proxies</button>
                                    </div>
                                )}
                            </PanelBody>
                        </Panel>
                    </div>
                )}
            </div>
        </div>
    )
}

export default InspectorCanvas
