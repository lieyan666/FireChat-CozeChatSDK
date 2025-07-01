/**
 * 配置管理模块
 * 统一管理应用配置，包括服务器配置、环境配置等
 */

const fs = require('fs');
const path = require('path');

class ConfigManager {
  constructor(configDir = 'config') {
    this.configDir = path.resolve(configDir);
    this.serverConfig = null;
    this.cozeConfig = null;
    this.loadConfigs();
  }

  /**
   * 加载所有配置文件
   */
  loadConfigs() {
    this.serverConfig = this.loadServerConfig();
    // coze配置由JWTUtils管理，这里不重复加载
  }

  /**
   * 加载服务器配置文件
   */
  loadServerConfig() {
    const configPath = path.join(this.configDir, 'server.json');
    
    // 默认配置
    const defaultConfig = {
      environment: 'development',
      port: 3000,
      cors: {
        allowed_origins: [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:8080',
          'http://127.0.0.1:8080'
        ],
        credentials: true
      },
      cache: {
        token_ttl_minutes: 55,
        max_cache_size: 1000
      },
      logging: {
        level: 'info',
        enable_request_logging: true,
        enable_colors: true
      }
    };
    
    if (!fs.existsSync(configPath)) {
      console.warn('⚠️ 服务器配置文件不存在，使用默认配置');
      return this.processEnvironmentConfig(defaultConfig);
    }
    
    let config;
    try {
      config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (error) {
      console.error('❌ 服务器配置文件解析失败:', error.message);
      process.exit(1);
    }
    
    // 合并默认配置
    const mergedConfig = this.mergeConfig(defaultConfig, config);
    
    return this.processEnvironmentConfig(mergedConfig);
  }

  /**
   * 处理环境配置
   */
  processEnvironmentConfig(config) {
    // 获取环境变量，优先级：环境变量 > 配置文件 > 默认值
    const environment = process.env.NODE_ENV || config.environment || 'development';
    
    // 如果是生产环境且配置文件中有生产环境配置，则合并配置
    if (environment === 'production' && config.production) {
      config = {
        ...config,
        ...config.production,
        environment: 'production'
      };
    }
    
    // 设置环境变量
    process.env.NODE_ENV = environment;
    
    return config;
  }

  /**
   * 深度合并配置对象
   */
  mergeConfig(defaultConfig, userConfig) {
    const result = { ...defaultConfig };
    
    for (const key in userConfig) {
      if (userConfig.hasOwnProperty(key)) {
        if (typeof userConfig[key] === 'object' && userConfig[key] !== null && !Array.isArray(userConfig[key])) {
          result[key] = this.mergeConfig(defaultConfig[key] || {}, userConfig[key]);
        } else {
          result[key] = userConfig[key];
        }
      }
    }
    
    return result;
  }

  /**
   * 获取服务器配置
   */
  getServerConfig() {
    return this.serverConfig;
  }

  /**
   * 获取端口
   */
  getPort() {
    return this.serverConfig.port || 3000;
  }

  /**
   * 获取环境
   */
  getEnvironment() {
    return this.serverConfig.environment || process.env.NODE_ENV || 'development';
  }

  /**
   * 是否为生产环境
   */
  isProduction() {
    return this.getEnvironment() === 'production';
  }

  /**
   * 是否为开发环境
   */
  isDevelopment() {
    return this.getEnvironment() === 'development';
  }

  /**
   * 获取CORS配置
   */
  getCorsConfig() {
    return this.serverConfig.cors || {
      allowed_origins: ['http://localhost:3000'],
      credentials: true
    };
  }

  /**
   * 获取缓存配置
   */
  getCacheConfig() {
    return this.serverConfig.cache || {
      token_ttl_minutes: 55,
      max_cache_size: 1000
    };
  }

  /**
   * 获取日志配置
   */
  getLoggingConfig() {
    return this.serverConfig.logging || {
      level: 'info',
      enable_request_logging: true,
      enable_colors: true
    };
  }

  /**
   * 获取允许的CORS源
   */
  getAllowedOrigins() {
    const corsConfig = this.getCorsConfig();
    return corsConfig.allowed_origins || ['http://localhost:3000'];
  }

  /**
   * 检查配置文件是否存在
   */
  checkConfigFiles() {
    const serverConfigPath = path.join(this.configDir, 'server.json');
    const cozeConfigPath = path.join(this.configDir, 'coze.json');
    
    const result = {
      server: fs.existsSync(serverConfigPath),
      coze: fs.existsSync(cozeConfigPath)
    };
    
    return result;
  }

  /**
   * 验证配置
   */
  validateConfig() {
    const errors = [];
    
    // 检查端口
    const port = this.getPort();
    if (!port || port < 1 || port > 65535) {
      errors.push('端口配置无效');
    }
    
    // 检查CORS配置
    const corsConfig = this.getCorsConfig();
    if (!corsConfig.allowed_origins || !Array.isArray(corsConfig.allowed_origins)) {
      errors.push('CORS allowed_origins 配置无效');
    }
    
    // 检查缓存配置
    const cacheConfig = this.getCacheConfig();
    if (!cacheConfig.token_ttl_minutes || cacheConfig.token_ttl_minutes < 1) {
      errors.push('缓存TTL配置无效');
    }
    
    if (!cacheConfig.max_cache_size || cacheConfig.max_cache_size < 1) {
      errors.push('缓存大小配置无效');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * 重新加载配置
   */
  reload() {
    this.loadConfigs();
    return this.serverConfig;
  }

  /**
   * 获取配置摘要（用于状态显示）
   */
  getConfigSummary() {
    const configFiles = this.checkConfigFiles();
    const validation = this.validateConfig();
    
    return {
      environment: this.getEnvironment(),
      port: this.getPort(),
      cors_origins_count: this.getAllowedOrigins().length,
      cache_ttl: this.getCacheConfig().token_ttl_minutes,
      cache_size: this.getCacheConfig().max_cache_size,
      logging_level: this.getLoggingConfig().level,
      config_files: configFiles,
      validation: validation
    };
  }
}

module.exports = ConfigManager;