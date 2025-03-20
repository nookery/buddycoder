// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { createAIService } from './services/AIService';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "buddycoder" is now active!');

	// 注册一个命令，用于打开对话框
	let disposable = vscode.commands.registerCommand('buddycoder.openChat', () => {
		// 创建AI服务
		const aiService = createAIService();

		// 创建并显示新的webview面板
		const panel = vscode.window.createWebviewPanel(
			'buddyCoderChat',
			'BuddyCoder Chat',
			vscode.ViewColumn.Two,
			{
				enableScripts: true,
				retainContextWhenHidden: true,
			}
		);

		// 处理来自WebView的消息
		panel.webview.onDidReceiveMessage(async message => {
			try {
				switch (message.type) {
					case 'message':
						// 创建新的消息ID
						const messageId = Date.now().toString();
						// 发送消息开始标记
						panel.webview.postMessage({
							type: 'startResponse',
							messageId
						});

						// 获取AI响应
						await aiService.sendMessage(message.text, (partial) => {
							// 发送部分响应
							panel.webview.postMessage({
								type: 'partialResponse',
								messageId,
								text: partial
							});
						});

						// 发送消息结束标记
						panel.webview.postMessage({
							type: 'endResponse',
							messageId
						});
						break;

					case 'openSettings':
						// 打开设置页面，并定位到扩展设置
						vscode.commands.executeCommand('workbench.action.openSettings', 'buddycoder');
						break;
				}
			} catch (error) {
				if (error instanceof Error) {
					panel.webview.postMessage({
						type: 'error',
						text: error.message
					});
				}
			}
		});

		// 设置webview的HTML内容
		panel.webview.html = getWebviewContent();
	});

	context.subscriptions.push(disposable);
}

