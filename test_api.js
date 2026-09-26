const API_KEY = 'VxCgNvLTE.ChthcGlrZXktMjAyNjA5MjYyMjIwMzAtc3BxZjUQ-5_rmAsYAiChsbAtKhCfbVs3Y4ZNyaYEA0mgOVlR.5vf7PVVe5D3Q4mSB792sHun4PKv2KfynDAPmirc9K8MRLfh0VPFzQp84yny1A7t9brxZLjpO-FDR-TqCaS3o5QeZ'

async function test() {
  const res = await fetch('https://ark.ap-southeast.bytepluses.com/api/v3/responses', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
    body: JSON.stringify({
      model: 'deepseek-v4-pro-ga-260813',
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: 'Hello' }
          ]
        }
      ]
    })
  })
  console.log(JSON.stringify(await res.json(), null, 2))
}
test()
