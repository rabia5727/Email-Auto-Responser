// craco.config.js
const path = require("path");
require("dotenv").config();

// Check if we're in development/preview mode (not production build)
// Craco sets NODE_ENV=development for start, NODE_ENV=production for build
const isDevServer = process.env.NODE_ENV !== "production";

// Environment variable overrides
const config = {
  enableHealthCheck: process.env.ENABLE_HEALTH_CHECK === "true",
};

// Conditionally load health check modules only if enabled
let WebpackHealthPlugin;
let setupHealthEndpoints;
let healthPluginInstance;

if (config.enableHealthCheck) {
  WebpackHealthPlugin = require("./plugins/health-check/webpack-health-plugin");
  setupHealthEndpoints = require("./plugins/health-check/health-endpoints");
  healthPluginInstance = new WebpackHealthPlugin();
}

let webpackConfig = {
  eslint: {
    configure: {
      extends: ["plugin:react-hooks/recommended"],
      rules: {
        "react-hooks/rules-of-hooks": "error",
        "react-hooks/exhaustive-deps": "warn",
      },
    },
  },
  webpack: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    configure: (webpackConfig) => {

      // Add ignored patterns to reduce watched directories
        webpackConfig.watchOptions = {
          ...webpackConfig.watchOptions,
          ignored: [
            '**/node_modules/**',
            '**/.git/**',
            '**/build/**',
            '**/dist/**',
            '**/coverage/**',
            '**/public/**',
        ],
      };

      // Add health check plugin to webpack if enabled
      if (config.enableHealthCheck && healthPluginInstance) {
        webpackConfig.plugins.push(healthPluginInstance);
      }
      return webpackConfig;
    },
  },
};

webpackConfig.devServer = (devServerConfig) => {
  // Remove deprecated properties
  delete devServerConfig.onAfterSetupMiddleware;
  delete devServerConfig.onBeforeSetupMiddleware;
  
  // Fix https property - should be inside server object or removed
  if (devServerConfig.https !== undefined) {
    if (devServerConfig.https) {
      devServerConfig.server = {
        type: 'https',
        options: typeof devServerConfig.https === 'object' ? devServerConfig.https : {}
      };
    }
    delete devServerConfig.https;
  }
  
  // Add health check endpoints if enabled
  if (config.enableHealthCheck && setupHealthEndpoints && healthPluginInstance) {
    const originalSetupMiddlewares = devServerConfig.setupMiddlewares;

    devServerConfig.setupMiddlewares = (middlewares, devServer) => {
      // Call original setup if exists
      if (originalSetupMiddlewares) {
        middlewares = originalSetupMiddlewares(middlewares, devServer);
      }

      // Setup health endpoints
      setupHealthEndpoints(devServer, healthPluginInstance);

      return middlewares;
    };
  }

  return devServerConfig;
};

// Wrap with visual edits (automatically adds babel plugin, dev server, and overlay in dev mode)
if (isDevServer) {
  try {
    const { withVisualEdits } = require("@emergentbase/visual-edits/craco");
    
    // Save original devServer function
    const originalDevServerFn = webpackConfig.devServer;
    
    // Apply visual edits
    webpackConfig = withVisualEdits(webpackConfig);
    
    // Wrap the devServer configuration to clean deprecated props
    const visualEditsDevServerFn = webpackConfig.devServer;
    
    webpackConfig.devServer = (devServerConfig) => {
      // Apply visual edits config first
      if (typeof visualEditsDevServerFn === 'function') {
        devServerConfig = visualEditsDevServerFn(devServerConfig);
      }
      
      // Then apply our original config
      if (typeof originalDevServerFn === 'function') {
        devServerConfig = originalDevServerFn(devServerConfig);
      }
      
      // Final cleanup of any lingering deprecated properties
      const deprecatedProps = ['onAfterSetupMiddleware', 'onBeforeSetupMiddleware', 'https'];
      deprecatedProps.forEach(prop => {
        if (devServerConfig[prop] !== undefined) {
          if (prop === 'https' && devServerConfig[prop]) {
            // Convert https to server format
            devServerConfig.server = {
              type: 'https',
              options: typeof devServerConfig[prop] === 'object' ? devServerConfig[prop] : {}
            };
          }
          delete devServerConfig[prop];
        }
      });
      
      return devServerConfig;
    };
  } catch (err) {
    if (err.code === 'MODULE_NOT_FOUND' && err.message.includes('@emergentbase/visual-edits/craco')) {
      console.warn(
        "[visual-edits] @emergentbase/visual-edits not installed — visual editing disabled."
      );
    } else {
      throw err;
    }
  }
}

module.exports = webpackConfig;
