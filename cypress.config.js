const { defineConfig } = require("cypress");
const fs = require("fs");
const path = require("path");

module.exports = defineConfig({
  e2e: {
    baseUrl: "https://frontend-bdfunnelbuilder.vercel.app",
    defaultCommandTimeout: 10000,
    setupNodeEvents(on, config) {
      on("task", {
        listDownloads() {
          const dir = path.join(config.projectRoot, "cypress", "downloads");
          if (!fs.existsSync(dir)) return [];
          return fs.readdirSync(dir);
        },
      });
    },
  },
});
