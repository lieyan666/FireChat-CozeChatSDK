/**
 * 日志模块
 * 统一管理应用的日志输出，包括彩色日志、请求日志、错误日志等
 */

const fs = require('fs');
const path = require('path');

class Logger {
  constructor(config = {}) {
    this.config = {
      level: config.level || 'info',
      enableRequestLogging: config.enable_request_logging !== false,
      enableColors: config.enable_colors !== false,
      enableFileLogging: config.enable_file_logging || false,
      logDir: config.log_dir || 'logs',
      logFilePrefix: config.log_file_prefix || 'log',
      maxLogSize: config.max_log_size || 10 * 1024 * 1024, // 默认10MB
      maxLogFiles: config.max_log_files || 100, // 默认保留100个日志文件
      ...config
    };
    
    // 日志级别映射
    this.levels = {
      error: 0,
      warn: 1,
      info: 2,
      debug: 3
    };
    
    // 生成服务启动时间戳（格式：YYYYMMDD_HHMMSS）
    const now = new Date();
    this.startupTimestamp = now.getFullYear().toString() +
      (now.getMonth() + 1).toString().padStart(2, '0') +
      now.getDate().toString().padStart(2, '0') + '_' +
      now.getHours().toString().padStart(2, '0') +
      now.getMinutes().toString().padStart(2, '0') +
      now.getSeconds().toString().padStart(2, '0');
    
    // 当前分片ID
    this.currentShardId = 1;
    
    // 初始化日志目录
    if (this.config.enableFileLogging) {
      this.initLogDirectory();
    }
  }
  
  /**
   * 初始化日志目录
   */
  initLogDirectory() {
    try {
      // 确保日志目录存在
      if (!fs.existsSync(this.config.logDir)) {
        fs.mkdirSync(this.config.logDir, { recursive: true });
      }
      
      // 生成当前日志文件名：log_YYYYMMDD_HHMMSS_分片ID
      this.updateLogFilePath();
      
      // 检查是否需要轮转日志
      this.checkLogRotation();
    } catch (error) {
      console.error(`初始化日志目录失败: ${error.message}`);
      this.config.enableFileLogging = false; // 禁用文件日志
    }
  }
  
  /**
   * 更新日志文件路径
   */
  updateLogFilePath() {
    const fileName = `${this.config.logFilePrefix}_${this.startupTimestamp}_${this.currentShardId}.log`;
    this.logFilePath = path.join(this.config.logDir, fileName);
  }
  
  /**
   * 检查是否需要轮转日志
   */
  checkLogRotation() {
    try {
      // 如果日志文件存在且超过最大大小，进行轮转
      if (fs.existsSync(this.logFilePath)) {
        const stats = fs.statSync(this.logFilePath);
        if (stats.size >= this.config.maxLogSize) {
          this.rotateLogFiles();
        }
      }
    } catch (error) {
      console.error(`检查日志轮转失败: ${error.message}`);
    }
  }
  
  /**
   * 轮转日志文件
   */
  rotateLogFiles() {
    try {
      // 增加分片ID并创建新的日志文件
      this.currentShardId++;
      this.updateLogFilePath();
      
      // 清理旧的日志文件（如果超过最大数量）
      this.cleanupOldLogFiles();
    } catch (error) {
      console.error(`轮转日志文件失败: ${error.message}`);
    }
  }
  
