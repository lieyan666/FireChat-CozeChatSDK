/**
 * FireChat-CozeChatSDK 服务器入口文件
 * 使用模块化架构重构后的主入口
 */

const FireChatApp = require('./modules/app');

// 创建应用程序实例
const app = new FireChatApp();

// 启动应用程序
async function startServer() {
  try {
    await app.start();
    
    // 启动定期清理任务
    app.startCleanupTasks();
    
  } catch (error) {
    console.error('❌ 服务器启动失败:', error);
    process.exit(1);
  }
}

// 如果直接运行此文件，则启动服务器
if (require.main === module) {
  startServer();
}

// 导出应用程序实例（用于测试或其他用途）
module.exports = app;