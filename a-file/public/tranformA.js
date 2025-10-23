// Origin A 的完整代码 - 接收数据流
class OriginAReceiverTransformStream {
  constructor() {
    this.reset()

    window.addEventListener('message', this.handleMessage.bind(this))

    this.transformStream = new TransformStream({
      start: (controller) => {
        console.log('Origin A: Transform stream started')
        // 注意：这个 controller 只能在 transform 和 flush 方法内部使用
      },
      transform: (chunk, controller) => {
        console.log('Origin A: Transform called with chunk', chunk.byteLength)
        // 直接传递数据
        controller.enqueue(chunk)
      },
      flush: (controller) => {
        console.log('Origin A: Transform stream flush called')
        // 处理队列中剩余的数据
        while (this.chunkQueue.length > 0) {
          const chunk = this.chunkQueue.shift()
          controller.enqueue(chunk)
        }

        // 确保所有数据处理完成
        if (this.resolveClose) {
          this.resolveClose()
        }
      },
    })
  }
  reset() {
    this.chunkQueue = []
    this.ended = false
    this.resolveClose = null
    this.closeRequested = false
    this.writer = null
    console.log('Origin A: Transform stream reset')
  }
  handleMessage(event) {
    const data = event.data

    if (data.type === 'stream-ready') {
      console.log('Origin A: Received stream-ready from Origin B')
    } else if (data.type === 'stream-chunk') {
      console.log('Origin A: Received stream-chunk with id:', data.id)

      // 转换 base64 回 ArrayBuffer
      const chunkData = this.base64ToArrayBuffer(data.chunk)

      // 将数据写入 TransformStream 的可写端
      this.writeToStream(chunkData)

      // 发送确认
      event.source.postMessage(
        {
          type: 'chunk-ack',
          id: data.id,
        },
        event.origin
      )
    } else if (data.type === 'stream-end') {
      console.log('Origin A: Received stream-end signal')
      this.ended = true
      this.closeRequested = true

      // 关闭 TransformStream 的可写端，这会触发 flush
      this.closeWritable()
    }
  }

  // 通过 TransformStream 的 writer 写入数据
  async writeToStream(chunk) {
    if (!this.writer) {
        console.log(23333333333333333);
        
      this.writer = this.transformStream.writable.getWriter()
    }

    try {
      await this.writer.write(chunk)
      console.log('Origin A: Successfully wrote chunk to stream')
    } catch (error) {
      console.error('Origin A: Error writing chunk to stream:', error)
      // 如果写入失败，将数据加入队列稍后重试
      this.chunkQueue.push(chunk)
    }
  }

  // 关闭 TransformStream 的可写端
  async closeWritable() {
    if (this.writer) {
      try {
        await this.writer.close()
        console.log('Origin A: TransformStream writable end closed')
      } catch (error) {
        console.error('Origin A: Error closing writable:', error)
      } finally {
        this.releaseWriter()
      }
    } else {
      console.warn('Origin A: No writer available to close')
    }
  }
  releaseWriter() {
    if (this.writer) {
      this.writer.releaseLock()
      this.writer = null
      console.log('Origin A: Writer released')
    }
  }

  base64ToArrayBuffer(base64) {
    try {
      const binaryString = atob(base64)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      return bytes.buffer
    } catch (error) {
      console.error('Origin A: Error decoding base64:', error)
      return new ArrayBuffer(0)
    }
  }

  get readable() {
    return this.transformStream.readable
  }

  get writable() {
    return this.transformStream.writable
  }

  // 完全重置流以便重新使用
  async resetForReuse() {
    this.cleanup()
    this.reset()

    // 创建一个新的 TransformStream
    this.transformStream = new TransformStream({
      start: (controller) => {
        console.log('Origin A: New transform stream started for reuse')
      },
      transform: (chunk, controller) => {
        controller.enqueue(chunk)
      },
      flush: (controller) => {
        console.log('Origin A: New transform stream flush called')
        this.cleanup()
      },
    })

    console.log('Origin A: Transform stream reset for reuse')
  }
}

