const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const JWTUtils = require('./utils/jwtUtils');
const CozeClient = require('./utils/cozeClient');

// 加载配置文件
function loadServerConfig() {
  const configPath = path.join(__dirname, 'config/server.json');
  
  if (!fs.existsSync(configPath)) {
    console.warn('⚠️ 服务器配置文件不存在，使用默认配置');
    return {
      port: 3000,
      cors: {
        allowed_origins: [
          'http://localhost:3000',
          'http://127.0.0.1:3000',
          'http://localhost:8080',
          'http://127.0.0.1:8080'
        ],
        credentials: true
      }
    };
  }
  
  try {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  } catch (error) {
    console.error('❌ 服务器配置文件解析失败:', error.message);
    process.exit(1);
  }
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

// 日志中间件
function logRequest(req, res, next) {
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  const ip = getRealIP(req);
  const method = req.method;
  const url = req.originalUrl || req.url;
  const userAgent = req.headers['user-agent'] || 'unknown';
  const referer = req.headers.referer || '-';
  
  // 记录请求开始
  console.log(`[${timestamp}] ${ip} "${method} ${url}" - "${userAgent}" "${referer}"`);
  
  // 监听响应结束事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    const contentLength = res.get('content-length') || '-';
    
    // 记录响应完成
    console.log(`[${timestamp}] ${ip} "${method} ${url}" ${statusCode} ${contentLength} ${duration}ms`);
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
  
  console.log(`[${timestamp}] ${ip} 健康检查请求`);
  
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
    
    console.log(`[${timestamp}] ${ip} 请求获取访问令牌 - sessionName: ${sessionName || 'default'}, deviceId: ${deviceId || 'unknown'}`);
    
    // 构建缓存键
    const cacheKey = `${sessionName || 'default'}_${deviceId || 'unknown'}`;
    
    // 检查缓存
    if (tokenCache.has(cacheKey)) {
      const cachedToken = tokenCache.get(cacheKey);
      
      // 检查token是否即将过期（提前5分钟刷新）
      const now = Math.floor(Date.now() / 1000);
      if (cachedToken.expires_in > now + 300) {
        console.log(`[${timestamp}] ${ip} 🔄 返回缓存的token: ${cacheKey}`);
        return res.json({
          success: true,
          data: cachedToken,
          cached: true,
          cacheKey: cacheKey
        });
      } else {
        console.log(`[${timestamp}] ${ip} ⏰ 缓存的token即将过期，重新生成: ${cacheKey}`);
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
    console.log(`[${timestamp}] ${ip} 💾 Token已缓存: ${cacheKey}`);
    
    res.json({
      success: true,
      data: responseData,
      cached: false,
      cacheKey: cacheKey
    });
    
  } catch (error) {
    console.error(`[${timestamp}] ${ip} ❌ 生成访问令牌失败:`, error.message);
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
  
  try {
    const { access_token } = req.body;
    
    console.log(`[${timestamp}] ${ip} 请求验证访问令牌`);
    
    if (!access_token) {
      console.log(`[${timestamp}] ${ip} ⚠️ 验证令牌失败: 缺少访问令牌`);
      return res.status(400).json({
        success: false,
        error: {
          message: '缺少访问令牌',
          code: 'missing_token'
        }
      });
    }

    const validationResult = await cozeClient.validateToken(access_token);
    
    console.log(`[${timestamp}] ${ip} ✅ 令牌验证${validationResult.valid ? '成功' : '失败'}`);
    
    res.json({
      success: true,
      data: {
        valid: validationResult.valid,
        details: validationResult.valid ? validationResult.data : validationResult.error,
        checked_at: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error(`[${timestamp}] ${ip} ❌ 验证访问令牌失败:`, error.message);
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
  
  try {
    const { botId } = req.params;
    const authHeader = req.headers.authorization;
    
    console.log(`[${timestamp}] ${ip} 请求获取Bot信息 - botId: ${botId}`);
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log(`[${timestamp}] ${ip} ⚠️ 获取Bot信息失败: 缺少或无效的授权头`);
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
    
    console.log(`[${timestamp}] ${ip} ✅ 成功获取Bot信息 - botId: ${botId}`);
    
    res.json({
      success: true,
      data: botInfo
    });

  } catch (error) {
    console.error(`[${timestamp}] ${ip} ❌ 获取Bot信息失败:`, error.message);
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
  
  console.log(`[${timestamp}] ${ip} 请求清除缓存 - sessionName: ${sessionName || 'all'}, deviceId: ${deviceId || 'all'}`);
  
  if (sessionName || deviceId) {
    const cacheKey = generateCacheKey(sessionName, deviceId);
    const deleted = tokenCache.delete(cacheKey);
    
    console.log(`[${timestamp}] ${ip} ${deleted ? '✅' : '⚠️'} 缓存清除${deleted ? '成功' : '失败'} - key: ${cacheKey}`);
    
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
    
    console.log(`[${timestamp}] ${ip} ✅ 清除所有缓存成功 - 共清除 ${size} 个缓存项`);
    
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
  
  try {
    console.log(`[${timestamp}] ${ip} 请求获取服务状态`);
    
    const connectionTest = await cozeClient.testConnection();
    const config = jwtUtils.getConfig();
    
    console.log(`[${timestamp}] ${ip} ✅ 服务状态检查完成 - 连接状态: ${connectionTest ? '正常' : '异常'}, 缓存大小: ${tokenCache.size}`);
    
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
    console.error(`[${timestamp}] ${ip} ❌ 获取服务状态失败:`, error.message);
    res.status(500).json({
      success: false,
      error: {
        message: '获取状态失败',
        details: error.message
      }
    });
  }
});

// 404处理
app.use('*', (req, res) => {
  const ip = getRealIP(req);
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] ${ip} ⚠️ 404 - 接口不存在: ${req.originalUrl}`);
  
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
  
  console.error(`[${timestamp}] ${ip} ❌ 服务器内部错误:`, error.message);
  console.error(`[${timestamp}] ${ip} 错误堆栈:`, error.stack);
  
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
  const timestamp = new Date().toISOString();
  
  console.log(`[${timestamp}] 🚀 FireChat-CozeSDK 服务器启动成功`);
  console.log(`[${timestamp}] 📍 服务地址: http://localhost:${PORT}`);
  console.log(`[${timestamp}] 🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`[${timestamp}] 🌐 Coze API端点: ${config.coze_api_base}`);
  console.log(`[${timestamp}] 📋 配置文件: config/coze.json, config/server.json`);
  console.log(`[${timestamp}] 📊 日志功能: 已启用 (包含IP地址、时间戳、请求详情)`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🛑 收到SIGTERM信号，正在关闭服务器...`);
  process.exit(0);
});

process.on('SIGINT', () => {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] 🛑 收到SIGINT信号，正在关闭服务器...`);
  process.exit(0);
});