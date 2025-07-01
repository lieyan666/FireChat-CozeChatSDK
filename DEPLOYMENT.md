# 生产环境部署指南

本指南将帮助您将 FireChat-CozeChatSDK 部署到生产环境。

## 🚀 快速部署

### 1. 环境配置

#### 方法一：使用启动脚本参数（推荐）
```bash
# 生产模式启动
./start.sh prod

# 或者
./start.sh production
```

#### 方法二：设置环境变量
```bash
# 设置环境变量
export NODE_ENV=production

# 启动服务
./start.sh
```

#### 方法三：修改配置文件
编辑 `config/server.json`，将 `environment` 字段设置为 `production`：
```json
{
  "environment": "production",
  ...
}
```

### 2. 生产环境配置

在 `config/server.json` 中配置生产环境参数：

```json
{
  "environment": "production",
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
    "enable_request_logging": true
  },
  "production": {
    "port": 8080,
    "cors": {
      "allowed_origins": [
        "https://yourdomain.com",
        "https://www.yourdomain.com"
      ],
      "credentials": true
    },
    "cache": {
      "token_ttl_minutes": 120,
      "max_cache_size": 5000
    },
    "logging": {
      "level": "warn",
      "enable_request_logging": false
    }
  }
}
```

### 3. 重要配置项说明

#### 生产环境配置 (`production` 节点)
- **port**: 生产环境端口（建议使用 8080 或其他非特权端口）
- **cors.allowed_origins**: 允许的跨域来源（替换为您的实际域名）
- **cache.token_ttl_minutes**: Token 缓存时间（生产环境建议更长）
- **cache.max_cache_size**: 最大缓存数量（生产环境建议更大）
- **logging.level**: 日志级别（生产环境建议 `warn` 或 `error`）
- **logging.enable_request_logging**: 是否记录请求日志（生产环境建议关闭）

## 🔧 环境差异

| 配置项 | 开发环境 | 生产环境 |
|--------|----------|----------|
| 端口 | 3000 | 8080 |
| CORS 来源 | localhost | 实际域名 |
| 缓存时间 | 55分钟 | 120分钟 |
| 缓存大小 | 1000 | 5000 |
| 日志级别 | info | warn |
| 请求日志 | 启用 | 禁用 |
| OTA更新 | 禁用 | 启用 |

## 🛡️ 安全配置

### 1. CORS 配置
生产环境中，请确保 `cors.allowed_origins` 只包含您的实际域名：

```json
"cors": {
  "allowed_origins": [
    "https://yourdomain.com",
    "https://www.yourdomain.com",
    "https://app.yourdomain.com"
  ],
  "credentials": true
}
```

### 2. 反向代理配置

#### Nginx 配置示例
```nginx
server {
    listen 80;
    server_name yourdomain.com;
    
    location / {
        proxy_pass http://localhost:8080;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

#### Apache 配置示例
```apache
<VirtualHost *:80>
    ServerName yourdomain.com
    
    ProxyPreserveHost On
    ProxyPass / http://localhost:8080/
    ProxyPassReverse / http://localhost:8080/
    
    ProxyPassReverse / http://localhost:8080/
    ProxyPassReverseAdjustHeaders On
</VirtualHost>
```

## 🔄 OTA 更新功能

生产环境下，OTA 更新功能会自动启用：

### 1. API 接口
```bash
# 触发 OTA 更新
curl -X POST http://yourdomain.com/api/update
```

### 2. Web 管理界面
访问：`http://yourdomain.com/ota/`

### 3. 更新流程
1. 调用更新接口
2. 服务器拉取最新代码
3. 安装/更新依赖
4. 重启服务
5. 自动恢复服务

## 📊 监控和日志

### 1. 日志级别
- **development**: `info` - 详细日志
- **production**: `warn` - 仅警告和错误

### 2. 请求日志
- **development**: 启用 - 记录所有请求
- **production**: 禁用 - 减少日志量

### 3. 系统监控
建议使用 PM2 或 systemd 管理进程：

#### PM2 配置
```bash
# 安装 PM2
npm install -g pm2

# 启动应用
NODE_ENV=production pm2 start server.js --name "firechat-coze"

# 保存配置
pm2 save

# 设置开机自启
pm2 startup
```

#### systemd 配置
创建 `/etc/systemd/system/firechat-coze.service`：
```ini
[Unit]
Description=FireChat CozeSDK Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/FireChat-CozeChatSDK
Environment=NODE_ENV=production
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

## 🚨 故障排除

### 1. 端口冲突
如果端口被占用，修改配置文件中的端口号：
```json
"production": {
  "port": 8081
}
```

### 2. CORS 错误
确保前端域名已添加到 `allowed_origins` 列表中。

### 3. OTA 更新失败
- 检查 Git 仓库状态
- 确认网络连接
- 查看服务器日志

### 4. 服务无法启动
- 检查配置文件语法
- 确认端口未被占用
- 查看错误日志

## 📝 部署检查清单

- [ ] 配置文件已更新为生产环境
- [ ] CORS 来源已设置为实际域名
- [ ] 端口配置正确
- [ ] 反向代理已配置
- [ ] SSL 证书已安装（如需要）
- [ ] 防火墙规则已设置
- [ ] 进程管理器已配置
- [ ] 监控和日志已设置
- [ ] OTA 更新功能已测试

## 🔗 相关链接

- [项目主页](../README.md)
- [API 文档](../README.md#api-接口)
- [OTA 更新管理界面](/ota/)
- [服务状态接口](/api/status)

---

如有问题，请查看项目文档或提交 Issue。