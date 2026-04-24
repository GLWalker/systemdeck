/**
 * SystemDeck Redux Action Types
 * Ported from systemdeck-yesterday
 */

// Session
export const SET_ACTIVE_WORKSPACE = "SET_ACTIVE_WORKSPACE"
export const SET_CURRENT_USER = "SET_CURRENT_USER"
export const SET_ENVIRONMENT = "SET_ENVIRONMENT"

// Workspaces
export const REGISTER_WORKSPACE = "REGISTER_WORKSPACE"
export const UNREGISTER_WORKSPACE = "UNREGISTER_WORKSPACE"
export const UPDATE_WORKSPACE_CONFIG = "UPDATE_WORKSPACE_CONFIG"
export const SD_WORKSPACE_ADD = "SD_WORKSPACE_ADD"
export const SD_WORKSPACE_REMOVE = "SD_WORKSPACE_REMOVE"
export const SD_WORKSPACE_REORDER = "SD_WORKSPACE_REORDER"
export const SD_WORKSPACE_RENAME = "SD_WORKSPACE_RENAME"

// Layouts
export const UPDATE_LAYOUT_ITEM = "UPDATE_LAYOUT_ITEM" // Move/Resize
export const SET_LAYOUT_ITEMS = "SET_LAYOUT_ITEMS" // Bulk set (load)
export const ADD_LAYOUT_ITEM = "ADD_LAYOUT_ITEM"
export const REMOVE_LAYOUT_ITEM = "REMOVE_LAYOUT_ITEM"

// Widgets
export const REGISTER_WIDGET = "REGISTER_WIDGET"
export const UNREGISTER_WIDGET = "UNREGISTER_WIDGET"

// Pins
export const ADD_PIN = "ADD_PIN"
export const UPDATE_PIN = "UPDATE_PIN"
export const REMOVE_PIN = "REMOVE_PIN"
export const SET_PINS = "SET_PINS" // Bulk load

// UI
export const SET_DOCK_STATE = "SET_DOCK_STATE"
export const SET_ALIVE_STATE = "SET_ALIVE_STATE" // sd_is_active
export const SET_THEME = "SET_THEME"
export const TOGGLE_PANEL = "TOGGLE_PANEL"
export const SET_MENU_FOLDED = "SET_MENU_FOLDED"
export const SET_ACTIVE_SCREEN = "SET_ACTIVE_SCREEN" // #system, #workspace-xyz
export const SET_UI_MODE = "SET_UI_MODE" // runtime, config
export const SET_REGISTRY_ENABLEMENT = "SET_REGISTRY_ENABLEMENT"
export const TOGGLE_PIN_PICKER = "TOGGLE_PIN_PICKER"
