import * as vscode from 'vscode';

export class PermissionWebviewProvider {
    public static currentPanel: vscode.WebviewPanel | undefined;
    private static messageDisposable: vscode.Disposable | undefined;
    private static disposeDisposable: vscode.Disposable | undefined;

    public static createOrShow(context: vscode.ExtensionContext): Promise<boolean> {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // Clean up previous event listeners
        if (PermissionWebviewProvider.messageDisposable) {
            PermissionWebviewProvider.messageDisposable.dispose();
            PermissionWebviewProvider.messageDisposable = undefined;
        }
        if (PermissionWebviewProvider.disposeDisposable) {
            PermissionWebviewProvider.disposeDisposable.dispose();
            PermissionWebviewProvider.disposeDisposable = undefined;
        }

        // If we already have a panel, show it
        if (PermissionWebviewProvider.currentPanel) {
            PermissionWebviewProvider.currentPanel.reveal(column);
        } else {
            // Otherwise, create a new panel
            const panel = vscode.window.createWebviewPanel(
                'claudePermission',
                'Claude Code Permission',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                    localResourceRoots: [vscode.Uri.joinPath(context.extensionUri, 'media')]
                }
            );

            PermissionWebviewProvider.currentPanel = panel;

            // Get path to media
            const mediaPath = vscode.Uri.joinPath(context.extensionUri, 'media');
            const imagePath = panel.webview.asWebviewUri(vscode.Uri.joinPath(mediaPath, 'image.png'));

            // Set the webview's initial html content
            panel.webview.html = PermissionWebviewProvider.getWebviewContent(imagePath.toString());
        }

