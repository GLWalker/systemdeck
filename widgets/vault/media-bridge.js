/**
 * SystemDeck Vault Media Bridge
 * Injects porting capabilities directly into the native WordPress Media Library.
 */
jQuery(document).ready(function($) {
    if (typeof wp !== 'undefined' && wp.media) {
        // Wait for attachment details modal to load and inject button into the actions bar
        const checkToolbar = setInterval(function() {
            const actions = $('.attachment-info .actions');
            
            // If the actions bar exists but our button doesn't
            if (actions.length && !$('#sd-vault-import-btn').length) {
                // Remove from any global toolbars if they existed
                $('#sd-vault-import-btn').remove(); 
                
                // Append directly to the details array next to 'Delete permanently'
                actions.append(' | <button class="button-link" type="button" id="sd-vault-import-btn" style="color:#135e96; text-decoration:none;">Send to SystemDeck</button>');
                
                $('#sd-vault-import-btn').on('click', function(e) {
                    e.preventDefault();
                    
                    // We can determine the ID easily from the URL params when viewing details modal
                    const search = window.location.search || window.location.hash;
                    const match = search.match(/item=([0-9]+)/);
                    let id = 0;
                    
                    if (match && match[1]) {
                        id = match[1];
                    } else {
                        // Fallback: Check the Delete Permanently link URL explicitly mapped by WordPress
                        const delBtn = $('.delete-attachment');
                        if (delBtn.length) {
                            const href = delBtn.attr('href') || '';
                            const idMatch = href.match(/post=([0-9]+)/);
                            if (idMatch && idMatch[1]) {
                                id = idMatch[1];
                            }
                        }
                    }

                    if (!id) {
                        alert("Could not determine the selected file ID.");
                        return;
                    }
                    
                    if (confirm("Import this file into your private SystemDeck Vault?")) {
                        const btn = $(this);
                        btn.prop('disabled', true).text('Importing...');
                        
                        $.post(sd_vault_bridge.ajaxurl, {
                            action: 'sd_core_vault_ajax_import_from_media_library',
                            id: id,
                            _ajax_nonce: sd_vault_bridge.nonce
                        }, function(res) {
                            btn.prop('disabled', false).text('Send to SystemDeck');
                            if (res.success) {
                                alert("File successfully copied to your SystemDeck Vault!");
                            } else {
                                alert("Import failed: " + (res.data || "Unknown error"));
                            }
                        }).fail(function() {
                            btn.prop('disabled', false).text('Send to SystemDeck');
                            alert("Request failed.");
                        });
                    }
                });
            }
        }, 500);
    }
});
