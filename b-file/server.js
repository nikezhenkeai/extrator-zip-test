const express = require('express')
const fs = require('fs')
const path = require('path')

const app = express()
const PORT = 3001
const ZIP_FILE = path.join(__dirname, 'test.zip')

// 静态文件托管 public 文件夹
app.use(express.static(path.join(__dirname, 'public')))

// 处理 ZIP 文件下载，支持 Range 请求
app.get('/download.zip', (req, res) => {
  // 设置 CORS 头部
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type')
  res.setHeader(
    'Access-Control-Expose-Headers',
    'Accept-Ranges, Content-Length, Content-Range'
  )
  res.setHeader('Accept-Ranges', 'bytes')
  res.setHeader('Content-Type', 'application/zip')

  try {
    const stat = fs.statSync(ZIP_FILE)
    const fileSize = stat.size
    const range = req.headers.range

    if (range) {
      const rangeMatch = range.match(/bytes=([0-9]*)-([0-9]*)/)
      if (rangeMatch) {
        const start = parseInt(rangeMatch[1]) || 0
        const end = parseInt(rangeMatch[2]) || fileSize - 1
        const chunkSize = end - start + 1

        res.status(206).set({
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunkSize,
        })

        const stream = fs.createReadStream(ZIP_FILE, { start, end })
        stream.pipe(res)
        return
      }
    }

    // 返回完整文件
    res.status(200).set({
      'Content-Length': fileSize,
    })
    fs.createReadStream(ZIP_FILE).pipe(res)
  } catch (error) {
    res.status(500).send('Internal Server Error')
  }
})

app.listen(PORT, () => {
  console.log(`服务器运行在 http://localhost:${PORT}`)
  console.log(`ZIP 文件地址: http://localhost:${PORT}/download.zip`)
  console.log(`静态 HTML 地址: http://localhost:${PORT}/index.html`)
})
