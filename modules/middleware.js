/**
 * 中间件模块
 * 统一管理所有Express中间件，包括CORS、错误处理、静态文件等
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

class MiddlewareManager {
  constructor(configManager, logger) {
    this.configManager = configManager;
    this.logger = logger;
  }

  /**
   * 配置所有中间件
   */
  setupMiddleware(app) {
    // 请求日志中间件
    app.use(this.createRequestLogger());
    
    // 基础中间件
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // CORS中间件
    app.use(this.createCorsMiddleware());
    
    // 静态文件中间件
    app.use(this.createStaticMiddleware());
    
    // 安全头中间件
    app.use(this.createSecurityHeaders());
    
    return app;
  }

  /**
   * 创建请求日志中间件
   */
  createRequestLogger() {
    return this.logger.createRequestMiddleware();
  }

  /**
   * 创建CORS中间件
   */
  createCorsMiddleware() {
    const corsConfig = this.configManager.getCorsConfig();
    const allowedOrigins = this.configManager.getAllowedOrigins();
    
    const corsOptions = {
      origin: (origin, callback) => {
        // 允许没有origin的请求（如移动应用、Postman等）
        if (!origin) {
          return callback(null, true);
        }
        
        // 检查origin是否在允许列表中
        if (allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          this.logger.warn(`CORS阻止了来自 ${origin} 的请求`);
          callback(new Error('CORS策略不允许此源'), false);
        }
      },
      credentials: corsConfig.credentials || true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Requested-With',
        'Accept',
        'Origin',
        'Cache-Control',
        'X-File-Name'
      ],
      exposedHeaders: [
        'Content-Length',
        'X-Request-ID',
        'X-Response-Time'
      ],
      maxAge: 86400 // 24小时
    };
    
    return cors(corsOptions);
  }

  /**
   * 创建静态文件中间件
   */
  createStaticMiddleware() {
    const staticPath = path.join(process.cwd(), 'public');
    
    return express.static(staticPath, {
      maxAge: this.configManager.isProduction() ? '1d' : '0',
      etag: true,
      lastModified: true,
      setHeaders: (res, path) => {
        // 为不同类型的文件设置不同的缓存策略
        if (path.endsWith('.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (path.match(/\.(js|css|png|jpg|jpeg|gif|ico|svg)$/)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000'); // 1年
        }
      }
    });
  }

  /**
   * 创建安全头中间件
   */
  createSecurityHeaders() {
    return (req, res, next) => {
      // 基本安全头
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');
      
      // 生产环境额外安全头
      if (this.configManager.isProduction()) {
        res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
        res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
      }
      
      // 请求ID（用于追踪）
      const requestId = this.generateRequestId();
      res.setHeader('X-Request-ID', requestId);
      req.requestId = requestId;
      
      next();
    };
  }

  /**
   * 创建错误处理中间件
   */
  createErrorHandlers(app) {
    // 404处理
    app.use(this.create404Handler());
    
    // 全局错误处理
    app.use(this.createGlobalErrorHandler());
    
    return app;
  }

  /**
   * 创建404处理中间件
   */
  create404Handler() {
    return (req, res, next) => {
      const clientIP = this.logger.getRealIP(req);
      const deviceType = this.logger.getDeviceType(req.get('User-Agent') || '');
      const originalUrl = req.originalUrl;
      
      this.logger.warn(`404 - 未找到资源`, {
        ip: clientIP,
        device: deviceType,
        url: originalUrl,
        method: req.method,
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });
      
      res.status(404).json({
        error: '未找到请求的资源',
        path: originalUrl,
        method: req.method,
        timestamp: new Date().toISOString(),
        requestId: req.requestId
      });
    };
  }

  /**
   * 创建全局错误处理中间件
   */
  createGlobalErrorHandler() {
    return (err, req, res, next) => {
      // 记录错误
      this.logger.error('全局错误处理:', {
        error: err.message,
        stack: err.stack,
        url: req.originalUrl,
        method: req.method,
        ip: this.logger.getRealIP(req),
        userAgent: req.get('User-Agent'),
        requestId: req.requestId
      });
      
      // 确定错误状态码
      let statusCode = err.statusCode || err.status || 500;
      
      // CORS错误特殊处理
      if (err.message && err.message.includes('CORS')) {
        statusCode = 403;
      }
      
      // 构建错误响应
      const errorResponse = {
        error: this.getErrorMessage(err, statusCode),
        timestamp: new Date().toISOString(),
        requestId: req.requestId,
        path: req.originalUrl,
        method: req.method
      };
      
      // 开发环境包含详细错误信息
      if (this.configManager.isDevelopment()) {
        errorResponse.details = {
          message: err.message,
          stack: err.stack,
          name: err.name
        };
      }
      
      res.status(statusCode).json(errorResponse);
    };
  }

  /**
   * 获取用户友好的错误消息
   */
  getErrorMessage(err, statusCode) {
    // 根据状态码返回用户友好的错误消息
    switch (statusCode) {
      case 400:
        return '请求参数错误';
      case 401:
        return '未授权访问';
      case 403:
        return '禁止访问';
      case 404:
        return '资源未找到';
      case 429:
        return '请求过于频繁';
      case 500:
        return '服务器内部错误';
      case 502:
        return '网关错误';
      case 503:
        return '服务暂时不可用';
      default:
        return err.message || '未知错误';
    }
  }

  /**
   * 生成请求ID
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * 创建速率限制中间件（可选）
   */
  createRateLimiter() {
    // 简单的内存速率限制器
    const requests = new Map();
    const windowMs = 15 * 60 * 1000; // 15分钟
    const maxRequests = this.configManager.isProduction() ? 100 : 1000; // 生产环境更严格
    
    return (req, res, next) => {
      const clientIP = this.logger.getRealIP(req);
      const now = Date.now();
      const windowStart = now - windowMs;
      
      // 清理过期记录
      if (requests.has(clientIP)) {
        const clientRequests = requests.get(clientIP).filter(time => time > windowStart);
        requests.set(clientIP, clientRequests);
      } else {
        requests.set(clientIP, []);
      }
      
      const clientRequests = requests.get(clientIP);
      
      if (clientRequests.length >= maxRequests) {
        this.logger.warn(`速率限制触发: ${clientIP} (${clientRequests.length}/${maxRequests})`);
        return res.status(429).json({
          error: '请求过于频繁，请稍后再试',
          retryAfter: Math.ceil(windowMs / 1000),
          requestId: req.requestId
        });
      }
      
      // 记录当前请求
      clientRequests.push(now);
      requests.set(clientIP, clientRequests);
      
      // 设置速率限制头
      res.setHeader('X-RateLimit-Limit', maxRequests);
      res.setHeader('X-RateLimit-Remaining', maxRequests - clientRequests.length);
      res.setHeader('X-RateLimit-Reset', new Date(now + windowMs).toISOString());
      
      next();
    };
  }

  /**
   * 创建请求超时中间件
   */
  createTimeoutMiddleware(timeoutMs = 30000) {
    return (req, res, next) => {
      // 设置请求超时
      req.setTimeout(timeoutMs, () => {
        this.logger.warn(`请求超时: ${req.method} ${req.originalUrl}`, {
          timeout: timeoutMs,
          ip: this.logger.getRealIP(req),
          requestId: req.requestId
        });
        
        if (!res.headersSent) {
          res.status(408).json({
            error: '请求超时',
            timeout: timeoutMs,
            requestId: req.requestId
          });
        }
      });
      
      next();
    };
  }

  /**
   * 创建健康检查中间件
   */
  createHealthCheckMiddleware() {
    return (req, res, next) => {
      // 为健康检查请求添加特殊标记
      if (req.path === '/health' || req.path === '/api/status') {
        req.isHealthCheck = true;
      }
      next();
    };
  }

  /**
   * 获取中间件统计信息
   */
  getMiddlewareStats() {
    return {
      cors_origins: this.configManager.getAllowedOrigins().length,
      security_headers_enabled: true,
      static_files_enabled: true,
      error_handling_enabled: true,
      environment: this.configManager.getEnvironment(),
      production_optimizations: this.configManager.isProduction()
    };
  }
}

module.exports = MiddlewareManager;