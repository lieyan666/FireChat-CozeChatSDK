import express from 'express';
import cors from 'cors';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import rateLimit from 'express-rate-limit';
import { CozeAPI, COZE_COM_BASE_URL, ChatStatus, RoleType } from '@coze/api';
import path from 'path';
import { fileURLToPath } from 'url';

// ES模块中获取__dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 加载环境变量
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// 模拟用户数据库（生产环境中应使用真实数据库）
const users = [
  {
    id: 1,
    studentId: '123456',
    username: 'demo',
    email: 'demo@example.com'
  }
];

// 验证学号格式（6位数字）
const validateStudentId = (studentId) => {
  return /^\d{6}$/.test(studentId);
};

// 速率限制配置
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15分钟
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 限制每个IP 100个请求
  message: {
    error: 'Too many requests from this IP, please try again later.'
  }
});

// 中间件配置
app.use(limiter);
app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3001',
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// 初始化Coze API客户端
let cozeClient;
if (process.env.COZE_API_TOKEN) {
  cozeClient = new CozeAPI({
    token: process.env.COZE_API_TOKEN,
    baseURL: process.env.COZE_BASE_URL || COZE_COM_BASE_URL,
  });
}

// JWT验证中间件
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

// 生成JWT令牌
const generateAccessToken = (user) => {
  return jwt.sign(
    { 
      id: user.id,
      studentId: user.studentId,
      username: user.username, 
      email: user.email 
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
  );
};

// 路由定义

// 根路径 - 提供前端页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 用户注册（使用学号）
app.post('/api/auth/register', async (req, res) => {
  try {
    const { studentId, username, email } = req.body;

    if (!studentId || !username || !email) {
      return res.status(400).json({ error: 'Student ID, username and email are required' });
    }

    // 验证学号格式
    if (!validateStudentId(studentId)) {
      return res.status(400).json({ error: 'Student ID must be 6 digits' });
    }

    // 检查用户是否已存在
    const existingUser = users.find(u => u.studentId === studentId || u.username === username || u.email === email);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    // 创建新用户
    const newUser = {
      id: users.length + 1,
      studentId,
      username,
      email
    };

    users.push(newUser);

    // 生成JWT令牌
    const token = generateAccessToken(newUser);

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: {
        id: newUser.id,
        studentId: newUser.studentId,
        username: newUser.username,
        email: newUser.email
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

// 用户登录（使用学号）
app.post('/api/auth/login', async (req, res) => {
  try {
    const { studentId } = req.body;

    // 验证输入
    if (!studentId) {
      return res.status(400).json({ error: 'Student ID is required' });
    }

    // 验证学号格式
    if (!validateStudentId(studentId)) {
      return res.status(400).json({ error: 'Student ID must be 6 digits' });
    }

    // 查找用户
    const user = users.find(u => u.studentId === studentId);
    if (!user) {
      return res.status(401).json({ error: 'Student ID not found' });
    }

    // 生成JWT令牌
    const token = generateAccessToken(user);

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        studentId: user.studentId,
        username: user.username,
        email: user.email
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Login failed' });
  }
});

// 获取用户信息（需要认证）
app.get('/api/auth/profile', authenticateToken, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      studentId: req.user.studentId,
      username: req.user.username,
      email: req.user.email
    }
  });
});

// 获取OAuth Token（用于Coze Web SDK）
app.get('/api/auth/oauth-token', authenticateToken, (req, res) => {
  try {
    // 这里可以根据需要生成特定的OAuth token
    // 目前返回JWT token作为OAuth token
    const oauthToken = generateAccessToken(req.user);
    
    res.json({
      access_token: oauthToken,
      token_type: 'Bearer',
      expires_in: 86400, // 24小时
      user: {
        id: req.user.id,
        studentId: req.user.studentId,
        username: req.user.username,
        email: req.user.email
      }
    });
  } catch (error) {
    console.error('OAuth token error:', error);
    res.status(500).json({ error: 'Failed to generate OAuth token' });
  }
});

// Coze聊天接口（需要认证）
app.post('/api/chat', authenticateToken, async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (!cozeClient) {
      return res.status(500).json({ error: 'Coze API not configured' });
    }

    if (!process.env.COZE_BOT_ID) {
      return res.status(500).json({ error: 'Coze Bot ID not configured' });
    }

    // 调用Coze API
    const chatResponse = await cozeClient.chat.createAndPoll({
      bot_id: process.env.COZE_BOT_ID,
      additional_messages: [{
        role: RoleType.User,
        content: message,
        content_type: 'text',
      }],
    });

    if (chatResponse.chat.status === ChatStatus.COMPLETED) {
      // 提取AI回复
      const aiMessages = chatResponse.messages.filter(
        msg => msg.role === RoleType.Assistant && msg.type === 'answer'
      );

      const reply = aiMessages.length > 0 ? aiMessages[0].content : 'Sorry, I could not generate a response.';

      res.json({
        success: true,
        reply,
        usage: chatResponse.chat.usage
      });
    } else {
      res.status(500).json({ 
        error: 'Chat request failed', 
        status: chatResponse.chat.status 
      });
    }
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to process chat request',
      details: error.message 
    });
  }
});

// 健康检查接口
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    cozeConfigured: !!process.env.COZE_API_TOKEN
  });
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// 404处理
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// 启动服务器
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🤖 Coze API configured: ${!!process.env.COZE_API_TOKEN}`);
});

export default app;