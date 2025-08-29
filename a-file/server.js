const express = require('express')
const app = express()
const PORT = 3001

// 启用CORS
// app.use(cors())

// 提供静态文件服务
app.use(express.static('public'))

// 启动服务器
app.listen(PORT, '127.0.0.1', () => {
  console.log(`服务器运行在 http://127.0.0.1:${PORT}`)
})
