const { getJWTToken } = require('@coze/api');
const fs = require('fs');
const path = require('path');

class JWTUtils {
    constructor(configPath = null) {
        this.config = this.loadConfig(configPath);
    }

    loadConfig(configPath = null) {
        // Use the official config file path if not provided
        const defaultConfigPath = path.join(__dirname, '../coze_oauth_nodejs_jwt/coze_oauth_config.json');
        const finalConfigPath = configPath || defaultConfigPath;
        
        // Check if configuration file exists
        if (!fs.existsSync(finalConfigPath)) {
            throw new Error(`Configuration file ${finalConfigPath} does not exist!`);
        }

        // Read configuration file
        const config = JSON.parse(fs.readFileSync(finalConfigPath, 'utf8'));

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
                throw new Error(`Configuration file missing required field: ${field}`);
            }
            if (typeof config[field] === 'string' && !config[field].trim()) {
                throw new Error(`Configuration field ${field} cannot be an empty string`);
            }
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
                sessionContext: sessionContext
            });

            return {
                access_token: oauthToken.access_token,
                token_type: oauthToken.token_type,
                expires_in: oauthToken.expires_in,
                expires_at: new Date(oauthToken.expires_in * 1000).toISOString()
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