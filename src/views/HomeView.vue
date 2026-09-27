<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'

interface Task {
  id: string
  assignee: string
  customer: string
  title: string
  note: string
  time: string
  completed: boolean
}

const tasks = ref<Task[]>([])
const assignee = ref('Tôi')
const customer = ref('')
const title = ref('')
const note = ref('')
const time = ref('')

const smartInput = ref('')
const isRecording = ref(false)
const isProcessing = ref(false)
let recognition: any = null

const showLoadingModal = ref(false)
const loadingStatus = ref<'loading' | 'success' | 'error'>('loading')
const loadingMessage = ref('Đang phân tích dữ liệu...')

const fileInput = ref<HTMLInputElement | null>(null)
const imagePreview = ref<string | null>(null)
const imageBase64 = ref<string | null>(null)

// Load from local storage
onMounted(() => {
  const saved = localStorage.getItem('tasks')
  if (saved) {
    tasks.value = JSON.parse(saved)
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
          smartInput.value += (smartInput.value ? ' ' : '') + finalTranscript
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

// Save to local storage on change
watch(tasks, (newVal) => {
  localStorage.setItem('tasks', JSON.stringify(newVal))
}, { deep: true })

const formatDateTime = (dateStr: string) => {
  if (!dateStr) return ''
  const date = new Date(dateStr)
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const year = date.getFullYear()
  return `${hours}:${minutes} ${day}/${month}/${year}`
}

const addTask = () => {
  if (!title.value.trim()) return
  
  tasks.value.unshift({
    id: crypto.randomUUID(),
    assignee: assignee.value,
    customer: customer.value,
    title: title.value,
    note: note.value,
    time: time.value,
    completed: false
  })
  
  assignee.value = 'Tôi'
  customer.value = ''
  title.value = ''
  note.value = ''
  time.value = ''
}

const deleteTask = (id: string) => {
  tasks.value = tasks.value.filter(t => t.id !== id)
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

const triggerCamera = () => {
  if (fileInput.value) {
    fileInput.value.click()
  }
}

const handleImageUpload = (event: Event) => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files.length > 0) {
    const file = target.files[0]
    
    // Create an object URL for fast preview
    imagePreview.value = URL.createObjectURL(file)
    
    // Convert to base64 for the API
    const reader = new FileReader()
    reader.onload = (e) => {
      if (e.target && typeof e.target.result === 'string') {
        imageBase64.value = e.target.result
      }
    }
    reader.readAsDataURL(file)
  }
  // Reset input so the same file can be selected again if needed
  target.value = ''
}

const clearImage = () => {
  if (imagePreview.value) {
    URL.revokeObjectURL(imagePreview.value)
  }
  imagePreview.value = null
  imageBase64.value = null
}

const processAI = async () => {
  if (!smartInput.value.trim() && !imageBase64.value) return
  
  isProcessing.value = true
  showLoadingModal.value = true
  loadingStatus.value = 'loading'
  loadingMessage.value = 'AI đang đọc và phân tích...'

  try {
    const promptText = `Bạn là trợ lý ảo giúp trích xuất thông tin công việc. Hôm nay là ${new Date().toLocaleString('vi-VN')}.
Hãy trích xuất thông tin từ đoạn văn bản và/hoặc hình ảnh đính kèm sau đây và trả về DUY NHẤT một chuỗi định dạng JSON chuẩn xác, không có markdown (không bao bọc bởi \`\`\`json).
Định dạng cần trả về:
{
  "assignee": "Tên người thực hiện công việc (nếu có nói đến, ngược lại để chuỗi rỗng)",
  "customer": "Tên khách hàng hoặc đối tác liên quan (nếu có, ngược lại để chuỗi rỗng)",
  "title": "Tên công việc ngắn gọn",
  "note": "Ghi chú chi tiết nếu có, ngược lại là chuỗi rỗng",
  "time": "Thời gian định dạng chuẩn YYYY-MM-DDTHH:mm. BẮT BUỘC phải đúng định dạng này (VD: 2026-09-27T15:30). Nếu người dùng chỉ nói ngày (ví dụ: ngày mai) mà không nói giờ, hãy tự động lấy giờ là 09:00. Nếu không có bất kỳ thông tin thời gian nào, hãy để chuỗi rỗng."
}
Văn bản bổ sung: "${smartInput.value}"`

    const contentArray: any[] = [
      { type: 'input_text', text: promptText }
    ]
    
    // Nếu có hình ảnh, thêm vào mảng nội dung
    if (imageBase64.value) {
      contentArray.push({
        type: 'input_image',
        image_url: imageBase64.value
      })
    }

    const API_KEY = 'VxCgNvLTE.ChthcGlrZXktMjAyNjA5MjYyMjIwMzAtc3BxZjUQ-5_rmAsYAiChsbAtKhCfbVs3Y4ZNyaYEA0mgOVlR.5vf7PVVe5D3Q4mSB792sHun4PKv2KfynDAPmirc9K8MRLfh0VPFzQp84yny1A7t9brxZLjpO-FDR-TqCaS3o5QeZ'
    const response = await fetch('/byteplus-api/api/v3/responses', {
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
            content: contentArray
          }
        ]
      })
    })

    const data = await response.json()
    const messageOutput = data.output?.find((o: any) => o.type === 'message')
    
    if (messageOutput && messageOutput.content && messageOutput.content[0]) {
      let content = messageOutput.content[0].text
      content = content.replace(/```json/g, '').replace(/```/g, '').trim()
      
      try {
        const parsed = JSON.parse(content)
        
        if (!parsed.title && !parsed.time && !parsed.note && !parsed.assignee && !parsed.customer) {
          loadingStatus.value = 'error'
          loadingMessage.value = 'Không tìm thấy thông tin công việc nào!'
          setTimeout(() => { showLoadingModal.value = false }, 3000)
          return
        }

        assignee.value = parsed.assignee || 'Tôi'
        if (parsed.customer) customer.value = parsed.customer
        if (parsed.title) title.value = parsed.title
        if (parsed.note) note.value = parsed.note
        if (parsed.time) time.value = parsed.time
        smartInput.value = '' // clear after success
        clearImage() // Xóa ảnh sau khi xử lý thành công
        
        loadingStatus.value = 'success'
        loadingMessage.value = 'Trích xuất thành công!'
        setTimeout(() => {
          showLoadingModal.value = false
        }, 1500)

      } catch (e) {
        loadingStatus.value = 'error'
        loadingMessage.value = 'AI trả về định dạng không chuẩn'
        setTimeout(() => { showLoadingModal.value = false }, 3000)
        console.error('Parse error:', content)
      }
    } else {
      let errorMessage = 'Lỗi từ API AI'
      if (data.error && data.error.message) {
        errorMessage = `Lỗi API: ${data.error.message}`
      }
      loadingStatus.value = 'error'
      loadingMessage.value = errorMessage
      setTimeout(() => { showLoadingModal.value = false }, 4000)
      console.error(data)
    }
  } catch (error) {
    console.error(error)
    loadingStatus.value = 'error'
    loadingMessage.value = 'Không thể kết nối đến AI'
    setTimeout(() => { showLoadingModal.value = false }, 3000)
  } finally {
    isProcessing.value = false
  }
}
</script>

