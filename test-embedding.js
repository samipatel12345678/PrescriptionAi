import fetch from 'node-fetch';

async function testEmbeddingResponse() {
  try {
    const response = await fetch('http://localhost:5000/api/documents/embedding-response', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: "What is the main topic?",
        userId: "test",
        limit: 5
      })
    });

    const data = await response.json();
    console.log('Response:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Error:', error.message);
  }
}

testEmbeddingResponse(); 