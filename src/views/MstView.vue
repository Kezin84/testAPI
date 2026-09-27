<script setup lang="ts">
import { ref, nextTick, onMounted } from 'vue'

const mstInput = ref('')
const isLoading = ref(false)
const loadingStep = ref('')
const errorMsg = ref('')

const isRecording = ref(false)
const isExtracting = ref(false)
let recognition: any = null
const fileInput = ref<HTMLInputElement | null>(null)
const imagePreview = ref<string | null>(null)
const imageBase64 = ref<string | null>(null)

const extractMSTFromImage = async (base64: string) => {
  isExtracting.value = true
  mstInput.value = 'Đang quét ảnh...'
  errorMsg.value = ''
  
  try {
    const promptText = `Bạn là công cụ OCR và trích xuất. Hãy đọc hình ảnh này và tìm Mã số thuế (MST) của doanh nghiệp (thường là 10 hoặc 13 số). TRẢ VỀ DUY NHẤT CHUỖI SỐ ĐÓ, không kèm văn bản giải thích. Nếu không thấy, trả về chữ "NONE".`
    
    const API_KEY = 'VxCgNvLTE.ChthcGlrZXktMjAyNjA5MjYyMjIwMzAtc3BxZjUQ-5_rmAsYAiChsbAtKhCfbVs3Y4ZNyaYEA0mgOVlR.5vf7PVVe5D3Q4mSB792sHun4PKv2KfynDAPmirc9K8MRLfh0VPFzQp84yny1A7t9brxZLjpO-FDR-TqCaS3o5QeZ'
    const aiResponse = await fetch('/byteplus-api/api/v3/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'ep-20260926231634-p4kgv',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: promptText },
              { type: 'input_image', image_url: base64 }
            ]
          }
        ]
      })
    })

    const aiData = await aiResponse.json()
    let content = ''
    if (aiData.choices && aiData.choices[0] && aiData.choices[0].message) {
      content = aiData.choices[0].message.content
    } else {
      const messageOutput = aiData.output?.find((o: any) => o.type === 'message')
      if (messageOutput && messageOutput.content && messageOutput.content[0]) {
        content = messageOutput.content[0].text
      }
    }
    
    content = content.replace(/[^0-9-]/g, '').trim()
    
    if (content && content.length >= 9) {
      mstInput.value = content
      setTimeout(() => { clearImage() }, 500)
    } else {
      mstInput.value = ''
      errorMsg.value = 'Không tìm thấy Mã số thuế trong ảnh'
    }
  } catch (err) {
    console.error(err)
    mstInput.value = ''
    errorMsg.value = 'Lỗi khi quét ảnh'
  } finally {
    isExtracting.value = false
  }
}

const processImageFile = (file: File) => {
  imagePreview.value = URL.createObjectURL(file)
  const reader = new FileReader()
  reader.onload = (e) => {
    if (e.target && typeof e.target.result === 'string') {
      imageBase64.value = e.target.result
      extractMSTFromImage(e.target.result)
    }
  }
  reader.readAsDataURL(file)
}

const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    processImageFile(target.files[0])
  }
  target.value = ''
}

const handlePaste = (event: ClipboardEvent) => {
  const items = event.clipboardData?.items
  if (!items) return
  
  for (let i = 0; i < items.length; i++) {
    if (items[i].type.indexOf('image') !== -1) {
      const file = items[i].getAsFile()
      if (file) {
        processImageFile(file)
        event.preventDefault()
      }
      break
    }
  }
}

const triggerCamera = () => {
  if (fileInput.value) fileInput.value.click()
}

const clearImage = () => {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = null
  imageBase64.value = null
}

const toggleRecording = () => {
  if (!recognition) {
    alert('Trình duyệt của bạn không hỗ trợ nhận diện giọng nói. Vui lòng dùng Chrome hoặc Edge.')
    return
  }
  if (isRecording.value) {
    recognition.stop()
  } else {
    recognition.start()
    isRecording.value = true
  }
}

