const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = 3001
const ZIP_FILE = path.join(__dirname, 'test.zip')

// 静态文件托管 public 文件夹
app.use(express.static(path.join(__dirname, 'public')))


// // 处理 ZIP 文件下载，支持 Range 请求

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
  console.log(`ZIP 文件地址: http://localhost:${PORT}/test.zip`)
  console.log(`静态 HTML 地址: http://localhost:${PORT}/index.html`)
})