<template>
  <main class="container">
    <div class="glass-panel">
      <h1 class="header-title">Quản Lý Công Việc</h1>
      <p class="subtitle">Sắp xếp công việc hiệu quả và đẹp mắt</p>
      
      <!-- Smart Input Section -->
      <div class="smart-input-section">
        <div class="smart-header">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="ai-icon"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
          Thêm Nhanh Bằng AI
        </div>
        <div class="smart-input-container">
          <!-- Image Preview Area -->
          <div v-if="imagePreview" class="image-preview-container">
            <img :src="imagePreview" alt="Preview" class="image-preview" />
            <button class="remove-image-btn" @click="clearImage" title="Xóa ảnh">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>

          <textarea 
            v-model="smartInput" 
            placeholder="Gõ nhanh, ghi âm hoặc chụp ảnh hóa đơn/sổ tay..."
            rows="2"
            class="smart-textarea"
          ></textarea>
          
          <div class="smart-actions">
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
              class="icon-btn" 
              @click="triggerCamera"
              title="Chụp ảnh / Tải ảnh lên"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/></svg>
            </button>

            <!-- Mic Button -->
            <button 
              type="button" 
              class="icon-btn mic-btn" 
              :class="{ 'recording': isRecording }"
              @click="toggleRecording"
              :title="isRecording ? 'Dừng ghi âm' : 'Bắt đầu ghi âm'"
            >
              <svg v-if="!isRecording" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
              <svg v-else xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="6" height="6" x="9" y="9" rx="1" ry="1"/><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>
            </button>
            
            <button 
              type="button" 
              class="ai-btn" 
              @click="processAI"
              :disabled="isProcessing || (!smartInput.trim() && !imageBase64)"
            >
              <span v-if="!isProcessing">Trích Xuất AI ✨</span>
              <span v-else class="loading-dots">Đang xử lý</span>
            </button>
          </div>
        </div>
      </div>
      <div class="divider"></div>

      <form @submit.prevent="addTask" class="task-form">
        <div class="form-row">
          <div class="input-group">
            <label for="assignee">Người thực hiện</label>
            <input id="assignee" v-model="assignee" type="text" placeholder="Ví dụ: Nam, Lan..." />
          </div>

          <div class="input-group">
            <label for="customer">Khách hàng</label>
            <input id="customer" v-model="customer" type="text" placeholder="Ví dụ: Anh Ba, Cty X..." />
          </div>
        </div>

        <div class="input-group">
          <label for="title">Tên công việc</label>
          <input id="title" v-model="title" type="text" placeholder="Ví dụ: Họp nhóm lúc 9h sáng..." required />
        </div>
        
        <div class="input-group">
          <label for="note">Ghi chú</label>
          <textarea id="note" v-model="note" placeholder="Nhập chi tiết về công việc của bạn..." rows="3"></textarea>
        </div>
        
        <div class="input-group">
          <label for="time">Thời gian</label>
          <input id="time" v-model="time" type="datetime-local" />
        </div>
        
        <button type="submit" class="submit-btn">
          Thêm Công Việc
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </form>
    </div>

    <div class="tasks-list">
      <TransitionGroup name="list">
        <div v-for="task in tasks" :key="task.id" class="task-card glass-panel" :class="{ 'completed': task.completed }">
          <div class="task-content">
            <div class="task-header">
              <h3 class="task-title">{{ task.title }}</h3>
            </div>
            
            <div class="task-meta-tags" v-if="task.assignee || task.customer">
              <div v-if="task.assignee" class="task-assignee">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                {{ task.assignee }}
              </div>
              <div v-if="task.customer" class="task-customer">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M22 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                {{ task.customer }}
              </div>
            </div>
            
            <p v-if="task.note" class="task-note">{{ task.note }}</p>
            
            <div v-if="task.time" class="task-time">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
              {{ formatDateTime(task.time) }}
            </div>
          </div>
          
          <button @click="deleteTask(task.id)" class="delete-btn" aria-label="Xóa">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
          </button>
        </div>
      </TransitionGroup>
      
      <div v-if="tasks.length === 0" class="empty-state">
        <div class="empty-icon">✨</div>
        <p>Chưa có công việc nào. Hãy thêm một công việc mới!</p>
      </div>
    </div>

    <!-- Loading Modal -->
    <Transition name="fade">
      <div v-if="showLoadingModal" class="modal-overlay">
        <div class="modal-content glass-panel">
          
          <div v-if="loadingStatus === 'loading'" class="spinner-container">
            <div class="loading-spinner"></div>
          </div>
          
          <div v-if="loadingStatus === 'success'" class="success-animation">
            <svg class="checkmark" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
              <path class="checkmark-check" fill="none" d="M14.1 27.2l7.1 7.2 16.7-16.8"/>
            </svg>
          </div>

          <div v-if="loadingStatus === 'error'" class="error-animation">
            <svg class="cross" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 52 52">
              <circle class="cross-circle" cx="26" cy="26" r="25" fill="none"/>
              <path class="cross-path" fill="none" d="M16 16 36 36 M36 16 16 36"/>
            </svg>
          </div>

          <p class="modal-text" :class="loadingStatus">{{ loadingMessage }}</p>
        </div>
      </div>
    </Transition>
  </main>