interface CompanyData {
  [key: string]: string
  ten_cong_ty: string
  nhom_nganh: string
  nguoi_dai_dien: string
  ma_so_thue: string
  dia_chi: string
  tinh_trang: string
  dien_thoai: string
  ngay_hoat_dong: string
  quan_ly_boi: string
  loai_hinh: string
}

// Result data
const companyData = ref<CompanyData | null>(null)

const searchHistory = ref<any[]>([])

onMounted(() => {
  const history = localStorage.getItem('mstHistoryFull_v1')
  if (history) {
    searchHistory.value = JSON.parse(history)
  }

  // Setup Speech Recognition
  if (typeof window !== 'undefined') {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (SpeechRecognition) {
      recognition = new SpeechRecognition()
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = 'vi-VN'

      recognition.onresult = (event: any) => {
        let finalTranscript = ''
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript
          }
        }
        if (finalTranscript) {
          mstInput.value += (mstInput.value ? ' ' : '') + finalTranscript
          mstInput.value = mstInput.value.replace(/[\s\.\,]/g, '') // Chuẩn hóa mã số thuế (bỏ khoảng trắng, dấu phẩy)
        }
      }
      
      recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error)
        isRecording.value = false
      }
      
      recognition.onend = () => {
        isRecording.value = false
      }
    }
  }
})

const saveToHistory = (data: any) => {
  searchHistory.value = searchHistory.value.filter(item => item.ma_so_thue !== data.ma_so_thue)
  searchHistory.value.unshift(JSON.parse(JSON.stringify(data))) // Deep copy
  if (searchHistory.value.length > 20) searchHistory.value.pop()
  localStorage.setItem('mstHistoryFull_v1', JSON.stringify(searchHistory.value))
}

const loadFromHistory = (data: any) => {
  mstInput.value = data.ma_so_thue
  companyData.value = JSON.parse(JSON.stringify(data))
  errorMsg.value = ''
}

const showChatModal = ref(false)
const chatHistory = ref<{role: string, content: string}[]>([])
const chatInput = ref('')
const isChatLoading = ref(false)
const chatContainer = ref<HTMLElement | null>(null)

const copiedField = ref('')

const copyText = async (text: string, fieldName: string) => {
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    copiedField.value = fieldName
    setTimeout(() => {
      if (copiedField.value === fieldName) copiedField.value = ''
    }, 2000)
  } catch (err) {
    console.error('Failed to copy', err)
  }
}

const fields = [
  { key: 'ma_so_thue', label: 'Mã số thuế', type: 'input', class: 'highlight', fullWidth: false },
  { key: 'nguoi_dai_dien', label: 'Người đại diện', type: 'input', class: '', fullWidth: false },
  { key: 'dien_thoai', label: 'Điện thoại', type: 'input', class: '', fullWidth: false },
  { key: 'ngay_hoat_dong', label: 'Ngày hoạt động', type: 'input', class: '', fullWidth: false },
  { key: 'nhom_nganh', label: 'Nhóm ngành', type: 'textarea', class: '', fullWidth: true },
  { key: 'dia_chi', label: 'Địa chỉ Thuế', type: 'textarea', class: '', fullWidth: true },
  { key: 'quan_ly_boi', label: 'Quản lý bởi', type: 'input', class: '', fullWidth: false },
  { key: 'loai_hinh', label: 'Loại hình DN', type: 'input', class: '', fullWidth: false }
]

const scrollToBottom = async () => {
  await nextTick()
  if (chatContainer.value) {
    chatContainer.value.scrollTop = chatContainer.value.scrollHeight
  }
}

