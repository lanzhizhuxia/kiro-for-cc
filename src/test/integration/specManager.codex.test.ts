/**
 * Integration tests for SpecManager Codex integration
 *
 * Tests the integration between SpecManager and CodexOrchestrator
 * for deep analysis of spec documents.
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { SpecManager } from '../../features/spec/specManager';
import { CodexOrchestrator } from '../../features/codex/codexOrchestrator';
import { ClaudeCodeProvider } from '../../providers/claudeCodeProvider';
import { ExecutionResult, TaskDescriptor } from '../../features/codex/types';

// Mock vscode
jest.mock('vscode');

// Mock ClaudeCodeProvider
jest.mock('../../providers/claudeCodeProvider');

describe('SpecManager - Codex Integration', () => {
    let specManager: SpecManager;
    let mockCodexOrchestrator: jest.Mocked<CodexOrchestrator>;
    let mockClaudeProvider: jest.Mocked<ClaudeCodeProvider>;
    let mockOutputChannel: vscode.OutputChannel;
    let mockContext: vscode.ExtensionContext;
    let mockWorkspaceRoot: string;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock paths
        mockWorkspaceRoot = '/test/workspace';

        // Setup mock output channel
        mockOutputChannel = {
            appendLine: jest.fn(),
            append: jest.fn(),
            show: jest.fn(),
            hide: jest.fn(),
            clear: jest.fn(),
            dispose: jest.fn(),
            replace: jest.fn()
        } as any;

        // Setup mock context
        mockContext = {
            extensionPath: '/test/extension',
            subscriptions: [],
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            }
        } as any;

        // Mock vscode.workspace
        (vscode.workspace as any) = {
            workspaceFolders: [{
                uri: { fsPath: mockWorkspaceRoot }
            }],
            fs: {
                readFile: jest.fn(),
                writeFile: jest.fn(),
                stat: jest.fn(),
                createDirectory: jest.fn()
            },
            openTextDocument: jest.fn()
        };

        // Mock vscode.Uri
        (vscode.Uri as any) = {
            file: jest.fn((filePath) => ({ fsPath: filePath }))
        };

        // Mock vscode.window
        (vscode.window as any) = {
            showInformationMessage: jest.fn(),
            showErrorMessage: jest.fn(),
            showTextDocument: jest.fn()
        };

        // Create mock Claude provider
        mockClaudeProvider = new ClaudeCodeProvider(mockContext, mockOutputChannel) as jest.Mocked<ClaudeCodeProvider>;

        // Create mock Codex orchestrator
        mockCodexOrchestrator = {
            executeTask: jest.fn()
        } as any;

        // Create SpecManager instance
        specManager = new SpecManager(mockClaudeProvider, mockOutputChannel);
    });

    describe('setCodexOrchestrator', () => {
        test('TC-SM-CODEX-001: Should set Codex orchestrator successfully', () => {
            // Act
            specManager.setCodexOrchestrator(mockCodexOrchestrator as any);

            // Assert
            expect(specManager.isCodexAvailable()).toBe(true);
            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('[SpecManager] Codex orchestrator set')
            );
        });
    });

    describe('isCodexAvailable', () => {
        test('TC-SM-CODEX-002: Should return false when Codex is not set', () => {
            // Assert
            expect(specManager.isCodexAvailable()).toBe(false);
        });

        test('TC-SM-CODEX-003: Should return true when Codex is set', () => {
            // Arrange
            specManager.setCodexOrchestrator(mockCodexOrchestrator as any);

            // Assert
            expect(specManager.isCodexAvailable()).toBe(true);
        });
    });

    describe('reviewDesignWithCodex', () => {
        const specName = 'test-spec';
        const designPath = '/test/workspace/.claude/specs/test-spec/design.md';
        const designContent = '# Design Document\n\nTest design content';

        beforeEach(() => {
            specManager.setCodexOrchestrator(mockCodexOrchestrator as any);

            // Mock file reading
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
                Buffer.from(designContent, 'utf-8')
            );

            // Mock file writing
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);

            // Mock document opening
            (vscode.workspace.openTextDocument as jest.Mock).mockResolvedValue({});
            (vscode.window.showTextDocument as jest.Mock).mockResolvedValue(undefined);
        });

        test('TC-SM-CODEX-004: Should throw error when Codex is not available', async () => {
            // Arrange
            const specManagerWithoutCodex = new SpecManager(mockClaudeProvider, mockOutputChannel);

            // Act & Assert
            await expect(
                specManagerWithoutCodex.reviewDesignWithCodex(specName, designPath)
            ).rejects.toThrow('Codex is not available');
        });

        test('TC-SM-CODEX-005: Should execute Codex analysis successfully', async () => {
            // Arrange
            const mockResult: ExecutionResult = {
                success: true,
                mode: 'codex',
                sessionId: 'test-session-123',
                startTime: new Date('2024-01-01T10:00:00Z'),
                endTime: new Date('2024-01-01T10:05:00Z'),
                duration: 300000,
                thinkingSummary: {
                    problemDecomposition: [
                        {
                            id: 'problem-1',
                            description: 'Test problem',
                            complexity: 7,
                            subProblems: [
                                {
                                    id: 'sub-1',
                                    description: 'Sub-problem 1',
                                    complexity: 5,
                                    subProblems: []
                                }
                            ]
                        }
                    ],
                    riskIdentification: [
                        {
                            id: 'risk-1',
                            category: 'technical',
                            severity: 'medium',
                            description: 'Test risk',
                            mitigation: 'Test mitigation'
                        }
                    ],
                    solutionComparison: [
                        {
                            id: 'sol-1',
                            approach: 'Test solution',
                            pros: ['Pro 1', 'Pro 2'],
                            cons: ['Con 1'],
                            complexity: 6,
                            score: 8
                        }
                    ],
                    recommendedDecision: {
                        selectedSolution: 'sol-1',
                        rationale: 'Test rationale',
                        estimatedEffort: '2 days',
                        nextSteps: ['Step 1', 'Step 2']
                    }
                }
            };

            mockCodexOrchestrator.executeTask.mockResolvedValue(mockResult);
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('View Result');

            // Act
            await specManager.reviewDesignWithCodex(specName, designPath);

            // Assert - Task descriptor
            expect(mockCodexOrchestrator.executeTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'review',
                    description: expect.stringContaining('Deep analysis of design document'),
                    specName,
                    context: expect.objectContaining({
                        design: designContent
                    })
                }),
                expect.objectContaining({
                    enableDeepThinking: true,
                    enableCodebaseScan: true,
                    forceMode: 'codex'
                })
            );

            // Assert - File saved
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
            const savedContent = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls[0][1];
            const savedText = Buffer.from(savedContent).toString('utf-8');
            expect(savedText).toContain('<!-- Generated by Codex Deep Analysis -->');
            expect(savedText).toContain('# Codex Deep Analysis Result');
            expect(savedText).toContain('## Problem Decomposition');
            expect(savedText).toContain('## Risk Identification');

            // Assert - Document opened
            expect(vscode.workspace.openTextDocument).toHaveBeenCalled();
            expect(vscode.window.showTextDocument).toHaveBeenCalled();
        });

        test('TC-SM-CODEX-006: Should handle analysis failure', async () => {
            // Arrange
            const mockResult: ExecutionResult = {
                success: false,
                mode: 'codex',
                sessionId: 'test-session-123',
                startTime: new Date(),
                endTime: new Date(),
                duration: 1000,
                error: {
                    message: 'Analysis failed'
                }
            };

            mockCodexOrchestrator.executeTask.mockResolvedValue(mockResult);

            // Act
            await specManager.reviewDesignWithCodex(specName, designPath);

            // Assert
            expect(vscode.window.showErrorMessage).toHaveBeenCalledWith(
                expect.stringContaining('Codex analysis failed')
            );
            expect(vscode.workspace.fs.writeFile).not.toHaveBeenCalled();
        });

        test('TC-SM-CODEX-007: Should handle execution error', async () => {
            // Arrange
            mockCodexOrchestrator.executeTask.mockRejectedValue(new Error('Network error'));

            // Act & Assert
            await expect(
                specManager.reviewDesignWithCodex(specName, designPath)
            ).rejects.toThrow('Network error');

            expect(mockOutputChannel.appendLine).toHaveBeenCalledWith(
                expect.stringContaining('[SpecManager] Codex analysis error')
            );
        });

        test('TC-SM-CODEX-008: Should handle user closing notification', async () => {
            // Arrange
            const mockResult: ExecutionResult = {
                success: true,
                mode: 'codex',
                sessionId: 'test-session-123',
                startTime: new Date(),
                endTime: new Date(),
                duration: 1000
            };

            mockCodexOrchestrator.executeTask.mockResolvedValue(mockResult);
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue('Close');

            // Act
            await specManager.reviewDesignWithCodex(specName, designPath);

            // Assert
            expect(vscode.workspace.openTextDocument).not.toHaveBeenCalled();
            expect(vscode.window.showTextDocument).not.toHaveBeenCalled();
        });
    });

    describe('reviewRequirementsWithCodex', () => {
        const specName = 'test-spec';
        const reqPath = '/test/workspace/.claude/specs/test-spec/requirements.md';
        const reqContent = '# Requirements\n\nTest requirements content';

        beforeEach(() => {
            specManager.setCodexOrchestrator(mockCodexOrchestrator as any);

            // Mock file reading
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
                Buffer.from(reqContent, 'utf-8')
            );

            // Mock file writing
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);
        });

        test('TC-SM-CODEX-009: Should execute requirements analysis successfully', async () => {
            // Arrange
            const mockResult: ExecutionResult = {
                success: true,
                mode: 'codex',
                sessionId: 'test-session-456',
                startTime: new Date(),
                endTime: new Date(),
                duration: 2000
            };

            mockCodexOrchestrator.executeTask.mockResolvedValue(mockResult);
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

            // Act
            await specManager.reviewRequirementsWithCodex(specName, reqPath);

            // Assert - Task descriptor
            expect(mockCodexOrchestrator.executeTask).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'review',
                    description: expect.stringContaining('Deep analysis of requirements document'),
                    specName,
                    context: expect.objectContaining({
                        requirements: reqContent
                    })
                }),
                expect.objectContaining({
                    enableDeepThinking: true,
                    enableCodebaseScan: false,  // Requirements shouldn't scan codebase
                    forceMode: 'codex'
                })
            );

            // Assert - File saved
            expect(vscode.workspace.fs.writeFile).toHaveBeenCalled();
        });

        test('TC-SM-CODEX-010: Should not enable codebase scan for requirements', async () => {
            // Arrange
            const mockResult: ExecutionResult = {
                success: true,
                mode: 'codex',
                sessionId: 'test-session-789',
                startTime: new Date(),
                endTime: new Date(),
                duration: 1500
            };

            mockCodexOrchestrator.executeTask.mockResolvedValue(mockResult);
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

            // Act
            await specManager.reviewRequirementsWithCodex(specName, reqPath);

            // Assert
            const executionOptions = (mockCodexOrchestrator.executeTask as jest.Mock).mock.calls[0][1];
            expect(executionOptions.enableCodebaseScan).toBe(false);
            expect(executionOptions.enableDeepThinking).toBe(true);
        });
    });

    describe('_formatAnalysisAsMarkdown', () => {
        test('TC-SM-CODEX-011: Should format result with thinking summary', async () => {
            // Arrange
            specManager.setCodexOrchestrator(mockCodexOrchestrator as any);

            const mockResult: ExecutionResult = {
                success: true,
                mode: 'codex',
                sessionId: 'test-session-111',
                startTime: new Date('2024-01-01T10:00:00Z'),
                endTime: new Date('2024-01-01T10:05:00Z'),
                duration: 300000,
                output: 'Test output content',
                generatedFiles: ['file1.ts', 'file2.ts'],
                thinkingSummary: {
                    problemDecomposition: [
                        {
                            id: 'main-1',
                            description: 'Main problem',
                            complexity: 8,
                            subProblems: [
                                {
                                    id: 'sub-1',
                                    description: 'Sub 1',
                                    complexity: 4,
                                    subProblems: []
                                },
                                {
                                    id: 'sub-2',
                                    description: 'Sub 2',
                                    complexity: 5,
                                    subProblems: []
                                }
                            ]
                        }
                    ],
                    riskIdentification: [],
                    solutionComparison: [
                        {
                            id: 'sol-a',
                            approach: 'Solution A',
                            pros: ['Pro 1'],
                            cons: ['Con 1'],
                            complexity: 5,
                            score: 8
                        }
                    ],
                    recommendedDecision: {
                        selectedSolution: 'sol-a',
                        rationale: 'Test decision rationale',
                        estimatedEffort: '1 week',
                        nextSteps: ['Reason 1']
                    }
                }
            };

            mockCodexOrchestrator.executeTask.mockResolvedValue(mockResult);
            (vscode.workspace.fs.readFile as jest.Mock).mockResolvedValue(
                Buffer.from('test content', 'utf-8')
            );
            (vscode.workspace.fs.writeFile as jest.Mock).mockResolvedValue(undefined);
            (vscode.window.showInformationMessage as jest.Mock).mockResolvedValue(undefined);

            // Act
            await specManager.reviewDesignWithCodex('test-spec', '/test/design.md');

            // Assert
            const savedContent = (vscode.workspace.fs.writeFile as jest.Mock).mock.calls[0][1];
            const savedText = Buffer.from(savedContent).toString('utf-8');

            expect(savedText).toContain('# Codex Deep Analysis Result');
            expect(savedText).toContain('## Problem Decomposition');
            expect(savedText).toContain('## Risk Identification');
            expect(savedText).toContain('## Solution Comparison');
            expect(savedText).toContain('## Recommended Decision');
            expect(savedText).toContain('## Analysis Output');
            expect(savedText).toContain('## Execution Information');
            expect(savedText).toContain('Session ID: test-session-111');
            expect(savedText).toContain('Generated Files: file1.ts, file2.ts');
        });
    });
});