// 生成webview的HTML内容
function getWebviewContent() {
	return `<!DOCTYPE html>
	<html lang="en">
	<head>
		<meta charset="UTF-8">
		<meta name="viewport" content="width=device-width, initial-scale=1.0">
		<title>BuddyCoder Chat</title>
		<style>
			body {
				padding: 20px;
				font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
			}
			.chat-container {
				display: flex;
				flex-direction: column;
				height: calc(100vh - 40px);
			}
			.header {
				display: flex;
				justify-content: space-between;
				align-items: center;
				margin-bottom: 20px;
			}
			.settings-button {
				background: transparent;
				border: 1px solid #007acc;
				color: #007acc;
				padding: 4px 8px;
				font-size: 12px;
			}
			.settings-button:hover {
				background-color: #007acc;
				color: white;
			}
			.messages {
				flex-grow: 1;
				overflow-y: auto;
				margin-bottom: 20px;
				border: 1px solid #ccc;
				padding: 10px;
				border-radius: 4px;
			}
			.message {
				margin-bottom: 10px;
				padding: 8px;
				border-radius: 4px;
				white-space: pre-wrap;
			}
			.user-message {
				background-color: #007acc;
				color: white;
				align-self: flex-end;
			}
			.ai-message {
				background-color: #f0f0f0;
				color: #333;
			}
			.error-message {
				background-color: #ff6b6b;
				color: white;
			}
			.input-container {
				display: flex;
				gap: 10px;
			}
			#messageInput {
				flex-grow: 1;
				padding: 8px;
				border: 1px solid #ccc;
				border-radius: 4px;
			}
			button {
				padding: 8px 16px;
				background-color: #007acc;
				color: white;
				border: none;
				border-radius: 4px;
				cursor: pointer;
			}
			button:hover {
				background-color: #005999;
			}
			.loading {
				display: none;
				color: #666;
				font-style: italic;
				margin: 10px 0;
			}
			.cursor {
				display: inline-block;
				width: 0.5em;
				height: 1em;
				background-color: currentColor;
				margin-left: 2px;
				animation: blink 1s infinite;
			}
			@keyframes blink {
				50% { opacity: 0; }
			}
		</style>
	</head>
	<body>
		<div class="chat-container">
			<div class="header">
				<h2 style="margin: 0;">BuddyCoder Chat</h2>
				<button class="settings-button" id="settingsButton">
					<span style="margin-right: 4px;">⚙️</span> Settings
				</button>
			</div>
			<div class="messages" id="messages"></div>
			<div class="loading" id="loading">AI is thinking...</div>
			<div class="input-container">
				<input type="text" id="messageInput" placeholder="Type your message...">
				<button id="sendButton">Send</button>
			</div>
		</div>
		<script>
			const vscode = acquireVsCodeApi();
			const messagesContainer = document.getElementById('messages');
			const messageInput = document.getElementById('messageInput');
			const sendButton = document.getElementById('sendButton');
			const loadingIndicator = document.getElementById('loading');
			const settingsButton = document.getElementById('settingsButton');

			// 当前正在生成的消息元素
			let currentMessageElement = null;
			let currentMessageId = null;

			// 处理设置按钮点击
			settingsButton.addEventListener('click', () => {
				vscode.postMessage({
					type: 'openSettings'
				});
			});

			// 发送消息
			function sendMessage() {
				const message = messageInput.value;
				if (message.trim()) {
					// 添加用户消息到界面
					addMessage('user', message);
					
					// 清空输入框
					messageInput.value = '';
					
					// 显示加载指示器
					loadingIndicator.style.display = 'block';
					
					// 禁用输入和发送按钮
					messageInput.disabled = true;
					sendButton.disabled = true;
					
					// 发送消息到扩展
					vscode.postMessage({
						type: 'message',
						text: message
					});
				}
			}

			// 添加消息到界面
			function addMessage(type, text) {
				const messageElement = document.createElement('div');
				messageElement.className = 'message ' + (type === 'user' ? 'user-message' : type === 'error' ? 'error-message' : 'ai-message');
				messageElement.textContent = type === 'user' ? 'You: ' + text : text;
				messagesContainer.appendChild(messageElement);
				messagesContainer.scrollTop = messagesContainer.scrollHeight;
				return messageElement;
			}

			// 处理来自扩展的消息
			window.addEventListener('message', event => {
				const message = event.data;

				switch (message.type) {
					case 'startResponse':
						// 创建新的AI消息元素
						currentMessageElement = document.createElement('div');
						currentMessageElement.className = 'message ai-message';
						currentMessageId = message.messageId;
						
						// 添加光标
						const cursor = document.createElement('span');
						cursor.className = 'cursor';
						currentMessageElement.appendChild(cursor);
						
						messagesContainer.appendChild(currentMessageElement);
						messagesContainer.scrollTop = messagesContainer.scrollHeight;
						
						// 隐藏加载指示器
						loadingIndicator.style.display = 'none';
						break;

					case 'partialResponse':
						if (currentMessageElement && currentMessageId === message.messageId) {
							// 移除旧的光标
							const cursor = currentMessageElement.querySelector('.cursor');
							if (cursor) {
								cursor.remove();
							}
							
							// 添加新的文本
							const textNode = document.createTextNode(message.text);
							currentMessageElement.appendChild(textNode);
							
							// 添加新的光标
							const newCursor = document.createElement('span');
							newCursor.className = 'cursor';
							currentMessageElement.appendChild(newCursor);
							
							messagesContainer.scrollTop = messagesContainer.scrollHeight;
						}
						break;

					case 'endResponse':
						if (currentMessageElement && currentMessageId === message.messageId) {
							// 移除最后的光标
							const cursor = currentMessageElement.querySelector('.cursor');
							if (cursor) {
								cursor.remove();
							}
							
							currentMessageElement = null;
							currentMessageId = null;
							
							// 启用输入和发送按钮
							messageInput.disabled = false;
							sendButton.disabled = false;
							messageInput.focus();
						}
						break;

					case 'error':
						addMessage('error', message.text);
						// 启用输入和发送按钮
						messageInput.disabled = false;
						sendButton.disabled = false;
						// 隐藏加载指示器
						loadingIndicator.style.display = 'none';
						break;
				}
			});

			// 添加事件监听器
			sendButton.addEventListener('click', sendMessage);
			messageInput.addEventListener('keypress', (e) => {
				if (e.key === 'Enter') {
					sendMessage();
				}
			});
		</script>
	</body>
	</html>`;
}

// This method is called when your extension is deactivated
export function deactivate() { }
