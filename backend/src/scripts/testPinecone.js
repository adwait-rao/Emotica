import dotenv from 'dotenv';
dotenv.config();

import { 
  createStandardPineconeIndex, 
  checkIndexStatus,
  upsertTextWithEmbedding, 
  queryWithText 
} from '../services/pineconeService.js';

const run = async () => {
  try {
    console.log('🚀 Starting Pinecone test...\n');
    
    // Step 1: Create or check index
    console.log('📋 Step 1: Creating/checking index...');
    await createStandardPineconeIndex();
    
    // Step 2: Check index status
    console.log('\n📋 Step 2: Checking index status...');
    await checkIndexStatus();
    
    // Step 3: Test embedding generation
    console.log('\n📋 Step 3: Testing embedding generation...');
    const testText = 'Hello Pinecone world!';
    
    // Step 4: Upsert sample data
    console.log('\n📋 Step 4: Upserting sample data...');
    await upsertTextWithEmbedding('1', 'Hello Pinecone world!', { category: 'greeting' });
    await upsertTextWithEmbedding('2', 'Good morning everyone!', { category: 'greeting' });
    await upsertTextWithEmbedding('3', 'How to use vector databases effectively', { category: 'tutorial' });
    await upsertTextWithEmbedding('4', 'hello pineapple', { category: 'greeting' });
    
    // Step 5: Wait for indexing
    console.log('\n📋 Step 5: Waiting for data to be indexed...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    // Step 6: Query with text
    console.log('\n📋 Step 6: Querying with text...');
    const results = await queryWithText('how to use', 4);
    
    console.log('\n🔍 Query Results:');
    console.log('================');
    if (results.matches && results.matches.length > 0) {
      results.matches.forEach((match, index) => {
        console.log(`${index + 1}. Score: ${match.score.toFixed(4)}`);
        console.log(`   Text: ${match.metadata?.chunk_text || 'No text'}`);
        console.log(`   Category: ${match.metadata?.category || 'No category'}`);
        console.log('');
      });
    } else {
      console.log('No matches found. This might be normal if the index was just created.');
    }
    
    console.log('✅ Test completed successfully!');
    
  } catch (err) {
    console.error('\n❌ Pinecone test failed:');
    console.error('Error:', err.message);
    
    // More detailed error info for debugging
    if (err.stack) {
      console.error('\nStack trace:');
      console.error(err.stack);
    }
    
    // Common solutions
    console.error('\n💡 Possible solutions:');
    console.error('1. Check your PINECONE_API_KEY in .env file');
    console.error('2. Verify your Pinecone account has access to embedding models');
    console.error('3. Make sure you have sufficient quota/credits');
    console.error('4. Try a different embedding model like "multilingual-e5-large"');
  }
};

// Add some environment checks
console.log('🔧 Environment Check:');
console.log('- API Key present:', !!process.env.PINECONE_API_KEY);
console.log('- Index Name:', process.env.PINECONE_INDEX_NAME || 'good-in-hood');
console.log('');

run();