  /**
   * 清理旧的日志文件
   */
  cleanupOldLogFiles() {
    try {
      // 获取所有日志文件
      const files = fs.readdirSync(this.config.logDir)
        .filter(file => file.startsWith(this.config.logFilePrefix) && file.endsWith('.log'))
        .map(file => {
          const filePath = path.join(this.config.logDir, file);
          const stats = fs.statSync(filePath);
          return {
            name: file,
            path: filePath,
            mtime: stats.mtime
          };
        })
        .sort((a, b) => b.mtime - a.mtime); // 按修改时间降序排列
      
      // 如果文件数量超过最大限制，删除最旧的文件
      if (files.length > this.config.maxLogFiles) {
        const filesToDelete = files.slice(this.config.maxLogFiles);
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path);
            console.log(`已删除旧日志文件: ${file.name}`);
          } catch (error) {
            console.error(`删除日志文件失败 ${file.name}: ${error.message}`);
          }
        });
      }
    } catch (error) {
      console.error(`清理旧日志文件失败: ${error.message}`);
    }
  }
  
  /**
   * 写入日志到文件
   */
  writeToFile(message) {
    if (!this.config.enableFileLogging) return;
    
    try {
      // 检查是否需要轮转日志
      this.checkLogRotation();
      
      // 添加时间戳和换行符
      const timestamp = new Date().toISOString();
      const logEntry = `[${timestamp}] ${message}\n`;
      
      // 追加写入日志文件
      fs.appendFileSync(this.logFilePath, logEntry);
    } catch (error) {
      console.error(`写入日志文件失败: ${error.message}`);
      // 如果写入失败，尝试轮转日志后重试一次
      try {
        this.rotateLogFiles();
        fs.appendFileSync(this.logFilePath, logEntry);
      } catch (retryError) {
        console.error(`重试写入日志文件失败: ${retryError.message}`);
      }
    }
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
    const aliRealClientIP = req.headers['ali-real-client-ip']; // 阿里云ESA
    const forwarded = req.headers['x-forwarded-for'];
    const realIP = req.headers['x-real-ip'];
    const cfConnectingIP = req.headers['cf-connecting-ip']; // Cloudflare
    const trueClientIP = req.headers['true-client-ip']; // Akamai
    
    // 优先级：Ali-Real-Client-IP > CF-Connecting-IP > True-Client-IP > X-Real-IP > X-Forwarded-For > connection.remoteAddress
    if (aliRealClientIP) {
      return aliRealClientIP;
    }
    
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
    
    // 控制台输出
    const consoleMessage = `${timestamp} ${message}`;
    console.log(consoleMessage, ...args);
    
    // 文件日志输出（去除颜色代码）
    if (this.config.enableFileLogging) {
      // 将参数转换为字符串并去除ANSI颜色代码
      const argsStr = args.length > 0 ? 
        ' ' + args.map(arg => 
          typeof arg === 'object' ? JSON.stringify(arg) : String(arg)
        ).join(' ') : 
        '';
      
      // 去除ANSI颜色代码的完整消息
      const plainMessage = `${this.formatTime()} ${message.replace(/\x1b\[[0-9;]*m/g, '')}${argsStr}`;
      this.writeToFile(plainMessage);
    }
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
    
    let consoleMessage, fileMessage;
    
    if (statusCode !== null) {
      // 响应日志
      const statusColor = this.getStatusColor(statusCode);
      const durationText = duration !== null ? ` ${duration}ms` : '';
      const durationColor = this.config.enableColors ? '\x1b[90m' : '';
      
      consoleMessage = `${timestamp} ${ipColor}${ip}${resetColor} ${deviceColor}${deviceType}${resetColor} ${statusColor}${statusCode}${resetColor}${durationColor}${durationText}${resetColor}`;
      fileMessage = `${this.formatTime()} ${ip} ${deviceType} ${statusCode}${durationText}`;
    } else {
      // 请求日志
      consoleMessage = `${timestamp} ${ipColor}${ip}${resetColor} ${deviceColor}${deviceType}${resetColor} ${methodColor}${method}${resetColor} ${urlColor}${url}${resetColor}`;
      fileMessage = `${this.formatTime()} ${ip} ${deviceType} ${method} ${url}`;
    }
    
    // 控制台输出
    console.log(consoleMessage);
    
    // 文件输出
    if (this.config.enableFileLogging) {
      this.writeToFile(fileMessage);
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
    
    // 控制台输出
    const consoleMessage = `${timestamp} ${ipColor}${ip}${resetColor} ${deviceColor}${deviceType}${resetColor} ${actionColor}${action}${resetColor} ${detailsColor}${details}${resetColor}`;
    console.log(consoleMessage);
    
    // 文件输出
    if (this.config.enableFileLogging) {
      const fileMessage = `${this.formatTime()} ${ip} ${deviceType} ${action} ${details}`;
      this.writeToFile(fileMessage);
    }
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