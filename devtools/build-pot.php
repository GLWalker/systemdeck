<?php
/**
 * SystemDeck POT Builder
 *
 * A dependency-free script to scan the plugin and generate a .pot file.
 * Usage: php devtools/build-pot.php
 */

// Config
$plugin_root = dirname(__DIR__);
$output_file = $plugin_root . '/languages/systemdeck.pot';
$text_domain = 'systemdeck';
$package_name = 'SystemDeck';
$bug_report = 'https://systemdeck.dev';

echo "SystemDeck POT Builder\n";
echo "======================\n";
echo "Scanning: $plugin_root\n";

// 1. Scan Files
$files = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($plugin_root)
);

$php_files = [];
foreach ($files as $file) {
    if ($file->isDir())
        continue;
    if ($file->getExtension() !== 'php')
        continue;
    if (strpos($file->getPathname(), 'devtools/') !== false)
        continue; // Skip self
    if (strpos($file->getPathname(), 'node_modules/') !== false)
        continue;
    if (strpos($file->getPathname(), 'vendor/') !== false)
        continue;

    $php_files[] = $file->getPathname();
}

echo "Found " . count($php_files) . " PHP files.\n";

// 2. Extract Strings
$strings = []; // [msgid => [func, file, line, context]]

// Regex to catch standard WP l10n functions
// Matches: __('text', 'domain'), _e('text', 'domain'), esc_attr_e('text', 'domain'), etc.
// Very basic regex - assumes standard formatting
$pattern = '/\b(' .
    '__|' .
    '_e|' .
    '_x|' .
    'esc_html__|' .
    'esc_html_e|' .
    'esc_html_x|' .
    'esc_attr__|' .
    'esc_attr_e|' .
    'esc_attr_x|' .
    '_n|' .
    '_nx' .
    ')\s*\(\s*([\'"])(.*?)(?<!\\\\)\2\s*(?:,\s*([\'"])(.*?)(?<!\\\\)\4)?\s*(?:,\s*([\'"])(.*?)(?<!\\\\)\6)?/';

foreach ($php_files as $file_path) {
    $content = file_get_contents($file_path);
    $lines = explode("\n", $content);

    // Simple line-by-line scan for line numbers (approximate)
    foreach ($lines as $line_num => $line) {
        if (preg_match_all($pattern, $line, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $func = $match[1];
                $quote = $match[2];
                $msgid = $match[3];

                // Check domain (arg 2 usually)
                $domain_arg = isset($match[5]) ? $match[5] : '';

                // If domain is present and doesn't match, skip
                // Ideally we'd parse args better, but for this codebase it's fine
                if ($domain_arg && $domain_arg !== $text_domain) {
                    continue;
                }

                // Unescape
                $msgid = str_replace(["\\'", '\\"'], ["'", '"'], $msgid);

                // Context handling (x functions)
                $context = '';
                if (in_array($func, ['_x', 'esc_html_x', 'esc_attr_x', '_nx'])) {
                    // Start simple: assume if it's an X function, the 2nd extracted string in regex group might be context?
                    // The regex above is a bit loose for all variations.
                    // For now, SystemDeck uses standard _e and __ and esc_attr_e.
                    // We will stick to basic support.
                }

                $key = $msgid; // context would change key

                if (!isset($strings[$key])) {
                    $strings[$key] = [
                        'msgid' => $msgid,
                        'locations' => []
                    ];
                }

                // Relative path
                $rel_path = str_replace($plugin_root . '/', '', $file_path);
                $strings[$key]['locations'][] = "$rel_path:" . ($line_num + 1);
            }
        }
    }
}

echo "Extracted " . count($strings) . " unique strings.\n";

// 3. Generate POT
$output = "";
$output .= "# Copyright (C) " . date('Y') . " $package_name\n";
$output .= "# This file is distributed under the same license as the $package_name package.\n";
$output .= "msgid \"\"\n";
$output .= "msgstr \"\"\n";
$output .= "\"Project-Id-Version: $package_name\\n\"\n";
$output .= "\"Report-Msgid-Bugs-To: $bug_report\\n\"\n";
$output .= "\"MIME-Version: 1.0\\n\"\n";
$output .= "\"Content-Type: text/plain; charset=UTF-8\\n\"\n";
$output .= "\"Content-Transfer-Encoding: 8bit\\n\"\n";
$output .= "\"PO-Revision-Date: " . date('Y-m-d H:iO') . "\\n\"\n";
$output .= "\"Last-Translator: FULL NAME <EMAIL@ADDRESS>\\n\"\n";
$output .= "\"Language-Team: LANGUAGE <LL@li.org>\\n\"\n";
$output .= "\n";

ksort($strings);

foreach ($strings as $str) {
    foreach ($str['locations'] as $loc) {
        $output .= "#: $loc\n";
    }
    $output .= "msgid \"" . addcslashes($str['msgid'], '"') . "\"\n";
    $output .= "msgstr \"\"\n";
    $output .= "\n";
}

// 4. Write File
if (file_put_contents($output_file, $output)) {
    echo "Success! POT file saved to:\n$output_file\n";
} else {
    echo "Error: Could not write to $output_file\n";
    exit(1);
}