// 在 Origin A 创建 writableStreamOnOriginA - 仅用于接收数据
function createWritableStreamOnOriginA() {
  let bytesReceived = 0
  const startTime = performance.now()
  let streamClosed = false
  const receivedChunks = [] // 存储接收到的数据块（可选）

  const writableStream = new WritableStream({
    start(controller) {
      console.log('Origin A: Writable stream started')
    },
    write(chunk) {
      return new Promise((resolve) => {
        bytesReceived += chunk.byteLength
        const elapsed = performance.now() - startTime
        const speed = (bytesReceived / 1024 / (elapsed / 1000)).toFixed(2)

        console.log(
          `Origin A: Received chunk of ${chunk.byteLength} bytes, total: ${bytesReceived} bytes`
        )

        // 存储数据块（可选）
        receivedChunks.push(chunk)

        // 更新页面显示

        // 处理接收到的数据
        processReceivedChunk(chunk, bytesReceived)

        // 模拟处理时间，避免背压问题
        setTimeout(resolve, 0)
      })
    },
    close() {
      streamClosed = true
      const totalTime = performance.now() - startTime
      const averageSpeed = (bytesReceived / 1024 / (totalTime / 1000)).toFixed(
        2
      )

      console.log(
        `Origin A: Writable stream closed in ${totalTime.toFixed(
          2
        )}ms, total: ${bytesReceived} bytes`
      )

      // 传输完成后的处理
      onStreamComplete(bytesReceived, totalTime, receivedChunks)
    },
    abort(err) {
      console.error('Origin A: Writable stream aborted:', err)
    },
  })

  return {
    stream: writableStream,
    getStats: () => ({ bytesReceived, startTime, streamClosed }),
    getReceivedData: () => receivedChunks,
  }
}

// 处理接收到的数据块
function processReceivedChunk(chunk, totalBytes) {
  // 这里可以实现对接收数据的处理逻辑
  try {
    // 示例：如果是文本数据，可以实时显示前几个字符
    if (chunk.byteLength > 0) {
      const decoder = new TextDecoder()
      const text = decoder.decode(
        chunk.slice(0, Math.min(50, chunk.byteLength))
      )

      console.log(`Origin A: 处理接收到的数据块，前50字节内容:`, text)
    }
  } catch (error) {
    console.error('Origin A: Error processing chunk:', error)
  }
}

// 传输完成后的回调
function onStreamComplete(totalBytes, totalTime, receivedChunks) {
  console.log(
    `Origin A: 传输完成回调 - ${totalBytes} 字节, ${totalTime}ms, ${receivedChunks.length} 个数据块`
  )
}

// 更新状态显示
function updateStatus(message) {
  const statusElement = document.getElementById('status')
  if (statusElement) {
    statusElement.textContent = message
  }
}

// 设置 Origin A 的完整流接收
async function setupOriginAStreamReception() {
  try {
    // 创建用于接收数据的可写流
    const {
      stream: writableStreamOnOriginA,
      getStats,
      getReceivedData,
    } = createWritableStreamOnOriginA()

    // 创建跨 Origin 转换流
    const crossOriginTransform = new OriginAReceiverTransformStream()

    // 启动流接收：将转换流的可读端管道到可写流
    const pipePromise = crossOriginTransform.readable.pipeTo(
      writableStreamOnOriginA
    )

    return {
      promise: pipePromise,
      writable: crossOriginTransform.writable,
      transform: crossOriginTransform,
      getStats,
      getReceivedData,
      cleanup: async () => {
        writableStreamInfo.cleanup()
        await crossOriginTransform.resetForReuse()
      },
    }
  } catch (error) {
    console.error('Origin A: Stream reception setup failed:', error)
    throw error
  }
}

// 启动传输（由用户触发）
async function startStreamTransfer() {
  try {
    const iframe = document.getElementById('myIframe')

    // 设置接收
    const result = await setupOriginAStreamReception()

    // 监听传输完成
    result.promise
      .then(() => {
        console.log('Origin A: Stream pipe completed successfully')
      })
      .catch((error) => {
        console.error('Origin A: Stream pipe failed:', error)
      })

    // 通知 iframe 开始传输
    console.log('Origin A: Sending start-transfer signal')
    iframe.contentWindow.postMessage(
      {
        type: 'start-transfer',
      },
      'http://localhost:3001'
    )
  } catch (error) {
    console.error('Origin A: Failed to start transfer:', error)
  }
}

// 下载接收到的数据
function downloadReceivedData() {
  const downloadBtn = document.getElementById('downloadBtn')
  if (!downloadBtn.receivedData || downloadBtn.receivedData.length === 0) {
    alert('没有可下载的数据')
    return
  }

  try {
    // 合并所有数据块
    const totalSize = downloadBtn.receivedData.reduce(
      (total, chunk) => total + chunk.byteLength,
      0
    )
    const combinedBuffer = new Uint8Array(totalSize)
    let offset = 0

    for (const chunk of downloadBtn.receivedData) {
      combinedBuffer.set(new Uint8Array(chunk), offset)
      offset += chunk.byteLength
    }

    // 创建 Blob 和下载链接
    const blob = new Blob([combinedBuffer], {
      type: 'application/octet-stream',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `received-data-${Date.now()}.bin`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    console.log('下载了接收到的数据，大小:', totalSize, '字节')
  } catch (error) {
    console.error('下载数据时出错:', error)
    alert('下载失败: ' + error.message)
  }
}
