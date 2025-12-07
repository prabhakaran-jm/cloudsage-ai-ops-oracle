#!/usr/bin/env node
/**
 * Test script for Backend → Vultr Worker Integration
 * Tests the complete flow: Backend API → Vultr Worker → Response
 */

const WORKER_URL = process.env.VULTR_WORKER_URL || 'http://192.248.166.170:8080';
const API_KEY = process.env.VULTR_API_KEY || '90ccd4ced7150948cee67d6388452f8b732037b359874c9d41ee01413d065178';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

// Colors for output
const colors = {
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  reset: '\x1b[0m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

async function testWorkerHealth() {
  log('\n=== Test 1: Worker Health Check ===', 'cyan');
  try {
    const response = await fetch(`${WORKER_URL}/health`);
    const data = await response.json();
    
    if (response.ok && data.status === 'ok') {
      log('✅ Worker health check passed', 'green');
      log(`   Service: ${data.service}`, 'cyan');
      log(`   Timestamp: ${data.timestamp}`, 'cyan');
      return true;
    } else {
      log('❌ Worker health check failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Worker health check error: ${error.message}`, 'red');
    return false;
  }
}

async function testWorkerScore() {
  log('\n=== Test 2: Worker Score Endpoint ===', 'cyan');
  try {
    const testRequest = {
      projectId: 'test-integration-123',
      logs: [
        {
          content: 'ERROR: Database connection timeout after 30s',
          timestamp: new Date().toISOString(),
        },
        {
          content: 'WARN: High memory usage detected: 85%',
          timestamp: new Date().toISOString(),
        },
        {
          content: 'INFO: Request processed successfully',
          timestamp: new Date().toISOString(),
        },
      ],
      metadata: {
        serviceName: 'test-service',
        environment: 'test',
      },
    };

    const response = await fetch(`${WORKER_URL}/score`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
      },
      body: JSON.stringify(testRequest),
    });

    if (!response.ok) {
      const error = await response.text();
      log(`❌ Worker score request failed: ${response.status}`, 'red');
      log(`   Error: ${error}`, 'red');
      return false;
    }

    const data = await response.json();
    
    if (data.riskScore && typeof data.riskScore.score === 'number') {
      log('✅ Worker score calculation successful', 'green');
      log(`   Project ID: ${data.projectId}`, 'cyan');
      log(`   Risk Score: ${data.riskScore.score}/100`, 'cyan');
      log(`   Labels: ${data.riskScore.labels.join(', ')}`, 'cyan');
      log(`   Factors:`, 'cyan');
      Object.entries(data.riskScore.factors).forEach(([key, value]) => {
        log(`     - ${key}: ${value}`, 'cyan');
      });
      return true;
    } else {
      log('❌ Invalid response format', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Worker score error: ${error.message}`, 'red');
    return false;
  }
}

async function testBackendHealth() {
  log('\n=== Test 3: Backend Health Check ===', 'cyan');
  try {
    const response = await fetch(`${BACKEND_URL}/api/hello`);
    const data = await response.json();
    
    if (response.ok && data.status === 'ok') {
      log('✅ Backend health check passed', 'green');
      log(`   Message: ${data.message}`, 'cyan');
      return true;
    } else {
      log('❌ Backend health check failed', 'red');
      return false;
    }
  } catch (error) {
    log(`❌ Backend health check error: ${error.message}`, 'red');
    log(`   Make sure backend is running on ${BACKEND_URL}`, 'yellow');
    return false;
  }
}

async function testBackendWorkerIntegration() {
  log('\n=== Test 4: Backend → Worker Integration ===', 'cyan');
  
  // First, we need to authenticate and create a project
  // Then ingest logs which will call the worker
  
  try {
    // Use consistent test credentials
    const testEmail = `test-integration-${Date.now()}@example.com`;
    const testPassword = 'test-password-123';
    
    // Step 1: Register a test user
    log('   Step 1: Registering test user...', 'cyan');
    const registerResponse = await fetch(`${BACKEND_URL}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    if (!registerResponse.ok) {
      const errorData = await registerResponse.json().catch(() => ({}));
      log(`   ⚠️  Registration failed: ${JSON.stringify(errorData)}`, 'yellow');
    } else {
      log('   ✅ Test user registered', 'green');
    }

    // Step 2: Login with the same credentials
    log('   Step 2: Logging in...', 'cyan');
    const loginResponse = await fetch(`${BACKEND_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        password: testPassword,
      }),
    });

    let authToken = null;
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      authToken = loginData.token;
      log('   ✅ Login successful', 'green');
    } else {
      const errorData = await loginResponse.json().catch(() => ({ error: 'Unknown error' }));
      log(`   ⚠️  Login failed: ${JSON.stringify(errorData)}`, 'yellow');
      log(`   Email: ${testEmail}`, 'yellow');
      // Try to continue without auth for testing
    }

    // Step 3: Create a test project
    log('   Step 3: Creating test project...', 'cyan');
    const projectData = {
      name: 'Integration Test Project',
      description: 'Testing worker integration',
    };

    const createProjectResponse = await fetch(`${BACKEND_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify(projectData),
    });

    let projectId = null;
    if (createProjectResponse.ok) {
      const project = await createProjectResponse.json();
      projectId = project.id;
      log(`   ✅ Project created: ${projectId}`, 'green');
    } else {
      // Try to get existing project
      const projectsResponse = await fetch(`${BACKEND_URL}/api/projects`, {
        headers: {
          ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
        },
      });
      if (projectsResponse.ok) {
        const projects = await projectsResponse.json();
        if (projects.length > 0) {
          projectId = projects[0].id;
          log(`   ✅ Using existing project: ${projectId}`, 'green');
        }
      }
    }

    if (!projectId) {
      log('   ⚠️  Could not get project ID - skipping integration test', 'yellow');
      return false;
    }

    // Step 4: Ingest logs (this will call the worker)
    log('   Step 4: Ingesting logs (calls worker)...', 'cyan');
    const logsData = {
      logs: [
        {
          content: 'ERROR: Database connection failed',
          timestamp: new Date().toISOString(),
        },
        {
          content: 'WARN: High CPU usage: 95%',
          timestamp: new Date().toISOString(),
        },
        {
          content: 'INFO: Service started successfully',
          timestamp: new Date().toISOString(),
        },
      ],
    };

    const ingestResponse = await fetch(`${BACKEND_URL}/api/ingest/${projectId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(authToken && { 'Authorization': `Bearer ${authToken}` }),
      },
      body: JSON.stringify(logsData),
    });

    if (ingestResponse.ok) {
      const ingestResult = await ingestResponse.json();
      log('   ✅ Log ingestion successful', 'green');
      if (ingestResult.riskScore) {
        log(`   Risk Score: ${ingestResult.riskScore.score}/100`, 'cyan');
        log(`   Labels: ${ingestResult.riskScore.labels.join(', ')}`, 'cyan');
        log('   ✅ Backend successfully called worker!', 'green');
        return true;
      } else {
        log('   ⚠️  No risk score in response', 'yellow');
        return false;
      }
    } else {
      const error = await ingestResponse.text();
      log(`   ❌ Log ingestion failed: ${ingestResponse.status}`, 'red');
      log(`   Error: ${error}`, 'red');
      return false;
    }
  } catch (error) {
    log(`   ❌ Integration test error: ${error.message}`, 'red');
    return false;
  }
}

async function runAllTests() {
  log('\n🚀 Testing Backend → Worker Integration', 'cyan');
  log('='.repeat(50), 'cyan');
  
  log(`\nConfiguration:`, 'yellow');
  log(`  Worker URL: ${WORKER_URL}`, 'cyan');
  log(`  Backend URL: ${BACKEND_URL}`, 'cyan');
  log(`  API Key: ${API_KEY.substring(0, 20)}...`, 'cyan');

  const results = {
    workerHealth: await testWorkerHealth(),
    workerScore: await testWorkerScore(),
    backendHealth: await testBackendHealth(),
    integration: false,
  };

  // Only test integration if backend is running
  if (results.backendHealth) {
    results.integration = await testBackendWorkerIntegration();
  } else {
    log('\n⚠️  Skipping integration test - backend not running', 'yellow');
    log(`   Start backend with: cd apps/api && npm run dev`, 'yellow');
  }

  // Summary
  log('\n' + '='.repeat(50), 'cyan');
  log('\n📊 Test Summary:', 'cyan');
  log(`  Worker Health: ${results.workerHealth ? '✅ PASS' : '❌ FAIL'}`, results.workerHealth ? 'green' : 'red');
  log(`  Worker Score: ${results.workerScore ? '✅ PASS' : '❌ FAIL'}`, results.workerScore ? 'green' : 'red');
  log(`  Backend Health: ${results.backendHealth ? '✅ PASS' : '❌ FAIL'}`, results.backendHealth ? 'green' : 'red');
  log(`  Integration: ${results.integration ? '✅ PASS' : '❌ FAIL'}`, results.integration ? 'green' : 'red');

  const allPassed = Object.values(results).every(r => r);
  
  if (allPassed) {
    log('\n🎉 All tests passed! Integration is working correctly.', 'green');
  } else {
    log('\n⚠️  Some tests failed. Check the errors above.', 'yellow');
  }

  process.exit(allPassed ? 0 : 1);
}

// Check if fetch is available (Node.js 18+)
if (typeof fetch === 'undefined') {
  console.error('Error: This script requires Node.js 18+ with native fetch support');
  console.error('Or install node-fetch: npm install node-fetch');
  process.exit(1);
}

runAllTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});

