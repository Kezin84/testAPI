const API_KEY = 'VxCgNvLTE.ChthcGlrZXktMjAyNjA5MjYyMjIwMzAtc3BxZjUQ-5_rmAsYAiChsbAtKhCfbVs3Y4ZNyaYEA0mgOVlR.5vf7PVVe5D3Q4mSB792sHun4PKv2KfynDAPmirc9K8MRLfh0VPFzQp84yny1A7t9brxZLjpO-FDR-TqCaS3o5QeZ'

async function testImage() {
  const dummyBase64 = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";
  
  const res = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'ep-20260926231634-p4kgv',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'What is this image?' },
            { type: 'input_image', image_url: dummyBase64 }
          ]
        }
      ]
    })
  })
  console.log("With type input_image and string:", await res.text())
}
testImage()