</template>

<style scoped>
.container {
  max-width: 800px;
  margin: 0 auto;
  padding: 3rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 20px;
  padding: 2rem;
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
  margin-bottom: 2rem;
}

/* Smart Input Styles */
.smart-input-section {
  background: rgba(34, 197, 94, 0.1);
  border: 1px solid rgba(34, 197, 94, 0.3);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 2rem;
}

.smart-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
  color: #86efac;
  margin-bottom: 1rem;
  font-size: 1.05rem;
}

.ai-icon {
  color: #4ade80;
}

.smart-input-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.image-preview-container {
  position: relative;
  width: 120px;
  height: 120px;
  border-radius: 12px;
  overflow: hidden;
  border: 2px solid rgba(34, 197, 94, 0.5);
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

.smart-textarea {
  background: rgba(0, 0, 0, 0.3);
  border: 1px solid rgba(34, 197, 94, 0.4);
  border-radius: 12px;
  padding: 1rem;
  color: white;
  font-family: inherit;
  font-size: 1rem;
  resize: vertical;
  min-height: 80px;
}

.smart-textarea:focus {
  outline: none;
  border-color: #4ade80;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
}

.smart-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
}

.icon-btn {
  background: rgba(255, 255, 255, 0.1);
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: white;
  border-radius: 12px;
  width: 48px;
  height: 48px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.3s;
}

