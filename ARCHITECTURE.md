# FireChat-CozeChatSDK 架构文档

## 概述

本项目已完成模块化重构，将原有的单体 `server.js` 文件拆分为多个功能模块，提高了代码的可维护性、可测试性和可扩展性。

## 架构设计

### 模块化架构

```
FireChat-CozeChatSDK/
├── modules/                 # 核心模块目录
│   ├── app.js              # 应用程序主类
│   ├── config.js           # 配置管理模块
│   ├── logger.js           # 日志管理模块
│   ├── middleware.js       # 中间件管理模块
│   ├── routes.js           # API路由模块
│   └── utils.js            # 工具函数模块
├── utils/                   # 工具类目录
│   ├── JWTUtils.js         # JWT工具类
│   └── CozeClient.js       # Coze客户端
├── config/                  # 配置文件目录
│   ├── server.json         # 服务器配置
│   └── coze.json           # Coze API配置
├── public/                  # 静态文件目录
├── server.js               # 应用程序入口文件
└── start.sh                # 启动脚本
```

## 核心模块详解

### 1. 应用程序主类 (`modules/app.js`)

**职责：**
- 整合所有模块
- 管理应用程序生命周期
- 处理优雅关闭
- 提供统一的应用程序接口

**主要功能：**
- 初始化所有模块
- 配置Express应用
- 启动和停止服务器
- 处理进程信号
- 定期清理任务

### 2. 配置管理模块 (`modules/config.js`)

**职责：**
- 统一管理所有配置
- 处理环境变量
- 配置验证
- 支持配置热重载

**主要功能：**
- 加载和合并配置文件
- 环境配置处理
- 配置验证
- 提供配置访问接口

**配置优先级：**
```
环境变量 > 配置文件 > 默认值
```

### 3. 日志管理模块 (`modules/logger.js`)

**职责：**
- 统一日志格式
- 彩色日志输出
- 请求日志中间件
- 设备信息解析

**日志级别：**
- `error`: 错误信息
- `warn`: 警告信息
- `info`: 一般信息
- `debug`: 调试信息
- `success`: 成功信息
- `startup`: 启动信息
- `api`: API调用信息
- `request`: 请求信息

### 4. 中间件管理模块 (`modules/middleware.js`)

**职责：**
- 管理所有Express中间件
- CORS配置
- 安全头设置
- 错误处理
- 静态文件服务

**包含的中间件：**
- 请求日志中间件
- CORS中间件
- 安全头中间件
- 静态文件中间件
- 404处理中间件
- 全局错误处理中间件
- 速率限制中间件（可选）
- 请求超时中间件

### 5. API路由模块 (`modules/routes.js`)

**职责：**
- 管理所有API路由
- 令牌缓存管理
- API业务逻辑处理

**API端点：**
- `GET /health` - 健康检查
- `POST /api/auth/token` - 获取访问令牌
- `POST /api/auth/validate` - 验证访问令牌
- `DELETE /api/auth/cache` - 清除令牌缓存
- `GET /api/bot/:botId` - 获取机器人信息
- `GET /api/status` - 获取服务状态
- `POST /api/update` - OTA更新（仅生产环境）

### 6. 工具函数模块 (`modules/utils.js`)

**职责：**
- 提供通用工具函数
- 数据处理和验证
- 字符串和对象操作

**主要功能：**
- ID生成
- 数据格式化
- 验证函数
- 异步工具
- 对象操作

## 设计原则

### 1. 单一职责原则
每个模块只负责一个特定的功能领域，确保代码的清晰性和可维护性。

### 2. 依赖注入
模块之间通过构造函数注入依赖，便于测试和模块替换。

### 3. 配置驱动
所有配置都通过配置文件管理，支持不同环境的配置。

### 4. 错误处理
统一的错误处理机制，确保错误信息的一致性和可追踪性。

### 5. 日志记录
完整的日志记录，包括请求日志、错误日志和业务日志。

## 使用方法

### 启动应用程序

```bash
# 开发环境
./start.sh dev

# 生产环境
./start.sh prod

# 默认模式
./start.sh
```

### 编程方式使用

```javascript
const FireChatApp = require('./modules/app');

// 创建应用程序实例
const app = new FireChatApp();

// 启动应用程序
app.start().then(() => {
  console.log('应用程序启动成功');
}).catch(error => {
  console.error('启动失败:', error);
});

// 获取应用程序状态
const status = app.getStatus();
console.log('应用程序状态:', status);

// 重新加载配置
app.reloadConfig().then(result => {
  console.log('配置重载结果:', result);
});
```

## 配置说明

### 服务器配置 (`config/server.json`)