const openChatModal = () => {
  showChatModal.value = true
  if (chatHistory.value.length === 0) {
    const greetingText = `Xin chào! Tôi là Trợ lý phân tích doanh nghiệp. Tôi đã đọc dữ liệu về **${companyData.value?.ten_cong_ty}**. Bạn muốn biết đánh giá rủi ro, tiềm năng hay hỏi thông tin gì về công ty này?`
    
    chatHistory.value.push({ role: 'assistant', content: '' })
    const lastIndex = chatHistory.value.length - 1
    
    let i = 0
    const interval = setInterval(() => {
      chatHistory.value[lastIndex].content += greetingText.charAt(i)
      i++
      scrollToBottom()
      if (i >= greetingText.length) clearInterval(interval)
    }, 15)
  }
}

const sendMessage = async () => {
  if (!chatInput.value.trim() || isChatLoading.value) return
  
  const userText = chatInput.value
  chatInput.value = ''
  
  chatHistory.value.push({ role: 'user', content: userText })
  isChatLoading.value = true
  scrollToBottom()

  try {
    const API_KEY = 'VxCgNvLTE.ChthcGlrZXktMjAyNjA5MjYyMjIwMzAtc3BxZjUQ-5_rmAsYAiChsbAtKhCfbVs3Y4ZNyaYEA0mgOVlR.5vf7PVVe5D3Q4mSB792sHun4PKv2KfynDAPmirc9K8MRLfh0VPFzQp84yny1A7t9brxZLjpO-FDR-TqCaS3o5QeZ'
    
    const systemContext = `Ngữ cảnh hệ thống: Bạn đang đóng vai chuyên gia tài chính/phân tích doanh nghiệp. 
Bạn đang nói chuyện với người dùng về công ty sau:
${JSON.stringify(companyData.value, null, 2)}
Hãy trả lời câu hỏi của người dùng dựa trên thông tin trên. Trả lời ngắn gọn, súc tích, chuyên nghiệp và thân thiện.`
    
    let fullConversation = systemContext + '\n\n--- Lịch sử hội thoại ---\n'
    chatHistory.value.forEach(msg => {
      fullConversation += `${msg.role === 'user' ? 'Người dùng' : 'Bạn'}: ${msg.content}\n`
    })
    fullConversation += '\n(Hãy trả lời câu hỏi mới nhất của Người dùng ở trên)'

    const aiResponse = await fetch('/byteplus-api/api/v3/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'ep-20260926231634-p4kgv',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: fullConversation }
            ]
          }
        ]
      })
    })

    const aiData = await aiResponse.json()
    const messageOutput = aiData.output?.find((o: any) => o.type === 'message')
    
    isChatLoading.value = false // Tắt loading trước khi bắt đầu gõ
    
    if (messageOutput && messageOutput.content && messageOutput.content[0]) {
      const fullAnswer = messageOutput.content[0].text
      
      chatHistory.value.push({ role: 'assistant', content: '' })
      const lastIndex = chatHistory.value.length - 1
      
      let j = 0
      const typeInterval = setInterval(() => {
        chatHistory.value[lastIndex].content += fullAnswer.charAt(j)
        j++
        scrollToBottom()
        if (j >= fullAnswer.length) clearInterval(typeInterval)
      }, 15) // Tốc độ gõ: 15ms/kí tự
    } else {
      chatHistory.value.push({
        role: 'assistant',
        content: 'Xin lỗi, tôi đang gặp sự cố khi phân tích. Vui lòng thử lại.'
      })
    }
  } catch (err) {
    console.error(err)
    isChatLoading.value = false
    chatHistory.value.push({
      role: 'assistant',
      content: 'Đã có lỗi kết nối. Vui lòng thử lại.'
    })
  } finally {
    if (isChatLoading.value) isChatLoading.value = false
    scrollToBottom()
  }
}

