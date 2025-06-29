# FireChat - Coze Chat SDK 后端服务

基于 Coze OAuth JWT 鉴权的 Chat SDK 后端服务，实现网页智能客服功能。

## 🚀 功能特性

- **官方SDK集成**: 使用 `@coze/api` 官方 SDK 进行 JWT 认证
- **标准配置**: 基于官方示例的配置文件结构
- **访问令牌管理**: 自动生成和管理 OAuth 访问令牌
- **会话隔离**: 支持多用户会话隔离，每个用户独立的对话历史
- **设备管理**: 支持 IoT 设备和自定义消费者标识
- **令牌缓存**: 内存缓存机制，避免频繁请求 API
- **前端集成**: 提供完整的前端示例，快速集成 Chat SDK
- **RESTful API**: 标准的 REST API 接口设计

## 📋 前置要求

1. **Node.js**: 版本 >= 14.0.0
2. **Coze 账号**: 需要在 Coze 平台创建 OAuth 应用
3. **Bot**: 需要创建并发布为 Chat SDK 的智能体

## 🛠️ 安装配置

### 1. 克隆项目

```bash
git clone <repository-url>
cd FireChat-CozeChatSDK
```

### 2. 安装依赖

```bash
npm install
```

### 3. 创建 OAuth 应用