        // Return a promise that resolves when the user makes a choice
        return new Promise((resolve) => {
            const panel = PermissionWebviewProvider.currentPanel;
            if (!panel) {
                resolve(false);
                return;
            }

            // Handle messages from the webview
            PermissionWebviewProvider.messageDisposable = panel.webview.onDidReceiveMessage(
                async message => {
                    switch (message.command) {
                        case 'accept':
                            // Clean up before resolving
                            if (PermissionWebviewProvider.messageDisposable) {
                                PermissionWebviewProvider.messageDisposable.dispose();
                                PermissionWebviewProvider.messageDisposable = undefined;
                            }
                            if (PermissionWebviewProvider.disposeDisposable) {
                                PermissionWebviewProvider.disposeDisposable.dispose();
                                PermissionWebviewProvider.disposeDisposable = undefined;
                            }
                            panel.dispose();
                            PermissionWebviewProvider.currentPanel = undefined;
                            resolve(true);
                            return;
                        case 'cancel':
                            // Clean up before resolving
                            if (PermissionWebviewProvider.messageDisposable) {
                                PermissionWebviewProvider.messageDisposable.dispose();
                                PermissionWebviewProvider.messageDisposable = undefined;
                            }
                            if (PermissionWebviewProvider.disposeDisposable) {
                                PermissionWebviewProvider.disposeDisposable.dispose();
                                PermissionWebviewProvider.disposeDisposable = undefined;
                            }
                            panel.dispose();
                            PermissionWebviewProvider.currentPanel = undefined;
                            resolve(false);
                            return;
                        case 'openIssue':
                            await vscode.env.openExternal(vscode.Uri.parse('https://github.com/notdp/kiro-for-cc/issues/3'));
                            return;
                    }
                },
                undefined,
                context.subscriptions
            );

            // Reset when the current panel is closed
            PermissionWebviewProvider.disposeDisposable = panel.onDidDispose(
                () => {
                    // Clean up
                    if (PermissionWebviewProvider.messageDisposable) {
                        PermissionWebviewProvider.messageDisposable.dispose();
                        PermissionWebviewProvider.messageDisposable = undefined;
                    }
                    if (PermissionWebviewProvider.disposeDisposable) {
                        PermissionWebviewProvider.disposeDisposable.dispose();
                        PermissionWebviewProvider.disposeDisposable = undefined;
                    }
                    PermissionWebviewProvider.currentPanel = undefined;
                    resolve(false); // If closed without action, treat as cancel
                },
                null,
                context.subscriptions
            );
        });
    }

    private static getWebviewContent(imagePath: string): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Claude Code Permission</title>
    <style>
        @keyframes blink {
            0%, 49% { opacity: 1; }
            50%, 100% { opacity: 0; }
        }
        
        body {
            margin: 0;
            padding: 20px;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
            background: #000000;
            color: #00ff00;
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: 100vh;
        }
        
        .container {
            background: #0a0a0a;
            border: 2px solid #00ff00;
            padding: 30px;
            max-width: 600px;
            box-shadow: 0 0 20px rgba(0, 255, 0, 0.3);
            position: relative;
        }
        
        
        .terminal-header {
            color: #00ff00;
            margin-bottom: 20px;
            font-size: 14px;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        
        .terminal-title {
            display: flex;
            align-items: center;
        }
        
        .terminal-title::before {
            content: '$ ';
            color: #ffff00;
            margin-right: 5px;
        }
        
        .action-box {
            background: #111;
            border: 1px solid #333;
            padding: 20px;
            margin: 20px 0;
            position: relative;
        }
        
        .action-box h3 {
            color: #00ff00;
            margin: 0 0 15px 0;
            font-size: 18px;
            font-weight: normal;
            text-transform: uppercase;
        }
        
        .action-box h3::before {
            content: '[*] ';
            color: #ffff00;
        }
        
        .action-box p {
            margin: 10px 0;
            font-size: 14px;
            color: #00ff00;
        }
        
        .arrow-text {
            display: block;
            margin: 15px 0;
            font-size: 14px;
            color: #ffff00;
        }
        
        .arrow-text::after {
            content: '_';
            animation: blink 1s infinite;
        }
        
        .content {
            font-size: 14px;
            line-height: 1.6;
            margin-bottom: 20px;
            color: #00ff00;
        }
        
        .content p {
            margin: 10px 0;
        }
        
        .content strong {
            color: #ffff00;
            background: #333;
            padding: 2px 5px;
        }
        
        .image-container {
            position: relative;
            margin: 20px 0;
            padding: 10px;
            background: #111;
            border: 3px solid #ff0000;
            box-shadow: 0 0 20px rgba(255, 0, 0, 0.5);
        }
        
        .image-container::before {
            content: '!!! ATTENTION !!!';
            position: absolute;
            top: -15px;
            left: 20px;
            background: #000;
            color: #ff0000;
            padding: 0 10px;
            font-size: 14px;
            font-weight: bold;
            letter-spacing: 2px;
        }
        
        .image-container img {
            display: block;
            max-width: 100%;
            height: auto;
        }
        
        .options {
            margin-top: 30px;
            display: flex;
            gap: 20px;
            justify-content: center;
        }
        
        .option {
            padding: 12px 30px;
            cursor: pointer;
            transition: all 0.1s;
            font-size: 14px;
            font-weight: normal;
            border: 2px solid #00ff00;
            text-align: center;
            min-width: 180px;
            background: #000;
            color: #00ff00;
            text-transform: uppercase;
            position: relative;
            font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        }
        
        .option::before {
            content: '[ ';
            color: #ffff00;
        }
        
        .option::after {
            content: ' ]';
            color: #ffff00;
        }
        
        .option:hover {
            background: #00ff00;
            color: #000;
            box-shadow: 0 0 15px rgba(0, 255, 0, 0.8);
        }
        
        .option.cancel {
            border-color: #666;
            color: #999;
        }
        
        .option.cancel::before,
        .option.cancel::after {
            color: #666;
        }
        
        .option.cancel:hover {
            background: #333;
            color: #fff;
            border-color: #999;
            box-shadow: none;
        }
        
        .option.accept {
            border-color: #00ff00;
            color: #00ff00;
            animation: pulse-border 2s infinite;
        }
        
        @keyframes pulse-border {
            0%, 100% { box-shadow: 0 0 5px rgba(0, 255, 0, 0.5); }
            50% { box-shadow: 0 0 20px rgba(0, 255, 0, 0.8); }
        }
        
        .status-info {
            margin-top: 20px;
            padding: 10px;
            border: 1px solid #333;
            background: #0a0a0a;
            font-size: 12px;
            color: #666;
        }
        
        .status-info::before {
            content: '> ';
            color: #ffff00;
        }
        
        .issue-link {
            color: #666;
            text-decoration: none;
            font-size: 12px;
            transition: all 0.1s;
        }
        
        .issue-link:hover {
            color: #00ff00;
            text-decoration: underline;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="terminal-header">
            <div class="terminal-title">CLAUDE CODE PERMISSION SETUP v1.0</div>
            <a href="#" class="issue-link" onclick="openIssue(event)">[ ISSUE #3 ]</a>
        </div>
        
        <div class="action-box">
            <h3>Permission Setup Guide</h3>
            <p>> CHECK THE TERMINAL WINDOW ON THE RIGHT</p>
            <p>> LOOK FOR THE PERMISSION PROMPT</p>
            <span class="arrow-text">> LOOK FOR PERMISSION REQUEST BELOW</span>
        </div>
        
        <div class="image-container">
            <img src="${imagePath}" alt="Permission prompt example">
        </div>
        
        <div class="content">
            <p>> ACTION REQUIRED: <strong>Select "Yes, I accept"</strong></p>
            <p>> If you don't see the prompt above, permissions are already granted</p>
        </div>
        
        <div class="options">
            <div class="option accept" onclick="handleAccept()">
                I've Granted Permission
            </div>
            <div class="option cancel" onclick="handleCancel()">
                Cancel
            </div>
        </div>
        
        <div class="status-info">
            STATUS: Waiting for user confirmation...
        </div>
    </div>
    
    <script>
        const vscode = acquireVsCodeApi();
        
        function handleAccept() {
            vscode.postMessage({
                command: 'accept'
            });
        }
        
        function handleCancel() {
            vscode.postMessage({
                command: 'cancel'
            });
        }
        
        function openIssue(event) {
            event.preventDefault();
            vscode.postMessage({
                command: 'openIssue'
            });
        }
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                handleAccept();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        });
    </script>
</body>
</html>`;
    }
}