.icon-btn:hover {
  background: rgba(255, 255, 255, 0.2);
}

.mic-btn.recording {
  background: rgba(239, 68, 68, 0.2);
  border-color: #ef4444;
  color: #ef4444;
  animation: pulse 1.5s infinite;
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
  70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
  100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
}

.ai-btn {
  background: rgba(34, 197, 94, 0.8);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 0 1.5rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
}

.ai-btn:hover:not(:disabled) {
  background: #22c55e;
  transform: translateY(-2px);
}

.ai-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.loading-dots:after {
  content: '.';
  animation: dots 1.5s steps(5, end) infinite;
}

@keyframes dots {
  0%, 20% { color: rgba(0,0,0,0); text-shadow: .25em 0 0 rgba(0,0,0,0), .5em 0 0 rgba(0,0,0,0); }
  40% { color: white; text-shadow: .25em 0 0 rgba(0,0,0,0), .5em 0 0 rgba(0,0,0,0); }
  60% { text-shadow: .25em 0 0 white, .5em 0 0 rgba(0,0,0,0); }
  80%, 100% { text-shadow: .25em 0 0 white, .5em 0 0 white; }
}

.divider {
  height: 1px;
  background: rgba(255, 255, 255, 0.1);
  margin-bottom: 2rem;
}

.task-form {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.form-row {
  display: grid;
  grid-template-columns: 1fr;
  gap: 1.5rem;
}

@media (min-width: 600px) {
  .form-row {
    grid-template-columns: 1fr 1fr;
    gap: 1rem;
  }
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

label {
  font-size: 0.9rem;
  font-weight: 600;
  color: #cbd5e1;
  margin-left: 0.5rem;
}

input[type="text"],
input[type="datetime-local"],
textarea {
  background: rgba(0, 0, 0, 0.2);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 12px;
  padding: 1rem;
  color: white;
  font-family: inherit;
  font-size: 1rem;
  transition: all 0.3s ease;
}

input[type="datetime-local"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor: pointer;
}

input:focus,
textarea:focus {
  outline: none;
  border-color: #22c55e;
  box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.3);
}

textarea {
  resize: vertical;
  min-height: 100px;
}

.submit-btn {
  background: linear-gradient(135deg, #10b981 0%, #22c55e 100%);
  color: white;
  border: none;
  border-radius: 12px;
  padding: 1rem;
  font-size: 1.1rem;
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  transition: transform 0.2s, box-shadow 0.2s;
  margin-top: 0.5rem;
}

.submit-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 20px rgba(34, 197, 94, 0.4);
}

.tasks-list {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  position: relative;
}

.task-card {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  transition: all 0.3s ease;
}

.task-card:hover {
  transform: scale(1.02);
  background: rgba(255, 255, 255, 0.08);
}

.task-card.completed {
  opacity: 0.6;
}

.task-card.completed .task-title,
.task-card.completed .task-note,
.task-card.completed .task-time {
  text-decoration: line-through;
}

.task-content {
  flex-grow: 1;
  min-width: 0; /* Prevents flex items from overflowing */
}

.task-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.5rem;
}

.task-title {
  font-size: 1.25rem;
  font-weight: 600;
  margin: 0;
  color: #f8fafc;
  word-break: break-word; /* Prevents long titles from overflowing */
}

.task-note {
  color: #cbd5e1;
  font-size: 0.95rem;
  margin-left: 2.5rem;
  white-space: pre-wrap;
  word-break: break-word; /* Prevents long notes from overflowing */
  margin-bottom: 0.5rem;
  line-height: 1.5;
}

.task-meta-tags {
  display: flex;
  gap: 1.5rem;
  margin-left: 2.5rem;
  margin-bottom: 0.5rem;
  flex-wrap: wrap;
}

.task-assignee {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #4ade80;
  font-size: 0.9rem;
  font-weight: 500;
}

.task-customer {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #fb923c;
  font-size: 0.9rem;
  font-weight: 500;
}

.task-time {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  color: #94a3b8;
  font-size: 0.85rem;
  margin-left: 2.5rem;
  background: rgba(0, 0, 0, 0.3);
  padding: 0.35rem 0.75rem;
  border-radius: 1rem;
  width: fit-content;
}

