<?php
/**
 * SystemDeck Context
 * Defines the signature for state resolution.
 */

declare(strict_types=1);

namespace SystemDeck\Core;

if (!defined('ABSPATH')) {
    exit;
}

class Context
{
    public int $user_id;
    public string $workspace_id; // The workspace slug (e.g., 'dashboard', 'retail')
    public string $context_type; // 'global', 'template', 'post'
    public string $context_id;   // 'global', {post_type}, or {post_id}
    public string $viewport;     // 'desktop', 'mobile', or 'all'

    public function __construct(
        int $user_id,
        string $workspace_id,
        string $context_type = 'global',
        string $context_id = 'global',
        string $viewport = 'all'
    ) {
        $this->user_id = $user_id;
        $this->workspace_id = $workspace_id;
        $this->context_type = $context_type;
        $this->context_id = $context_id;
        $this->viewport = $viewport;
    }

    /**
     * Get a string representation of the signature for caching keys.
     */
    public function get_signature(): string
    {
        return sprintf(
            '%d_%s_%s_%s_%s',
            $this->user_id,
            $this->workspace_id,
            $this->context_type,
            $this->context_id,
            $this->viewport
        );
    }
}
