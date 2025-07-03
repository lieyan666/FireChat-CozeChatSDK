const { getJWTToken } = require('@coze/api');
const fs = require('fs');
const path = require('path');

class JWTUtils {
    constructor(configPath = null) {
        this.config = this.loadConfig(configPath);
    }

    loadConfig(configPath = null) {
        // Use the new config file path
        const defaultConfigPath = path.join(__dirname, '../config/coze.json');
        const finalConfigPath = configPath || defaultConfigPath;
        
        // Check if configuration file exists
        if (!fs.existsSync(finalConfigPath)) {
            throw new Error(`Coze配置文件 ${finalConfigPath} 不存在！请检查config/coze.json文件`);
        }

        // Read configuration file
        let config;
        try {
            config = JSON.parse(fs.readFileSync(finalConfigPath, 'utf8'));
        } catch (error) {
            throw new Error(`配置文件解析失败: ${error.message}`);
        }

        // Validate required fields
        const requiredFields = [
            'client_type',
            'client_id',
            'public_key_id',
            'private_key',
            'coze_www_base',
            'coze_api_base',
        ];

        for (const field of requiredFields) {
            if (!config[field]) {
                throw new Error(`配置文件缺少必需字段: ${field}`);
            }
            if (typeof config[field] === 'string' && !config[field].trim()) {
                throw new Error(`配置字段 ${field} 不能为空字符串`);
            }
        }

        // Validate private key format
        if (!config.private_key.includes('BEGIN PRIVATE KEY')) {
            throw new Error('私钥格式不正确，请确保包含完整的PEM格式私钥');
        }

        return config;
    }

    async generateJWT(sessionName = null, sessionContext = {}) {
        try {
            const oauthToken = await getJWTToken({
                baseURL: this.config.coze_api_base,
                appId: this.config.client_id,
                aud: new URL(this.config.coze_api_base).host,
                keyid: this.config.public_key_id,
                privateKey: this.config.private_key,
                sessionName: sessionName,
                sessionContext: sessionContext,
                duration_seconds: 3600  // 设置token有效期为1小时（3600秒）
            });

            // API返回的expires_in是Unix时间戳，需要转换为相对秒数
            const currentTimestamp = Math.floor(Date.now() / 1000); // 当前时间戳（秒）
            const expiresTimestamp = oauthToken.expires_in; // API返回的过期时间戳
            const relativeExpiresIn = Math.max(0, expiresTimestamp - currentTimestamp); // 转换为相对秒数
            
            // 转换为东八区时间用于日志显示
            const expiresAtBeijing = new Date(expiresTimestamp * 1000).toLocaleString('zh-CN', {
                timeZone: 'Asia/Shanghai',
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit'
            });
            
            console.log(`Token过期时间戳: ${expiresTimestamp}, 东八区时间: ${expiresAtBeijing}, 相对有效期: ${relativeExpiresIn}秒`);

            return {
                access_token: oauthToken.access_token,
                token_type: oauthToken.token_type,
                expires_in: relativeExpiresIn, // 返回相对秒数
                expires_at_beijing: expiresAtBeijing, // 东八区时间字符串
                expires_timestamp: expiresTimestamp // 原始时间戳
            };
        } catch (error) {
            throw new Error(`Failed to generate JWT token: ${error.message}`);
        }
    }

    timestampToDatetime(timestamp) {
        return new Date(timestamp * 1000).toLocaleString();
    }

    getConfig() {
        return this.config;
    }
}

module.exports = JWTUtils;