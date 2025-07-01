/**
 * 应用程序主类
 * 整合所有模块，提供统一的应用程序入口
 */

const express = require('express');
const path = require('path');
const ConfigManager = require('./config');
const Logger = require('./logger');
const MiddlewareManager = require('./middleware');
const ApiRoutes = require('./routes');
const JWTUtils = require('../utils/jwtUtils');
const CozeClient = require('../utils/cozeClient');

class FireChatApp {
  constructor() {
    this.app = null;
    this.server = null;
    this.configManager = null;
    this.logger = null;
    this.middlewareManager = null;
    this.apiRoutes = null;
    this.cozeClient = null;
    this.jwtUtils = null;
    this.isShuttingDown = false;
    
    // 绑定方法
    this.gracefulShutdown = this.gracefulShutdown.bind(this);
  }

  /**
   * 初始化应用程序
   */
  async initialize() {
    try {
      // 1. 初始化配置管理器
      this.configManager = new ConfigManager('config');
      
      // 2. 验证配置
      const validation = this.configManager.validateConfig();
      if (!validation.valid) {
        console.error('❌ 配置验证失败:');
        validation.errors.forEach(error => console.error(`  - ${error}`));
        process.exit(1);
      }
      
      // 3. 初始化日志器
      this.logger = new Logger(this.configManager.getLoggingConfig());
      
      // 4. 初始化JWT工具和Coze客户端
      this.jwtUtils = new JWTUtils();
      this.cozeClient = new CozeClient(this.jwtUtils);
      
      // 5. 初始化Express应用
      this.app = express();
      
      // 6. 初始化中间件管理器
      this.middlewareManager = new MiddlewareManager(this.configManager, this.logger);
      
      // 7. 初始化API路由
      this.apiRoutes = new ApiRoutes(this.cozeClient, this.configManager, this.logger);
      
      // 8. 配置应用程序
      this.setupApp();
      
      this.logger.success('应用程序初始化完成');
      
    } catch (error) {
      console.error('❌ 应用程序初始化失败:', error);
      process.exit(1);
    }
  }

  /**
   * 配置Express应用程序
   */
  setupApp() {
    // 1. 设置基础中间件
    this.middlewareManager.setupMiddleware(this.app);
    
    // 2. 设置API路由
    this.app.use('/', this.apiRoutes.getRouter());
    
    // 3. 设置错误处理中间件（必须在最后）
    this.middlewareManager.createErrorHandlers(this.app);
    
    // 4. 设置进程信号处理
    this.setupProcessHandlers();
  }

  /**
   * 启动服务器
   */
  async start() {
    try {
      if (!this.app) {
        await this.initialize();
      }
      
      const port = this.configManager.getPort();
      const environment = this.configManager.getEnvironment();
      
      this.server = this.app.listen(port, () => {
        this.logStartupInfo(port, environment);
      });
      
      // 设置服务器超时
      this.server.timeout = 30000; // 30秒
      this.server.keepAliveTimeout = 5000; // 5秒
      this.server.headersTimeout = 6000; // 6秒
      
      return this.server;
      
    } catch (error) {
      this.logger.error('启动服务器失败:', error);
      process.exit(1);
    }
  }

  /**
   * 记录启动信息
   */
  logStartupInfo(port, environment) {
    const configSummary = this.configManager.getConfigSummary();
    const cozeConfig = this.jwtUtils.getConfig();
    
    this.logger.startup('🚀 FireChat-CozeChatSDK 服务启动成功!');
    this.logger.startup(`📡 服务地址: http://localhost:${port}`);
    this.logger.startup(`🌍 运行环境: ${environment === 'production' ? '🔴 生产环境' : '🟡 开发环境'}`);
    this.logger.startup(`🔗 Coze API: ${cozeConfig.coze_api_base}`);
    this.logger.startup(`📊 CORS源: ${configSummary.cors_origins_count} 个`);
    this.logger.startup(`💾 缓存配置: TTL=${configSummary.cache_ttl}分钟, 大小=${configSummary.cache_size}`);
    this.logger.startup(`📝 日志级别: ${configSummary.logging_level}`);
    
    // OTA更新状态
    if (environment === 'production') {
      this.logger.startup('🔄 OTA更新: ✅ 已启用 (POST /api/update)');
    } else {
      this.logger.startup('🔄 OTA更新: ❌ 已禁用 (仅生产环境可用)');
    }
    
    // 配置文件状态
    const configFiles = configSummary.config_files;
    this.logger.startup(`📁 配置文件: server.json ${configFiles.server ? '✅' : '❌'}, coze.json ${configFiles.coze ? '✅' : '❌'}`);
    
    // 彩色日志提示
    if (configSummary.logging_level !== 'error') {
      this.logger.startup('🎨 彩色日志已启用');
    }
    
    this.logger.startup('=' .repeat(60));
  }