.delete-btn {
  background: transparent;
  border: none;
  color: #ef4444;
  cursor: pointer;
  padding: 0.5rem;
  border-radius: 8px;
  transition: background 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn:hover {
  background: rgba(239, 68, 68, 0.1);
}

/* Custom Checkbox */
.checkbox-container {
  display: block;
  position: relative;
  width: 24px;
  height: 24px;
  cursor: pointer;
  user-select: none;
}

.checkbox-container input {
  position: absolute;
  opacity: 0;
  cursor: pointer;
  height: 0;
  width: 0;
}

.checkmark {
  position: absolute;
  top: 0;
  left: 0;
  height: 24px;
  width: 24px;
  background-color: rgba(0, 0, 0, 0.3);
  border: 2px solid rgba(255, 255, 255, 0.3);
  border-radius: 6px;
  transition: all 0.2s;
}

.checkbox-container:hover input ~ .checkmark {
  background-color: rgba(255, 255, 255, 0.1);
}

.checkbox-container input:checked ~ .checkmark {
  background-color: #22c55e;
  border-color: #22c55e;
}

.checkmark:after {
  content: "";
  position: absolute;
  display: none;
}

.checkbox-container input:checked ~ .checkmark:after {
  display: block;
}

.checkbox-container .checkmark:after {
  left: 7px;
  top: 3px;
  width: 6px;
  height: 12px;
  border: solid white;
  border-width: 0 2px 2px 0;
  transform: rotate(45deg);
}

/* Vue Transitions */
.list-move,
.list-enter-active,
.list-leave-active {
  transition: all 0.5s ease;
}

.list-enter-from,
.list-leave-to {
  opacity: 0;
  transform: translateX(-30px);
}

.list-leave-active {
  position: absolute;
}

.empty-state {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 20px;
  border: 1px dashed rgba(255, 255, 255, 0.1);
  margin-top: 2rem;
}

.empty-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  opacity: 0.5;
}

/* Modal Overlay */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background: rgba(0, 0, 0, 0.6);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.modal-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 3rem;
  width: 320px;
  text-align: center;
  animation: modalPop 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
}

@keyframes modalPop {
  0% { transform: scale(0.8); opacity: 0; }
  100% { transform: scale(1); opacity: 1; }
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.3s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* Loading Spinner */
.spinner-container {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 1.5rem;
}

.loading-spinner {
  width: 50px;
  height: 50px;
  border: 4px solid rgba(34, 197, 94, 0.2);
  border-top-color: #4ade80;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Success Checkmark */
.success-animation {
  margin-bottom: 1.5rem;
}

.checkmark {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: block;
  stroke-width: 3;
  stroke: #4ade80;
  stroke-miterlimit: 10;
  box-shadow: inset 0px 0px 0px #4ade80;
  animation: fill .4s ease-in-out .4s forwards, scale .3s ease-in-out .9s both;
}

.checkmark-circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-width: 3;
  stroke-miterlimit: 10;
  stroke: #4ade80;
  fill: none;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.checkmark-check {
  transform-origin: 50% 50%;
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

/* Error Cross */
.error-animation {
  margin-bottom: 1.5rem;
}

.cross {
  width: 60px;
  height: 60px;
  border-radius: 50%;
  display: block;
  stroke-width: 3;
  stroke: #f87171;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.cross-circle {
  stroke-dasharray: 166;
  stroke-dashoffset: 166;
  stroke-width: 3;
  stroke: #f87171;
  fill: none;
  animation: stroke 0.6s cubic-bezier(0.65, 0, 0.45, 1) forwards;
}

.cross-path {
  stroke-dasharray: 48;
  stroke-dashoffset: 48;
  animation: stroke 0.3s cubic-bezier(0.65, 0, 0.45, 1) 0.8s forwards;
}

@keyframes stroke {
  100% { stroke-dashoffset: 0; }
}
@keyframes scale {
  0%, 100% { transform: none; }
  50% { transform: scale3d(1.1, 1.1, 1); }
}
@keyframes fill {
  100% { box-shadow: inset 0px 0px 0px 30px rgba(74, 222, 128, 0.1); }
}

.modal-text {
  font-size: 1.1rem;
  font-weight: 600;
  margin: 0;
  color: white;
  line-height: 1.5;
}

.modal-text.success { color: #4ade80; }
.modal-text.error { color: #f87171; }
</style>
