/**
 * 日志模块
 * 统一管理应用的日志输出，包括彩色日志、请求日志、错误日志等
 */

class Logger {
  constructor(config = {}) {
    this.config = {
      level: config.level || 'info',
      enableRequestLogging: config.enable_request_logging !== false,
      enableColors: config.enable_colors !== false,
      ...config
    };
    
    // 日志级别映射
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
  }

  /**
   * 格式化时间
   */
  formatTime() {
    const now = new Date();
    return now.toLocaleTimeString('zh-CN', { hour12: false });
  }

  /**
   * 获取状态码颜色
   */
  getStatusColor(statusCode) {
    if (!this.config.enableColors) return '';
    if (statusCode >= 200 && statusCode < 300) return '\x1b[32m'; // 绿色
    if (statusCode >= 300 && statusCode < 400) return '\x1b[33m'; // 黄色
    if (statusCode >= 400 && statusCode < 500) return '\x1b[31m'; // 红色
    if (statusCode >= 500) return '\x1b[35m'; // 紫色
    return '\x1b[0m'; // 默认
  }

  /**
   * 获取方法颜色
   */
  getMethodColor(method) {
    if (!this.config.enableColors) return '';
    switch (method) {
      case 'GET': return '\x1b[36m'; // 青色
      case 'POST': return '\x1b[33m'; // 黄色
      case 'PUT': return '\x1b[34m'; // 蓝色
      case 'DELETE': return '\x1b[31m'; // 红色
      case 'PATCH': return '\x1b[35m'; // 紫色
      default: return '\x1b[0m'; // 默认
    }
  }

  /**
   * 从User-Agent解析设备类型和浏览器信息
   */
  getDeviceType(userAgent) {
    if (!userAgent) return 'unknown';
    
    const ua = userAgent.toLowerCase();
    let os = 'unknown';
    let browser = 'unknown';
    let version = '';
    
    // 检测操作系统
    if (ua.includes('windows nt')) {
      const winMatch = ua.match(/windows nt ([\d\.]+)/);
      os = winMatch ? `windows${winMatch[1]}` : 'windows';
    } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
      const macMatch = ua.match(/mac os x ([\d_]+)/);
      os = macMatch ? `macOS${macMatch[1].replace(/_/g, '.')}` : 'macOS';
    } else if (ua.includes('iphone')) {
      const iosMatch = ua.match(/os ([\d_]+)/);
      os = iosMatch ? `iOS${iosMatch[1].replace(/_/g, '.')}` : 'iOS';
    } else if (ua.includes('ipad')) {
      const iosMatch = ua.match(/os ([\d_]+)/);
      os = iosMatch ? `iPadOS${iosMatch[1].replace(/_/g, '.')}` : 'iPadOS';
    } else if (ua.includes('android')) {
      const androidMatch = ua.match(/android ([\d\.]+)/);
      os = androidMatch ? `Android${androidMatch[1]}` : 'Android';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    }
    
    // 检测浏览器和版本
    if (ua.includes('chrome/') && !ua.includes('edg/')) {
      const chromeMatch = ua.match(/chrome\/([\d\.]+)/);
      browser = 'Chrome';
      version = chromeMatch ? chromeMatch[1] : '';
    } else if (ua.includes('firefox/')) {
      const firefoxMatch = ua.match(/firefox\/([\d\.]+)/);
      browser = 'Firefox';
      version = firefoxMatch ? firefoxMatch[1] : '';
    } else if (ua.includes('safari/') && !ua.includes('chrome')) {
      const safariMatch = ua.match(/version\/([\d\.]+)/);
      browser = 'Safari';
      version = safariMatch ? safariMatch[1] : '';
    } else if (ua.includes('edg/')) {
      const edgeMatch = ua.match(/edg\/([\d\.]+)/);
      browser = 'Edge';
      version = edgeMatch ? edgeMatch[1] : '';
    } else if (ua.includes('opera/') || ua.includes('opr/')) {
      const operaMatch = ua.match(/(?:opera\/|opr\/)([\d\.]+)/);
      browser = 'Opera';
      version = operaMatch ? operaMatch[1] : '';
    } else if (ua.includes('bot') || ua.includes('crawler') || ua.includes('spider')) {
      return 'Bot';
    }
    
    // 格式化版本号（只保留主要版本号）
    if (version) {
      const majorVersion = version.split('.')[0];
      version = `-${majorVersion}`;
    }
    
    // 返回格式：OS_Browser-Version
    if (os === 'unknown' || browser === 'unknown') {
      return os !== 'unknown' ? os : (browser !== 'unknown' ? browser : 'unknown');
    }
    
