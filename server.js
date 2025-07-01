const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const JWTUtils = require('./utils/jwtUtils');
const CozeClient = require('./utils/cozeClient');

// 加载配置文件
function loadServerConfig() {
  const configPath = path.join(__dirname, 'config/server.json');
  
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
      enable_request_logging: true
    }
  };
  
  if (!fs.existsSync(configPath)) {
    console.warn('⚠️ 服务器配置文件不存在，使用默认配置');
    return defaultConfig;
  }
  
  let config;
  try {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('❌ 服务器配置文件解析失败:', error.message);
    process.exit(1);
  }
  
  // 获取环境变量，优先级：环境变量 > 配置文件 > 默认值
  const environment = process.env.NODE_ENV || config.environment || defaultConfig.environment;
  
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
  
  return {
    ...defaultConfig,
    ...config
  };
}

const serverConfig = loadServerConfig();
const app = express();
const PORT = serverConfig.port || 3000;

// 获取真实IP地址的函数（处理proxy protocol）
function getRealIP(req) {
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

// 获取状态码颜色
function getStatusColor(statusCode) {
  if (statusCode >= 200 && statusCode < 300) return '\x1b[32m'; // 绿色
  if (statusCode >= 300 && statusCode < 400) return '\x1b[33m'; // 黄色
  if (statusCode >= 400 && statusCode < 500) return '\x1b[31m'; // 红色
  if (statusCode >= 500) return '\x1b[35m'; // 紫色
  return '\x1b[0m'; // 默认
}

// 获取方法颜色
function getMethodColor(method) {
  switch (method) {
    case 'GET': return '\x1b[36m'; // 青色
    case 'POST': return '\x1b[33m'; // 黄色
    case 'PUT': return '\x1b[34m'; // 蓝色
    case 'DELETE': return '\x1b[31m'; // 红色
    case 'PATCH': return '\x1b[35m'; // 紫色
    default: return '\x1b[0m'; // 默认
  }
}

// 格式化时间
function formatTime() {
  const now = new Date();
  return now.toLocaleTimeString('zh-CN', { hour12: false });
}

// 从User-Agent解析设备类型和浏览器信息
function getDeviceType(userAgent) {
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

// 日志中间件
function logRequest(req, res, next) {
  const startTime = Date.now();
  const ip = getRealIP(req);
  const method = req.method;
  const url = req.originalUrl || req.url;
  const deviceType = getDeviceType(req.headers['user-agent']);
  
  // 简化的请求日志，包含设备信息
  const methodColor = getMethodColor(method);
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m ${methodColor}${method}\x1b[0m \x1b[97m${url}\x1b[0m`);
  
  // 监听响应结束事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const statusColor = getStatusColor(statusCode);
    
    // 简化的响应日志，包含设备信息
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m ${statusColor}${statusCode}\x1b[0m \x1b[90m${duration}ms\x1b[0m`);
  });
  
  next();
}

// 中间件配置
app.use(logRequest); // 添加日志中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS配置
const allowedOrigins = serverConfig.cors?.allowed_origins || [
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];

app.use(cors({
  origin: function (origin, callback) {
    // 允许没有origin的请求（如移动应用或Postman）
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('不被CORS策略允许'));
    }
  },
  credentials: serverConfig.cors?.credentials !== false
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 初始化工具类
let jwtUtils, cozeClient;

try {
  // 使用新的配置文件结构
  jwtUtils = new JWTUtils();
  cozeClient = new CozeClient(jwtUtils);
  
  const config = jwtUtils.getConfig();
  console.log('✅ JWT工具和Coze客户端初始化成功');
  console.log(`🔗 Coze API端点: ${config.coze_api_base}`);
  console.log(`📱 应用ID: ${config.client_id}`);
  console.log(`🌐 允许的CORS源: ${allowedOrigins.join(', ')}`);
} catch (error) {
  console.error('❌ 初始化失败:', error.message);
  console.error('请确保config/coze.json文件存在且配置正确');
  process.exit(1);
}

// 内存中的token缓存（生产环境建议使用Redis）
const tokenCache = new Map();

// 生成缓存key
function generateCacheKey(sessionName, deviceId) {
  return `${sessionName || 'default'}_${deviceId || 'web'}`;
}

// API路由

/**
 * 健康检查
 */
app.get('/health', (req, res) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  const deviceType = getDeviceType(req.headers['user-agent']);
  
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[32m💚\x1b[0m \x1b[90mhealth\x1b[0m`);
  
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'Coze OAuth JWT Service'
  });
});

/**
 * 获取访问令牌
 * POST /api/auth/token
 */
app.post('/api/auth/token', async (req, res) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  
  try {
    const { sessionName, sessionContext, deviceId, consumer } = req.body;
    const cacheKey = `${sessionName || 'default'}_${deviceId || 'unknown'}`;
    const deviceType = getDeviceType(req.headers['user-agent']);
    
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[36m🔑\x1b[0m \x1b[97m${sessionName || 'default'}\x1b[0m \x1b[90mdevice:${deviceType} key:${cacheKey}\x1b[0m`);
    
    // 检查缓存
    if (tokenCache.has(cacheKey)) {
      const cachedToken = tokenCache.get(cacheKey);
      
      // 检查token是否即将过期（提前5分钟刷新）
      const now = Math.floor(Date.now() / 1000);
      if (cachedToken.expires_in > now + 300) {
        console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[32m🔄\x1b[0m \x1b[90mcached device:${deviceType} key:${cacheKey}\x1b[0m`);
        return res.json({
          success: true,
          data: cachedToken,
          cached: true,
          cacheKey: cacheKey
        });
      } else {
        console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[33m⏰\x1b[0m \x1b[90mexpired device:${deviceType} key:${cacheKey}\x1b[0m`);
        tokenCache.delete(cacheKey);
      }
    }
    
    // 使用官方SDK获取OAuth访问令牌
    const tokenResult = await cozeClient.getOAuthToken(sessionName, {
      ...sessionContext,
      deviceId,
      consumer,
      timestamp: Date.now()
    });
    
    // 准备返回数据
    const responseData = {
      ...tokenResult,
      sessionName: sessionName,
      deviceId: deviceId
    };
    
    // 缓存token
    tokenCache.set(cacheKey, responseData);
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[32m💾\x1b[0m \x1b[90mstored device:${deviceType} key:${cacheKey}\x1b[0m`);
    
    res.json({
      success: true,
      data: responseData,
      cached: false,
      cacheKey: cacheKey
    });
    
  } catch (error) {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[31m❌\x1b[0m \x1b[91m${error.message}\x1b[0m`);
    res.status(500).json({
      success: false,
      error: {
        message: error.message,
        type: 'token_generation_error'
      }
    });
  }
});

/**
 * 验证访问令牌
 * POST /api/auth/validate
 */
app.post('/api/auth/validate', async (req, res) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  const deviceType = getDeviceType(req.headers['user-agent']);
  
  try {
    const { access_token } = req.body;
    
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[35m🔍\x1b[0m \x1b[90mvalidate\x1b[0m`);
    
    if (!access_token) {
      console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[31m⚠️\x1b[0m \x1b[91mno token\x1b[0m`);
      return res.status(400).json({
        success: false,
        error: {
          message: '缺少访问令牌',
          code: 'missing_token'
        }
      });
    }

    const validationResult = await cozeClient.validateToken(access_token);
    
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m ${validationResult.valid ? '\x1b[32m✅' : '\x1b[31m❌'}\x1b[0m \x1b[90m${validationResult.valid ? 'valid' : 'invalid'}\x1b[0m`);
    
    res.json({
      success: true,
      data: {
        valid: validationResult.valid,
        details: validationResult.valid ? validationResult.data : validationResult.error,
        checked_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[31m❌\x1b[0m \x1b[91m${error.message}\x1b[0m`);
    res.status(500).json({
      success: false,
      error: {
        message: '验证失败',
        details: error.message
      }
    });
  }
});

/**
 * 获取Bot信息
 * GET /api/bot/:botId
 */
app.get('/api/bot/:botId', async (req, res) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  const deviceType = getDeviceType(req.headers['user-agent']);
  
  try {
    const { botId } = req.params;
    const authHeader = req.headers.authorization;
    
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[34m🤖\x1b[0m \x1b[97m${botId}\x1b[0m`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[31m⚠️\x1b[0m \x1b[91mno auth\x1b[0m`);
      return res.status(401).json({
        success: false,
        error: {
          message: '缺少或无效的授权头',
          code: 'missing_authorization'
        }
      });
    }

    const accessToken = authHeader.substring(7); // 移除 "Bearer " 前缀
    
    const botInfo = await cozeClient.getBotInfo(botId, accessToken);
    
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[32m✅\x1b[0m \x1b[90mbot info\x1b[0m`);
    
    res.json({
      success: true,
      data: botInfo
    });

  } catch (error) {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[31m❌\x1b[0m \x1b[91m${error.message}\x1b[0m`);
    res.status(500).json({
      success: false,
      error: {
        message: '获取Bot信息失败',
        details: error.message
      }
    });
  }
});

/**
 * 清除token缓存
 * DELETE /api/auth/cache
 */
app.delete('/api/auth/cache', (req, res) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  const { sessionName, deviceId } = req.body;
  
  const deviceType = getDeviceType(req.headers['user-agent']);
  
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[33m🗑️\x1b[0m \x1b[90m${sessionName || deviceId ? 'specific' : 'all'} device:${deviceType}\x1b[0m`);
  
  if (sessionName || deviceId) {
    const cacheKey = generateCacheKey(sessionName, deviceId);
    const deleted = tokenCache.delete(cacheKey);
    
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m ${deleted ? '\x1b[32m✅' : '\x1b[33m⚠️'}\x1b[0m \x1b[90m${deleted ? 'deleted' : 'not found'} device:${deviceType} key:${cacheKey}\x1b[0m`);
    
    res.json({
      success: true,
      data: { 
        deleted,
        key: cacheKey
      }
    });
  } else {
    // 清除所有缓存
    const size = tokenCache.size;
    tokenCache.clear();
    
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[32m✅\x1b[0m \x1b[90mcleared ${size} caches\x1b[0m`);
    
    res.json({
      success: true,
      data: { 
        cleared: size,
        message: '所有缓存已清除'
      }
    });
  }
});

/**
 * 获取服务状态
 * GET /api/status
 */
app.get('/api/status', async (req, res) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  const deviceType = getDeviceType(req.headers['user-agent']);
  
  try {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[36m📊\x1b[0m \x1b[90mstatus\x1b[0m`);
    
    const connectionTest = await cozeClient.testConnection();
    const config = jwtUtils.getConfig();
    
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m ${connectionTest ? '\x1b[32m✅' : '\x1b[31m❌'}\x1b[0m \x1b[90mconn:${connectionTest ? 'ok' : 'fail'} cache:${tokenCache.size}\x1b[0m`);
    
    res.json({
      success: true,
      data: {
        service: 'Coze OAuth JWT Service',
        status: 'running',
        timestamp: new Date().toISOString(),
        coze_connection: connectionTest,
        cache_size: tokenCache.size,
        config: {
          api_endpoint: config.coze_api_base,
          www_endpoint: config.coze_www_base,
          app_id: config.client_id,
          client_type: config.client_type,
          private_key: config.private_key ? '***configured***' : 'not_set',
          public_key_id: config.public_key_id ? '***configured***' : 'not_set'
        }
      }
    });
  } catch (error) {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[31m❌\x1b[0m \x1b[91m${error.message}\x1b[0m`);
    res.status(500).json({
      success: false,
      error: {
        message: '获取状态失败',
        details: error.message
      }
    });
  }
});

/**
 * OTA更新 (仅在production模式下可用)
 * POST /api/update
 */
app.post('/api/update', (req, res) => {
  const ip = getRealIP(req);
  const deviceType = getDeviceType(req.headers['user-agent']);
  
  // 只在production模式下允许OTA更新
  if (process.env.NODE_ENV !== 'production') {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[33m⚠️\x1b[0m \x1b[91mOTA disabled in dev mode\x1b[0m`);
    return res.status(403).json({
      success: false,
      error: {
        message: 'OTA更新仅在生产模式下可用',
        code: 'ota_disabled_in_dev'
      }
    });
  }
  
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[33m🔄\x1b[0m \x1b[90mOTA update triggered\x1b[0m`);
  
  // 立即返回响应
  res.json({
    success: true,
    data: {
      message: 'OTA更新已启动，服务将在几秒钟后重启',
      timestamp: new Date().toISOString()
    }
  });
  
  // 延迟执行更新，确保响应已发送
   setTimeout(() => {
     console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[33m🔄\x1b[0m \x1b[90mStarting OTA update process...\x1b[0m`);
     
     // 执行更新脚本
     const updateProcess = spawn('bash', ['start.sh'], {
       detached: true,
       stdio: 'inherit'
     });
     
     updateProcess.unref();
     
     // 关闭当前进程
     console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[31m🛑\x1b[0m \x1b[90mOTA shutdown for update\x1b[0m`);
     process.exit(0);
   }, 1000);
});

// 404处理
app.use('*', (req, res) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  const deviceType = getDeviceType(req.headers['user-agent']);
  
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[96m${deviceType}\x1b[0m \x1b[33m❓\x1b[0m \x1b[90m404 ${req.originalUrl}\x1b[0m`);
  
  res.status(404).json({
    success: false,
    error: {
      message: '接口不存在',
      path: req.originalUrl
    }
  });
});

// 错误处理中间件
app.use((error, req, res, next) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[31m💥\x1b[0m \x1b[91m${error.message}\x1b[0m`);
  if (process.env.NODE_ENV === 'development') {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[94m${ip}\x1b[0m \x1b[90mstack:\x1b[0m`, error.stack);
  }
  
  res.status(500).json({
    success: false,
    error: {
      message: '服务器内部错误',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    }
  });
});

// 启动服务器
app.listen(PORT, () => {
  const config = jwtUtils.getConfig();
  const environment = serverConfig.environment || process.env.NODE_ENV || 'development';
  const isProduction = environment === 'production';
  
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[32m🚀\x1b[0m \x1b[97mFireChat-CozeSDK\x1b[0m \x1b[90mstarted\x1b[0m`);
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[36m📍\x1b[0m \x1b[97mhttp://localhost:${PORT}\x1b[0m`);
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[33m🔧\x1b[0m \x1b[90m${environment}${isProduction ? ' (生产环境)' : ' (开发环境)'}\x1b[0m`);
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[34m🌐\x1b[0m \x1b[90m${config.coze_api_base}\x1b[0m`);
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[35m📊\x1b[0m \x1b[90mcolorful logs enabled\x1b[0m`);
  
  if (isProduction) {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[32m✅\x1b[0m \x1b[90mOTA更新功能已启用\x1b[0m`);
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[36m🔗\x1b[0m \x1b[90mOTA管理界面: http://localhost:${PORT}/ota/\x1b[0m`);
  } else {
    console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[33m⚠️\x1b[0m \x1b[90mOTA更新功能仅在生产环境下可用\x1b[0m`);
  }
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[31m🛑\x1b[0m \x1b[90mSIGTERM shutdown\x1b[0m`);
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log(`\x1b[90m${formatTime()}\x1b[0m \x1b[31m🛑\x1b[0m \x1b[90mSIGINT shutdown\x1b[0m`);
  process.exit(0);
});