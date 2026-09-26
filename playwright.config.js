const {defineConfig}=require('@playwright/test');
module.exports=defineConfig({
  testDir:'./tests/ui',fullyParallel:false,
  use:{baseURL:'http://127.0.0.1:4173',viewport:{width:393,height:852},deviceScaleFactor:1,trace:'retain-on-failure'},
  webServer:{command:'node tests/serve.js',url:'http://127.0.0.1:4173',reuseExistingServer:!process.env.CI},
  reporter:'list'
});
