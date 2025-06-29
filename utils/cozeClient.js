const axios = require('axios');

class CozeClient {
    constructor(jwtUtils) {
        this.jwtUtils = jwtUtils;
        this.config = jwtUtils.getConfig();
        
        // 创建axios实例
        this.client = axios.create({
            baseURL: this.config.coze_api_base,
            timeout: 30000,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Coze-OAuth-Client/1.0'
            }
        });
    }

    /**
     * 使用官方SDK获取OAuth访问令牌
     * @param {string} sessionName - 会话名称
     * @param {Object} sessionContext - 会话上下文
     * @returns {Object} OAuth token信息
     */
    async getOAuthToken(sessionName = null, sessionContext = {}) {
        try {
            return await this.jwtUtils.generateJWT(sessionName, sessionContext);
        } catch (error) {
            throw new Error(`OAuth token获取失败: ${error.message}`);
        }
    }

    /**
     * 验证访问令牌
     * @param {string} accessToken - 访问令牌
     * @returns {Object} 验证结果
     */
    async validateToken(accessToken) {
        try {
            const response = await this.client.get('/v1/oauth/token/info', {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return {
                valid: true,
                data: response.data
            };
        } catch (error) {
            return {
                valid: false,
                error: error.response ? error.response.data : error.message
            };
        }
    }

    /**
     * 获取Bot信息
     * @param {string} botId - Bot ID
     * @param {string} accessToken - 访问令牌
     * @returns {Object} Bot信息
     */
    async getBotInfo(botId, accessToken) {
        try {
            const response = await this.client.get(`/v1/bot/get_online_info?bot_id=${botId}`, {
                headers: {
                    'Authorization': `Bearer ${accessToken}`
                }
            });

            return response.data;
        } catch (error) {
            if (error.response) {
                throw new Error(`Bot信息获取失败: ${error.response.status} - ${JSON.stringify(error.response.data)}`);
            } else {
                throw new Error(`Bot信息获取失败: ${error.message}`);
            }
        }
    }

    /**
     * 测试与Coze API的连接
     * @returns {Object} 连接测试结果
     */
    async testConnection() {
        try {
            // 尝试访问一个简单的端点来测试连接
            const response = await this.client.get('/v1/oauth/token/info', {
                timeout: 5000
            });
            
            return {
                connected: false, // 预期会返回401，但能连通
                status: response.status,
                message: '连接正常（预期的认证错误）'
            };
        } catch (error) {
            if (error.response && error.response.status === 401) {
                return {
                    connected: true,
                    status: 401,
                    message: '连接正常（预期的认证错误）'
                };
            } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
                return {
                    connected: false,
                    status: null,
                    message: '无法连接到Coze API'
                };
            } else {
                return {
                    connected: false,
                    status: error.response ? error.response.status : null,
                    message: error.message
                };
            }
        }
    }

    /**
     * 获取配置信息
     * @returns {Object} 配置信息
     */
    getConfig() {
        return this.config;
    }
}

module.exports = CozeClient;