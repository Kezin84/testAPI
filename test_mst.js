async function test() {
  const mst = '0101243150';
  const urls = [
    `https://thongtindoanhnghiep.co/api/company/${mst}`,
    `https://api.2c.com.vn/ho-so-cong-ty?mst=${mst}`
  ];
  
  for (const url of urls) {
    try {
      console.log(`Testing ${url}...`);
      const res = await Promise.race([
        fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }),
        new Promise((_, r) => setTimeout(() => r(new Error('Timeout')), 5000))
      ]);
      console.log(`Status: ${res.status}`);
      const data = await res.text();
      console.log(`Data: ${data.substring(0, 200)}...\n`);
    } catch (err) {
      console.log(`Error: ${err.message}\n`);
    }
  }
}

test();
