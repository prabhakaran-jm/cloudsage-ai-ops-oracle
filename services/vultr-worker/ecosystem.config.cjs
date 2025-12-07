// PM2 Ecosystem configuration for Vultr Worker
// This ensures environment variables are loaded from .env file

module.exports = {
  apps: [{
    name: 'risk-worker',
    script: './dist/main.js',
    cwd: __dirname,
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env',
    env: {
      NODE_ENV: 'production',
      PORT: 8080,
    },
    // Load environment variables from .env file
    // PM2 will merge these with process.env
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
  }]
};