const searchMST = async () => {
  if (!mstInput.value.trim() || isExtracting.value) {
    errorMsg.value = 'Vui lòng nhập Mã số thuế'
    return
  }

  isLoading.value = true
  errorMsg.value = ''
  companyData.value = null
  
  try {
    let basicName = ''
    let basicAddress = ''
    
    loadingStep.value = 'Đang tra cứu dữ liệu gốc từ cơ quan thuế...'
    const response = await fetch(`/mst-api/${mstInput.value.trim()}`)
    const data = await response.json()
    
    if (data.code === '00' && data.data) {
      basicName = data.data.name || ''
      basicAddress = data.data.address || ''
    } else {
      console.warn('Không tìm thấy thông tin gốc, chuyển sang AI tự suy luận')
    }

    loadingStep.value = 'AI đang tổng hợp và hoàn thiện thông tin...'
    
    const promptText = `Bạn là một chuyên gia dữ liệu doanh nghiệp Việt Nam xuất sắc.
Tôi có một Mã số thuế: "${mstInput.value}".
Dữ liệu cơ bản tôi tìm được:
- Tên công ty: ${basicName || 'Chưa rõ'}
- Địa chỉ: ${basicAddress || 'Chưa rõ'}

Nhiệm vụ của bạn: Hãy lục tìm trong toàn bộ kiến thức của bạn về công ty này và điền ĐẦY ĐỦ NHẤT CÓ THỂ vào 10 trường thông tin dưới đây. Hãy cố gắng suy luận và dự đoán các thông tin (ngành nghề, người đại diện, số điện thoại, ngày hoạt động...) nếu bạn có manh mối. Đừng để trống field nào nếu có thể!
BẮT BUỘC TRẢ VỀ CHUỖI JSON ĐÚNG ĐỊNH DẠNG SAU, KHÔNG CÓ MARKDOWN:
{
  "ten_cong_ty": "${basicName || 'Tên đầy đủ của công ty'}",
  "nhom_nganh": "Ngành nghề kinh doanh chính",
  "nguoi_dai_dien": "Tên người đại diện pháp luật",
  "ma_so_thue": "${mstInput.value}",
  "dia_chi": "${basicAddress || 'Địa chỉ thuế/địa chỉ trụ sở'}",
  "tinh_trang": "Tình trạng hoạt động",
  "dien_thoai": "Số điện thoại",
  "ngay_hoat_dong": "Ngày bắt đầu hoạt động",
  "quan_ly_boi": "Cơ quan thuế quản lý",
  "loai_hinh": "Loại hình doanh nghiệp"
}`

    const API_KEY = 'VxCgNvLTE.ChthcGlrZXktMjAyNjA5MjYyMjIwMzAtc3BxZjUQ-5_rmAsYAiChsbAtKhCfbVs3Y4ZNyaYEA0mgOVlR.5vf7PVVe5D3Q4mSB792sHun4PKv2KfynDAPmirc9K8MRLfh0VPFzQp84yny1A7t9brxZLjpO-FDR-TqCaS3o5QeZ'
    const aiResponse = await fetch('/byteplus-api/api/v3/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        model: 'ep-20260926231634-p4kgv',
        input: [
          {
            role: 'user',
            content: [
              { type: 'input_text', text: promptText }
            ]
          }
        ]
      })
    })

    const aiData = await aiResponse.json()
    console.log('AI Response:', aiData)
    
    if (aiData.error) {
      throw new Error(`API Error: ${aiData.error.message || JSON.stringify(aiData.error)}`)
    }
    
    // In some API formats, the message is in choices[0].message
    if (aiData.choices && aiData.choices[0] && aiData.choices[0].message) {
      let content = aiData.choices[0].message.content
      content = content.replace(/```json/g, '').replace(/```/g, '').trim()
      const parsedData = JSON.parse(content)
      companyData.value = parsedData
      
      if (parsedData.ma_so_thue && parsedData.ten_cong_ty) {
        saveToHistory(parsedData)
      }
      return
    }

    const messageOutput = aiData.output?.find((o: any) => o.type === 'message')
    
    if (messageOutput && messageOutput.content && messageOutput.content[0]) {
      let content = messageOutput.content[0].text
      // Xóa markdown nếu AI lỡ trả về
      content = content.replace(/```json/g, '').replace(/```/g, '').trim()
      
      const parsedData = JSON.parse(content)
      companyData.value = parsedData
      
      if (parsedData.ma_so_thue && parsedData.ten_cong_ty) {
        saveToHistory(parsedData)
      }
    } else {
      throw new Error('Định dạng phản hồi lạ: ' + JSON.stringify(aiData))
    }

  } catch (err: any) {
    console.error(err)
    errorMsg.value = err.message || 'Đã có lỗi xảy ra trong quá trình tra cứu.'
  } finally {
    isLoading.value = false
  }
}
</script>

