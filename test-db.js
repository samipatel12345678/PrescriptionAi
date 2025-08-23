import { supabase } from './SupabaseClient.js';

async function testDatabase() {
  try {
    console.log('Testing database connection...');
    
    // Test 1: Check if we can connect
    const { data, error } = await supabase
      .from('document_embeddings')
      .select('*')
      .limit(1);
    
    if (error) {
      console.error('Database error:', error);
      return;
    }
    
    console.log('Database connection successful!');
    console.log('Number of embeddings found:', data.length);
    
    if (data.length > 0) {
      console.log('Sample embedding:', {
        document_id: data[0].document_id,
        user_id: data[0].user_id,
        text_preview: data[0].text?.slice(0, 50) + '...'
      });
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testDatabase(); 