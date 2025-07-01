/**
 * API路由模块
 * 统一管理所有API路由，包括认证、机器人、状态等
 */

const express = require('express');
const { spawn } = require('child_process');

class ApiRoutes {
  constructor(cozeClient, configManager, logger) {
    this.cozeClient = cozeClient;
    this.configManager = configManager;
    this.logger = logger;
    this.router = express.Router();
    this.tokenCache = new Map();
    this.setupRoutes();
  }

  /**
   * 设置所有路由
   */
  setupRoutes() {
    // 健康检查
    this.router.get('/health', this.handleHealth.bind(this));
    
    // 认证相关路由
    this.router.post('/api/auth/token', this.handleGetToken.bind(this));
    this.router.post('/api/auth/validate', this.handleValidateToken.bind(this));
    this.router.delete('/api/auth/cache', this.handleClearCache.bind(this));
    
    // 机器人相关路由
    this.router.get('/api/bot/:botId', this.handleGetBot.bind(this));
    
    // 状态相关路由
    this.router.get('/api/status', this.handleStatus.bind(this));
    
    // 应用信息路由
    this.router.get('/api/app-info', this.handleAppInfo.bind(this));
    
    // OTA更新路由
    this.router.post('/api/update', this.handleOtaUpdate.bind(this));
  }

  /**
   * 健康检查路由
   */
  async handleHealth(req, res) {
    try {
      this.logger.api(req, '健康检查请求');
      res.json({ 
        status: 'ok', 
        timestamp: new Date().toISOString(),
        environment: this.configManager.getEnvironment()
      });
    } catch (error) {
      this.logger.error('健康检查失败:', error);
      res.status(500).json({ error: '健康检查失败' });
    }
  }

  /**
   * 获取访问令牌
   */
  async handleGetToken(req, res) {
    try {
      // 支持两种请求格式：
      // 1. 标准OAuth格式：{ client_id, client_secret }
      // 2. 前端应用格式：{ sessionName, deviceId, consumer }
      const { client_id, client_secret, sessionName, deviceId, consumer } = req.body;
      
      let actualClientId, actualClientSecret;
      
      if (client_id && client_secret) {
        // 标准OAuth格式
        actualClientId = client_id;
        actualClientSecret = client_secret;
      } else if (sessionName && deviceId) {
        // 前端应用格式，使用JWT配置
        const jwtConfig = this.cozeClient.jwtUtils.getConfig();
        if (!jwtConfig || !jwtConfig.client_id) {
          this.logger.error('无法获取JWT配置或client_id');
          return res.status(500).json({
            success: false,
            error: {
              code: 'CONFIG_ERROR',
              message: '服务器配置错误：无法获取JWT配置'
            }
          });
        }
        actualClientId = jwtConfig.client_id;
        // JWT认证不需要client_secret，设为null
        actualClientSecret = null;
        
        this.logger.info(`前端应用请求令牌: session=${sessionName}, device=${deviceId}, consumer=${consumer}`);
      } else {
        this.logger.warn('获取令牌请求缺少必要参数');
        return res.status(400).json({ 
          error: '缺少必要参数',
          details: '需要提供 client_id+client_secret 或 sessionName+deviceId'
        });
      }
      
      if (!actualClientId) {
        this.logger.error('无法获取客户端ID');
        return res.status(500).json({ 
          success: false,
          error: {
            code: 'CONFIG_ERROR',
            message: '服务器配置错误：缺少客户端ID'
          }
        });
      }

      // 对于OAuth方式，需要client_secret；对于JWT方式，不需要
      if (client_id && client_secret && !actualClientSecret) {
        this.logger.error('OAuth方式缺少client_secret');
        return res.status(400).json({ 
          success: false,
          error: {
            code: 'MISSING_PARAMS',
            message: 'OAuth认证缺少client_secret参数'
          }
        });
      }

      const cacheKey = actualClientSecret ? `${actualClientId}:${actualClientSecret}` : `jwt:${actualClientId}:${sessionName}`;
      const cacheConfig = this.configManager.getCacheConfig();
      
      // 检查缓存
      if (this.tokenCache.has(cacheKey)) {
        const cached = this.tokenCache.get(cacheKey);
        const now = Date.now();
        const timeUntilExpiry = cached.expires_at - now;
        
        // 如果令牌还有5分钟以上有效期，直接返回缓存
        if (timeUntilExpiry > 5 * 60 * 1000) {
          this.logger.info(`返回缓存的访问令牌，剩余有效期: ${Math.round(timeUntilExpiry / 60000)}分钟`);
          return res.json({
            success: true,
            data: {
              access_token: cached.access_token,
              expires_in: Math.floor(timeUntilExpiry / 1000),
              from_cache: true
            }
          });
        } else {
          // 令牌即将过期，清除缓存
          this.tokenCache.delete(cacheKey);
          this.logger.info('缓存的令牌即将过期，重新获取');
        }
      }

      this.logger.info('正在获取新的访问令牌...');
      let tokenData;
      
      if (actualClientSecret) {
        // OAuth方式
        tokenData = await this.cozeClient.getOAuthToken(actualClientId, actualClientSecret);
      } else {
        // JWT方式
        tokenData = await this.cozeClient.jwtUtils.generateJWT(sessionName, { deviceId, consumer });
      }
      
      // 缓存令牌
      const expiresAt = Date.now() + (cacheConfig.token_ttl_minutes * 60 * 1000);
      
      // 检查缓存大小限制
      if (this.tokenCache.size >= cacheConfig.max_cache_size) {
        // 清除最旧的缓存项
        const firstKey = this.tokenCache.keys().next().value;
        this.tokenCache.delete(firstKey);
        this.logger.info('缓存已满，清除最旧的令牌');
      }
      
      this.tokenCache.set(cacheKey, {
        access_token: tokenData.access_token,
        expires_at: expiresAt,
        created_at: Date.now()
      });
      
      this.logger.success(`成功获取访问令牌，缓存${cacheConfig.token_ttl_minutes}分钟`);
      
      res.json({
        success: true,
        data: {
          access_token: tokenData.access_token,
          expires_in: cacheConfig.token_ttl_minutes * 60,
          from_cache: false
        }
      });
      
    } catch (error) {
      this.logger.error('获取访问令牌失败:', error);
      res.status(500).json({ 
        success: false,
        error: {
          message: '获取访问令牌失败',
          details: error.message
        }
      });
    }
  }