1. 登录 [Coze 平台](https://www.coze.cn)
2. 进入 **授权 > OAuth 应用** 页面
3. 点击 **创建新应用**
4. 配置应用信息：
   - **应用类型**: 普通
   - **客户端类型**: 服务类应用
   - **应用名称**: 自定义名称
   - **描述**: 应用描述
5. 生成公钥和私钥：
   - 点击 **创建 Key**
   - 下载 `private_key.pem` 文件到项目根目录
   - 复制公钥指纹
6. 配置权限并完成授权

### 4. 配置应用

#### Coze OAuth 配置

创建 `config/coze.json` 配置文件：

```json
{
  "client_type": "jwt",
  "client_id": "your_app_id_here",
  "coze_www_base": "https://www.coze.cn",
  "coze_api_base": "https://api.coze.cn",
  "private_key": "-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_CONTENT_HERE\n-----END PRIVATE KEY-----",
  "public_key_id": "your_public_key_fingerprint_here"
}
```

#### 服务器配置

创建 `config/server.json` 配置文件：

```json
{
  "port": 3000,
  "cors": {
    "allowed_origins": [
      "http://localhost:3000",
      "http://127.0.0.1:3000",
      "http://localhost:8080",
      "http://127.0.0.1:8080"
    ],
    "credentials": true
  },
  "cache": {
    "token_ttl_minutes": 55,
    "max_cache_size": 1000
  },
  "logging": {
    "level": "info",
    "enable_request_logging": true
  }
}
```

#### 配置说明

**Coze 配置 (config/coze.json)**:
- `client_type`: 固定为 "jwt"
- `client_id`: 你的 Coze OAuth 应用 ID
- `coze_www_base`: Coze 网站地址
- `coze_api_base`: Coze API 地址
- `private_key`: 你的私钥内容（包含换行符 \n）
- `public_key_id`: 你的公钥指纹

**服务器配置 (config/server.json)**:
- `port`: 服务器端口号
- `cors.allowed_origins`: 允许的跨域源
- `cors.credentials`: 是否允许携带凭证
- `cache.token_ttl_minutes`: 令牌缓存时间（分钟）
- `cache.max_cache_size`: 最大缓存数量
- `logging.level`: 日志级别
- `logging.enable_request_logging`: 是否启用请求日志

### 5. 创建并发布 Bot

1. 在 Coze 平台创建智能体
2. 配置智能体的知识库和能力
3. 在编排页面点击 **发布**
4. 选择 **Chat SDK** 渠道并发布
5. 等待审核通过
6. 复制 Bot ID 到环境变量

## 🚀 启动服务

### 1. 安装依赖

```bash
npm install
```

### 2. 配置应用

确保已正确配置 `config/coze.json` 和 `config/server.json` 文件中的所有必需参数。

### 3. 启动服务

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

或使用便捷脚本：
```bash
./start.sh
```

### 4. 验证服务

访问 http://localhost:3000 查看示例页面，或访问 http://localhost:3000/health 检查服务状态。

## 📚 API 文档

### 1. 获取访问令牌

**POST** `/api/auth/token`

请求体：
```json
{
  "sessionName": "user_123",     // 可选，用于会话隔离
  "deviceId": "device_456",      // 可选，设备ID
  "customConsumer": "app_user",  // 可选，自定义消费者ID
  "forceRefresh": false          // 可选，强制刷新token
}
```

响应：
```json
{
  "success": true,
  "data": {
    "access_token": "oauth_access_token",
    "token_type": "Bearer",
    "expires_in": 3600,
    "jwt": "jwt_token",
    "session_name": "user_123",
    "generated_at": "2024-01-01T00:00:00.000Z"
  },
  "cached": false
}
```

### 2. 验证访问令牌

**POST** `/api/auth/validate`

请求体：
```json
{
  "access_token": "oauth_access_token"
}
```

### 3. 获取 Bot 信息

**GET** `/api/bot/:botId`

请求头：
```
Authorization: Bearer oauth_access_token
```

### 4. 清除缓存

**DELETE** `/api/auth/cache`

请求体（可选）：
```json
{
  "sessionName": "user_123",  // 清除特定会话缓存
  "deviceId": "device_456"    // 清除特定设备缓存
}
```

### 5. 服务状态

**GET** `/api/status`

### 6. 健康检查

**GET** `/health`

## 🌐 前端集成

### 基础集成

```html
<!-- 引入 Coze Chat SDK -->
<script src="https://lf-cdn.coze.cn/obj/unpkg/flow-platform/chat-app-sdk/1.1.0-beta.0/libs/cn/index.js"></script>

<script>
// 1. 获取访问令牌
async function getAccessToken() {
  const response = await fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionName: 'user_123'  // 用户唯一标识
    })
  });
  
  const result = await response.json();
  return result.data.access_token;
}

// 2. 初始化 Chat SDK
async function initChatSDK() {
  const token = await getAccessToken();
  
  const chatClient = new CozeWebSDK.WebChatClient({
    config: {
      type: 'bot',
      botId: 'your_bot_id'
    },
    auth: {
      type: 'token',
      token: token,
      onRefreshToken: getAccessToken  // 自动刷新token
    },
    chatBot: {
      title: '智能助手',
      uploadable: true
    }
  });
}

// 3. 启动
initChatSDK();
</script>
```

### 会话隔离示例

```javascript
// 为不同用户创建独立会话
function createUserSession(userId) {
  return fetch('/api/auth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sessionName: `user_${userId}`,
      deviceId: `web_${Date.now()}`
    })
  });
}
```

## 🔧 高级配置

### JWT 自定义配置

```javascript
// 使用自定义配置文件路径
const jwtUtils = new JWTUtils('/path/to/custom/coze.json');

// 或者在配置文件中自定义设置
// config/coze.json
{
  "client_type": "jwt",
  "client_id": "your_app_id",
  "coze_api_base": "https://api.coze.cn",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
  "public_key_id": "your_fingerprint"
}
```

### 缓存策略

```javascript
// 生产环境建议使用 Redis
const redis = require('redis');
const client = redis.createClient();

// 替换内存缓存
const tokenCache = {
  set: (key, value) => client.setex(key, 3600, JSON.stringify(value)),
  get: async (key) => {
    const value = await client.get(key);
    return value ? JSON.parse(value) : null;
  },
  delete: (key) => client.del(key)
};
```

## 🔒 安全注意事项

1. **配置文件安全**: 确保 `config/coze.json` 文件安全存储，不要提交到版本控制
2. **私钥保护**: 私钥内容应妥善保管，避免泄露
3. **HTTPS**: 生产环境必须使用 HTTPS
4. **CORS**: 正确配置 CORS 允许的域名
5. **令牌过期**: 合理设置 JWT 过期时间
6. **会话隔离**: 使用 sessionName 确保用户数据隔离
7. **配置验证**: 启动时会自动验证配置文件的完整性

## 🐛 故障排除

### 常见问题

1. **JWT 生成失败**
   - 检查私钥文件路径和格式
   - 确认公钥指纹正确
   - 验证应用 ID 配置

2. **OAuth 令牌获取失败**
   - 确认 OAuth 应用已授权
   - 检查 API 端点配置
   - 验证网络连接

3. **Chat SDK 初始化失败**
   - 确认 Bot 已发布为 Chat SDK
   - 检查 Bot ID 正确性
   - 验证访问令牌有效性

4. **会话隔离不生效**
   - 确认 sessionName 参数传递
   - 检查 JWT payload 中的 session_name
   - 验证前端用户标识一致性

### 调试模式

```bash
# 启用详细日志
NODE_ENV=development npm run dev
```

### 日志查看

```bash
# 查看服务器日志
tail -f logs/app.log

# 查看错误日志
tail -f logs/error.log
```

## 📈 性能优化

1. **缓存策略**: 使用 Redis 替代内存缓存
2. **连接池**: 配置数据库连接池
3. **负载均衡**: 使用 Nginx 进行负载均衡
4. **CDN**: 静态资源使用 CDN 加速
5. **监控**: 集成 APM 监控工具

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Coze Platform](https://www.coze.cn) - 提供强大的 AI 能力
- [Express.js](https://expressjs.com) - Web 框架
- [jsonwebtoken](https://github.com/auth0/node-jsonwebtoken) - JWT 实现

## 📞 支持

如有问题或建议，请：

1. 查看 [FAQ](docs/FAQ.md)
2. 提交 [Issue](https://github.com/your-repo/issues)
3. 联系技术支持: support@firechat.com

---

**FireChat Team** ❤️ 用心打造智能客服解决方案
