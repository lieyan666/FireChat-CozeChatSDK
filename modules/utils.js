/**
 * 工具函数模块
 * 包含各种通用的工具函数
 */

class Utils {
  /**
   * 生成唯一ID
   */
  static generateId(prefix = 'id') {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
  }

  /**
   * 延迟执行
   */
  static delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 深度克隆对象
   */
  static deepClone(obj) {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime());
    }
    
    if (obj instanceof Array) {
      return obj.map(item => this.deepClone(item));
    }
    
    if (typeof obj === 'object') {
      const cloned = {};
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          cloned[key] = this.deepClone(obj[key]);
        }
      }
      return cloned;
    }
    
    return obj;
  }

  /**
   * 格式化文件大小
   */
  static formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * 格式化内存使用情况
   */
  static formatMemoryUsage(memoryUsage) {
    const formatted = {};
    for (const [key, value] of Object.entries(memoryUsage)) {
      formatted[key] = this.formatFileSize(value);
    }
    return formatted;
  }

  /**
   * 格式化运行时间
   */
  static formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (minutes > 0) parts.push(`${minutes}分钟`);
    if (secs > 0 || parts.length === 0) parts.push(`${secs}秒`);
    
    return parts.join(' ');
  }

  /**
   * 验证邮箱格式
   */
  static isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * 验证URL格式
   */
  static isValidUrl(url) {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 验证IP地址格式
   */
  static isValidIP(ip) {
    const ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
    const ipv6Regex = /^(?:[0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/;
    return ipv4Regex.test(ip) || ipv6Regex.test(ip);
  }

  /**
   * 清理敏感信息（用于日志）
   */
  static sanitizeForLog(obj, sensitiveKeys = ['password', 'token', 'secret', 'key', 'private']) {
    if (typeof obj !== 'object' || obj === null) {
      return obj;
    }
    
    const sanitized = this.deepClone(obj);
    
    function sanitizeRecursive(item) {
      if (typeof item === 'object' && item !== null) {
        for (const key in item) {
          if (item.hasOwnProperty(key)) {
            const lowerKey = key.toLowerCase();
            const isSensitive = sensitiveKeys.some(sensitive => lowerKey.includes(sensitive));
            
            if (isSensitive && typeof item[key] === 'string') {
              item[key] = '***REDACTED***';
            } else if (typeof item[key] === 'object') {
              sanitizeRecursive(item[key]);
            }
          }
        }
      }
    }
    
    sanitizeRecursive(sanitized);
    return sanitized;
  }

  /**
   * 截断字符串
   */
  static truncateString(str, maxLength = 100, suffix = '...') {
    if (typeof str !== 'string') {
      return str;
    }
    
    if (str.length <= maxLength) {
      return str;
    }
    
    return str.substring(0, maxLength - suffix.length) + suffix;
  }

  /**
   * 解析User-Agent字符串（简化版）
   */
  static parseUserAgent(userAgent) {
    if (!userAgent) {
      return {
        browser: 'unknown',
        version: 'unknown',
        os: 'unknown',
        device: 'unknown'
      };
    }
    
    const ua = userAgent.toLowerCase();
    
    // 检测浏览器
    let browser = 'unknown';
    let version = 'unknown';
    
    if (ua.includes('chrome') && !ua.includes('edg')) {
      browser = 'Chrome';
      const match = ua.match(/chrome\/(\d+)/);
      version = match ? match[1] : 'unknown';
    } else if (ua.includes('firefox')) {
      browser = 'Firefox';
      const match = ua.match(/firefox\/(\d+)/);
      version = match ? match[1] : 'unknown';
    } else if (ua.includes('safari') && !ua.includes('chrome')) {
      browser = 'Safari';
      const match = ua.match(/version\/(\d+)/);
      version = match ? match[1] : 'unknown';
    } else if (ua.includes('edg')) {
      browser = 'Edge';
      const match = ua.match(/edg\/(\d+)/);
      version = match ? match[1] : 'unknown';
    }
    
    // 检测操作系统
    let os = 'unknown';
    if (ua.includes('windows')) {
      os = 'Windows';
    } else if (ua.includes('macintosh') || ua.includes('mac os x')) {
      os = 'macOS';
    } else if (ua.includes('linux')) {
      os = 'Linux';
    } else if (ua.includes('android')) {
      os = 'Android';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
    }
    
    // 检测设备类型
    let device = 'desktop';
    if (ua.includes('mobile') || ua.includes('android') || ua.includes('iphone')) {
      device = 'mobile';
    } else if (ua.includes('tablet') || ua.includes('ipad')) {
      device = 'tablet';
    }
    
    return {
      browser,
      version,
      os,
      device,
      raw: userAgent
    };
  }

  /**
   * 生成随机字符串
   */
  static generateRandomString(length = 16, charset = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789') {
    let result = '';
    for (let i = 0; i < length; i++) {
      result += charset.charAt(Math.floor(Math.random() * charset.length));
    }
    return result;
  }

  /**
   * 计算字符串哈希值（简单版）
   */
  static simpleHash(str) {
    let hash = 0;
    if (str.length === 0) return hash;
    
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 转换为32位整数
    }
    
    return Math.abs(hash).toString(36);
  }

  /**
   * 检查对象是否为空
   */
  static isEmpty(obj) {
    if (obj == null) return true;
    if (Array.isArray(obj) || typeof obj === 'string') return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
  }

  /**
   * 安全的JSON解析
   */
  static safeJsonParse(str, defaultValue = null) {
    try {
      return JSON.parse(str);
    } catch (error) {
      return defaultValue;
    }
  }

  /**
   * 安全的JSON字符串化
   */
  static safeJsonStringify(obj, space = null) {
    try {
      return JSON.stringify(obj, null, space);
    } catch (error) {
      return JSON.stringify({ error: 'Failed to stringify object' });
    }
  }

  /**
   * 获取对象的嵌套属性
   */
  static getNestedProperty(obj, path, defaultValue = undefined) {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (current == null || typeof current !== 'object') {
        return defaultValue;
      }
      current = current[key];
    }
    
    return current !== undefined ? current : defaultValue;
  }

  /**
   * 设置对象的嵌套属性
   */
  static setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (current[key] == null || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }
    
    current[keys[keys.length - 1]] = value;
    return obj;
  }

  /**
   * 防抖函数
   */
  static debounce(func, wait, immediate = false) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        timeout = null;
        if (!immediate) func.apply(this, args);
      };
      const callNow = immediate && !timeout;
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
      if (callNow) func.apply(this, args);
    };
  }

  /**
   * 节流函数
   */
  static throttle(func, limit) {
    let inThrottle;
    return function executedFunction(...args) {
      if (!inThrottle) {
        func.apply(this, args);
        inThrottle = true;
        setTimeout(() => inThrottle = false, limit);
      }
    };
  }

  /**
   * 重试函数
   */
  static async retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        
        if (attempt === maxAttempts) {
          throw lastError;
        }
        
        await this.delay(delay * attempt); // 指数退避
      }
    }
  }

  /**
   * 创建超时Promise
   */
  static timeout(promise, ms) {
    return Promise.race([
      promise,
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error(`操作超时 (${ms}ms)`)), ms);
      })
    ]);
  }
}

module.exports = Utils;