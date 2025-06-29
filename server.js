const express = require('express');
const cors = require('cors');
const path = require('path');

const JWTUtils = require('./utils/jwtUtils');
const CozeClient = require('./utils/cozeClient');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件配置
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS配置
const allowedOrigins = ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:8080', 'http://127.0.0.1:8080'];

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
  credentials: true
}));

// 静态文件服务
app.use(express.static(path.join(__dirname, 'public')));

// 初始化工具类
let jwtUtils, cozeClient;

try {
  // 使用官方配置文件
  jwtUtils = new JWTUtils();
  cozeClient = new CozeClient(jwtUtils);
  
  const config = jwtUtils.getConfig();
  console.log('✅ JWT工具和Coze客户端初始化成功');
  console.log(`🔗 Coze API端点: ${config.coze_api_base}`);
  console.log(`📱 应用ID: ${config.client_id}`);
} catch (error) {
  console.error('❌ 初始化失败:', error.message);
  console.error('请确保coze_oauth_nodejs_jwt/coze_oauth_config.json文件存在且配置正确');
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
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'FireChat-CozeSDK'
  });
});

/**
 * 获取访问令牌
 * POST /api/auth/token
 */
app.post('/api/auth/token', async (req, res) => {
  try {
    const { 
      sessionName, 
      deviceId, 
      customConsumer,
      forceRefresh = false 
    } = req.body;

    // 生成缓存key
    const cacheKey = generateCacheKey(sessionName, deviceId);
    
    // 检查缓存中是否有有效的token
    if (!forceRefresh && tokenCache.has(cacheKey)) {
      const cachedToken = tokenCache.get(cacheKey);
      
      // 检查token是否即将过期
      if (!jwtUtils.isTokenExpiringSoon(cachedToken.jwt)) {
        console.log(`🔄 使用缓存的token: ${cacheKey}`);
        return res.json({
          success: true,
          data: cachedToken,
          cached: true
        });
      } else {
        console.log(`⏰ 缓存的token即将过期，重新生成: ${cacheKey}`);
        tokenCache.delete(cacheKey);
      }
    }

    // 构建会话上下文
    const sessionContext = {};
    if (deviceId || customConsumer) {
      sessionContext.device_info = {};
      if (deviceId) sessionContext.device_info.device_id = deviceId;
      if (customConsumer) sessionContext.device_info.custom_consumer = customConsumer;
    }

    // 生成JWT
    const jwtToken = jwtUtils.generateJWT({
      sessionName,
      sessionContext: Object.keys(sessionContext).length > 0 ? sessionContext : undefined
    });

    console.log(`🔑 生成JWT成功: ${cacheKey}`);

    // 获取OAuth访问令牌
    const tokenResult = await cozeClient.getOAuthAccessToken(jwtToken);
    
    if (!tokenResult.success) {
      return res.status(400).json({
        success: false,
        error: {
          message: '获取访问令牌失败',
          details: tokenResult.error
        }
      });
    }

    // 构建响应数据
    const responseData = {
      access_token: tokenResult.data.access_token,
      token_type: tokenResult.data.token_type,
      expires_in: tokenResult.data.expires_in,
      jwt: jwtToken,
      session_name: sessionName,
      generated_at: new Date().toISOString()
    };

    // 缓存token
    tokenCache.set(cacheKey, responseData);
    
    console.log(`✅ 访问令牌生成成功: ${cacheKey}`);

    res.json({
      success: true,
      data: responseData,
      cached: false
    });

  } catch (error) {
    console.error('❌ 生成访问令牌失败:', error.message);
    res.status(500).json({
      success: false,
      error: {
        message: '服务器内部错误',
        details: error.message
      }
    });
  }
});

/**
 * 验证访问令牌
 * POST /api/auth/validate
 */
app.post('/api/auth/validate', async (req, res) => {
  try {
    const { access_token } = req.body;
    
    if (!access_token) {
      return res.status(400).json({
        success: false,
        error: { message: '缺少访问令牌' }
      });
    }

    const isValid = await cozeClient.validateAccessToken(access_token);
    
    res.json({
      success: true,
      data: { valid: isValid }
    });

  } catch (error) {
    console.error('❌ 验证访问令牌失败:', error.message);
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
  try {
    const { botId } = req.params;
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: { message: '缺少授权头' }
      });
    }

    const accessToken = authHeader.substring(7);
    const botInfo = await cozeClient.getBotInfo(accessToken, botId);
    
    if (!botInfo.success) {
      return res.status(400).json({
        success: false,
        error: botInfo.error
      });
    }

    res.json({
      success: true,
      data: botInfo.data
    });

  } catch (error) {
    console.error('❌ 获取Bot信息失败:', error.message);
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
  const { sessionName, deviceId } = req.body;
  
  if (sessionName || deviceId) {
    const cacheKey = generateCacheKey(sessionName, deviceId);
    const deleted = tokenCache.delete(cacheKey);
    
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
  try {
    const connectionTest = await cozeClient.testConnection();
    
    res.json({
      success: true,
      data: {
        service: 'FireChat-CozeSDK',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        coze_connection: connectionTest,
        cache_size: tokenCache.size,
        config: {
          app_id: process.env.COZE_APP_ID ? '已配置' : '未配置',
          private_key: process.env.COZE_PRIVATE_KEY_PATH ? '已配置' : '未配置',
          api_endpoint: process.env.COZE_API_ENDPOINT || 'api.coze.cn'
        }
      }
    });
  } catch (error) {
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
  console.error('❌ 服务器错误:', error);
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
  console.log(`🚀 FireChat-CozeSDK 服务器启动成功`);
  console.log(`📍 服务地址: http://localhost:${PORT}`);
  console.log(`🔧 环境: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 API端点: ${process.env.COZE_API_ENDPOINT || 'api.coze.cn'}`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('🛑 收到SIGTERM信号，正在关闭服务器...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 收到SIGINT信号，正在关闭服务器...');
  process.exit(0);
});