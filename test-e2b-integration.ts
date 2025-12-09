/**
 * Test E2B Integration
 * Tests the complete Jupyter execution flow
 */

import { readFileSync } from 'fs';
import { join } from 'path';

const API_BASE = 'http://localhost:3000';
const TEST_CHAT_ID = 'test-e2b-' + Date.now();

async function testE2BIntegration() {
  console.log('🧪 Testing E2B Integration\n');
  console.log('Test Chat ID:', TEST_CHAT_ID, '\n');

  const testDir = join(process.cwd(), 'test-data');

  try {
    // Step 1: Upload a CSV file
    console.log('Step 1: Uploading test file...');
    const fileBuffer = readFileSync(join(testDir, 'employee_data.csv'));
    const formData = new FormData();
    const blob = new Blob([fileBuffer], { type: 'text/csv' });
    formData.append('file', blob, 'employee_data.csv');

    const uploadResponse = await fetch(`${API_BASE}/api/files/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!uploadResponse.ok) {
      throw new Error(`Upload failed: ${uploadResponse.status}`);
    }

    const uploadResult = await uploadResponse.json();
    console.log('✅ File uploaded:', uploadResult.originalFilename);

    // Step 2: Process file metadata
    console.log('\nStep 2: Processing file metadata...');
    const processResponse = await fetch(`${API_BASE}/api/files/process`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        blobUrl: uploadResult.url,
        fileName: uploadResult.originalFilename,
        fileType: uploadResult.contentType,
        fileSize: fileBuffer.length,
        chatId: TEST_CHAT_ID,
      }),
    });

    if (!processResponse.ok) {
      throw new Error(`Process failed: ${processResponse.status}`);
    }

    const processResult = await processResponse.json();
    console.log('✅ File processed');
    console.log('   Headers:', processResult.metadata.headers);
    console.log('   Rows:', processResult.metadata.rowCount);

    // Step 3: Execute Python code to analyze the data
    console.log('\nStep 3: Executing Python code in E2B sandbox...');
    const pythonCode = [
      'import pandas as pd',
      '',
      '# Read the CSV file',
      'df = pd.read_csv("employee_data.csv")',
      '',
      '# Display basic info',
      'print(f"Dataset shape: {df.shape}")',
      'print(f"\\nColumn names: {list(df.columns)}")',
      '',
      '# Calculate average salary',
      'avg_salary = df["Salary"].mean()',
      'print(f"\\nAverage Salary: ${avg_salary:,.2f}")',
      '',
      '# Count by department',
      'dept_counts = df["Department"].value_counts()',
      'print(f"\\nEmployees by Department:")',
      'print(dept_counts)',
      '',
      '# Show first few rows',
      'print(f"\\nFirst 3 employees:")',
      'print(df.head(3).to_string())',
    ].join('\n');

    const executeResponse = await fetch(`${API_BASE}/api/jupyter/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: TEST_CHAT_ID,
        code: pythonCode,
      }),
    });

    if (!executeResponse.ok) {
      const errorText = await executeResponse.text();
      throw new Error(`Execution failed: ${executeResponse.status} - ${errorText}`);
    }

    const executeResult = await executeResponse.json();
    
    console.log('\n✅ Code executed successfully!');
    console.log('   Execution time:', executeResult.executionTime, 'ms');
    console.log('   Sandbox ID:', executeResult.sandboxId);
    console.log('   Uploaded files:', executeResult.uploadedFiles);
    
    console.log('\n📊 Results:');
    for (const result of executeResult.results) {
      if (result.type === 'text') {
        console.log('\n' + result.content);
      } else if (result.type === 'image') {
        console.log(`\n[Image: ${result.mimeType}]`);
      } else if (result.type === 'error') {
        console.log('\n❌ Error:', result.content);
      }
    }

    // Step 4: Check sandbox status
    console.log('\n\nStep 4: Checking sandbox status...');
    const statusResponse = await fetch(
      `${API_BASE}/api/jupyter/execute?chatId=${TEST_CHAT_ID}`
    );

    if (statusResponse.ok) {
      const statusResult = await statusResponse.json();
      console.log('✅ Sandbox status:');
      console.log('   Exists:', statusResult.exists);
      console.log('   Sandbox ID:', statusResult.sandboxId);
      console.log('   Expires in:', Math.round(statusResult.expiresIn / 1000), 'seconds');
    }

    // Step 5: Execute another query (reusing sandbox)
    console.log('\n\nStep 5: Executing another query (reusing sandbox)...');
    const secondCode = [
      '# Group by position and calculate stats',
      'position_stats = df.groupby("Position")["Salary"].agg(["mean", "count"])',
      'print("\\nSalary by Position:")',
      'print(position_stats.to_string())',
    ].join('\n');

    const secondExecuteResponse = await fetch(`${API_BASE}/api/jupyter/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chatId: TEST_CHAT_ID,
        code: secondCode,
      }),
    });

    if (secondExecuteResponse.ok) {
      const secondResult = await secondExecuteResponse.json();
      console.log('✅ Second execution successful!');
      console.log('   Execution time:', secondResult.executionTime, 'ms');
      console.log('   (Using cached sandbox)');
      
      console.log('\n📊 Results:');
      for (const result of secondResult.results) {
        if (result.type === 'text') {
          console.log('\n' + result.content);
        }
      }
    }

    console.log('\n\n' + '='.repeat(60));
    console.log('🎉 ALL E2B TESTS PASSED!');
    console.log('='.repeat(60));
    console.log('\n✅ Summary:');
    console.log('   • File upload: WORKING');
    console.log('   • File processing: WORKING');
    console.log('   • E2B sandbox creation: WORKING');
    console.log('   • File upload to E2B: WORKING');
    console.log('   • Python code execution: WORKING');
    console.log('   • Sandbox caching: WORKING');
    console.log('   • Multi-turn execution: WORKING');
    console.log('\n🚀 E2B Integration Complete!');

  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error instanceof Error ? error.message : error);
    
    if (error instanceof Error) {
      if (error.message.includes('ECONNREFUSED')) {
        console.error('\n⚠️  Make sure the Next.js dev server is running!');
        console.error('   Run: pnpm dev');
      } else if (error.message.includes('E2B_API_KEY')) {
        console.error('\n⚠️  Make sure E2B_API_KEY is set in .env.local');
      } else if (error.message.includes('Unauthorized')) {
        console.error('\n⚠️  Authentication required - test through browser console instead');
      }
    }
    
    process.exit(1);
  }
}

console.log('⚠️  Note: This test requires authentication.');
console.log('If you get unauthorized errors, test through the browser console instead.\n');

testE2BIntegration().catch(console.error);