```json
{
  "environment": "development",
  "port": 3000,
  "cors": {
    "allowed_origins": [
      "http://localhost:3000",
      "http://127.0.0.1:3000"
    ],
    "credentials": true
  },
  "cache": {
    "token_ttl_minutes": 55,
    "max_cache_size": 1000
  },
  "logging": {
    "level": "info",
    "enable_request_logging": true,
    "enable_colors": true
  },
  "production": {
    "port": 8080,
    "cors": {
      "allowed_origins": [
        "https://yourdomain.com"
      ]
    },
    "cache": {
      "token_ttl_minutes": 50,
      "max_cache_size": 5000
    },
    "logging": {
      "level": "warn"
    }
  }
}
```

### 环境变量支持

- `NODE_ENV`: 运行环境（development/production）
- `PORT`: 服务器端口（覆盖配置文件）
- `LOG_LEVEL`: 日志级别（覆盖配置文件）

## 扩展指南

### 添加新的API路由

1. 在 `modules/routes.js` 中添加路由处理方法
2. 在 `setupRoutes()` 方法中注册路由
3. 添加相应的错误处理

### 添加新的中间件

1. 在 `modules/middleware.js` 中创建中间件函数
2. 在 `setupMiddleware()` 方法中注册中间件
3. 确保中间件的执行顺序正确

### 添加新的配置项

1. 在 `config/server.json` 中添加配置项
2. 在 `modules/config.js` 中添加访问方法
3. 更新配置验证逻辑

### 自定义日志格式

1. 修改 `modules/logger.js` 中的日志格式化方法
2. 添加新的日志级别或类型
3. 更新日志配置选项

## 测试

### 单元测试

每个模块都可以独立测试：

```javascript
const ConfigManager = require('./modules/config');
const Logger = require('./modules/logger');

// 测试配置管理器
const config = new ConfigManager('test/fixtures/config');
const serverConfig = config.getServerConfig();

// 测试日志器
const logger = new Logger({ level: 'debug' });
logger.info('测试日志');
```

### 集成测试

```javascript
const FireChatApp = require('./modules/app');

// 创建测试应用程序
const app = new FireChatApp();
await app.initialize();

// 测试API端点
const request = require('supertest');
const response = await request(app.getApp())
  .get('/health')
  .expect(200);
```

## 性能优化

### 缓存策略
- 令牌缓存：减少API调用
- 静态文件缓存：提高响应速度
- 配置缓存：避免重复读取文件

### 内存管理
- 定期清理过期缓存
- 限制缓存大小
- 监控内存使用情况

### 并发处理
- 异步处理所有I/O操作
- 合理设置超时时间
- 实现优雅关闭

## 安全考虑

### 输入验证
- 验证所有用户输入
- 防止注入攻击
- 限制请求大小

### 错误处理
- 不泄露敏感信息
- 统一错误响应格式
- 记录安全事件

### CORS配置
- 严格的源验证
- 适当的凭据处理
- 安全头设置

## 监控和日志

### 应用程序监控
- 健康检查端点
- 性能指标收集
- 错误率监控

### 日志管理
- 结构化日志
- 日志级别控制
- 敏感信息过滤

### 告警机制
- 错误阈值告警
- 性能异常告警
- 服务可用性监控

## 部署建议

### 生产环境
- 使用进程管理器（PM2、systemd）
- 配置反向代理（Nginx、Apache）
- 启用HTTPS
- 设置适当的环境变量

### 容器化部署
- 创建优化的Docker镜像
- 使用多阶段构建
- 配置健康检查
- 设置资源限制

### 高可用部署
- 负载均衡配置
- 多实例部署
- 数据库集群
- 缓存集群

## 故障排除

### 常见问题
1. **配置文件错误**：检查JSON格式和必需字段
2. **端口冲突**：确保端口未被占用
3. **权限问题**：检查文件和目录权限
4. **依赖缺失**：运行 `npm install` 安装依赖

### 调试技巧
1. 启用调试日志：设置 `LOG_LEVEL=debug`
2. 检查应用程序状态：访问 `/api/status`
3. 查看详细错误信息：开发环境会显示完整错误堆栈
4. 监控内存使用：定期检查 `/api/status` 中的内存信息

## 贡献指南

### 代码规范
- 使用一致的代码风格
- 添加适当的注释
- 编写单元测试
- 更新文档

### 提交规范
- 使用清晰的提交信息
- 每个提交只包含一个功能或修复
- 在提交前运行测试
- 更新相关文档

---

## 总结

通过模块化重构，FireChat-CozeChatSDK 现在具有：

- **更好的可维护性**：代码结构清晰，职责分离
- **更高的可测试性**：每个模块可以独立测试
- **更强的可扩展性**：易于添加新功能和模块
- **更好的可配置性**：灵活的配置管理
- **更完善的错误处理**：统一的错误处理机制
- **更详细的日志记录**：完整的日志系统

这种架构为项目的长期发展和维护奠定了坚实的基础。