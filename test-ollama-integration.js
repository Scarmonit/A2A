// Quick test script for Ollama integration
// Run with: node test-ollama-integration.js

const OLLAMA_URL = process.env.LOCAL_LLM_URL || 'http://localhost:11434';

async function testOllamaConnection() {
  console.log('🦙 Testing Ollama integration...\n');
  
  try {
    // Test 1: Check if Ollama is running
    console.log('1. Testing Ollama connection...');
    const versionResponse = await fetch(`${OLLAMA_URL}/api/version`);
    if (!versionResponse.ok) {
      throw new Error('Ollama not responding');
    }
    const version = await versionResponse.json();
    console.log(`✅ Ollama is running (version: ${version.version || 'unknown'})`);

    // Test 2: List available models
    console.log('\n2. Checking available models...');
    const modelsResponse = await fetch(`${OLLAMA_URL}/api/tags`);
    const models = await modelsResponse.json();
    
    if (!models.models || models.models.length === 0) {
      console.log('⚠️  No models found. Please pull some models first:');
      console.log('   ollama pull llama2:7b-chat');
      console.log('   ollama pull codellama:7b-code');
      return;
    }
    
    console.log(`✅ Found ${models.models.length} models:`);
    models.models.forEach(model => {
      console.log(`   - ${model.name} (${(model.size / 1024 / 1024 / 1024).toFixed(1)}GB)`);
    });

    // Test 3: Generate a response
    const testModel = models.models[0].name;
    console.log(`\n3. Testing generation with ${testModel}...`);
    
    const generateResponse = await fetch(`${OLLAMA_URL}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: testModel,
        prompt: 'Hello! Please respond with exactly "AI integration test successful"',
        stream: false
      })
    });
    
    if (!generateResponse.ok) {
      throw new Error(`Generation failed: ${generateResponse.status}`);
    }
    
    const result = await generateResponse.json();
    console.log(`✅ Generation successful!`);
    console.log(`Response: ${result.response}`);

    // Test 4: Performance info
    console.log(`\n4. Performance metrics:`);
    console.log(`   - Total duration: ${(result.total_duration / 1000000000).toFixed(2)}s`);
    console.log(`   - Tokens per second: ${(result.eval_count / (result.eval_duration / 1000000000)).toFixed(1)} tok/s`);

    console.log('\n🎉 All tests passed! Your Ollama integration is ready.');
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    console.log('\n🛠️  Troubleshooting:');
    console.log('1. Make sure Ollama is installed and running');
    console.log('2. Check if Ollama service is started: ollama serve');
    console.log('3. Pull some models: ollama pull llama2:7b-chat');
    console.log('4. Verify Ollama URL:', OLLAMA_URL);
  }
}

async function installRecommendedModels() {
  console.log('\n📦 Want to install recommended models?');
  console.log('Run these commands:');
  console.log('');
  console.log('# Fast & lightweight (good for 8GB RAM)');
  console.log('ollama pull phi3:mini              # 2.3GB');
  console.log('ollama pull llama2:7b-chat         # 3.8GB');
  console.log('ollama pull codellama:7b-code      # 3.8GB');
  console.log('');
  console.log('# High quality (needs 16GB+ RAM)');  
  console.log('ollama pull llama2:13b-chat        # 7.4GB');
  console.log('ollama pull codellama:13b-code     # 7.4GB');
  console.log('');
}

// Run the test
testOllamaConnection().then(() => {
  installRecommendedModels();
});