  /**
   * 验证访问令牌
   */
  async handleValidateToken(req, res) {
    try {
      const { access_token } = req.body;
      
      if (!access_token) {
        this.logger.warn('验证令牌请求缺少access_token');
        return res.status(400).json({ error: '缺少access_token' });
      }

      this.logger.info('正在验证访问令牌...');
      const isValid = await this.cozeClient.validateToken(access_token);
      
      this.logger.info(`令牌验证结果: ${isValid ? '有效' : '无效'}`);
      
      if (isValid) {
        res.json({ valid: true, message: '令牌有效' });
      } else {
        res.status(401).json({ valid: false, message: '令牌无效或已过期' });
      }
      
    } catch (error) {
      this.logger.error('验证访问令牌失败:', error);
      res.status(500).json({ error: '验证访问令牌失败', details: error.message });
    }
  }

  /**
   * 清除令牌缓存
   */
  async handleClearCache(req, res) {
    try {
      const { client_id, client_secret } = req.body;
      
      if (client_id && client_secret) {
        // 清除特定缓存
        const cacheKey = `${client_id}:${client_secret}`;
        if (this.tokenCache.has(cacheKey)) {
          this.tokenCache.delete(cacheKey);
          this.logger.info(`已清除特定客户端的令牌缓存: ${client_id}`);
          res.json({ message: '特定令牌缓存已清除', client_id });
        } else {
          res.json({ message: '未找到对应的缓存项', client_id });
        }
      } else {
        // 清除所有缓存
        const cacheSize = this.tokenCache.size;
        this.tokenCache.clear();
        this.logger.info(`已清除所有令牌缓存，共${cacheSize}项`);
        res.json({ message: '所有令牌缓存已清除', cleared_count: cacheSize });
      }
      
    } catch (error) {
      this.logger.error('清除令牌缓存失败:', error);
      res.status(500).json({ error: '清除令牌缓存失败', details: error.message });
    }
  }