<template>
  <main class="container">
    <div class="glass-panel">
      <h1 class="header-title">Tra Cứu Doanh Nghiệp (AI)</h1>
      <p class="subtitle">Kết hợp dữ liệu cơ quan Thuế và sức mạnh suy luận của AI</p>
      
      <div class="search-box-container">
        <!-- Image Preview Area -->
        <div v-if="imagePreview" class="image-preview-container">
          <img :src="imagePreview" alt="Preview" class="image-preview" />
          <button class="remove-image-btn" @click="clearImage" title="Xóa ảnh">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
          </button>
        </div>

        <div class="search-box">
          <div class="search-input-wrapper">
            <input 
              v-model="mstInput" 
              type="text" 
              placeholder="Mã số thuế, dán ảnh, ghi âm hoặc tải ảnh..." 
              class="mst-input"
              @keyup.enter="searchMST"
              @paste="handlePaste"
            />
            
            <!-- Hidden File Input for Camera/Gallery -->
            <input 
              type="file" 
              accept="image/*" 
              ref="fileInput" 
              style="display: none;" 
              @change="handleImageUpload" 
            />

            <!-- Camera Button -->
            <button 
              type="button" 
              class="search-icon-btn" 
              @click="triggerCamera"
              title="Chụp ảnh / Tải ảnh lên"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </button>

            <!-- Mic Button -->
            <button 
              type="button" 
              class="search-icon-btn mic-btn" 
              :class="{ 'recording': isRecording }"
              @click="toggleRecording"
              :title="isRecording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'"
            >
              <svg v-if="!isRecording" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="6" x="9" y="9" rx="1" ry="1"/><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            </button>
          </div>

          <button class="search-btn" @click="searchMST" :disabled="isLoading || isExtracting || !mstInput.trim()">
            <svg v-if="!isLoading" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
            <span v-if="isLoading" class="spinner"></span>
            <span v-if="!isLoading">Tìm Kiếm AI</span>
          </button>
        </div>
      </div>
      
      <p v-if="errorMsg" class="error-msg">{{ errorMsg }}</p>
      
      <div v-if="searchHistory.length > 0 && !companyData && !isLoading" class="history-section">
        <h3 class="history-title">Lịch sử tra cứu gần đây</h3>
        <div class="history-grid">
          <div 
            v-for="item in searchHistory" 
            :key="item.ma_so_thue" 
            class="history-card" 
            @click="loadFromHistory(item)"
          >
            <div class="history-mst">{{ item.ma_so_thue }}</div>
            <div class="history-name">{{ item.ten_cong_ty }}</div>
          </div>
        </div>
      </div>
      
      <div v-if="isLoading" class="loading-state">
        <div class="cube-loader">
          <div class="cube"></div>
          <div class="cube"></div>
          <div class="cube"></div>
          <div class="cube"></div>
        </div>
        <p class="loading-text">{{ loadingStep }}</p>
      </div>

      <Transition name="fade">
        <div v-if="companyData && !isLoading" class="result-card glass-panel">
          <div class="company-header">
            <h2>{{ companyData.ten_cong_ty }}</h2>
            <span class="status-badge" :class="{'active': companyData.tinh_trang.toLowerCase().includes('đang hoạt động')}">
              {{ companyData.tinh_trang }}
            </span>
          </div>

          <div class="info-grid">
            <div 
              v-for="f in fields" 
              :key="f.key" 
              class="info-item" 
              :class="{'full-width': f.fullWidth}"
            >
              <div class="item-header">
                <span class="label">{{ f.label }}</span>
                <button class="icon-btn" @click="copyText(companyData[f.key], f.key)" title="Sao chép">
                  <svg v-if="copiedField !== f.key" xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                  <svg v-else xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#34d399" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                </button>
              </div>
              <textarea v-if="f.type === 'textarea'" class="editable-value" :class="f.class" v-model="companyData[f.key]" rows="2"></textarea>
              <input v-else class="editable-value" :class="f.class" v-model="companyData[f.key]" />
            </div>
          </div>
          
          <div class="action-bar">
            <button class="chat-btn" @click="openChatModal">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              Phân tích & Hỏi đáp AI
            </button>
          </div>
        </div>
      </Transition>

    </div>
  </main>

  <!-- Chat Modal -->
  <Teleport to="body">
    <Transition name="modal-fade">
      <div v-if="showChatModal" class="modal-overlay" @click.self="showChatModal = false">
        <div class="modal-content">
          <div class="modal-header">
            <h3>Trợ lý Phân tích AI</h3>
            <button class="close-btn" @click="showChatModal = false">×</button>
          </div>
          
          <div class="chat-messages" ref="chatContainer">
            <div v-for="(msg, index) in chatHistory" :key="index" 
                 :class="['message-bubble', msg.role === 'user' ? 'user-msg' : 'ai-msg']">
              {{ msg.content }}
            </div>
            <div v-if="isChatLoading" class="message-bubble ai-msg loading-msg">
              <span class="dot"></span><span class="dot"></span><span class="dot"></span>
            </div>
          </div>
          
          <div class="chat-input-area">
            <input 
              v-model="chatInput" 
              type="text" 
              placeholder="Hỏi AI về rủi ro, ngành nghề..." 
              @keyup.enter="sendMessage"
            />
            <button @click="sendMessage" :disabled="isChatLoading || !chatInput.trim()">Gửi</button>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.container {
  max-width: 900px;
  margin: 0 auto;
  padding: 3rem 1rem;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 2.5rem;
  box-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
}