    return `${os}_${browser}${version}`;
  }

  /**
   * 获取真实IP地址（处理proxy protocol）
   */
  getRealIP(req) {
    // 安全检查：确保req和req.headers存在
    if (!req || !req.headers) {
      return 'unknown';
    }
    
    // 检查各种可能的代理头
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    const trueClientIP = req.headers['true-client-ip']; // Akamai
    
    // 优先级：CF-Connecting-IP > True-Client-IP > X-Real-IP > X-Forwarded-For > connection.remoteAddress
    if (cfConnectingIP) {
      return cfConnectingIP;
    }
    
    if (trueClientIP) {
      return trueClientIP;
    }
    
    if (realIP) {
      return realIP;
    }
    
    if (forwarded) {
      // X-Forwarded-For 可能包含多个IP，取第一个
      return forwarded.split(',')[0].trim();
    }
    
    // 最后使用连接的远程地址
    return req.connection.remoteAddress || req.socket.remoteAddress || 
           (req.connection.socket ? req.connection.socket.remoteAddress : null) || 'unknown';
  }

  /**
   * 检查是否应该记录日志
   */
  shouldLog(level) {
    const currentLevel = this.levels[this.config.level] || this.levels.info;
    const messageLevel = this.levels[level] || this.levels.info;
    return messageLevel <= currentLevel;
  }

  /**
   * 基础日志方法
   */
  log(level, message, ...args) {
    if (!this.shouldLog(level)) return;
    
    const timestamp = this.config.enableColors ? 
      `\x1b[90m${this.formatTime()}\x1b[0m` : 
      this.formatTime();
    
    console.log(`${timestamp} ${message}`, ...args);
  }

  /**
   * 错误日志
   */
  error(message, ...args) {
    const errorIcon = this.config.enableColors ? '\x1b[31m❌\x1b[0m' : '[ERROR]';
    this.log('error', `${errorIcon} ${message}`, ...args);
  }

  /**
   * 警告日志
   */
  warn(message, ...args) {
    const warnIcon = this.config.enableColors ? '\x1b[33m⚠️\x1b[0m' : '[WARN]';
    this.log('warn', `${warnIcon} ${message}`, ...args);
  }

  /**
   * 信息日志
   */
  info(message, ...args) {
    const infoIcon = this.config.enableColors ? '\x1b[36mℹ️\x1b[0m' : '[INFO]';
    this.log('info', `${infoIcon} ${message}`, ...args);
  }

  /**
   * 调试日志
   */
  debug(message, ...args) {
    const debugIcon = this.config.enableColors ? '\x1b[35m🐛\x1b[0m' : '[DEBUG]';
    this.log('debug', `${debugIcon} ${message}`, ...args);
  }

  /**
   * 成功日志
   */
  success(message, ...args) {
    const successIcon = this.config.enableColors ? '\x1b[32m✅\x1b[0m' : '[SUCCESS]';
    this.log('info', `${successIcon} ${message}`, ...args);
  }

  /**
   * 启动日志
   */
  startup(message, ...args) {
    const startupIcon = this.config.enableColors ? '\x1b[32m🚀\x1b[0m' : '[STARTUP]';
    this.log('info', `${startupIcon} ${message}`, ...args);
  }

  /**
   * 请求日志
   */
  request(req, statusCode = null, duration = null) {
    if (!this.config.enableRequestLogging) return;
    
    const ip = this.getRealIP(req);
    const method = req.method;
    const url = req.originalUrl || req.url;
    const deviceType = this.getDeviceType(req.headers['user-agent']);
    
    const timestamp = this.config.enableColors ? 
      `\x1b[90m${this.formatTime()}\x1b[0m` : 
      this.formatTime();
    
    const ipColor = this.config.enableColors ? '\x1b[94m' : '';
    const deviceColor = this.config.enableColors ? '\x1b[96m' : '';
    const methodColor = this.getMethodColor(method);
    const urlColor = this.config.enableColors ? '\x1b[97m' : '';
    const resetColor = this.config.enableColors ? '\x1b[0m' : '';
    
    if (statusCode !== null) {
      // 响应日志
      const statusColor = this.getStatusColor(statusCode);
      const durationText = duration !== null ? ` ${duration}ms` : '';
      const durationColor = this.config.enableColors ? '\x1b[90m' : '';
      
      console.log(`${timestamp} ${ipColor}${ip}${resetColor} ${deviceColor}${deviceType}${resetColor} ${statusColor}${statusCode}${resetColor}${durationColor}${durationText}${resetColor}`);
    } else {
      // 请求日志
      console.log(`${timestamp} ${ipColor}${ip}${resetColor} ${deviceColor}${deviceType}${resetColor} ${methodColor}${method}${resetColor} ${urlColor}${url}${resetColor}`);
    }
  }

  /**
   * API日志 - 特定的API操作日志
   */
  api(req, action, details = '') {
    const ip = this.getRealIP(req);
    const deviceType = this.getDeviceType(req.headers['user-agent']);
    
    const timestamp = this.config.enableColors ? 
      `\x1b[90m${this.formatTime()}\x1b[0m` : 
      this.formatTime();
    
    const ipColor = this.config.enableColors ? '\x1b[94m' : '';
    const deviceColor = this.config.enableColors ? '\x1b[96m' : '';
    const actionColor = this.config.enableColors ? '\x1b[36m' : '';
    const detailsColor = this.config.enableColors ? '\x1b[90m' : '';
    const resetColor = this.config.enableColors ? '\x1b[0m' : '';
    
    console.log(`${timestamp} ${ipColor}${ip}${resetColor} ${deviceColor}${deviceType}${resetColor} ${actionColor}${action}${resetColor} ${detailsColor}${details}${resetColor}`);
  }

  /**
   * 创建请求日志中间件
   */
  createRequestMiddleware() {
    return (req, res, next) => {
      const startTime = Date.now();
      
      // 记录请求
      this.request(req);
      
      // 监听响应结束事件
      res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // 记录响应
        this.request(req, statusCode, duration);
      });
      
      next();
    };
  }
}

module.exports = Logger;