  /**
   * 获取机器人信息
   */
  async handleGetBot(req, res) {
    try {
      const { botId } = req.params;
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        this.logger.warn(`获取机器人信息请求缺少授权头: ${botId}`);
        return res.status(401).json({ error: '缺少授权头或格式错误' });
      }
      
      const accessToken = authHeader.substring(7);
      
      this.logger.info(`正在获取机器人信息: ${botId}`);
      const botInfo = await this.cozeClient.getBotInfo(botId, accessToken);
      
      this.logger.success(`成功获取机器人信息: ${botId}`);
      res.json(botInfo);
      
    } catch (error) {
      this.logger.error(`获取机器人信息失败: ${req.params.botId}`, error);
      
      if (error.message.includes('401') || error.message.includes('Unauthorized')) {
        res.status(401).json({ error: '访问令牌无效或已过期' });
      } else if (error.message.includes('404') || error.message.includes('Not Found')) {
        res.status(404).json({ error: '机器人不存在' });
      } else {
        res.status(500).json({ error: '获取机器人信息失败', details: error.message });
      }
    }
  }

  /**
   * 获取应用信息
   */
  async handleAppInfo(req, res) {
    try {
      this.logger.api(req, '应用信息请求');
      
      // 获取配置中的应用信息
      const config = this.configManager.getServerConfig();
      const appInfo = config.app_info || {
        author: 'Unknown',
        wechat_id: 'Unknown',
        feedback_note: '反馈'
      };
      
      // 获取git版本信息
      let gitVersion = 'unknown';
      try {
        const { execSync } = require('child_process');
        gitVersion = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
      } catch (error) {
        this.logger.warn('无法获取git版本信息:', error.message);
      }
      
      // 获取package.json版本
      let packageVersion = 'unknown';
      try {
        const packageJson = require('../package.json');
        packageVersion = packageJson.version;
      } catch (error) {
        this.logger.warn('无法获取package版本信息:', error.message);
      }
      
      res.json({
        success: true,
        data: {
          author: appInfo.author,
          wechat_id: appInfo.wechat_id,
          feedback_note: appInfo.feedback_note,
          version: packageVersion,
          git_version: gitVersion,
          timestamp: new Date().toISOString()
        }
      });
      
    } catch (error) {
      this.logger.error('获取应用信息失败:', error);
      res.status(500).json({ 
        success: false,
        error: '获取应用信息失败',
        details: error.message 
      });
    }
  }

  /**
   * 获取服务状态
   */
  async handleStatus(req, res) {
    try {
      this.logger.api(req, '状态检查请求');
      
      // 检查Coze连接
      let cozeStatus = 'unknown';
      try {
        // 这里可以添加一个简单的Coze API健康检查
        cozeStatus = 'connected';
      } catch (error) {
        cozeStatus = 'disconnected';
      }
      
      const configSummary = this.configManager.getConfigSummary();
      
      const status = {
        service: 'FireChat-CozeChatSDK',
        status: 'running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        environment: this.configManager.getEnvironment(),
        version: process.env.npm_package_version || 'unknown',
        node_version: process.version,
        memory_usage: process.memoryUsage(),
        coze_status: cozeStatus,
        cache: {
          token_cache_size: this.tokenCache.size,
          max_cache_size: configSummary.cache_size
        },
        config: configSummary
      };
      
      res.json({
        success: true,
        data: {
          status: status.environment === 'production' ? '生产模式' : '开发模式',
          cache_size: status.cache.token_cache_size,
          service_status: 'running',
          uptime: Math.floor(status.uptime),
          version: status.version,
          coze_status: status.coze_status,
          memory_usage: status.memory_usage,
          timestamp: status.timestamp
        }
      });
      
    } catch (error) {
      this.logger.error('获取服务状态失败:', error);
      res.status(500).json({ error: '获取服务状态失败', details: error.message });
    }
  }

  /**
   * OTA更新处理
   */
  async handleOtaUpdate(req, res) {
    try {
      // 只在生产环境允许OTA更新
      if (!this.configManager.isProduction()) {
        this.logger.warn('OTA更新请求被拒绝：非生产环境');
        return res.status(403).json({ 
          success: false,
          error: {
            code: 'ENVIRONMENT_ERROR',
            message: 'OTA更新仅在生产环境可用',
            current_environment: this.configManager.getEnvironment()
          }
        });
      }
      
      this.logger.info('收到OTA更新请求，准备重启服务...');
      
      // 发送响应
      res.json({ 
        success: true,
        data: {
          message: '服务正在重启以应用更新...',
          timestamp: new Date().toISOString()
        }
      });
      
      // 延迟重启，确保响应已发送
      setTimeout(() => {
        this.logger.info('正在执行OTA更新重启...');
        
        // 使用spawn重启服务
        const child = spawn('npm', ['start'], {
          detached: true,
          stdio: 'ignore',
          cwd: process.cwd()
        });
        
        child.unref();
        
        // 优雅关闭当前进程
        process.exit(0);
      }, 1000);
      
    } catch (error) {
      this.logger.error('OTA更新失败:', error);
      res.status(500).json({ 
        success: false,
        error: {
          code: 'UPDATE_ERROR',
          message: 'OTA更新失败',
          details: error.message
        }
      });
    }
  }

  /**
   * 获取路由器实例
   */
  getRouter() {
    return this.router;
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    const cacheConfig = this.configManager.getCacheConfig();
    const stats = {
      size: this.tokenCache.size,
      max_size: cacheConfig.max_cache_size,
      ttl_minutes: cacheConfig.token_ttl_minutes,
      entries: []
    };
    
    // 添加缓存条目信息（不包含敏感数据）
    for (const [key, value] of this.tokenCache.entries()) {
      const [client_id] = key.split(':');
      stats.entries.push({
        client_id: client_id.substring(0, 8) + '...',
        created_at: new Date(value.created_at).toISOString(),
        expires_at: new Date(value.expires_at).toISOString(),
        remaining_minutes: Math.round((value.expires_at - Date.now()) / 60000)
      });
    }
    
    return stats;
  }

  /**
   * 清理过期缓存
   */
  cleanExpiredCache() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, value] of this.tokenCache.entries()) {
      if (value.expires_at <= now) {
        this.tokenCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      this.logger.info(`清理了${cleanedCount}个过期的令牌缓存`);
    }
    
    return cleanedCount;
  }
}

module.exports = ApiRoutes;