.header-title {
  font-size: 2.5rem;
  font-weight: 800;
  background: linear-gradient(to right, #60a5fa, #34d399);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  margin-bottom: 0.5rem;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: #94a3b8;
  margin-bottom: 2.5rem;
  font-size: 1.1rem;
}

.search-box-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-bottom: 2rem;
}

.search-box {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  padding: 0.5rem;
  padding-left: 1.2rem;
  transition: all 0.3s ease;
}

.search-input-wrapper {
  display: flex;
  align-items: center;
  flex-grow: 1;
  gap: 0.5rem;
  width: 100%;
}

.search-box:focus-within {
  border-color: #34d399;
  box-shadow: 0 0 0 4px rgba(52, 211, 153, 0.2);
}

.mst-input {
  flex-grow: 1;
  background: transparent;
  border: none;
  color: white;
  font-size: 1.1rem;
  font-family: inherit;
  outline: none;
  min-width: 0;
}

.search-icon-btn {
  background: transparent;
  border: none;
  color: #94a3b8;
  cursor: pointer;
  padding: 8px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.search-icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #34d399;
}

.mic-btn.recording {
  color: #ef4444;
  animation: pulse-red 1.5s infinite;
}

@keyframes pulse-red {
  0% { transform: scale(1); }
  50% { transform: scale(1.1); color: #f87171; }
  100% { transform: scale(1); }
}

.search-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 10px;
  padding: 0.8rem 1.5rem;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  transition: all 0.3s;
  white-space: nowrap;
}