  /**
   * 设置进程信号处理
   */
  setupProcessHandlers() {
    // 优雅关闭信号
    process.on('SIGTERM', this.gracefulShutdown);
    process.on('SIGINT', this.gracefulShutdown);
    
    // 未捕获异常处理
    process.on('uncaughtException', (error) => {
      this.logger.error('未捕获的异常:', error);
      this.gracefulShutdown();
    });
    
    // 未处理的Promise拒绝
    process.on('unhandledRejection', (reason, promise) => {
      this.logger.error('未处理的Promise拒绝:', { reason, promise });
      this.gracefulShutdown();
    });
  }

  /**
   * 优雅关闭
   */
  async gracefulShutdown(signal = 'UNKNOWN') {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    this.logger.info(`收到关闭信号: ${signal}`);
    this.logger.info('正在优雅关闭服务器...');
    
    try {
      // 停止接受新连接
      if (this.server) {
        await new Promise((resolve, reject) => {
          this.server.close((err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        });
      }
      
      // 清理资源
      await this.cleanup();
      
      this.logger.info('服务器已优雅关闭');
      process.exit(0);
      
    } catch (error) {
      this.logger.error('优雅关闭失败:', error);
      process.exit(1);
    }
  }

  /**
   * 清理资源
   */
  async cleanup() {
    try {
      // 清理定时器
      if (this.cleanupTimer) {
        clearInterval(this.cleanupTimer);
      }
      
      // 清理缓存
      if (this.apiRoutes) {
        this.apiRoutes.cleanExpiredCache();
      }
      
      this.logger.info('资源清理完成');
      
    } catch (error) {
      this.logger.error('资源清理失败:', error);
    }
  }

  /**
   * 启动定期清理任务
   */
  startCleanupTasks() {
    // 每小时清理一次过期缓存
    this.cleanupTimer = setInterval(() => {
      if (this.apiRoutes) {
        const cleaned = this.apiRoutes.cleanExpiredCache();
        if (cleaned > 0) {
          this.logger.info(`定期清理: 清除了${cleaned}个过期缓存`);
        }
      }
    }, 60 * 60 * 1000); // 1小时
    
    this.logger.info('定期清理任务已启动');
  }

  /**
   * 获取应用程序状态
   */
  getStatus() {
    if (!this.configManager || !this.logger || !this.apiRoutes) {
      return {
        status: 'initializing',
        message: '应用程序正在初始化'
      };
    }
    
    const configSummary = this.configManager.getConfigSummary();
    const cacheStats = this.apiRoutes.getCacheStats();
    const middlewareStats = this.middlewareManager.getMiddlewareStats();
    
    return {
      status: 'running',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      config: configSummary,
      cache: cacheStats,
      middleware: middlewareStats,
      environment: this.configManager.getEnvironment(),
      version: process.env.npm_package_version || 'unknown',
      node_version: process.version
    };
  }

  /**
   * 重新加载配置
   */
  async reloadConfig() {
    try {
      this.logger.info('正在重新加载配置...');
      
      const oldConfig = this.configManager.getConfigSummary();
      this.configManager.reload();
      const newConfig = this.configManager.getConfigSummary();
      
      // 检查是否需要重启服务器（端口变化）
      if (oldConfig.port !== newConfig.port) {
        this.logger.warn('端口配置已更改，需要重启服务器');
        return { success: false, message: '端口配置更改需要重启服务器', restart_required: true };
      }
      
      this.logger.success('配置重新加载完成');
      return { success: true, message: '配置重新加载成功', config: newConfig };
      
    } catch (error) {
      this.logger.error('重新加载配置失败:', error);
      return { success: false, message: '配置重新加载失败', error: error.message };
    }
  }

  /**
   * 获取Express应用实例
   */
  getApp() {
    return this.app;
  }

  /**
   * 获取服务器实例
   */
  getServer() {
    return this.server;
  }

  /**
   * 获取配置管理器
   */
  getConfigManager() {
    return this.configManager;
  }

  /**
   * 获取日志器
   */
  getLogger() {
    return this.logger;
  }
}

module.exports = FireChatApp;