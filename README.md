# FireChat - Coze聊天SDK演示项目

一个基于Node.js Express框架的前后端演示项目，集成了JWT身份验证和Coze聊天SDK，展示了如何构建一个安全的AI聊天应用。

## ✨ 功能特性

- 🔐 **JWT身份验证** - 安全的用户注册和登录系统
- 🤖 **Coze AI集成** - 集成Coze聊天SDK实现智能对话
- 🎨 **现代化UI** - 响应式设计，支持移动端
- 🛡️ **安全防护** - 速率限制、CORS配置、密码加密
- 📱 **实时聊天** - 流畅的聊天体验
- 🚀 **易于部署** - 简单的配置和部署流程

## 🏗️ 技术栈

### 后端
- **Node.js** - JavaScript运行时
- **Express.js** - Web应用框架
- **JWT** - 身份验证令牌
- **bcryptjs** - 密码加密
- **@coze/api** - Coze官方SDK
- **express-rate-limit** - 速率限制
- **cors** - 跨域资源共享

### 前端
- **原生JavaScript** - 无框架依赖
- **现代CSS** - 渐变、动画、响应式设计
- **Fetch API** - HTTP请求

## 📋 前置要求

- Node.js 16.0 或更高版本
- npm 或 yarn 包管理器
- Coze平台账户和API访问权限

## 🚀 快速开始

### 1. 克隆项目

```bash
git clone <repository-url>
cd FireChat-CozeChatSDK
```

### 2. 安装依赖

```bash
npm install
```

### 3. 配置环境变量

复制环境变量模板文件：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入你的配置：

```env
# JWT配置
JWT_SECRET=your_super_secret_jwt_key_here_replace_with_random_64_char_string
JWT_EXPIRES_IN=24h

# 服务器配置
PORT=3000
NODE_ENV=development

# Coze API配置
COZE_API_TOKEN=your_coze_personal_access_token_here
COZE_BOT_ID=your_coze_bot_id_here
COZE_BASE_URL=https://api.coze.com

# CORS配置
CLIENT_URL=http://localhost:3001

# 速率限制
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 4. 获取Coze API凭证

#### 获取Personal Access Token (PAT)

1. 访问 [Coze开放平台](https://www.coze.com/open/oauth/pats)
2. 登录你的Coze账户
3. 创建新的Personal Access Token
4. 复制生成的token到 `.env` 文件中的 `COZE_API_TOKEN`

#### 获取Bot ID

1. 在Coze平台创建或选择一个Bot
2. 在Bot设置页面找到Bot ID
3. 将Bot ID复制到 `.env` 文件中的 `COZE_BOT_ID`

### 5. 生成JWT密钥

使用Node.js生成一个安全的JWT密钥：

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

将生成的密钥复制到 `.env` 文件中的 `JWT_SECRET`。

### 6. 启动应用

开发模式：
```bash
npm run dev
```

生产模式：
```bash
npm start
```

### 7. 访问应用

打开浏览器访问：http://localhost:3000

## 📖 API文档

### 认证接口

#### 用户注册
```http
POST /api/auth/register
Content-Type: application/json

{
  "username": "demo",
  "email": "demo@example.com",
  "password": "password123"
}
```

#### 用户登录
```http
POST /api/auth/login
Content-Type: application/json

{
  "username": "demo",
  "password": "password123"
}
```

#### 获取用户信息
```http
GET /api/auth/profile
Authorization: Bearer <jwt_token>
```

### 聊天接口

#### 发送消息
```http
POST /api/chat
Content-Type: application/json
Authorization: Bearer <jwt_token>

{
  "message": "你好，请介绍一下自己"
}
```

### 系统接口

#### 健康检查
```http
GET /api/health
```

## 🔧 配置说明

### 环境变量详解

| 变量名 | 描述 | 默认值 | 必需 |
|--------|------|--------|------|
| `JWT_SECRET` | JWT签名密钥 | - | ✅ |
| `JWT_EXPIRES_IN` | JWT过期时间 | 24h | ❌ |
| `PORT` | 服务器端口 | 3000 | ❌ |
| `NODE_ENV` | 运行环境 | development | ❌ |
| `COZE_API_TOKEN` | Coze API令牌 | - | ✅ |
| `COZE_BOT_ID` | Coze机器人ID | - | ✅ |
| `COZE_BASE_URL` | Coze API基础URL | https://api.coze.com | ❌ |
| `CLIENT_URL` | 前端URL（CORS） | http://localhost:3001 | ❌ |
| `RATE_LIMIT_WINDOW_MS` | 速率限制时间窗口 | 900000 | ❌ |
| `RATE_LIMIT_MAX_REQUESTS` | 速率限制最大请求数 | 100 | ❌ |

### 默认用户账户

为了方便测试，系统预置了一个演示账户：

- **用户名**: `demo`
- **邮箱**: `demo@example.com`
- **密码**: `password`

## 🛡️ 安全特性

- **密码加密**: 使用bcrypt进行密码哈希
- **JWT令牌**: 安全的身份验证机制
- **速率限制**: 防止API滥用
- **CORS配置**: 控制跨域访问
- **输入验证**: 防止恶意输入
- **错误处理**: 安全的错误信息返回

## 📁 项目结构

```
FireChat-CozeChatSDK/
├── public/
│   └── index.html          # 前端单页应用
├── server.js               # 主服务器文件
├── package.json            # 项目依赖配置
├── .env.example           # 环境变量模板
├── .gitignore             # Git忽略文件
├── LICENSE                # 开源许可证
└── README.md              # 项目文档
```

## 🚀 部署指南

### 本地部署

1. 确保所有环境变量正确配置
2. 运行 `npm install` 安装依赖
3. 运行 `npm start` 启动服务

### 云平台部署

#### Vercel部署

1. 在Vercel中导入项目
2. 配置环境变量
3. 部署应用

#### Heroku部署

1. 创建Heroku应用
2. 设置环境变量
3. 推送代码到Heroku

## 🔍 故障排除

### 常见问题

#### 1. Coze API调用失败

**问题**: 聊天功能无法正常工作

**解决方案**:
- 检查 `COZE_API_TOKEN` 是否正确
- 确认 `COZE_BOT_ID` 是否有效
- 验证Coze账户是否有API访问权限
- 检查网络连接

#### 2. JWT验证失败

**问题**: 登录后无法访问受保护的路由

**解决方案**:
- 确认 `JWT_SECRET` 已正确设置
- 检查token是否在请求头中正确传递
- 验证token是否已过期

#### 3. CORS错误

**问题**: 前端无法访问后端API

**解决方案**:
- 检查 `CLIENT_URL` 配置
- 确认CORS中间件正确配置
- 验证请求头设置

### 调试模式

启用详细日志：

```bash
NODE_ENV=development npm run dev
```

## 🤝 贡献指南

1. Fork 项目
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 🙏 致谢

- [Coze](https://www.coze.com/) - 提供强大的AI聊天能力
- [Express.js](https://expressjs.com/) - 优秀的Node.js Web框架
- [JWT](https://jwt.io/) - 安全的身份验证标准

## 📞 支持

如果你在使用过程中遇到问题，可以：

1. 查看本文档的故障排除部分
2. 在GitHub上提交Issue
3. 查看Coze官方文档

---

**注意**: 这是一个演示项目，在生产环境中使用前请确保进行充分的安全审查和测试。
