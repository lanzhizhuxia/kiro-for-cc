import { PromptLoader } from './promptLoader';

/**
 * Initialize the prompt loader
 * This must be called before using any prompts
 */
export function initializePrompts(): void {
    const loader = PromptLoader.getInstance();
    loader.initialize();
}