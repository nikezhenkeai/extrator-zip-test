// Origin B 的完整代码 - 从 OPFS 读取
class OriginBSenderTransformStream {
  constructor() {
    this.messageQueue = []
    this.ready = true
    this.pendingAcks = new Map()

    window.addEventListener('message', this.handleMessage.bind(this))

    this.transformStream = new TransformStream({
      transform: this.transform.bind(this),
      flush: this.flush.bind(this),
    })
  }

  async transform(chunk, controller) {
    if (!this.ready) {
      console.log(' this.messageQueue.push')

      this.messageQueue.push(chunk)
      return
    }
    console.log('2222222222222', chunk)

    await this.sendChunk(chunk)
  }

  async flush(controller) {
    console.log('Origin B: Starting flush, waiting for pending acks...')

    // 等待所有待确认的消息完成
    while (this.pendingAcks.size > 0) {
      console.log(
        `Origin B: Waiting for ${this.pendingAcks.size} pending acks...`
      )
      await new Promise((resolve) => setTimeout(resolve, 100))
    }

    // 发送结束信号
    window.parent.postMessage(
      {
        type: 'stream-end',
      },
      'http://127.0.0.1:3001'
    )

    console.log('Origin B: Flush completed')
  }

  async handleMessage(event) {
    // 在生产环境中应该验证 origin
    // if (event.origin !== 'https://origin-a.example.com') return;

    const data = event.data
    if (data.type === 'chunk-ack') {
        console.log('chunk-ack触发');
        
      const pending = this.pendingAcks.get(data.id)
      if (pending) {
        pending.resolve()
        this.pendingAcks.delete(data.id)
      }
    }
  }

  async processQueue() {
    console.log(
      `Origin B: Processing ${this.messageQueue.length} queued chunks`,
      this.ready
    )
    while (this.messageQueue.length > 0 && this.ready) {
      const chunk = this.messageQueue.shift()
      await this.sendChunk(chunk)
    }
  }

  async sendChunk(chunk) {
    return new Promise((resolve, reject) => {
      const messageId = Math.random().toString(36).substring(2)

      this.pendingAcks.set(messageId, { resolve, reject })

      // 设置超时
      const timeoutId = setTimeout(() => {
        this.pendingAcks.delete(messageId)
        reject(new Error('Chunk acknowledgement timeout'))
      }, 10000)

      // 发送数据块
      try {
        window.parent.postMessage(
          {
            type: 'stream-chunk',
            id: messageId,
            chunk: this.arrayBufferToBase64(chunk),
          },
          'http://127.0.0.1:3001'
        )
      } catch (error) {
        clearTimeout(timeoutId)
        this.pendingAcks.delete(messageId)
        reject(error)
      }
    })
  }

  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    return btoa(binary)
  }

  get readable() {
    return this.transformStream.readable
  }

  get writable() {
    return this.transformStream.writable
  }
}

// 在 Origin B 创建 readableStreamOnOriginB 从 OPFS
async function createReadableStreamOnOriginB(filename = 'source-file.txt') {
  try {
    // 获取 OPFS 根目录
    const root = await navigator.storage.getDirectory()

    // 获取文件句柄
    const fileHandle = await root.getFileHandle(filename)

    // 获取文件对象
    const file = await fileHandle.getFile()

    // 创建可读流
    const readableStream = file.stream()

    console.log(
      `Origin B: Created readable stream for file: ${filename}, size: ${file.size} bytes`
    )
    return readableStream
  } catch (error) {
    if (error.name === 'NotFoundError') {
      // 如果文件不存在，创建一个示例文件用于测试
      console.log('Origin B: File not found, creating sample file...')
      await createSampleOPFSFileOnOriginB(filename)
      return createReadableStreamOnOriginB(filename)
    }
    throw error
  }
}

// 在 Origin B 创建示例 OPFS 文件
async function createSampleOPFSFileOnOriginB(filename) {
  const root = await navigator.storage.getDirectory()
  const fileHandle = await root.getFileHandle(filename, { create: true })
  const writable = await fileHandle.createWritable()

  // 写入一些测试数据
  const content =
    'This is a sample file content from Origin B OPFS for cross-origin stream transfer.\n'
  // 创建 1MB 的数据用于测试
  const largeContent = content.repeat(15000)
  await writable.write(largeContent)
  await writable.close()

  console.log(
    `Origin B: Created sample file: ${filename}, size: ${largeContent.length} bytes`
  )
}

// 设置 Origin B 的流传输（由父页面触发）
async function setupOriginBStreamTransfer() {
  try {
    // 创建原始可读流
    const readableStreamOnOriginB = await createReadableStreamOnOriginB(
      'test1.js'
    )
    console.log(123231)

    // 创建跨 Origin 转换流
    const crossOriginTransform = new OriginBSenderTransformStream()

    // 设置性能监控
    let bytesSent = 0
    const startTime = performance.now()
    const monitoringStream = new TransformStream({
      transform(chunk, controller) {
        bytesSent += chunk.byteLength
        const elapsed = performance.now() - startTime

        const speed = (bytesSent / 1024 / (elapsed / 1000)).toFixed(2)
        console.log(
          `Origin B: Sending chunk, total: ${bytesSent} bytes, speed: ${speed} KB/s`
        )
        controller.enqueue(chunk)
      },
    })
    // 启动流传输
    const transferPromise = readableStreamOnOriginB
      .pipeThrough(monitoringStream)
      .pipeThrough(crossOriginTransform)
      .pipeTo(
        new WritableStream({
          write(chunk) {
            // 这个流只是用于完成管道，数据已经通过 postMessage 发送了
          },
          close() {
            console.log('Origin B: Stream transfer pipeline completed')
          },
        })
      )
    const transferInfo = {
      promise: transferPromise,
      cleanup: () => {
        crossOriginTransform.cleanup()
      },
    }
    return transferInfo;
    // 等待开始信号
    return new Promise((resolve) => {
      const handleStart = (event) => {
        if (event.data.type === 'start-transfer') {
          window.removeEventListener('message', handleStart)

          console.log('Origin B: Starting stream transfer...')

          // 启动流传输
          const transferPromise = readableStreamOnOriginB
            .pipeThrough(monitoringStream)
            .pipeThrough(crossOriginTransform)
            .pipeTo(
              new WritableStream({
                write(chunk) {
                  // 这个流只是用于完成管道，数据已经通过 postMessage 发送了
                },
                close() {
                  console.log('Origin B: Stream transfer pipeline completed')
                },
              })
            )

          resolve(transferPromise)
        }
      }

      window.addEventListener('message', handleStart)
    })
  } catch (error) {
    console.error('Origin B: Stream transfer setup failed:', error)
    throw error
  }
}

// 自动设置流传输监听
;(function () {
  console.log('Origin B: Setting up stream transfer system...')

  const statusElement = document.getElementById('status')
  if (statusElement) {
    statusElement.textContent = '系统就绪，等待父页面启动传输...'
  }

  // 监听开始传输信号
  window.addEventListener('message', async function (event) {
    if (event.data.type === 'start-transfer') {
      console.log(
        'Origin B: Received start-transfer signal, starting new transfer...'
      )
      try {
        await setupOriginBStreamTransfer()
      } catch (error) {
        console.error('Origin B: Transfer setup failed:', error)
        const statusElement = document.getElementById('status')
        if (statusElement) {
          statusElement.textContent = `传输失败: ${error.message}`
        }
      }
    }
  })
})()
