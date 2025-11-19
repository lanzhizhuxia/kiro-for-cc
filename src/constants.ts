// VSCode configuration namespace for this extension
export const VSC_CONFIG_NAMESPACE = 'kfc';

// File names
export const CONFIG_FILE_NAME = 'kfc-settings.json';

// Default configuration
export const DEFAULT_CONFIG = {
    paths: {
        specs: 'docs/specs',         // Project documentation (Git tracked)
        steering: '.claude/steering',
        settings: '.claude/settings'
    },
    views: {
        specs: true,
        steering: true,
        mcp: true,
        hooks: true,
        settings: false
    }
} as const;

// Sam working directory paths (temporary files, not tracked in Git)
export const SAM_PATHS = {
    workDir: '.claude/specs',           // Sam's temporary working directory
    systemPrompts: '.claude/system-prompts',
    codex: '.claude/codex'
} as const;

// Legacy exports for backward compatibility (can be removed after updating all references)
export const DEFAULT_PATHS = DEFAULT_CONFIG.paths;
export const DEFAULT_VIEW_VISIBILITY = DEFAULT_CONFIG.views;