.search-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 5px 15px rgba(16, 185, 129, 0.4);
}

.search-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

/* Image Preview Styles */
.image-preview-container {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid rgba(52, 211, 153, 0.5);
  background: rgba(0, 0, 0, 0.2);
}

.image-preview {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.remove-image-btn {
  position: absolute;
  top: 4px;
  right: 4px;
  background: rgba(0, 0, 0, 0.7);
  color: white;
  border: none;
  border-radius: 50%;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
  transition: background 0.2s;
}

.remove-image-btn:hover {
  background: #ef4444;
}

.error-msg {
  color: #ef4444;
  text-align: center;
  background: rgba(239, 68, 68, 0.1);
  padding: 1rem;
  border-radius: 8px;
}

/* Loading Animation */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 3rem 0;
  gap: 2rem;
}

.loading-text {
  color: #34d399;
  font-weight: 600;
  font-size: 1.2rem;
  animation: pulse 1.5s infinite;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 3px solid rgba(255,255,255,0.3);
  border-radius: 50%;
  border-top-color: white;
  animation: spin 1s ease-in-out infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

/* History Section */
.history-section {
  margin-top: 2rem;
}

.history-title {
  color: #94a3b8;
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 1.5rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 1rem;
}

.history-card {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.05);
  padding: 1.2rem;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
}

.history-card:hover {
  background: rgba(52, 211, 153, 0.1);
  border-color: rgba(52, 211, 153, 0.3);
  transform: translateY(-2px);
}

.history-mst {
  color: #60a5fa;
  font-weight: 700;
  font-size: 1.1rem;
  margin-bottom: 0.5rem;
}

.history-name {
  color: #cbd5e1;
  font-size: 0.9rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* Result Card */
.result-card {
  margin-top: 2rem;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.company-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 2rem;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.company-header h2 {
  font-size: 1.8rem;
  margin: 0;
  color: #f8fafc;
  font-weight: 700;
  max-width: 70%;
}

.status-badge {
  background: rgba(148, 163, 184, 0.2);
  color: #cbd5e1;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 600;
}

.status-badge.active {
  background: rgba(52, 211, 153, 0.2);
  color: #34d399;
  border: 1px solid rgba(52, 211, 153, 0.3);
}

.info-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 1.5rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  background: rgba(0, 0, 0, 0.2);
  padding: 1.2rem;
  border-radius: 12px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.info-item.full-width {
  grid-column: 1 / -1;
}

.label {
  font-size: 0.85rem;
  color: #94a3b8;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.2rem;
}

.icon-btn {
  background: none;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #34d399;
}

.editable-value {
  background: transparent;
  border: 1px dashed transparent;
  color: #f1f5f9;
  font-size: 1.1rem;
  font-weight: 500;
  line-height: 1.5;
  width: 100%;
  font-family: inherit;
  padding: 6px;
  margin-left: -6px;
  border-radius: 8px;
  transition: all 0.2s;
  resize: vertical;
}

.editable-value:hover {
  border-color: rgba(255, 255, 255, 0.2);
  background: rgba(0, 0, 0, 0.2);
}

.editable-value:focus {
  outline: none;
  border-color: #34d399;
  background: rgba(0, 0, 0, 0.4);
}

.editable-value.highlight {
  color: #60a5fa;
  font-weight: 700;
  font-size: 1.2rem;
}

/* Animations */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease, transform 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
  transform: translateY(20px);
}

/* Modal & Chat Styles */
.action-bar {
  margin-top: 2.5rem;
  display: flex;
  justify-content: center;
}

.chat-btn {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 1rem 2rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 0.8rem;
  transition: all 0.3s;
  box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
}

.chat-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 25px rgba(16, 185, 129, 0.5);
}

