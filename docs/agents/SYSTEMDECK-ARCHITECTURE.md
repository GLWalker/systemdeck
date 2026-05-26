# SYSTEMDECK-ARCHITECTURE.md

## 1. Purpose

This document represents the high-level architecture of the SystemDeck plugin. It defines the structural principles, namespace boundaries, and ingestion hierarchy required for plugin-specific intelligence as a Tier 2 Extension Corpus.

## 2. Ingestion Hierarchy

Agents SHOULD ingest the plugin extension corpus in the following order:

1. **Manifest (This File)**: To understand system boundaries and namespaces.
2. **PHP Intelligence (`SYSTEMDECK-PHP-LLM.md`)**: To understand execution logic, services, and hooks.
3. **JS Intelligence (`SYSTEMDECK-JS-LLM.md`)**: To understand client-side React and Block editor interactions.
4. **CSS Intelligence (`SYSTEMDECK-CSS-LLM.md`)**: To understand visual realizations and widget boundaries.
5. **JSON Intelligence (`SYSTEMDECK-JSON-LLM.md`)**: To understand block metadata and declarative configuration.

## 3. Core Constructs

- **Symbols**: Namespaced identifiers (`SystemDeck\`) and structural component slugs.
- **Events**: Bound actions/filters to Core and Plugin-specific hooks.
- **Registrations**: Extension declarations including block types, REST routes, AJAX actions, and CPTs (Canvas Repository).
- **Context**: State origins including the `systemdeck_` prefix and the `SystemDeck\Core` resolution context.
- **Patterns**: Reusable structural logic including "App Providers" and "Infrastructure Registration".

## 4. Layer Governance

- **Extension Type**: Tier 2 (Extension Corpus).
- **Precedence**: Tier 0 (Core Corpus) always takes absolute precedence.
- **Constraint**: Plugin corpus must extend, not redefine, system behavior. All execution logic is confined to the PHP layer.

## 5. Record Schema Enforcement

### Symbol Record
- `type`: Category identifier (symbol).
- `name`: string (Full namespaced identifier).
- `category`: Domain identifier (core|service|block|widget).

### Event Record
- `type`: Category identifier (event).
- `trigger`: Execution identifier (hook name).

### Registration Record
- `type`: Category identifier (registration).
- `category`: Extension declaration type (block|rest|ajax|cpt).

### Pattern Record
- `type`: Category identifier (pattern).
- `required_components`: List of symbols, hooks, or files.

## 6. Dual Confidence Model

### Extraction Confidence (Reliability)
- **1.0**: Complete structured definition (Public stable API / PHPDoc).
- **0.7**: Partial definition (Inferred from implementation).
- **0.3**: Inferred or incomplete construct.

### Usage Confidence (Safety)
- **1.0**: Public stable API (Standard plugin hooks and settings).
- **0.5**: Internal or restricted (Internal system-only logic).
- **0.1**: Deprecated (Legacy or obsolete plugin constructs).

## 7. Standard Patterns

### Infrastructure Registration
- **Definition**: Sequential loading of core services and block contracts.
- **Components**: `systemdeck_register_infrastructure`, `SystemDeck\Core\Services\CanvasRepository::init()`.
- **Structure**: Registered during early initialization to ensure internal availability.

### App Provider Modules
- **Definition**: Dynamic discovery and loading of external feature modules.
- **Components**: `systemdeck_load_app_provider_modules`, `systemdeck_load_app_providers`.
- **Structure**: Uses filters and actions to allow modular extension by third-party providers.

## 8. Weak / Non-Standard Patterns

### Structural Weaknesses
- **If present**, use of global state mutation without verified isolation.
- **If present**, dynamic hook names that obscure execution tracing.

### Ambiguous Constructs
- **Manual Overrides**: Hardcoding core system expectations instead of using verified API responses.
- **Unverified Bindings**: Speculative bindings not explicitly present in the plugin source.

## 9. Output Shape

### Symbol Record Structure

```json
{
	"type": "symbol",
	"name": "string",
	"category": "string",
	"description": "string",
	"signature": "string",
	"since": "string",
	"extraction_confidence": 0.0,
	"usage_confidence": 0.0
}
```

### Event Record Structure

```json
{
	"type": "event",
	"name": "string",
	"category": "string",
	"trigger": "string",
	"description": "string",
	"extraction_confidence": 0.0,
	"usage_confidence": 0.0
}
```

### Registration Record Structure

```json
{
	"type": "registration",
	"category": "string",
	"identifier": "string",
	"arguments": {},
	"callback": "string",
	"extraction_confidence": 0.0,
	"usage_confidence": 0.0
}
```

### Pattern Record Structure

```json
{
	"type": "pattern",
	"name": "string",
	"description": "string",
	"required_components": ["string"],
	"extraction_confidence": 0.0,
	"usage_confidence": 0.0
}
```