.modal-overlay {
  position: fixed;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(5px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  background: #1e293b;
  width: 95%;
  max-width: 600px;
  height: 80vh;
  border-radius: 20px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
}

.modal-header {
  padding: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: rgba(0, 0, 0, 0.2);
}

.modal-header h3 {
  margin: 0;
  color: #34d399;
  font-size: 1.2rem;
}

.close-btn {
  background: none;
  border: none;
  color: #94a3b8;
  font-size: 2rem;
  cursor: pointer;
  line-height: 1;
}

.close-btn:hover {
  color: white;
}

.chat-messages {
  flex-grow: 1;
  padding: 1.5rem;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.message-bubble {
  max-width: 85%;
  padding: 1rem 1.2rem;
  border-radius: 16px;
  line-height: 1.5;
  font-size: 1rem;
  white-space: pre-wrap;
}

.user-msg {
  align-self: flex-end;
  background: #059669;
  color: white;
  border-bottom-right-radius: 4px;
}

.ai-msg {
  align-self: flex-start;
  background: #334155;
  color: #f1f5f9;
  border-bottom-left-radius: 4px;
}

.chat-input-area {
  padding: 1.2rem;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  display: flex;
  gap: 0.8rem;
}

.chat-input-area input {
  flex-grow: 1;
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.1);
  padding: 1rem;
  border-radius: 12px;
  color: white;
  font-size: 1rem;
}

.chat-input-area input:focus {
  outline: none;
  border-color: #34d399;
}

.chat-input-area button {
  background: #10b981;
  color: white;
  border: none;
  padding: 0 1.5rem;
  border-radius: 12px;
  font-weight: bold;
  cursor: pointer;
  font-size: 1rem;
  transition: opacity 0.2s;
}

.chat-input-area button:hover:not(:disabled) {
  opacity: 0.9;
}

.chat-input-area button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-msg {
  display: flex;
  gap: 4px;
  align-items: center;
  padding: 1rem;
}

.dot {
  width: 8px; height: 8px;
  background: #94a3b8;
  border-radius: 50%;
  animation: bounce 1.4s infinite ease-in-out both;
}
.dot:nth-child(1) { animation-delay: -0.32s; }
.dot:nth-child(2) { animation-delay: -0.16s; }

@keyframes bounce {
  0%, 80%, 100% { transform: scale(0); }
  40% { transform: scale(1); }
}

.modal-fade-enter-active,
.modal-fade-leave-active {
  transition: opacity 0.3s;
}
.modal-fade-enter-from,
.modal-fade-leave-to {
  opacity: 0;
}

/* Responsive Design for Mobile */
@media (max-width: 768px) {
  .container {
    padding: 1.5rem 1rem;
  }
  
  .glass-panel {
    padding: 1.5rem;
  }

  .header-title {
    font-size: 1.8rem;
  }

  .subtitle {
    font-size: 0.95rem;
    margin-bottom: 1.5rem;
  }

  .search-box {
    flex-direction: column;
    gap: 0.8rem;
  }

  .search-btn {
    width: 100%;
    justify-content: center;
    padding: 1rem;
  }

  .company-header {
    flex-direction: column;
    gap: 1rem;
    align-items: flex-start;
  }
  
  .company-header h2 {
    max-width: 100%;
    font-size: 1.4rem;
  }

  .info-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }

  .chat-btn {
    width: 100%;
    justify-content: center;
  }

  .modal-content {
    width: 100% !important;
    max-width: 100% !important;
    height: 100vh !important;
    height: 100dvh !important;
    border-radius: 0 !important;
    border: none !important;
    margin: 0 !important;
  }
  
  .chat-messages {
    padding: 1rem;
  }

  .message-bubble {
    max-width: 90%;
    font-size: 0.95rem;
    padding: 0.8rem 1rem;
  }

  .chat-input-area {
    padding: 1rem;
  }
  
  .chat-input-area button {
    padding: 0 1rem;
  }
}
</style>
